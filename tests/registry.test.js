import test from "node:test";
import assert from "node:assert/strict";
import {
  brushes,
  createRegistry,
  requiredMethods,
  validateBrush,
} from "../shared/registry.js";
import { History } from "../shared/history.js";

test("all registered brush modules implement the shared lifecycle", async () => {
  assert.deepEqual([...brushes.keys()], ["score", "schematic", "balloon", "subway", "crowd", "gunpla", "marble", "pacman"]);
  for (const [id, registration] of brushes) {
    const module = await registration.load();
    const brush = validateBrush(module.default({}));
    assert.ok(
      requiredMethods.every((method) => typeof brush[method] === "function"),
      id,
    );
    const settings = brush.getSettings();
    for (const control of registration.controls)
      assert.ok(control.id in settings, `${id}.${control.id}`);
  }
});

test("brush factories keep settings isolated from each other", async () => {
  const { default: factory } = await brushes.get("score").load();
  const first = factory({});
  const second = factory({});
  first.setSetting("color", "red");
  assert.equal(first.getSettings().color, "red");
  assert.equal(second.getSettings().color, "auto");
});

test("registry rejects ambiguous IDs and incomplete brush interfaces", () => {
  const entry = brushes.get("score");
  assert.throws(() => createRegistry([entry, entry]), /duplicate/);
  assert.throws(() => createRegistry([{ ...entry, id: undefined }]), /Invalid/);
  assert.throws(
    () => createRegistry([{ ...entry, id: "../escape" }]),
    /Invalid/,
  );
  assert.throws(() => createRegistry([{ ...entry, load: null }]), /Incomplete/);
  assert.throws(() => createRegistry([]), /at least one/);
  assert.throws(() => validateBrush({}), /setup/);
});

test("history supports redo and drops the redo branch after a new edit", () => {
  const history = new History(3);
  history.checkpoint("blank");
  history.checkpoint("score");
  assert.equal(history.undo("score + balloon"), "score");
  assert.equal(history.redo("score"), "score + balloon");
  assert.equal(history.undo("score + balloon"), "score");
  history.checkpoint("score");
  assert.equal(history.canRedo, false);
  assert.equal(history.undo("score + schematic"), "score");
  assert.equal(history.undo("score"), "blank");
  assert.equal(history.undo("blank"), null);
});

test("history caps retained snapshots and handles empty stacks", () => {
  const history = new History(2);
  assert.equal(history.undo("blank"), null);
  assert.equal(history.redo("blank"), null);
  for (const state of ["a", "b", "c"]) history.checkpoint(state);
  assert.equal(history.undo("d"), "c");
  assert.equal(history.undo("c"), "b");
  assert.equal(history.canUndo, false);
});
