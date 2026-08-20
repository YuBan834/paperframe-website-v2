/* ───────── Module Namespace ───────── */
// Must be initialized early so module files can register themselves
window.Modules = window.Modules || {};

/* ───────── DOM Helpers ───────── */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function createEl(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') el.className = v;
    else if (k === 'textContent') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') {
      for (const [property, value] of Object.entries(v)) {
        if (property.startsWith('--')) el.style.setProperty(property, value);
        else el.style[property] = value;
      }
    }
    else el.setAttribute(k, v);
  }
  for (const child of children) {
    if (typeof child === 'string') el.appendChild(document.createTextNode(child));
    else if (child) el.appendChild(child);
  }
  return el;
}

/* ───────── i18n ───────── */
let currentLang = localStorage.getItem('lang') || DEFAULT_SETTINGS.lang;

function t(key) {
  const lang = currentLang === 'en' ? 'en' : 'zh';
  const val = I18N[lang][key];
  return val !== undefined ? val : key;
}

function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
}

function tFor(lang, key) {
  const val = I18N[lang][key];
  return val !== undefined ? val : key;
}

/* ───────── Storage ───────── */
function loadSetting(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}

function saveSetting(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* quota exceeded, ignore */ }
}

/* ───────── Animation Helpers ───────── */
function animateEl(el, keyframes, duration, easing = 'ease', fill = 'forwards') {
  return el.animate(keyframes, { duration, easing, fill });
}

function fadeIn(el, duration = 250) {
  el.style.opacity = '0';
  el.style.display = '';
  return animateEl(el, [{ opacity: 0 }, { opacity: 1 }], duration);
}

function fadeOut(el, duration = 250) {
  return animateEl(el, [{ opacity: 1 }, { opacity: 0 }], duration)
    .finished.then(() => { el.style.display = 'none'; });
}

function scaleIn(el, duration = 250, easing = 'cubic-bezier(0.34, 1.56, 0.64, 1)') {
  el.style.opacity = '0';
  el.style.transform = 'scale(0.8)';
  el.style.display = '';
  return animateEl(el, [
    { opacity: 0, transform: 'scale(0.8)' },
    { opacity: 1, transform: 'scale(1)' }
  ], duration, easing);
}

function scaleOut(el, duration = 200) {
  return animateEl(el, [
    { opacity: 1, transform: 'scale(1)' },
    { opacity: 0, transform: 'scale(0.9)' }
  ], duration, 'ease-in').finished.then(() => { el.style.display = 'none'; });
}

/* ───────── Physics / Spring ───────── */
function springTo(from, to, stiffness = 0.3, damping = 0.7) {
  let velocity = 0;
  let current = from;
  return function step() {
    const force = (to - current) * stiffness;
    velocity = (velocity + force) * damping;
    current += velocity;
    if (Math.abs(current - to) < 0.01 && Math.abs(velocity) < 0.01) {
      return { done: true, value: to };
    }
    return { done: false, value: current };
  };
}

/* ───────── Distance ───────── */
function dist(x1, y1, x2, y2) {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

/* ───────── Clamp ───────── */
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/* ───────── Debounce ───────── */
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/* ───────── Random ───────── */
function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* ───────── Event Bus ───────── */
const EventBus = {
  _listeners: {},
  on(event, fn) {
    (this._listeners[event] = this._listeners[event] || []).push(fn);
    return () => this.off(event, fn);
  },
  off(event, fn) {
    const list = this._listeners[event];
    if (list) this._listeners[event] = list.filter(f => f !== fn);
  },
  emit(event, data) {
    (this._listeners[event] || []).forEach(fn => fn(data));
  },
};
