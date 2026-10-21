// The shelf: pick which charms hang, and a few settings.
import { draw, KINDS } from './art.js';
import { call, listen, native, autostart } from './api.js';
import { load, save, uid } from './prefs.js';

let prefs = load();
const $ = (id) => document.getElementById(id);
const name = Object.fromEntries(KINDS);
const photos = new Map();

function thumb(kind, size, spec) {
  const c = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  c.width = c.height = size * dpr;
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, size / 2, size / 2 + size * 0.04);
  const state = { face: 5, progress: 0.6 };
  if (kind === 'photo' && spec?.photo) {
    let img = photos.get(spec.photo);
    if (!img) {
      img = new Image();
      img.src = spec.photo;
      photos.set(spec.photo, img);
    }
    state.img = img;
    if (!img.complete) img.onload = () => render();
  }
  draw(g, kind, size * 0.34, state, 0);
  return c;
}

function update(patch) {
  prefs = { ...prefs, ...patch };
  save(prefs);
  render();
}

/** Picks a free spot across the top for a new charm, near the others. */
function freeSpot() {
  const xs = prefs.charms.map((c) => c.x).sort((a, b) => a - b);
  if (!xs.length) return 0.7;
  const right = xs[xs.length - 1] + 0.045;
  if (right < 0.96) return right;
  const left = xs[0] - 0.045;
  return left > 0.04 ? left : 0.1 + Math.random() * 0.8;
}

function add(kind, extra = {}) {
  const len = 60 + Math.round(Math.random() * 90);
  update({ charms: [...prefs.charms, { id: uid(), kind, x: freeSpot(), len, ...extra }] });
}

function render() {
  const hanging = $('hanging');
  hanging.replaceChildren(
    ...prefs.charms.map((spec) => {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.title = `Take down ${name[spec.kind] || spec.kind}`;
      remove.setAttribute('aria-label', remove.title);
      remove.addEventListener('click', () => update({ charms: prefs.charms.filter((c) => c.id !== spec.id) }));
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.title = name[spec.kind] || spec.kind;
      chip.append(thumb(spec.kind, 30, spec), remove);
      return chip;
    }),
  );
  if (!prefs.charms.length) {
    const p = document.createElement('span');
    p.className = 'empty';
    p.textContent = 'Nothing hanging. Pick a charm below.';
    hanging.append(p);
  }
  $('count').textContent = prefs.charms.length ? `(${prefs.charms.length})` : '';
  $('size').value = prefs.size;
  $('sway').value = prefs.sway;
  $('sound').checked = prefs.sound;
  $('focus').value = String(prefs.focusMinutes);
}

function grid() {
  $('grid').replaceChildren(
    ...KINDS.map(([kind, label]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tile';
      b.title = `Hang a ${label.toLowerCase()}`;
      b.append(thumb(kind, 64), Object.assign(document.createElement('span'), { textContent: label }));
      b.addEventListener('click', () => (kind === 'photo' ? $('photo-file').click() : add(kind)));
      return b;
    }),
  );
}

// A photo charm is stored as a small JPEG so the settings stay light.
$('photo-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const img = new Image();
  img.src = URL.createObjectURL(file);
  await img.decode().catch(() => null);
  const side = 160;
  const c = document.createElement('canvas');
  c.width = c.height = side;
  const k = Math.max(side / img.naturalWidth, side / img.naturalHeight);
  c.getContext('2d').drawImage(img, (side - img.naturalWidth * k) / 2, (side - img.naturalHeight * k) / 2, img.naturalWidth * k, img.naturalHeight * k);
  URL.revokeObjectURL(img.src);
  add('photo', { photo: c.toDataURL('image/jpeg', 0.82) });
});

$('spread').addEventListener('click', () => {
  const n = prefs.charms.length;
  const start = n > 8 ? 0.1 : 0.5;
  const span = n > 8 ? 0.8 : Math.min(0.44, n * 0.06);
  update({ charms: prefs.charms.map((c, i) => ({ ...c, x: n === 1 ? 0.7 : start + (span * i) / Math.max(1, n - 1) })) });
});
$('clear').addEventListener('click', () => update({ charms: [] }));
$('size').addEventListener('input', (e) => update({ size: Number(e.target.value) }));
$('sway').addEventListener('input', (e) => update({ sway: Number(e.target.value) }));
$('sound').addEventListener('change', (e) => update({ sound: e.target.checked }));
$('focus').addEventListener('change', (e) => update({ focusMinutes: Number(e.target.value) }));
$('visible').addEventListener('change', (e) => call('set_visible', { visible: e.target.checked }));
$('quit').addEventListener('click', () => (native ? call('quit') : window.close()));
$('autostart').addEventListener('change', (e) => autostart.set(e.target.checked).catch(() => (e.target.checked = !e.target.checked)));

listen('dangle://visibility', (v) => ($('visible').checked = v));
listen('dangle://prefs', (next) => {
  prefs = next;
  render();
});

autostart.isEnabled().then((on) => ($('autostart').checked = on)).catch(() => {});
call('is_visible').then((v) => v != null && ($('visible').checked = v));
grid();
render();
