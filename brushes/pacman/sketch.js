import {
  BOARDS,
  BOARD_KEYS,
  FRUIT,
  GHOSTS,
  TILE,
} from "./arcade.js";
import {
  beginCorridor,
  extendCorridor,
  layPellets,
  measureCorridor,
  paintMaze,
  paintPellets,
  pointAt,
} from "./maze.js";
import { chaseDistance, chaseReach, chomp, eatTo, fright, skirtFrame } from "./chase.js";
import { drawFruit, drawGhost, drawPac, drawScore } from "./sprites.js";

// Pac-Man Brush
//
// A stroke is a corridor of the maze, and a chase down it. The pen is
// followed a tile at a time along one axis until it runs out of distance on
// it, so a free-hand drag comes out as the long runs and square corners the
// board is made of, and every corridor lands on the same paper-anchored grid
// so separate strokes join into one maze. Pellets go down the middle, power
// pellets at the mouth and every dozen after.
//
// Then Pac-Man enters at the start and runs it at the cabinet's pace, which
// is slower than your hand. He clears the pellets he passes and stops after a
// set run, leaving the rest of the corridor still laid — the half-eaten
// corridor with the ghosts closing in that the game always looks like. Take a
// power pellet on the way and the ghosts behind him turn blue and blink.
//
// Walls are held as vectors while they can be, because each band of a wall
// has to be laid across every corridor before the next band starts or a new
// corridor would paint its wall straight across an older one's floor and shut
// the junction.

const RUN_BUDGET = 12; // corridors kept as vectors, so crossings still merge
const CHASE_TILES = 11; // tiles Pac-Man runs at chase 1
const GHOST_GAP = 1.55; // tiles between one ghost and the next
const GHOST_LEAD = 1.85; // tiles between Pac-Man and the first ghost

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const drawable = (x, y) => Number.isFinite(x) && Number.isFinite(y);
const RANGES = { size: [0.4, 3], density: [0.4, 2], chase: [0.3, 3], ghosts: [0, 4] };

export default function createBrush(p) {
  let walls = null; // the maze as painted, redrawn only when a corridor grows
  let baked = null; // corridors too old to keep as vectors
  let runs = [];
  let active = null;
  let dirty = true;
  let seed = 1;

  let size = 1;
  let density = 1;
  let chase = 1;
  let ghosts = 2;
  let color = "auto";
  let extras = true;

  function random(min = 1, max) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const unit = seed / 4294967296;
    return max === undefined ? unit * min : min + unit * (max - min);
  }

  function layer() {
    const graphics = p.createGraphics(p.width, p.height);
    graphics.pixelDensity(p.pixelDensity());
    return graphics;
  }

  function board() {
    // A named board keeps its colour. Left to itself the brush changes colour
    // every stroke, the way the cabinet changes it every level.
    if (color !== "auto") return BOARDS[color];
    return BOARDS[BOARD_KEYS[Math.floor(random(BOARD_KEYS.length))]];
  }

  // ------------------------------------------------------------------- runs

  function startRun(x, y) {
    const tile = TILE * size;
    const corridor = beginCorridor(tile, x, y);
    active = {
      corridor,
      tile,
      wall: board().wall,
      track: measureCorridor(corridor),
      pellets: [],
      fruit: null,
      scores: [],
      power: null,
      start: p.millis(),
      chase: CHASE_TILES * chase * tile,
      distance: 0,
      crew: Array.from({ length: Math.round(ghosts) }, (_, i) => ({
        ...GHOSTS[i % GHOSTS.length],
        lag: (GHOST_LEAD + i * GHOST_GAP) * tile,
      })),
      seed: seed >>> 0,
      settled: false,
      // A board carries one bonus fruit at a time, not one per corridor, so
      // whether this corridor is the one holding it is settled up front.
      bonus: random() < 0.42,
    };
    runs.push(active);
    relayRun(active);
    dirty = true;
    return active;
  }

  /** Pellets and fruit are laid over the whole corridor each time it grows,
   * keeping what has already been eaten eaten. */
  function relayRun(run) {
    run.track = measureCorridor(run.corridor);
    const eaten = new Set(run.pellets.filter((pellet) => pellet.eaten).map((pellet) => pellet.d));
    run.pellets = layPellets(run.corridor, run.track, 1 / density, run.seed);
    for (const pellet of run.pellets) {
      if (eaten.has(pellet.d)) {
        pellet.eaten = true;
        if (pellet.power) run.power = run.power ?? pellet.d;
      }
    }
    // Bonus fruit either falls well inside the chase, and leaves its score
    // behind, or waits out in the stretch he never reaches — which is how a
    // board looks most of the time. It is placed by which side of his stopping
    // point it is on rather than by a distance, so it can never land on top
    // of him. A corridor with nothing past the chase only gets the first kind.
    if (extras && run.bonus && !run.fruit && run.track.length > run.tile * 6) {
      const kind = FRUIT[Math.floor(random(FRUIT.length))];
      const reach = chaseReach(run);
      const beyond = run.track.length - reach;
      // The ghosts settle in a fixed train behind him, so the only clear floor
      // is past the end of the chase or behind the last ghost in it.
      const cleared = reach - (run.crew.at(-1)?.lag ?? 0) - run.tile;
      const past = beyond > run.tile * 3;
      const d = past && (cleared <= run.tile || random() < 0.55)
        ? reach + beyond * random(0.25, 0.85)
        : Math.max(run.tile * 0.5, cleared) * random(0.2, 0.9);
      const at = pointAt(run.track, d);
      run.fruit = { ...kind, d, x: at.x, y: at.y, eaten: false };
    } else if (run.fruit && !run.fruit.eaten) {
      // Keep it where it was laid, but never beyond the corridor's end.
      run.fruit.d = Math.min(run.fruit.d, run.track.length);
      const at = pointAt(run.track, run.fruit.d);
      run.fruit.x = at.x;
      run.fruit.y = at.y;
    }
  }

  function settle() {
    for (const run of runs) {
      run.distance = chaseReach(run);
      run.settled = true;
      eatTo(run, run.distance);
    }
    active = null;
    dirty = true;
  }

  /** Older corridors are painted down for good once too many are held. They
   * lose the ability to merge with a new crossing, which costs far less than
   * relaying every wall of every corridor on the page each time one grows.
   * Only a finished chase is safe to freeze. */
  function bakeOverflow() {
    while (runs.length > RUN_BUDGET && runs[0] !== active && runs[0].settled) {
      const run = runs.shift();
      baked ||= layer();
      const ctx = baked.drawingContext;
      paintMaze(ctx, [run]);
      paintPellets(ctx, run.pellets, run.tile, true);
      paintFruit(ctx, run);
      paintCrew(ctx, run, run.distance);
      paintScores(ctx, run);
      dirty = true;
    }
  }

  // ----------------------------------------------------------------- render

  function paintFruit(ctx, run) {
    if (run.fruit && !run.fruit.eaten) {
      drawFruit(ctx, run.fruit.id, run.fruit.x, run.fruit.y, run.tile * 0.5);
    }
  }

  /** Scores go on last. In the cabinet the number replaces what was eaten, so
   * it has to sit over the chase rather than be walked across by it. */
  function paintScores(ctx, run) {
    for (const score of run.scores) {
      drawScore(ctx, score.value, score.x, score.y, run.tile);
    }
  }

  function paintCrew(ctx, run, distance) {
    const scared = fright(run, distance);
    // Drawn back to front, so the ghost nearest Pac-Man is the one on top.
    for (let i = run.crew.length - 1; i >= 0; i--) {
      const ghost = run.crew[i];
      const at = distance - ghost.lag;
      if (at < 0) continue;
      const spot = pointAt(run.track, at);
      drawGhost(ctx, spot.x, spot.y, run.tile * 0.44, spot.dx, spot.dy, {
        color: ghost.color,
        frightened: scared.frightened,
        flashing: scared.flashing,
        frame: skirtFrame(at, run.tile),
      });
    }
    const head = pointAt(run.track, distance);
    drawPac(
      ctx,
      head.x,
      head.y,
      run.tile * 0.44,
      head.dx,
      head.dy,
      chomp(distance, run.tile),
    );
  }

  function draw() {
    const now = p.millis();
    bakeOverflow();
    if (dirty) {
      walls.clear();
      if (baked) walls.image(baked, 0, 0);
      paintMaze(walls.drawingContext, runs);
      dirty = false;
    }
    p.image(walls, 0, 0);
    // Pellets, fruit and the chase are cheap and change constantly, so they
    // are drawn over the walls every frame rather than repainting the whole
    // maze for each pellet that goes.
    const ctx = p.drawingContext;
    for (const run of runs) {
      if (!run.settled) {
        run.distance = chaseDistance(run, now);
        if (run !== active && run.distance >= chaseReach(run)) run.settled = true;
      }
      eatTo(run, run.distance);
      paintPellets(ctx, run.pellets, run.tile, run.settled || now % 420 < 280);
      paintFruit(ctx, run);
      paintCrew(ctx, run, run.distance);
      paintScores(ctx, run);
    }
  }

  function clear() {
    active = null;
    runs = [];
    baked?.clear();
    walls?.clear();
    dirty = true;
  }

  /** A board's worth of corridors: long runs on the shared grid, crossing
   * into one maze, each with its own chase entering a moment after the last. */
  function autoFill() {
    settle();
    const tile = TILE * size;
    const columns = Math.max(2, Math.floor(p.width / (tile * 7)));
    const rows = Math.max(2, Math.floor(p.height / (tile * 7)));
    const now = p.millis();
    for (let i = 0; i < columns * rows; i++) {
      const x = ((i % columns) + 0.5) * (p.width / columns);
      const y = (Math.floor(i / columns) + 0.5) * (p.height / rows);
      const run = startRun(x, y);
      let cx = x;
      let cy = y;
      for (let leg = Math.round(random(2, 5)); leg > 0; leg--) {
        if (random() < 0.5) cx += random(-1, 1) * tile * random(4, 10);
        else cy += random(-1, 1) * tile * random(4, 10);
        cx = clamp(cx, tile, p.width - tile);
        cy = clamp(cy, tile, p.height - tile);
        extendCorridor(run.corridor, cx, cy);
      }
      relayRun(run);
      run.start = now + i * 120;
    }
    active = null;
    dirty = true;
  }

  function getSettings() {
    return { size, density, chase, ghosts, color, extras };
  }

  function setSetting(id, value) {
    if (Object.hasOwn(RANGES, id)) {
      const number = Number(value);
      if (!Number.isFinite(number)) return;
      const [min, max] = RANGES[id];
      const next = clamp(number, min, max);
      if (id === "size") size = next;
      if (id === "density") density = next;
      if (id === "chase") chase = next;
      if (id === "ghosts") ghosts = Math.round(next);
      return;
    }
    if (id === "color" && (value === "auto" || Object.hasOwn(BOARDS, value))) color = value;
    if (id === "extras" && [true, false, "true", "false"].includes(value)) {
      extras = value === true || value === "true";
    }
  }

  return {
    setup(params = new URLSearchParams()) {
      seed = Math.floor(p.random() * 4294967296) >>> 0;
      walls = layer();
      for (const id of Object.keys(getSettings())) {
        if (params.has(id)) setSetting(id, params.get(id));
      }
    },
    resize() {
      clear();
      baked = null;
      if (walls.pixelDensity() !== p.pixelDensity()) walls.pixelDensity(p.pixelDensity());
      walls.resizeCanvas(p.width, p.height);
    },
    draw,
    pointerDown(x, y) {
      if (drawable(x, y)) startRun(x, y);
    },
    pointerMove(x, y) {
      if (!active || !drawable(x, y)) return;
      const head = active.corridor.nodes.at(-1).slice();
      extendCorridor(active.corridor, x, y);
      const grown =
        head[0] !== active.corridor.nodes.at(-1)[0] ||
        head[1] !== active.corridor.nodes.at(-1)[1];
      if (!grown) return;
      relayRun(active);
      dirty = true;
    },
    pointerUp() {
      active = null;
    },
    finish: settle,
    clear,
    autoFill,
    randomize() {
      settle();
      seed = Math.floor(p.random() * 4294967296) >>> 0;
    },
    getSettings,
    setSetting,
  };
}
