import json
import shutil
import threading

import httpx
import openai
import pytest

from app import main
from app.config import MAX_UPLOAD_BYTES, TTS_MAX_CHARS
from app.llm import LlmService
from app.tts import TtsService
from tests.conftest import FakeModel, UnavailableModel, make_settings, make_wav

requires_ffmpeg = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not on PATH")


def post_analyze(client, audio: bytes, lang="en", context=None, filename="clip.wav"):
    data = {"lang": lang}
    if context is not None:
        data["context"] = context
    return client.post("/analyze", data=data, files={"audio": (filename, audio, "audio/wav")})


class TestHealth:
    def test_reports_model_loaded(self, make_client):
        res = make_client(model=FakeModel(loaded=True)).get("/health")
        assert res.json() == {"ok": True, "model_loaded": True}

    def test_reports_model_not_loaded(self, make_client):
        res = make_client(model=UnavailableModel()).get("/health")
        assert res.status_code == 200
        assert res.json() == {"ok": True, "model_loaded": False}


@requires_ffmpeg
class TestAnalyze:
    def test_happy_path_contract(self, make_client, wav_bytes, fake_llm):
        ctx = json.dumps({"last_feed_min": 200, "last_diaper_min": None})
        res = post_analyze(make_client(), wav_bytes, lang="th", context=ctx)
        assert res.status_code == 200
        body = res.json()
        assert set(body) == {
            "case", "cry_prob", "top", "ask", "summary", "checklist", "suggest_lullaby", "see_doctor"
        }  # fmt: skip
        assert body["case"] == "confident"
        assert body["cry_prob"] == 0.97
        assert [t["label"] for t in body["top"]] == ["hungry", "sleepy", "diaper"]
        assert body["summary"] == "fake summary"
        assert body["checklist"] == ["a", "b", "c"]
        assert body["see_doctor"] is False
        case, top, context, lang = fake_llm.calls[0]
        assert (case, lang) == ("confident", "th")
        assert context == {"last_feed_min": 200}  # null dropped before reaching the LLM

    def test_close_case_returns_ask(self, make_client, wav_bytes):
        model = FakeModel(probs={"hungry": 0.45, "diaper": 0.40, "sleepy": 0.15})
        body = post_analyze(make_client(model=model), wav_bytes).json()
        assert body["case"] == "close"
        assert body["ask"] == ["last_feed", "last_diaper"]

    def test_no_cry_skips_llm(self, make_client, wav_bytes, fake_llm):
        body = post_analyze(make_client(model=FakeModel(cry_prob=0.01)), wav_bytes).json()
        assert body["case"] == "no_cry"
        assert body["top"] == [] and body["suggest_lullaby"] is False
        assert len(body["checklist"]) == 3
        assert fake_llm.calls == []

    def test_bad_lang_400(self, make_client, wav_bytes):
        assert post_analyze(make_client(), wav_bytes, lang="fr").status_code == 400

    def test_missing_audio_400(self, make_client):
        assert make_client().post("/analyze", data={"lang": "en"}).status_code == 400

    def test_too_short_audio_400(self, make_client):
        res = post_analyze(make_client(), make_wav(0.5))
        assert res.status_code == 400
        assert "short" in res.json()["detail"]

    def test_too_long_audio_400(self, make_client):
        assert post_analyze(make_client(), make_wav(31, rate=8000)).status_code == 400

    def test_garbage_audio_400(self, make_client):
        assert post_analyze(make_client(), b"not audio at all" * 50).status_code == 400

    def test_empty_file_400(self, make_client):
        assert post_analyze(make_client(), b"").status_code == 400

    def test_oversize_413(self, make_client):
        res = post_analyze(make_client(), b"\0" * (MAX_UPLOAD_BYTES + 1))
        assert res.status_code == 413

    @pytest.mark.parametrize(
        "context",
        ["not json", "[1, 2]", '{"last_feed_min": -5}', '{"last_feed_min": "soon"}',
         '{"last_diaper_min": 1.5}', '{"last_sleep_end_min": true}'],
    )  # fmt: skip
    def test_bad_context_400(self, make_client, wav_bytes, context):
        assert post_analyze(make_client(), wav_bytes, context=context).status_code == 400

    def test_empty_object_context_ok(self, make_client, wav_bytes):
        assert post_analyze(make_client(), wav_bytes, context="{}").status_code == 200

    def test_model_unavailable_503(self, make_client, wav_bytes):
        res = post_analyze(make_client(model=UnavailableModel()), wav_bytes)
        assert res.status_code == 503

    def test_llm_failure_returns_200_with_fallback(self, make_client, wav_bytes):
        class Boom:
            class responses:
                @staticmethod
                async def parse(**_):
                    raise openai.APIConnectionError(request=httpx.Request("POST", "http://x"))

        llm = LlmService(make_settings(openai_api_key="k", openai_model="m", use_llm=True), client=Boom())
        res = post_analyze(make_client(llm=llm), wav_bytes, lang="en")
        assert res.status_code == 200
        body = res.json()
        assert body["case"] == "confident"
        assert body["summary"].startswith("Your baby may be hungry")
        assert len(body["checklist"]) == 3 and body["see_doctor"] is False

    def test_rate_limit_429(self, make_client, wav_bytes):
        client = make_client()
        codes = [post_analyze(client, wav_bytes).status_code for _ in range(31)]
        assert codes[:30] == [200] * 30
        assert codes[30] == 429


class TestSpeak:
    def test_503_without_key(self, make_client):
        res = make_client().post("/speak", json={"text": "hi", "lang": "en"})
        assert res.status_code == 503

    def test_returns_mpeg(self, make_client):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, content=b"ID3fake")

        settings = make_settings(elevenlabs_api_key="k", voice_id_en="v")
        tts = TtsService(settings, transport=httpx.MockTransport(handler))
        res = make_client(tts=tts).post("/speak", json={"text": "hi", "lang": "en"})
        assert res.status_code == 200
        assert res.headers["content-type"] == "audio/mpeg"
        assert res.content == b"ID3fake"

    def test_upstream_error_502(self, make_client):
        settings = make_settings(elevenlabs_api_key="k", voice_id_en="v")
        transport = httpx.MockTransport(lambda r: httpx.Response(500))
        res = make_client(tts=TtsService(settings, transport=transport)).post(
            "/speak", json={"text": "hi", "lang": "en"}
        )
        assert res.status_code == 502

    @pytest.mark.parametrize(
        "body",
        [{"text": "hi", "lang": "fr"}, {"text": "  ", "lang": "en"}, {"lang": "en"},
         {"text": "x" * (TTS_MAX_CHARS + 1), "lang": "en"}],
    )  # fmt: skip
    def test_bad_body_400(self, make_client, body):
        assert make_client().post("/speak", json=body).status_code == 400


def test_cors_allows_configured_origins_only(make_client):
    client = make_client()
    allowed = ("http://127.0.0.1:4175",)
    for origin in allowed:
        res = client.get("/health", headers={"Origin": origin})
        assert res.headers["access-control-allow-origin"] == origin
    denied = (
        "https://evil.example",
        "https://abc-123.codesandbox.io",
        "https://abc-3000.csb.app",
        "https://evil.example/.codesandbox.io",
        "http://127.0.0.1:4176",
    )
    for origin in denied:
        res = client.get("/health", headers={"Origin": origin})
        assert "access-control-allow-origin" not in res.headers, origin


def test_read_limited_rejects_streams_over_limit():
    import asyncio

    from fastapi import HTTPException

    from app.main import _read_limited

    class Upload:
        def __init__(self, total):
            self.left = total

        async def read(self, n):
            take = min(n, self.left)
            self.left -= take
            return b"x" * take

    assert len(asyncio.run(_read_limited(Upload(MAX_UPLOAD_BYTES)))) == MAX_UPLOAD_BYTES
    with pytest.raises(HTTPException) as exc:
        asyncio.run(_read_limited(Upload(MAX_UPLOAD_BYTES + 1)))
    assert exc.value.status_code == 413


@requires_ffmpeg
class TestHardening:
    def test_analyze_without_content_length_411(self, make_client, wav_bytes):
        def chunks():
            yield b"x" * 10

        res = make_client().post("/analyze", content=chunks())
        assert res.status_code == 411

    def test_busy_when_no_slot_free_503(self, make_client, wav_bytes, monkeypatch):
        monkeypatch.setattr(main, "_INFLIGHT", threading.BoundedSemaphore(0))
        res = post_analyze(make_client(), wav_bytes)
        assert res.status_code == 503 and "busy" in res.json()["detail"]

    def test_slot_released_after_success_and_failure(self, make_client, wav_bytes, monkeypatch):
        sem = threading.BoundedSemaphore(1)
        monkeypatch.setattr(main, "_INFLIGHT", sem)
        client = make_client()
        assert post_analyze(client, wav_bytes).status_code == 200
        assert post_analyze(client, make_wav(0.3)).status_code == 400
        assert post_analyze(make_client(model=UnavailableModel()), wav_bytes).status_code == 503
        assert sem.acquire(blocking=False)  # still free after all three
        sem.release()


class TestSpeakAbuse:
    def tts(self, budget=1000):
        settings = make_settings(
            elevenlabs_api_key="k", voice_id_en="v", tts_daily_char_budget=budget
        )
        return TtsService(settings, transport=httpx.MockTransport(lambda r: httpx.Response(200, content=b"a")))

    def test_speak_limited_to_5_per_minute_separately_from_analyze(self, make_client):
        client = make_client(tts=self.tts())
        codes = [client.post("/speak", json={"text": "hi", "lang": "en"}).status_code for _ in range(6)]
        assert codes == [200] * 5 + [429]
        assert client.get("/health").status_code == 200

    def test_max_length_text_ok_and_over_rejected(self, make_client):
        client = make_client(tts=self.tts())
        ok = client.post("/speak", json={"text": "a" * TTS_MAX_CHARS, "lang": "en"})
        assert ok.status_code == 200
        over = client.post("/speak", json={"text": "a" * (TTS_MAX_CHARS + 1), "lang": "en"})
        assert over.status_code == 400

    def test_daily_budget_exhausted_503(self, make_client):
        client = make_client(tts=self.tts(budget=10))
        assert client.post("/speak", json={"text": "123456", "lang": "en"}).status_code == 200
        res = client.post("/speak", json={"text": "654321", "lang": "en"})
        assert res.status_code == 503
