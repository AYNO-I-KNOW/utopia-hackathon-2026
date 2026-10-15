// Tiny DOM helpers. Never feed API/user data to innerHTML; use h() instead.

export const $ = (selector, root = document) => root.querySelector(selector);

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

function setAttr(el, key, value) {
  if (value == null) return;
  if (key.startsWith('on') && typeof value === 'function') {
    el.addEventListener(key.slice(2), value);
  } else if (key === 'class') {
    el.className = value;
  } else if (key === 'style') {
    for (const [name, v] of Object.entries(value)) el.style.setProperty(name, v);
  } else if (typeof value === 'boolean') {
    el[key] = value;
  } else {
    el.setAttribute(key, value);
  }
}

function appendChildren(el, children) {
  for (const child of children) {
    if (child == null || child === false) continue;
    if (Array.isArray(child)) appendChildren(el, child);
    else if (child instanceof Node) el.append(child);
    else el.append(document.createTextNode(String(child)));
  }
}

// h('button', { class: 'primary', onclick: fn }, 'text', otherNode)
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {})) setAttr(el, key, value);
  appendChildren(el, children);
  return el;
}

// Static, developer-written SVG path markup only.
export function svg(paths, size = 23, strokeWidth = 1.6) {
  const template = document.createElement('template');
  template.innerHTML =
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  return template.content.firstElementChild;
}
