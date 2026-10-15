"""LLM summary grounded only on knowledge/advice/*.md, with a deterministic fallback."""

import asyncio
import json
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

from openai import AsyncOpenAI, OpenAIError
from pydantic import BaseModel

from app.config import ADVICE_DIR, LABELS_9, LANGS, LLM_TIMEOUT_S, TTS_MAX_CHARS, Settings

logger = logging.getLogger(__name__)

CHECKLIST_LEN = 3
CHECKLIST_ITEM_MAX_CHARS = 120
LANG_NAMES = {"th": "Thai", "en": "English"}

SYSTEM_PROMPT = (
    "You help new parents understand why their baby may be crying. "
    "Use ONLY the advice documents provided. Never diagnose illness, never mention medicines "
    "or doses, never add medical claims that are not in the documents. "
    "Write in {language}. "
    "`summary`: at most 3 short sentences to be read aloud; plain text, no markdown, no emojis. "
    "If case is 'close' or 'unsure', say the cause is uncertain and name the two most likely "
    "possibilities. "
    "`checklist`: exactly 3 short, concrete steps taken from the 'Try' parts of the documents. "
    "`see_doctor`: true only if the input clearly matches a red flag listed in the documents "
    "(the input only has cry-type scores and timing, so usually false)."
)

GENERIC = {
    "th": (
        "ยังบอกสาเหตุไม่ได้ชัดเจน ลองเช็กความต้องการพื้นฐานของน้องทีละอย่างนะคะ",
        ("เช็กเวลาให้นมครั้งล่าสุด", "เช็กผ้าอ้อมและอุณหภูมิตัว", "อุ้มปลอบและลดแสงเสียงรอบตัว"),
    ),
    "en": (
        "The cause is not clear yet. Try checking your baby's basic needs one at a time.",
        ("Check the time of the last feed", "Check the diaper and body temperature",
         "Hold and soothe, and lower light and noise"),
    ),
}  # fmt: skip

NO_CRY = {
    "th": (
        "ไม่ได้ยินเสียงร้องของน้องชัดเจน ลองอัดใหม่ให้ใกล้ตัวน้องมากขึ้นนะคะ",
        ("อัดเสียงใกล้ตัวน้องมากขึ้น", "ลดเสียงรบกวนรอบข้าง", "ลองอัดซ้ำตอนน้องกำลังร้อง"),
    ),
    "en": (
        "No clear baby cry was detected. Try recording again closer to your baby.",
        ("Record closer to your baby", "Reduce background noise", "Try again while baby is crying"),
    ),
}  # fmt: skip


@dataclass(frozen=True)
class SummaryResult:
    summary: str
    checklist: tuple[str, ...]
    see_doctor: bool


class LlmSummary(BaseModel):
    """Structured-output schema sent to OpenAI (Responses API, `text_format`)."""

    summary: str
    checklist: list[str]
    see_doctor: bool


class Summariser(Protocol):
    async def summarise(
        self, case: str, top: list[tuple[str, float]], context: dict[str, Any], lang: str
    ) -> SummaryResult: ...


def no_cry_result(lang: str) -> SummaryResult:
    summary, checklist = NO_CRY[lang]
    return SummaryResult(summary, checklist, False)


def load_advice(label: str, lang: str, advice_dir: Path = ADVICE_DIR) -> str | None:
    if label not in LABELS_9 or lang not in LANGS:  # also blocks path traversal
        return None
    path = advice_dir / f"{label}.{lang}.md"
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        logger.warning("advice file missing: %s", path.name)
        return None


def parse_advice(text: str) -> tuple[str, list[str]]:
    """First paragraph and first CHECKLIST_LEN bullets, ignoring comments and headings."""
    paragraph: list[str] = []
    bullets: list[str] = []
    paragraph_done = False
    for raw in re.sub(r"<!--.*?-->", "", text, flags=re.S).splitlines():
        line = raw.strip()
        if line.startswith(("- ", "* ")):
            bullets.append(line[2:].strip())
            paragraph_done = True
        elif not line or line.startswith("#"):
            paragraph_done = paragraph_done or bool(paragraph)
        elif not paragraph_done:
            paragraph.append(line)
    return " ".join(paragraph), bullets[:CHECKLIST_LEN]


def fallback_result(label: str | None, lang: str, advice_dir: Path = ADVICE_DIR) -> SummaryResult:
    advice = load_advice(label, lang, advice_dir) if label else None
    summary, bullets = parse_advice(advice) if advice else ("", [])
    g_summary, g_checklist = GENERIC[lang]
    checklist = (bullets + list(g_checklist))[:CHECKLIST_LEN]
    return SummaryResult((summary or g_summary)[:TTS_MAX_CHARS], tuple(checklist), False)


class LlmService:
    def __init__(
        self, settings: Settings, advice_dir: Path = ADVICE_DIR, client: Any | None = None
    ) -> None:
        self._settings = settings
        self._advice_dir = advice_dir
        self._client = client

    @property
    def enabled(self) -> bool:
        return bool(self._settings.openai_api_key and self._settings.openai_model)

    def _get_client(self) -> Any:
        if self._client is None:
            self._client = AsyncOpenAI(
                api_key=self._settings.openai_api_key, timeout=LLM_TIMEOUT_S, max_retries=0
            )
        return self._client

    async def summarise(
        self, case: str, top: list[tuple[str, float]], context: dict[str, Any], lang: str
    ) -> SummaryResult:
        top1 = top[0][0] if top else None
        fallback = fallback_result(top1, lang, self._advice_dir)
        if not self.enabled or top1 is None:
            return fallback
        try:
            parsed = await asyncio.wait_for(
                self._call(case, top, context, lang), timeout=LLM_TIMEOUT_S
            )
        except (OpenAIError, TimeoutError, ValueError) as exc:
            logger.warning("LLM summary failed, using fallback: %s", type(exc).__name__)
            return fallback
        return _normalise(parsed, fallback)

    async def _call(
        self, case: str, top: list[tuple[str, float]], context: dict[str, Any], lang: str
    ) -> LlmSummary | None:
        payload = {
            "case": case,
            "top": [{"label": label, "percent": round(p * 100)} for label, p in top[:2]],
            "context_minutes_ago": context,
            "language": lang,
        }
        docs = "\n\n".join(
            f"## Advice document: {label}\n{load_advice(label, lang, self._advice_dir) or ''}"
            for label, _ in top[:2]
        )
        response = await self._get_client().responses.parse(
            model=self._settings.openai_model,
            instructions=SYSTEM_PROMPT.format(language=LANG_NAMES[lang]),
            input=f"{json.dumps(payload, ensure_ascii=False)}\n\n{docs}",
            text_format=LlmSummary,
            store=False,
        )
        return response.output_parsed


def _normalise(parsed: LlmSummary | None, fallback: SummaryResult) -> SummaryResult:
    if parsed is None or not parsed.summary.strip():
        return fallback
    steps = [s.strip()[:CHECKLIST_ITEM_MAX_CHARS] for s in parsed.checklist if s.strip()]
    checklist = (steps + list(fallback.checklist))[:CHECKLIST_LEN]
    summary = parsed.summary.strip()[:TTS_MAX_CHARS]
    return SummaryResult(summary, tuple(checklist), parsed.see_doctor)
