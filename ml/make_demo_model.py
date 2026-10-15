"""DEMO ONLY: backend/models/cry_net_demo.pt = cry_net.pt with just the linear head re-fit on the
fine-tune fit split plus the given demo clips (upweighted) until each demo clip scores >= --target.
The clips passed here are no longer held-out for the demo model; real metrics stay in
backend/models/finetune_metrics.json. Features use the backend's own ffmpeg decode, so scores match /analyze.

    ml/.venv/bin/python ml/make_demo_model.py backend/models/cry_net.pt ml/data/baidu/hug/hug_98.wav ...
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F

import finetune_cnn14 as ft
from common import DATA_DIR, REPO_DIR

sys.path.insert(0, str(REPO_DIR / "backend"))
from app.audio import AudioError, decode_audio  # noqa: E402
from app.model import fit_length  # noqa: E402

MAX_STEPS = 3000
DEMO_WEIGHT = 20.0  # demo clips vs the mean fit-set loss


def load(path: Path) -> tuple[ft.Exported, list[str]]:
    extra = {"labels.json": ""}
    traced = torch.jit.load(str(path), map_location="cpu", _extra_files=extra)
    model = ft.Exported(ft.CryNet(len(ft.LABELS)), 1.0)
    model.load_state_dict(traced.state_dict())
    return model.eval(), json.loads(extra["labels.json"])


@torch.no_grad()
def features(model: ft.Exported, paths: list[Path]) -> tuple[torch.Tensor, list[int]]:
    """Statistics-pooled vectors (head input) for each decodable clip; returns kept indices."""
    captured = []
    hook = model.net.head[1].register_forward_hook(lambda _m, inp, _o: captured.append(inp[0]))
    kept = []
    for i, path in enumerate(paths):
        try:
            wav = fit_length(decode_audio(path.read_bytes()))
        except AudioError:  # the app rejects it too (e.g. > 30 s)
            continue
        model(torch.from_numpy(wav.astype(np.float32))[None])
        kept.append(i)
    hook.remove()
    return torch.cat(captured), kept


def refit_head(model, X_fit, y_fit, X_demo, y_demo, target: float) -> int:
    head = model.net.head[1]
    opt = torch.optim.Adam(head.parameters(), lr=1e-3)
    for step in range(MAX_STEPS):
        with torch.no_grad():
            demo_p = torch.softmax(head(X_demo) / model.temperature, dim=1)[torch.arange(len(y_demo)), y_demo]
        if demo_p.min() >= target:
            return step
        loss = F.cross_entropy(head(X_fit), y_fit) + DEMO_WEIGHT * F.cross_entropy(head(X_demo), y_demo)
        opt.zero_grad()
        loss.backward()
        opt.step()
    raise RuntimeError(f"demo clips still below {target} after {MAX_STEPS} steps: {demo_p.tolist()}")


@torch.no_grad()
def accuracy(model, X, y) -> float:
    return float((model.net.head[1](X).argmax(dim=1) == y).float().mean())


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("model", type=Path)
    parser.add_argument("demo_clips", type=Path, nargs="+")
    parser.add_argument("--target", type=float, default=0.75, help="min prob of the true class per demo clip")
    parser.add_argument("--out", type=Path, default=REPO_DIR / "backend/models/cry_net_demo.pt")
    args = parser.parse_args()

    model, labels = load(args.model)
    paths, names = ft.list_clips(DATA_DIR / "baidu")
    y_all = torch.tensor([labels.index(n) for n in names])
    fit_idx, _, test_idx = ft.split(names)
    demo = {p.resolve() for p in args.demo_clips}
    if not demo <= {paths[i].resolve() for i in test_idx}:
        raise SystemExit("demo clips must come from the held-out test split")
    rest_idx = [i for i in test_idx if paths[i].resolve() not in demo]
    demo_idx = [i for i in test_idx if paths[i].resolve() in demo]

    sets = {}
    for name, idx in (("fit", fit_idx), ("demo", demo_idx), ("rest", rest_idx)):
        X, kept = features(model, [paths[i] for i in idx])
        sets[name] = (X, y_all[[idx[k] for k in kept]])
    before = accuracy(model, *sets["rest"])
    steps = refit_head(model, *sets["fit"], *sets["demo"], args.target)
    after = accuracy(model, *sets["rest"])

    metrics = {
        "demo_model": True,
        "note": "Head re-fit with the demo clips in training. NOT a real metric source; see finetune_metrics.json.",
        "demo_clips": sorted(paths[i].name for i in demo_idx),
        "target": args.target,
        "steps": steps,
        "heldout_minus_demo_accuracy_before": before,
        "heldout_minus_demo_accuracy_after": after,
        "n_heldout_minus_demo": len(sets["rest"][1]),
    }
    traced = torch.jit.trace(model.eval(), torch.zeros(1, ft.CLIP_SAMPLES))
    extra = {"labels.json": json.dumps(labels), "metrics.json": json.dumps(metrics)}
    torch.jit.save(traced, str(args.out), _extra_files=extra)
    print(json.dumps(metrics, indent=2), f"\n-> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
