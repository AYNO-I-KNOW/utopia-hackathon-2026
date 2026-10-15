"""PANNs CNN14 cry detector + embedding classifier. torch/panns_inference are imported lazily."""

import hashlib
import json
import logging
import threading
from pathlib import Path
from typing import Protocol

import httpx
import numpy as np

from app.config import MODEL_CLIP_SECONDS, MODELS_DIR, SAMPLE_RATE, Settings

logger = logging.getLogger(__name__)

CRY_LABEL = "Baby cry, infant cry"
CLASSIFIER_FILE = "classifier.joblib"
LABELS_FILE = "labels.json"

PANNS_DATA_DIR = Path.home() / "panns_data"  # fixed by panns_inference (reads labels from ~)
DEFAULT_CHECKPOINT = PANNS_DATA_DIR / "Cnn14_mAP=0.431.pth"
LABELS_CSV = PANNS_DATA_DIR / "class_labels_indices.csv"
CHECKPOINT_URL = "https://zenodo.org/record/3987831/files/Cnn14_mAP%3D0.431.pth?download=1"
LABELS_CSV_URL = (
    "https://storage.googleapis.com/us_audioset/youtube_corpus/v1/csv/class_labels_indices.csv"
)
# TODO: set to the real sha256 of Cnn14_mAP=0.431.pth (shasum -a 256 on a trusted download).
# While None, the checkpoint is NOT integrity-checked.
CHECKPOINT_SHA256: str | None = None
MIN_CHECKPOINT_BYTES = 3 * 10**8  # same sanity threshold panns_inference uses
DOWNLOAD_TIMEOUT_S = 120


class ModelUnavailableError(RuntimeError):
    """Classifier or PANNs weights cannot be loaded (maps to HTTP 503)."""


class CryModel(Protocol):
    """Interface the API depends on; tests inject a fake."""

    @property
    def loaded(self) -> bool: ...

    def predict(self, waveform: np.ndarray) -> tuple[float, dict[str, float]]:
        """32 kHz mono float32 -> (cry probability, {label: probability})."""
        ...


def fit_length(waveform: np.ndarray, seconds: int = MODEL_CLIP_SECONDS) -> np.ndarray:
    """Zero-pad or crop to a fixed length (same transform as ml/extract_embeddings.py)."""
    target = seconds * SAMPLE_RATE
    if waveform.size >= target:
        return waveform[:target]
    return np.pad(waveform, (0, target - waveform.size))


def _download(url: str, dest: Path, sha256: str | None = None) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_suffix(dest.suffix + ".part")
    digest = hashlib.sha256()
    try:
        with httpx.stream("GET", url, follow_redirects=True, timeout=DOWNLOAD_TIMEOUT_S) as resp:
            resp.raise_for_status()
            with part.open("wb") as out:
                for chunk in resp.iter_bytes(1 << 20):
                    out.write(chunk)
                    digest.update(chunk)
    except httpx.HTTPError as exc:
        part.unlink(missing_ok=True)
        raise ModelUnavailableError(f"download failed: {url}") from exc
    if sha256 is not None and digest.hexdigest() != sha256.lower():
        part.unlink(missing_ok=True)
        raise ModelUnavailableError(f"checksum mismatch for download: {url}")
    part.replace(dest)


def ensure_panns_files(checkpoint: Path = DEFAULT_CHECKPOINT) -> None:
    """Fetch checkpoint + AudioSet labels if absent (panns_inference needs `wget` otherwise)."""
    if not LABELS_CSV.is_file():
        _download(LABELS_CSV_URL, LABELS_CSV)
    if not checkpoint.is_file() or checkpoint.stat().st_size < MIN_CHECKPOINT_BYTES:
        _download(CHECKPOINT_URL, checkpoint, CHECKPOINT_SHA256)


class PannsCryModel:
    def __init__(self, settings: Settings, models_dir: Path = MODELS_DIR) -> None:
        self._settings = settings
        self._models_dir = models_dir
        self._load_lock = threading.Lock()
        self._infer_lock = threading.Lock()
        self._tagger = None
        self._cry_index = -1
        self._classifier = None
        self._labels: list[str] = []

    @property
    def loaded(self) -> bool:
        return self._tagger is not None

    def warm_up(self) -> None:
        try:
            self._ensure_loaded()
        except ModelUnavailableError as exc:
            logger.warning("model warm-up failed: %s", exc)

    def _load_classifier(self) -> None:
        import joblib

        clf_path = self._models_dir / CLASSIFIER_FILE
        labels_path = self._models_dir / LABELS_FILE
        if not clf_path.is_file() or not labels_path.is_file():
            raise ModelUnavailableError("classifier not trained (run ml/train.py)")
        try:
            classifier = joblib.load(clf_path)
            labels = json.loads(labels_path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            raise ModelUnavailableError("classifier files unreadable") from exc
        if len(labels) != len(classifier.classes_):
            raise ModelUnavailableError("labels.json does not match classifier classes")
        self._classifier, self._labels = classifier, list(labels)

    def _load_tagger(self) -> None:
        checkpoint = Path(self._settings.panns_checkpoint or DEFAULT_CHECKPOINT)
        ensure_panns_files(checkpoint)
        try:
            from panns_inference import AudioTagging, labels  # heavy: torch + librosa

            tagger = AudioTagging(checkpoint_path=str(checkpoint), device="cpu")
            self._cry_index = list(labels).index(CRY_LABEL)
        except (ImportError, OSError, ValueError, RuntimeError) as exc:
            raise ModelUnavailableError("PANNs failed to load") from exc
        self._tagger = tagger

    def _ensure_loaded(self) -> None:
        if self.loaded:
            return
        with self._load_lock:
            if self.loaded:
                return
            self._load_classifier()
            self._load_tagger()

    def predict(self, waveform: np.ndarray) -> tuple[float, dict[str, float]]:
        self._ensure_loaded()
        audio = fit_length(waveform).astype(np.float32)[None, :]
        with self._infer_lock:
            clipwise, embedding = self._tagger.inference(audio)
        cry_prob = float(clipwise[0, self._cry_index])
        proba = self._classifier.predict_proba(embedding)[0]
        return cry_prob, {label: float(p) for label, p in zip(self._labels, proba)}


_singleton: PannsCryModel | None = None
_singleton_lock = threading.Lock()


def get_model() -> CryModel:
    global _singleton
    with _singleton_lock:
        if _singleton is None:
            _singleton = PannsCryModel(Settings.from_env())
        return _singleton
