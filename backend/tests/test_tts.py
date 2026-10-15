import asyncio
import json
from datetime import date

import httpx
import pytest

from app.config import TTS_MAX_CHARS
from app.tts import (
    cache_key,
    DailyCharBudget,
    TtsBudgetExhaustedError,
    TtsService,
    TtsUnavailableError,
    TtsUpstreamError,
)
from tests.conftest import make_settings

def settings(**overrides):
    base = dict(elevenlabs_api_key="secret-key", voice_id_th="vth", voice_id_en="ven")
    return make_settings(**{**base, **overrides})


def run(coro):
    return asyncio.run(coro)


def test_request_shape_and_voice_by_lang():
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, content=b"mp3")

    svc = TtsService(settings(), transport=httpx.MockTransport(handler))
    assert run(svc.synthesize("สวัสดี", "th")) == b"mp3"
    req = seen[0]
    assert str(req.url) == "https://api.elevenlabs.io/v1/text-to-speech/vth"
    assert req.headers["xi-api-key"] == "secret-key"
    assert req.headers["accept"] == "audio/mpeg"
    assert json.loads(req.content) == {
        "text": "สวัสดี",
        "model_id": "eleven_v3",
        "voice_settings": {"speed": 1.15},
    }
    run(svc.synthesize("hello", "en"))
    assert seen[1].url.path.endswith("/ven")


def test_payload_uses_configured_speed():
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(json.loads(request.content))
        return httpx.Response(200, content=b"mp3")

    svc = TtsService(
        make_settings(elevenlabs_api_key="k", voice_id_en="ven", tts_speed=0.9),
        transport=httpx.MockTransport(handler),
    )
    run(svc.synthesize("hi", "en"))
    assert seen[0]["voice_settings"] == {"speed": 0.9}


def test_text_capped():
    seen = []

    def handler(request):
        seen.append(json.loads(request.content))
        return httpx.Response(200, content=b"x")

    run(TtsService(settings(), transport=httpx.MockTransport(handler)).synthesize("a" * 2000, "en"))
    assert len(seen[0]["text"]) == TTS_MAX_CHARS


@pytest.mark.parametrize(
    "overrides",
    [{}, {"elevenlabs_api_key": "k"}, {"voice_id_en": "v"}],
)
def test_unconfigured_raises_unavailable(overrides):
    with pytest.raises(TtsUnavailableError):
        run(TtsService(make_settings(**overrides)).synthesize("hi", "en"))


def test_http_error_and_network_error_raise_upstream():
    svc = TtsService(settings(), transport=httpx.MockTransport(lambda r: httpx.Response(401)))
    with pytest.raises(TtsUpstreamError):
        run(svc.synthesize("hi", "en"))

    def boom(request):
        raise httpx.ConnectError("down")

    svc = TtsService(settings(), transport=httpx.MockTransport(boom))
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
        run(svc.synthesize("abd", "en"))
    assert len(calls) == 1


def test_unconfigured_does_not_spend_budget():
    svc = TtsService(make_settings(tts_daily_char_budget=3))
    with pytest.raises(TtsUnavailableError):
        run(svc.synthesize("abc", "en"))
    assert svc._budget.try_spend(3)


# --- disk cache ---


def counting_service(tmp_path=None, **overrides):
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(200, content=b"mp3-bytes")

    svc = TtsService(settings(**overrides), transport=httpx.MockTransport(handler))
    return svc, calls


def test_cache_miss_writes_file_then_hit_skips_http_and_budget():
    svc, calls = counting_service(tts_daily_char_budget=5)
    path = svc.cache_path("abc", "en")
    assert not path.exists()
    assert run(svc.synthesize("abc", "en")) == b"mp3-bytes"
    assert path.read_bytes() == b"mp3-bytes" and len(calls) == 1
    assert not list(path.parent.glob("*.tmp"))  # atomic write leaves no temp file
    for _ in range(3):  # budget (5) would be exhausted if hits were charged
        assert run(svc.synthesize("abc", "en")) == b"mp3-bytes"
    assert len(calls) == 1
    assert svc._budget.try_spend(2)  # only the miss spent 3 of 5


def test_cache_hit_works_without_api_key():
    seed, _ = counting_service()
    run(seed.synthesize("abc", "en"))
    offline = TtsService(settings(elevenlabs_api_key="", tts_cache_dir=seed._settings.tts_cache_dir))
    assert run(offline.synthesize("abc", "en")) == b"mp3-bytes"


def test_cache_key_changes_with_speed_voice_text_model():
    base = cache_key("m", "v", 1.15, "hi")
    assert base == cache_key("m", "v", 1.15, "hi")
    assert len({base, cache_key("m", "v", 1.1, "hi"), cache_key("m", "v2", 1.15, "hi"),
                cache_key("m", "v", 1.15, "hi!"), cache_key("m2", "v", 1.15, "hi")}) == 5


def test_service_paths_differ_by_speed_voice_and_text():
    a = counting_service()[0]
    b = counting_service(tts_speed=0.9)[0]
    c = counting_service(voice_id_en="other")[0]
    paths = {a.cache_path("hi", "en"), b.cache_path("hi", "en"), c.cache_path("hi", "en"),
             a.cache_path("hi!", "en"), a.cache_path("hi", "th")}
    assert len(paths) == 5


def test_upstream_error_does_not_write_cache():
    svc = TtsService(settings(), transport=httpx.MockTransport(lambda r: httpx.Response(500)))
    with pytest.raises(TtsUpstreamError):
        run(svc.synthesize("abc", "en"))
    assert not svc.cache_path("abc", "en").exists()
