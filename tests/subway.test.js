import test from "node:test";
import assert from "node:assert/strict";
import { extendRoute, roundedRoute, pointAt } from "../brushes/subway/geometry.js";
import createBrush from "../brushes/subway/sketch.js";
import { createStrands } from "../brushes/subway/network.js";
import { schedulePath, revealedDistance, prefix, detailOpacity, createFollower, followTo, advanceFollower, arrivalAt, timingComplete } from "../brushes/subway/animation.js";
import { FAMILIES, turnPalettes, serviceAt } from "../brushes/subway/palette.js";
import { stationDetail } from "../brushes/subway/annotations.js";

test("subway routes absorb hand jitter and keep turns on 45-degree directions", () => {
  const straight = [{ x: 0, y: 0 }];
  for (let x = 1; x < 600; x += 3)
    extendRoute(straight, { x, y: Math.sin(x) * 2 }, 60);
  assert.equal(straight.length, 2, "a wavering hand still makes one straight run");
  assert.ok(Math.abs(straight[1].y) < 1e-6);

  const points = [{ x: 170, y: -50 }];
  const input = [[170, -50], [170, 290], [360, 480], [360, 1150]];
  for (let i = 1; i < input.length; i++) {
    const a = input[i - 1], b = input[i];
    const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3);
    for (let k = 1; k <= steps; k++)
      extendRoute(points, { x: a[0] + (b[0] - a[0]) * k / steps, y: a[1] + (b[1] - a[1]) * k / steps }, 115.584);
  }
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x, dy = points[i].y - points[i - 1].y;
    assert.ok(dx >= -1e-6 && dy >= -1e-6, "turning from a diagonal into a straight must not make a backward hook");
    const octant = Math.atan2(dy, dx) / (Math.PI / 4);
    assert.ok(Math.abs(octant - Math.round(octant)) < 1e-6);
  }
  extendRoute(points, { x: -1200, y: -1200 }, 115.584);
  assert.ok(points.length < 100, "sparse input and sudden reversals remain bounded");
  assert.ok(points.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y)));
});

test("parallel subway lanes retain their spacing around a circular bend", () => {
  const samples = roundedRoute([{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 120 }], 30);
  const arc = samples.filter((point) => !point.straight);
  assert.ok(arc.length > 10);
  for (const point of arc) {
    assert.ok(Math.abs(Math.hypot(point.tx, point.ty) - 1) < 1e-6);
    for (const offset of [-15, 0, 15]) {
      const x = point.x - point.ty * offset, y = point.y + point.tx * offset;
      assert.ok(Math.abs(Math.hypot(x - 90, y - 30) - (30 - offset)) < 1e-6);
    }
  }
  const start = pointAt(samples, -100), end = pointAt(samples, Infinity);
  assert.deepEqual([start.x, start.y], [0, 0]);
  assert.deepEqual([end.x, end.y], [120, 120]);
  for (let i = 1; i < samples.length; i++) assert.ok(samples[i].d > samples[i - 1].d);
});

test("subway settings reject invalid values and stay isolated between factories", () => {
  const a = createBrush({}), b = createBrush({});
  a.setSetting("color", "red");
  a.setSetting("routes", 2);
  a.setSetting("size", 500);
  a.setSetting("density", -10);
  a.setSetting("labels", false);
  a.setSetting("divergence", 5);
  a.setSetting("details", 5);
  assert.deepEqual(a.getSettings(), { size: 3, density: .4, details: 2, divergence: 2, color: "red", routes: "2", labels: false });
  assert.deepEqual(b.getSettings(), { size: 1, density: 1, details: 1.25, divergence: 1, color: "auto", routes: "4", labels: true });
  for (const [key, value] of [["size", NaN], ["density", Infinity], ["details", NaN], ["divergence", Infinity], ["color", "invalid"], ["routes", "7"], ["labels", "false"]])
    a.setSetting(key, value);
  assert.deepEqual(a.getSettings(), { size: 3, density: .4, details: 2, divergence: 2, color: "red", routes: "2", labels: false });
});

test("subway animation follows arc length and branches wait for their junction", () => {
  const samples = roundedRoute([{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 120 }], 30);
  const main = schedulePath({ size: 1, lane: 2, samples }, 1000);
  const branch = schedulePath({ size: 1, lane: 2, samples, spur: true, branchAt: 90 }, 1000);
  assert.equal(revealedDistance(main, 1000), 0);
  assert.equal(revealedDistance(branch, main.start + 90 / main.speed * 1000), 0);
  assert.ok(revealedDistance(main, branch.start) >= 90, "the parent line reaches the junction first");
  const halfway = prefix(samples, 135);
  assert.ok(halfway.length > 2 && halfway.length < samples.length);
  assert.deepEqual([halfway.at(-1).x, halfway.at(-1).y], [pointAt(samples, 135).x, pointAt(samples, 135).y]);
  assert.equal(detailOpacity(main, 80, 90), 0, "station details cannot precede the drawing tip");
  assert.equal(detailOpacity(main, 200, 90), 1);
  assert.deepEqual(prefix(samples, 0), []);
  assert.deepEqual(prefix(samples, revealedDistance(main, Infinity)), samples);
  const freshBranch = schedulePath({ size: 1, lane: 2, samples, branch: true, bornAt: 5000 }, 1000, true);
  assert.equal(revealedDistance(freshBranch, 5000), 0, "a new branch starts fresh even after a long pause");
  assert.ok(revealedDistance(freshBranch, 5100) > 0);
});

test("main lines trail the pen slightly, catch up smoothly and restart their delay after a pause", () => {
  const follower = createFollower(1, 0);
  followTo(follower, 200, 0);
  assert.equal(advanceFollower(follower, 0), 158, "a fast move leaves only a short trailing distance");
  const junctionAt = arrivalAt(follower, 180, 0);
  assert.ok(junctionAt > 0 && junctionAt < 100);
  assert.ok(Math.abs(advanceFollower(follower, junctionAt) - 180) < 1e-6);
  const progress = advanceFollower(follower, 100);
  assert.ok(progress > 185 && progress < 200);
  assert.equal(advanceFollower(follower, 1000), 200);
  followTo(follower, 500, 5000);
  assert.equal(follower.distance, 458, "elapsed idle time cannot reveal the new tail immediately");
  const samples = roundedRoute([{ x: 0, y: 0 }, { x: 30, y: 0 }], 28);
  const replacement = schedulePath({ size: 1, follower, followAt: 470, samples }, 0, true);
  assert.equal(revealedDistance(replacement, 5000), 0, "a new service waits for its origin");
  assert.ok(revealedDistance(replacement, 5070) > 0);
  assert.equal(timingComplete(replacement, 5070), false);
  assert.equal(timingComplete(replacement, 6000), true);
  assert.equal(revealedDistance(replacement, Infinity), Infinity);
  const auto = schedulePath({ size: 1, followAt: 470, samples }, 0);
  assert.equal(revealedDistance(auto, 1000), 0, "auto-fill also starts a replacement at its junction");
});

test("each turn replaces half the services with stable new colors", () => {
  const tracks = ["blue", "orange", "yellow", "green"].map((key) => ({ ink: FAMILIES[key].ink, code: FAMILIES[key].codes[0] }));
  for (let count = 1; count <= 4; count++) {
    const initial = tracks.slice(0, count), saved = structuredClone(initial);
    const palettes = turnPalettes(initial, 8, 17);
    assert.deepEqual(palettes.slice(0, 4), turnPalettes(initial, 3, 17), "extending a stroke preserves earlier choices");
    assert.deepEqual(initial, saved);
    for (let i = 1; i < palettes.length; i++) {
      const previous = palettes[i - 1];
      const changed = palettes[i].filter((service, lane) => service.ink !== previous[lane].ink);
      assert.equal(changed.length, Math.ceil(count / 2));
      assert.ok(changed.every((service) => !previous.some((old) => old.ink === service.ink)));
    }
  }
});

test("replacement colors begin separate lines at turns while the other services stay continuous", () => {
  const points = [{ x: 0, y: 0 }, { x: 180, y: 0 }, { x: 180, y: 180 }, { x: 420, y: 180 }];
  const route = { samples: roundedRoute(points, 28), size: 1, pitch: 5, width: 2.2,
    density: 1, labels: true, nameIndex: 0, seed: 17, divergence: 0,
    tracks: ["blue", "blue", "orange", "yellow"].map((key) => ({ ink: FAMILIES[key].ink, code: FAMILIES[key].codes[0] })) };
  const paths = createStrands(route);
  assert.equal(paths.length, 8, "four original lines plus two new services per turn");
  assert.equal(paths.filter((path) => path.startsService).length, 4);
  assert.equal(paths.filter((path) => path.endsService).length, 4);
  assert.deepEqual(paths, createStrands(route));
  const extended = createStrands({ ...route, samples: roundedRoute([...points.slice(0, -1), { x: 620, y: 180 }], 28) });
  for (const path of paths) {
    assert.ok(path.colorStops.every((stop) => stop.service.ink === path.tracks[0].ink), "a line never changes its own color");
    assert.deepEqual(path.tracks, extended.find((next) => next.id === path.id).tracks);
    if (!path.startsService) continue;
    const previous = paths.find((other) => other.lane === path.lane && other.endsService && Math.abs(path.followAt - other.followAt - other.samples.at(-1).d - 9) < .001);
    assert.ok(previous, "new lines have a visible gap from the preceding service");
    assert.notEqual(path.tracks[0].ink, previous.tracks[0].ink);
    assert.ok(Math.hypot(path.samples[0].x - previous.samples.at(-1).x, path.samples[0].y - previous.samples.at(-1).y) > 8);
  }
  const branched = createStrands({ ...route, divergence: 2 });
  for (const branch of branched.filter((path) => path.branch)) {
    const parent = branched.find((path) => !path.branch && path.lane === branch.lane && branch.branchAt >= path.followAt && branch.branchAt <= path.followAt + path.samples.at(-1).d);
    assert.ok(parent, "offshoots attach to an existing service, never to a gap");
    assert.equal(branch.tracks[0].ink, serviceAt(parent, branch.branchAt - parent.followAt).service.ink);
  }
  const collinear = roundedRoute([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }], 28);
  assert.ok(collinear.every((point) => point.section === 0), "straight movement does not swap services");
});

test("map details are deterministic, varied and can be disabled", () => {
  const path = { details: 1.25, annotationSeed: 42, tracks: [{ code: "A", ink: "#0099c8" }] };
  const first = Array.from({ length: 60 }, (_, index) => stationDetail(path, { index }));
  const repeat = Array.from({ length: 60 }, (_, index) => stationDetail(path, { index }));
  assert.deepEqual(first, repeat, "symbols must not change while animating");
  const types = new Set(first.filter(Boolean).map((detail) => detail.type));
  for (const type of ["accessible", "transfer", "express", "rail", "airport", "ferry", "clock"])
    assert.ok(types.has(type), `includes ${type} annotations`);
  assert.equal(stationDetail({ ...path, details: 0 }, { index: 2 }), null);
});

test("subway divergence keeps the traced spine and adds stable, connected returning and terminal branches", () => {
  const route = { samples: roundedRoute([{ x: 0, y: 200 }, { x: 1000, y: 200 }], 28),
    size: 1, pitch: 5, width: 2.2, density: 1, labels: true, nameIndex: 0, seed: 17,
    tracks: ["A", "C", "D", "N"].map((code) => ({ code, ink: "#0099c8" })) };
  const parallel = createStrands({ ...route, divergence: 0 });
  const network = createStrands({ ...route, divergence: 1 });
  assert.equal(parallel.length, 4);
  assert.ok(parallel.every((path) => path.bounds.h === 0));
  assert.deepEqual(network, createStrands({ ...route, divergence: 1 }), "redrawing must not re-roll the network");
  assert.notDeepEqual(network, createStrands({ ...route, divergence: 1, seed: 18 }));
  const main = network.filter((path) => !path.branch), spurs = network.filter((path) => path.spur);
  const detours = network.filter((path) => path.branch && !path.spur);
  assert.equal(main.length, 4);
  assert.ok(detours.some((path) => path.bounds.h > 30), "returning branches leave the original bundle");
  assert.ok(spurs.length > 0, "terminal routes fork off the main services");
  for (let i = 0; i < main.length; i++) {
    assert.deepEqual(main[i].samples, parallel[i].samples, "branching keeps the drawn spine intact");
  }
  for (const branch of [...spurs, ...detours]) {
    const parent = main.find((path) => path.lane === branch.lane);
    const origin = branch.samples[0], junction = pointAt(parent.samples, branch.branchAt);
    assert.deepEqual([origin.x, origin.y], [junction.x, junction.y], "every branch starts on its parent service");
    if (!branch.spur) {
      const terminal = branch.samples.at(-1), rejoin = pointAt(parent.samples, branch.returnAt);
      assert.ok(Math.hypot(terminal.x - rejoin.x, terminal.y - rejoin.y) < .001);
    }
  }
  assert.equal(new Set(network.map((path) => path.id)).size, network.length, "branches have stable unique identities");
  for (const path of network) {
    assert.ok(path.samples.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)));
    for (let i = 1; i < path.samples.length; i++) assert.ok(path.samples[i].d > path.samples[i - 1].d);
  }
});
