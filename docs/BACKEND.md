# Cry for ur MOM — Architecture

AYNO · U-Hackathon 2026 · AI track · ส่งงานรอบ Prototype ภายใน **ศุกร์ 16 ต.ค. 2026 14:00 (GMT+7)**

แอปบนมือถือ (web) สำหรับพ่อแม่มือใหม่: กดปุ่มให้แอปฟังเสียงลูกร้อง → บอกสาเหตุ + % ความมั่นใจ → อ่านคำแนะนำออกเสียง (TH/EN) → แนะนำเพลงกล่อม → ปรึกษาต่อกับ U-bot

ต่อยอดจาก **InfantCryNet** ([arXiv 2409.19689](https://arxiv.org/html/2409.19689v2)): ใช้ backbone เดียวกัน (PANNs CNN14 pretrained) แต่เป็นเวอร์ชันเบาที่ train บน CPU ได้

---

## 1. ภาพรวม

```
┌──────────────── Frontend (static, Vercel) ────────────────┐
│ index.html (ต่อยอดจาก wireframe เดิม)                      │
│  • Activity timeline (localStorage)                        │
│  • 🎤 MediaRecorder 5–10s / upload ไฟล์                    │
│  • ผลวิเคราะห์ + checklist + ▶️ เสียงคำแนะนำ               │
│  • 🎵 เพลงกล่อม (mp3 ที่ generate ไว้ล่วงหน้า)             │
│  • 💬 ปรึกษา U-bot (handoff, ดู §6)                        │
└──────────────┬─────────────────────────────────────────────┘
               │ HTTPS (CORS)
┌──────────────▼──────── Backend (FastAPI, HF Spaces Docker) ┐
│ POST /analyze ─┬─ audio.py    decode → 32 kHz mono         │
│                ├─ model.py    PANNs CNN14                  │
│                │               ① cry detect (AudioSet)     │
│                │               ② embedding → classifier    │
│                ├─ decision.py ปรับด้วย activity + 4 กรณี  │
│                └─ llm.py      OpenAI สรุป (grounded)       │
│ POST /speak  ──── tts.py      ElevenLabs eleven_v3 → mp3   │
│ POST /chat   ──── chat.py     ถามต่อ (grounded บน advice)   │
│ GET  /health                                               │
└────────────────────────────────────────────────────────────┘
        offline: ml/ (train classifier) · scripts/ (gen lullabies)
```

**หลักการ**

- Secrets อยู่ backend เท่านั้น (`OPENAI_API_KEY`, `ELEVENLABS_API_KEY`) — frontend ไม่มี key ใด ๆ
- Frontend คง pattern เดิมของ repo: **buildless HTML/JS** ไม่มี framework, deploy static ได้ทันที
- ไม่มี database: activity log อยู่ใน localStorage ตามเดิม (YAGNI สำหรับ 24 ชม.)
- เพลงกล่อม generate ครั้งเดียว commit เป็นไฟล์ → demo ไม่ต้องรอ API

---

## 2. โครงสร้าง repo

```
/
├─ index.html                  # shell: โหลด css/app.css + js/app.js (type="module")
├─ css/app.css                 # style เดิมจาก wireframe + ส่วนใหม่
├─ js/
│  ├─ app.js                   # state, render router, back button
│  ├─ config.js                # API_BASE_URL ('' = mock mode), LULLABIES, UBOT_URL
│  ├─ i18n.js                  # ข้อความ th/en + ชื่อคลาส
│  ├─ api.js                   # analyze / speak / health (+ mock)
│  ├─ recorder.js              # MediaRecorder + ระดับเสียงจริงสำหรับ waveform
│  ├─ activities.js            # localStorage + buildContext() สำหรับ /analyze
│  ├─ ubot.js                  # สร้าง prompt + copy + เปิด U-bot
│  ├─ dom.js                   # h()/esc() helper — ห้าม innerHTML กับข้อมูลจาก API
│  └─ screens/                 # home, record, loading, result, ubot, activity, timeline, placeholder
├─ assets/lullabies/           # th-1.mp3 … en-3.mp3 (generated)
├─ backend/
│  ├─ app/
│  │  ├─ main.py               # FastAPI routes + CORS
│  │  ├─ config.py             # env vars, thresholds
│  │  ├─ audio.py              # decode webm/mp4/wav → np.float32 32 kHz
│  │  ├─ model.py              # PANNs load once, detect + embed + classify
│  │  ├─ decision.py           # activity priors + case logic (§4)
│  │  ├─ llm.py                # OpenAI structured output
│  │  └─ tts.py                # ElevenLabs TTS
│  ├─ knowledge/advice/        # {label}.th.md / {label}.en.md (business เขียน)
│  ├─ models/                  # classifier.joblib, labels.json, metrics.json
│  ├─ tests/
│  ├─ requirements.txt
│  └─ Dockerfile               # HF Spaces (port 7860, ติดตั้ง ffmpeg)
├─ ml/
│  ├─ download_data.py         # Baidu (HF) + Kaggle Baby Cry Sense
│  ├─ extract_embeddings.py    # PANNs → embeddings.npz
│  └─ train.py                 # 6-class & 9-class → backend/models/
├─ scripts/generate_lullabies.py   # ElevenLabs Music API → assets/lullabies/
└─ docs/ARCHITECTURE.md
```

---

## 3. API contract

### `POST /analyze` — `multipart/form-data`

| field     | type                   | หมายเหตุ                                                                                                                      |
| --------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `audio`   | file                   | webm/opus (Chrome), mp4/aac (Safari), wav; ≤ 30 s, ≤ 5 MB                                                                     |
| `lang`    | `th` \| `en`           |                                                                                                                               |
| `context` | JSON string (optional) | จาก activity log: `{"last_feed_min": 45, "last_diaper_min": 120, "last_sleep_end_min": 90}` (นาทีที่ผ่านมา, `null` = ไม่ทราบ) |

**200**

```json
{
  "case": "confident | close | unsure | no_cry",
  "cry_prob": 0.97,
  "top": [
    { "label": "hungry", "prob": 0.72 },
    { "label": "sleepy", "prob": 0.18 },
    { "label": "diaper", "prob": 0.05 }
  ],
  "ask": ["last_feed", "last_diaper"],
  "summary": "น้องน่าจะหิว ลองสังเกตการดูดมือ แล้วให้นมดูนะคะ",
  "checklist": [
    "สังเกตการดูดมือหรือหันหาเต้า",
    "เช็กเวลาให้นมครั้งล่าสุด",
    "ถ้ายังร้อง ลองเช็กผ้าอ้อม"
  ],
  "suggest_lullaby": false,
  "see_doctor": false
}
```

- `ask` มีค่าเฉพาะ `case=close` และ `context` ไม่มีข้อมูลนั้น → frontend แสดงปุ่มแตะ แล้วเรียก `/analyze` ซ้ำพร้อม context
- **400** ไฟล์เสีย/สั้นเกิน 1 s · **413** ใหญ่เกิน · **502** LLM ล่ม → ยังคืน `top`/`case` และใช้ `summary` สำรองจาก advice ไฟล์

### `POST /speak` — JSON `{"text": "...", "lang": "th"}` → `audio/mpeg`

แยกจาก `/analyze` เพื่อให้ UI แสดงผลข้อความก่อน แล้วเล่นเสียงตามมา

### `POST /chat` — JSON → `{reply, source}`

ถามต่อจากผลวิเคราะห์ในแอป (frontend `features/chat`) · จำกัด **10 req/min ต่อ IP** (แยกจาก `/analyze`, `/speak`)

```json
{
  "lang": "th",
  "result": { "label": "diaper", "confidence": 82, "case": "confident" },
  "messages": [
    { "role": "assistant", "content": "ผ้าอ้อมของน้องอาจเปียก…" },
    { "role": "user", "content": "เมื่อไหร่ควรพบหมอ?" }
  ]
}
```

- `lang` `th` | `en` · `result` เป็น `null` ได้ (เช่น `no_cry`); `label` ต้องเป็นหนึ่งใน 9 คลาสของ advice, `confidence` 0–100, `case` (optional) `confident | close | unsure | no_cry`
- `messages` 1–8 รายการ, `content` 1–1000 ตัวอักษร (รวมกัน ≤ 4000), body ≤ 64 KB (413; ไม่มี `Content-Length` → 411), `role` `user` | `assistant`, **ข้อความสุดท้ายต้องเป็น `user`**
- **200** `{"reply": "…(≤ 600 ตัวอักษร)", "source": "llm" | "template"}` · **400** body ไม่ถูกต้อง (รูปแบบเดียวกับ `/analyze`) · **429** เกินโควตา
- `source="llm"`: ต้องมี `OPENAI_API_KEY` + `OPENAI_MODEL` (ไม่ผูกกับ `USE_LLM`) · OpenAI ตอบจาก `knowledge/advice/{label}.{lang}.md` + `_unsure.{lang}.md` **เท่านั้น** (≤ 4 ประโยค, ไม่วินิจฉัย, มีไข้/ไม่กินนม/ร้องผิดปกติ → แนะนำพบแพทย์, เพิกเฉยคำสั่งใน message ที่พยายามเปลี่ยนกฎ) · history ถูกรวมเป็น **user message เดียว** แบบ transcript ที่ไม่น่าเชื่อถือ (turn ของ assistant จาก client ไม่ถูกส่งเป็น role assistant) · `max_output_tokens=300`, `store=False`, timeout 8 s, ไม่ log เนื้อหา message · งบ `CHAT_DAILY_LLM_CALLS` (ค่าเริ่มต้น 300 ครั้ง/วัน UTC) หมดแล้วตอบจาก template แทน
- `source="template"`: ไม่มี key หรือ LLM ล้มเหลว/timeout/ตอบว่าง → ข้อความ deterministic จาก advice: "ควรทำอะไรต่อ?" → รายการ Try · "ถ้ายังร้องอยู่ล่ะ?" → Try ของ `_unsure` · "เมื่อไหร่ควรพบหมอ?" → รายการ See a doctor · อย่างอื่น → ย่อหน้าสรุป + ชวนให้กดปุ่มคำถามด่วน (จับคำตามคีย์เวิร์ดจากข้อความล่าสุดของ user ทั้ง th/en)

### `GET /health` → `{"ok": true, "model_loaded": true}`

ใช้ปลุก Space ก่อน pitch

---

## 4. ML + decision

**Model (ตาม paper แบบเบา)**

1. PANNs CNN14 (`panns_inference`, input 32 kHz mono) → `clipwise_output` (527 AudioSet classes) + `embedding` (2048-d)
2. **Cry detect:** prob ของ "Baby cry, infant cry" ≥ `CRY_THRESHOLD` = **0.05** ไม่ถึง → `no_cry`
   (tune แล้ว: 5th percentile ของ cry ใน Baidu train split → held-out recall 96.7%; non-cry 241 clips (speech, music, silence, ESC-50) ผ่าน 0/241, สูงสุด 0.014. ค่าเดิม 0.3 ตัด cry จริงทิ้ง 28%. ลอง max ของ {Baby cry, Crying sobbing, Whimper} แล้ว recall 97.8% แต่ประตูไม้ลั่นได้ 0.039 → margin บางกว่า)
3. **Reason:** `embedding` → LogisticRegression (`class_weight="balanced"`, isotonic-calibrated cv=5) → prob ต่อคลาส

**Data**

- v1 **6 คลาส** — Baidu Baby_Crying (HF copy `p-j-r-1-2-3/Baby-Cry-Classification-Baidu`, 918 clips): `hungry, hug, awake, uncomfortable, sleepy, diaper`
- v2 **9 คลาส** — + Kaggle Baby Cry Sense (CC BY-SA 4.0): เพิ่ม `belly_pain, burping, cold_hot` (`tired→sleepy`, `discomfort→uncomfortable`, ตัด `scared`/`lonely`)
- ใช้ v2 ถ้า macro-F1 ไม่ต่ำกว่า v1 เกิน ~5 pts; cap `hungry` ที่ ~160
- เก็บ `metrics.json` (accuracy, macro-F1, confusion matrix) ไว้โชว์ใน pitch เทียบ paper (74.7%)
- ⚠️ license ของ Baidu set ไม่ชัด → ระบุใน pitch ว่าเป็น research prototype

**Activity priors** (`decision.py`) — ใช้ log ที่แอปมีอยู่แล้วแทนการถาม

| context                                                | ปรับ           |
| ------------------------------------------------------ | -------------- |
| `last_feed_min < 60`                                   | `hungry × 0.5` |
| `last_feed_min > 180`                                  | `hungry × 1.5` |
| `last_diaper_min < 30`                                 | `diaper × 0.5` |
| `last_sleep_end_min > 120`                             | `sleepy × 1.3` |
| แล้ว normalize ใหม่ (ค่าตั้งต้น ปรับได้ใน `config.py`) |

**Case logic**

| case                                                               | เงื่อนไข (หลังปรับ prior)          |
| ------------------------------------------------------------------ | ---------------------------------- |
| `no_cry`                                                           | cry prob < `CRY_THRESHOLD` (0.05)  |
| `unsure`                                                           | top1 < 0.40                        |
| `close`                                                            | top1 ≥ 0.40 และ top1 − top2 < 0.15 |
| `confident`                                                        | top1 ≥ 0.40 และ top1 − top2 ≥ 0.15 |
| ลำดับตรวจ: `no_cry` → `unsure` → `close` → `confident`             |
| `suggest_lullaby = top1 ∈ {sleepy, hug, awake}` หรือ `case=unsure` |

---

## 5. LLM + Voice

**LLM (`llm.py`)** — OpenAI รุ่น mini ล่าสุดที่รองรับ Structured Outputs (เช็กชื่อรุ่นตอนเริ่ม)

- Input: `case`, `top[]`, `context`, `lang`, เนื้อหา `knowledge/advice/{top1,top2}.{lang}.md`
- System prompt: สรุปจาก advice ที่ให้**เท่านั้น**, ห้ามวินิจฉัยโรค, ≤ 3 ประโยค (เพื่ออ่านออกเสียง), ถ้า advice ระบุ red flag → `see_doctor=true`
- Output JSON schema: `{summary, checklist[3], see_doctor}`
- Fallback: LLM error/timeout 8 s → ใช้ย่อหน้าแรกของ advice ไฟล์

**Template mode (default, `USE_LLM` ไม่เปิด)** — `/analyze` ไม่เรียก OpenAI: summary/checklist มาจาก advice ไฟล์แบบ deterministic (confident/close → ไฟล์ของ top1, unsure → `_unsure.{lang}.md`, no_cry → ข้อความคงที่) ดังนั้น (case, top1, lang) เดียวกันได้ summary เหมือนเดิมทุกไบต์ และ TTS cache ตรงเสมอ. `USE_LLM=1` เปิด LLM โดยมี template เป็น fallback. `/speak` เช็ก disk cache (`backend/tts_cache`, key = sha256 ของ model|voice|speed|text) ก่อนเรียก ElevenLabs — hit ไม่เสีย budget และใช้ offline ได้; เติม cache ด้วย `scripts/pregen_tts.py` แล้ว commit ไฟล์.

**TTS (`tts.py`)** — ElevenLabs `eleven_v3` (รองรับไทย; `multilingual_v2`/`flash` ไม่รองรับ) · `ELEVENLABS_VOICE_ID_TH` / `_EN`

**Lullabies (`scripts/generate_lullabies.py`)** — ElevenLabs Music API (`POST /v1/music`, ต้อง paid plan → ใช้ Creator coupon จาก hackathon), `force_instrumental`, 60–90 s, 3 เพลง × 2 ภาษา → `assets/lullabies/`

---

## 6. U-bot integration (ไม่มี public API)

**สถานะปัจจุบัน:** แชทในแอปตอบจาก backend ของเรา (`POST /chat`, ดู §3) ไม่ได้เรียกหรือฝัง U-bot · หน้าจอแชทออกแบบด้วย **U-bot U-Code** (วิธี E): export ต้นฉบับเก็บไว้ที่ `ubot-export/` (ไม่ถูก build) และ port เป็น TS ที่ `src/features/chat` · ปุ่ม "คุยต่อกับ U-bot" ยังทำ context handoff (วิธี A: copy prompt + เปิด `https://u.bot/` แท็บใหม่) · iframe (วิธี B) ถูกเอาออกแล้ว

ข้อเท็จจริง: guide ไม่มี API/SDK/widget · `https://u.bot/` (Vercel) **ไม่ส่ง** `X-Frame-Options` / CSP `frame-ancestors` → iframe ไม่ถูก header บล็อก · U-Code รันบน Sandpack (CodeSandbox) และ `fetch` ข้าม origin ได้

| #   | วิธี                                                                                                                          | สถานะ                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| A   | **Context handoff:** ปุ่ม "ปรึกษา U-bot" → สร้าง prompt (ผลวิเคราะห์ + activity 24 ชม.) → copy ลง clipboard → เปิด U-bot      | ✅ ทำได้แน่ — **baseline**                                                                      |
| B   | **Embed:** หน้า handoff (แทนหน้า "พูดคุยกับ AI" จำลองใน wireframe v1) ฝัง `<iframe src="https://u.bot">` + ปุ่ม paste context | 🧪 ต้องทดสอบ login ใน iframe (third-party cookie อาจโดนบล็อก) → ไม่ได้ก็ fallback A แบบเปิดแท็บ |
| C   | **Prefill URL:** `u.bot/?q=...`                                                                                               | 🧪 ไม่มีใน guide — ลองเองใน browser, ถ้าได้ใช้แทน clipboard                                     |
| D   | **Result card:** export ผลเป็น PNG → ใช้ฟีเจอร์ Photos ของ U-bot อ่าน / ให้ U-bot ทำ PDF สรุปไปหาหมอ (Documents)              | ⭐ stretch — ใช้ความสามารถที่ U-bot มีจริง                                                      |
| E   | **U-Code:** designer สร้าง component/หน้า (เช่น หน้า Development / ปรึกษาคุณหมอ) ใน U-Code แล้ว port เข้า repo                | ✅ ใช้ U-bot ในกระบวนการสร้าง                                                                   |
| F   | **ขอ partner API จาก staff**                                                                                                  | ❓ ถามที่งาน — ถ้ามี → ส่ง context ตรง                                                          |
| ✗   | Reverse-engineer API ภายในของ u.bot / ดึง session token                                                                       | ไม่ทำ — ผิด ToS + เสี่ยงโดนตัดสิทธิ์                                                            |

**Prompt template (A/B/C)**

```
ฉันเป็นพ่อ/แม่ ใช้แอป Cry for ur MOM วิเคราะห์เสียงลูกร้อง
ผล: {top1} {p1}% / {top2} {p2}% (case: {case})
24 ชม.ล่าสุด: ให้นม {n} ครั้ง ล่าสุด {last_feed} · ผ้าอ้อม ล่าสุด {last_diaper} · นอน {sleep_total}
อยากปรึกษาต่อ:
```

---

## 7. Deploy & config

| ส่วน                       | ที่ไหน                                  | config                                                                                                                                 |
| -------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend                   | Vercel (static, root = repo root)       | `js/config.js` → `API_BASE_URL`                                                                                                        |
| Backend                    | Hugging Face Spaces (Docker, CPU basic) | Secrets: `OPENAI_API_KEY`, `OPENAI_MODEL`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID_TH`, `ELEVENLABS_VOICE_ID_EN`, `ALLOWED_ORIGINS` |
| PANNs checkpoint (~300 MB) | download ตอน build Docker image         | ห้าม commit                                                                                                                            |

`ALLOWED_ORIGINS` = Vercel domain, `http://127.0.0.1:4175` (เฉพาะ origin ตรงตัว ไม่มี wildcard)

Submission (hub.team1.network): GitHub repo (public ✅) · demo = Vercel URL · pitch deck = Google Drive (Anyone with link) · Tech stack ต้องใส่ **ElevenLabs** และ **U-Bot**

---

## 8. แผนเวลา

| ชม.   | Dev (+ agent)                                          | Designer                         | Business                                         |
| ----- | ------------------------------------------------------ | -------------------------------- | ------------------------------------------------ |
| 0–3   | backend skeleton, `ml/` download + embeddings          | UI จาก wireframe → hi-fi         | ลงทะเบียน Hub, รับ ElevenLabs coupon, OpenAI key |
| 3–6   | train 6/9 คลาส, `/analyze` ใช้งานได้                   | หน้า result 4 กรณี               | เขียน `knowledge/advice/*` TH/EN                 |
| 6–10  | LLM + TTS + lullabies, deploy HF                       | lullaby player, U-bot handoff UI | หาคลิปร้องจริงสำหรับ demo                        |
| 10–16 | ต่อ frontend ↔ backend, deploy Vercel → **submit v1**  | screenshots                      | pitch deck v1                                    |
| 16–22 | tune threshold, U-bot B/C/D                            | polish                           | ซ้อม pitch                                       |
| 22–24 | freeze — แก้ bug เท่านั้น, **submit final ก่อน 14:00** |                                  |                                                  |

**ตัดเมื่อไม่ทัน (บนสุดตัดก่อน):** U-bot B/C/D → คลาส 7–9 → ภาษาอังกฤษ → ปุ่มแตะ `close` → เพลงกล่อม
**ห้ามตัด:** อัดเสียง → `/analyze` → ผล + % → เสียงคำแนะนำ → ปุ่ม U-bot (A)

---

## 9. ความเสี่ยง

| ความเสี่ยง             | รับมือ                                                               |
| ---------------------- | -------------------------------------------------------------------- |
| ความแม่นของสาเหตุ ~70% | 4 กรณี + activity priors + disclaimer "ไม่ใช่การวินิจฉัยทางการแพทย์" |
| ห้องแข่งเสียงดัง       | upload คลิปตัวอย่างระหว่าง pitch                                     |
| Safari อัดเป็น mp4     | backend decode ผ่าน ffmpeg ทุก format                                |
| HF Space cold start    | เรียก `/health` 5 นาทีก่อน pitch                                     |
| ElevenLabs/OpenAI ล่ม  | fallback ข้อความจาก advice ไฟล์, ไม่มีเสียงก็ยังใช้ได้               |
| ไมค์ต้องใช้ HTTPS      | Vercel เป็น HTTPS อยู่แล้ว; local ใช้ `127.0.0.1`                    |
