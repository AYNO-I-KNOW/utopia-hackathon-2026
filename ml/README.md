# ml/ — train the cry-reason classifier

Offline only. Output goes to `backend/models/` (`classifier.joblib`, `labels.json`, `metrics.json`).
Run from the repo root inside a Python 3.11 venv: `pip install -r ml/requirements.txt`.

1. **Download data** — `python ml/download_data.py --source all`
   Baidu set (HF, ~690 MB zip) → `ml/data/baidu/{label}/`. Kaggle Baby Cry Sense needs
   `~/.kaggle/kaggle.json` (or `KAGGLE_USERNAME`/`KAGGLE_KEY`); without it the script prints instructions.
   Mapping: `tired→sleepy`, `discomfort→uncomfortable`, `scared`/`lonely` dropped.
2. **Embed** — `python ml/extract_embeddings.py`
   PANNs CNN14 embedding per clip (32 kHz mono, padded/cropped to 10 s) → `ml/embeddings.npz`.
   First run downloads the ~327 MB checkpoint to `~/panns_data/`.
3. **Train v1 (6 classes, Baidu)** — `python ml/train.py --classes 6`
4. **Train v2 (9 classes, + Kaggle)** — `python ml/train.py --classes 9`
   Each run overwrites `backend/models/*`. Keep v2 unless its macro-F1 is more than ~5 pts below v1
   (compare the `macro_f1` printed / in `metrics.json`; re-run `--classes 6` last to restore v1).
5. **Ship** — commit `backend/models/classifier.joblib`, `labels.json`, `metrics.json`
   (`.joblib` is small; checkpoints `*.pth` and `ml/data/` are git-ignored). Use `metrics.json`
   for the pitch (paper baseline: 74.7%). Note the Baidu license is unclear: research prototype.

`hungry` is capped at 160 clips; split is stratified 80/20 with seed 42.
The classifier is isotonic-calibrated (5-fold, train split only): raw LR said ~0.77 top-1 at ~38% accuracy.
`metrics.json` has `ece` and the backend `cases` (confident/close/unsure) next to the `uncalibrated` numbers.

## Optional: fine-tune CNN14 end to end (Colab T4)

`ml/finetune_cnn14.py` (InfantCryNet-style: CNN14 + statistics pooling, Adam, mixup/SpecAugment/time shift,
temperature-scaled) — Colab steps are in its docstring. Same test split as `train.py`. It exports a
TorchScript `cry_net.pt` (~300 MB, git-ignored); put it in `backend/models/` and run the backend with
`FINETUNED_MODEL=models/cry_net.pt`. Unset = the joblib classifier above. CNN14 still runs once more for
cry detection, so CPU inference is ~2x. Local CPU: `--smoke` only.

**Demo only:** `ml/make_demo_model.py` re-fits just the head of `cry_net.pt` with chosen held-out demo clips added → `backend/models/cry_net_demo.pt`. Those clips stop being held-out for that model; never cite its numbers (see `demo/clips/README.md`).
