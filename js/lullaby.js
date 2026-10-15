// Lullaby bottom sheet: one shared <audio>, play/pause, unavailable-file handling.
import { LULLABIES } from './config.js';
import { h } from './dom.js';
import { t, getLang } from './i18n.js';
import { sheet } from './ui.js';
import { pauseSpeech } from './speech.js';

const unavailable = new Set();
let audio = null;
let current = null;
let rows = [];

function getAudio() {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = 'none';
  audio.addEventListener('play', refresh);
  audio.addEventListener('pause', refresh);
  audio.addEventListener('ended', () => {
    current = null;
    refresh();
  });
  audio.addEventListener('error', () => {
    if (current) markUnavailable(current);
  });
  return audio;
}

function markUnavailable(src) {
  unavailable.add(src);
  if (current === src) {
    audio.pause();
    current = null;
  }
  refresh();
}

function refresh() {
  for (const { item, button } of rows) {
    const missing = unavailable.has(item.src);
    const playing = !missing && current === item.src && !audio.paused;
    button.disabled = missing;
    button.setAttribute('aria-pressed', String(playing));
    button.textContent = missing
      ? `${item.title} · ${t('lull_unavailable')}`
      : `${playing ? '⏸' : '▶'} ${item.title}`;
  }
}

function toggle(item) {
  const player = getAudio();
  if (current === item.src && !player.paused) {
    player.pause();
    return;
  }
  if (current !== item.src) {
    player.src = item.src;
    current = item.src;
  }
  player.play().catch((err) => {
    if (err?.name !== 'AbortError') markUnavailable(item.src);
  });
  refresh();
}

export function stopLullaby() {
  audio?.pause();
  current = null;
  rows = [];
}

export function openLullabySheet() {
  pauseSpeech();
  const items = LULLABIES[getLang()] ?? LULLABIES.th;
  rows = items.map((item) => ({
    item,
    button: h('button', { type: 'button', class: 'lullaby-item', onclick: () => toggle(item) }),
  }));
  const list = h('ul', { class: 'lullaby-list' }, ...rows.map(({ button }) => h('li', null, button)));
  sheet({
    title: t('lull_title'),
    children: [list, h('p', { class: 'note' }, t('lull_hint'))],
    onClose: stopLullaby,
  });
  refresh();
}
