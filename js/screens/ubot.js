import { h } from '../dom.js';
import { t, getLang } from '../i18n.js';
import { getActivities } from '../activities.js';
import { buildPrompt, copyAndOpen } from '../ubot.js';
import { UBOT_URL } from '../config.js';
import { toast } from '../ui.js';

const PROMPT_ROWS = 10;

async function handoff(button, promptBox) {
  button.disabled = true;
  const { opened, copied } = copyAndOpen(promptBox.value); // sync: stays inside the click gesture
  const ok = await copied;
  button.disabled = false;
  button.focus();
  if (opened) {
    toast(t(ok ? 'ubot_copied' : 'ubot_copy_failed'));
    return;
  }
  toast(t(ok ? 'ubot_blocked_copied' : 'ubot_blocked'), { href: UBOT_URL, label: t('ubot_open') });
}

export default {
  title: 'title_ubot',
  contentClass: 'ubot-content',
  render(app) {
    if (!app.state.result) {
      app.go('home');
      return;
    }
    const promptBox = h('textarea', { class: 'prompt-box', rows: String(PROMPT_ROWS), 'aria-label': t('ubot_label') });
    promptBox.value = buildPrompt(app.state.result.data, getActivities(), getLang());
    app.content.append(h('p', { class: 'note' }, t('ubot_note')), promptBox);
    const go = h('button', { type: 'button', class: 'primary', onclick: () => handoff(go, promptBox) }, t('ubot_go'));
    app.footer.append(go);
  },
  back(app) {
    app.go('result');
  },
};
