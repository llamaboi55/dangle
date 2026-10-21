import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Charm, collide, hit } from '../src/js/physics.js';
import { moonPhase, KINDS } from '../src/js/art.js';

const settle = (c, seconds = 8) => {
  for (let i = 0; i < seconds * 120; i++) c.step(1 / 120, { width: 1000, height: 400 });
};

test('a charm settles straight below its anchor at the rope length', () => {
  const c = new Charm({ id: 'a', kind: 'star', x: 300, len: 120, r: 20 });
  c.body.px -= 5; // give it a swing
  settle(c);
  assert.ok(Math.abs(c.body.x - 300) < 1, `x ${c.body.x}`);
  assert.ok(Math.abs(c.body.y - 120) < 3, `y ${c.body.y}`);
  assert.ok(c.energy() < 0.01);
});

test('the rope never stretches past its length when the charm is pulled', () => {
  const c = new Charm({ id: 'a', kind: 'star', x: 300, len: 100, r: 20 });
  for (let i = 0; i < 240; i++) c.step(1 / 120, { width: 1000, height: 400, held: { x: 380, y: 60 } });
  const d = Math.hypot(c.body.x - 300, c.body.y);
  assert.ok(Math.abs(d - 100) < 1, `distance ${d}`);
});

test('charms stay inside the strip', () => {
  const c = new Charm({ id: 'a', kind: 'star', x: 10, len: 600, r: 20 });
  settle(c, 2);
  assert.ok(c.body.y <= 400 - 40 + 0.001);
  assert.ok(c.body.x >= 20);
});

test('overlapping charms get pushed apart', () => {
  const a = new Charm({ id: 'a', kind: 'star', x: 100, len: 100, r: 20 });
  const b = new Charm({ id: 'b', kind: 'star', x: 110, len: 100, r: 20 });
  for (let i = 0; i < 600; i++) {
    a.step(1 / 120, { width: 1000, height: 400 });
    b.step(1 / 120, { width: 1000, height: 400 });
    collide([a, b]);
  }
  const ca = a.center();
  const cb = b.center();
  assert.ok(Math.hypot(ca.x - cb.x, ca.y - cb.y) >= 39);
});

test('hit finds the charm under the mouse', () => {
  const c = new Charm({ id: 'a', kind: 'star', x: 300, len: 100, r: 20 });
  settle(c, 2);
  const ctr = c.center();
  assert.equal(hit([c], ctr.x + 5, ctr.y - 5), 0);
  assert.equal(hit([c], ctr.x + 60, ctr.y), -1);
});

test('moon phase matches known full and new moons', () => {
  const full = moonPhase(new Date(Date.UTC(2024, 0, 25, 17, 54)));
  const nw = moonPhase(new Date(Date.UTC(2024, 1, 9, 22, 59)));
  assert.ok(Math.abs(full - 0.5) < 0.03, `full ${full}`);
  assert.ok(nw < 0.03 || nw > 0.97, `new ${nw}`);
});

test('every charm has a name', () => {
  assert.equal(new Set(KINDS.map((k) => k[0])).size, KINDS.length);
  assert.ok(KINDS.length >= 24);
});
