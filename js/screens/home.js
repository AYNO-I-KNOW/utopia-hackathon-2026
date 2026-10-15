import { h, svg } from '../dom.js';
import { t } from '../i18n.js';
import { pickAudio } from '../upload.js';
import { openLullabySheet } from '../lullaby.js';

const MIC_PATHS = '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>';

export default {
  title: 'title_analyze',
  nav: true,
  lang: true,
  contentClass: 'home-content',
  render(app) {
    const mic = h('button', { type: 'button', class: 'mic', 'aria-label': t('home_mic'), onclick: () => app.startRecord() },
      svg(MIC_PATHS, 32, 1.7));
    const extras = h('div', { class: 'home-extra' },
      h('button', { type: 'button', class: 'secondary', onclick: () => pickAudio(app) }, t('upload_file')),
      h('button', { type: 'button', class: 'secondary', onclick: openLullabySheet }, t('lull_btn')));
    app.content.append(h('div', { class: 'center' },
      h('h2', { class: 'page-title' }, t('home_h1')),
      h('p', null, t('home_sub')),
      h('div', { class: 'home-action' }, mic, h('p', null, t('home_tap')), extras)));
  },
};
