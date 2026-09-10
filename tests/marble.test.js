import test from "node:test";
import assert from "node:assert/strict";
import {
  bounds,
  circle,
  drop,
  offPaper,
  refine,
  ripple,
  shoelace,
  tine,
  vortex,
} from "../brushes/marble/fluid.js";
import { PALETTES, createInkOrder } from "../brushes/marble/palette.js";

const area = (points) => Math.abs(shoelace(points)) / 2;
const seeded = (state = 7) => () =>
  ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);

test("a drop pushes the tray aside and gives back the area it takes up", () => {
  // This is the one law the whole technique rests on. A drop displaces size
  // radially by exactly its own area, so a boundary around it opens into a
  // ring that still encloses what it enclosed before.
  const ring = circle(0, 0, 40, 0.6);
  const before = area(ring);
  drop(ring, 0, 0, 25);
  const after = area(ring);
  assert.ok(
    Math.abs(after - (before + Math.PI * 25 * 25)) / after < 0.002,
    `a concentric drop adds exactly its own area (${before} -> ${after})`,
  );

  // Off-centre it still conserves the boundary's own area, which is why the
  // tenth drop in one place leaves nine thin rings rather than eating them.
  const island = circle(120, 0, 30, 0.4);
  const islandArea = area(island);
  const islandEdge = bounds(island);
  drop(island, 0, 0, 45);
  const pushed = bounds(island);
  assert.ok(
    Math.abs(area(island) - islandArea) / islandArea < 0.02,
    "ink pushed aside keeps its area",
  );
  assert.ok(pushed.minX > islandEdge.minX, "its near edge is shoved outward");
  assert.ok(pushed.maxX > islandEdge.maxX, "and so is its far edge");
});

test("a drop never turns a boundary inside out, even at its own centre", () => {
  const ring = circle(0, 0, 12, 0.5);
  const winding = Math.sign(shoelace(ring));
  // A point exactly at the centre has no direction to be pushed in; it must
  // still land on the new edge rather than produce a NaN.
  ring.push(0, 0);
  drop(ring, 0, 0, 20);
  for (const value of ring) assert.ok(Number.isFinite(value));
  assert.equal(Math.sign(shoelace(ring)), winding, "winding direction survives");
  for (let i = 0; i < ring.length; i += 2) {
    assert.ok(Math.hypot(ring[i], ring[i + 1]) >= 19.99, "everything clears the drop");
  }
});

test("a tine drags ink furthest along its own line and leaves distant ink alone", () => {
  const near = [0, 0];
  const mid = [0, 30];
  const far = [0, 400];
  for (const points of [near, mid, far]) tine(points, 0, 0, 1, 0, 60, 30);
  assert.ok(Math.abs(near[0] - 60) < 1e-9, "ink on the tooth travels the full pull");
  assert.ok(mid[0] > 20 && mid[0] < 25, "ink beside it follows part of the way");
  assert.ok(far[0] < 0.001, "ink well away from it does not move");
  for (const points of [near, mid, far]) {
    assert.equal(points[1], points === near ? 0 : points === mid ? 30 : 400);
  }

  // A longer falloff moves a whole band together, which is what draws bands
  // out into ribbons instead of tearing their near edge into a spike.
  const tight = [0, 40];
  const broad = [0, 40];
  tine(tight, 0, 0, 1, 0, 60, 12);
  tine(broad, 0, 0, 1, 0, 60, 90);
  assert.ok(broad[0] > tight[0] * 8);
});

test("a vortex turns ink about a point and fades with distance", () => {
  const points = [10, 0, 400, 0];
  vortex(points, 0, 0, Math.PI / 2, 60);
  assert.ok(Math.abs(Math.hypot(points[0], points[1]) - 10) < 1e-9, "rotation keeps radius");
  assert.ok(points[1] > 5, "ink near the stylus swings round");
  assert.ok(Math.abs(points[3]) / 400 < 0.005, "ink far away barely stirs");
});

test("a ripple swings ink along its own axis and repeats with its wavelength", () => {
  const crest = [0, 0];
  const trough = [0, 50];
  ripple(crest, 1, 0, 10, 200, Math.PI / 2);
  ripple(trough, 1, 0, 10, 200, Math.PI / 2);
  assert.ok(Math.abs(crest[0] - 10) < 1e-9, "the crest gets the full amplitude");
  assert.ok(trough[0] < crest[0], "half a wavelength later it swings back");
  assert.equal(crest[1], 0, "nothing moves across the ripple");

  const first = [0, 17];
  const repeat = [0, 17 + 200];
  ripple(first, 1, 0, 10, 200, 0.3);
  ripple(repeat, 1, 0, 10, 200, 0.3);
  assert.ok(Math.abs(first[0] - repeat[0]) < 1e-9, "one wavelength on is the same swing");
});

test("refining follows the ink: it splits stretched edges and drops bunched points", () => {
  const stretched = circle(0, 0, 30, 2.4);
  const startCount = stretched.length / 2;
  // Drawn out hard, the original vertices would otherwise show as corners.
  tine(stretched, 0, 0, 1, 0, 600, 40);
  const refined = refine(stretched, 2.6, 0.8);
  assert.ok(refined.length / 2 > startCount, "a stretched boundary gains points");
  let longest = 0;
  for (let i = 0; i < refined.length; i += 2) {
    const j = (i + 2) % refined.length;
    longest = Math.max(longest, Math.hypot(refined[j] - refined[i], refined[j + 1] - refined[i + 1]));
  }
  assert.ok(longest < 6, `no edge is left coarse, longest was ${longest}`);

  // Points crowded closer than the floor are dropped rather than carried.
  const crowded = circle(0, 0, 4, 0.05);
  assert.ok(refine(crowded, 2.6, 0.8).length < crowded.length);

  // And no boundary may sprawl past the budget at the rest of the tray's cost.
  const huge = circle(0, 0, 4000, 0.5);
  const capped = refine(huge, 2.6, 0.8, 520);
  assert.equal(capped.length / 2, 520);
  for (const value of capped) assert.ok(Number.isFinite(value));

  // Refining must not duplicate the closing point into a zero-length edge.
  const plain = refine(circle(0, 0, 20, 2.4), 2.6, 0.8);
  assert.ok(
    Math.hypot(plain[0] - plain[plain.length - 2], plain[1] - plain[plain.length - 1]) > 1e-6,
  );
});

test("ink carried off the paper is culled, and ink still touching it is kept", () => {
  const inside = circle(600, 400, 50);
  const straddling = circle(-20, 400, 50);
  const gone = circle(-500, 400, 50);
  assert.equal(offPaper(inside, 1200, 840), false);
  assert.equal(offPaper(straddling, 1200, 840), false, "ink half on the page stays");
  assert.equal(offPaper(gone, 1200, 840), true);
});

test("every pour palette carries enough pigment to vein with", () => {
  const names = Object.keys(PALETTES);
  assert.ok(names.length >= 4);
  for (const name of names) {
    const palette = PALETTES[name];
    assert.ok(palette.inks.length >= 4, `${name} has enough pigments`);
    assert.match(palette.metal, /^#[0-9a-f]{6}$/i, `${name} has a leafing colour`);
    assert.match(palette.swatch, /^#[0-9a-f]{6}$/i, `${name} has a swatch`);
    for (const [hex, weight] of palette.inks) {
      assert.match(hex, /^#[0-9a-f]{6}$/i);
      assert.ok(weight > 0, `${name} gives every pigment a share of the tray`);
    }

    const next = createInkOrder(palette, seeded(names.indexOf(name) + 3));
    const drawn = [];
    for (let i = 0; i < 300; i++) {
      const ink = next();
      assert.equal(ink.length, 3);
      for (const channel of ink) assert.ok(channel >= 0 && channel <= 255);
      drawn.push(ink.map(Math.round).join(","));
    }
    assert.ok(
      new Set(drawn).size >= palette.inks.length,
      `${name} draws on its whole palette across a pour`,
    );
  }
});

test("a pour never lays the same pigment twice running", () => {
  // Two bands of one pigment fuse into one and the vein between them is lost.
  // Two pigments far enough apart that the order's tonal drift can never make
  // one look like the other, so a repeat is unambiguous.
  const heavy = { inks: [["#ff0000", 5], ["#0000ff", 2]] };
  for (let run = 1; run <= 40; run++) {
    const next = createInkOrder(heavy, seeded(run));
    let previous = null;
    for (let i = 0; i < 200; i++) {
      const [red, , blue] = next();
      const pigment = red > blue ? "red" : "blue";
      assert.notEqual(pigment, previous, `seed ${run} laid two of one pigment in a row`);
      previous = pigment;
    }
  }

  // A pour of a single pigment has nothing to alternate with and must simply
  // keep going rather than spin looking for a colour that is not in the bag.
  const single = createInkOrder({ inks: [["#334455", 3]] }, seeded(2));
  for (let i = 0; i < 50; i++) assert.equal(single().length, 3);
});
