"""PANNs CNN14 embedding per clip -> ml/embeddings.npz (X, y, source, path).

    python ml/extract_embeddings.py
"""

import argparse
import sys
from pathlib import Path

import numpy as np

from common import AUDIO_EXTENSIONS, DATA_DIR, EMBEDDINGS_PATH, LABELS_9, REPO_DIR

# Reuse the backend's exact pad/crop + checkpoint fetch so training and serving match.
sys.path.insert(0, str(REPO_DIR / "backend"))
from app.config import SAMPLE_RATE  # noqa: E402
from app.model import DEFAULT_CHECKPOINT, ensure_panns_files, fit_length  # noqa: E402

BATCH_SIZE = 16


def list_clips(data_dir: Path) -> list[tuple[Path, str, str]]:
    clips = []
    for source_dir in sorted(p for p in data_dir.iterdir() if p.is_dir()):
        for label in LABELS_9:
            folder = source_dir / label
            if not folder.is_dir():
                continue
            for path in sorted(folder.iterdir()):
                if path.suffix.lower() in AUDIO_EXTENSIONS:
                    clips.append((path, label, source_dir.name))
    return clips


def load_clip(path: Path) -> np.ndarray | None:
    import librosa

    try:
        wav, _ = librosa.load(path, sr=SAMPLE_RATE, mono=True)
    except Exception as exc:  # librosa/audioread raise many types for bad files
        print(f"skip {path}: {type(exc).__name__}", file=sys.stderr)
        return None
    return fit_length(wav.astype(np.float32))


def embed(clips: list[tuple[Path, str, str]]) -> tuple[np.ndarray, list[tuple[Path, str, str]]]:
    from panns_inference import AudioTagging

    ensure_panns_files(DEFAULT_CHECKPOINT)
    tagger = AudioTagging(checkpoint_path=str(DEFAULT_CHECKPOINT), device="cpu")
    vectors, kept = [], []
    for start in range(0, len(clips), BATCH_SIZE):
        batch = [(c, load_clip(c[0])) for c in clips[start : start + BATCH_SIZE]]
        batch = [(c, wav) for c, wav in batch if wav is not None]
        if not batch:
            continue
        _, embedding = tagger.inference(np.stack([wav for _, wav in batch]))
        vectors.append(embedding)
        kept.extend(c for c, _ in batch)
        print(f"{len(kept)}/{len(clips)}", end="\r", file=sys.stderr)
    return np.concatenate(vectors), kept


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=DATA_DIR)
    parser.add_argument("--out", type=Path, default=EMBEDDINGS_PATH)
    args = parser.parse_args()

    if not args.data.is_dir():
        print(f"{args.data} not found: run ml/download_data.py first", file=sys.stderr)
        return 1
    clips = list_clips(args.data)
    if not clips:
        print(f"no clips under {args.data}/{{source}}/{{label}}/", file=sys.stderr)
        return 1
    X, kept = embed(clips)
    np.savez_compressed(
        args.out,
        X=X.astype(np.float32),
        y=np.array([label for _, label, _ in kept]),
        source=np.array([source for _, _, source in kept]),
        path=np.array([str(p) for p, _, _ in kept]),
    )
    print(f"saved {len(kept)} embeddings {X.shape} -> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
