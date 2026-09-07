import test from "node:test";
import assert from "node:assert/strict";
import createBrush from "../brushes/crowd/sketch.js";
import { GROW_DURATION, FIGURE_STAGGER, scheduleFigures, growthProgress, idleMotion } from "../brushes/crowd/animation.js";

test("crowd settings stay isolated and reject invalid presets", () => {
  const brush = createBrush({});
  const other = createBrush({});
  brush.setSetting("color", "blue");
  brush.setSetting("pose", "seated");
  brush.setSetting("size", 99);
  brush.setSetting("density", -3);
  brush.setSetting("spread", 0);
  const valid = brush.getSettings();
  assert.deepEqual(valid, { size: 3, density: 0.35, spread: 0, details: 0.7, color: "blue", pose: "seated", motion: true });
  for (const id of ["size", "density", "spread", "details"]) {
    brush.setSetting(id, Infinity);
    brush.setSetting(id, "invalid");
  }
  brush.setSetting("color", "__proto__");
  brush.setSetting("pose", "unknown");
  brush.setSetting("motion", "false");
  assert.deepEqual(brush.getSettings(), valid);
  brush.setSetting("motion", false);
  assert.equal(brush.getSettings().motion, false);
  assert.deepEqual(other.getSettings(), { size: 1, density: 1, spread: 0.55, details: 0.7, color: "blue", pose: "mixed", motion: true });
});

test("crowd growth starts at the pen with a short stagger and no backlog", () => {
  const queue = [];
  scheduleFigures(queue, [{ id: "first" }, { id: "second" }, { id: "third" }], 100);
  assert.deepEqual(queue.map(figure => figure.bornAt), [100, 125, 150]);
  scheduleFigures(queue, [{ id: "fourth" }, { id: "fifth" }], 110);
  assert.deepEqual(queue.map(figure => figure.id), ["first", "second", "third", "fourth", "fifth"]);
  assert.deepEqual(queue.map(figure => figure.bornAt), [100, 110, 110, 110, 135]);
  assert.ok(queue.every(figure => figure.duration === GROW_DURATION));
  scheduleFigures(queue, [{ id: "after-pause" }], 1500);
  assert.equal(queue.at(-1).bornAt, 1500, "a pause does not leave an unnecessary delay");
});

test("dense crowds shorten the waiting sequence without reordering or retiming active figures", () => {
  const queue = [];
  scheduleFigures(queue, Array.from({ length: 6 }, (_, id) => ({ id })), 0);
  const started = queue.filter(figure => figure.bornAt <= 100).map(figure => ({ ...figure }));
  scheduleFigures(queue, Array.from({ length: 200 }, (_, i) => ({ id: i + 6 })), 100);
  assert.deepEqual(queue.slice(0, started.length), started);
  assert.equal(queue[6].bornAt, 100, "a new group starts immediately even during a dense stroke");
  assert.ok(queue.at(-1).bornAt <= 220.001, "even a large batch starts within 120 ms");
  for (let i = 1; i < queue.length; i++) {
    assert.equal(queue[i].id, queue[i - 1].id + 1);
    assert.ok(queue[i].bornAt >= queue[i - 1].bornAt);
  }
  assert.ok(queue.at(-1).bornAt - queue.at(-2).bornAt < FIGURE_STAGGER);
});

test("ground-up growth starts on schedule, advances smoothly and completes exactly", () => {
  const figure = { y: 250, scale: 1, bornAt: 100, duration: GROW_DURATION };
  const original = { ...figure };
  assert.equal(growthProgress(figure, 99), 0);
  assert.equal(growthProgress(figure, 100), 0);
  assert.equal(growthProgress(figure, 100 + GROW_DURATION / 2), 0.5);
  assert.equal(growthProgress(figure, 100 + GROW_DURATION), 1);
  assert.equal(growthProgress(figure, 2000), 1);
  let previous = 0;
  for (let now = 100; now <= 100 + GROW_DURATION; now += 20) {
    const progress = growthProgress(figure, now);
    assert.ok(progress >= previous && progress <= 1);
    previous = progress;
  }
  assert.deepEqual(figure, original, "growth leaves the figure and its feet in place");
});

test("each person eases into independent motion only after their own entrance completes", () => {
  const figure = { kind: "person", index: 3, x: 120, y: 250, bornAt: 100, duration: GROW_DURATION };
  const original = { ...figure };
  const neutral = { lean: 0, breath: 1 };
  for (const now of [0, 500, 880]) assert.deepEqual(idleMotion(figure, "standing", now), neutral);
  const first = idleMotion(figure, "standing", 900);
  assert.ok(Math.abs(first.lean) < 0.001 && Math.abs(first.breath - 1) < 0.001, "motion starts gently");
  const moving = idleMotion(figure, "standing", 2000);
  assert.notDeepEqual(moving, neutral);
  assert.notDeepEqual(moving, idleMotion({ ...figure, x: 320 }, "standing", 2000));
  assert.notDeepEqual(idleMotion(figure, "seated", 2000, 0, 0), idleMotion(figure, "seated", 2000, 0, 1));
  for (const pose of ["standing", "walking", "seated"]) {
    for (let now = 900; now < 20000; now += 117) {
      const { lean, breath } = idleMotion(figure, pose, now);
      assert.ok(Math.abs(lean) <= 0.043 && breath >= 0.99 && breath <= 1.01);
    }
  }
  assert.deepEqual(idleMotion({ ...figure, kind: "object" }, "object", 2000), neutral);
  assert.deepEqual(figure, original, "animation never alters the source figure");
});

test("people resume smoothly from a settled pose, including entrances finished early", () => {
  const figure = { kind: "person", index: 0, x: 120, y: 250, bornAt: 1000, duration: GROW_DURATION, completedAt: 1100 };
  assert.notDeepEqual(idleMotion(figure, "standing", 1500), { lean: 0, breath: 1 }, "forced completion unlocks idle motion");
  assert.deepEqual(idleMotion(figure, "standing", 5000, 5000), { lean: 0, breath: 1 });
  const resumed = idleMotion(figure, "standing", 5001, 5000);
  assert.ok(Math.abs(resumed.lean) < 0.00001 && Math.abs(resumed.breath - 1) < 0.00001);
  assert.notDeepEqual(idleMotion(figure, "standing", 5500, 5000), { lean: 0, breath: 1 });
});
