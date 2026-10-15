"""Fill backend/tts_cache with the audio for every fixed template summary (th + en).

Uses the backend's own template + TTS code, so cache keys match what /speak looks up.
Reads backend/.env (simple KEY=VALUE lines, values never printed). Existing entries are skipped.

    cd backend && ../ml/.venv/bin/python ../scripts/pregen_tts.py
"""

import asyncio
import json
import os
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND))

from app.config import LANGS, Settings  # noqa: E402
from app.llm import template_result  # noqa: E402
from app.tts import TtsService  # noqa: E402


def load_env(path: Path) -> None:
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, _, value = line.partition("=")
        os.environ.setdefault(name.strip(), value.strip().strip("'\""))


def entries() -> list[tuple[str, str, str]]:
    """(lang, name, summary text) for each served label + unsure + no_cry."""
    labels = json.loads((BACKEND / "models" / "labels.json").read_text(encoding="utf-8"))
    cases = [("confident", label) for label in labels] + [("unsure", None), ("no_cry", None)]
    return [
        (lang, label or case, template_result(case, label, lang).summary)
        for lang in LANGS
        for case, label in cases
    ]


async def main() -> int:
    load_env(BACKEND / ".env")
    tts = TtsService(Settings.from_env())
    rows, errors, total_new = [], 0, 0
    for lang, name, text in entries():
        path = tts.cache_path(text, lang)
        status = "cached"
        if not path.exists():
            try:
                await tts.synthesize(text, lang)
                status = "new"
                total_new += len(text)
            except Exception as exc:  # report and continue with the remaining entries
                status = f"ERROR {type(exc).__name__}"
                errors += 1
        rows.append((lang, name, path.stem[:12], len(text), status))
    print(f"{'lang':<5}{'label':<15}{'key':<14}{'chars':>6}  status")
    for lang, name, key, chars, status in rows:
        print(f"{lang:<5}{name:<15}{key:<14}{chars:>6}  {status}")
    print(f"entries={len(rows)} new_chars={total_new} errors={errors}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
