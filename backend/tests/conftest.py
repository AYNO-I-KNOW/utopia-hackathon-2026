import io
import wave
from dataclasses import dataclass, field

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.llm import SummaryResult
from app.main import create_app, get_llm, get_tts
from app.model import ModelUnavailableError, get_model
from app.tts import TtsService

# per-test cache dir so TTS tests never touch (or hit) the committed backend/tts_cache
TTS_CACHE = {"dir": None}

PROBS = {"hungry": 0.72, "sleepy": 0.18, "diaper": 0.05, "hug": 0.03, "awake": 0.02}


def make_settings(**overrides) -> Settings:
    base = dict(
        openai_api_key="",
        openai_model="",
        elevenlabs_api_key="",
        voice_id_th="",
        voice_id_en="",
        allowed_origins=("http://127.0.0.1:4175",),
        panns_checkpoint=None,
        tts_cache_dir=TTS_CACHE["dir"],
    )
    return Settings(**{**base, **overrides})


def make_wav(seconds: float, rate: int = 16_000) -> bytes:
    t = np.arange(int(seconds * rate)) / rate
    pcm = (0.3 * np.sin(2 * np.pi * 440 * t) * 32767).astype("<i2")
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm.tobytes())
    return buf.getvalue()


@dataclass
class FakeModel:
    cry_prob: float = 0.97
    probs: dict = field(default_factory=lambda: dict(PROBS))
    loaded: bool = True
    calls: int = 0

    def predict(self, waveform):
        self.calls += 1
        return self.cry_prob, dict(self.probs)


class UnavailableModel:
    loaded = False

    def predict(self, waveform):
        raise ModelUnavailableError("no classifier")


class FakeLlm:
    def __init__(self):
        self.calls = []

    async def summarise(self, case, top, context, lang):
        self.calls.append((case, top, context, lang))
        return SummaryResult("fake summary", ("a", "b", "c"), False)


@pytest.fixture(autouse=True)
def _isolated_tts_cache(tmp_path):
    TTS_CACHE["dir"] = tmp_path / "tts_cache"


@pytest.fixture
def wav_bytes() -> bytes:
    return make_wav(2.0)


@pytest.fixture
def fake_llm() -> FakeLlm:
    return FakeLlm()


@pytest.fixture
def make_client(fake_llm):
    def build(model=None, llm=None, tts=None) -> TestClient:
        app = create_app()
        app.dependency_overrides[get_model] = lambda: model or FakeModel()
        app.dependency_overrides[get_llm] = lambda: llm or fake_llm
        app.dependency_overrides[get_tts] = lambda: tts or TtsService(make_settings())
        return TestClient(app)

    return build
