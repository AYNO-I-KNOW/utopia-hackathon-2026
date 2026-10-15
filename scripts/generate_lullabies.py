"""Generate lullabies with the ElevenLabs Music API -> assets/lullabies/{lang}-{n}.mp3.

Needs ELEVENLABS_API_KEY on a paid plan. Existing files are skipped.

    ELEVENLABS_API_KEY=... python scripts/generate_lullabies.py [--model music_v1]
"""

import argparse
import os
import sys
from pathlib import Path

import httpx

API_URL = "https://api.elevenlabs.io/v1/music"
OUT_DIR = Path(__file__).resolve().parent.parent / "assets" / "lullabies"
MUSIC_LENGTH_MS = 75_000  # API accepts 3000-600000
DEFAULT_MODEL = "music_v1"  # docs also list music_v2 / music_v2_5; override with --model
REQUEST_TIMEOUT_S = 300

PROMPTS = {
    "th": [
        "A gentle Thai-inspired lullaby for a newborn, soft and slow, calm warm tones",
        "A soft music-box lullaby with slow notes, soothing and sleepy, Thai folk feel",
        "A slow humming-style lullaby, soft wordless voice, very calm, for putting a baby to sleep",
    ],
    "en": [
        "A gentle lullaby for a newborn, soft and slow, calm warm tones",
        "A soft music-box lullaby with slow notes, soothing and sleepy",
        "A slow humming-style lullaby, soft wordless voice, very calm, for putting a baby to sleep",
    ],
}


def generate(client: httpx.Client, api_key: str, model: str, prompt: str) -> bytes:
    resp = client.post(
        API_URL,
        headers={"xi-api-key": api_key, "Accept": "audio/mpeg"},
        json={
            "prompt": prompt,
            "music_length_ms": MUSIC_LENGTH_MS,
            "model_id": model,
            "force_instrumental": True,
        },
    )
    resp.raise_for_status()
    return resp.content


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", default=DEFAULT_MODEL, help="music model_id")
    parser.add_argument("--out", type=Path, default=OUT_DIR)
    args = parser.parse_args()

    api_key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if not api_key:
        print("ELEVENLABS_API_KEY is not set (Music API needs a paid plan).", file=sys.stderr)
        return 1

    args.out.mkdir(parents=True, exist_ok=True)
    failures = 0
    with httpx.Client(timeout=REQUEST_TIMEOUT_S) as client:
        for lang, prompts in PROMPTS.items():
            for number, prompt in enumerate(prompts, start=1):
                target = args.out / f"{lang}-{number}.mp3"
                if target.exists():
                    print(f"skip {target.name} (exists)")
                    continue
                try:
                    target.write_bytes(generate(client, api_key, args.model, prompt))
                except httpx.HTTPStatusError as exc:
                    failures += 1
                    print(f"fail {target.name}: HTTP {exc.response.status_code}", file=sys.stderr)
                except httpx.HTTPError as exc:
                    failures += 1
                    print(f"fail {target.name}: {type(exc).__name__}", file=sys.stderr)
                else:
                    print(f"wrote {target.name}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
