import pytest
from starlette.requests import Request

from app.config import Settings
from app.ratelimit import client_ip


def request(forwarded: str | None, peer: str = "10.0.0.9") -> Request:
    headers = [(b"x-forwarded-for", forwarded.encode())] if forwarded else []
    return Request({"type": "http", "headers": headers, "client": (peer, 1234)})


def test_forwarded_header_ignored_by_default():
    assert client_ip(request("1.1.1.1, 2.2.2.2")) == "10.0.0.9"


@pytest.mark.parametrize(
    ("hops", "expected"), [(1, "3.3.3.3"), (2, "2.2.2.2"), (3, "1.1.1.1")]
)
def test_nth_from_right_when_hops_set(hops, expected):
    assert client_ip(request("1.1.1.1, 2.2.2.2, 3.3.3.3"), hops) == expected


def test_spoofed_left_entries_never_win():
    assert client_ip(request("6.6.6.6, 1.1.1.1"), 1) == "1.1.1.1"


def test_fewer_entries_than_hops_falls_back_to_peer():
    assert client_ip(request("1.1.1.1"), 2) == "10.0.0.9"
    assert client_ip(request(None), 1) == "10.0.0.9"


@pytest.mark.parametrize(
    ("raw", "expected"), [(None, 0), ("", 0), ("abc", 0), ("0", 0), ("-1", 0), ("1", 1), ("2", 2)]
)
def test_trusted_proxy_hops_env(monkeypatch, raw, expected):
    monkeypatch.delenv("TRUSTED_PROXY_HOPS", raising=False)
    if raw is not None:
        monkeypatch.setenv("TRUSTED_PROXY_HOPS", raw)
    assert Settings.from_env().trusted_proxy_hops == expected


@pytest.mark.parametrize(
    ("raw", "expected"), [(None, 50_000), ("abc", 50_000), ("-5", 50_000), ("0", 0), ("1200", 1200)]
)
def test_daily_budget_env(monkeypatch, raw, expected):
    monkeypatch.delenv("TTS_DAILY_CHAR_BUDGET", raising=False)
    if raw is not None:
        monkeypatch.setenv("TTS_DAILY_CHAR_BUDGET", raw)
    assert Settings.from_env().tts_daily_char_budget == expected
