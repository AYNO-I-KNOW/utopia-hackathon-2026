// Backend client (ARCHITECTURE §3). API_BASE_URL === '' -> mock mode, no network.
import { API_BASE_URL } from './config.js';
import { t } from './i18n.js';

const ANALYZE_TIMEOUT_MS = 20000;
const SPEAK_TIMEOUT_MS = 15000;
const HEALTH_TIMEOUT_MS = 20000;
const MOCK_DELAY_MS = 1200;
const CASES = ['confident', 'close', 'unsure', 'no_cry'];
const MOCK_MODE = API_BASE_URL === '';

class ApiError extends Error {}

export const toPercent = (prob) => Math.round(Math.min(1, Math.max(0, Number(prob) || 0)) * 100);

function httpMessage(status) {
  if (status === 400) return t('err_bad_audio');
  if (status === 413) return t('err_too_large');
  return t('err_server');
}

function failureMessage(err) {
  if (err?.name === 'AbortError') return t('err_timeout');
  if (err instanceof SyntaxError) return t('err_server');
  return t('err_network');
}

async function request(path, options, timeoutMs, readBody) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, { ...options, signal: controller.signal });
    if (!res.ok) throw new ApiError(httpMessage(res.status));
    return await readBody(res);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(failureMessage(err));
  } finally {
    clearTimeout(timer);
  }
}

const asArray = (value) => (Array.isArray(value) ? value : []);

// Never trust the response shape: the UI renders exactly what this returns.
function normalize(data) {
  if (!data || !CASES.includes(data.case)) throw new ApiError(t('err_server'));
  return {
    case: data.case,
    cry_prob: Number(data.cry_prob) || 0,
    top: asArray(data.top)
      .filter((item) => item && typeof item.label === 'string')
      .map((item) => ({ label: item.label, prob: Number(item.prob) || 0 }))
      .slice(0, 3),
    ask: asArray(data.ask).filter((key) => typeof key === 'string'),
    summary: typeof data.summary === 'string' ? data.summary : '',
    checklist: asArray(data.checklist).filter((item) => typeof item === 'string'),
    suggest_lullaby: data.suggest_lullaby === true,
    see_doctor: data.see_doctor === true,
  };
}

function audioFilename(blob) {
  if (blob.name) return blob.name;
  const type = blob.type || '';
  const ext = type.includes('webm') ? 'webm' : type.includes('mp4') ? 'mp4' : type.includes('wav') ? 'wav' : 'bin';
  return `recording.${ext}`;
}

export async function analyze(blob, lang, context) {
  if (MOCK_MODE) return mockAnalyze(lang, context);
  const form = new FormData();
  form.append('audio', blob, audioFilename(blob));
  form.append('lang', lang);
  form.append('context', JSON.stringify(context ?? {}));
  const data = await request('/analyze', { method: 'POST', body: form }, ANALYZE_TIMEOUT_MS, (res) => res.json());
  return normalize(data);
}

// Resolves to an audio Blob, or null when no audio is available (mock mode).
export async function speak(text, lang) {
  if (MOCK_MODE) return null;
  const options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, lang }),
  };
  return request('/speak', options, SPEAK_TIMEOUT_MS, (res) => res.blob());
}

export async function health() {
  if (MOCK_MODE) return { ok: true, model_loaded: false, mock: true };
  return request('/health', {}, HEALTH_TIMEOUT_MS, (res) => res.json());
}

// ---- Mock mode -------------------------------------------------------------

const PROBS = {
  confident: [['hungry', 0.72], ['sleepy', 0.18], ['diaper', 0.05]],
  close: [['hungry', 0.41], ['sleepy', 0.36], ['hug', 0.12]],
  unsure: [['uncomfortable', 0.33], ['hungry', 0.27], ['sleepy', 0.21]],
  no_cry: [],
};

const MOCK_TEXT = {
  th: {
    confident: {
      summary: 'น้องน่าจะหิว ลองสังเกตการดูดมือ แล้วให้นมดูนะคะ',
      checklist: ['สังเกตการดูดมือหรือหันหาเต้า', 'เช็กเวลาให้นมครั้งล่าสุด', 'ถ้ายังร้อง ลองเช็กผ้าอ้อม'],
    },
    close: {
      summary: 'น้องอาจหิวหรือง่วง ลองบอกเวลาให้นมและเปลี่ยนผ้าอ้อมล่าสุด เพื่อให้แม่นขึ้นนะคะ',
      checklist: ['เช็กเวลาให้นมครั้งล่าสุด', 'เช็กผ้าอ้อม', 'ลดแสงและเสียงรอบตัว'],
    },
    unsure: {
      summary: 'ยังบอกสาเหตุไม่ได้ชัดเจน ลองเช็กทีละอย่าง และลองเปิดเพลงกล่อมดูนะคะ',
      checklist: ['เช็กผ้าอ้อม', 'เช็กว่าร้อนหรือหนาวเกินไปไหม', 'ลองอุ้มและเปิดเพลงกล่อม'],
    },
    no_cry: {
      summary: 'ไม่ได้ยินเสียงร้องชัดเจน ลองอัดใหม่ในที่เงียบ และวางโทรศัพท์ใกล้ลูกมากขึ้นนะคะ',
      checklist: [],
    },
  },
  en: {
    confident: {
      summary: 'Your baby is probably hungry. Look for hand-sucking, then try a feed.',
      checklist: ['Look for hand-sucking or rooting', 'Check when the last feed was', 'If still crying, check the diaper'],
    },
    close: {
      summary: 'It could be hunger or sleepiness. Tell us the last feed and diaper times for a better guess.',
      checklist: ['Check when the last feed was', 'Check the diaper', 'Dim the lights and reduce noise'],
    },
    unsure: {
      summary: 'The cause is not clear yet. Check one thing at a time and try a lullaby.',
      checklist: ['Check the diaper', 'Check if it is too hot or cold', 'Try holding and a lullaby'],
    },
    no_cry: {
      summary: 'No clear crying heard. Record again in a quiet place, closer to your baby.',
      checklist: [],
    },
  },
};

let mockIndex = 0;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function buildMock(kind, lang, context) {
  const text = (MOCK_TEXT[lang] ?? MOCK_TEXT.th)[kind];
  const known = (key) => context?.[`${key}_min`] != null;
  return {
    case: kind,
    cry_prob: kind === 'no_cry' ? 0.04 : 0.97,
    top: PROBS[kind].map(([label, prob]) => ({ label, prob })),
    ask: kind === 'close' ? ['last_feed', 'last_diaper'].filter((key) => !known(key)) : [],
    summary: text.summary,
    checklist: text.checklist,
    suggest_lullaby: kind === 'unsure',
    see_doctor: false,
  };
}

async function mockAnalyze(lang, context) {
  await sleep(MOCK_DELAY_MS);
  if (context?.last_feed_min != null) return buildMock('confident', lang, context);
  const kind = CASES[mockIndex % CASES.length];
  mockIndex += 1;
  return buildMock(kind, lang, context);
}
