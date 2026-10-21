// Every charm is drawn in code, so they stay crisp at any size and the app stays tiny.
// Each draw function paints a charm of radius r centered on (0, 0). The rope ties on
// at (0, -r). `s` holds per-charm state (timer progress, photo, glow) and `t` is seconds.

const TAU = Math.PI * 2;

function glossy(g, x, y, r, light, mid, dark) {
  const grad = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r * 1.1);
  grad.addColorStop(0, light);
  grad.addColorStop(0.45, mid);
  grad.addColorStop(1, dark);
  return grad;
}

function shine(g, x, y, r, a = 0.55) {
  g.save();
  g.globalAlpha = a;
  g.fillStyle = '#fff';
  g.beginPath();
  g.ellipse(x - r * 0.32, y - r * 0.38, r * 0.26, r * 0.14, -0.6, 0, TAU);
  g.fill();
  g.restore();
}

function outline(g, color, w = 2) {
  g.lineWidth = w;
  g.strokeStyle = color;
  g.lineJoin = 'round';
  g.stroke();
}

function starPath(g, r, points = 5, inner = 0.45, rot = -Math.PI / 2) {
  g.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rr = i % 2 ? r * inner : r;
    const a = rot + (i * Math.PI) / points;
    g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.closePath();
}

function heartPath(g, r) {
  g.beginPath();
  g.moveTo(0, r * 0.95);
  g.bezierCurveTo(-r * 1.3, r * 0.1, -r * 0.9, -r * 1.05, 0, -r * 0.45);
  g.bezierCurveTo(r * 0.9, -r * 1.05, r * 1.3, r * 0.1, 0, r * 0.95);
  g.closePath();
}

/** Fraction of the moon that's lit tonight (0 new, 0.5 full) from a known new moon. */
export function moonPhase(date = new Date()) {
  const synodic = 29.530588853;
  const known = Date.UTC(2000, 0, 6, 18, 14);
  const days = (date.getTime() - known) / 86400000;
  return ((days % synodic) + synodic) % synodic / synodic;
}

const ART = {
  moon(g, r) {
    const p = moonPhase();
    g.beginPath();
    g.arc(0, 0, r, 0, TAU);
    g.fillStyle = '#2d2b45';
    g.fill();
    // Lit part: a half disc plus an ellipse that grows or eats into it with the phase.
    const waxing = p < 0.5;
    const k = Math.cos(p * TAU); // 1 new, -1 full
    g.save();
    g.beginPath();
    g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, !waxing);
    g.ellipse(0, 0, Math.abs(k) * r, r, 0, Math.PI / 2, -Math.PI / 2, (k > 0) === waxing);
    g.closePath();
    g.fillStyle = glossy(g, 0, 0, r, '#fffdf0', '#f3e7b8', '#c9b67a');
    g.fill();
    g.restore();
    g.beginPath();
    g.arc(0, 0, r, 0, TAU);
    outline(g, 'rgba(0,0,0,0.25)');
    shine(g, 0, 0, r, 0.3);
  },
  star(g, r) {
    starPath(g, r * 1.12);
    g.fillStyle = glossy(g, 0, 0, r, '#fff6c9', '#ffd24d', '#e08a1e');
    g.fill();
    outline(g, '#b86a12');
    shine(g, 0, 0, r * 0.8);
  },
  heart(g, r) {
    heartPath(g, r);
    g.fillStyle = glossy(g, 0, 0, r, '#ffd0dc', '#ff5a7e', '#c0244a');
    g.fill();
    outline(g, '#9c1c3b');
    shine(g, -r * 0.1, -r * 0.05, r * 0.7);
  },
  cherry(g, r) {
    g.strokeStyle = '#4c7a2a';
    g.lineWidth = r * 0.09;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(0, -r);
    g.quadraticCurveTo(-r * 0.3, -r * 0.2, -r * 0.45, r * 0.15);
    g.moveTo(0, -r);
    g.quadraticCurveTo(r * 0.25, -r * 0.2, r * 0.42, r * 0.2);
    g.stroke();
    g.fillStyle = '#6fae3c';
    g.beginPath();
    g.ellipse(r * 0.22, -r * 0.82, r * 0.28, r * 0.12, -0.5, 0, TAU);
    g.fill();
    for (const [x, y] of [[-r * 0.45, r * 0.45], [r * 0.42, r * 0.5]]) {
      g.beginPath();
      g.arc(x, y, r * 0.48, 0, TAU);
      g.fillStyle = glossy(g, x, y, r * 0.48, '#ffb3b3', '#e3202f', '#8a0f19');
      g.fill();
      outline(g, '#6b0b13', 1.5);
      shine(g, x, y, r * 0.48, 0.6);
    }
  },
  dice(g, r, s, t) {
    const w = r * 1.5;
    g.beginPath();
    g.roundRect(-w / 2, -w / 2, w, w, r * 0.28);
    g.fillStyle = glossy(g, 0, 0, r, '#ffffff', '#f2f0ea', '#c9c4b8');
    g.fill();
    outline(g, '#8f8a7d');
    const face = s.face || 5;
    const d = w * 0.27;
    const pips = { 1: [[0, 0]], 2: [[-d, -d], [d, d]], 3: [[-d, -d], [0, 0], [d, d]], 4: [[-d, -d], [d, -d], [-d, d], [d, d]], 5: [[-d, -d], [d, -d], [0, 0], [-d, d], [d, d]], 6: [[-d, -d], [d, -d], [-d, 0], [d, 0], [-d, d], [d, d]] }[face];
    g.fillStyle = face === 1 ? '#d12a2a' : '#2a2730';
    for (const [x, y] of pips) {
      g.beginPath();
      g.arc(x, y, r * 0.12, 0, TAU);
      g.fill();
    }
  },
  mushroom(g, r) {
    g.beginPath();
    g.roundRect(-r * 0.32, -r * 0.05, r * 0.64, r * 0.95, r * 0.25);
    g.fillStyle = glossy(g, 0, r * 0.4, r * 0.6, '#fffaf0', '#f3e6cf', '#cdb999');
    g.fill();
    outline(g, '#9c8a6a', 1.5);
    g.beginPath();
    g.moveTo(-r, r * 0.05);
    g.bezierCurveTo(-r, -r * 1.05, r, -r * 1.05, r, r * 0.05);
    g.closePath();
    g.fillStyle = glossy(g, 0, -r * 0.3, r, '#ff9a8a', '#e23a2c', '#9a1a12');
    g.fill();
    outline(g, '#7a140e');
    g.fillStyle = '#fff6ea';
    for (const [x, y, rr] of [[-r * 0.45, -r * 0.3, 0.16], [r * 0.1, -r * 0.55, 0.13], [r * 0.55, -r * 0.2, 0.14], [-r * 0.05, -r * 0.12, 0.09]]) {
      g.beginPath();
      g.arc(x, y, r * rr, 0, TAU);
      g.fill();
    }
  },
  ghost(g, r, s, t) {
    g.beginPath();
    g.moveTo(-r * 0.85, r * 0.9);
    g.lineTo(-r * 0.85, -r * 0.1);
    g.arc(0, -r * 0.1, r * 0.85, Math.PI, 0);
    g.lineTo(r * 0.85, r * 0.9);
    for (let i = 0; i < 4; i++) {
      const x = r * 0.85 - (i + 0.5) * (r * 1.7) / 4;
      g.quadraticCurveTo(x, r * (0.6 + 0.12 * Math.sin(t * 4 + i)), x - r * 0.2125, r * 0.9);
    }
    g.closePath();
    g.fillStyle = glossy(g, 0, 0, r, '#ffffff', '#eef0ff', '#b9bde0');
    g.fill();
    outline(g, '#8d92bd');
    g.fillStyle = '#2a2740';
    const blink = Math.sin(t * 0.9) > 0.985 ? 0.15 : 1;
    for (const x of [-r * 0.3, r * 0.3]) {
      g.beginPath();
      g.ellipse(x, -r * 0.15, r * 0.11, r * 0.15 * blink, 0, 0, TAU);
      g.fill();
    }
    g.fillStyle = 'rgba(255,120,150,0.45)';
    for (const x of [-r * 0.5, r * 0.5]) {
      g.beginPath();
      g.ellipse(x, r * 0.1, r * 0.13, r * 0.07, 0, 0, TAU);
      g.fill();
    }
  },
  shell(g, r) {
    g.beginPath();
    g.moveTo(0, r * 0.9);
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI + (i / 8) * Math.PI;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.95 + r * 0.15);
    }
    g.closePath();
    g.fillStyle = glossy(g, 0, 0, r, '#fff1ea', '#ffc2ad', '#e0846a');
    g.fill();
    outline(g, '#b86650');
    g.strokeStyle = 'rgba(184,102,80,0.7)';
    g.lineWidth = 1.5;
    for (let i = 1; i < 8; i++) {
      const a = Math.PI + (i / 8) * Math.PI;
      g.beginPath();
      g.moveTo(0, r * 0.9);
      g.lineTo(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.88 + r * 0.15);
      g.stroke();
    }
  },
  planet(g, r) {
    g.save();
    g.rotate(-0.35);
    g.beginPath();
    g.ellipse(0, 0, r * 1.35, r * 0.38, 0, Math.PI, TAU);
    g.strokeStyle = '#d9b97a';
    g.lineWidth = r * 0.12;
    g.stroke();
    g.restore();
    g.beginPath();
    g.arc(0, 0, r * 0.78, 0, TAU);
    g.fillStyle = glossy(g, 0, 0, r * 0.78, '#e8d7ff', '#9b7be0', '#4c3591');
    g.fill();
    shine(g, 0, 0, r * 0.78);
    g.save();
    g.rotate(-0.35);
    g.beginPath();
    g.ellipse(0, 0, r * 1.35, r * 0.38, 0, 0, Math.PI);
    g.strokeStyle = '#f0d596';
    g.lineWidth = r * 0.12;
    g.stroke();
    g.restore();
  },
  clover(g, r) {
    g.fillStyle = glossy(g, 0, 0, r, '#c9f7b0', '#4fbf4a', '#23752a');
    for (let i = 0; i < 4; i++) {
      g.save();
      g.rotate(i * Math.PI / 2 + Math.PI / 4);
      g.translate(0, -r * 0.42);
      g.rotate(Math.PI);
      heartPath(g, r * 0.45);
      g.fill();
      outline(g, '#1e5e22', 1.5);
      g.restore();
    }
    g.strokeStyle = '#2f7a2c';
    g.lineWidth = r * 0.1;
    g.beginPath();
    g.moveTo(0, r * 0.1);
    g.quadraticCurveTo(r * 0.2, r * 0.7, r * 0.05, r * 1.0);
    g.stroke();
  },
  cat(g, r, s, t) {
    g.beginPath();
    g.moveTo(-r * 0.85, -r * 0.15);
    g.lineTo(-r * 0.75, -r * 0.95);
    g.lineTo(-r * 0.3, -r * 0.6);
    g.lineTo(r * 0.3, -r * 0.6);
    g.lineTo(r * 0.75, -r * 0.95);
    g.lineTo(r * 0.85, -r * 0.15);
    g.arc(0, -r * 0.05, r * 0.86, -0.1, Math.PI + 0.1);
    g.closePath();
    g.fillStyle = glossy(g, 0, 0, r, '#ffe2bd', '#f5a54c', '#b9661b');
    g.fill();
    outline(g, '#8a4a10');
    g.fillStyle = '#2b1d10';
    const blink = Math.sin(t * 0.7 + 1) > 0.98 ? 0.12 : 1;
    for (const x of [-r * 0.32, r * 0.32]) {
      g.beginPath();
      g.ellipse(x, -r * 0.05, r * 0.09, r * 0.14 * blink, 0, 0, TAU);
      g.fill();
    }
    g.fillStyle = '#ff7a8a';
    g.beginPath();
    g.moveTo(-r * 0.08, r * 0.18);
    g.lineTo(r * 0.08, r * 0.18);
    g.lineTo(0, r * 0.28);
    g.fill();
    g.strokeStyle = 'rgba(60,30,10,0.6)';
    g.lineWidth = 1.2;
    for (const sx of [-1, 1]) {
      for (const dy of [0.2, 0.32]) {
        g.beginPath();
        g.moveTo(sx * r * 0.25, r * dy);
        g.lineTo(sx * r * 0.85, r * (dy - 0.05 + (dy - 0.26)));
        g.stroke();
      }
    }
  },
  strawberry(g, r) {
    g.beginPath();
    g.moveTo(0, r);
    g.bezierCurveTo(-r * 1.1, r * 0.3, -r * 0.95, -r * 0.75, 0, -r * 0.6);
    g.bezierCurveTo(r * 0.95, -r * 0.75, r * 1.1, r * 0.3, 0, r);
    g.fillStyle = glossy(g, 0, 0, r, '#ffb0a8', '#ef3b3b', '#a8141c');
    g.fill();
    outline(g, '#7d0f15');
    g.fillStyle = '#ffe9a6';
    for (let i = 0; i < 9; i++) {
      const x = ((i % 3) - 1) * r * 0.38 + (Math.floor(i / 3) % 2) * r * 0.12;
      const y = -r * 0.2 + Math.floor(i / 3) * r * 0.32;
      g.beginPath();
      g.ellipse(x, y, r * 0.05, r * 0.08, 0, 0, TAU);
      g.fill();
    }
    g.fillStyle = '#3f9a3a';
    starPath(g, r * 0.5, 5, 0.4);
    g.save();
    g.translate(0, -r * 0.62);
    g.scale(1, 0.5);
    starPath(g, r * 0.6, 5, 0.35);
    g.fill();
    g.restore();
  },
  crystal(g, r, s, t) {
    g.beginPath();
    g.moveTo(0, -r);
    g.lineTo(r * 0.6, -r * 0.35);
    g.lineTo(r * 0.38, r);
    g.lineTo(-r * 0.38, r);
    g.lineTo(-r * 0.6, -r * 0.35);
    g.closePath();
    const hue = (t * 20) % 360;
    const grad = g.createLinearGradient(-r, -r, r, r);
    grad.addColorStop(0, `hsl(${hue}, 90%, 88%)`);
    grad.addColorStop(0.5, `hsl(${(hue + 60) % 360}, 80%, 70%)`);
    grad.addColorStop(1, `hsl(${(hue + 140) % 360}, 70%, 55%)`);
    g.fillStyle = grad;
    g.fill();
    outline(g, 'rgba(40,40,80,0.5)');
    g.strokeStyle = 'rgba(255,255,255,0.6)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(-r * 0.6, -r * 0.35);
    g.lineTo(0, -r * 0.1);
    g.lineTo(r * 0.6, -r * 0.35);
    g.moveTo(0, -r * 0.1);
    g.lineTo(0, r);
    g.stroke();
  },
  bell(g, r) {
    g.beginPath();
    g.moveTo(-r * 0.9, r * 0.7);
    g.bezierCurveTo(-r * 0.75, r * 0.3, -r * 0.75, -r * 0.85, 0, -r * 0.85);
    g.bezierCurveTo(r * 0.75, -r * 0.85, r * 0.75, r * 0.3, r * 0.9, r * 0.7);
    g.closePath();
    g.fillStyle = glossy(g, 0, 0, r, '#fff3c4', '#f2c230', '#a8740c');
    g.fill();
    outline(g, '#7d560a');
    g.beginPath();
    g.arc(0, r * 0.8, r * 0.16, 0, TAU);
    g.fillStyle = '#7d560a';
    g.fill();
    shine(g, 0, 0, r * 0.75);
  },
  lantern(g, r, s, t) {
    const night = new Date().getHours();
    const on = night >= 18 || night < 7 || s.lit;
    if (on) {
      const glow = g.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 2.1);
      glow.addColorStop(0, 'rgba(255,200,90,0.55)');
      glow.addColorStop(1, 'rgba(255,200,90,0)');
      g.fillStyle = glow;
      g.beginPath();
      g.arc(0, 0, r * 2.1, 0, TAU);
      g.fill();
    }
    g.beginPath();
    g.ellipse(0, 0, r * 0.8, r * 0.95, 0, 0, TAU);
    g.fillStyle = on ? glossy(g, 0, 0, r, '#fff6d6', '#ffb347', '#e0571e') : glossy(g, 0, 0, r, '#ffd9c2', '#e2664a', '#93301c');
    g.fill();
    outline(g, '#7a2a14');
    g.strokeStyle = 'rgba(122,42,20,0.5)';
    g.lineWidth = 1.2;
    for (const k of [-0.45, 0, 0.45]) {
      g.beginPath();
      g.ellipse(0, 0, r * 0.8 * Math.abs(k || 0.02), r * 0.95, 0, 0, TAU);
      g.stroke();
    }
    g.fillStyle = '#3a2a22';
    g.fillRect(-r * 0.4, -r * 1.02, r * 0.8, r * 0.16);
    g.fillRect(-r * 0.4, r * 0.86, r * 0.8, r * 0.16);
  },
  hourglass(g, r, s) {
    const left = s.progress == null ? 0 : s.progress; // 1 = full top, 0 = empty
    const w = r * 0.75;
    const h = r * 0.95;
    g.fillStyle = '#6b4a2b';
    g.fillRect(-w - 3, -h - 6, (w + 3) * 2, 7);
    g.fillRect(-w - 3, h - 1, (w + 3) * 2, 7);
    g.beginPath();
    g.moveTo(-w, -h);
    g.lineTo(w, -h);
    g.lineTo(r * 0.1, 0);
    g.lineTo(w, h);
    g.lineTo(-w, h);
    g.lineTo(-r * 0.1, 0);
    g.closePath();
    g.fillStyle = 'rgba(220,240,255,0.35)';
    g.fill();
    outline(g, 'rgba(120,150,180,0.8)', 1.5);
    g.fillStyle = '#f2c35b';
    // Top sand
    if (left > 0.01) {
      const top = -h + (1 - left) * h * 0.9;
      const half = w * (1 - (top + h) / h) * 0.95;
      g.beginPath();
      g.moveTo(-half, top);
      g.lineTo(half, top);
      g.lineTo(r * 0.05, -2);
      g.lineTo(-r * 0.05, -2);
      g.closePath();
      g.fill();
    }
    // Bottom pile
    const filled = 1 - left;
    if (filled > 0.01) {
      const ph = h * 0.85 * Math.sqrt(filled);
      g.beginPath();
      g.moveTo(-w * 0.95, h);
      g.quadraticCurveTo(0, h - ph * 1.6, w * 0.95, h);
      g.closePath();
      g.fill();
    }
    if (s.running) {
      g.fillRect(-0.8, 0, 1.6, h - 2);
    }
  },
  photo(g, r, s) {
    g.beginPath();
    g.arc(0, 0, r, 0, TAU);
    g.fillStyle = glossy(g, 0, 0, r, '#fff8e8', '#e9c983', '#a8803a');
    g.fill();
    g.save();
    g.beginPath();
    g.arc(0, 0, r * 0.82, 0, TAU);
    g.clip();
    if (s.img && s.img.complete && s.img.naturalWidth) {
      const k = Math.max((r * 1.64) / s.img.naturalWidth, (r * 1.64) / s.img.naturalHeight);
      g.drawImage(s.img, -s.img.naturalWidth * k / 2, -s.img.naturalHeight * k / 2, s.img.naturalWidth * k, s.img.naturalHeight * k);
    } else {
      g.fillStyle = '#f6efe2';
      g.fillRect(-r, -r, r * 2, r * 2);
      g.fillStyle = '#c9b48a';
      g.font = `${Math.round(r * 0.7)}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('+', 0, 0);
    }
    g.restore();
    g.beginPath();
    g.arc(0, 0, r * 0.82, 0, TAU);
    outline(g, 'rgba(120,90,40,0.6)', 1.5);
    shine(g, 0, 0, r, 0.35);
  },
  pearl(g, r) {
    g.beginPath();
    g.arc(0, 0, r * 0.8, 0, TAU);
    g.fillStyle = glossy(g, 0, 0, r * 0.8, '#ffffff', '#f1e9f2', '#c7b6c9');
    g.fill();
    const sheen = g.createLinearGradient(-r, -r, r, r);
    sheen.addColorStop(0, 'rgba(255,200,230,0.0)');
    sheen.addColorStop(0.5, 'rgba(190,220,255,0.35)');
    sheen.addColorStop(1, 'rgba(255,230,200,0.0)');
    g.fillStyle = sheen;
    g.fill();
    shine(g, 0, 0, r * 0.8, 0.8);
  },
  flower(g, r, s, t) {
    g.save();
    g.rotate(Math.sin(t * 0.6) * 0.1);
    for (let i = 0; i < 6; i++) {
      g.save();
      g.rotate((i * TAU) / 6);
      g.beginPath();
      g.ellipse(0, -r * 0.55, r * 0.32, r * 0.48, 0, 0, TAU);
      g.fillStyle = glossy(g, 0, -r * 0.55, r * 0.5, '#ffffff', '#ffd1ec', '#e889c1');
      g.fill();
      outline(g, '#c0629a', 1.2);
      g.restore();
    }
    g.beginPath();
    g.arc(0, 0, r * 0.3, 0, TAU);
    g.fillStyle = glossy(g, 0, 0, r * 0.3, '#fff3b0', '#ffc928', '#d08a00');
    g.fill();
    g.restore();
  },
  bolt(g, r) {
    g.beginPath();
    g.moveTo(r * 0.15, -r);
    g.lineTo(-r * 0.6, r * 0.12);
    g.lineTo(-r * 0.05, r * 0.12);
    g.lineTo(-r * 0.25, r);
    g.lineTo(r * 0.6, -r * 0.2);
    g.lineTo(r * 0.05, -r * 0.2);
    g.closePath();
    g.fillStyle = glossy(g, 0, 0, r, '#fffbd0', '#ffe03a', '#e0a000');
    g.fill();
    outline(g, '#9a6a00');
  },
  cloud(g, r, s, t) {
    g.beginPath();
    g.arc(-r * 0.45, r * 0.1, r * 0.45, Math.PI * 0.5, Math.PI * 1.5);
    g.arc(-r * 0.1, -r * 0.3, r * 0.5, Math.PI, Math.PI * 1.85);
    g.arc(r * 0.45, -r * 0.05, r * 0.45, Math.PI * 1.3, Math.PI * 0.5);
    g.closePath();
    g.fillStyle = glossy(g, 0, 0, r, '#ffffff', '#eef4fb', '#b7c6d8');
    g.fill();
    outline(g, '#8fa2b8');
    g.fillStyle = '#7fb6ef';
    for (let i = 0; i < 3; i++) {
      const y = r * 0.75 + ((t * 40 + i * 13) % (r * 0.6));
      g.beginPath();
      g.ellipse(-r * 0.35 + i * r * 0.35, y, 2, 4, 0, 0, TAU);
      g.fill();
    }
  },
  fish(g, r, s, t) {
    const wag = Math.sin(t * 5) * 0.25;
    g.beginPath();
    g.moveTo(r * 0.55, 0);
    g.lineTo(r * 1.0, -r * 0.45 + wag * r);
    g.lineTo(r * 1.0, r * 0.45 + wag * r);
    g.closePath();
    g.fillStyle = '#ff9b3d';
    g.fill();
    outline(g, '#b85a10', 1.5);
    g.beginPath();
    g.ellipse(-r * 0.05, 0, r * 0.68, r * 0.5, 0, 0, TAU);
    g.fillStyle = glossy(g, 0, 0, r * 0.7, '#ffe0b8', '#ff8a2a', '#c4520c');
    g.fill();
    outline(g, '#9a420a');
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(-r * 0.4, -r * 0.08, r * 0.13, 0, TAU);
    g.fill();
    g.fillStyle = '#1f1a2a';
    g.beginPath();
    g.arc(-r * 0.42, -r * 0.08, r * 0.07, 0, TAU);
    g.fill();
  },
  evileye(g, r) {
    const rings = [[1, '#1d4fb8'], [0.72, '#ffffff'], [0.48, '#7cc8ff'], [0.26, '#101522']];
    for (const [k, c] of rings) {
      g.beginPath();
      g.arc(0, 0, r * k, 0, TAU);
      g.fillStyle = c;
      g.fill();
    }
    shine(g, 0, 0, r, 0.55);
  },
  key(g, r) {
    g.fillStyle = glossy(g, 0, -r * 0.4, r * 0.6, '#fff1c2', '#e2b13c', '#9a6c12');
    g.beginPath();
    g.arc(0, -r * 0.45, r * 0.45, 0, TAU);
    g.arc(0, -r * 0.45, r * 0.2, 0, TAU, true);
    g.fill('evenodd');
    g.fillRect(-r * 0.09, -r * 0.05, r * 0.18, r * 1.05);
    g.fillRect(0, r * 0.55, r * 0.35, r * 0.12);
    g.fillRect(0, r * 0.82, r * 0.28, r * 0.12);
  },
};

export const KINDS = [
  ['moon', 'Moon (tonight\'s real phase)'], ['hourglass', 'Hourglass focus timer'], ['star', 'Star'], ['heart', 'Heart'],
  ['cherry', 'Cherries'], ['ghost', 'Ghost'], ['cat', 'Cat'], ['mushroom', 'Mushroom'], ['dice', 'Die (click to roll)'],
  ['bell', 'Bell (rings)'], ['lantern', 'Lantern (glows at night)'], ['crystal', 'Crystal'], ['planet', 'Planet'],
  ['clover', 'Four-leaf clover'], ['strawberry', 'Strawberry'], ['shell', 'Shell'], ['pearl', 'Pearl'], ['flower', 'Flower'],
  ['bolt', 'Lightning'], ['cloud', 'Rain cloud'], ['fish', 'Fish'], ['evileye', 'Evil eye'], ['key', 'Key'], ['photo', 'Your photo'],
];

export function draw(g, kind, r, state = {}, t = 0) {
  (ART[kind] || ART.star)(g, r, state, t);
}
