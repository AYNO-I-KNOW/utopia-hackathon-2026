import { h, svg } from '../dom.js';
import { t } from '../i18n.js';
import { REC_MIN_SEC } from '../config.js';
import { startRecorder, createAudioContext } from '../recorder.js';
import { dialog } from '../ui.js';
import { pickAudio } from '../upload.js';
import { startAnalysis } from './loading.js';

const BAR_COUNT = 40;
const MIN_SCALE = 0.09;
const CHECK_PATH = '<path d="m5 12 4 4L19 6"/>';
const ERROR_KEYS = {
  insecure: 'rec_err_insecure',
  unsupported: 'rec_err_unsupported',
  denied: 'rec_err_denied',
  nomic: 'rec_err_nomic',
};

let recorder = null;
let session = 0;
let timerId = 0;
let startedAt = 0;
let finishing = false;
let exitOpen = false; // exit dialog showing: don't auto-stop underneath it
let limitPending = false;
let ui = {};

// Same bar pattern as the v1 wireframe, as a 0..1 factor.
const barShape = (i) => (18 + ((i * 37) % 75)) / 92;

function formatElapsed(total) {
  const sec = String(total % 60).padStart(2, '0');
  const min = String(Math.floor(total / 60) % 60).padStart(2, '0');
  const hours = Math.floor(total / 3600);
  return hours ? `${String(hours).padStart(2, '0')}:${min}:${sec}` : `${min}:${sec}`;
}

function paintLevel(level) {
  ui.bars.forEach((bar, i) => {
    const scale = Math.max(MIN_SCALE, level * barShape(i));
    bar.style.transform = `scaleY(${scale.toFixed(3)})`;
  });
}

function tick() {
  const seconds = Math.floor((performance.now() - startedAt) / 1000);
  const ready = seconds >= REC_MIN_SEC;
  ui.timer.textContent = formatElapsed(seconds);
  ui.confirm.disabled = !ready;
  ui.hint.hidden = ready;
}

function showError(app, err) {
  const body = t(ERROR_KEYS[err.code] ?? 'rec_err_failed');
  dialog({
    title: t('rec_err_title'),
    body,
    actions: [
      { label: t('back'), onClick: () => app.go('home') },
      { label: t('upload_file'), primary: true, focus: true, onClick: () => { app.go('home'); pickAudio(app); } },
    ],
  });
}

// The mic vanished mid-recording (unplugged, permission revoked, recorder error).
function micLost(app, id) {
  if (id !== session) return;
  session += 1; // also invalidates a start that has not finished yet
  clearInterval(timerId);
  recorder?.cancel();
  recorder = null;
  dialog({
    title: t('rec_lost_title'),
    body: t('rec_lost_body'),
    actions: [
      { label: t('back'), onClick: () => app.go('home') },
      { label: t('upload_file'), onClick: () => { app.go('home'); pickAudio(app); } },
      { label: t('retry'), primary: true, focus: true, onClick: () => app.startRecord() },
    ],
  });
}

function limitReached(app) {
  if (exitOpen) limitPending = true;
  else finish(app);
}

async function begin(app) {
  session += 1;
  const id = session;
  const audioContext = createAudioContext(); // sync: still inside the tap gesture
  try {
    const started = await startRecorder({
      audioContext,
      onLevel: paintLevel,
      onLimit: () => limitReached(app),
      onEnded: () => micLost(app, id),
    });
    if (id !== session) {
      started.cancel(); // user left while the permission prompt was open
      return;
    }
    recorder = started;
  } catch (err) {
    if (id === session) showError(app, err);
    return;
  }
  startedAt = performance.now();
  tick();
  timerId = setInterval(tick, 250);
}

async function finish(app) {
  if (finishing || !recorder) return;
  finishing = true;
  const id = session;
  clearInterval(timerId);
  const active = recorder;
  recorder = null;
  const blob = await active.stop();
  if (id !== session) return; // user left while the recorder was stopping
  if (blob.size === 0) {
    showError(app, { code: 'failed' });
    return;
  }
  startAnalysis(app, blob);
}

// Guard used by back button / history: `proceed` runs only if the user confirms leaving.
function confirmLeave(app, proceed) {
  if (finishing) return;
  exitOpen = true;
  dialog({
    title: t('rec_exit_title'),
    body: t('rec_exit_body'),
    actions: [
      {
        label: t('rec_continue'),
        onClick: () => {
          exitOpen = false;
          if (!limitPending) return;
          limitPending = false;
          finish(app); // the max length was reached while the dialog was open
        },
      },
      { label: t('rec_exit'), primary: true, onClick: () => { exitOpen = false; proceed(); } },
    ],
  });
}

export default {
  title: 'title_analyze',
  footer: false,
  contentClass: 'home-content',
  render(app) {
    finishing = false;
    exitOpen = false;
    limitPending = false;
    ui = {
      bars: Array.from({ length: BAR_COUNT }, () => h('i')),
      timer: h('div', { class: 'timer' }, '00:00'),
      hint: h('p', { class: 'note' }, t('rec_min', { n: REC_MIN_SEC })),
      confirm: h('button', {
        type: 'button', class: 'mic', disabled: true,
        'aria-label': t('rec_confirm'), onclick: () => finish(app),
      }, svg(CHECK_PATH, 34, 2)),
    };
    app.content.append(h('div', { class: 'center' },
      h('h2', { class: 'page-title' }, t('rec_h1')),
      h('p', null, t('rec_sub')),
      h('div', { class: 'wave', 'aria-hidden': 'true' }, ...ui.bars),
      ui.timer,
      h('p', null, t('rec_status')),
      ui.hint,
      h('div', { class: 'home-action' }, ui.confirm)));
    begin(app);
  },
  leave() {
    session += 1;
    exitOpen = false;
    limitPending = false;
    clearInterval(timerId);
    recorder?.cancel();
    recorder = null;
  },
  confirmLeave,
};
