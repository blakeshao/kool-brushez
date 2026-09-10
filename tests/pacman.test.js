import test from "node:test";
import assert from "node:assert/strict";
import { FLASH_TILES, POWER_TILES, SPEED, TILE } from "../brushes/pacman/arcade.js";
import {
  beginCorridor,
  extendCorridor,
  layPellets,
  measureCorridor,
  pointAt,
} from "../brushes/pacman/maze.js";
import {
  chaseDistance,
  chaseReach,
  chomp,
  eatTo,
  fright,
  skirtFrame,
} from "../brushes/pacman/chase.js";

const tile = TILE;

function segments(corridor) {
  const nodes = corridor.nodes;
  return nodes.slice(1).map(([i, j], index) => [i - nodes[index][0], j - nodes[index][1]]);
}

test("corridors keep to one axis at a time and spend a pointer's drift on long runs", () => {
  // A drag reported far more often than once a tile, which is the ordinary
  // case, is exactly what turns into a staircase if every turn is taken.
  const corridor = beginCorridor(tile, 0, 0);
  for (let step = 1; step <= 120; step++) {
    extendCorridor(corridor, step * tile * 0.34, step * tile * 0.34);
  }
  const legs = segments(corridor);
  assert.ok(legs.length > 4, "a long diagonal drag still turns repeatedly");
  for (const [dx, dy] of legs) {
    assert.ok((dx === 0) !== (dy === 0), "no leg moves on both axes at once");
  }
  const runs = legs.map(([dx, dy]) => Math.abs(dx || dy));
  for (const run of runs.slice(0, -1)) {
    assert.ok(run >= 3, `every completed run is at least three tiles, saw ${run}`);
  }

  // A single far-off target is one square corner, not a diagonal of blocks.
  const direct = beginCorridor(tile, 0, 0);
  extendCorridor(direct, 9.5 * tile, 9.5 * tile);
  assert.deepEqual(segments(direct), [[9, 0], [0, 9]]);
});

test("corridors drawn at different times land on one shared lattice", () => {
  // Anchoring the grid to the paper rather than to the stroke is what lets
  // separate strokes cross into a single maze.
  const first = beginCorridor(tile, 4.2 * tile, 7.9 * tile);
  extendCorridor(first, 4.2 * tile, 20 * tile);
  const second = beginCorridor(tile, 4.7 * tile, 30.1 * tile);
  extendCorridor(second, 4.7 * tile, 22 * tile);
  const centres = [...measureCorridor(first).points, ...measureCorridor(second).points];
  for (const [x, y] of centres) {
    assert.equal((x - tile / 2) % tile, 0, "x sits on a tile centre");
    assert.equal((y - tile / 2) % tile, 0, "y sits on a tile centre");
  }
  assert.equal(centres[0][0], centres.at(-1)[0], "both corridors share the same column");
});

test("a position along a corridor always faces one of the four directions", () => {
  const corridor = beginCorridor(tile, 0, 0);
  extendCorridor(corridor, 6.5 * tile, 0);
  extendCorridor(corridor, 6.5 * tile, 5.5 * tile);
  const track = measureCorridor(corridor);
  for (let d = -tile; d <= track.length + tile; d += tile / 3) {
    const at = pointAt(track, d);
    assert.ok(Number.isFinite(at.x) && Number.isFinite(at.y));
    assert.ok((at.dx === 0) !== (at.dy === 0), "never diagonal");
    assert.ok(Math.abs(at.dx) <= 1 && Math.abs(at.dy) <= 1);
  }
  // Past either end it holds at the end rather than running off the corridor.
  assert.deepEqual(pointAt(track, -50), pointAt(track, 0));
  assert.deepEqual(pointAt(track, track.length + 500), pointAt(track, track.length));

  // A one-tile corridor is a legal dead end, not a division by zero.
  const cell = measureCorridor(beginCorridor(tile, 0, 0));
  assert.deepEqual(pointAt(cell, 0), { x: tile / 2, y: tile / 2, dx: 1, dy: 0 });
});

test("pellets sit on tile centres, and no power pellet waits at the mouth", () => {
  const corridor = beginCorridor(tile, 0, 0);
  extendCorridor(corridor, 40.5 * tile, 0);
  const track = measureCorridor(corridor);
  for (const stride of [1 / 2, 1, 1 / 1.5, 2.4]) {
    const pellets = layPellets(corridor, track, stride, 0x9e3779b9);
    assert.ok(pellets.length > 1);
    for (const pellet of pellets) {
      assert.equal(pellet.d % tile, 0, "spacing stays a whole number of tiles");
      assert.equal((pellet.x - tile / 2) % tile, 0, "and lands square on the grid");
    }
    const powers = pellets.filter((pellet) => pellet.power);
    assert.ok(powers.length >= 1, "a long corridor holds power pellets");
    assert.ok(
      powers[0].d >= tile * 9,
      "the first one is far enough in that a chase can pass under it",
    );
  }
});

function chaseRun(overrides = {}) {
  const corridor = beginCorridor(tile, 0, 0);
  extendCorridor(corridor, 60.5 * tile, 0);
  const track = measureCorridor(corridor);
  const run = {
    tile,
    track,
    chase: 11 * tile,
    pellets: layPellets(corridor, track, 1, 0),
    fruit: null,
    scores: [],
    power: null,
    start: 1000,
    ...overrides,
  };
  return run;
}

test("settling a chase early lands on the frame it would have reached anyway", () => {
  // Pac-Man's mouth and the ghosts' skirts are driven by distance rather than
  // by the clock precisely so that finishing a stroke for history, export or
  // a brush switch cannot produce a different picture from letting it play.
  const played = chaseRun();
  const settled = chaseRun();
  const end = played.start + (chaseReach(played) / (SPEED * tile)) * 1000 + 500;
  const naturally = chaseDistance(played, end);
  const forced = chaseReach(settled);
  assert.equal(naturally, forced);
  assert.equal(chomp(naturally, tile), chomp(forced, tile));
  assert.equal(skirtFrame(naturally, tile), skirtFrame(forced, tile));

  eatTo(played, naturally);
  eatTo(settled, forced);
  assert.deepEqual(
    played.pellets.map((pellet) => Boolean(pellet.eaten)),
    settled.pellets.map((pellet) => Boolean(pellet.eaten)),
  );
});

test("a chase runs at arcade pace, stops where it is told, and never rewinds", () => {
  const run = chaseRun();
  assert.equal(chaseDistance(run, run.start - 400), 0, "nothing before he sets off");
  assert.equal(chaseDistance(run, run.start + 1000), SPEED * tile, "a second is a second's tiles");
  let last = 0;
  for (let now = run.start; now < run.start + 8000; now += 40) {
    const distance = chaseDistance(run, now);
    assert.ok(distance >= last, "distance only ever grows");
    assert.ok(distance <= chaseReach(run), "and stops at the end of the chase");
    last = distance;
  }
  assert.equal(last, 11 * tile);

  // A chase longer than its corridor stops at the end of the corridor.
  const short = chaseRun({ chase: 500 * tile });
  assert.equal(chaseReach(short), short.track.length);
});

test("only the pellets he has passed are eaten, and the last power pellet is what scares the ghosts", () => {
  const run = chaseRun();
  const cutoff = 6 * tile;
  eatTo(run, cutoff);
  for (const pellet of run.pellets) {
    assert.equal(Boolean(pellet.eaten), pellet.d <= cutoff, `pellet at ${pellet.d / tile} tiles`);
  }
  assert.equal(run.power, null, "no power pellet sits inside the first few tiles");

  const power = run.pellets.find((pellet) => pellet.power);
  eatTo(run, power.d);
  assert.equal(run.power, power.d);
  assert.ok(fright(run, power.d).frightened, "taking one turns the ghosts");
  assert.ok(
    !fright(run, power.d + POWER_TILES * tile).frightened,
    "and it wears off inside a chase, so a red ghost stays red most of the time",
  );
  // The blink is a warning, so it has to alternate, and only at the very end.
  const blinks = new Set();
  for (let since = 0; since < POWER_TILES * tile; since += tile / 8) {
    const state = fright(run, power.d + since);
    const late = since > (POWER_TILES - FLASH_TILES) * tile;
    if (!late) assert.ok(!state.flashing, "no blinking while there is time left");
    else blinks.add(state.flashing);
  }
  assert.deepEqual([...blinks].sort(), [false, true], "and it blinks rather than holds");
});

test("bonus fruit leaves its score exactly where it was taken, once", () => {
  const run = chaseRun({ fruit: { id: "cherry", value: 100, d: 4 * tile, x: 117, y: 13 } });
  eatTo(run, 2 * tile);
  assert.deepEqual(run.scores, [], "not until he reaches it");
  eatTo(run, 5 * tile);
  assert.deepEqual(run.scores, [{ x: 117, y: 13, value: 100 }]);
  eatTo(run, 9 * tile);
  assert.equal(run.scores.length, 1, "and never twice");
});

test("the mouth opens and shuts smoothly, and the skirt flicks between two frames", () => {
  const opens = [];
  for (let d = 0; d < tile * 4; d += tile / 24) opens.push(chomp(d, tile));
  assert.ok(Math.min(...opens) < 0.05 && Math.max(...opens) > 0.95, "it fully shuts and fully opens");
  for (const open of opens) assert.ok(open >= 0 && open <= 1);
  for (let i = 1; i < opens.length; i++) {
    assert.ok(Math.abs(opens[i] - opens[i - 1]) < 0.25, "without jumping between frames");
  }
  const frames = new Set();
  for (let d = 0; d < tile * 6; d += tile / 4) frames.add(skirtFrame(d, tile));
  assert.deepEqual([...frames].sort(), [0, 1]);
});
