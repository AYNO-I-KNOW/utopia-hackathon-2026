"""PANNs CNN14 cry detector + embedding classifier. torch/panns_inference are imported lazily."""

import hashlib
import json
import logging
import threading
from pathlib import Path
from typing import Protocol

import httpx
import numpy as np

from app.config import (
    CLEAR_CRY_PROB,
    MIN_AUDIO_SECONDS,
    MODEL_CLIP_SECONDS,
    MODELS_DIR,
    SAMPLE_RATE,
    WEAK_CRY_PROB,
    Settings,
)

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
# sha256 of Cnn14_mAP=0.431.pth; download matched Zenodo's md5 541141fa2ee191a88f24a3219fff024e.
CHECKPOINT_SHA256: str | None = "0dc499e40e9761ef5ea061ffc77697697f277f6a960894903df3ada000e34b31"
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


def split_windows(waveform: np.ndarray) -> list[np.ndarray]:
    """Consecutive MODEL_CLIP_SECONDS windows; a trailing partial one needs >= MIN_AUDIO_SECONDS."""
    step = MODEL_CLIP_SECONDS * SAMPLE_RATE
    min_tail = int(MIN_AUDIO_SECONDS * SAMPLE_RATE)
    windows = [waveform[:step]]
    for start in range(step, waveform.size, step):
        chunk = waveform[start : start + step]
        if chunk.size >= min_tail:
            windows.append(chunk)
    return windows


def _safe_result(result: tuple[float, dict[str, float]]) -> tuple[float, dict[str, float]]:
    cry_prob, probs = result
    cry_prob = float(cry_prob) if np.isfinite(cry_prob) else 0.0
    labels = list(probs)
    values = np.nan_to_num(np.array([probs[k] for k in labels], dtype=np.float64), nan=0.0, posinf=0.0, neginf=0.0)
    return cry_prob, dict(zip(labels, (float(v) for v in values)))


def predict_clip(model: CryModel, waveform: np.ndarray) -> tuple[float, dict[str, float]]:
    """First window wins; fall back to the best later window only if the start barely cries."""
    windows = split_windows(waveform)
    first = _safe_result(model.predict(windows[0]))
    if len(windows) == 1 or first[0] >= WEAK_CRY_PROB:
        return first
    best = max((_safe_result(model.predict(w)) for w in windows[1:]), key=lambda r: r[0])
    return best if best[0] >= CLEAR_CRY_PROB else first


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
        self._reason = None  # (waveform (1, N), PANNs embedding (1, 2048)) -> class probabilities
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
        if self._settings.finetuned_model:
            self._load_finetuned(Path(self._settings.finetuned_model))
            return
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
        self._reason = lambda _audio, embedding: classifier.predict_proba(embedding)[0]
        self._labels = list(labels)

    def _load_finetuned(self, path: Path) -> None:
        """TorchScript from ml/finetune_cnn14.py: waveform -> calibrated probabilities, labels inside."""
        if not path.is_absolute():
            path = self._models_dir.parent / path
        if not path.is_file():
            raise ModelUnavailableError(f"FINETUNED_MODEL not found: {path}")
        try:
            import torch

            extra = {"labels.json": ""}
            net = torch.jit.load(str(path), map_location="cpu", _extra_files=extra).eval()
            labels = json.loads(extra["labels.json"])
        except (ImportError, OSError, RuntimeError, ValueError) as exc:
            raise ModelUnavailableError("fine-tuned model unreadable") from exc
        if not labels:
            raise ModelUnavailableError("fine-tuned model has no labels.json")

        def reason(audio: np.ndarray, _embedding: np.ndarray) -> np.ndarray:
            with torch.inference_mode():
                return net(torch.from_numpy(audio)).numpy()[0]

        self._reason, self._labels = reason, list(labels)

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
            proba = self._reason(audio, embedding)
        cry_prob = float(clipwise[0, self._cry_index])
        return cry_prob, {label: float(p) for label, p in zip(self._labels, proba)}


_singleton: PannsCryModel | None = None
_singleton_lock = threading.Lock()


def get_model() -> CryModel:
    global _singleton
    with _singleton_lock:
        if _singleton is None:
            _singleton = PannsCryModel(Settings.from_env())
        return _singleton
