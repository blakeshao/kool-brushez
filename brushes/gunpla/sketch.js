import { createComponent, drawComponent, drawHeading, COMPONENT_POOLS, INKS } from "./plates.js";
import { createLayout, reserveComponent } from "./layout.js";
import { createBurst, burstPose } from "./burst.js";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const validPoint = (x, y) => Number.isFinite(x) && Number.isFinite(y);
const key = (column, row) => `${column},${row}`;

export default function createBrush(p) {
  let paint, stroke = null, grid = null, seed = 1, serial = 0;
  let size = 1, density = 1, details = 1.4, color = "white";
  let variation = 1.2, texture = 0.35;
  let grids = [];
  let components = [], pending = [];
  let parts = "mixed", labels = true;

  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  function createGrid(x, y, scale = size, limits = null) {
    const spacing = 24 + 7 / density;
    const target = {
      x, y, cell: spacing * scale, layout: createLayout(spacing, limits),
      settings: { ...getSettings(), size: scale }, number: 0, deck: [],
      letter: String.fromCharCode(65 + serial++ % 26),
    };
    grids.push(target);
    return target;
  }
  function nextKind(target) {
    if (!target.deck.length) {
      target.deck = [...COMPONENT_POOLS[target.settings.parts]];
      for (let i = target.deck.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [target.deck[i], target.deck[j]] = [target.deck[j], target.deck[i]];
      }
    }
    return target.deck.pop();
  }
  function addCell(target, column, row) {
    const id = key(column, row);
    if (target.layout.cells.has(id)) return;
    const part = createComponent(random, target.settings, target.number + 1, nextKind(target));
    const piece = reserveComponent(target.layout, part, column, row);
    if (!piece) return;
    target.number++;
    const x = target.x + (piece.column + (piece.columns - 1) / 2) * target.cell;
    const y = target.y + (piece.row + (piece.rows - 1) / 2) * target.cell;
    const component = {
      ...createBurst(x, y, components, p.millis(), {
        x: target.x + column * target.cell, y: target.y + row * target.cell,
      }),
      part, width: piece.columns * target.layout.unit,
      height: piece.rows * target.layout.unit, edges: piece.edges,
    };
    target.firstBurst ||= component;
    components.push(component);
    pending.push(component);
  }
  function renderComponent(ctx, component) {
    const { part, x, y, width, height, edges } = component;
    drawComponent(ctx, part, x, y, width, height, edges);
  }
  function settle(component) {
    renderComponent(paint.drawingContext, component);
    component.settled = true;
  }
  function setup(params = new URLSearchParams()) {
    paint = p.createGraphics(p.width, p.height);
    paint.pixelDensity(p.pixelDensity());
    randomize();
    for (const id of Object.keys(getSettings()))
      if (params.has(id)) setSetting(id, params.get(id));
  }
  function pointerDown(x, y) {
    if (!validPoint(x, y)) return;
    grid ||= createGrid(x, y);
    stroke = { x, y };
    addCell(grid, Math.floor((x - grid.x) / grid.cell + 0.5), Math.floor((y - grid.y) / grid.cell + 0.5));
  }
  function pointerMove(x, y) {
    if (!stroke || !validPoint(x, y)) return;
    const fromX = (stroke.x - grid.x) / grid.cell + 0.5;
    const fromY = (stroke.y - grid.y) / grid.cell + 0.5;
    const toX = (x - grid.x) / grid.cell + 0.5;
    const toY = (y - grid.y) / grid.cell + 0.5;
    let column = Math.floor(fromX), row = Math.floor(fromY);
    const endColumn = Math.floor(toX), endRow = Math.floor(toY);
    const dx = toX - fromX, dy = toY - fromY;
    const stepX = Math.sign(dx), stepY = Math.sign(dy);
    const deltaX = dx ? 1 / Math.abs(dx) : Infinity;
    const deltaY = dy ? 1 / Math.abs(dy) : Infinity;
    let nextX = dx ? ((stepX > 0 ? column + 1 : column) - fromX) / dx : Infinity;
    let nextY = dy ? ((stepY > 0 ? row + 1 : row) - fromY) / dy : Infinity;
    // Walk every crossed grid boundary, including coalesced fast swipes. At
    // corners take the horizontal step first, keeping a connected sprue.
    while (column !== endColumn || row !== endRow) {
      if (row === endRow || (column !== endColumn && nextX <= nextY + 1e-10)) {
        column += stepX;
        nextX += deltaX;
      } else {
        row += stepY;
        nextY += deltaY;
      }
      addCell(grid, column, row);
    }
    stroke = { x, y };
  }
  function pointerUp() { stroke = null; }
  function finish() {
    pointerUp();
    for (const component of pending) settle(component);
    pending = [];
  }
  function draw() {
    const now = p.millis();
    // Bake in creation order, so settling naturally and finishing for an
    // export/history snapshot produce exactly the same runner overlaps.
    let count = 0;
    while (count < pending.length && burstPose(pending[count], now).done) {
      settle(pending[count++]);
    }
    if (count) pending.splice(0, count);
    p.image(paint, 0, 0);
    const ctx = p.drawingContext;
    for (const component of pending) {
      const pose = burstPose(component, now);
      if (!pose.scale || !pose.alpha) continue;
      ctx.save();
      ctx.translate(pose.x, pose.y);
      // Exaggerated stretch, slant and counter-squash all follow the launch.
      ctx.rotate(component.angle);
      ctx.scale(pose.stretch, 1 / pose.stretch);
      ctx.transform(1, 0, pose.shear, 1, 0, 0);
      ctx.rotate(pose.rotation - component.angle);
      ctx.scale(pose.scale, pose.scale);
      ctx.translate(-component.x, -component.y);
      ctx.globalAlpha *= pose.alpha;
      renderComponent(ctx, component);
      ctx.restore();
    }
    // Headers follow the growing tab's outer bounds, staying above new rows.
    // They appear after the first pop, keeping an untouched start empty.
    for (const target of grids) {
      if (!target.firstBurst) continue;
      const alpha = target.firstBurst.settled ? 1
        : clamp((now - target.firstBurst.start - 100) / 70, 0, 1);
      if (!alpha) continue;
      ctx.save();
      ctx.globalAlpha *= alpha;
      drawHeading(ctx, target);
      ctx.restore();
    }
  }
  function clear() {
    pointerUp();
    pending = [];
    components = [];
    paint.clear();
    grid = null;
    grids = [];
    serial = 0;
  }
  function resize() {
    paint.pixelDensity(p.pixelDensity());
    paint.resizeCanvas(p.width, p.height);
    clear();
  }
  function autoFill() {
    finish();
    const margin = Math.min(30, p.width * 0.08, p.height * 0.08);
    const spacing = 24 + 7 / density;
    const scale = Math.min(size, (p.width - margin * 2) / (spacing * 3), (p.height - margin * 2) / (spacing + 30));
    const cell = spacing * scale;
    const columns = Math.max(1, Math.floor((p.width - margin * 2) / cell));
    const rows = Math.max(1, Math.floor((p.height - margin * 2 - 28 * scale) / cell));
    // Irregular large and small compartments, assembled one component at a
    // time, including long weapon bays and tiny polycap sockets.
    for (let row = 0; row < rows; row += 10) {
      for (let column = 0; column < columns; column += 9) {
        const bounds = { columns: Math.min(8, columns - column), rows: Math.min(9, rows - row) };
        const group = createGrid(margin + (column + 0.5) * cell, margin + 28 * scale + (row + 0.5) * cell, scale, bounds);
        for (let r = 0; r < bounds.rows; r++)
          for (let c = 0; c < bounds.columns; c++) addCell(group, c, r);
      }
    }
    grid = null;
  }
  function randomize() {
    finish();
    seed = Math.floor(p.random() * 4294967296) >>> 0;
    grid = null;
    serial = 0;
  }
  function getSettings() { return { size, density, variation, details, texture, color, parts, labels }; }
  function setSetting(id, value) {
    const previous = getSettings()[id];
    if (["size", "density", "variation", "details", "texture"].includes(id)) {
      const number = Number(value);
      if (!Number.isFinite(number)) return;
      if (id === "size") size = clamp(number, 0.4, 2.5);
      if (id === "density") density = clamp(number, 0.4, 1.8);
      if (id === "variation") variation = clamp(number, 0, 2);
      if (id === "details") details = clamp(number, 0, 2);
      if (id === "texture") texture = clamp(number, 0, 2);
    }
    if (id === "color" && Object.hasOwn(INKS, value)) color = value;
    if (id === "parts" && ["mixed", "armor", "mechanical", "weapons"].includes(value)) parts = value;
    if (id === "labels" && [true, false, "true", "false"].includes(value)) labels = value === true || value === "true";
    if (getSettings()[id] !== previous) {
      finish();
      grid = null;
    }
  }
  return { setup, resize, draw, pointerDown, pointerMove, pointerUp, finish, clear,
    autoFill, randomize, getSettings, setSetting };
}
