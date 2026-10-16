---
title: Cry for your Mom API
emoji: 👶
colorFrom: purple
colorTo: pink
sdk: gradio
sdk_version: 6.30.0
app_file: space_app.py
python_version: "3.12"
short_description: Baby cry analysis API for Cry for your Mom
startup_duration_timeout: 30m
pinned: false
---

# Cry for your Mom — API (ZeroGPU)

The FastAPI backend from `backend/` served on a free ZeroGPU Space. Inference runs on CPU;
the GPU-decorated function only exists because ZeroGPU refuses to boot without one.

Routes: `GET /health`, `POST /analyze`, `POST /speak`, `POST /chat` (see `docs/ARCHITECTURE.md`).
Assembled and uploaded by `scripts/deploy_space.sh`.
