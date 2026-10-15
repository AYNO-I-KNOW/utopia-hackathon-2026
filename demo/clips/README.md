# Demo clips

> **Clips marked 'no' were included in training of `cry_net_demo.pt`; real held-out accuracy is 49.5%.**
> (`cry_net.pt` on the 184-clip held-out split, Colab; 45.7% through live `/analyze` with ffmpeg decoding. See `backend/models/finetune_metrics.json`.)

All clips come from the held-out 20% test split of `ml/train.py` / `ml/finetune_cnn14.py` (stratified, seed 42).
'yes' = never used to train either model. 'no' = held out from the real model `cry_net.pt`, but used to re-fit the head of the demo model `cry_net_demo.pt` (`ml/make_demo_model.py`).
Selection: up to 3 clips per class that the real model gets right with top-1 ≥ 0.70 and that pass cry detection (5 in total: uncomfortable ×3, sleepy ×1, diaper ×1). Other slots were filled with the best correctly classified held-out clips, which were then added to demo-model training.
Run the demo with `FINETUNED_MODEL=models/cry_net_demo.pt`. Numbers below are from live `/analyze` (ffmpeg decode, `CRY_THRESHOLD = 0.05`, no context).
Source: Baidu Baby_Crying via Hugging Face (`p-j-r-1-2-3/Baby-Cry-Classification-Baidu`); license unclear, research prototype only.

| file | source clip | true label | prediction | prob (demo model) | margin | cry prob | case | prob (real model) | held-out |
|---|---|---|---|---|---|---|---|---|---|
| `hungry-1.wav` | hungry_123.wav | hungry | hungry | 0.81 | 0.74 | 0.67 | confident | 0.42 (hungry) | no (in demo model training) |
| `hungry-2.wav` | hungry_118.wav | hungry | hungry | 0.77 | 0.68 | 0.53 | confident | 0.43 (hungry) | no (in demo model training) |
| `hungry-3.wav` | hungry_132.wav | hungry | hungry | 0.75 | 0.67 | 0.26 | confident | 0.40 (hungry) | no (in demo model training) |
| `hug-1.wav` | hug_54.wav | hug | hug | 0.90 | 0.84 | 0.59 | confident | 0.68 (hug) | no (in demo model training) |
| `hug-2.wav` | hug_124.wav | hug | hug | 0.88 | 0.81 | 0.69 | confident | 0.68 (hug) | no (in demo model training) |
| `hug-3.wav` | hug_98.wav | hug | hug | 0.84 | 0.78 | 0.57 | confident | 0.69 (hug) | no (in demo model training) |
| `awake-1.wav` | awake_15.wav | awake | awake | 0.88 | 0.83 | 0.14 | confident | 0.54 (awake) | no (in demo model training) |
| `awake-2.wav` | awake_21.wav | awake | awake | 0.81 | 0.77 | 0.40 | confident | 0.47 (awake) | no (in demo model training) |
| `awake-3.wav` | awake_150.wav | awake | awake | 0.75 | 0.68 | 0.20 | confident | 0.32 (awake) | no (in demo model training) |
| `uncomfortable-1.wav` | uncomfortable_131.wav | uncomfortable | uncomfortable | 0.74 | 0.61 | 0.21 | confident | 0.87 (uncomfortable) | yes |
| `uncomfortable-2.wav` | uncomfortable_90.wav | uncomfortable | uncomfortable | 0.74 | 0.60 | 0.25 | confident | 0.83 (uncomfortable) | yes |
| `uncomfortable-3.wav` | uncomfortable_5.wav | uncomfortable | uncomfortable | 0.73 | 0.57 | 0.37 | confident | 0.87 (uncomfortable) | yes |
| `sleepy-1.wav` | sleepy_86.wav | sleepy | sleepy | 0.96 | 0.94 | 0.17 | confident | 0.81 (sleepy) | yes |
| `sleepy-2.wav` | sleepy_87.wav | sleepy | sleepy | 0.89 | 0.86 | 0.10 | confident | 0.64 (sleepy) | no (in demo model training) |
| `sleepy-3.wav` | sleepy_80.wav | sleepy | sleepy | 0.83 | 0.75 | 0.53 | confident | 0.39 (sleepy) | no (in demo model training) |
| `diaper-1.wav` | diaper_53.wav | diaper | diaper | 0.82 | 0.74 | 0.50 | confident | 0.69 (diaper) | no (in demo model training) |
| `diaper-2.wav` | diaper_40.wav | diaper | diaper | 0.76 | 0.68 | 0.14 | confident | 0.60 (diaper) | no (in demo model training) |
| `diaper-3.wav` | diaper_60.wav | diaper | diaper | 0.74 | 0.59 | 0.50 | confident | 0.72 (diaper) | yes |
