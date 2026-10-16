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
ElevenLabs speech, plus a grounded follow-up chat. Contract: [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) §3.

| Route           | Purpose                                                                          |
| --------------- | -------------------------------------------------------------------------------- |
| `POST /analyze` | multipart `audio` + `lang` (`th`/`en`) + optional `context` JSON                 |
| `POST /speak`   | JSON `{text, lang}` → `audio/mpeg`                                               |
| `POST /chat`    | JSON `{lang, result, messages}` → `{reply, source}`; see `../docs/BACKEND.md` §3 |
| `GET /health`   | `{ok, model_loaded}` (wakes the Space)                                           |

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

`/analyze` accepts up to 10 MB and decodes at most 30 s. The model scores the first 10 s window and uses it as is.
Only if that window's `cry_prob` is under `WEAK_CRY_PROB` (0.08) and a later 10 s window (a trailing
window under 1 s is dropped) reaches `CLEAR_CRY_PROB` (0.5), the best later window is used instead
(e.g. a spoken video intro before the crying). Later windows are not run when the first one cries.

## Environment variables

None are required to boot. Missing keys degrade features: no OpenAI key/model (or `USE_LLM` off) →
summary from the advice files; no ElevenLabs key/voice → `/speak` returns 503.

| Name                                                | Meaning                                                                                                                                                                                 |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY`                                    | OpenAI key (secret)                                                                                                                                                                     |
| `OPENAI_MODEL`                                      | model name that supports Structured Outputs; verify it before demo. With key and model set, `/chat` answers from OpenAI (grounded on the advice files); `USE_LLM` only gates `/analyze` |
| `ELEVENLABS_API_KEY`                                | ElevenLabs key (secret)                                                                                                                                                                 |
| `ELEVENLABS_VOICE_ID_TH` / `ELEVENLABS_VOICE_ID_EN` | voice ids used with `eleven_v3`                                                                                                                                                         |
| `ALLOWED_ORIGINS`                                   | comma list, e.g. `https://your-app.vercel.app,http://127.0.0.1:4175`. Exact origins only (wildcards are ignored)                                                                        |
| `PANNS_CHECKPOINT`                                  | optional path to `Cnn14_mAP=0.431.pth`                                                                                                                                                  |
| `FINETUNED_MODEL`                                   | optional TorchScript from `ml/finetune_cnn14.py` (e.g. `models/cry_net.pt`); unset = `classifier.joblib`                                                                                |
| `TTS_DAILY_CHAR_BUDGET`                             | max characters sent to ElevenLabs per UTC day, in-process (default `50000`); `/speak` returns 503 when used up                                                                          |
| `CHAT_DAILY_LLM_CALLS`                              | max OpenAI calls for `/chat` per UTC day, in-process (default `300`); once used up `/chat` replies from the fixed templates (`source: "template"`), not an error                        |
| `USE_LLM`                                           | `1`/`true`/`yes` = `/analyze` summaries come from OpenAI (templates stay as fallback). Default off: fixed text from `knowledge/advice/*.md`, no OpenAI call, same input = same summary  |
| `TTS_CACHE_DIR`                                     | disk cache for `/speak` audio (default `backend/tts_cache`, committed). Hit = no ElevenLabs call and no budget spend; see `tts_cache/README.md`                                         |
| `TTS_SPEED`                                         | ElevenLabs speaking speed (default `1.15`; clamped to `0.7`-`1.2`; malformed = default)                                                                                                 |
| `TRUSTED_PROXY_HOPS`                                | number N of trusted reverse proxies in front of the app (int ≥ 1). Unset = rate limits key on the TCP peer and ignore `X-Forwarded-For`                                                 |

Limits: `/analyze` 30 req/min per IP, `/speak` 5 req/min per IP, `/chat` 10 req/min per IP (1–8 messages, ≤ 1000 chars each, ≤ 4000 in total, body ≤ 64 KB, reply ≤ 600 chars, `max_output_tokens` 300; `Content-Length` required), max 2 concurrent analyses (503 `busy, retry`),
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

## Deploy

Live: backend on the free ZeroGPU Space `PentaQ/cry-for-your-mom-api`
(`https://pentaq-cry-for-your-mom-api.hf.space/v1`), frontend on Vercel (`https://cry-for-your-mom.vercel.app`).

**Backend (HF Space, Gradio SDK + ZeroGPU).** Free accounts cannot run Docker or `cpu-basic` Spaces, so
`space/space_app.py` mounts this FastAPI app on `gr.Server` under `/v1`; inference stays on CPU.

1. `hf auth login`, then `scripts/deploy_space.sh` (use `HF_HUB_DISABLE_XET=1` if the upload stalls).
   It uploads `app/`, `knowledge/`, `tts_cache/`, the models and the PANNs checkpoint (restart ≈ 1 min).
2. Space secrets: `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID_TH`, `ELEVENLABS_VOICE_ID_EN` (+ `OPENAI_*` if used).
   Variables: `FINETUNED_MODEL=models/cry_net_demo.pt`, `PANNS_CHECKPOINT=models/Cnn14_mAP=0.431.pth`,
   `GRADIO_SSR_MODE=false`, `ALLOWED_ORIGINS=<Vercel domains>`.
3. Check `curl https://pentaq-cry-for-your-mom-api.hf.space/v1/health` → `"model_loaded":true`.

`Dockerfile` still works for a paid Docker Space or any container host (routes at the root, no `/v1`).

**Frontend (Vercel, team `ayno1`).** The project is not linked to GitHub: deploy with
`vercel deploy --prod --scope ayno1`. `NEXT_PUBLIC_API_BASE_URL` is a project env var (Production + Preview);
change it there and redeploy when the backend URL changes.

Advice files in `knowledge/advice/` are DRAFTS: the business team must verify them against a
reputable pediatric source before the demo.
