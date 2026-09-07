import test from "node:test";
import assert from "node:assert/strict";
import { PARTS, COMPONENT_POOLS } from "../brushes/gunpla/components.js";
import { createComponent } from "../brushes/gunpla/plates.js";
import { createLayout, reserveComponent } from "../brushes/gunpla/layout.js";
import { createBurst, burstPose, BURST_DURATION } from "../brushes/gunpla/burst.js";

const settings = { parts: "mixed", size: 1, variation: 1.2, texture: 1, details: 1.4, color: "graphite", labels: true };
function seeded() {
  let state = 17;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
}

test("components burst from the nearest older part, with a bounded ripple and a blank first instant", () => {
  const first = createBurst(115, 100, [], 0, { x: 100, y: 100 });
  const initial = burstPose(first, 0);
  assert.deepEqual([initial.x, initial.y, initial.scale, initial.alpha], [100, 100, 0, 0]);
  assert.ok(burstPose(first, 28).scale > 1, "parts launch to full size within the first two frames");
  const peak = burstPose(first, 72);
  assert.ok(peak.scale >= 1.5 && peak.x > first.x && peak.stretch > 2.7 && peak.shear > 0.4,
    "the burst dramatically swells, stretches, shears and shoots past its destination");
  assert.ok(Math.abs(burstPose(first, 20).rotation) > 0.65, "the launch has a pronounced twist");
  const recoil = burstPose(first, 160);
  assert.ok(recoil.scale < 1 && recoil.stretch < 0.6, "parts counter-squash before locking into place");
  assert.deepEqual(burstPose(first, BURST_DURATION),
    { x: 115, y: 100, scale: 1, stretch: 1, shear: 0, rotation: 0, alpha: 1, done: true });
  first.settled = true;
  const distant = { ...createBurst(800, 100, [first], 0), settled: true };
  const nearby = createBurst(180, 130, [first, distant], 20);
  assert.deepEqual(nearby.from, { x: 115, y: 100 }, "choose the nearest part, not merely the latest part");
  assert.equal(nearby.start, 20, "a settled source adds no delay");
  const older = [createBurst(0, 0, [], 0)];
  for (let i = 1; i <= 200; i++) {
    const child = createBurst(i * 31, 0, older, 0);
    const parentPose = burstPose(older.at(-1), child.start);
    assert.deepEqual(child.from, { x: parentPose.x, y: parentPose.y }, "emerge from the moving parent's visible position");
    assert.ok(child.start <= 50, "long swipes and auto-fill never accumulate a slow queue");
    older.push(child);
  }
  assert.ok(older.every(burst => burstPose(burst, 290).done));
});

test("Gunpla includes small connectors, large shells and long weapons with distinct native sizes", () => {
  const kinds = COMPONENT_POOLS.mixed;
  assert.ok(kinds.length >= 35);
  assert.equal(new Set(kinds).size, kinds.length);
  assert.ok(kinds.every(kind => PARTS[kind]?.shape && PARTS[kind]?.seams));
  assert.ok(Object.values(PARTS).filter(part => part.traced && part.reference && part.relief).length >= 14, "the main shell and weapon molds use the supplied reference contours and recessed detail");
  const fixed = { ...settings, variation: 0 };
  const small = createComponent(seeded(), fixed, 1, "ballcap");
  const large = createComponent(seeded(), fixed, 2, "bazooka");
  assert.ok(large.width * large.scale > small.width * small.scale * 8, "long weapons are not normalized to socket size");
  const random = seeded();
  const scales = Array.from({ length: 50 }, (_, i) => createComponent(random, settings, i + 1, "chest").scale);
  assert.ok(Math.max(...scales) / Math.min(...scales) > 1.8, "the same mold also has visible scale variation");
});

test("multi-cell bays place one component at a time, fill a runner without overlap, and preserve occupied parts", () => {
  const random = seeded();
  const layout = createLayout(31, { columns: 18, rows: 13 });
  const kinds = COMPONENT_POOLS.mixed;
  let index = 0;
  for (let row = 0; row < 13; row++) {
    for (let column = 0; column < 18; column++) {
      if (layout.cells.has(`${column},${row}`)) continue;
      const before = layout.pieces.length;
      const part = createComponent(random, settings, index + 1, kinds[index++ % kinds.length]);
      const placed = reserveComponent(layout, part, column, row);
      assert.ok(placed);
      assert.equal(layout.pieces.length, before + 1, "one input placement adds exactly one component");
    }
  }
  assert.equal(layout.cells.size, 18 * 13);
  assert.equal(layout.pieces.reduce((area, piece) => area + piece.columns * piece.rows, 0), layout.cells.size, "no two components occupy the same area");
  assert.ok(new Set(layout.pieces.map(piece => piece.columns)).size >= 3);
  assert.ok(new Set(layout.pieces.map(piece => piece.rows)).size >= 3);
  for (const piece of layout.pieces) {
    assert.ok(piece.column >= 0 && piece.row >= 0);
    assert.ok(piece.column + piece.columns <= 18 && piece.row + piece.rows <= 13);
  }
  const before = [...layout.pieces];
  for (const [position, original] of layout.cells) {
    const [column, row] = position.split(",").map(Number);
    assert.equal(reserveComponent(layout, original.part, column, row), null);
    assert.equal(layout.cells.get(position), original);
  }
  assert.deepEqual(layout.pieces, before);
});
