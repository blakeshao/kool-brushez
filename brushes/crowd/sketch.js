import { FIGURES, OBJECTS, INKS, drawFigure } from "./figures.js";
import { scheduleFigures, growthProgress } from "./animation.js";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const validPoint = (x, y) => Number.isFinite(x) && Number.isFinite(y);

export default function createBrush(p) {
  let paint, live, stroke = null, seed = 1;
  let size = 1, density = 1, spread = 0.55, details = 0.7, color = "blue", pose = "mixed", motion = true;
  let deck = [], pending = [], figures = [], paused = true, resumedAt = 0;
  const paths = new Map();

  // Local randomness keeps other brushes and animation frame rates from
  // changing a crowd. Keep people as vectors while alive; finish captures a
  // neutral still for the studio's raster history, eraser and PNG export.
  function random(min = 0, max = 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return min + (seed / 4294967296) * (max - min);
  }

  function nextFigure() {
    if (!deck.length) {
      deck = FIGURES.map((_, index) => index).filter(
        (index) => pose === "mixed" || FIGURES[index].pose === pose,
      );
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(random(0, i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
    }
    return deck.pop();
  }

  function group(x, y, direction = { x: 1, y: 0 }) {
    const count = 2 + Math.floor(random(0, 2 + density * 0.65));
    const people = [];
    let cursor = 0;
    function append(index, kind = "person") {
      const definition = (kind === "object" ? OBJECTS : FIGURES)[index];
      const scale = 0.55 * size * random(0.88, 1.1);
      const footprint = definition.width * scale;
      if (people.length) cursor += footprint * 0.52;
      people.push({
        index, kind, x: cursor, y: y + random(-18, 18) * size * spread,
        scale, flip: random() < 0.5 ? -1 : 1, ink: INKS[color],
      });
      cursor += footprint * random(0.48, 0.62);
    }
    for (let i = 0; i < count; i++) append(nextFigure());
    if (random() < details * 0.4)
      append(Math.floor(random(0, OBJECTS.length)), "object");
    const center = (people[0].x + people.at(-1).x) / 2;
    // Keep groups in stroke order, and follow the pen within each gathering.
    people.sort((a, b) => (a.x - b.x) * direction.x + (a.y - b.y) * direction.y);
    for (const person of people) {
      person.x += x - center;
    }
    scheduleFigures(pending, people, p.millis());
    figures.push(...people);
    return (cursor + random(15, 30) * size) / density;
  }

  function setup(params = new URLSearchParams()) {
    paint = p.createGraphics(p.width, p.height);
    live = p.createGraphics(p.width, p.height);
    for (const layer of [paint, live]) layer.pixelDensity(p.pixelDensity());
    randomize();
    for (const id of ["size", "density", "spread", "details", "color", "pose", "motion"])
      if (params.has(id)) setSetting(id, id === "motion" ? params.get(id) !== "false" : params.get(id));
  }

  function resume() {
    if (!paused) return;
    paused = false;
    resumedAt = p.millis();
  }

  function pointerDown(x, y) {
    if (!validPoint(x, y)) return;
    resume();
    stroke = { x, y, remaining: group(x, y) };
  }

  function pointerMove(x, y) {
    if (!stroke || !validPoint(x, y)) return;
    let distance = Math.hypot(x - stroke.x, y - stroke.y);
    if (!distance) return;
    const dx = (x - stroke.x) / distance, dy = (y - stroke.y) / distance;
    let fromX = stroke.x, fromY = stroke.y;
    // Sample distance, not input events: a quick swipe and a slow drag place
    // the same people, and holding still never piles up duplicate figures.
    while (distance >= stroke.remaining) {
      fromX += dx * stroke.remaining;
      fromY += dy * stroke.remaining;
      distance -= stroke.remaining;
      stroke.remaining = group(fromX, fromY, { x: dx, y: dy });
    }
    stroke.remaining -= distance;
    stroke.x = x;
    stroke.y = y;
  }

  function pointerUp() { stroke = null; }
  function finish() {
    pointerUp();
    if (paused) return;
    const now = p.millis();
    for (const figure of pending)
      figure.completedAt = Math.min(now, figure.bornAt + figure.duration);
    pending = [];
    paint.clear();
    for (const figure of figures) drawFigure(paint.drawingContext, figure, paths);
    paused = true;
    live.clear();
  }

  function draw() {
    const now = p.millis();
    if (paused) {
      p.image(paint, 0, 0);
      return;
    }
    // Each person's idle movement starts at their own completion time.
    let completed = 0;
    while (completed < pending.length) {
      const figure = pending[completed];
      if (now < figure.bornAt + figure.duration) break;
      figure.completedAt = figure.bornAt + figure.duration;
      completed++;
    }
    if (completed) pending.splice(0, completed);
    live.clear();
    for (const figure of figures)
      drawFigure(live.drawingContext, figure, paths,
        figure.completedAt === undefined ? growthProgress(figure, now) : 1,
        motion ? now : undefined, resumedAt);
    p.image(live, 0, 0);
  }

  function clear() {
    pointerUp();
    pending = [];
    figures = [];
    paused = true;
    paint.clear();
    live.clear();
  }

  function resize() {
    for (const layer of [paint, live]) {
      layer.pixelDensity(p.pixelDensity());
      layer.resizeCanvas(p.width, p.height);
    }
    clear();
  }

  function autoFill() {
    finish();
    resume();
    const marginX = Math.min(p.width * 0.14, 80 * size);
    const top = Math.min(p.height * 0.65, 105 * size);
    const bottom = p.height - Math.min(p.height * 0.12, 40 * size);
    const rows = Math.max(1, Math.floor((bottom - top) / (100 * size)) + 1);
    for (let row = 0; row < rows; row++) {
      const baseline = rows === 1 ? (top + bottom) / 2 : top + (bottom - top) * row / (rows - 1);
      const phase = random(0, Math.PI * 2);
      let x = marginX + random(0, 45) * size;
      while (x < p.width - marginX) {
        const y = baseline + Math.sin(x / p.width * Math.PI * 2 + phase) * 15 * size * spread;
        x += group(x, y) * random(1.05, 1.55);
      }
    }
  }

  function randomize() {
    finish();
    seed = Math.floor(p.random() * 4294967296) >>> 0;
    deck = [];
  }

  function getSettings() { return { size, density, spread, details, color, pose, motion }; }
  function setSetting(id, value) {
    if (["size", "density", "spread", "details"].includes(id)) {
      const number = Number(value);
      if (!Number.isFinite(number)) return;
      if (id === "size") size = clamp(number, 0.4, 3);
      if (id === "density") density = clamp(number, 0.35, 2.5);
      if (id === "spread") spread = clamp(number, 0, 2);
      if (id === "details") details = clamp(number, 0, 2);
    }
    if (id === "color" && Object.hasOwn(INKS, value)) color = value;
    if (id === "pose" && ["mixed", "standing", "walking", "seated"].includes(value)) {
      pose = value;
      deck = [];
    }
    if (id === "motion" && typeof value === "boolean") {
      motion = value;
      if (paint) {
        if (motion) resume();
        else finish();
      }
    }
  }

  return { setup, resize, draw, pointerDown, pointerMove, pointerUp, finish, clear,
    autoFill, randomize, getSettings, setSetting };
}
