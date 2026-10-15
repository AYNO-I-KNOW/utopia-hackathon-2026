import asyncio
import re

import pytest

from app import config as C
from app.llm import LlmService, LlmSummary, load_advice, no_cry_result, template_result
from tests.conftest import make_settings

TOP = [("hungry", 0.7), ("sleepy", 0.2)]
SERVED = ("hungry", "hug", "awake", "uncomfortable", "sleepy", "diaper")


class ExplodingClient:
    """Any attribute access means the LLM was called."""

    def __getattr__(self, name):
        raise AssertionError("LLM client must not be used in template mode")


def run(coro):
    return asyncio.run(coro)


def service(**overrides):
    base = dict(openai_api_key="k", openai_model="m")
    return LlmService(make_settings(**{**base, **overrides}), client=ExplodingClient())


def test_use_llm_env_parsing(monkeypatch):
    for raw, expected in (("", False), ("0", False), ("no", False), ("1", True), ("TRUE", True), ("yes", True)):
        monkeypatch.setenv("USE_LLM", raw)
        assert C.Settings.from_env().use_llm is expected
    monkeypatch.delenv("USE_LLM")
    assert C.Settings.from_env().use_llm is False


@pytest.mark.parametrize("lang", C.LANGS)
@pytest.mark.parametrize("label", SERVED)
def test_template_is_deterministic_and_short(label, lang):
    first = template_result("confident", label, lang)
    assert template_result("confident", label, lang) == first
    assert template_result("close", label, lang).summary == first.summary
    assert 0 < len(first.summary) <= C.TTS_MAX_CHARS
    assert len(re.findall(r"[.!?](?:\s|$)", first.summary)) <= 3
    assert len(first.checklist) == 3 and first.see_doctor is False


@pytest.mark.parametrize("lang", C.LANGS)
def test_unsure_template_ignores_label_and_has_generic_checks(lang):
    res = template_result("unsure", "hungry", lang)
    assert res == template_result("unsure", "diaper", lang)
    text = load_advice(C.UNSURE_TEMPLATE, lang)
    assert text is not None and res.summary in text
    assert len(res.checklist) == 3
    assert res.summary != template_result("confident", "hungry", lang).summary


@pytest.mark.parametrize("lang", C.LANGS)
def test_no_cry_template_unchanged(lang):
    assert template_result("no_cry", None, lang) == no_cry_result(lang)


def test_unsure_advice_is_whitelisted_only():
    assert load_advice("_unsure", "en") is not None
    assert load_advice("../advice/_unsure", "en") is None
    assert load_advice("_unsure", "../en") is None


@pytest.mark.parametrize("case", ["confident", "close", "unsure"])
def test_use_llm_false_never_calls_client(case):
    res = run(service(use_llm=False).summarise(case, TOP, {}, "en"))
    assert res == template_result(case, "hungry", "en")


def test_use_llm_true_with_error_falls_back_to_template():
    class Bad:
        responses = None

        async def parse(self, **_):
            raise ValueError("bad")

    bad = Bad()
    bad.responses = bad
    svc = LlmService(make_settings(openai_api_key="k", openai_model="m", use_llm=True), client=bad)
    assert run(svc.summarise("unsure", TOP, {}, "th")) == template_result("unsure", "hungry", "th")


def test_use_llm_true_uses_llm():
    class Ok:
        responses = None

        async def parse(self, **_):
            return type("R", (), {"output_parsed": LlmSummary(summary="LLM", checklist=[], see_doctor=False)})()

    ok = Ok()
    ok.responses = ok
    svc = LlmService(make_settings(openai_api_key="k", openai_model="m", use_llm=True), client=ok)
    assert run(svc.summarise("confident", TOP, {}, "en")).summary == "LLM"
