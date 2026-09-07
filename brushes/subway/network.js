import { pointAt, roundedRoute } from "./geometry.js";
import { turnPalettes, colorStops, serviceAt } from "./palette.js";

function randomSource(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// Connect waypoints with horizontal, vertical and diagonal segments, then
// round the corners. Each strand can leave the shared path independently.
function connect(points, radius) {
  const vertices = [points[0]];
  for (const b of points.slice(1)) {
    const a = vertices.at(-1), dx = b.x - a.x, dy = b.y - a.y;
    const diagonal = Math.min(Math.abs(dx), Math.abs(dy));
    if (diagonal > .01 && Math.abs(Math.abs(dx) - Math.abs(dy)) > .01)
      vertices.push({ x: a.x + Math.sign(dx) * diagonal, y: a.y + Math.sign(dy) * diagonal });
    if (Math.hypot(dx, dy) > .01) vertices.push(b);
  }
  return roundedRoute(vertices, radius);
}

function measure(samples) {
  let d = 0;
  const result = [];
  for (let i = 0; i < samples.length; i++) {
    const point = samples[i], prev = result.at(-1);
    const delta = prev ? Math.hypot(point.x - prev.x, point.y - prev.y) : 0;
    if (prev && delta < .001) continue;
    d += delta;
    result.push({ ...point, d });
  }
  return result;
}

function bounds(samples) {
  let x = Infinity, y = Infinity, right = -Infinity, bottom = -Infinity;
  for (const point of samples) {
    x = Math.min(x, point.x); y = Math.min(y, point.y);
    right = Math.max(right, point.x); bottom = Math.max(bottom, point.y);
  }
  return { x, y, w: right - x, h: bottom - y };
}

// A replacement service is a new path, with its own origin and a small gap
// from the departing service. Unchanged lanes stay continuous through a turn.
function serviceRuns(path) {
  const length = path.samples.at(-1).d, gap = 4.5 * path.size;
  const changes = path.colorStops.filter((stop, index, stops) =>
    index === 0 || stop.service.ink !== stops[index - 1].service.ink);
  return changes.flatMap((stop, index) => {
    const from = index ? stop.d + gap : 0;
    const to = changes[index + 1] ? changes[index + 1].d - gap : length;
    if (to <= from) return [];
    const samples = [
      { ...pointAt(path.samples, from), d: 0 },
      ...path.samples.filter((point) => point.d > from && point.d < to).map((point) => ({ ...point, d: point.d - from })),
      { ...pointAt(path.samples, to), d: to - from },
    ];
    return [{ ...path, id: index ? `${path.id}-${index}` : path.id,
      tracks: [stop.service], services: stop.services, samples, bounds: bounds(samples),
      followAt: from, laneLength: length, startsService: index > 0, endsService: index < changes.length - 1,
      colorStops: [{ ...stop, d: 0 }, ...path.colorStops.filter((item) => item.d > from && item.d < to).map((item) => ({ ...item, d: item.d - from }))],
      nameIndex: path.nameIndex + index * 3, annotationSeed: path.annotationSeed + index * 997 }];
  });
}

/** Keep the traced spine intact. Detours and terminal branches are separate
 * paths so they can grow independently as the pen passes their junctions.
 * Stable IDs let the brush preserve each branch's geometry and birth time.
 */
export function createStrands(route) {
  const { samples, size: s, pitch, tracks, seed, divergence } = route;
  const length = samples.at(-1)?.d || 0;
  if (!length) return [];
  const paths = [];
  const palettes = turnPalettes(tracks, samples.at(-1).section || 0, seed);
  for (let lane = 0; lane < tracks.length; lane++) {
    const random = randomSource(seed + lane * 7919);
    const offset = (lane - (tracks.length - 1) / 2) * pitch;
    const base = samples.map((point) => ({ ...point, x: point.x - point.ty * offset, y: point.y + point.tx * offset }));
    const main = measure(base);
    const mainLength = main.at(-1).d;
    const common = { size: s, width: route.width, span: route.width, count: 1, pitch: 0,
      tracks: [tracks[lane]], services: tracks, labels: route.labels, density: route.density,
      lane, details: route.details, annotationSeed: seed + lane * 691,
      nameIndex: route.nameIndex + lane * 3, side: lane % 2 ? 1 : -1 };
    const mainPath = { ...common, id: `main-${lane}`, samples: main, bounds: bounds(main),
      colorStops: colorStops(main, palettes, lane) };
    const runs = serviceRuns(mainPath);
    paths.push(...runs);
    const branchColors = (at) => {
      const current = serviceAt(mainPath, at);
      return { tracks: [current.service], services: current.services,
        colorStops: [{ ...current, d: 0 }] };
    };
    if (divergence > 0) {
      let start = (40 + random() * 90) * s;
      // Positions, reach and return points depend on the seed, never frame time.
      while (start < mainLength) {
        const travel = (130 + random() * 150) * s;
        const end = start + travel;
        const sign = random() < .5 ? -1 : 1;
        const reach = (35 + random() * 110) * s * divergence;
        const eligible = random() < .7;
        const rounding = (10 + random() * 15) * s;
        if (eligible && end < mainLength - 40 * s && runs.some((run) => start >= run.followAt && end <= run.followAt + run.samples.at(-1).d)) {
          const a = pointAt(main, start), b = pointAt(main, end);
          const angle = Math.round(Math.atan2(a.ty, a.tx) / (Math.PI / 4)) * Math.PI / 4;
          const tx = Math.cos(angle), ty = Math.sin(angle);
          const nx = -ty * sign, ny = tx * sign;
          const forward = (b.x - a.x) * tx + (b.y - a.y) * ty;
          const sideways = Math.abs((b.x - a.x) * nx + (b.y - a.y) * ny);
          // A through-service detour needs room to come back without folding
          // over itself. Curved stretches can still sprout terminal branches.
          if (forward > 80 * s && sideways < 25 * s && tx * b.tx + ty * b.ty > .9) {
            const spread = Math.min(reach, (forward - 24 * s) * .4);
            const branch = connect([
              a,
              { x: a.x + tx * 12 * s, y: a.y + ty * 12 * s },
              { x: a.x + tx * (spread + 12 * s) + nx * spread, y: a.y + ty * (spread + 12 * s) + ny * spread },
              { x: b.x - tx * (spread + 12 * s) + nx * spread, y: b.y - ty * (spread + 12 * s) + ny * spread },
              { x: b.x - tx * 12 * s, y: b.y - ty * 12 * s },
              b,
            ], rounding);
            paths.push({ ...common, ...branchColors(start), id: `detour-${lane}-${start.toFixed(4)}`,
              samples: branch, bounds: bounds(branch), branch: true, branchAt: start,
              returnAt: end, nameIndex: common.nameIndex + 5 });
          }
        }
        start = end + (60 + random() * 130) * s / Math.max(.35, divergence);
      }
    }
    if (divergence <= 0) continue;
    const branchRandom = randomSource(seed + lane * 1543 + 47);
    let anchor = (65 + branchRandom() * 110) * s;
    while (anchor < mainLength - 40 * s) {
      const side = branchRandom() < .5 ? -1 : 1;
      const reach = (35 + branchRandom() * 90) * s * divergence;
      const run = (30 + branchRandom() * 90) * s;
      const kink = branchRandom() < .5 ? 1 : -1;
      // Keep the number of offshoots lower than the number of through services.
      if (branchRandom() < .38 * Math.min(divergence, 1.5) && runs.some((run) => anchor >= run.followAt && anchor <= run.followAt + run.samples.at(-1).d)) {
        const a = pointAt(main, anchor);
        const angle = Math.round(Math.atan2(a.ty, a.tx) / (Math.PI / 4)) * Math.PI / 4;
        const tx = Math.cos(angle), ty = Math.sin(angle), nx = -ty * side, ny = tx * side;
        const fork = { x: a.x + tx * reach + nx * reach, y: a.y + ty * reach + ny * reach };
        const terminal = { x: fork.x + tx * run + nx * run * kink * .5, y: fork.y + ty * run + ny * run * kink * .5 };
        const spur = connect([a, { x: a.x + tx * 12 * s, y: a.y + ty * 12 * s }, fork, terminal], 13 * s);
        paths.push({ ...common, ...branchColors(anchor), id: `spur-${lane}-${anchor.toFixed(4)}`,
          samples: spur, bounds: bounds(spur), branch: true, spur: true, branchAt: anchor,
          nameIndex: common.nameIndex + 7 });
      }
      anchor += (180 + branchRandom() * 230) * s / Math.max(.35, divergence);
    }
  }
  return paths;
}
