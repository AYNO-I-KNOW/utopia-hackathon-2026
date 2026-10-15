"""Env vars (ARCHITECTURE.md §7) and tuning constants (§4). Missing keys never crash startup."""

import math
import os
from dataclasses import dataclass
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
ADVICE_DIR = BASE_DIR / "knowledge" / "advice"
MODELS_DIR = BASE_DIR / "models"

LABELS_9 = (
    "hungry",
    "hug",
    "awake",
    "uncomfortable",
    "sleepy",
    "diaper",
    "belly_pain",
    "burping",
    "cold_hot",
)
LANGS = ("th", "en")

# --- decision thresholds (§4) ---
# 5th percentile of "Baby cry, infant cry" on Baidu train-split cries: keeps 96.7% of held-out cries;
# 0/241 non-cries (speech, music, silence, ESC-50) pass (max 0.014). 0.3 dropped 28% of real cries.
CRY_THRESHOLD = 0.05
CLOSE_MARGIN = 0.15
UNSURE_MAX = 0.40
LULLABY_LABELS = frozenset({"sleepy", "hug", "awake"})

# --- activity priors (§4): context minutes -> multiplier on a class ---
FEED_RECENT_MIN = 60
HUNGRY_RECENT_MULT = 0.5
FEED_LONG_MIN = 180
HUNGRY_LONG_MULT = 1.5
DIAPER_RECENT_MIN = 30
DIAPER_RECENT_MULT = 0.5
SLEEP_END_LONG_MIN = 120
SLEEPY_LONG_MULT = 1.3

# --- upload / audio ---
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MIN_AUDIO_SECONDS = 1.0
MAX_AUDIO_SECONDS = 30.0
SAMPLE_RATE = 32_000
MODEL_CLIP_SECONDS = 10
FFMPEG_TIMEOUT_S = 8
# Demuxers ffmpeg may use on uploads (blocks playlist/concat/etc. formats that fetch other URLs)
FFMPEG_FORMAT_WHITELIST = "matroska,webm,mov,mp4,m4a,wav,ogg,mp3,aac"
MAX_CONCURRENT_ANALYSES = 2

# --- external services ---
LLM_TIMEOUT_S = 8
TTS_TIMEOUT_S = 15
TTS_MAX_CHARS = 600
TTS_MODEL_ID = "eleven_v3"
DEFAULT_TTS_SPEED = 1.15
TTS_SPEED_MIN = 0.7  # ElevenLabs voice_settings.speed range
TTS_SPEED_MAX = 1.2
ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"

# --- API hygiene ---
RATE_LIMIT_PER_MIN = 30
SPEAK_RATE_LIMIT_PER_MIN = 5
DEFAULT_TTS_DAILY_CHAR_BUDGET = 50_000
CODESANDBOX_ORIGIN_REGEX = r"https://[a-z0-9-]+\.(codesandbox\.io|csb\.app)"
DEFAULT_ALLOWED_ORIGINS = "http://127.0.0.1:4175,http://localhost:4175"


def _int_env(name: str, default: int, minimum: int) -> int:
    """Int env var; unset, malformed or below `minimum` -> default (never crash startup)."""
    raw = os.environ.get(name, "").strip()
    try:
        value = int(raw)
    except ValueError:
        return default
    return value if value >= minimum else default


def _float_env(name: str, default: float, minimum: float, maximum: float) -> float:
    """Float env var clamped to [minimum, maximum]; unset, malformed or non-finite -> default."""
    raw = os.environ.get(name, "").strip()
    try:
        value = float(raw)
    except ValueError:
        return default
    if not math.isfinite(value):
        return default
    return min(max(value, minimum), maximum)


@dataclass(frozen=True)
class Settings:
    openai_api_key: str
    openai_model: str
    elevenlabs_api_key: str
    voice_id_th: str
    voice_id_en: str
    allowed_origins: tuple[str, ...]
    panns_checkpoint: str | None
    tts_daily_char_budget: int = DEFAULT_TTS_DAILY_CHAR_BUDGET
    tts_speed: float = DEFAULT_TTS_SPEED
    trusted_proxy_hops: int = 0  # 0 = ignore X-Forwarded-For
    finetuned_model: str | None = None  # TorchScript from ml/finetune_cnn14.py; None = joblib

    @classmethod
    def from_env(cls) -> "Settings":
        env = os.environ.get
        origins = env("ALLOWED_ORIGINS", DEFAULT_ALLOWED_ORIGINS)
        return cls(
            openai_api_key=env("OPENAI_API_KEY", "").strip(),
            openai_model=env("OPENAI_MODEL", "").strip(),
            elevenlabs_api_key=env("ELEVENLABS_API_KEY", "").strip(),
            voice_id_th=env("ELEVENLABS_VOICE_ID_TH", "").strip(),
            voice_id_en=env("ELEVENLABS_VOICE_ID_EN", "").strip(),
            # "*" entries (e.g. https://*.codesandbox.io) are covered by the regex, not the list
            allowed_origins=tuple(
                o.strip() for o in origins.split(",") if o.strip() and "*" not in o
            ),
            panns_checkpoint=env("PANNS_CHECKPOINT") or None,
            tts_daily_char_budget=_int_env("TTS_DAILY_CHAR_BUDGET", DEFAULT_TTS_DAILY_CHAR_BUDGET, 0),
            tts_speed=_float_env("TTS_SPEED", DEFAULT_TTS_SPEED, TTS_SPEED_MIN, TTS_SPEED_MAX),
            trusted_proxy_hops=_int_env("TRUSTED_PROXY_HOPS", 0, 1),
            finetuned_model=env("FINETUNED_MODEL") or None,
        )

    def voice_id(self, lang: str) -> str:
        return self.voice_id_th if lang == "th" else self.voice_id_en
