"""Fine-tune PANNs CNN14 end to end on the Baidu 6-class set (InfantCryNet, arXiv 2409.19689). v2.

Log-mel CNN14 trunk (AudioSet weights) -> statistics pooling (mean || std over time) -> linear head.
Adam (trunk lr, head 10x) with linear warmup + cosine decay, class-weighted CE with label smoothing,
EMA of weights (evaluated, early-stopped on val macro-F1 and exported), time shift + ESC-50 background
noise at random SNR + waveform mixup + SpecAugment, temperature scaling on val.
Test split = ml/train.py's (stratified 80/20, seed 42, same clip order): comparable with v1.
Exports TorchScript `cry_net.pt` (probabilities out, labels inside) for the backend.
v1 behaviour (acc 0.495, macro-F1 0.481) = add: --ema-decay 0 --label-smoothing 0 --lr-schedule constant --noise none

Self-contained on purpose: Colab only needs this one file.

Colab (T4 GPU), results saved on Google Drive so a disconnect loses nothing:
  1. Runtime > Change runtime type > T4 GPU. Upload this file in the Files pane.
  2. Cell 1:  from google.colab import drive; drive.mount('/content/drive')
  3. Cell 2 (torch pinned to backend/requirements.txt so the TorchScript file loads there):
       !pip -q install torch==2.14.1 panns-inference==0.1.1 torchlibrosa==0.1.0 librosa==0.11.0 \
            huggingface_hub scikit-learn
       !python finetune_cnn14.py --out /content/drive/MyDrive/crynet-v2
     Downloads: Baidu zip from Hugging Face (~690 MB), CNN14 checkpoint (~327 MB), ESC-50 (~600 MB,
     crying_baby excluded; on failure it warns and trains without noise).
  4. Disconnected? Re-run steps 1-3 with the same command plus --resume. It restarts from the last
     best epoch in <out>/best.pt (model, EMA, optimizer, scheduler, epoch; ~1.3 GB, written on every
     val macro-F1 improvement).
  5. Download <out>/cry_net.pt (~300 MB) and finetune_metrics.json. Put cry_net.pt in backend/models/
     and start the backend with FINETUNED_MODEL=models/cry_net.pt.
  Expected runtime (estimate, not measured on T4): ~10 min download + decode, then ~25-45 s per
  epoch with AMP; early stopping usually ends before --epochs 40, so ~20-40 min total.

Local CPU smoke test only (one batch, no real training):
    ml/.venv/bin/python ml/finetune_cnn14.py --data ml/data/baidu --out /tmp/ft --smoke
"""

import argparse
import copy
import csv
import hashlib
import io
import json
import math
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
ESC50_URL = "https://github.com/karolpiczak/ESC-50/archive/master.zip"  # upstream repo (CC BY-NC)
ESC50_ROOT, ESC50_EXCLUDE = "ESC-50-master", "crying_baby"
MIN_NOISE_SAMPLES = SAMPLE_RATE // 4  # drop clips that are (almost) all digital silence

VAL_SIZE = 0.15  # of the train split, for early stopping + temperature
EMBED_DIM = 2048
ECE_BINS = 10
DOWNLOAD_RETRIES = 8
LR_FLOOR = 0.01  # cosine decays to 1% of the base lr
BEST_FILE = "best.pt"


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


def load_noise(cache_dir: Path) -> list[torch.Tensor]:
    """ESC-50 minus crying_baby, 32 kHz mono, digital-silence padding trimmed. Raises on failure."""
    import librosa

    zip_path = cache_dir / "ESC-50-master.zip"
    if not zip_path.is_file():
        download(ESC50_URL, zip_path)
    clips = []
    with zipfile.ZipFile(zip_path) as zf:
        with zf.open(f"{ESC50_ROOT}/meta/esc50.csv") as f:
            rows = list(csv.DictReader(io.TextIOWrapper(f, encoding="utf-8")))
        for row in rows:
            if row["category"] == ESC50_EXCLUDE:
                continue
            wav, _ = librosa.load(io.BytesIO(zf.read(f"{ESC50_ROOT}/audio/{row['filename']}")),
                                  sr=SAMPLE_RATE, mono=True)  # fmt: skip
            voiced = np.flatnonzero(wav)
            if voiced.size:
                wav = wav[voiced[0] : voiced[-1] + 1]
            if wav.size >= MIN_NOISE_SAMPLES:
                clips.append(torch.from_numpy(wav).half())  # fp16 halves RAM (~0.6 GB for 1960 clips)
    if not clips:
        raise RuntimeError("no usable ESC-50 clips")
    return clips


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


class EMA:
    """Exponential moving average of all float tensors (params + BN stats); kept in eval mode."""

    def __init__(self, net: nn.Module, decay: float) -> None:
        self.model = copy.deepcopy(net).eval().requires_grad_(False)
        self.decay, self.updates = decay, 0

    @torch.no_grad()
    def update(self, net: nn.Module) -> None:
        self.updates += 1
        decay = min(self.decay, (1 + self.updates) / (10 + self.updates))  # short runs: don't lag the raw weights
        for ema_t, cur in zip(self.model.state_dict().values(), net.state_dict().values()):
            if ema_t.dtype.is_floating_point:
                ema_t.mul_(decay).add_(cur.detach(), alpha=1 - decay)
            else:
                ema_t.copy_(cur)


def augment(wav: torch.Tensor, noise: list[torch.Tensor] | None, args) -> torch.Tensor:
    """Random circular time shift per clip (cries sit anywhere in the zero-padded 10 s), then
    (prob --noise-prob) a random ESC-50 clip mixed in at a random SNR."""
    shifts = torch.randint(0, CLIP_SAMPLES, (wav.size(0),))
    wav = torch.stack([torch.roll(w, int(s)) for w, s in zip(wav, shifts)])
    if not noise:
        return wav
    for i in range(wav.size(0)):
        if np.random.rand() >= args.noise_prob:
            continue
        clip = noise[np.random.randint(len(noise))].float()
        clip = clip.repeat(math.ceil(CLIP_SAMPLES / clip.numel()) + 1)  # tile, then random crop
        offset = np.random.randint(clip.numel() - CLIP_SAMPLES + 1)
        clip = clip[offset : offset + CLIP_SAMPLES]
        voiced = wav[i][wav[i] != 0]  # signal power ignores the zero padding
        if voiced.numel() == 0:
            continue
        snr_db = np.random.uniform(args.snr_min, args.snr_max)
        scale = (voiced.pow(2).mean() / (clip.pow(2).mean() * 10 ** (snr_db / 10) + 1e-12)).sqrt()
        wav[i] = wav[i] + scale * clip
    return wav


def train_epoch(net, opt, sched, ema, scaler, X, y, class_weight, noise, args, device) -> float:
    net.train()
    order = torch.randperm(len(y))
    if args.smoke:
        order = order[: args.batch_size]
    total = 0.0
    for start in range(0, len(order), args.batch_size):
        idx = order[start : start + args.batch_size]
        wav, target = augment(X[idx], noise, args).to(device), y[idx].to(device)
        lam = float(np.random.beta(args.mixup_alpha, args.mixup_alpha))
        perm = torch.randperm(len(idx), device=device)
        wav = lam * wav + (1 - lam) * wav[perm]
        x = net.logmel(wav)
        with torch.autocast(device_type=device.type, dtype=torch.float16, enabled=device.type == "cuda"):
            logits = net.classify(x)
        logits = logits.float()
        ce = lambda t: F.cross_entropy(logits, t, weight=class_weight, label_smoothing=args.label_smoothing)  # noqa: E731
        loss = lam * ce(target) + (1 - lam) * ce(target[perm])
        opt.zero_grad(set_to_none=True)
        scaler.scale(loss).backward()
        scaler.step(opt)
        scaler.update()
        sched.step()
        if ema:
            ema.update(net)
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
    per_class = f1_score(y, pred, average=None, labels=range(len(LABELS)), zero_division=0)
    return {
        "accuracy": float(accuracy_score(y, pred)),
        "macro_f1": float(f1_score(y, pred, average="macro", labels=range(len(LABELS)), zero_division=0)),
        "per_class_f1": {label: float(v) for label, v in zip(LABELS, per_class)},
        "ece": float(ece),
        "cases": {c: {"n": int((case == c).sum()), "wrong": int(((case == c) & ~correct).sum())}
                  for c in ("confident", "close", "unsure")},  # fmt: skip
    }


def lr_lambda(args, steps_per_epoch: int, total_steps: int):
    warmup = round(args.warmup_epochs * steps_per_epoch)

    def scale(step: int) -> float:
        if args.lr_schedule == "constant":
            return 1.0
        if step < warmup:
            return (step + 1) / warmup
        progress = min(1.0, (step - warmup) / max(1, total_steps - warmup))
        return LR_FLOOR + (1 - LR_FLOOR) * 0.5 * (1 + math.cos(math.pi * progress))

    return scale


def save_checkpoint(path: Path, state: dict) -> None:
    tmp = path.with_suffix(".pt.tmp")  # atomic: a Colab disconnect mid-write keeps the old file
    torch.save(state, tmp)
    tmp.replace(path)


def fit(net, data, args, device, noise) -> nn.Module:
    """Returns the model to evaluate/export: the EMA copy when --ema-decay > 0, else `net`."""
    (X_fit, y_fit), (X_val, y_val) = data
    counts = torch.bincount(y_fit, minlength=len(LABELS)).float()
    class_weight = (counts.sum() / (len(LABELS) * counts.clamp(min=1))).to(device)
    opt = torch.optim.Adam(
        [{"params": net.trunk.parameters(), "lr": args.lr}, {"params": net.head.parameters(), "lr": args.lr * 10}]
    )
    epochs = 1 if args.smoke else args.epochs
    steps_per_epoch = math.ceil((args.batch_size if args.smoke else len(y_fit)) / args.batch_size)
    sched = torch.optim.lr_scheduler.LambdaLR(opt, lr_lambda(args, steps_per_epoch, epochs * steps_per_epoch))
    scaler = torch.amp.GradScaler(device.type, enabled=device.type == "cuda")
    ema = EMA(net, args.ema_decay) if args.ema_decay > 0 else None
    best_path = args.out / BEST_FILE
    best_f1, best_state, stale, first_epoch = -1.0, None, 0, 0
    if args.resume and best_path.is_file():
        ck = torch.load(best_path, map_location=device, weights_only=True)
        net.load_state_dict(ck["model"])
        opt.load_state_dict(ck["optimizer"])
        sched.load_state_dict(ck["scheduler"])
        scaler.load_state_dict(ck["scaler"])
        if ema:
            ema.model.load_state_dict(ck["ema"])
            ema.updates = ck["ema_updates"]
        best_f1, first_epoch = ck["val_f1"], ck["epoch"]
        best_state = {k: v.detach().cpu().clone() for k, v in ck["state_dict"].items()}
        print(f"resumed from {best_path}: epoch {first_epoch}, val_f1={best_f1:.3f}", flush=True)
    elif args.resume:
        print(f"--resume: no {best_path}, starting fresh", file=sys.stderr)
    eval_net = ema.model if ema else net
    for epoch in range(first_epoch, epochs):
        start = time.time()
        loss = train_epoch(net, opt, sched, ema, scaler, X_fit, y_fit, class_weight, noise, args, device)
        val = report(softmax(predict_logits(eval_net, X_val, args.batch_size, device)), y_val.numpy())
        print(f"epoch {epoch + 1}: loss={loss:.3f} val_acc={val['accuracy']:.3f} "
              f"val_f1={val['macro_f1']:.3f} ({time.time() - start:.0f}s)", flush=True)  # fmt: skip
        if val["macro_f1"] > best_f1:
            best_f1, stale = val["macro_f1"], 0
            weights = eval_net.state_dict()
            best_state = {k: v.detach().cpu().clone() for k, v in weights.items()}
            save_checkpoint(best_path, {
                "state_dict": weights, "temperature": None,  # fit after training; placeholder keeps the schema
                "epoch": epoch + 1, "val_f1": best_f1,
                "model": net.state_dict(), "ema": ema.model.state_dict() if ema else None,
                "ema_updates": ema.updates if ema else 0, "optimizer": opt.state_dict(),
                "scheduler": sched.state_dict(), "scaler": scaler.state_dict(),
            })  # fmt: skip
        else:
            stale += 1
            if stale >= args.patience:
                break
    eval_net.load_state_dict(best_state)
    return eval_net


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
    parser.add_argument("--ema-decay", type=float, default=0.999, help="0 disables EMA")
    parser.add_argument("--label-smoothing", type=float, default=0.1)
    parser.add_argument("--lr-schedule", choices=("cosine", "constant"), default="cosine")
    parser.add_argument("--warmup-epochs", type=float, default=1.0, help="linear warmup (cosine schedule only)")
    parser.add_argument("--noise", choices=("esc50", "none"), default="esc50", help="background-noise augmentation")
    parser.add_argument("--noise-prob", type=float, default=0.5)
    parser.add_argument("--snr-min", type=float, default=5.0, help="dB")
    parser.add_argument("--snr-max", type=float, default=20.0, help="dB")
    parser.add_argument("--noise-dir", type=Path, default=Path.home() / "esc50", help="ESC-50 zip cache (local disk)")
    parser.add_argument("--resume", action="store_true", help="continue from --out/best.pt if present")
    parser.add_argument("--smoke", action="store_true", help="1 batch, tiny val/test: checks the pipeline only")
    args = parser.parse_args()

    torch.manual_seed(SEED)
    np.random.seed(SEED)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    if not any((args.data / label).is_dir() for label in LABELS):
        download_baidu(args.data)
    ensure_checkpoint()
    args.out.mkdir(parents=True, exist_ok=True)
    noise = None
    if args.noise == "esc50":
        try:
            noise = load_noise(args.noise_dir)
            print(f"noise: {len(noise)} ESC-50 clips (no {ESC50_EXCLUDE})", flush=True)
        except Exception as exc:  # noqa: BLE001 - training without noise beats no training
            print(f"WARNING: ESC-50 unavailable ({exc}); training without noise", file=sys.stderr)
    paths, labels = list_clips(args.data)
    y = torch.tensor([LABELS.index(label) for label in labels])
    fit_idx, val_idx, test_idx = split(labels)
    if args.smoke:
        fit_idx, val_idx, test_idx = fit_idx[: args.batch_size], val_idx[:4], test_idx[:4]
    print(f"{device}: fit={len(fit_idx)} val={len(val_idx)} test={len(test_idx)}; decoding audio...", flush=True)
    X = {name: load_waveforms([paths[i] for i in idx]) for name, idx in
         (("fit", fit_idx), ("val", val_idx), ("test", test_idx))}  # fmt: skip

    net = CryNet(len(LABELS)).to(device)
    net = fit(net, ((X["fit"], y[fit_idx]), (X["val"], y[val_idx])), args, device, noise)
    temperature = fit_temperature(predict_logits(net, X["val"], args.batch_size, device), y[val_idx].numpy())
    test_logits = predict_logits(net, X["test"], args.batch_size, device)
    metrics = {
        "version": "v2",
        "model": "CNN14 fine-tuned + stats pooling (InfantCryNet-style)",
        "flags": {k: str(v) if isinstance(v, Path) else v for k, v in vars(args).items()},
        "noise_clips": len(noise) if noise else 0,
        "classes": len(LABELS),
        "n_fit": len(fit_idx), "n_val": len(val_idx), "n_test": len(test_idx),
        "temperature": temperature,
        **report(softmax(test_logits, temperature), y[test_idx].numpy()),
        "uncalibrated": report(softmax(test_logits), y[test_idx].numpy()),
        "torch": torch.__version__,
        "smoke": args.smoke,
    }  # fmt: skip
    path = export(net, temperature, metrics, args.out, X["test"])
    (args.out / "finetune_metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print(f"test: accuracy={metrics['accuracy']:.3f} macro_f1={metrics['macro_f1']:.3f} "
          f"ece={metrics['ece']:.3f} T={temperature:.2f} cases={metrics['cases']} -> {path}")  # fmt: skip
    return 0


if __name__ == "__main__":
    sys.exit(main())
