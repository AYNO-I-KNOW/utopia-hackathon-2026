import asyncio
from pathlib import Path

import pytest

from app import config as C
from app import llm as llm_mod
from app.llm import LlmService, LlmSummary, fallback_result, load_advice, parse_advice
from tests.conftest import make_settings

TOP = [("hungry", 0.7), ("sleepy", 0.2)]


class StubClient:
    def __init__(self, parsed=None, delay=0.0):
        self.parsed, self.delay, self.kwargs = parsed, delay, None
        self.responses = self

    async def parse(self, **kwargs):
        self.kwargs = kwargs
        await asyncio.sleep(self.delay)
        return type("R", (), {"output_parsed": self.parsed})()


def service(client, key="k", model="m"):
    return LlmService(make_settings(openai_api_key=key, openai_model=model), client=client)


def run(coro):
    return asyncio.run(coro)


def test_every_label_has_both_languages_with_draft_header_and_sections():
    for label in C.LABELS_9:
        for lang, tries, doctor in (("th", "## ลองทำ", "## พบแพทย์เมื่อ"), ("en", "## Try", "## See a doctor if")):
            text = load_advice(label, lang)
            assert text is not None, (label, lang)
            assert text.splitlines()[0].startswith("<!-- DRAFT: business team must verify")
            assert tries in text and doctor in text
            summary, bullets = parse_advice(text)
            assert summary and len(bullets) == 3


def test_load_advice_rejects_unknown_label_and_traversal():
    assert load_advice("../../etc/passwd", "en") is None
    assert load_advice("hungry", "fr") is None


def test_parse_advice_first_paragraph_and_three_bullets(tmp_path: Path):
    text = "<!-- c -->\n# T\n\nLine one\nline two.\n\nSecond para.\n\n## Try\n- a\n- b\n- c\n- d\n"
    assert parse_advice(text) == ("Line one line two.", ["a", "b", "c"])


def test_fallback_uses_advice_and_never_sees_doctor():
    res = fallback_result("hungry", "en")
    assert res.summary.startswith("Your baby may be hungry")
    assert len(res.checklist) == 3 and res.see_doctor is False


def test_fallback_generic_when_advice_missing(tmp_path: Path):
    res = fallback_result("hungry", "th", advice_dir=tmp_path)
    assert res.summary == llm_mod.GENERIC["th"][0]
    assert len(res.checklist) == 3


def test_no_key_or_model_skips_client():
    client = StubClient(LlmSummary(summary="x", checklist=["1"], see_doctor=False))
    for svc in (service(client, key=""), service(client, model="")):
        res = run(svc.summarise("confident", TOP, {}, "en"))
        assert res.summary.startswith("Your baby may be hungry")
    assert client.kwargs is None


def test_success_uses_llm_output_and_structured_schema():
    parsed = LlmSummary(summary=" Try feeding. ", checklist=["a", "b", "c", "d"], see_doctor=True)
    client = StubClient(parsed)
    res = run(service(client).summarise("close", TOP, {"last_feed_min": 100}, "en"))
    assert (res.summary, res.checklist, res.see_doctor) == ("Try feeding.", ("a", "b", "c"), True)
    assert client.kwargs["text_format"] is LlmSummary
    assert client.kwargs["model"] == "m" and client.kwargs["store"] is False
    assert "hungry" in client.kwargs["input"] and "sleepy" in client.kwargs["input"]
    assert "Try" in client.kwargs["input"]  # advice documents are in the prompt


def test_short_checklist_is_padded_to_three():
    parsed = LlmSummary(summary="ok", checklist=["only one"], see_doctor=False)
    res = run(service(StubClient(parsed)).summarise("confident", TOP, {}, "en"))
    assert len(res.checklist) == 3 and res.checklist[0] == "only one"


def test_empty_or_missing_parse_falls_back():
    for parsed in (None, LlmSummary(summary="  ", checklist=[], see_doctor=True)):
        res = run(service(StubClient(parsed)).summarise("confident", TOP, {}, "en"))
        assert res.summary.startswith("Your baby may be hungry") and res.see_doctor is False


def test_timeout_falls_back(monkeypatch):
    monkeypatch.setattr(llm_mod, "LLM_TIMEOUT_S", 0.05)
    client = StubClient(LlmSummary(summary="late", checklist=[], see_doctor=False), delay=1.0)
    res = run(service(client).summarise("confident", TOP, {}, "en"))
    assert res.summary.startswith("Your baby may be hungry")


def test_malformed_output_error_falls_back():
    class Bad:
        responses = None

        async def parse(self, **_):
            raise ValueError("bad json")

    bad = Bad()
    bad.responses = bad
    res = run(service(bad).summarise("confident", TOP, {}, "en"))
    assert res.summary.startswith("Your baby may be hungry")


def test_llm_output_is_length_capped():
    parsed = LlmSummary(
        summary="s" * (C.TTS_MAX_CHARS + 50),
        checklist=["x" * 500, "y" * 121, "z"],
        see_doctor=False,
    )
    res = run(service(StubClient(parsed)).summarise("confident", TOP, {}, "en"))
    assert len(res.summary) == C.TTS_MAX_CHARS
    assert [len(c) for c in res.checklist] == [120, 120, 1]
