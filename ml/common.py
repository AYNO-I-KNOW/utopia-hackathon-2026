"""Shared constants for the offline training pipeline."""

from pathlib import Path

ML_DIR = Path(__file__).resolve().parent
REPO_DIR = ML_DIR.parent
DATA_DIR = ML_DIR / "data"
EMBEDDINGS_PATH = ML_DIR / "embeddings.npz"
BACKEND_MODELS_DIR = REPO_DIR / "backend" / "models"

LABELS_6 = ("hungry", "hug", "awake", "uncomfortable", "sleepy", "diaper")
LABELS_9 = LABELS_6 + ("belly_pain", "burping", "cold_hot")
AUDIO_EXTENSIONS = (".wav", ".mp3", ".ogg", ".flac", ".m4a")

# Kaggle Baby Cry Sense folder name -> our label; None = dropped (ARCHITECTURE.md §4)
KAGGLE_LABEL_MAP: dict[str, str | None] = {
    "hungry": "hungry",
    "tired": "sleepy",
    "discomfort": "uncomfortable",
    "belly_pain": "belly_pain",
    "burping": "burping",
    "cold_hot": "cold_hot",
    "scared": None,
    "lonely": None,
}
