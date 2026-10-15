// Presentational pieces of the result screen. Text always goes through h() (textContent).
import { h } from '../dom.js';
import { t, label } from '../i18n.js';
import { toPercent } from '../api.js';

const ASK = {
  last_feed: { question: 'ask_feed', field: 'last_feed_min' },
  last_diaper: { question: 'ask_diaper', field: 'last_diaper_min' },
};
// [label key, minutes sent as context]
const ASK_OPTIONS = [['ask_lt1', 30], ['ask_1_3', 120], ['ask_gt3', 240]];

export function headline(data) {
  const [first, second] = data.top;
  if (data.case === 'no_cry') return t('r_no_cry');
  if (data.case === 'confident' && first) return t('r_confident', { x: label(first.label) });
  if (data.case === 'close' && first && second) {
    return t('r_close', { a: label(first.label), b: label(second.label) });
  }
  return t('r_unsure');
}

export function confidenceTag(data) {
  if (data.case !== 'confident' || !data.top[0]) return null;
  return h('div', { class: 'tag' }, t('r_confidence', { n: toPercent(data.top[0].prob) }));
}

// Tap-to-answer chips for case=close. onAnswer(contextField, minutes).
export function askCard(data, onAnswer) {
  if (data.case !== 'close') return null;
  const groups = data.ask.filter((key) => ASK[key]).map((key) => {
    const { question, field } = ASK[key];
    const options = ASK_OPTIONS.map(([optionKey, minutes]) =>
      h('button', { type: 'button', onclick: () => onAnswer(field, minutes) }, t(optionKey)));
    return h('div', { class: 'chip-group', role: 'group', 'aria-label': t(question) },
      h('p', null, t(question)),
      h('div', { class: 'chips' }, ...options));
  });
  if (!groups.length) return null;
  return h('div', { class: 'card' }, h('h2', null, t('ask_title')), ...groups);
}

export function topCard(data) {
  if (!data.top.length) return null;
  const rows = data.top.map((item) => {
    const percent = toPercent(item.prob);
    return h('li', { class: 'prob-row' },
      h('span', null, label(item.label)),
      h('b', null, `${percent}%`),
      h('span', { class: 'prob-bar', 'aria-hidden': 'true' }, h('i', { style: { '--p': `${percent}%` } })));
  });
  return h('div', { class: 'card' }, h('h2', null, t('r_top')), h('ul', { class: 'prob-list' }, ...rows));
}

export function summaryCard(data, listenButton) {
  if (!data.summary) return null;
  return h('div', { class: 'card' },
    h('h2', null, t('r_advice')),
    h('p', null, data.summary),
    h('div', { class: 'card-action' }, listenButton));
}

export function checklistCard(data) {
  if (!data.checklist.length) return null;
  return h('div', { class: 'card' },
    h('h2', null, t('r_check')),
    h('ul', { class: 'check-list' }, ...data.checklist.map((item) => h('li', null, item))));
}

export function doctorCard(data) {
  if (!data.see_doctor) return null;
  return h('div', { class: 'card warn', role: 'alert' },
    h('h2', null, t('r_doctor_title')),
    h('p', null, t('r_doctor_body')));
}

export function lullabyCard(data, onOpen) {
  if (!data.suggest_lullaby) return null;
  return h('div', { class: 'card highlight' },
    h('h2', null, t('r_lullaby_title')),
    h('p', null, t('r_lullaby_body')),
    h('div', { class: 'card-action' },
      h('button', { type: 'button', class: 'secondary', onclick: onOpen }, `🎵 ${t('r_lullaby_btn')}`)));
}
