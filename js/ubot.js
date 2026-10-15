// U-bot handoff (ARCHITECTURE §6 option A): build prompt, copy, open U-bot.
import { UBOT_URL } from './config.js';
import { stats24h } from './activities.js';
import { toPercent } from './api.js';
import { t, label } from './i18n.js';

const MINUTES_PER_HOUR = 60;

function formatDuration(minutes, lang) {
  if (minutes == null) return t('p_none', null, lang);
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const rest = minutes % MINUTES_PER_HOUR;
  const parts = [];
  if (hours) parts.push(`${hours} ${t('dur_h', null, lang)}`);
  if (rest || !hours) parts.push(`${rest} ${t('dur_m', null, lang)}`);
  return parts.join(' ');
}

const formatAgo = (minutes, lang) =>
  minutes == null ? t('p_none', null, lang) : t('p_ago', { x: formatDuration(minutes, lang) }, lang);

export function buildPrompt(result, activities, lang) {
  const stats = stats24h(Date.now(), activities);
  const top = (result.top ?? []).slice(0, 2)
    .map((item) => `${label(item.label, lang)} ${toPercent(item.prob)}%`)
    .join(' / ');
  return [
    t('p_intro', null, lang),
    t('p_result', { list: top || '-', case: t(`case_${result.case}`, null, lang) }, lang),
    t('p_activity', {
      n: stats.feeds,
      feed: formatAgo(stats.lastFeedMin, lang),
      diaper: formatAgo(stats.lastDiaperMin, lang),
      sleep: formatDuration(stats.sleepMin, lang),
    }, lang),
    t('p_ask', null, lang),
  ].join('\n');
}

function copyWithSelection(text) {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  document.body.append(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (e) {
    ok = false;
  }
  area.remove();
  return ok;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    return copyWithSelection(text);
  }
}

// Call synchronously from a click handler: the tab is opened inside the user gesture and the
// clipboard write starts before focus moves to the new tab.
// Returns { opened: boolean (false = popup blocked), copied: Promise<boolean> }.
export function copyAndOpen(text) {
  const copied = copyText(text);
  // No 'noopener' feature: it makes window.open() return null, hiding popup blocking.
  const win = window.open(UBOT_URL, '_blank');
  if (win) win.opener = null;
  return { opened: Boolean(win), copied };
}
