import { FLOOR, PELLET } from "./arcade.js";

/**
 * A corridor, on the terms the maze is built on.
 *
 * Nothing in Pac-Man moves diagonally. Everything sits on a tile grid, runs
 * along one axis at a time and turns only at a tile centre, and that
 * constraint is most of why the maze looks like the maze. So the pen is not
 * traced; it is followed a tile at a time, keeping to whichever axis it is
 * already travelling until the pen has no more distance left on it. A
 * diagonal drag becomes long runs and square corners instead of a staircase.
 *
 * The grid is anchored to the paper rather than to the stroke, so corridors
 * drawn at different times still line up into one maze.
 */
export function beginCorridor(tile, x, y) {
  const head = [Math.floor(x / tile), Math.floor(y / tile)];
  return { tile, nodes: [head], dir: null, pellets: [], laid: 0 };
}

function step(corridor, dx, dy) {
  const nodes = corridor.nodes;
  const head = nodes[nodes.length - 1];
  if (corridor.dir && corridor.dir[0] === dx && corridor.dir[1] === dy) {
    head[0] += dx;
    head[1] += dy;
    return;
  }
  // A turn fixes the head as a corner and starts a fresh one leaving it.
  nodes.push([head[0] + dx, head[1] + dy]);
  corridor.dir = [dx, dy];
}

/**
 * Tiles a corridor has to run sideways before it is allowed to turn.
 *
 * Holding the current axis only while the pen still has distance on it is not
 * enough. A pointer reports far more often than once a tile, so a slow
 * diagonal drag arrives as a run of alternating single steps and the corridor
 * comes out as a one-tile staircase, which no board is built from. Making a
 * turn wait until the pen has drifted a few tiles off the run instead means
 * the corridor trails the hand a little and spends that lag on long straights.
 */
const MIN_RUN = 3;

export function extendCorridor(corridor, x, y, limit = 400) {
  const ti = Math.floor(x / corridor.tile);
  const tj = Math.floor(y / corridor.tile);
  for (let steps = 0; steps < limit; steps++) {
    const head = corridor.nodes[corridor.nodes.length - 1];
    const di = ti - head[0];
    const dj = tj - head[1];
    if (!di && !dj) break;
    const along = corridor.dir?.[0] ? "x" : corridor.dir?.[1] ? "y" : null;
    const straight = along === "x" ? di : dj;
    const across = along === "x" ? dj : di;
    let axis = along;
    if (!along) axis = Math.abs(di) >= Math.abs(dj) ? "x" : "y";
    else if (!straight) {
      if (Math.abs(across) < MIN_RUN) break; // the turn has not been earned
      axis = along === "x" ? "y" : "x";
    }
    if (axis === "x") step(corridor, Math.sign(di), 0);
    else step(corridor, 0, Math.sign(dj));
  }
}

/** Tile coordinates as points on the paper, down the middle of the corridor,
 * with the running distance to each so anything travelling the corridor can
 * be placed by how far it has gone. */
export function measureCorridor(corridor) {
  const half = corridor.tile / 2;
  const points = corridor.nodes.map(([i, j]) => [
    i * corridor.tile + half,
    j * corridor.tile + half,
  ]);
  const distances = [0];
  for (let i = 1; i < points.length; i++) {
    distances.push(
      distances[i - 1] +
        Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]),
    );
  }
  return { points, distances, length: distances[distances.length - 1] };
}

/** Where a corridor has reached by distance `d`, and which way it is facing
 * there. Direction is always one of the four, so sprites face squarely. */
export function pointAt(track, d) {
  const { points, distances } = track;
  if (points.length < 2) return { x: points[0][0], y: points[0][1], dx: 1, dy: 0 };
  const clamped = Math.min(Math.max(d, 0), track.length);
  let segment = 1;
  while (segment < distances.length - 1 && distances[segment] < clamped) segment++;
  const a = points[segment - 1];
  const b = points[segment];
  const span = distances[segment] - distances[segment - 1] || 1;
  const t = (clamped - distances[segment - 1]) / span;
  return {
    x: a[0] + (b[0] - a[0]) * t,
    y: a[1] + (b[1] - a[1]) * t,
    dx: Math.sign(b[0] - a[0]),
    dy: Math.sign(b[1] - a[1]),
  };
}

/**
 * Pellets down the middle of a corridor, laid on tile centres a whole number
 * of tiles apart so they stay square with the grid however the density is
 * set. Power pellets are spaced out the way a board spaces its four — and
 * never at the very mouth, or every chase would begin with the ghosts already
 * frightened.
 */
export function layPellets(corridor, track, stride, seed) {
  const pellets = [];
  const step = Math.max(1, Math.round(stride)) * corridor.tile;
  // Far enough in that a chase usually passes under one rather than eating
  // it, so the ghosts keep their colours and a blue chase stays a surprise.
  let nextPower = 9 + (seed & 15);
  let index = 0;
  for (let d = 0; d <= track.length + 0.01; d += step) {
    const at = pointAt(track, d);
    const power = index === nextPower;
    if (power) nextPower = index + 9 + ((seed >>> (index % 12)) & 7);
    pellets.push({ d, x: at.x, y: at.y, power });
    index++;
  }
  return pellets;
}

/**
 * The walls.
 *
 * A board is not a line with an outline. Between two corridors the arcade
 * shows floor, a wall line, the dark inside of the wall block, another wall
 * line, then floor again. Stroking one corridor at a time would paint that
 * whole stack across its neighbour and close the junctions, so each band is
 * laid across every corridor before the next band starts. The unions then
 * merge, corners round off, and crossings stay open.
 */
const BANDS = [
  [1.88, "wall"],
  [1.64, "floor"],
  [1.24, "wall"],
  [1.0, "floor"],
];

export function paintMaze(ctx, runs) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const [width, role] of BANDS) {
    for (const run of runs) {
      ctx.strokeStyle = role === "wall" ? run.wall : FLOOR;
      ctx.lineWidth = width * run.tile;
      const points = run.track.points;
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
      // A single tile still needs a stroke to round off into a dead end.
      if (points.length === 1) ctx.lineTo(points[0][0] + 0.01, points[0][1]);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function paintPellets(ctx, pellets, tile, blink) {
  ctx.save();
  ctx.fillStyle = PELLET;
  for (const pellet of pellets) {
    if (pellet.eaten) continue;
    // Power pellets flash on the board until they are taken.
    if (pellet.power && !blink) continue;
    ctx.beginPath();
    ctx.arc(pellet.x, pellet.y, tile * (pellet.power ? 0.26 : 0.1), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
