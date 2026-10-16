#!/usr/bin/env bash
# Assemble space/ + the backend runtime into a temp dir and upload it to the HF Space.
# Usage: scripts/deploy_space.sh [namespace/name]   (needs `hf auth login`)
set -euo pipefail

SPACE_ID="${1:-PentaQ/cry-for-your-mom-api}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

cp "$ROOT"/space/{README.md,space_app.py,requirements.txt,packages.txt} "$STAGE"/
cp -R "$ROOT"/backend/{app,knowledge,tts_cache} "$STAGE"/
mkdir -p "$STAGE/models"
cp "$ROOT"/backend/models/{cry_net_demo.pt,labels.json,classifier.joblib} "$STAGE/models/"
# ship the PANNs checkpoint so a restart skips the slow zenodo download (Space var PANNS_CHECKPOINT)
cp "$HOME/panns_data/Cnn14_mAP=0.431.pth" "$STAGE/models/"

hf upload "$SPACE_ID" "$STAGE" . --repo-type space \
  --exclude "**/__pycache__/**" --exclude "**/.DS_Store" \
  --commit-message "Deploy backend from $(git -C "$ROOT" rev-parse --short HEAD)"
