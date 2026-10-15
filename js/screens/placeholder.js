import { h } from '../dom.js';
import { t } from '../i18n.js';

function placeholder(titleKey) {
  return {
    title: titleKey,
    nav: true,
    lang: true,
    render(app) {
      app.content.append(h('h2', { class: 'page-title' }, t(titleKey)));
    },
  };
}

export const development = placeholder('nav_dev');
export const doctor = placeholder('nav_doc');
