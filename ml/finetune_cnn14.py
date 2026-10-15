"""Fine-tune PANNs CNN14 end to end on the Baidu 6-class set (InfantCryNet, arXiv 2409.19689).

Log-mel CNN14 trunk (AudioSet weights) -> statistics pooling (mean || std over time) -> linear head.
Adam, class-weighted CE, time shift + waveform mixup + SpecAugment, early stopping on val macro-F1,
temperature scaling on val. Test split = ml/train.py's (stratified 80/20, seed 42, same clip order).
Exports TorchScript `cry_net.pt` (probabilities out, labels inside) for the backend.

Self-contained on purpose: Colab only needs this one file.

Colab (T4 GPU):
  1. Runtime > Change runtime type > T4 GPU. Upload this file in the Files pane.
  2. In a cell (torch pinned to backend/requirements.txt so the TorchScript file loads there):
       !pip -q install torch==2.14.1 panns-inference==0.1.1 torchlibrosa==0.1.0 librosa==0.11.0 \
            huggingface_hub scikit-learn
       !python finetune_cnn14.py --out /content/out
     It downloads the Baidu zip from Hugging Face (~690 MB) and the CNN14 checkpoint (~327 MB).
  3. Download /content/out/cry_net.pt (~300 MB) and finetune_metrics.json. Put cry_net.pt in
     backend/models/ and start the backend with FINETUNED_MODEL=models/cry_net.pt.
  Expected runtime (estimate, not measured on T4): ~5 min download + decode, then ~20-40 s per
  epoch with AMP; early stopping usually ends well before --epochs 40, so ~15-30 min total.

Local CPU smoke test only (one batch, no real training):
    ml/.venv/bin/python ml/finetune_cnn14.py --data ml/data/baidu --out /tmp/ft --smoke
"""

import argparse
import copy
import hashlib
import json
import shutil
import sys
import time
import urllib.request
import zipfile
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split
from torch import nn

# --- mirrors of repo constants (ml/common.py, ml/train.py, backend/app/config.py, backend/app/model.py)
LABELS = ("hungry", "hug", "awake", "uncomfortable", "sleepy", "diaper")
AUDIO_EXTENSIONS = (".wav", ".mp3", ".ogg", ".flac", ".m4a")
SEED, TEST_SIZE, HUNGRY_CAP = 42, 0.2, 160
SAMPLE_RATE, CLIP_SAMPLES = 32_000, 10 * 32_000
UNSURE_MAX, CLOSE_MARGIN = 0.40, 0.15
HF_REPO, HF_ZIP = "p-j-r-1-2-3/Baby-Cry-Classification-Baidu", "Baby Cry Classification.zip"
PANNS_DIR = Path.home() / "panns_data"
CHECKPOINT = PANNS_DIR / "Cnn14_mAP=0.431.pth"
CHECKPOINT_URL = "https://zenodo.org/record/3987831/files/Cnn14_mAP%3D0.431.pth?download=1"
CHECKPOINT_SHA256 = "0dc499e40e9761ef5ea061ffc77697697f277f6a960894903df3ada000e34b31"
LABELS_CSV_URL = "https://storage.googleapis.com/us_audioset/youtube_corpus/v1/csv/class_labels_indices.csv"

VAL_SIZE = 0.15  # of the train split, for early stopping + temperature
EMBED_DIM = 2048
ECE_BINS = 10
DOWNLOAD_RETRIES = 8


# ---------------------------------------------------------------- data


def unique_path(folder: Path, name: str) -> Path:
    target, counter = folder / name, 1
    while target.exists():
        target = folder / f"{Path(name).stem}_{counter}{Path(name).suffix}"
        counter += 1
    return target


def download_baidu(data_dir: Path) -> None:
    """Same extraction as ml/download_data.py, so clip names (and the split) match."""
    from huggingface_hub import hf_hub_download

    zip_path = hf_hub_download(repo_id=HF_REPO, filename=HF_ZIP, repo_type="dataset")
    with zipfile.ZipFile(zip_path) as zf:
        for info in zf.infolist():
            parts = info.filename.split("/")
            if len(parts) != 3 or parts[0] != "train" or parts[1] not in LABELS:
                continue
            if not parts[2].lower().endswith(AUDIO_EXTENSIONS):
                continue
            folder = data_dir / parts[1]
            folder.mkdir(parents=True, exist_ok=True)
            with zf.open(info) as src, unique_path(folder, Path(parts[2]).name).open("wb") as dst:
                shutil.copyfileobj(src, dst)


def list_clips(data_dir: Path) -> tuple[list[Path], np.ndarray]:
    """Clip order and hungry cap identical to extract_embeddings.list_clips + train.select."""
    paths, labels = [], []
    for label in LABELS:
        folder = data_dir / label
        for path in sorted(folder.iterdir()) if folder.is_dir() else []:
            if path.suffix.lower() in AUDIO_EXTENSIONS:
                paths.append(path)
                labels.append(label)
    y = np.array(labels)
    hungry = np.flatnonzero(y == "hungry")
    if hungry.size > HUNGRY_CAP:
        drop = set(np.random.default_rng(SEED).choice(hungry, hungry.size - HUNGRY_CAP, replace=False))
        keep = [i for i in range(y.size) if i not in drop]
        paths, y = [paths[i] for i in keep], y[keep]
    return paths, y


def split(y: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    idx = np.arange(y.size)
    train_idx, test_idx = train_test_split(idx, test_size=TEST_SIZE, stratify=y, random_state=SEED)
    fit_idx, val_idx = train_test_split(
        train_idx, test_size=VAL_SIZE, stratify=y[train_idx], random_state=SEED
    )
    return fit_idx, val_idx, test_idx


def load_waveforms(paths: list[Path]) -> torch.Tensor:
    """32 kHz mono, zero-padded/cropped to 10 s (backend fit_length)."""
    import librosa

    out = torch.zeros(len(paths), CLIP_SAMPLES)
    for i, path in enumerate(paths):
        wav, _ = librosa.load(path, sr=SAMPLE_RATE, mono=True)
        wav = wav[:CLIP_SAMPLES]
        out[i, : wav.size] = torch.from_numpy(wav)
    return out


# ---------------------------------------------------------------- weights


def download(url: str, dest: Path) -> None:
    """Resumable: Zenodo often drops the connection near the end of the 327 MB file."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_suffix(dest.suffix + ".part")
    for attempt in range(DOWNLOAD_RETRIES):
        start = part.stat().st_size if part.exists() else 0
        req = urllib.request.Request(url, headers={"Range": f"bytes={start}-"} if start else {})
        try:
            with urllib.request.urlopen(req, timeout=60) as resp, part.open("ab" if start else "wb") as out:
                if start and resp.status != 206:  # server ignored Range: restart
                    out.truncate(0)
                shutil.copyfileobj(resp, out, 1 << 20)
            part.replace(dest)
            return
        except OSError as exc:
            print(f"download retry {attempt + 1}: {exc}", file=sys.stderr)
            time.sleep(3)
    raise RuntimeError(f"download failed: {url}")


def ensure_checkpoint() -> None:
    labels_csv = PANNS_DIR / "class_labels_indices.csv"
    if not labels_csv.is_file():  # panns_inference reads it at import time
        download(LABELS_CSV_URL, labels_csv)
    if not CHECKPOINT.is_file():
        download(CHECKPOINT_URL, CHECKPOINT)
    digest = hashlib.sha256()
    with CHECKPOINT.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            digest.update(chunk)
    if digest.hexdigest() != CHECKPOINT_SHA256:
        CHECKPOINT.unlink()
        raise RuntimeError("CNN14 checkpoint sha256 mismatch (deleted; re-run)")


# ---------------------------------------------------------------- model


class CryNet(nn.Module):
    """CNN14 trunk + statistics pooling head. `logmel` is kept fp32 (power_to_db amin=1e-10
    underflows in fp16); `classify` is safe under autocast."""

    def __init__(self, n_classes: int) -> None:
        super().__init__()
        from panns_inference.models import Cnn14

        trunk = Cnn14(sample_rate=SAMPLE_RATE, window_size=1024, hop_size=320, mel_bins=64,
                      fmin=50, fmax=14000, classes_num=527)  # fmt: skip
        trunk.load_state_dict(torch.load(CHECKPOINT, map_location="cpu", weights_only=True)["model"])
        trunk.fc1, trunk.fc_audioset = nn.Identity(), nn.Identity()  # AudioSet head unused
        self.trunk = trunk
        self.head = nn.Sequential(nn.Dropout(0.5), nn.Linear(2 * EMBED_DIM, n_classes))

    def logmel(self, wav: torch.Tensor) -> torch.Tensor:
        return self.trunk.logmel_extractor(self.trunk.spectrogram_extractor(wav.float()))

    def classify(self, x: torch.Tensor) -> torch.Tensor:
        t = self.trunk
        x = t.bn0(x.transpose(1, 3)).transpose(1, 3)
        if self.training:
            x = t.spec_augmenter(x)
        for block in (t.conv_block1, t.conv_block2, t.conv_block3, t.conv_block4, t.conv_block5):
            x = F.dropout(block(x, pool_size=(2, 2), pool_type="avg"), p=0.2, training=self.training)
        x = F.dropout(t.conv_block6(x, pool_size=(1, 1), pool_type="avg"), p=0.2, training=self.training)
        x = x.mean(dim=3)  # (B, 2048, T): average over mel bins
        stats = torch.cat([x.mean(dim=2), x.std(dim=2)], dim=1)  # statistics pooling
        return self.head(stats)

    def forward(self, wav: torch.Tensor) -> torch.Tensor:
        return self.classify(self.logmel(wav))


class Exported(nn.Module):
    """What the backend loads: (1, 320000) float32 waveform -> calibrated probabilities."""

    def __init__(self, net: CryNet, temperature: float) -> None:
        super().__init__()
        self.net = net
        self.register_buffer("temperature", torch.tensor(float(temperature)))

    def forward(self, wav: torch.Tensor) -> torch.Tensor:
        return torch.softmax(self.net(wav) / self.temperature, dim=-1)


# ---------------------------------------------------------------- train / eval


def augment(wav: torch.Tensor) -> torch.Tensor:
    """Random circular time shift per clip (cries sit anywhere in the zero-padded 10 s)."""
    shifts = torch.randint(0, CLIP_SAMPLES, (wav.size(0),))
    return torch.stack([torch.roll(w, int(s)) for w, s in zip(wav, shifts)])


def train_epoch(net, opt, scaler, X, y, class_weight, args, device) -> float:
    net.train()
    order = torch.randperm(len(y))
    if args.smoke:
        order = order[: args.batch_size]
    total = 0.0
    for start in range(0, len(order), args.batch_size):
        idx = order[start : start + args.batch_size]
        wav, target = augment(X[idx]).to(device), y[idx].to(device)
        lam = float(np.random.beta(args.mixup_alpha, args.mixup_alpha))
        perm = torch.randperm(len(idx), device=device)
        wav = lam * wav + (1 - lam) * wav[perm]
        x = net.logmel(wav)
        with torch.autocast(device_type=device.type, dtype=torch.float16, enabled=device.type == "cuda"):
            logits = net.classify(x)
        logits = logits.float()
        loss = lam * F.cross_entropy(logits, target, weight=class_weight) + (1 - lam) * F.cross_entropy(
            logits, target[perm], weight=class_weight
        )
        opt.zero_grad(set_to_none=True)
        scaler.scale(loss).backward()
        scaler.step(opt)
        scaler.update()
        total += loss.item() * len(idx)
    return total / len(order)


@torch.no_grad()
def predict_logits(net, X, batch_size, device) -> np.ndarray:
    net.eval()
    out = []
    for start in range(0, len(X), batch_size):
        x = net.logmel(X[start : start + batch_size].to(device))
        with torch.autocast(device_type=device.type, dtype=torch.float16, enabled=device.type == "cuda"):
            out.append(net.classify(x).float().cpu())
    return torch.cat(out).numpy()


def softmax(logits: np.ndarray, temperature: float = 1.0) -> np.ndarray:
    z = logits / temperature
    z = np.exp(z - z.max(axis=1, keepdims=True))
    return z / z.sum(axis=1, keepdims=True)


def fit_temperature(logits: np.ndarray, y: np.ndarray) -> float:
    grid = np.exp(np.linspace(np.log(0.25), np.log(20), 200))
    nll = [-np.log(softmax(logits, t)[np.arange(y.size), y] + 1e-12).mean() for t in grid]
    return float(grid[int(np.argmin(nll))])


def report(proba: np.ndarray, y: np.ndarray) -> dict:
    pred = proba.argmax(axis=1)
    correct = pred == y
    conf = proba.max(axis=1)
    bins = np.minimum((conf * ECE_BINS).astype(int), ECE_BINS - 1)
    ece = sum((bins == b).mean() * abs(correct[bins == b].mean() - conf[bins == b].mean()) for b in np.unique(bins))
    ranked = np.sort(proba, axis=1)[:, ::-1]
    case = np.where(ranked[:, 0] < UNSURE_MAX, "unsure",
                    np.where(ranked[:, 0] - ranked[:, 1] < CLOSE_MARGIN - 1e-9, "close", "confident"))  # fmt: skip
    return {
        "accuracy": float(accuracy_score(y, pred)),
        "macro_f1": float(f1_score(y, pred, average="macro", labels=range(len(LABELS)), zero_division=0)),
        "ece": float(ece),
        "cases": {c: {"n": int((case == c).sum()), "wrong": int(((case == c) & ~correct).sum())}
                  for c in ("confident", "close", "unsure")},  # fmt: skip
    }


def fit(net, data, args, device) -> CryNet:
    (X_fit, y_fit), (X_val, y_val) = data
    counts = torch.bincount(y_fit, minlength=len(LABELS)).float()
    class_weight = (counts.sum() / (len(LABELS) * counts.clamp(min=1))).to(device)
    opt = torch.optim.Adam(
        [{"params": net.trunk.parameters(), "lr": args.lr}, {"params": net.head.parameters(), "lr": args.lr * 10}]
    )
    scaler = torch.amp.GradScaler(device.type, enabled=device.type == "cuda")
    best_f1, best_state, stale = -1.0, None, 0
    for epoch in range(1 if args.smoke else args.epochs):
        start = time.time()
        loss = train_epoch(net, opt, scaler, X_fit, y_fit, class_weight, args, device)
        val = report(softmax(predict_logits(net, X_val, args.batch_size, device)), y_val.numpy())
        print(f"epoch {epoch + 1}: loss={loss:.3f} val_acc={val['accuracy']:.3f} "
              f"val_f1={val['macro_f1']:.3f} ({time.time() - start:.0f}s)", flush=True)  # fmt: skip
        if val["macro_f1"] > best_f1:
            best_f1, best_state, stale = val["macro_f1"], copy.deepcopy(net.state_dict()), 0
        else:
            stale += 1
            if stale >= args.patience:
                break
    net.load_state_dict(best_state)
    return net


def export(net: CryNet, temperature: float, metrics: dict, out: Path, probe: torch.Tensor) -> Path:
    model = Exported(copy.deepcopy(net).cpu().eval(), temperature).eval()
    with torch.no_grad():
        traced = torch.jit.trace(model, probe[:1].cpu())
        drift = (traced(probe[:1]) - model(probe[:1])).abs().max().item()
    if drift > 1e-4:
        raise RuntimeError(f"traced model differs from eager model by {drift}")
    path = out / "cry_net.pt"
    extra = {"labels.json": json.dumps(list(LABELS)), "metrics.json": json.dumps(metrics)}
    torch.jit.save(traced, str(path), _extra_files=extra)
    return path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", type=Path, default=Path("data/baidu"), help="{label}/*.wav; downloaded if empty")
    parser.add_argument("--out", type=Path, default=Path("out"))
    parser.add_argument("--epochs", type=int, default=40)
    parser.add_argument("--patience", type=int, default=8)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--lr", type=float, default=1e-4, help="trunk lr; head uses 10x")
    parser.add_argument("--mixup-alpha", type=float, default=0.4)
    parser.add_argument("--smoke", action="store_true", help="1 batch, tiny val/test: checks the pipeline only")
    args = parser.parse_args()

    torch.manual_seed(SEED)
    np.random.seed(SEED)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    if not any((args.data / label).is_dir() for label in LABELS):
        download_baidu(args.data)
    ensure_checkpoint()
    paths, labels = list_clips(args.data)
    y = torch.tensor([LABELS.index(label) for label in labels])
    fit_idx, val_idx, test_idx = split(labels)
    if args.smoke:
        fit_idx, val_idx, test_idx = fit_idx[: args.batch_size], val_idx[:4], test_idx[:4]
    print(f"{device}: fit={len(fit_idx)} val={len(val_idx)} test={len(test_idx)}; decoding audio...", flush=True)
    X = {name: load_waveforms([paths[i] for i in idx]) for name, idx in
         (("fit", fit_idx), ("val", val_idx), ("test", test_idx))}  # fmt: skip

    net = CryNet(len(LABELS)).to(device)
    net = fit(net, ((X["fit"], y[fit_idx]), (X["val"], y[val_idx])), args, device)
    temperature = fit_temperature(predict_logits(net, X["val"], args.batch_size, device), y[val_idx].numpy())
    test_logits = predict_logits(net, X["test"], args.batch_size, device)
    metrics = {
        "model": "CNN14 fine-tuned + stats pooling (InfantCryNet-style)",
        "classes": len(LABELS),
        "n_fit": len(fit_idx), "n_val": len(val_idx), "n_test": len(test_idx),
        "temperature": temperature,
        **report(softmax(test_logits, temperature), y[test_idx].numpy()),
        "uncalibrated": report(softmax(test_logits), y[test_idx].numpy()),
        "torch": torch.__version__,
        "smoke": args.smoke,
    }  # fmt: skip
    args.out.mkdir(parents=True, exist_ok=True)
    path = export(net, temperature, metrics, args.out, X["test"])
    (args.out / "finetune_metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print(f"test: accuracy={metrics['accuracy']:.3f} macro_f1={metrics['macro_f1']:.3f} "
          f"ece={metrics['ece']:.3f} T={temperature:.2f} cases={metrics['cases']} -> {path}")  # fmt: skip
    return 0


if __name__ == "__main__":
    sys.exit(main())
