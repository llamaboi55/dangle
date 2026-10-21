// Tiny synthesized sounds, so there are no audio files to ship.
let ctx = null;
let enabled = true;
let lastClink = 0;

export const setEnabled = (on) => (enabled = on);

function audio() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, start, dur, gain, type = 'sine') {
  const a = audio();
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, a.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, a.currentTime + start + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + start);
  o.stop(a.currentTime + start + dur + 0.05);
}

export function chime(pitch = 1) {
  if (!enabled) return;
  for (const [f, d, v] of [[1318, 1.2, 0.08], [1976, 0.9, 0.04], [2637, 0.6, 0.02]]) tone(f * pitch, 0, d, v);
}

export function bell() {
  if (!enabled) return;
  for (const [f, d, v] of [[880, 2.2, 0.09], [1760, 1.6, 0.05], [2349, 1.2, 0.03], [3520, 0.6, 0.015]]) tone(f, 0, d, v);
}

export function clink(strength) {
  if (!enabled) return;
  const now = performance.now();
  if (now - lastClink < 90) return;
  lastClink = now;
  const v = Math.min(0.05, strength * 0.01);
  tone(2400 + Math.random() * 900, 0, 0.12, v, 'triangle');
}

export function done() {
  if (!enabled) return;
  [0, 0.35, 0.7].forEach((t, i) => {
    tone([1046, 1318, 1568][i], t, 1.4, 0.08);
    tone([2093, 2637, 3136][i], t, 0.8, 0.03);
  });
}
