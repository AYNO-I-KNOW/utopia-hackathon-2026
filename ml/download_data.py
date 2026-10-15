"""Download the two datasets into ml/data/{source}/{label}/*.wav (ARCHITECTURE.md §4).

    python ml/download_data.py --source all
"""

import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

from common import AUDIO_EXTENSIONS, DATA_DIR, KAGGLE_LABEL_MAP, LABELS_6

HF_REPO = "p-j-r-1-2-3/Baby-Cry-Classification-Baidu"
HF_ZIP = "Baby Cry Classification.zip"
KAGGLE_DATASET = "mennaahmed23/baby-cry-sense-dataset"

KAGGLE_HELP = """Kaggle credentials not found. Either:
  1. Create an API token at https://www.kaggle.com/settings and save it as ~/.kaggle/kaggle.json
     (chmod 600), or
  2. export KAGGLE_USERNAME=... KAGGLE_KEY=...
Then `pip install kaggle` and re-run: python ml/download_data.py --source kaggle
Or download the dataset zip manually, unzip it, and place clips in ml/data/kaggle/{label}/."""


def unique_path(folder: Path, name: str) -> Path:
    """Never overwrite: the same basename can appear in several source sub-folders."""
    target = folder / name
    counter = 1
    while target.exists():
        target = folder / f"{Path(name).stem}_{counter}{Path(name).suffix}"
        counter += 1
    return target


def download_baidu(out_root: Path) -> int:
    from huggingface_hub import hf_hub_download

    zip_path = hf_hub_download(repo_id=HF_REPO, filename=HF_ZIP, repo_type="dataset")
    count = 0
    with zipfile.ZipFile(zip_path) as zf:
        for info in zf.infolist():
            parts = info.filename.split("/")
            # layout: train/{label}/{name}.wav ; test/ has no labels, so it is skipped
            if len(parts) != 3 or parts[0] != "train" or parts[1] not in LABELS_6:
                continue
            if not parts[2].lower().endswith(AUDIO_EXTENSIONS):
                continue
            folder = out_root / "baidu" / parts[1]
            folder.mkdir(parents=True, exist_ok=True)
            with zf.open(info) as src, unique_path(folder, Path(parts[2]).name).open("wb") as dst:
                shutil.copyfileobj(src, dst)
            count += 1
    return count


def has_kaggle_credentials() -> bool:
    if os.environ.get("KAGGLE_USERNAME") and os.environ.get("KAGGLE_KEY"):
        return True
    if os.environ.get("KAGGLE_API_TOKEN"):
        return True
    kaggle_dir = Path.home() / ".kaggle"
    return (kaggle_dir / "kaggle.json").is_file() or (kaggle_dir / "access_token").is_file()


def normalise_folder(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def find_label(path: Path, root: Path) -> str | None:
    for part in reversed(path.relative_to(root).parts[:-1]):
        key = normalise_folder(part)
        if key in KAGGLE_LABEL_MAP:
            return KAGGLE_LABEL_MAP[key]
    return None


def download_kaggle(out_root: Path) -> int:
    if shutil.which("kaggle") is None or not has_kaggle_credentials():
        print(KAGGLE_HELP, file=sys.stderr)
        return 0
    count = 0
    with tempfile.TemporaryDirectory() as tmp:
        cmd = ["kaggle", "datasets", "download", "-d", KAGGLE_DATASET, "-p", tmp, "--unzip"]
        subprocess.run(cmd, check=True)
        root = Path(tmp)
        for path in sorted(root.rglob("*")):
            if not path.is_file() or path.suffix.lower() not in AUDIO_EXTENSIONS:
                continue
            label = find_label(path, root)
            if label is None:  # dropped (scared/lonely) or unrecognised folder
                continue
            folder = out_root / "kaggle" / label
            folder.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, unique_path(folder, path.name))
            count += 1
    return count


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", choices=["baidu", "kaggle", "all"], default="all")
    parser.add_argument("--out", type=Path, default=DATA_DIR)
    args = parser.parse_args()

    if args.source in ("baidu", "all"):
        print(f"baidu: {download_baidu(args.out)} clips")
    if args.source in ("kaggle", "all"):
        print(f"kaggle: {download_kaggle(args.out)} clips")
    return 0


if __name__ == "__main__":
    sys.exit(main())
