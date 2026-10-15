// Audio file picker (alternative to recording). Uses the static #file-input in index.html.
import { $ } from './dom.js';
import { MAX_UPLOAD_MB } from './config.js';
import { t } from './i18n.js';
import { dialog } from './ui.js';
import { startAnalysis } from './screens/loading.js';

const BYTES_PER_MB = 1024 * 1024;

function handleFile(app, file) {
  if (file.size > MAX_UPLOAD_MB * BYTES_PER_MB) {
    dialog({
      title: t('up_big_title'),
      body: t('up_big', { n: MAX_UPLOAD_MB }),
      actions: [{ label: t('ok'), primary: true }],
    });
    return;
  }
  startAnalysis(app, file);
}

// Must be called from a user gesture (click handler).
export function pickAudio(app) {
  const input = $('#file-input');
  input.onchange = () => {
    const file = input.files?.[0];
    input.value = '';
    if (file) handleFile(app, file);
  };
  input.click();
}
