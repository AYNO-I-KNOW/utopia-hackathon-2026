# TTS cache

Pre-generated ElevenLabs audio, committed so the deployed backend (and offline demos) never call the API for the fixed advice templates.

- File: `<key>.mp3`
- Key: `sha256("<model_id>|<voice_id>|<speed>|<text>")` as hex, where `speed` is formatted with Python's `{:g}` (`1.15`), and `text` is the exact string sent to ElevenLabs (capped at 600 chars).
- Changing the voice id, `TTS_SPEED`, model or any text character produces a different key, i.e. a cache miss.
- Dir is overridable with `TTS_CACHE_DIR`. A hit skips ElevenLabs and does not spend the daily character budget; a miss calls the API and writes the file atomically (tmp + rename).
- Regenerate: `cd backend && ../ml/.venv/bin/python ../scripts/pregen_tts.py` (needs `backend/.env`; existing entries are skipped).
