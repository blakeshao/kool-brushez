import { circle, drop, offPaper, refine, ripple, tine, vortex } from "./fluid.js";
import { PALETTES, PALETTE_KEYS, createInkOrder, parseHex } from "./palette.js";
import { BLOOM, paintPigment, pigmentTones, scatterFlecks } from "./render.js";

// Marbling Brush
//
// The paper is a shallow tray of size. Dropping ink displaces everything
// already floating there, and dragging rakes it, so the pattern is a record of
// what the pen has done rather than a texture stamped along a path. Ink laid
// down first keeps being pushed by ink laid down later: one drop nests the
// last nine into nine thin rings, a drag draws those rings out into feathered
// veins, and a turn folds the veins into whorls and cells. Nothing is
// symmetrical or repeatable, because the whole tray is the state.
//
// Pigment is kept as boundaries, not pixels, for as long as it can be
// afforded, so later strokes deform earlier ink properly. Once the tray runs
// past its budget the oldest pigment — which is buried under everything
// newer anyway — is baked to raster and stops moving.

const BASE_RADIUS = 16; // px of a drop at size 1
const BASE_SPACING = 7.5; // px between drops at size 1 and density 1
const SCATTER = 1.15; // how far off the path a drop may land, in drop radii
const BLOOM_CHANCE = 0.1; // how often a pour lets go of a much larger drop
const WANDER = 0.3; // radians the rake may drift off the direction of travel
const MAX_SEGMENT = 2.6; // px, the longest edge a stretched boundary may keep
const MIN_SEGMENT = 0.85; // px, below which a boundary point is redundant
const MAX_BOUNDARY = 1100; // points even the broadest pigment may spend
const POINT_BUDGET = 60000; // points held as vectors across the whole tray
const SHAPE_BUDGET = 620; // pigments held as vectors
const MAX_STEPS = 72; // drops one pointer move may lay, however fast the swipe
const WET_BLUR = 4; // newest pigments still drawn with a wet edge

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const drawable = (x, y) => Number.isFinite(x) && Number.isFinite(y);
const RANGES = {
  size: [0.4, 3],
  density: [0.4, 2.2],
  rake: [0, 2],
  swirl: [0, 2],
  shimmer: [0, 2],
};

export default function createBrush(p) {
  let paint = null; // the composited tray, redrawn only when the ink moves
  let baked = null; // pigment too old to keep as vectors, allocated on demand
  let tray = [];
  let stroke = null;
  let boundaryPoints = 0;
  let dirty = true;
  let wetUntil = 0;
  let seed = 1;

  let size = 1;
  let density = 1;
  let rake = 1;
  let swirl = 1;
  let shimmer = 0.7;
  let color = "auto";
  let veins = true;

  function random(min = 1, max) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const unit = seed / 4294967296;
    if (max === undefined) return unit * min;
    return min + unit * (max - min);
  }

  function layer() {
    const graphics = p.createGraphics(p.width, p.height);
    graphics.pixelDensity(p.pixelDensity());
    return graphics;
  }

  function palette() {
    // A named pour keeps its own pigments. A mixed pour settles on one set per
    // stroke, so a single drag stays coherent while the page varies.
    if (color !== "auto") return PALETTES[color];
    return PALETTES[PALETTE_KEYS[Math.floor(random(PALETTE_KEYS.length))]];
  }

  /** Spacing and drop size move together. Their ratio is what decides how
   * deeply a pour nests — halve the gap and every drop lands inside its
   * predecessor — so a pour can be scaled up whole to cover more paper
   * without turning into a different pattern. */
  function spacing(scale = 1) {
    return (BASE_SPACING * size * scale) / density;
  }

  /** No two drops off a brush are the same weight, and the occasional heavy
   * one floods a broad field of colour that the finer drops then vein. */
  function dropRadius(scale = 1) {
    const weight = random() < BLOOM_CHANCE ? random(1.9, 2.8) : random(0.62, 1.5);
    return BASE_RADIUS * size * scale * weight;
  }

  // ------------------------------------------------------------------ tray

  /** Ink meeting size: the drop pushes the whole tray outward by its own
   * area, then floats as a fresh disc on top of what it displaced. */
  function addDrop(x, y, radius, ink, options = {}) {
    for (const shape of tray) drop(shape.points, x, y, radius);
    const metal = random() < shimmer * 0.14 ? options.metal : null;
    const born = options.born ?? p.millis();
    tray.push({
      points: circle(x, y, radius),
      tones: pigmentTones(ink, metal),
      metal: Boolean(metal),
      sheen: random(),
      flecks: metal ? scatterFlecks(random, Math.round(random(5, 9 + shimmer * 8))) : [],
      born,
      // Detail in proportion to the pigment: a broad field needs far more
      // boundary than a fleck of a drop before either looks like a polygon.
      detail: clamp(
        Math.ceil((2 * Math.PI * radius) / MAX_SEGMENT) + 40,
        140,
        MAX_BOUNDARY,
      ),
    });
    wetUntil = Math.max(wetUntil, born + BLOOM);
    dirty = true;
  }

  /** The pen as a tine dragged through the tray. The pull is a share of how
   * far the pen actually moved, so feathering follows the hand rather than
   * how often the pointer happened to report. */
  function rakeTray(x, y, ux, uy, step, scale = 1) {
    const reach = step * (0.3 + 0.6 * rake);
    if (reach < 0.01) return;
    // A tooth held at a perfect right angle would comb the tray into
    // chevrons; a real hand never does, so the tooth is allowed to drift.
    const drift = random(-WANDER, WANDER) * (0.4 + 0.6 * rake);
    const cos = Math.cos(drift);
    const sin = Math.sin(drift);
    const dx = ux * cos - uy * sin;
    const dy = ux * sin + uy * cos;
    const falloff = (26 + 46 * size * (0.4 + 0.6 * rake)) * scale;
    for (const shape of tray) tine(shape.points, x, y, dx, dy, reach, falloff);
  }

  function swirlTray(x, y, angle) {
    if (Math.abs(angle) < 0.002) return;
    const falloff = 48 + 70 * size;
    for (const shape of tray) vortex(shape.points, x, y, angle, falloff);
  }

  /** Boundaries are resampled after every action, so a band drawn out to ten
   * times its length gains the points to stay a curve. Ink carried off the
   * paper is dropped rather than bent forever. */
  function resettle() {
    let total = 0;
    for (let i = tray.length - 1; i >= 0; i--) {
      const shape = tray[i];
      if (offPaper(shape.points, p.width, p.height)) {
        tray.splice(i, 1);
        continue;
      }
      shape.points = refine(shape.points, MAX_SEGMENT, MIN_SEGMENT, shape.detail);
      total += shape.points.length / 2;
    }
    boundaryPoints = total;
  }

  /** Past the budget, the oldest pigment is painted down for good. It sits
   * beneath everything newer, so freezing it changes the picture far less
   * than the frame time it buys back. */
  function bakeOverflow(now) {
    while (
      tray.length > 1 &&
      (boundaryPoints > POINT_BUDGET || tray.length > SHAPE_BUDGET)
    ) {
      const shape = tray[0];
      if (now < shape.born + BLOOM) break; // still spreading; not final yet
      baked ||= layer();
      paintPigment(baked.drawingContext, shape, now, { veins });
      boundaryPoints -= shape.points.length / 2;
      tray.shift();
    }
  }

  function compose(now) {
    paint.clear();
    if (baked) paint.image(baked, 0, 0);
    const ctx = paint.drawingContext;
    const wetFrom = tray.length - WET_BLUR;
    for (let i = 0; i < tray.length; i++) {
      if (now < tray[i].born) continue; // an auto-fill pigment not yet poured
      paintPigment(ctx, tray[i], now, { veins, blur: i >= wetFrom });
    }
    dirty = false;
  }

  // ---------------------------------------------------------------- stroke

  function beginStroke(x, y) {
    const chosen = palette();
    stroke = {
      x,
      y,
      carry: 0,
      step: spacing(),
      heading: null,
      nextInk: createInkOrder(chosen, random),
      metal: parseHex(chosen.metal),
    };
    pourDrop(x, y, 0, 0, stroke.nextInk(), { metal: stroke.metal });
    resettle();
  }

  /** One drop of a pour, laid beside the path rather than on it. Ink poured
   * dead along a line combs into an even chevron; letting each drop fall a
   * little wide gives the pour body, and the width of a band then depends on
   * where its neighbours happened to land. */
  function pourDrop(x, y, ux, uy, ink, options = {}) {
    const radius = dropRadius(options.scale);
    const offset = random(-SCATTER, SCATTER) * radius;
    addDrop(x - uy * offset, y + ux * offset, radius, ink, options);
  }

  /** A drag is ink and motion at once: pigment is poured at an even spacing
   * along the path, and between pours the tray is raked in the direction of
   * travel and turned by however much the path bends. */
  function extendStroke(x, y) {
    const dx = x - stroke.x;
    const dy = y - stroke.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 0.001) return;
    const ux = dx / distance;
    const uy = dy / distance;
    const heading = Math.atan2(uy, ux);
    if (stroke.heading !== null) {
      let turn = heading - stroke.heading;
      turn -= Math.PI * 2 * Math.round(turn / (Math.PI * 2));
      swirlTray(stroke.x, stroke.y, clamp(turn, -0.6, 0.6) * swirl * 1.4);
    }
    stroke.heading = heading;
    let travelled = 0;
    let remaining = distance;
    while (stroke.carry + remaining >= stroke.step) {
      const step = stroke.step;
      const advance = step - stroke.carry;
      travelled += advance;
      remaining -= advance;
      stroke.carry = 0;
      const px = stroke.x + ux * travelled;
      const py = stroke.y + uy * travelled;
      pourDrop(px, py, ux, uy, stroke.nextInk(), { metal: stroke.metal });
      rakeTray(px, py, ux, uy, step);
      resettle();
      // Uneven spacing, and a floor that keeps a fast swipe from arriving as
      // one long segment asking for hundreds of drops at once.
      stroke.step = Math.max(spacing() * random(0.72, 1.34), distance / MAX_STEPS);
    }
    stroke.carry += remaining;
    stroke.x = x;
    stroke.y = y;
  }

  // -------------------------------------------------------------- patterns

  function sweepTray(apply) {
    for (const shape of tray) apply(shape.points);
    resettle();
  }

  /** The finishes a marbler would recognise, each one a different history of
   * the same tray rather than a different pattern. Auto-fill picks one, so no
   * two pages arrive alike. Sweeps are measured against the paper, since a
   * rake is drawn the width of the tray whatever the drops are sized. */
  const FINISHES = {
    // Ink left exactly where it fell: the mottled cells of a stone pattern.
    stone() {},
    // The long wandering veins of a poured canvas.
    // A rake has to reach well beyond the ink it is pulling. A pull that dies
    // away within one band tears its near edge forward and leaves the far
    // edge behind, which spikes bands into slivers instead of drawing them
    // out; over a long falloff the whole band travels and stays a ribbon.
    pour(angle, reach) {
      const ux = Math.cos(angle);
      const uy = Math.sin(angle);
      for (let i = Math.round(random(1, 3)); i > 0; i--) {
        sweepTray((points) =>
          ripple(
            points,
            ux,
            uy,
            random(0.02, 0.06) * reach,
            random(0.25, 0.6) * reach,
            random(Math.PI * 2),
          ),
        );
      }
      sweepTray((points) =>
        tine(
          points,
          p.width / 2,
          p.height / 2,
          ux,
          uy,
          random(0.12, 0.3) * reach,
          random(0.35, 0.8) * reach,
        ),
      );
    },
    // Teeth drawn crossways to a ripple, which is what turns even waves into
    // the fine repeated points of a nonpareil.
    comb(angle, reach) {
      const ux = Math.cos(angle);
      const uy = Math.sin(angle);
      sweepTray((points) =>
        ripple(points, ux, uy, random(0.04, 0.09) * reach, random(0.2, 0.5) * reach, random(6.3)),
      );
      const teeth = Math.round(random(4, 8));
      const gap = Math.hypot(p.width, p.height) / teeth;
      for (let i = 0; i < teeth; i++) {
        const t = (i + 0.5) / teeth;
        const pull = (i % 2 ? -1 : 1) * random(0.05, 0.13) * reach;
        sweepTray((points) =>
          tine(points, p.width * t, p.height * t, -uy, ux, pull, gap * 1.1),
        );
      }
    },
    // A poured ground gathered up on a stylus into whorls and cells.
    whorl(angle, reach) {
      FINISHES.pour(angle, reach);
      for (let i = Math.round(random(1, 4)); i > 0; i--) {
        sweepTray((points) =>
          vortex(
            points,
            random(0.15, 0.85) * p.width,
            random(0.15, 0.85) * p.height,
            random(1.6, 3.6) * (random() < 0.5 ? -1 : 1),
            random(0.16, 0.34) * reach,
          ),
        );
      }
    },
  };
  const FINISH_KEYS = Object.keys(FINISHES);

  /** A line that curls rather than turns, so a pour laid along it sweeps the
   * paper the way a hand would instead of jinking. It is turned back at the
   * edges rather than allowed to wander off and be culled. */
  function wanderPath(target, stride) {
    let x = random(p.width);
    let y = random(p.height);
    let heading = random(Math.PI * 2);
    let curl = random(-0.12, 0.12);
    const points = [[x, y]];
    for (let travelled = 0; travelled < target; travelled += stride) {
      curl = clamp(curl + random(-0.045, 0.045), -0.2, 0.2);
      heading += curl;
      x += Math.cos(heading) * stride;
      y += Math.sin(heading) * stride;
      const margin = stride * 2;
      if (x < -margin || x > p.width + margin || y < -margin || y > p.height + margin) {
        heading += Math.PI * random(0.55, 1.45);
        x = clamp(x, 0, p.width);
        y = clamp(y, 0, p.height);
        curl = random(-0.08, 0.08);
      }
      points.push([x, y]);
    }
    return points;
  }

  /** A pour walked along a path: the same alternation of dropping ink and
   * raking it that a stroke performs, which is the only thing that builds
   * bands deep enough to read as marbling. */
  function pourAlong(path, nextInk, options) {
    const { scale, metal, born, pace } = options;
    let carry = 0;
    let step = spacing(scale);
    let heading = null;
    let poured = 0;
    for (let i = 1; i < path.length; i++) {
      const [ax, ay] = path[i - 1];
      const dx = path[i][0] - ax;
      const dy = path[i][1] - ay;
      const distance = Math.hypot(dx, dy);
      if (distance < 1e-6) continue;
      const ux = dx / distance;
      const uy = dy / distance;
      const angle = Math.atan2(uy, ux);
      if (heading !== null) {
        let turn = angle - heading;
        turn -= Math.PI * 2 * Math.round(turn / (Math.PI * 2));
        swirlTray(ax, ay, clamp(turn, -0.6, 0.6) * swirl * 1.4);
      }
      heading = angle;
      let travelled = 0;
      let remaining = distance;
      while (carry + remaining >= step) {
        const advance = step - carry;
        travelled += advance;
        remaining -= advance;
        carry = 0;
        const px = ax + ux * travelled;
        const py = ay + uy * travelled;
        pourDrop(px, py, ux, uy, nextInk(), {
          scale,
          metal,
          born: born + poured * pace,
        });
        poured++;
        rakeTray(px, py, ux, uy, step, scale);
        resettle();
        step = spacing(scale) * random(0.72, 1.34);
      }
      carry += remaining;
    }
    return poured;
  }

  /**
   * A whole tray.
   *
   * A marbler floods the size with a ground coat before throwing any pattern,
   * because ink thrown onto bare size only ever covers the fraction of the
   * tray it landed on. So the paper is grounded, a few broad fields are laid
   * over it, and then it is poured — along sweeping paths, exactly as a hand
   * would, because that is what nests bands deeply enough to vein. The pour
   * is scaled up as a whole so a page's worth of it fits the tray's budget
   * while keeping the proportions that make it look poured at all.
   *
   * Every drop's geometry is final the moment it is poured; only the order it
   * becomes visible is staggered, so finishing early loses nothing.
   */
  function autoFill() {
    settle();
    const chosen = palette();
    const nextInk = createInkOrder(chosen, random);
    const metal = parseHex(chosen.metal);
    const reach = Math.min(p.width, p.height);
    const area = p.width * p.height;
    const start = p.millis();

    // The ground: enough ink to reach every corner, so no paper shows
    // through, then broad fields of the kind a poured canvas keeps behind its
    // pattern.
    const cover = Math.hypot(p.width, p.height) / 2;
    const grounds = [[p.width / 2, p.height / 2, cover * 1.04]];
    for (let i = 0; i < 5; i++) {
      grounds.push([random(p.width), random(p.height), cover * random(0.5, 0.8)]);
    }
    for (let i = 0; i < 8; i++) {
      grounds.push([random(-0.1, 1.1) * p.width, random(-0.1, 1.1) * p.height, reach * random(0.1, 0.26)]);
    }
    for (let i = 0; i < grounds.length; i++) {
      addDrop(grounds[i][0], grounds[i][1], grounds[i][2], nextInk(), {
        metal,
        born: start + i * 22,
      });
      resettle();
    }

    // Pours wide enough that a page can be covered inside the budget.
    const scale = 3;
    const band = 4.3 * BASE_RADIUS * size * scale;
    const total = (1.3 * area) / band;
    const passes = clamp(Math.round(total / (reach * 1.6)), 3, 11);
    const stride = reach * 0.05;
    let poured = 0;
    const pace = 900 / Math.max(1, total / spacing(scale));
    for (let i = 0; i < passes; i++) {
      poured += pourAlong(wanderPath(total / passes, stride), nextInk, {
        scale,
        metal,
        born: start + 300 + poured * pace,
        pace,
      });
    }
    FINISHES[FINISH_KEYS[Math.floor(random(FINISH_KEYS.length))]](
      random(Math.PI * 2),
      reach,
    );
  }

  // ------------------------------------------------------------- lifecycle

  function settle() {
    stroke = null;
    for (const shape of tray) shape.born = -BLOOM;
    wetUntil = 0;
    dirty = true;
  }

  function clear() {
    stroke = null;
    tray = [];
    boundaryPoints = 0;
    wetUntil = 0;
    baked?.clear();
    paint?.clear();
    dirty = true;
  }

  function getSettings() {
    return { size, density, rake, swirl, shimmer, color, veins };
  }

  function setSetting(id, value) {
    if (Object.hasOwn(RANGES, id)) {
      const number = Number(value);
      if (!Number.isFinite(number)) return;
      const [min, max] = RANGES[id];
      const next = clamp(number, min, max);
      if (id === "size") size = next;
      if (id === "density") density = next;
      if (id === "rake") rake = next;
      if (id === "swirl") swirl = next;
      if (id === "shimmer") shimmer = next;
      return;
    }
    if (id === "color" && (value === "auto" || Object.hasOwn(PALETTES, value))) {
      color = value;
    }
    if (id === "veins" && [true, false, "true", "false"].includes(value)) {
      veins = value === true || value === "true";
      dirty = true; // pigment still floating picks the change up
    }
  }

  return {
    setup(params = new URLSearchParams()) {
      seed = Math.floor(p.random() * 4294967296) >>> 0;
      paint = layer();
      for (const id of Object.keys(getSettings())) {
        if (params.has(id)) setSetting(id, params.get(id));
      }
    },
    resize() {
      clear();
      baked = null; // nothing is held once the paper changes shape
      if (paint.pixelDensity() !== p.pixelDensity()) {
        paint.pixelDensity(p.pixelDensity());
      }
      paint.resizeCanvas(p.width, p.height);
    },
    draw() {
      const now = p.millis();
      bakeOverflow(now);
      if (dirty || now < wetUntil) compose(now);
      p.image(paint, 0, 0);
    },
    pointerDown(x, y) {
      if (!drawable(x, y)) return;
      beginStroke(x, y);
    },
    pointerMove(x, y) {
      if (!stroke || !drawable(x, y)) return;
      extendStroke(x, y);
    },
    pointerUp() {
      stroke = null;
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
