// The charm strip: draws the charms, runs the physics, and decides moment to moment
// whether the window should catch the mouse (over a charm) or let it through.
import { Charm, collide, hit } from './physics.js';
import { draw } from './art.js';
import { call, listen, native, currentWindow } from './api.js';
import { load, save } from './prefs.js';
import * as sound from './sound.js';

const canvas = document.getElementById('c');
const g = canvas.getContext('2d');
const menu = document.getElementById('menu');
const win = currentWindow();
const preview = !native;
if (preview) document.documentElement.classList.add('preview');

let prefs = load();
let charms = [];
let W = 0;
let H = 0;
let cursor = null; // {x, y} in strip coordinates, or null when it's away
let cursorV = { x: 0, y: 0 };
let held = null; // { index, dx, dy, startX, startY, at, moved }
let ignoring = null;
let running = false;
let quietSince = 0;
const states = new Map(); // per-charm drawing state: dice face, photo image, lantern
const TIMER_KEY = 'dangle:timer';
let timer = readTimer();

sound.setEnabled(prefs.sound);

// ---------- Layout
function resize() {
  const dpr = window.devicePixelRatio || 1;
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (const c of charms) c.anchor.x = anchorX(c.spec);
  wake();
}

const anchorX = (spec) => Math.min(W - 30, Math.max(30, spec.x * W));
const radius = (spec) => 26 * prefs.size * (spec.kind === 'hourglass' ? 1.1 : 1);

function build() {
  const old = new Map(charms.map((c) => [c.id, c]));
  charms = prefs.charms.map((spec) => {
    const prev = old.get(spec.id);
    const r = radius(spec);
    if (prev && prev.kind === spec.kind) {
      prev.spec = spec;
      prev.r = r;
      prev.anchor.x = anchorX(spec);
      prev.setLength(spec.len * prefs.size);
      return prev;
    }
    const c = new Charm({ id: spec.id, kind: spec.kind, x: anchorX(spec), len: spec.len * prefs.size, r });
    c.spec = spec;
    // Start a little to the side so new charms swing in instead of appearing still.
    c.body.px -= 6;
    if (!states.has(spec.id)) states.set(spec.id, { face: 1 + Math.floor(Math.random() * 6) });
    if (spec.kind === 'photo' && spec.photo) {
      const img = new Image();
      img.onload = wake;
      img.src = spec.photo;
      states.get(spec.id).img = img;
    }
    return c;
  });
  wake();
}

// ---------- Focus timer (the hourglass charm)
function readTimer() {
  try {
    return JSON.parse(localStorage.getItem(TIMER_KEY)) || { total: 0, endAt: 0, left: 0 };
  } catch {
    return { total: 0, endAt: 0, left: 0 };
  }
}
function writeTimer() {
  try {
    localStorage.setItem(TIMER_KEY, JSON.stringify(timer));
  } catch {}
}
const timerRunning = () => timer.endAt > Date.now();
function timerLeft() {
  if (timerRunning()) return timer.endAt - Date.now();
  return timer.left || 0;
}
function toggleTimer(minutes) {
  if (minutes) {
    timer = { total: minutes * 60000, endAt: Date.now() + minutes * 60000, left: 0 };
  } else if (timerRunning()) {
    timer = { ...timer, left: timer.endAt - Date.now(), endAt: 0 };
  } else if (timer.left > 1000) {
    timer = { ...timer, endAt: Date.now() + timer.left, left: 0 };
  } else {
    const total = prefs.focusMinutes * 60000;
    timer = { total, endAt: Date.now() + total, left: 0 };
  }
  writeTimer();
  wake();
}
let timerWasRunning = timerRunning();
function checkTimer() {
  const now = timerRunning();
  if (timerWasRunning && !now && !timer.left) {
    sound.done();
    for (const c of charms) if (c.kind === 'hourglass') c.kick(9);
    timer = { total: 0, endAt: 0, left: 0 };
    writeTimer();
    wake();
  }
  timerWasRunning = now;
}

// ---------- Drawing
function rope(c) {
  g.beginPath();
  const p = c.points;
  g.moveTo(p[0].x, p[0].y);
  for (let i = 1; i < p.length - 1; i++) {
    const mx = (p[i].x + p[i + 1].x) / 2;
    const my = (p[i].y + p[i + 1].y) / 2;
    g.quadraticCurveTo(p[i].x, p[i].y, mx, my);
  }
  g.lineTo(p[p.length - 1].x, p[p.length - 1].y);
  g.strokeStyle = 'rgba(40,36,60,0.55)';
  g.lineWidth = 2.4;
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = 1.2;
  g.stroke();
}

function paint(t) {
  g.clearRect(0, 0, W, H);
  for (const c of charms) {
    rope(c);
    const center = c.center();
    const s = states.get(c.id) || {};
    if (c.kind === 'hourglass') {
      const left = timerLeft();
      s.progress = timer.total ? left / timer.total : 1;
      s.running = timerRunning();
    }
    g.save();
    g.translate(center.x, center.y);
    g.rotate(c.angle());
    g.shadowColor = 'rgba(0,0,0,0.28)';
    g.shadowBlur = 8;
    g.shadowOffsetY = 3;
    // Ring the rope ties to.
    g.beginPath();
    g.arc(0, -c.r - 2, 3.2, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(230,226,240,0.95)';
    g.lineWidth = 1.6;
    g.stroke();
    draw(g, c.kind, c.r, s, t);
    g.restore();
    if (c.kind === 'hourglass' && (timerRunning() || timer.left) && cursor && hit([c], cursor.x, cursor.y, 14) === 0) {
      label(center.x, center.y + c.r + 16, fmt(timerLeft()));
    }
  }
}

function label(x, y, text) {
  g.font = '600 12px system-ui, -apple-system, Segoe UI, sans-serif';
  const w = g.measureText(text).width + 14;
  g.fillStyle = 'rgba(25,22,40,0.82)';
  g.beginPath();
  g.roundRect(x - w / 2, y - 10, w, 20, 10);
  g.fill();
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, x, y + 0.5);
}

const fmt = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// ---------- Simulation loop. It stops itself when everything is still, so an idle
// Dangle uses almost no CPU.
let last = 0;
function frame(now) {
  if (!running) return;
  const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
  last = now;
  const steps = 2;
  const h = dt / steps;
  let energy = 0;
  for (let s = 0; s < steps; s++) {
    for (let i = 0; i < charms.length; i++) {
      const c = charms[i];
      let grip = null;
      if (held && held.index === i && cursor) {
        // Can't pull a charm further than its rope reaches.
        const dx = cursor.x - held.dx - c.anchor.x;
        const dy = cursor.y - held.dy - c.anchor.y;
        const d = Math.hypot(dx, dy);
        const k = d > c.len ? c.len / d : 1;
        grip = { x: c.anchor.x + dx * k, y: Math.max(4, c.anchor.y + dy * k) };
      }
      c.step(h, { width: W, height: H, held: grip });
    }
    const bump = collide(charms);
    if (bump > 2.5) sound.clink(bump);
  }
  // Brushing past a charm nudges it.
  if (cursor && !held) {
    const speed = Math.hypot(cursorV.x, cursorV.y);
    if (speed > 30) {
      for (const c of charms) {
        const ctr = c.center();
        const d = Math.hypot(cursor.x - ctr.x, cursor.y - ctr.y);
        const reach = c.r * 2.4;
        if (d < reach) {
          const f = (1 - d / reach) * 0.25 * prefs.sway;
          c.push(cursorV.x * f, cursorV.y * f * 0.5, dt);
        }
      }
    }
  }
  for (const c of charms) energy += c.energy();
  paint(now / 1000);
  checkTimer();
  if (energy > 0.02 || held) quietSince = now;
  if (now - quietSince > 1200) {
    running = false;
    idle();
    return;
  }
  requestAnimationFrame(frame);
}

function wake() {
  if (running) return;
  running = true;
  last = performance.now();
  quietSince = last;
  requestAnimationFrame(frame);
}

// When nothing moves, repaint slowly so blinking ghosts, the moon and the timer stay current.
let idleTimer = 0;
function idle() {
  clearTimeout(idleTimer);
  const tick = () => {
    if (running) return;
    paint(performance.now() / 1000);
    checkTimer();
    idleTimer = setTimeout(tick, timerRunning() ? 1000 : 4000);
  };
  tick();
}

// ---------- Mouse: catch it only over a charm or the menu.
function setInteractive(on) {
  if (ignoring === !on) return;
  ignoring = !on;
  if (win) win.setIgnoreCursorEvents(!on).catch(() => {});
}

function overMenu(x, y) {
  if (menu.hidden) return false;
  const r = menu.getBoundingClientRect();
  return x >= r.left - 6 && x <= r.right + 6 && y >= r.top - 6 && y <= r.bottom + 6;
}

let lastCursor = null;
function onCursor(p) {
  const now = performance.now();
  if (p && lastCursor) {
    const dt = Math.max(0.008, (now - lastCursor.t) / 1000);
    cursorV = { x: (p.x - lastCursor.x) / dt, y: (p.y - lastCursor.y) / dt };
  } else {
    cursorV = { x: 0, y: 0 };
  }
  lastCursor = p ? { ...p, t: now } : null;
  const inside = p && p.x >= 0 && p.y >= 0 && p.x <= W && p.y <= H;
  cursor = inside ? p : null;
  const over = cursor && (hit(charms, cursor.x, cursor.y) >= 0 || overMenu(cursor.x, cursor.y));
  setInteractive(Boolean(over || held));
  document.body.classList.toggle('grab', Boolean(over && !overMenu(cursor.x, cursor.y)));
  if (cursor && Math.hypot(cursorV.x, cursorV.y) > 30) {
    // Only wake up when the mouse moves close to some charm.
    for (const c of charms) {
      const ctr = c.center();
      if (Math.hypot(cursor.x - ctr.x, cursor.y - ctr.y) < c.r * 3) {
        wake();
        break;
      }
    }
  }
}

if (native) {
  // Poll faster when the mouse is near the strip.
  const poll = async () => {
    try {
      onCursor(await call('cursor'));
    } catch {}
    setTimeout(poll, cursor || held ? 16 : 60);
  };
  poll();
} else {
  window.addEventListener('pointermove', (e) => onCursor({ x: e.clientX, y: e.clientY }));
  window.addEventListener('pointerleave', () => onCursor(null));
}

canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  hideMenu();
  const p = { x: e.clientX, y: e.clientY };
  const i = hit(charms, p.x, p.y);
  if (i < 0) return;
  const c = charms[i].body;
  held = { index: i, dx: p.x - c.x, dy: p.y - c.y, startX: p.x, startY: p.y, at: performance.now(), moved: false };
  cursor = p;
  canvas.setPointerCapture(e.pointerId);
  document.body.classList.add('dragging');
  setInteractive(true);
  wake();
});

canvas.addEventListener('pointermove', (e) => {
  if (!held) return;
  const p = { x: e.clientX, y: e.clientY };
  if (Math.hypot(p.x - held.startX, p.y - held.startY) > 5) held.moved = true;
  if (!native) return; // the browser path already updates the cursor
  onCursor(p);
});

function release(e) {
  if (!held) return;
  const c = charms[held.index];
  const quick = !held.moved && performance.now() - held.at < 350;
  if (c && !quick) {
    // Let go with the mouse's speed so you can fling it.
    const b = c.body;
    const fv = 1 / 60;
    b.px = b.x - cursorV.x * fv * 0.9;
    b.py = b.y - cursorV.y * fv * 0.9;
  }
  if (c && quick) tap(c);
  held = null;
  document.body.classList.remove('dragging');
  if (e && canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  wake();
}
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);

function tap(c) {
  const s = states.get(c.id) || {};
  switch (c.kind) {
    case 'dice':
      s.face = 1 + Math.floor(Math.random() * 6);
      c.kick(18);
      sound.clink(4);
      break;
    case 'bell':
      c.kick(10);
      sound.bell();
      break;
    case 'hourglass':
      c.kick(6);
      toggleTimer();
      sound.chime(0.75);
      break;
    case 'lantern':
      s.lit = !s.lit;
      c.kick(5);
      sound.chime(0.9);
      break;
    case 'photo':
      c.kick(7);
      sound.chime(1.2);
      break;
    default:
      c.kick(8);
      sound.chime(0.9 + Math.random() * 0.3);
  }
  states.set(c.id, s);
  // A little bounce on top of the wobble.
  c.push((Math.random() - 0.5) * 300, -260, 1 / 60);
}

// ---------- Right-click menu
function hideMenu() {
  menu.hidden = true;
}

function showMenu(x, y, c) {
  const spec = prefs.charms.find((s) => s.id === c.id);
  const items = [];
  if (c.kind === 'hourglass') {
    const left = timerLeft();
    items.push([timerRunning() ? `Pause (${fmt(left)} left)` : left > 1000 ? `Resume (${fmt(left)} left)` : `Start ${prefs.focusMinutes} min focus`, () => toggleTimer()]);
    for (const m of [15, 25, 50]) items.push([`Focus for ${m} min`, () => toggleTimer(m)]);
    if (timerRunning() || timer.left) items.push(['Reset timer', () => { timer = { total: 0, endAt: 0, left: 0 }; writeTimer(); wake(); }]);
    items.push(null);
  }
  items.push(['Shorter string', () => change(spec, { len: Math.max(30, spec.len - 25) })]);
  items.push(['Longer string', () => change(spec, { len: Math.min(240, spec.len + 25) })]);
  items.push(['Remove this charm', () => update({ charms: prefs.charms.filter((s) => s.id !== c.id) })]);
  items.push(null);
  items.push(['Choose charms…', () => call('open_shelf')]);
  items.push(['Hide charms (Alt Shift D)', () => call('set_visible', { visible: false })]);
  menu.replaceChildren(...items.map((it) => {
    if (!it) return Object.assign(document.createElement('hr'), {});
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = it[0];
    b.addEventListener('click', () => {
      hideMenu();
      it[1]();
    });
    return b;
  }));
  menu.hidden = false;
  const r = menu.getBoundingClientRect();
  menu.style.left = `${Math.min(W - r.width - 8, Math.max(8, x - r.width / 2))}px`;
  menu.style.top = `${Math.min(H - r.height - 8, y + 10)}px`;
  setInteractive(true);
}

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const i = hit(charms, e.clientX, e.clientY);
  if (i >= 0) showMenu(e.clientX, e.clientY, charms[i]);
});
document.addEventListener('pointerdown', (e) => {
  if (!menu.hidden && !menu.contains(e.target)) hideMenu();
});
document.addEventListener('keydown', (e) => e.key === 'Escape' && hideMenu());

function change(spec, patch) {
  update({ charms: prefs.charms.map((s) => (s.id === spec.id ? { ...s, ...patch } : s)) });
}

function update(patch) {
  prefs = { ...prefs, ...patch };
  save(prefs);
  build();
}

// ---------- Wiring
listen('dangle://prefs', (next) => {
  prefs = next || load();
  sound.setEnabled(prefs.sound);
  build();
});
listen('dangle://timer', (minutes) => toggleTimer(minutes));
window.addEventListener('storage', (e) => {
  if (e.key === TIMER_KEY) {
    timer = readTimer();
    wake();
  }
});
window.addEventListener('resize', resize);

call('fit');
resize();
build();
idle();
