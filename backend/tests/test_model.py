import sys

import numpy as np
import pytest

from app.config import MODEL_CLIP_SECONDS, SAMPLE_RATE
from app import model as model_mod
from app.model import ModelUnavailableError, PannsCryModel, fit_length
from tests.conftest import make_settings


def test_fit_length_pads_and_crops():
    target = MODEL_CLIP_SECONDS * SAMPLE_RATE
    short = np.ones(100, dtype=np.float32)
    padded = fit_length(short)
    assert padded.size == target and padded[:100].all() and not padded[100:].any()
    assert fit_length(np.ones(target * 2, dtype=np.float32)).size == target
    assert short.size == 100  # input untouched


def test_missing_classifier_is_unavailable_without_loading_torch(tmp_path):
    model = PannsCryModel(make_settings(), models_dir=tmp_path)
    assert model.loaded is False
    with pytest.raises(ModelUnavailableError):
        model.predict(np.zeros(SAMPLE_RATE * 2, dtype=np.float32))
    assert "torch" not in sys.modules
    assert model.loaded is False


def test_warm_up_swallows_unavailable(tmp_path):
    PannsCryModel(make_settings(), models_dir=tmp_path).warm_up()


class FakeStream:
    def __init__(self, payload: bytes):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def raise_for_status(self):
        pass

    def iter_bytes(self, size):
        yield self.payload


def test_download_verifies_sha256(tmp_path, monkeypatch):
    import hashlib

    monkeypatch.setattr(model_mod.httpx, "stream", lambda *a, **k: FakeStream(b"weights"))
    dest = tmp_path / "w.pth"
    model_mod._download("https://x/w", dest, hashlib.sha256(b"weights").hexdigest())
    assert dest.read_bytes() == b"weights"


def test_download_rejects_checksum_mismatch(tmp_path, monkeypatch):
    monkeypatch.setattr(model_mod.httpx, "stream", lambda *a, **k: FakeStream(b"weights"))
    dest = tmp_path / "w.pth"
    with pytest.raises(ModelUnavailableError):
        model_mod._download("https://x/w", dest, "0" * 64)
    assert not dest.exists() and not list(tmp_path.iterdir())


def test_download_without_checksum_skips_verification(tmp_path, monkeypatch):
    monkeypatch.setattr(model_mod.httpx, "stream", lambda *a, **k: FakeStream(b"weights"))
    model_mod._download("https://x/w", tmp_path / "w.pth")
    assert (tmp_path / "w.pth").exists()


def test_all_download_urls_are_https():
    assert model_mod.LABELS_CSV_URL.startswith("https://")
    assert model_mod.CHECKPOINT_URL.startswith("https://")


class FakeTagger:
    def inference(self, audio):
        return np.ones((1, 1), dtype=np.float32), np.zeros((1, 2048), dtype=np.float32)


def _use_fake_tagger(monkeypatch):
    def load(self):
        self._tagger, self._cry_index = FakeTagger(), 0

    monkeypatch.setattr(PannsCryModel, "_load_tagger", load)


def test_missing_finetuned_model_is_unavailable(tmp_path, monkeypatch):
    _use_fake_tagger(monkeypatch)
    model = PannsCryModel(make_settings(finetuned_model=str(tmp_path / "nope.pt")), models_dir=tmp_path)
    with pytest.raises(ModelUnavailableError):
        model.predict(np.zeros(SAMPLE_RATE * 2, dtype=np.float32))


def test_finetuned_model_replaces_joblib_classifier(tmp_path, monkeypatch):
    torch = pytest.importorskip("torch")
    import json

    class Net(torch.nn.Module):
        def forward(self, wav):
            return torch.softmax(torch.stack([wav.mean(dim=1), wav.mean(dim=1) + 1.0], dim=1), dim=1)

    probe = torch.zeros(1, MODEL_CLIP_SECONDS * SAMPLE_RATE)
    path = tmp_path / "cry_net.pt"
    torch.jit.save(torch.jit.trace(Net(), probe), str(path), _extra_files={"labels.json": json.dumps(["a", "b"])})
    _use_fake_tagger(monkeypatch)
    model = PannsCryModel(make_settings(finetuned_model=str(path)), models_dir=tmp_path)  # no joblib in tmp_path

    cry_prob, probs = model.predict(np.zeros(SAMPLE_RATE * 2, dtype=np.float32))

    assert cry_prob == 1.0
    assert set(probs) == {"a", "b"} and probs["b"] > probs["a"]
    assert abs(sum(probs.values()) - 1.0) < 1e-6
