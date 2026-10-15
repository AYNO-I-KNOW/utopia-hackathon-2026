---
title: Cry for ur MOM API
emoji: 👶
colorFrom: pink
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# Cry for ur MOM — backend

FastAPI service: decode audio → PANNs CNN14 cry detection + embedding classifier →
activity priors / case logic → OpenAI summary (grounded on `knowledge/advice/`) →
ElevenLabs speech. Contract: [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) §3.

| Route | Purpose |
|---|---|
| `POST /analyze` | multipart `audio` + `lang` (`th`/`en`) + optional `context` JSON |
| `POST /speak` | JSON `{text, lang}` → `audio/mpeg` |
| `GET /health` | `{ok, model_loaded}` (wakes the Space) |

## Run locally

Needs Python 3.11 and `ffmpeg` on PATH.

```bash
cd backend
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt          # includes torch + panns-inference
cp .env.example .env                     # then export the vars (see below)
uvicorn app.main:app --reload --port 8000
```

The first request downloads the PANNs checkpoint (~327 MB) to `~/panns_data/`.
`/analyze` returns **503** until `models/classifier.joblib` + `models/labels.json`
exist — train them with `ml/` (see `../ml/README.md`).

## Environment variables

None are required to boot. Missing keys degrade features: no OpenAI key/model (or `USE_LLM` off) →
summary from the advice files; no ElevenLabs key/voice → `/speak` returns 503.

| Name | Meaning |
|---|---|
| `OPENAI_API_KEY` | OpenAI key (secret) |
| `OPENAI_MODEL` | model name that supports Structured Outputs; verify it before demo |
| `ELEVENLABS_API_KEY` | ElevenLabs key (secret) |
| `ELEVENLABS_VOICE_ID_TH` / `ELEVENLABS_VOICE_ID_EN` | voice ids used with `eleven_v3` |
| `ALLOWED_ORIGINS` | comma list, e.g. `https://your-app.vercel.app,http://127.0.0.1:4175`. `https://*.codesandbox.io` is always allowed via regex |
| `PANNS_CHECKPOINT` | optional path to `Cnn14_mAP=0.431.pth` |
| `FINETUNED_MODEL` | optional TorchScript from `ml/finetune_cnn14.py` (e.g. `models/cry_net.pt`); unset = `classifier.joblib` |
| `TTS_DAILY_CHAR_BUDGET` | max characters sent to ElevenLabs per UTC day, in-process (default `50000`); `/speak` returns 503 when used up |
| `USE_LLM` | `1`/`true`/`yes` = `/analyze` summaries come from OpenAI (templates stay as fallback). Default off: fixed text from `knowledge/advice/*.md`, no OpenAI call, same input = same summary |
| `TTS_CACHE_DIR` | disk cache for `/speak` audio (default `backend/tts_cache`, committed). Hit = no ElevenLabs call and no budget spend; see `tts_cache/README.md` |
| `TTS_SPEED` | ElevenLabs speaking speed (default `1.15`; clamped to `0.7`-`1.2`; malformed = default) |
| `TRUSTED_PROXY_HOPS` | number N of trusted reverse proxies in front of the app (int ≥ 1). Unset = rate limits key on the TCP peer and ignore `X-Forwarded-For` |

Limits: `/analyze` 30 req/min per IP, `/speak` 5 req/min per IP, max 2 concurrent analyses (503 `busy, retry`),
`/speak` text ≤ 600 chars, `/analyze` requires `Content-Length` (411 otherwise).

**Rate limits on Hugging Face Spaces:** the app sits behind HF's proxy, so every request looks like it
comes from the proxy's IP until you set `TRUSTED_PROXY_HOPS`. Deploy once, log the
`X-Forwarded-For` header of a test request (e.g. temporarily print `request.headers`), count the entries
the proxy chain adds after your own IP, set `TRUSTED_PROXY_HOPS` to that N, and redeploy.
The app then uses the Nth entry from the right; entries further left are client-controlled and ignored.

## Tests

No torch/panns needed (the model is faked); `ffmpeg` is needed for the audio tests (skipped if absent).

```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest
```

## Deploy (Hugging Face Spaces, Docker SDK)

1. Create a Space with SDK **Docker**, CPU basic.
2. Push the contents of `backend/` as the Space repo root (this README's front-matter configures it).
   Commit `models/classifier.joblib`, `models/labels.json`, `models/metrics.json` — the image copies `models/`.
3. Space → Settings → Secrets: set the variables above.
4. Wait for the build (it downloads the PANNs checkpoint), then `curl https://<space>.hf.space/health`.
   Call `/health` about 5 minutes before the pitch to avoid a cold start.
5. Put the Space URL in the frontend `js/config.js` (`API_BASE_URL`) and add the Vercel domain to `ALLOWED_ORIGINS`.

Advice files in `knowledge/advice/` are DRAFTS: the business team must verify them against a
reputable pediatric source before the demo.
