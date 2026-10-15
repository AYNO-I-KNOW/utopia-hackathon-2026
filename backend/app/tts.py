"""ElevenLabs text-to-speech (eleven_v3 is the model that supports Thai)."""

import logging
import threading
from collections.abc import Callable
from datetime import date, datetime, timezone
from typing import Protocol

import httpx

from app.config import (
    ELEVENLABS_TTS_URL,
    TTS_MAX_CHARS,
    TTS_MODEL_ID,
    TTS_TIMEOUT_S,
    Settings,
)

logger = logging.getLogger(__name__)


class TtsUnavailableError(RuntimeError):
    """API key or voice id not configured (maps to HTTP 503)."""


class TtsBudgetExhaustedError(TtsUnavailableError):
    """Daily character budget used up (maps to HTTP 503)."""


class TtsUpstreamError(RuntimeError):
    """ElevenLabs request failed (maps to HTTP 502)."""


def _utc_today() -> date:
    return datetime.now(timezone.utc).date()


class DailyCharBudget:
    """In-process cap on characters sent to ElevenLabs per UTC day (resets at UTC midnight)."""

    def __init__(self, limit: int, today: Callable[[], date] = _utc_today) -> None:
        self._limit = limit
        self._today = today
        self._day = today()
        self._spent = 0
        self._lock = threading.Lock()

    def try_spend(self, chars: int) -> bool:
        with self._lock:
            if self._today() != self._day:
                self._day, self._spent = self._today(), 0
            if self._spent + chars > self._limit:
                return False
            self._spent += chars
            return True


class Speaker(Protocol):
    async def synthesize(self, text: str, lang: str) -> bytes: ...


class TtsService:
    def __init__(self, settings: Settings, transport: httpx.AsyncBaseTransport | None = None):
        self._settings = settings
        self._transport = transport
        self._budget = DailyCharBudget(settings.tts_daily_char_budget)

    async def synthesize(self, text: str, lang: str) -> bytes:
        voice_id = self._settings.voice_id(lang)
        if not self._settings.elevenlabs_api_key or not voice_id:
            raise TtsUnavailableError("ElevenLabs key or voice id not configured")
        text = text[:TTS_MAX_CHARS]
        if not self._budget.try_spend(len(text)):
            raise TtsBudgetExhaustedError("daily text-to-speech budget exhausted")
        try:
            async with httpx.AsyncClient(timeout=TTS_TIMEOUT_S, transport=self._transport) as http:
                resp = await http.post(
                    ELEVENLABS_TTS_URL.format(voice_id=voice_id),
                    headers={
                        "xi-api-key": self._settings.elevenlabs_api_key,
                        "Accept": "audio/mpeg",
                    },
                    json={
                        "text": text,
                        "model_id": TTS_MODEL_ID,
                        "voice_settings": {"speed": self._settings.tts_speed},
                    },
                )
                resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.warning("ElevenLabs returned HTTP %s", exc.response.status_code)
            raise TtsUpstreamError("text-to-speech provider error") from exc
        except httpx.HTTPError as exc:
            logger.warning("ElevenLabs request failed: %s", type(exc).__name__)
            raise TtsUpstreamError("text-to-speech provider unreachable") from exc
        return resp.content
