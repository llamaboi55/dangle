// Settings and the list of hanging charms, kept in local storage. Both windows read
// the same storage; a change in the shelf is announced to the strip with an event.
import { emit } from './api.js';

const KEY = 'dangle:prefs';
export const DEFAULTS = {
  size: 1, // charm scale
  sway: 1, // how strongly your mouse pushes charms
  sound: true,
  focusMinutes: 25,
  charms: [
    { id: 'm1', kind: 'moon', x: 0.6, len: 70 },
    { id: 'h1', kind: 'hourglass', x: 0.65, len: 120 },
    { id: 'c1', kind: 'cherry', x: 0.7, len: 90 },
    { id: 's1', kind: 'star', x: 0.75, len: 150 },
    { id: 'g1', kind: 'ghost', x: 0.8, len: 85 },
  ],
};

export function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export function save(prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {}
  emit('dangle://prefs', prefs);
}

export const uid = () => Math.random().toString(36).slice(2, 9);
