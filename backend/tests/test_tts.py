import asyncio
import json
from datetime import date

import httpx
import pytest

from app.config import TTS_MAX_CHARS
from app.tts import (
    DailyCharBudget,
    TtsBudgetExhaustedError,
    TtsService,
    TtsUnavailableError,
    TtsUpstreamError,
)
from tests.conftest import make_settings

SETTINGS = make_settings(elevenlabs_api_key="secret-key", voice_id_th="vth", voice_id_en="ven")


def run(coro):
    return asyncio.run(coro)


def test_request_shape_and_voice_by_lang():
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, content=b"mp3")

    svc = TtsService(SETTINGS, transport=httpx.MockTransport(handler))
    assert run(svc.synthesize("สวัสดี", "th")) == b"mp3"
    req = seen[0]
    assert str(req.url) == "https://api.elevenlabs.io/v1/text-to-speech/vth"
    assert req.headers["xi-api-key"] == "secret-key"
    assert req.headers["accept"] == "audio/mpeg"
    assert json.loads(req.content) == {"text": "สวัสดี", "model_id": "eleven_v3"}
    run(svc.synthesize("hello", "en"))
    assert seen[1].url.path.endswith("/ven")


def test_text_capped():
    seen = []

    def handler(request):
        seen.append(json.loads(request.content))
        return httpx.Response(200, content=b"x")

    run(TtsService(SETTINGS, transport=httpx.MockTransport(handler)).synthesize("a" * 2000, "en"))
    assert len(seen[0]["text"]) == TTS_MAX_CHARS


@pytest.mark.parametrize(
    "settings",
    [make_settings(), make_settings(elevenlabs_api_key="k"), make_settings(voice_id_en="v")],
)
def test_unconfigured_raises_unavailable(settings):
    with pytest.raises(TtsUnavailableError):
        run(TtsService(settings).synthesize("hi", "en"))


def test_http_error_and_network_error_raise_upstream():
    svc = TtsService(SETTINGS, transport=httpx.MockTransport(lambda r: httpx.Response(401)))
    with pytest.raises(TtsUpstreamError):
        run(svc.synthesize("hi", "en"))

    def boom(request):
        raise httpx.ConnectError("down")

    svc = TtsService(SETTINGS, transport=httpx.MockTransport(boom))
    with pytest.raises(TtsUpstreamError):
        run(svc.synthesize("hi", "en"))


def test_daily_budget_spends_and_resets_at_utc_midnight():
    today = [date(2026, 10, 15)]
    budget = DailyCharBudget(10, today=lambda: today[0])
    assert budget.try_spend(6) and budget.try_spend(4)
    assert not budget.try_spend(1)
    today[0] = date(2026, 10, 16)
    assert budget.try_spend(10)


def test_budget_exhaustion_blocks_upstream_call():
    calls = []

    def handler(request):
        calls.append(1)
        return httpx.Response(200, content=b"x")

    settings = make_settings(
        elevenlabs_api_key="k", voice_id_en="v", tts_daily_char_budget=5
    )
    svc = TtsService(settings, transport=httpx.MockTransport(handler))
    run(svc.synthesize("abc", "en"))
    with pytest.raises(TtsBudgetExhaustedError):
        run(svc.synthesize("abc", "en"))
    assert len(calls) == 1


def test_unconfigured_does_not_spend_budget():
    svc = TtsService(make_settings(tts_daily_char_budget=3))
    with pytest.raises(TtsUnavailableError):
        run(svc.synthesize("abc", "en"))
    assert svc._budget.try_spend(3)
