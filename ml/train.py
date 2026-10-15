"""Train the cry-reason classifier on PANNs embeddings.

    python ml/train.py --classes 6    # v1, Baidu only
    python ml/train.py --classes 9    # v2, Baidu + Kaggle
"""

import argparse
import json
import sys
from pathlib import Path

import joblib
import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from common import BACKEND_MODELS_DIR, EMBEDDINGS_PATH, LABELS_6, LABELS_9, REPO_DIR

# Report cases with the backend's own thresholds so metrics match what users see.
sys.path.insert(0, str(REPO_DIR / "backend"))
from app.config import CLOSE_MARGIN, UNSURE_MAX  # noqa: E402

SEED = 42
TEST_SIZE = 0.2
HUNGRY_CAP = 160
CALIBRATION_FOLDS = 5
ECE_BINS = 10


def select(data: dict[str, np.ndarray], labels: tuple[str, ...], sources: set[str] | None):
    """Filter to the wanted labels/sources and cap `hungry` (reproducible, seed 42)."""
    keep = np.isin(data["y"], labels)
    if sources:
        keep &= np.isin(data["source"], list(sources))
    X, y = data["X"][keep], data["y"][keep]
    hungry = np.flatnonzero(y == "hungry")
    if hungry.size > HUNGRY_CAP:
        drop = np.random.default_rng(SEED).choice(hungry, hungry.size - HUNGRY_CAP, replace=False)
        mask = np.ones(y.size, dtype=bool)
        mask[drop] = False
        X, y = X[mask], y[mask]
    return X, y


def build_pipeline() -> Pipeline:
    return Pipeline(
        [
            ("scale", StandardScaler()),
            ("clf", LogisticRegression(class_weight="balanced", max_iter=2000)),
        ]
    )


def build_calibrated() -> CalibratedClassifierCV:
    """Raw LR is ~0.77 top-1 at ~38% accuracy. Isotonic beat sigmoid and temperature
    scaling on held-out ECE (0.07 vs 0.14); both of those were underconfident."""
    return CalibratedClassifierCV(build_pipeline(), method="isotonic", cv=CALIBRATION_FOLDS)


def expected_calibration_error(proba: np.ndarray, correct: np.ndarray) -> float:
    conf = proba.max(axis=1)
    bins = np.minimum((conf * ECE_BINS).astype(int), ECE_BINS - 1)
    return float(
        sum(
            (bins == b).mean() * abs(correct[bins == b].mean() - conf[bins == b].mean())
            for b in np.unique(bins)
        )
    )


def case_counts(proba: np.ndarray, correct: np.ndarray) -> dict[str, dict[str, int]]:
    """Same rules as backend decision.classify_case (no context, cry assumed)."""
    ranked = np.sort(proba, axis=1)[:, ::-1]
    top1, margin = ranked[:, 0], ranked[:, 0] - ranked[:, 1]
    case = np.where(top1 < UNSURE_MAX, "unsure", np.where(margin < CLOSE_MARGIN - 1e-9, "close", "confident"))
    return {
        name: {"n": int((case == name).sum()), "wrong": int(((case == name) & ~correct).sum())}
        for name in ("confident", "close", "unsure")
    }


def evaluate(model, X_test: np.ndarray, y_test: np.ndarray) -> dict:
    proba = model.predict_proba(X_test)
    labels = list(model.classes_)
    pred = np.asarray(labels)[proba.argmax(axis=1)]
    correct = pred == y_test
    return {
        "accuracy": float(accuracy_score(y_test, pred)),
        "macro_f1": float(f1_score(y_test, pred, average="macro")),
        "ece": expected_calibration_error(proba, correct),
        "cases": case_counts(proba, correct),
        "labels": labels,
        "per_class": classification_report(y_test, pred, labels=labels, output_dict=True, zero_division=0),
        "confusion_matrix": confusion_matrix(y_test, pred, labels=labels).tolist(),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--classes", type=int, choices=[6, 9], required=True)
    parser.add_argument("--embeddings", type=Path, default=EMBEDDINGS_PATH)
    parser.add_argument("--out", type=Path, default=BACKEND_MODELS_DIR)
    parser.add_argument("--sources", help="comma list; default baidu for 6 classes, all for 9")
    args = parser.parse_args()

    if not args.embeddings.is_file():
        print(f"{args.embeddings} not found: run ml/extract_embeddings.py", file=sys.stderr)
        return 1
    labels = LABELS_6 if args.classes == 6 else LABELS_9
    sources = set(args.sources.split(",")) if args.sources else ({"baidu"} if args.classes == 6 else None)
    with np.load(args.embeddings) as npz:
        X, y = select({k: npz[k] for k in ("X", "y", "source")}, labels, sources)

    counts = dict(zip(*np.unique(y, return_counts=True)))
    if len(counts) < 2 or min(counts.values()) < 2:
        print(f"not enough data per class: {counts}", file=sys.stderr)
        return 1
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, stratify=y, random_state=SEED
    )
    model = build_calibrated().fit(X_train, y_train)
    uncalibrated = evaluate(build_pipeline().fit(X_train, y_train), X_test, y_test)
    metrics = {
        "classes": args.classes,
        "n_train": int(len(y_train)),
        "n_test": int(len(y_test)),
        "class_counts": {k: int(v) for k, v in counts.items()},
        "calibration": f"isotonic, cv={CALIBRATION_FOLDS}",
        **evaluate(model, X_test, y_test),
        "uncalibrated": {k: uncalibrated[k] for k in ("accuracy", "macro_f1", "ece", "cases")},
    }

    args.out.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, args.out / "classifier.joblib")
    (args.out / "labels.json").write_text(json.dumps(list(model.classes_)), encoding="utf-8")
    (args.out / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print(
        f"{args.classes}-class: accuracy={metrics['accuracy']:.3f} macro_f1={metrics['macro_f1']:.3f} "
        f"ece={metrics['ece']:.3f} (uncalibrated ece={uncalibrated['ece']:.3f}) cases={metrics['cases']}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
