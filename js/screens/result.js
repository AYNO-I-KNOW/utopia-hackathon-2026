import { h } from '../dom.js';
import { t, getLang } from '../i18n.js';
import { toPercent } from '../api.js';
import { dialog, toast } from '../ui.js';
import { mountSpeech, releaseSpeech } from '../speech.js';
import { openLullabySheet } from '../lullaby.js';
import * as cards from './result-cards.js';

// Pre-select the activity type that matches the predicted reason.
const TYPE_FOR_CLASS = { hungry: 'feed', diaper: 'diaper', sleepy: 'sleep', hug: 'soothe' };

function answer(app, field, minutes) {
  app.state.answers = { ...app.state.answers, [field]: minutes };
  app.go('loading'); // re-analyze the same audio with the extra context
}

function save(app) {
  const top = app.state.result.data.top[0];
  const draft = top
    ? { reason: top.label, confidence: toPercent(top.prob), type: TYPE_FOR_CLASS[top.label] ?? 'other' }
    : { reason: null, confidence: null, type: 'other' };
  app.beginActivity('result', draft);
}

function renderFooter(app) {
  const { saved } = app.state;
  app.footer.append(
    h('button', { type: 'button', onclick: () => app.go('ubot') }, t('r_ubot')),
    h('button', { type: 'button', class: 'primary', disabled: saved, onclick: () => save(app) },
      saved ? t('r_saved') : t('save')));
}

function renderBody(app, data, listen) {
  const { state } = app;
  return [
    h('div', { class: 'center' },
      h('div', { class: 'baby-image', role: 'img', 'aria-label': t('baby_img') }),
      h('h2', { class: 'page-title' }, cards.headline(data)),
      cards.confidenceTag(data)),
    cards.doctorCard(data),
    cards.askCard(data, (field, minutes) => answer(app, field, minutes)),
    cards.summaryCard(data, listen),
    cards.lullabyCard(data, openLullabySheet),
    cards.topCard(data),
    cards.checklistCard(data),
    h('div', { class: 'result-actions' },
      h('button', { type: 'button', class: 'secondary', onclick: openLullabySheet }, t('lull_btn'))),
    h('p', { class: 'note center' }, t('r_disclaimer')),
    state.saved ? h('div', { class: 'saved' }, t('r_saved')) : null,
    h('button', { type: 'button', class: 'block', onclick: () => app.startRecord() }, t('r_again')),
  ];
}

export default {
  title: 'title_analyze',
  live: true,
  render(app) {
    const { result } = app.state;
    if (!result) {
      app.go('home');
      return;
    }
    const listen = h('button', { type: 'button', class: 'secondary', disabled: true }, t('r_preparing'));
    app.content.append(...renderBody(app, result.data, listen).filter(Boolean));
    renderFooter(app);
    mountSpeech(listen, result, getLang(), toast);
  },
  leave() {
    releaseSpeech();
  },
  // Guard used by back button / history: `proceed` runs only if the user confirms leaving.
  confirmLeave(app, proceed) {
    if (app.state.saved) {
      proceed();
      return;
    }
    dialog({
      title: t('exit_title'),
      body: t('exit_body'),
      actions: [
        { label: t('exit_stay') },
        { label: t('exit_ok'), primary: true, onClick: proceed },
      ],
    });
  },
};
