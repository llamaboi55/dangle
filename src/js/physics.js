// Rope physics with Verlet integration: each charm hangs from a fixed point on a
// chain of light links, and the charm itself is the heavy last link. No libraries.

export const GRAVITY = 1500; // px/s²
const LINKS = 9;
const ITERATIONS = 14;
const DAMPING = 0.992;

export class Charm {
  constructor({ id, kind, x, len, r }) {
    this.id = id;
    this.kind = kind;
    this.anchor = { x, y: 0 };
    this.len = len;
    this.r = r;
    this.points = [];
    for (let i = 0; i <= LINKS; i++) {
      const y = (i / LINKS) * len;
      this.points.push({ x, y, px: x, py: y });
    }
    this.spin = 0; // extra wobble angle from clicks
    this.spinV = 0;
  }

  get body() {
    return this.points[this.points.length - 1];
  }

  /** Where the charm's center sits: the rope ends at the ring on top of the charm. */
  center() {
    const b = this.body;
    const a = this.angle();
    return { x: b.x - Math.sin(a) * this.r, y: b.y + Math.cos(a) * this.r };
  }

  /** The rope's direction at the end, so the charm tilts the way it swings. */
  angle() {
    const p = this.points;
    const a = p[p.length - 1];
    const b = p[p.length - 2];
    return Math.atan2(-(a.x - b.x), a.y - b.y) + this.spin;
  }

  setLength(len) {
    this.len = len;
  }

  push(vx, vy, dt) {
    const b = this.body;
    b.px -= vx * dt;
    b.py -= vy * dt;
  }

  kick(amount) {
    this.spinV += amount;
  }

  energy() {
    let e = 0;
    for (const p of this.points) e += (p.x - p.px) ** 2 + (p.y - p.py) ** 2;
    return e + this.spinV * this.spinV + this.spin * this.spin;
  }

  step(dt, { gravity = GRAVITY, width = Infinity, height = Infinity, held = null } = {}) {
    const g = gravity * dt * dt;
    for (let i = 1; i < this.points.length; i++) {
      const p = this.points[i];
      const vx = (p.x - p.px) * DAMPING;
      const vy = (p.y - p.py) * DAMPING;
      p.px = p.x;
      p.py = p.y;
      p.x += vx;
      p.y += vy + g;
    }
    if (held) {
      const b = this.body;
      b.x = held.x;
      b.y = held.y;
    }
    const seg = this.len / LINKS;
    const last = this.points.length - 1;
    for (let k = 0; k < ITERATIONS; k++) {
      const first = this.points[0];
      first.x = this.anchor.x;
      first.y = this.anchor.y;
      for (let i = 0; i < last; i++) {
        const a = this.points[i];
        const b = this.points[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.0001;
        if (d <= seg) continue; // a rope can go slack, it just can't stretch
        const diff = (d - seg) / d;
        // The pinned top doesn't move; the heavy charm moves less than a rope link.
        const wa = i === 0 ? 0 : 1;
        const wb = i + 1 === last ? (held ? 0 : 0.35) : 1;
        const sum = wa + wb;
        if (!sum) continue;
        a.x += dx * diff * (wa / sum);
        a.y += dy * diff * (wa / sum);
        b.x -= dx * diff * (wb / sum);
        b.y -= dy * diff * (wb / sum);
      }
      // Keep everything inside the strip.
      const b = this.body;
      const room = this.r * 2;
      if (b.y > height - room) b.y = height - room;
      if (b.y < 2) b.y = 2;
      if (b.x < this.r) b.x = this.r;
      if (b.x > width - this.r) b.x = width - this.r;
    }
    // Click wobble: a little spring on the charm's own rotation.
    this.spinV += -this.spin * 160 * dt;
    this.spinV *= Math.exp(-4 * dt);
    this.spin += this.spinV * dt;
  }
}

/** Pushes overlapping charms apart, returns how hard the hardest pair bumped (for a clink). */
export function collide(charms) {
  let hardest = 0;
  for (let i = 0; i < charms.length; i++) {
    for (let j = i + 1; j < charms.length; j++) {
      const a = charms[i].body;
      const b = charms[j].body;
      const ca = charms[i].center();
      const cb = charms[j].center();
      const min = charms[i].r + charms[j].r;
      const dx = cb.x - ca.x;
      const dy = cb.y - ca.y;
      const d = Math.hypot(dx, dy);
      if (d >= min || d === 0) continue;
      const push = (min - d) / 2 / d;
      a.x -= dx * push;
      a.y -= dy * push;
      b.x += dx * push;
      b.y += dy * push;
      const rel = Math.hypot((a.x - a.px) - (b.x - b.px), (a.y - a.py) - (b.y - b.py));
      hardest = Math.max(hardest, rel);
    }
  }
  return hardest;
}

/** Index of the charm under (x, y), front-most first, or -1. */
export function hit(charms, x, y, slack = 4) {
  for (let i = charms.length - 1; i >= 0; i--) {
    const c = charms[i].center();
    if (Math.hypot(x - c.x, y - c.y) <= charms[i].r + slack) return i;
  }
  return -1;
}
