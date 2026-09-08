export default function createBrush(engine) {
  // Christmas Branch Brush
  // Ported from an old Flash/ActionScript prototype: while the pen is down, a
  // point is projected a little ahead of it along the direction of travel and,
  // every frame, a handful of pine needles are stamped there, splayed around
  // the heading. Each needle is drawn twice: a faint dark offset copy (a drop
  // shadow, per the original's `shadow_dist`) and a crisp copy in a randomized
  // green on top, so the bough reads as fluffy rather than a plain fan of
  // lines. Every so often a small bauble hangs off the branch, echoing the
  // original's separate "add ornament" tool.

  const PALETTE = {
    pine: [31, 122, 63],
    spruce: [46, 110, 120],
    frost: [191, 224, 214],
  };
  const ORNAMENTS = {
    red: [196, 30, 45],
    gold: [206, 158, 46],
    blue: [42, 86, 158],
    silver: [188, 194, 202],
  };
  const ORNAMENT_KEYS = Object.keys(ORNAMENTS);

  const NEEDLE_LEN = 44;     // px at size 1
  const SHADOW_DIST = 7;     // px the drop shadow is offset, at size 1
  const NEEDLES_PER_STAMP = 6;
  const SPREAD = 0.55;       // rad, +/- around the heading a needle may point
  const STAMP_SPACING = 5;   // px of travel between stamps, at size 1 / density 1
  const ORNAMENT_CHANCE = 0.03; // chance a stamp also hangs a bauble
  const BRUSH_SIZE_UNIT = 10;   // px per unit of brush size (matches needle weight/spacing scale)
  const ORNAMENT_RADIUS = 3;    // ornament radius, as a multiple of the brush size unit
  const ORNAMENT_GAP_MIN = 3;   // minimum spacing between ornaments, as a multiple of their radius
  const ORNAMENT_GAP_MAX = 8;

  let paint;         // finished needles
  let ornamentLayer; // finished ornaments, composited on top of the needles
  let bs = 1;        // size multiplier
  let density = 1;   // stamps per unit of drag distance
  let colorLock = null; // one of PALETTE's keys, or null for mixed greens
  let ornaments = true;
  let hueShift = 0;  // randomize() nudges the mixed-green tint
  let lastOrnamentX = null, lastOrnamentY = null; // keeps ornaments from crowding each other

  let st = null;     // current stroke state

  function setup(params = new URLSearchParams()) {
    paint = makeLayer();
    ornamentLayer = makeLayer();
    if (PALETTE[params.get("color")]) colorLock = params.get("color");
    if (params.has("ornaments")) ornaments = params.get("ornaments") !== "false";
  }

  function makeLayer() {
    const g = engine.createGraphics(engine.width, engine.height);
    g.strokeCap(engine.ROUND);
    return g;
  }

  function draw() {
    advanceStroke();
    engine.image(paint, 0, 0);
    engine.image(ornamentLayer, 0, 0);
  }

  // ---------------------------------------------------------------- stroke

  // The original tracked a velocity-projected point that raced a little ahead
  // of the mouse; a follower does the same job here, closing on the pointer a
  // bit each frame so the branch keeps growing smoothly even if the pointer
  // pauses mid-stroke.
  function beginStroke(x, y) {
    st = { x, y, tx: x, ty: y, pressed: true, travel: 0, ang: 0 };
  }

  function advanceStroke() {
    if (!st) return;
    for (let k = 0; k < 4; k++) {
      const dx = st.tx - st.x, dy = st.ty - st.y;
      const d = engine.sqrt(dx * dx + dy * dy);
      if (d < 0.4 * bs) break;
      const step = engine.min(d, engine.max(1.4 * bs, d * 0.2));
      strokeTo(st.x + dx / d * step, st.y + dy / d * step);
    }
    if (!st.pressed && engine.dist(st.x, st.y, st.tx, st.ty) < 0.8 * bs) endStroke();
  }

  function strokeTo(x, y) {
    if (!st) return;
    const dx = x - st.x, dy = y - st.y;
    const d = engine.sqrt(dx * dx + dy * dy);
    if (d < 0.2 * bs) return;
    st.ang = engine.atan2(dy, dx);
    st.travel += d;
    const spacing = engine.max(2, STAMP_SPACING * bs) / density;
    while (st.travel >= spacing) {
      st.travel -= spacing;
      stampNeedles(x, y, st.ang);
      if (ornaments && engine.random() < ORNAMENT_CHANCE) stampOrnament(x, y);
    }
    st.x = x; st.y = y;
  }

  function endStroke() {
    if (st && st.travel === 0) stampNeedles(st.x, st.y, st.ang); // a plain click
    st = null;
  }

  // ---------------------------------------------------------------- marks

  // Six (times density) needles splay out from (x, y) around `ang`, each a
  // faint offset shadow plus a crisp colored line on top, as in the original.
  function stampNeedles(x, y, ang) {
    const n = engine.max(1, engine.round(NEEDLES_PER_STAMP * density));
    const len = NEEDLE_LEN * bs;
    const shadow = SHADOW_DIST * bs;
    for (let i = 0; i < n; i++) {
      const a = ang + engine.random(-SPREAD, SPREAD);
      const l = len * engine.random(0.75, 1.15);
      const ex = x - engine.cos(a) * l;
      const ey = y - engine.sin(a) * l;

      paint.stroke(20, 24, 16, 16);
      paint.strokeWeight(1.3 * bs);
      paint.line(x + shadow, y + shadow, ex + shadow, ey + shadow);

      const col = needleColor();
      paint.stroke(col);
      paint.strokeWeight(engine.max(1, 1.1 * bs));
      paint.line(x, y, ex, ey);
    }
  }

  function needleColor() {
    if (colorLock) {
      const [r, g, b] = PALETTE[colorLock];
      const j = engine.random(-16, 16);
      return engine.color(
        engine.constrain(r + j, 0, 255),
        engine.constrain(g + j, 0, 255),
        engine.constrain(b + j, 0, 255),
        235
      );
    }
    // a random green channel, as in the original, with a touch of olive tint
    // and a randomize()-tunable hue shift
    const g = engine.constrain(engine.random(70, 255) + hueShift, 40, 255);
    const r = g * engine.random(0.15, 0.35);
    return engine.color(r, g, r * 0.55, 235);
  }

  // A small hanging bauble: a string down from the branch, a glossy
  // radially-shaded body, a metallic cap, and a highlight off to one side, per
  // a random ornament color. Gravity always pulls it below the branch, with
  // just a little sway off straight down. Skipped if too close to the last one.
  function stampOrnament(x, y) {
    const rad = ORNAMENT_RADIUS * BRUSH_SIZE_UNIT * bs * engine.random(0.85, 1.2);
    const minGap = rad * engine.random(ORNAMENT_GAP_MIN, ORNAMENT_GAP_MAX);
    if (lastOrnamentX !== null && engine.dist(x, y, lastOrnamentX, lastOrnamentY) < minGap) return;
    lastOrnamentX = x; lastOrnamentY = y;

    const key = ORNAMENT_KEYS[engine.floor(engine.random(ORNAMENT_KEYS.length))];
    const [r, g, b] = ORNAMENTS[key];
    const swing = engine.random(-0.22, 0.22);
    const hangLen = rad * engine.random(1.7, 2.4);
    const ox = x + engine.sin(swing) * hangLen;
    const oy = y + engine.cos(swing) * hangLen;

    const ctx = ornamentLayer.drawingContext;
    ctx.save();
    ctx.strokeStyle = "rgba(90,70,40,0.55)";
    ctx.lineWidth = engine.max(0.6, 0.8 * bs);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(ox, oy - rad * 0.9);
    ctx.stroke();

    // a soft drop shadow, offset down and to the side, behind the sphere
    const shx = ox + rad * 0.22, shy = oy + rad * 0.3;
    const shadowGrad = ctx.createRadialGradient(shx, shy, 0, shx, shy, rad * 1.15);
    shadowGrad.addColorStop(0, "rgba(15,15,10,0.25)");
    shadowGrad.addColorStop(0.7, "rgba(15,15,10,0.11)");
    shadowGrad.addColorStop(1, "rgba(15,15,10,0)");
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.arc(shx, shy, rad * 1.15, 0, engine.TWO_PI);
    ctx.fill();

    // a brushed-metal cap: a horizontal linear gradient rather than a flat fill
    const capY = oy - rad * 1.05, capR = rad * 0.22;
    const capGrad = ctx.createLinearGradient(ox - capR, capY, ox + capR, capY);
    capGrad.addColorStop(0, "#746a44");
    capGrad.addColorStop(0.25, "#d8caa0");
    capGrad.addColorStop(0.5, "#fff8dc");
    capGrad.addColorStop(0.75, "#c2b385");
    capGrad.addColorStop(1, "#5f5636");
    ctx.fillStyle = capGrad;
    ctx.beginPath();
    ctx.arc(ox, capY, capR, 0, engine.TWO_PI);
    ctx.fill();

    // a highlight offset toward one side gives the sphere a glossy, lit look
    const hlx = ox - rad * 0.38, hly = oy - rad * 0.55;
    const grad = ctx.createRadialGradient(hlx, hly, rad * 0.05, ox, oy, rad * 1.05);
    grad.addColorStop(0, "rgba(255,255,255,0.95)");
    grad.addColorStop(0.2, `rgba(${engine.min(255, r + 90)},${engine.min(255, g + 90)},${engine.min(255, b + 90)},0.95)`);
    grad.addColorStop(0.55, `rgba(${r},${g},${b},1)`);
    grad.addColorStop(1, `rgba(${engine.round(r * 0.35)},${engine.round(g * 0.35)},${engine.round(b * 0.35)},1)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ox, oy, rad, 0, engine.TWO_PI);
    ctx.fill();
    ctx.restore();
  }

  // ---------------------------------------------------------------- UI

  function clearAll() {
    st = null;
    paint.clear();
    ornamentLayer.clear();
    lastOrnamentX = null; lastOrnamentY = null;
  }

  function finish() {
    if (st) {
      st.pressed = false;
      stampNeedles(st.x, st.y, st.ang);
      st = null;
    }
  }

  function autoFill() {
    // a couple of drooping garland strokes and one diagonal bough
    const rows = [0.18, 0.5, 0.82];
    for (const ry of rows) {
      const y0 = engine.height * ry + engine.random(-20, 20);
      let x = engine.random(-20, 20), y = y0, a = 0;
      const seed = engine.random(1000);
      beginStroke(x, y);
      let i = 0;
      while (x < engine.width + 20 && i < 3000) {
        a = engine.lerp(a, (engine.noise(seed + i * 0.02) - 0.5) * 1.2, 0.08);
        x += engine.cos(a) * 6; y += engine.sin(a) * 6 + engine.sin(i * 0.03) * 1.2;
        strokeTo(x, y);
        i++;
      }
      endStroke();
    }
    const seed = engine.random(1000);
    let x = engine.width * 0.08, y = engine.height * 0.1, a = 0.9;
    beginStroke(x, y);
    for (let i = 0; i < 260 && x < engine.width && y < engine.height; i++) {
      a = engine.lerp(a, 0.9 + (engine.noise(seed + i * 0.03) - 0.5) * 0.6, 0.06);
      x += engine.cos(a) * 6; y += engine.sin(a) * 6;
      strokeTo(x, y);
    }
    endStroke();
  }

  function setSetting(name, value) {
    if (name === "size") bs = engine.constrain(Number(value), 0.4, 3.5);
    if (name === "density") density = engine.constrain(Number(value), 0.3, 3);
    if (name === "color") colorLock = PALETTE[value] ? value : null;
    if (name === "ornaments") ornaments = Boolean(value);
  }

  return {
    setup,
    resize() {
      clearAll();
      for (const layer of [paint, ornamentLayer]) {
        if (layer.pixelDensity() !== engine.pixelDensity()) layer.pixelDensity(engine.pixelDensity());
        layer.resizeCanvas(engine.width, engine.height);
        layer.strokeCap(engine.ROUND);
      }
    },
    draw,
    pointerDown(x, y) { finish(); beginStroke(x, y); },
    pointerMove(x, y) { if (st) { st.tx = x; st.ty = y; } },
    pointerUp() { if (st) st.pressed = false; },
    finish,
    clear: clearAll,
    autoFill,
    randomize() { hueShift = engine.random(-40, 40); },
    getSettings() { return { size: bs, density, color: colorLock || "auto", ornaments }; },
    setSetting,
  };
}
