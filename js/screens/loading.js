import { h } from '../dom.js';
import { t, getLang } from '../i18n.js';
import { analyze } from '../api.js';
import { buildContext } from '../activities.js';
import { dialog } from '../ui.js';

let runId = 0;

// Entry point for a fresh analysis (recording or uploaded file).
export function startAnalysis(app, blob) {
  Object.assign(app.state, { blob, answers: {}, result: null, saved: false });
  app.go('loading');
}

async function run(app) {
  runId += 1;
  const id = runId;
  const { state } = app;
  const context = { ...buildContext(), ...state.answers };
  try {
    const data = await analyze(state.blob, getLang(), context);
    if (id !== runId) return;
    state.result = { data };
    app.go('result');
  } catch (err) {
    if (id !== runId) return;
    dialog({
      title: t('err_title'),
      body: err.message,
      actions: [
        { label: t('back'), onClick: () => app.go('home') },
        { label: t('retry'), primary: true, focus: true, onClick: () => run(app) },
      ],
    });
  }
}

export default {
  title: 'title_analyze',
  header: false,
  footer: false,
  contentClass: 'loading-content',
  render(app) {
    app.content.append(h('div', { class: 'center', role: 'status' },
      h('div', { class: 'spinner' }),
      h('h1', null, t('loading_h1'))));
    run(app);
  },
  leave() {
    runId += 1; // ignore any response still in flight
  },
};
