// Activity log (localStorage) + helpers that turn it into analyze context.
const STORAGE_KEY = 'baby-activities';
const TIMEZONE = 'Asia/Bangkok';
const MS_PER_MIN = 60000;
const DAY_MS = 24 * 60 * MS_PER_MIN;
// Entries logged a little in the future still count as "just now".
const FUTURE_SLACK_MS = 60 * MS_PER_MIN;
// An end earlier than the start is only valid as an overnight entry (e.g. sleep 22:30-06:30).
const MAX_OVERNIGHT_MS = 12 * 60 * MS_PER_MIN;

const LEGACY_TYPES = {
  'ให้นม': 'feed',
  'เปลี่ยนผ้าอ้อม': 'diaper',
  'นอน': 'sleep',
  'เล่น': 'play',
  'อุ้มปลอบ': 'soothe',
  'อื่น ๆ': 'other',
};

const dateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});
const timeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export const dateKey = (date) => dateFormat.format(date);
export const currentTime = () => timeFormat.format(new Date());

function persist(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    return false;
  }
}

const migrate = (entry) =>
  LEGACY_TYPES[entry.activity] ? { ...entry, activity: LEGACY_TYPES[entry.activity] } : entry;

function load() {
  let raw = [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (Array.isArray(parsed)) raw = parsed.filter((item) => item && typeof item === 'object');
  } catch (e) {
    return [];
  }
  const migrated = raw.map(migrate);
  if (migrated.some((entry, i) => entry.activity !== raw[i].activity)) persist(migrated);
  return migrated;
}

let activities = load();

export const getActivities = () => activities;

// Returns false when storage is unavailable or full.
export function addActivity(entry) {
  const next = [...activities, entry];
  if (!persist(next)) return false;
  activities = next;
  return true;
}

function shiftDateKey(date, days) {
  const day = new Date(`${date}T12:00:00+07:00`);
  day.setUTCDate(day.getUTCDate() + days);
  return dateKey(day);
}

// Validates a new entry before saving. Overnight entries (end < start) that would end in the
// future are moved back one day ("last night"). Returns { entry } or { error: 'order' | 'future' }.
export function prepareEntry(entry, now = Date.now()) {
  const start = Date.parse(`${entry.date}T${entry.from}:00+07:00`);
  const end = Date.parse(`${entry.date}T${entry.to}:00+07:00`);
  if (Number.isNaN(start) || Number.isNaN(end)) return { error: 'order' };
  if (end >= start) return { entry };
  const nextDayEnd = end + DAY_MS;
  if (nextDayEnd - start > MAX_OVERNIGHT_MS) return { error: 'order' };
  if (nextDayEnd <= now + FUTURE_SLACK_MS) return { entry };
  if (end > now + FUTURE_SLACK_MS) return { error: 'future' }; // still in the future after rolling back
  return { entry: { ...entry, date: shiftDateKey(entry.date, -1) } };
}

// { start, end } in epoch ms, or null if the entry has no valid time. to < from = overnight.
export function entrySpan(entry) {
  const start = Date.parse(`${entry.date}T${entry.from}:00+07:00`);
  let end = Date.parse(`${entry.date}T${entry.to}:00+07:00`);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  if (end < start) end += DAY_MS;
  return { start, end };
}

function minutesSinceLast(type, now, list) {
  const ends = list
    .filter((entry) => entry.activity === type)
    .map(entrySpan)
    .filter(Boolean)
    .map((span) => span.end)
    .filter((end) => end <= now + FUTURE_SLACK_MS);
  if (!ends.length) return null;
  return Math.max(0, Math.round((now - Math.max(...ends)) / MS_PER_MIN));
}

export function buildContext(now = Date.now(), list = activities) {
  return {
    last_feed_min: minutesSinceLast('feed', now, list),
    last_diaper_min: minutesSinceLast('diaper', now, list),
    last_sleep_end_min: minutesSinceLast('sleep', now, list),
  };
}

function overlapMinutes(span, from, to) {
  return Math.max(0, Math.min(span.end, to) - Math.max(span.start, from)) / MS_PER_MIN;
}

// Summary of the last 24 h for the U-bot prompt.
export function stats24h(now = Date.now(), list = activities) {
  const from = now - DAY_MS;
  let feeds = 0;
  let sleepMin = 0;
  for (const entry of list) {
    const span = entrySpan(entry);
    if (!span) continue;
    if (entry.activity === 'feed' && span.end >= from && span.end <= now + FUTURE_SLACK_MS) feeds += 1;
    if (entry.activity === 'sleep') sleepMin += overlapMinutes(span, from, now);
  }
  const context = buildContext(now, list);
  return {
    feeds,
    lastFeedMin: context.last_feed_min,
    lastDiaperMin: context.last_diaper_min,
    sleepMin: Math.round(sleepMin),
  };
}
