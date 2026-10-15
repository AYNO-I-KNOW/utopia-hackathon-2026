// Shared chrome: dialog, bottom sheet, toast, language toggle, bottom nav.
import { $, h, svg } from './dom.js';
import { t, getLang, LANGS } from './i18n.js';

const FOCUSABLE = 'button:not([disabled]),[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';
const TOAST_MS = 3000;
const TOAST_LINK_MS = 8000;

let lastFocus = null;
let removeKeyHandler = null;
let onModalClose = null;
let toastTimer = 0;

export function closeModal() {
  const callback = onModalClose;
  onModalClose = null;
  removeKeyHandler?.();
  removeKeyHandler = null;
  $('#modal').replaceChildren();
  lastFocus?.focus?.();
  lastFocus = null;
  callback?.();
}

function trapFocus(box, onEscape) {
  const items = () => [...box.querySelectorAll(FOCUSABLE)];
  const onKey = (event) => {
    if (event.key === 'Escape') {
      onEscape();
      return;
    }
    if (event.key !== 'Tab') return;
    const list = items();
    if (!list.length) {
      event.preventDefault();
      box.focus();
      return;
    }
    const first = list[0];
    const last = list[list.length - 1];
    const active = document.activeElement;
    const outside = !box.contains(active) || active === box;
    if (event.shiftKey && (outside || active === first)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (outside || active === last)) {
      event.preventDefault();
      first.focus();
    }
  };
  // Focus can never rest behind the modal (e.g. after clicking the overlay).
  const onFocusIn = (event) => {
    if (!box.contains(event.target)) (items()[0] ?? box).focus();
  };
  document.addEventListener('keydown', onKey);
  document.addEventListener('focusin', onFocusIn);
  removeKeyHandler = () => {
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('focusin', onFocusIn);
  };
}

// Keeps focus inside the modal when the backdrop is pressed.
const keepFocus = (overlay) => (event) => {
  if (event.target === overlay) event.preventDefault();
};

// actions: [{ label, primary?, focus?, onClick? }]. First action = safe/cancel (also used for Escape).
// Initial focus goes to the action marked focus, else the first (non-destructive) one.
export function dialog({ title, body, actions }) {
  closeModal();
  lastFocus = document.activeElement;
  const run = (action) => {
    closeModal();
    action.onClick?.();
  };
  const buttons = actions.map((action) =>
    h('button', { type: 'button', class: action.primary ? 'primary' : '', onclick: () => run(action) }, action.label));
  const box = h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dialog-title', tabindex: '-1' },
    h('h2', { id: 'dialog-title' }, title),
    h('p', null, body),
    h('div', { class: 'actions' }, ...buttons));
  const overlay = h('div', { class: 'overlay' }, box);
  overlay.addEventListener('mousedown', keepFocus(overlay));
  $('#modal').append(overlay);
  trapFocus(box, () => run(actions[0]));
  const focusIndex = Math.max(0, actions.findIndex((action) => action.focus));
  (buttons[focusIndex] ?? box).focus();
}

export function sheet({ title, children, onClose }) {
  closeModal();
  lastFocus = document.activeElement;
  onModalClose = onClose ?? null;
  const closeButton = h('button', { type: 'button', class: 'sheet-close', 'aria-label': t('close'), onclick: closeModal }, '✕');
  const box = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sheet-title', tabindex: '-1' },
    h('div', { class: 'sheet-head' }, h('h2', { id: 'sheet-title' }, title), closeButton),
    ...children);
  const overlay = h('div', {
    class: 'overlay overlay-sheet',
    onclick: (event) => { if (event.target === overlay) closeModal(); },
  }, box);
  overlay.addEventListener('mousedown', keepFocus(overlay));
  $('#modal').append(overlay);
  trapFocus(box, closeModal);
  closeButton.focus();
}

// link: optional { href, label } shown after the message (toast then stays longer and is tappable).
export function toast(message, link) {
  const el = $('#toast');
  const nodes = [message];
  if (link) nodes.push(' ', h('a', { href: link.href, target: '_blank', rel: 'noopener' }, link.label));
  el.replaceChildren(...nodes);
  el.classList.toggle('has-link', Boolean(link));
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), link ? TOAST_LINK_MS : TOAST_MS);
}

export function langToggle(onSelect) {
  const buttons = LANGS.map((code) =>
    h('button', { type: 'button', 'aria-pressed': String(code === getLang()), onclick: () => onSelect(code) }, code.toUpperCase()));
  return h('div', { class: 'lang-toggle', role: 'group', 'aria-label': t('lang') }, ...buttons);
}

const NAV_ITEMS = [
  ['timeline', 'nav_home', '<path d="m3 10 9-7 9 7v10H3z M9 20v-7h6v7"/>'],
  ['development', 'nav_dev', '<path d="M4 20V12M10 20V8M16 20V4M22 20H2"/>'],
  ['home', 'nav_analyze', '<path d="M3 10v4M7 6v12M12 3v18M17 7v10M21 10v4"/>'],
  ['doctor', 'nav_doc', '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>'],
];

export function navbar(active, onSelect) {
  const buttons = NAV_ITEMS.map(([id, key, paths]) =>
    h('button', {
      type: 'button',
      class: active === id ? 'active' : '',
      'aria-current': active === id ? 'page' : null,
      onclick: () => onSelect(id),
    }, svg(paths), h('span', null, t(key))));
  return h('nav', { 'aria-label': t('nav_main') }, ...buttons);
}
