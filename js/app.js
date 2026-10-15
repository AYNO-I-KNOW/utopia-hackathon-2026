// App shell: shared state, screen router, back button.
//
// A screen is { title?, header?, footer?, nav?, lang?, live?, contentClass?,
//               render(app), leave?(app), back?(app), confirmLeave?(app, proceed) }.
// confirmLeave guards leaving via the back button or browser history (not in-app go()).
import { $ } from './dom.js';
import { t, setLang } from './i18n.js';
import { dateKey, currentTime } from './activities.js';
import { navbar, langToggle, closeModal } from './ui.js';
import { health } from './api.js';
import { API_BASE_URL } from './config.js';
import home from './screens/home.js';
import record from './screens/record.js';
import loading from './screens/loading.js';
import result from './screens/result.js';
import ubot from './screens/ubot.js';
import activity from './screens/activity.js';
import timeline from './screens/timeline.js';
import { development, doctor } from './screens/placeholder.js';

const APP_NAME = 'Cry for ur MOM';
// Never restored from browser history: they would restart a recording / analysis.
const TRANSIENT = new Set(['loading', 'record']);

const screens = { home, record, loading, result, ubot, activity, timeline, development, doctor };

const content = $('#content');
const footer = $('#footer');
const header = $('.top');
const backButton = $('#back');
const titleEl = $('#title');
const langSlot = $('#lang-slot');

const state = {
  screen: null,
  blob: null, // audio being analyzed (recording or uploaded file)
  result: null, // { data, speech? } from analyze()
  answers: {}, // context answered via chips on the result screen
  saved: false,
  draft: null, // { reason, confidence, type } prefilled into the activity form
  activityFrom: 'timeline',
  today: dateKey(new Date()),
  selectedDate: dateKey(new Date()),
  draftTime: '',
};

const app = { state, content, footer, go, rerender, setLang: changeLang, startRecord, beginActivity };

function applyChrome(screen, id) {
  content.className = `content ${screen.contentClass ?? ''}`.trim();
  content.scrollTop = 0;
  content.replaceChildren();
  footer.replaceChildren();
  footer.className = `footer${screen.nav ? ' nav-footer' : ''}`;
  footer.style.display = screen.footer === false ? 'none' : 'flex';
  header.style.display = screen.header === false ? 'none' : 'flex';
  backButton.style.visibility = id === 'home' ? 'hidden' : 'visible';
  backButton.setAttribute('aria-label', t('back'));
  titleEl.textContent = screen.title ? t(screen.title) : '';
  langSlot.replaceChildren(...(screen.lang ? [langToggle(changeLang)] : []));
  if (screen.live) content.setAttribute('aria-live', 'polite');
  else content.removeAttribute('aria-live');
}

// Re-rendering the same screen replaces the history entry instead of adding one. So does the
// loading spinner (record/result -> loading -> result is a single entry); only an upload from
// home pushes it.
function historyMode(next, fromPop) {
  if (fromPop) return 'none';
  const from = state.screen;
  const replace = !from || next === from || from === 'loading' || (next === 'loading' && from !== 'home');
  return replace ? 'replace' : 'push';
}

function focusHeading(screen) {
  document.title = `${screen.title ? t(screen.title) : ''} · ${APP_NAME}`;
  if ($('#modal').children.length) return; // a dialog already took focus
  const target = screen.header === false ? content.querySelector('h1, h2') : titleEl;
  if (!target) return;
  target.tabIndex = -1;
  target.focus({ preventScroll: true });
}

function go(next, { fromPop = false } = {}) {
  const screen = screens[next];
  if (!screen) return;
  const mode = historyMode(next, fromPop);
  screens[state.screen]?.leave?.(app);
  closeModal();
  state.screen = next;
  if (mode === 'push') history.pushState({ screen: next }, '');
  else if (mode === 'replace') history.replaceState({ screen: next }, '');
  applyChrome(screen, next);
  screen.render(app);
  if (state.screen !== next) return; // render redirected elsewhere
  if (screen.nav) footer.append(navbar(next, go));
  focusHeading(screen);
}

// Navigation that respects the current screen's confirmLeave guard.
function navigate(next) {
  const screen = screens[state.screen];
  if (screen.confirmLeave) screen.confirmLeave(app, () => go(next));
  else go(next);
}

function rerender() {
  go(state.screen);
}

function changeLang(code) {
  setLang(code);
  rerender();
}

function startRecord() {
  Object.assign(state, { blob: null, result: null, answers: {}, saved: false });
  go('record');
}

// from: 'timeline' (+ button) or 'result' (save). draft prefills the form.
function beginActivity(from, draft = null) {
  state.activityFrom = from;
  state.draft = draft;
  state.selectedDate = dateKey(new Date());
  state.draftTime = currentTime();
  go('activity');
}

backButton.addEventListener('click', () => {
  const screen = screens[state.screen];
  if (screen.back) screen.back(app);
  else navigate('home');
});

window.addEventListener('popstate', (event) => {
  let target = event.state?.screen;
  if (!screens[target] || target === state.screen) return;
  if (TRANSIENT.has(target)) target = 'home';
  const current = screens[state.screen];
  if (!current.confirmLeave) {
    go(target, { fromPop: true });
    return;
  }
  history.pushState({ screen: state.screen }, ''); // undo the pop; stay until the user confirms
  current.confirmLeave(app, () => go(target));
});

if (API_BASE_URL) health().catch(() => {}); // wake the backend; failures surface on analyze
go('timeline');
