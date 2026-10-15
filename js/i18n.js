import th from './lang/th.js';
import en from './lang/en.js';

const DICT = { th, en };
const STORAGE_KEY = 'lang';
const DEFAULT_LANG = 'th';

export const LANGS = ['th', 'en'];
export const CLASSES = [
  'hungry', 'hug', 'awake', 'uncomfortable', 'sleepy',
  'diaper', 'belly_pain', 'burping', 'cold_hot',
];
export const ACTIVITY_TYPES = ['feed', 'diaper', 'sleep', 'play', 'soothe', 'other'];

const WEEKDAYS = {
  th: ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

let lang = readStoredLang();
document.documentElement.lang = lang;

function readStoredLang() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return LANGS.includes(stored) ? stored : DEFAULT_LANG;
  } catch (e) {
    return DEFAULT_LANG;
  }
}

export const getLang = () => lang;

export function setLang(next) {
  if (!LANGS.includes(next)) return;
  lang = next;
  document.documentElement.lang = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch (e) {
    // Persisting the language is optional.
  }
}

// t('r_close', { a: 'x', b: 'y' }); optional 3rd arg overrides the active language.
export function t(key, vars, forLang = lang) {
  const text = DICT[forLang]?.[key] ?? DICT[DEFAULT_LANG][key] ?? key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => String(vars[name] ?? match));
}

// Class label (hungry, sleepy, ...). Unknown classes fall back to the raw key.
export function label(cls, forLang = lang) {
  return DICT[forLang]?.[`cls_${cls}`] ?? String(cls);
}

export function activityLabel(type) {
  return ACTIVITY_TYPES.includes(type) ? t(`act_${type}`) : String(type);
}

export const weekdays = () => WEEKDAYS[lang];

// Full date for screen readers; `day` is a Date at 05:00Z (noon Bangkok), hence the UTC zone.
export function fullDate(day) {
  const locale = lang === 'th' ? 'th-u-ca-gregory' : 'en-GB';
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(day);
}
