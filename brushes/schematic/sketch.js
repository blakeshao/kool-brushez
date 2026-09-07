import { FONT_NAME } from "../../shared/typography.js";

export default function createBrush(engine) {
  // Schematic Brush
  // A p5.js brush that draws randomized technical schematics along each stroke:
  // modular-synth patch diagrams (crosshair pins, rounded modules, sweeping
  // patch cables) and CAD site-plan drafting (dimension lines with ticks,
  // callout bubbles on leaders, nested contours, hatching, section markers).
  // Every annotation is a random number in DM Sans, placed clear of
  // the numbers and node bodies already on the page. White page, black ink.
  //
  // Nodes are snapped to an invisible grid at intervals along the stroke and
  // wired to the previous node. Everything is recorded as primitives (ink runs,
  // text, filled blots) and then drawn in like a pen plotter: lines extend at a
  // fixed speed and text types itself out. The ink is wet: line weight swells
  // and thins, lines bleed a soft halo, ink pools and drips where the pen
  // lands, and specks fly. The lines themselves stay straight and true.
  // Finished marks are baked into the paint layer.

  const FONT = FONT_NAME;
  const LABEL_SCALE = 1.5; // annotation size relative to the drafting geometry
  const PEN_SPEED = 0.7;   // px per ms the pen travels
  const CHAR_MS = 22;      // ms per typed character
  const W = { heavy: 2.3, reg: 1.25, cable: 1.0, thin: 0.7 }; // line weights (px) at size 1

  // Ink character. Runs are resampled and wobbled once when recorded, so the
  // rough edges are stable from frame to frame.
  const INK = {
    step: 2.5,      // px between resampled points along a run
    wobble: 0,      // px the line itself may wander sideways (0 keeps lines true)
    rag: 1.3,       // px of raggedness on blot outlines
    bleed: 3.8,     // how far ink wicks out, as a multiple of the line weight
    bleedAlpha: 40, // alpha of the innermost bleed layer
    fiber: 0.22,    // chance per segment of a fine fiber wicking sideways
    grain: 0.45,    // chance per segment of a grain of ink caught in the paper
    body: 245,      // alpha of the line itself
    pool: 0.85,     // chance a run pools ink where the pen lands and lifts
    blob: 0.45,     // chance a long run carries pooled blobs along its length
    drip: 0.35,     // chance a pooled blob runs into a drip
    speck: 0.7,     // chance a stamp throws specks
  };

  // node kinds and how often each is chosen, per drafting style
  const PATCH_NODES = [['pin', 8], ['module', 5], ['stack', 2], ['hub', 2], ['terminal', 3]];
  const CAD_NODES   = [['bubble', 6], ['rings', 3], ['section', 2], ['terminal', 3], ['module', 2], ['pin', 2]];
  const STYLES = ['patch', 'cad', 'mixed'];

  let paint;              // finished marks
  let u = 12;             // grid module (the unit everything is built from)
  let bs = 0.4;            // brush size multiplier
  let density = 1;        // nodes per unit of drag distance
  let styleLock = null;   // one of STYLES, or null for random per stroke
  let mirror = false;     // also stamp everything mirrored across the page centre

  let st = null;          // current stroke state
  let active = [];        // stamps still being drawn in
  let autoDelay = 0;      // ms offset applied to everything created (auto-fill)
  let rec = null;         // primitive list being recorded
  let boxes = [];         // occupied rectangles [x0, y0, x1, y1]: numbers and node bodies

  function setup(params = new URLSearchParams()) {
    engine.textFont(FONT);
    paint = makeLayer();
    if (STYLES.includes(params.get('style'))) styleLock = params.get('style');
    if (params.has('mirror')) mirror = true;
  }

  function makeLayer() {
    const g = engine.createGraphics(engine.width, engine.height);
    g.strokeCap(engine.ROUND);
    g.strokeJoin(engine.ROUND);
    g.textFont(FONT);
    return g;
  }

  function draw() {
    const now = engine.millis();
    advanceStroke();

    // bake finished stamps into the paint layer first, so nothing flickers
    const keep = [];
    for (const s of active) {
      if (now >= s.t0 + s.end) renderStamp(s, paint, Infinity);
      else keep.push(s);
    }
    active = keep;

    engine.image(paint, 0, 0);
    for (const s of active) renderStamp(s, engine, now);
  }

  // ---------------------------------------------------------------- stroke

  function beginStroke(x, y) {
    st = { x, y, tx: x, ty: y, pressed: true, travel: 0, nodes: [], mode: styleLock || pick(STYLES) };
  }

  // A follower chases the cursor, closing a fraction of the gap per substep, so
  // hand jitter is filtered before node positions are sampled.
  function advanceStroke() {
    if (!st) return;
    for (let k = 0; k < 4; k++) {
      const dx = st.tx - st.x, dy = st.ty - st.y;
      const d = engine.sqrt(dx * dx + dy * dy);
      if (d < 0.4 * bs) break;
      const step = engine.min(d, engine.max(1.5 * bs, d * 0.15));
      strokeTo(st.x + dx / d * step, st.y + dy / d * step);
    }
    if (!st.pressed && engine.dist(st.x, st.y, st.tx, st.ty) < 0.8 * bs) endStroke();
  }

  function strokeTo(x, y) {
    if (!st) return;
    const d = engine.dist(st.x, st.y, x, y);
    if (d < 0.3 * bs) return;
    st.travel += d;
    const spacing = (u * 6 * bs) / density;
    if (st.travel >= spacing) {
      st.travel = 0;
      placeNode(snap(x), snap(y));
    }
    st.x = x; st.y = y;
  }

  function endStroke() {
    if (st && !st.nodes.length) placeNode(snap(st.x), snap(st.y)); // a plain click
    st = null;
  }

  function isCad(mode) { return mode === 'cad' || (mode === 'mixed' && engine.random() < 0.5); }

  // ---------------------------------------------------------------- stamping

  // Place a node on the grid, wire it to the previous node of the stroke, label
  // it and hang decorations off it. Everything goes into `rec`, then `commit`
  // schedules it to draw in.
  function placeNode(x, y) {
    const prev = st.nodes[st.nodes.length - 1] || null;
    if (prev && engine.dist(prev.x, prev.y, x, y) < u * 2.5 * bs) return;
    const cad = isCad(st.mode);
    const n = makeNode(x, y, cad);
    rec = [];
    claim([x - n.rx, y - n.ry, x + n.rx, y + n.ry]);
    if (prev) connect(prev, n, cad);
    drawNode(n);
    if (engine.random() < 0.85) label(n, cad);
    decorate(n, prev, cad);
    st.nodes.push(n);
    commit(rec);
  }

  // Give every primitive a start time and duration as if a single pen were
  // drawing them one after another (with a little overlap).
  function commit(prims) {
    if (!prims.length) { rec = null; return; }
    if (engine.random() < INK.speck) {
      const src = prims.find(p => p.k === 'ink');
      if (src) prims.push(specksNear(src.runs[0].pts[0]));
    }
    let cursor = 0, end = 0;
    for (const p of prims) {
      if (p.k === 'ink') p.dur = engine.max(80, p.len / (PEN_SPEED * bs));
      else if (p.k === 'text') p.dur = p.s.length * CHAR_MS + 60;
      else if (p.k === 'speck') p.dur = 90;
      else p.dur = 140;
      p.start = cursor;
      cursor += p.dur * 0.8;
      end = engine.max(end, p.start + p.dur);
    }
    const t0 = engine.millis() + autoDelay;
    active.push({ prims, t0, end });
    if (mirror) active.push({ prims: mirrorPrims(prims), t0, end });
    rec = null;
  }

  function mirrorPrims(prims) {
    const mx = engine.width;
    const flip = pts => pts.map(p => [mx - p[0], p[1]]);
    return prims.map(p => {
      const c = { ...p };
      if (p.k === 'ink') {
        c.runs = p.runs.map(r => ({ ...r, pts: flip(r.pts) }));
        if (p.poly) c.poly = flip(p.poly);
      } else if (p.k === 'text') {
        c.x = mx - p.x;
        c.align = p.align === 'left' ? 'right' : p.align === 'right' ? 'left' : 'center';
        c.rot = -p.rot;
      } else if (p.k === 'speck') {
        c.dots = p.dots.map(d => [mx - d[0], d[1], d[2], d[3]]);
      } else {
        c.pts = flip(p.pts);
        c.cx = mx - p.cx;
      }
      return c;
    });
  }

  // ---------------------------------------------------------------- rendering

  function easeOutBack(q) {
    const c1 = 1.4, c3 = c1 + 1;
    return 1 + c3 * engine.pow(q - 1, 3) + c1 * engine.pow(q - 1, 2);
  }

  function renderStamp(s, g, now) {
    for (const p of s.prims) {
      const q = now === Infinity ? 1 : engine.constrain((now - s.t0 - p.start) / p.dur, 0, 1);
      if (q <= 0) continue;
      if (p.k === 'ink') drawInk(g, p, q);
      else if (p.k === 'text') drawText(g, p, q);
      else if (p.k === 'speck') drawSpecks(g, p, q);
      else drawBlot(g, p, q);
    }
  }

  // Ink runs revealed up to a pen-travel budget of q * total length.
  function drawInk(g, p, q) {
    if (q >= 1 && p.fill && p.poly) {
      g.noStroke();
      g.fill(p.fill);
      polyShape(g, p.poly, true);
    }
    let budget = q >= 1 ? Infinity : q * p.len;
    for (const r of p.runs) {
      if (budget >= r.len) { drawRun(g, r, r.pts, p.w, true); budget -= r.len; }
      else { drawRun(g, r, cutRun(r.pts, budget), p.w, false); break; }
    }
  }

  function polyShape(g, pts, closed) {
    g.beginShape();
    for (const v of pts) g.vertex(v[0], v[1]);
    if (closed) g.endShape(engine.CLOSE); else g.endShape();
  }

  // One run of wet ink: a soft bleed under a line whose weight wanders along
  // its length, with pooled ink where the pen landed (and lifted, once done).
  function drawRun(g, run, pts, w, complete) {
    if (pts.length < 2) return;
    g.noFill();
    bleedRun(g, run, pts, w);
    g.stroke(0, INK.body);
    for (let i = 1; i < pts.length; i++) {
      g.strokeWeight(w * (0.5 + 1.2 * engine.noise(run.seed + i * 0.2)));
      g.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
    }
    g.noStroke();
    if (run.pool) {
      poolBleed(g, run.seed + 7, pts[0][0], pts[0][1], w * 3);
      if (complete) poolBleed(g, run.seed + 11, pts[pts.length - 1][0], pts[pts.length - 1][1], w * 2.5);
    }
    g.fill(0, 225);
    if (run.pool) {
      g.circle(pts[0][0], pts[0][1], w * 3);
      if (complete) g.circle(pts[pts.length - 1][0], pts[pts.length - 1][1], w * 2.5);
    }
    for (const [i, size, drip] of run.blobs) {
      if (i >= pts.length) continue;
      const [x, y] = pts[i];
      g.noStroke();
      g.circle(x, y, w * size);
      if (drip > 0) {
        // ink running down the page from the blob, thinning to a bead
        g.stroke(0, 210);
        g.strokeWeight(w * 1.1);
        g.line(x, y, x, y + drip * 0.7);
        g.strokeWeight(w * 0.6);
        g.line(x, y + drip * 0.7, x, y + drip);
        g.noStroke();
        g.circle(x, y + drip, w * 1.6);
      }
    }
  }

  // Ink wicking into the paper: several soft layers whose reach varies along
  // the run (heavier where the pen dwelt), fading outward, plus fine fibers
  // where the ink follows the grain sideways. All driven by noise on the run's
  // seed so it is identical from frame to frame.
  function bleedRun(g, run, pts, w) {
    const reach = w * INK.bleed;
    // soft layers, fading outward; reach varies slowly and also flickers
    // segment to segment so the edge is uneven rather than a smooth glow
    const layers = [[1, 0.16], [0.6, 0.38], [0.33, 1]];
    for (const [mult, af] of layers) {
      g.stroke(0, INK.bleedAlpha * af);
      for (let i = 1; i < pts.length; i++) {
        const slow = engine.pow(engine.noise(run.seed + 40 + i * 0.11), 1.7);
        const fast = engine.noise(run.seed + 60 + i * 0.55);
        const k = 0.15 + 1.3 * slow + 0.6 * fast * slow;
        g.strokeWeight(w + reach * mult * k);
        g.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
      }
    }
    // fibers and grains: ink drawn sideways along the paper's fibres, and
    // specks of pigment caught just off the line
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      let nx = -(b[1] - a[1]), ny = b[0] - a[0];
      const m = engine.sqrt(nx * nx + ny * ny) || 1;
      nx /= m; ny /= m;
      if (engine.noise(run.seed + 90 + i * 2.3) > 1 - INK.fiber) {
        const side = engine.noise(run.seed + 130 + i * 1.3) < 0.5 ? -1 : 1;
        const len = reach * (0.3 + 1.2 * engine.noise(run.seed + 170 + i * 0.9));
        g.stroke(0, 35 + 50 * engine.noise(run.seed + 210 + i * 0.7));
        g.strokeWeight(engine.max(0.35 * run.scale, w * 0.3));
        g.line(b[0], b[1], b[0] + nx * side * len, b[1] + ny * side * len);
      }
      if (engine.noise(run.seed + 250 + i * 3.1) > 1 - INK.grain) {
        const side = engine.noise(run.seed + 290 + i * 1.7) < 0.5 ? -1 : 1;
        const off = w * 0.6 + reach * 0.9 * engine.noise(run.seed + 330 + i * 1.1);
        const r = 0.25 + 0.55 * engine.noise(run.seed + 370 + i * 0.8);
        g.noStroke();
        g.fill(0, 40 + 90 * engine.noise(run.seed + 410 + i * 0.6));
        g.circle(b[0] + nx * side * off, b[1] + ny * side * off, r * 2 * run.scale);
      }
    }
    g.noFill();
  }

  // Lobed bleed around a pool of ink: a soft disc with a few offset lobes
  // where the paper drank more on one side.
  function poolBleed(g, seed, x, y, d) {
    g.noStroke();
    g.fill(0, 18);
    g.circle(x, y, d * 2.2);
    for (let k = 0; k < 3; k++) {
      const a = engine.noise(seed + k * 3.1) * engine.TWO_PI * 2;
      const r = d * (0.3 + 0.5 * engine.noise(seed + 50 + k * 2.7));
      g.fill(0, 14 + 12 * engine.noise(seed + 80 + k));
      g.circle(x + engine.cos(a) * r, y + engine.sin(a) * r, d * (0.9 + 0.8 * engine.noise(seed + 110 + k * 1.9)));
    }
  }

  // The first `budget` px of a polyline.
  function cutRun(pts, budget) {
    if (budget <= 0) return [];
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const L = engine.dist(a[0], a[1], b[0], b[1]);
      if (budget >= L) { out.push(b); budget -= L; }
      else { const t = budget / L; out.push([engine.lerp(a[0], b[0], t), engine.lerp(a[1], b[1], t)]); break; }
    }
    return out;
  }

  function drawSpecks(g, p, q) {
    const sc = q >= 1 ? 1 : easeOutBack(q);
    g.noStroke();
    for (const [x, y, r, a] of p.dots) {
      g.fill(0, a);
      g.circle(x, y, r * 2 * sc);
    }
  }

  // Text types itself out. Partial strings are drawn left-aligned from where
  // the full string would start, so centred labels do not shuffle.
  function drawText(g, p, q) {
    const n = q >= 1 ? p.s.length : engine.ceil(q * p.s.length);
    if (n <= 0) return;
    g.textFont(FONT);
    g.textSize(p.size);
    g.textAlign(engine.LEFT, p.va === 'top' ? engine.TOP : p.va === 'bottom' ? engine.BOTTOM : engine.CENTER);
    const tw = g.textWidth(p.s);
    const x0 = p.align === 'left' ? 0 : p.align === 'center' ? -tw / 2 : -tw;
    g.push();
    g.translate(p.x, p.y);
    if (p.rot) g.rotate(p.rot);
    const part = p.s.slice(0, n);
    // ink wicking out from the figures: a fuzzy wide pass, then a crisp one
    g.fill(0, 0);
    g.stroke(0, 16);
    g.strokeWeight(engine.max(0.8 * p.scale, p.size * 0.22));
    g.text(part, x0, 0);
    g.stroke(0, 70);
    g.strokeWeight(engine.max(0.6 * p.scale, p.size * 0.1));
    g.fill(0, 245);
    g.text(part, x0, 0);
    g.pop();
  }

  function drawBlot(g, p, q) {
    const sc = q >= 1 ? 1 : easeOutBack(q);
    g.stroke(0, 70);
    g.strokeWeight(2.2 * p.scale);
    g.fill(p.col);
    g.push();
    g.translate(p.cx, p.cy);
    g.scale(sc);
    g.beginShape();
    for (const v of p.pts) g.vertex(v[0] - p.cx, v[1] - p.cy);
    g.endShape(engine.CLOSE);
    g.pop();
  }

  // ---------------------------------------------------------------- helpers

  function weightedPick(pairs) {
    let total = 0;
    for (const p of pairs) total += p[1];
    let r = engine.random(total);
    for (const p of pairs) {
      r -= p[1];
      if (r < 0) return p[0];
    }
    return pairs[pairs.length - 1][0];
  }

  function pick(a) { return a[engine.floor(engine.random(a.length))]; }
  // Every spatial detail uses the same linear scale as the node geometry.
  // Record scale on primitives so later size changes cannot alter queued ink.
  function snap(v) { const s = u * 0.5 * bs; return engine.round(v / s) * s; }
  function wt(k) { return W[k] * bs; }
  function fs(m = 0.72) { return engine.max(6.5, u * m * 0.92) * bs * LABEL_SCALE; }
  function measure(s, size) { engine.textFont(FONT); engine.textSize(size); return engine.textWidth(s); }

  // Every annotation is a random number: a small integer, a two-place decimal
  // or a longer reference number.
  function num() {
    const r = engine.random();
    if (r < 0.3) return String(engine.floor(engine.random(1, 13)));
    if (r < 0.7) return engine.random(1, 30).toFixed(2);
    if (r < 0.85) return engine.random(0, 10).toFixed(1);
    return String(engine.floor(engine.random(100, 1000)));
  }
  function smallNum() { return String(engine.floor(engine.random(1, 13))); }
  function refNum() { return `${engine.floor(engine.random(1, 5))}.${engine.floor(engine.random(1, 5))}`; }

  // recorders --------------------------------------------------------------

  // A polyline of ink. `dash` = [on, off] splits it into runs; `fill` marks a
  // closed shape that is filled once its outline is complete.
  function ink(pts, w, dash = null, fill = null) {
    if (pts.length < 2) return;
    const runs = dash ? dashRuns(pts, dash) : [mkRun(pts)];
    let len = 0;
    for (const r of runs) len += r.len;
    if (len <= 0) return;
    rec.push({ k: 'ink', runs, w, len, fill, poly: fill ? pts : null });
  }

  function mkRun(raw) {
    const pts = roughen(raw);
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += engine.dist(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
    const run = { pts, len, scale: bs, seed: engine.random(1000), pool: len > u * 1.5 * bs && engine.random() < INK.pool, blobs: [] };
    if (len > u * 3 * bs && engine.random() < INK.blob) {
      const count = engine.floor(engine.random(1, 3));
      for (let k = 0; k < count; k++) {
        const drip = engine.random() < INK.drip ? engine.random(u * 0.8, u * 3) * bs : 0;
        run.blobs.push([engine.floor(engine.random(2, pts.length - 2)), engine.random(2.2, 3.8), drip]);
      }
    }
    return run;
  }

  // Resample a polyline every few px so the line weight can wander along it.
  // With INK.wobble > 0 each point is also pushed sideways by a slow noise.
  function roughen(raw) {
    if (raw.length < 2) return raw;
    const dense = [raw[0]];
    for (let i = 1; i < raw.length; i++) {
      const a = raw[i - 1], b = raw[i];
      const L = engine.dist(a[0], a[1], b[0], b[1]);
      const n = engine.max(1, engine.ceil(L / (INK.step * bs)));
      for (let k = 1; k <= n; k++) dense.push([engine.lerp(a[0], b[0], k / n), engine.lerp(a[1], b[1], k / n)]);
    }
    if (INK.wobble <= 0) return dense;
    const seed = engine.random(1000);
    const amp = INK.wobble * bs;
    const out = [];
    for (let i = 0; i < dense.length; i++) {
      const p0 = dense[engine.max(0, i - 1)], p1 = dense[engine.min(dense.length - 1, i + 1)];
      let tx = p1[0] - p0[0], ty = p1[1] - p0[1];
      const m = engine.sqrt(tx * tx + ty * ty) || 1;
      tx /= m; ty /= m;
      const off = (engine.noise(seed + i * 0.35) - 0.5) * 2 * amp;
      out.push([dense[i][0] - ty * off, dense[i][1] + tx * off]);
    }
    return out;
  }

  // A few flecks of ink thrown around a point.
  function specksNear(pt) {
    const dots = [];
    const n = engine.floor(engine.random(6, 16));
    for (let i = 0; i < n; i++) {
      const a = engine.random(engine.TWO_PI), d = engine.random(u * 0.4, u * 3.5) * bs;
      dots.push([pt[0] + engine.cos(a) * d, pt[1] + engine.sin(a) * d, engine.random(0.4, 2) * bs, engine.random(120, 240)]);
    }
    return { k: 'speck', dots };
  }

  function dashRuns(pts, dash) {
    const runs = [];
    let cur = [pts[0]], on = true, rem = dash[0];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const L = engine.dist(a[0], a[1], b[0], b[1]);
      let t = 0;
      while (t < L) {
        const step = engine.min(rem, L - t);
        t += step; rem -= step;
        const p = [engine.lerp(a[0], b[0], t / L), engine.lerp(a[1], b[1], t / L)];
        if (on) cur.push(p);
        if (rem <= 0) {
          if (on) { runs.push(mkRun(cur)); cur = []; }
          else cur = [p];
          on = !on;
          rem = on ? dash[0] : dash[1];
        }
      }
    }
    if (cur.length > 1) runs.push(mkRun(cur));
    return runs;
  }

  function circ(cx, cy, r, w, dash = null, fill = null, a0 = 0, a1 = engine.TWO_PI) {
    const n = engine.max(12, engine.floor(r * engine.abs(a1 - a0) / (3 * bs)));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = engine.lerp(a0, a1, i / n);
      pts.push([cx + engine.cos(a) * r, cy + engine.sin(a) * r]);
    }
    ink(pts, w, dash, fill);
  }

  function rrectPts(x, y, w, h, rad) {
    rad = engine.min(rad, w / 2, h / 2);
    const pts = [];
    const corners = [[x + w - rad, y + rad, -engine.HALF_PI], [x + w - rad, y + h - rad, 0], [x + rad, y + h - rad, engine.HALF_PI], [x + rad, y + rad, engine.PI]];
    for (const [cx, cy, a0] of corners) {
      for (let i = 0; i <= 6; i++) {
        const a = a0 + engine.HALF_PI * i / 6;
        pts.push([cx + engine.cos(a) * rad, cy + engine.sin(a) * rad]);
      }
    }
    pts.push(pts[0]);
    return pts;
  }
  function rrect(x, y, w, h, rad, wgt, dash = null, fill = null) { ink(rrectPts(x, y, w, h, rad), wgt, dash, fill); }

  // A number that must land clear of everything placed so far: the box is
  // nudged through a few nearby positions and the number is dropped if none
  // is free. Returns the final [x, y] or null.
  function txt(s, x, y, size, align = 'left', va = 'center', rot = 0) {
    const g = u * bs;
    const tries = [[0, 0], [0, -g], [0, g], [g, 0], [-g, 0], [0, -2 * g], [0, 2 * g], [g, -g], [g, g], [-g, -g], [-g, g]];
    for (const [ox, oy] of tries) {
      const b = textBox(s, x + ox, y + oy, size, align, va, rot);
      if (!isFree(b)) continue;
      claim(b);
      txtRaw(s, x + ox, y + oy, size, align, va, rot);
      return [x + ox, y + oy];
    }
    return null;
  }

  // A number drawn exactly where asked (inside a bubble or marker).
  function txtRaw(s, x, y, size, align = 'left', va = 'center', rot = 0) {
    rec.push({ k: 'text', scale: bs, s, x, y, size, align, va, rot });
  }

  // Padded bounding box of a number in page coordinates.
  function textBox(s, x, y, size, align, va, rot) {
    const w = measure(s, size), h = size;
    const lx = align === 'left' ? 0 : align === 'center' ? -w / 2 : -w;
    const ly = va === 'top' ? 0 : va === 'center' ? -h / 2 : -h;
    const c = engine.cos(rot), sn = engine.sin(rot);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [px, py] of [[lx, ly], [lx + w, ly], [lx, ly + h], [lx + w, ly + h]]) {
      const wx = x + px * c - py * sn, wy = y + px * sn + py * c;
      x0 = engine.min(x0, wx); y0 = engine.min(y0, wy); x1 = engine.max(x1, wx); y1 = engine.max(y1, wy);
    }
    const pad = u * 0.22 * bs;
    return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
  }

  function isFree(b) {
    for (const o of boxes) if (b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]) return false;
    return true;
  }

  function claim(b) {
    boxes.push(b);
    if (mirror) boxes.push([engine.width - b[2], b[1], engine.width - b[0], b[3]]);
  }

  function blot(raw, col = '#000') {
    let cx = 0, cy = 0;
    for (const p of raw) { cx += p[0]; cy += p[1]; }
    cx /= raw.length; cy /= raw.length;
    // rag the outline: each vertex wanders a little in and out from the centre
    const amp = INK.rag * bs;
    const pts = raw.map(([x, y]) => {
      const dx = x - cx, dy = y - cy;
      const m = engine.sqrt(dx * dx + dy * dy) || 1;
      const off = (engine.random() - 0.5) * 2 * amp;
      return [x + dx / m * off, y + dy / m * off];
    });
    rec.push({ k: 'blot', scale: bs, pts, cx, cy, col });
  }
  function dotBlot(x, y, r) {
    const pts = [];
    for (let i = 0; i < 14; i++) pts.push([x + engine.cos(i / 14 * engine.TWO_PI) * r, y + engine.sin(i / 14 * engine.TWO_PI) * r]);
    blot(pts);
  }

  function bezierPts(x1, y1, cx1, cy1, cx2, cy2, x2, y2, n = 40) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push([engine.bezierPoint(x1, cx1, cx2, x2, t), engine.bezierPoint(y1, cy1, cy2, y2, t)]);
    }
    return pts;
  }

  // ---------------------------------------------------------------- nodes

  function makeNode(x, y, cad) {
    const kind = weightedPick(cad ? CAD_NODES : PATCH_NODES);
    const n = { x, y, kind, r: u * engine.random(0.8, 1.2) * bs };
    if (kind === 'module') { n.rx = u * engine.random(1.8, 2.6) * bs; n.ry = u * engine.random(1, 1.5) * bs; }
    else if (kind === 'stack') {
      n.cells = engine.floor(engine.random(2, 5));
      n.rx = u * 1.8 * bs;
      n.ry = (n.cells * u * 1.7 * bs + (n.cells - 1) * u * 0.25 * bs) / 2;
    }
    else if (kind === 'hub') n.r = u * engine.random(1.5, 2) * bs;
    else if (kind === 'bubble') n.r = u * 1.15 * bs;
    else if (kind === 'section') { n.rx = n.r * 1.9; n.ry = n.r * 1.45; }
    else if (kind === 'terminal') n.r = u * 0.55 * bs;
    else if (kind === 'rings') n.r = u * engine.random(1.6, 2.6) * bs;
    if (n.rx === undefined) { n.rx = n.r; n.ry = n.r; }
    return n;
  }

  function drawNode(n) {
    switch (n.kind) {
      case 'pin':      nodePin(n); break;
      case 'module':   cell(n.x - n.rx, n.y - n.ry, n.rx * 2, n.ry * 2); break;
      case 'stack':    nodeStack(n); break;
      case 'hub':      nodeHub(n); break;
      case 'terminal': nodeTerminal(n); break;
      case 'bubble':   nodeBubble(n); break;
      case 'section':  nodeSection(n); break;
      case 'rings':    nodeRings(n); break;
    }
  }

  // Circle with a small inner ring and crosshair ticks passing through it.
  function nodePin(n) {
    const { x, y, r } = n;
    circ(x, y, r, wt('reg'), null, '#fff');
    circ(x, y, r * 0.42, wt('thin'));
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      ink([[x + dx * r * 0.7, y + dy * r * 0.7], [x + dx * r * 1.45, y + dy * r * 1.45]], wt('thin'));
    }
    if (engine.random() < 0.3) circ(x, y, r * 1.9, wt('thin'), [u * 0.3 * bs, u * 0.25 * bs]);
  }

  // Rounded module box with some internal detail.
  function cell(x, y, w, h) {
    rrect(x, y, w, h, u * 0.3 * bs, wt('reg'), null, '#fff');
    const cx = x + w / 2, cy = y + h / 2;
    const v = engine.random();
    if (v < 0.4) {
      circ(cx, cy, h * 0.28, wt('thin'));
      ink([[cx - h * 0.4, cy], [cx + h * 0.4, cy]], wt('thin'));
      ink([[cx, cy - h * 0.4], [cx, cy + h * 0.4]], wt('thin'));
    } else if (v < 0.7) {
      const k = engine.floor(engine.random(1, 4));
      for (let i = 0; i < k; i++) {
        const yy = y + h * (i + 1) / (k + 1);
        ink([[x + u * 0.4 * bs, yy], [x + w - u * 0.4 * bs, yy]], wt('thin'));
      }
    } else {
      const k = engine.floor(engine.random(2, 5));
      for (let i = 0; i < k; i++) circ(x + w * (i + 0.5) / k, y + h - u * 0.45 * bs, u * 0.2 * bs, wt('thin'));
    }
  }

  function nodeStack(n) {
    const cellH = u * 1.7 * bs, gap = u * 0.25 * bs;
    let y = n.y - n.ry;
    for (let i = 0; i < n.cells; i++) {
      cell(n.x - n.rx, y, n.rx * 2, cellH);
      y += cellH + gap;
    }
  }

  // Large ring with an inner ring, centre dot, radial ticks and a partial outer arc.
  function nodeHub(n) {
    const { x, y, r } = n;
    circ(x, y, r, wt('reg'), null, '#fff');
    circ(x, y, r * 0.62, wt('thin'));
    dotBlot(x, y, r * 0.12);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      ink([[x + dx * r * 0.7, y + dy * r * 0.7], [x + dx * r * 1.25, y + dy * r * 1.25]], wt('thin'));
    }
    const a0 = engine.random(engine.TWO_PI);
    circ(x, y, r * 1.5, wt('thin'), engine.random() < 0.5 ? [u * 0.4 * bs, u * 0.3 * bs] : null, null, a0, a0 + engine.random(engine.PI * 0.6, engine.PI * 1.4));
  }

  // Small square with a dot, or a target of concentric rings.
  function nodeTerminal(n) {
    const { x, y, r } = n;
    if (engine.random() < 0.5) {
      ink([[x - r, y - r], [x + r, y - r], [x + r, y + r], [x - r, y + r], [x - r, y - r]], wt('reg'), null, '#fff');
      dotBlot(x, y, r * 0.3);
    } else {
      circ(x, y, r, wt('reg'), null, '#fff');
      circ(x, y, r * 0.62, wt('thin'));
      dotBlot(x, y, r * 0.22);
    }
  }

  // Callout bubble: circle split by a bar, reference above and sheet below.
  function nodeBubble(n) {
    const { x, y, r } = n;
    circ(x, y, r, wt('reg'), null, '#fff');
    ink([[x - r, y], [x + r, y]], wt('thin'));
    txtRaw(smallNum(), x, y - u * 0.1 * bs, fs(0.68), 'center', 'bottom');
    txtRaw(refNum(), x, y + u * 0.12 * bs, fs(0.55), 'center', 'top');
  }

  // Section marker: a diamond with a number, a sheet reference and a pointer.
  function nodeSection(n) {
    // a rhombus wider than it is tall, so the figures sit inside its waist
    const { x, y } = n, sw = n.r * 1.9, sh = n.r * 1.45;
    ink([[x, y - sh], [x + sw, y], [x, y + sh], [x - sw, y], [x, y - sh]], wt('reg'), null, '#fff');
    ink([[x - sw, y], [x + sw, y]], wt('thin'));
    // each figure centred in its half, where the rhombus is still wide
    txtRaw(smallNum(), x, y - sh * 0.4, fs(0.5), 'center', 'center');
    txtRaw(refNum(), x, y + sh * 0.42, fs(0.42), 'center', 'center');
    const d = pick([[0, -1], [0, 1], [-1, 0], [1, 0]]);
    const s = d[0] === 0 ? sh : sw;          // half-extent along the pointer axis
    const tip = [x + d[0] * (s + sh * 0.7), y + d[1] * (s + sh * 0.7)];
    const bx = x + d[0] * s, by = y + d[1] * s;
    blot([tip, [bx + d[1] * sh * 0.4, by + d[0] * sh * 0.4], [bx - d[1] * sh * 0.4, by - d[0] * sh * 0.4]]);
  }

  // Dashed outer ring around solid inner rings, with a centre cross.
  function nodeRings(n) {
    const { x, y, r } = n;
    circ(x, y, r, wt('reg'), [u * 0.5 * bs, u * 0.35 * bs]);
    circ(x, y, r * 0.62, wt('thin'));
    circ(x, y, r * 0.3, wt('thin'));
    ink([[x - r * 0.15, y], [x + r * 0.15, y]], wt('thin'));
    ink([[x, y - r * 0.15], [x, y + r * 0.15]], wt('thin'));
  }

  // ---------------------------------------------------------------- wiring

  function connect(a, b, cad) {
    if (!cad) { cable(a, b, engine.random() < 0.35 ? engine.floor(engine.random(2, 4)) : 1); return; }
    const r = engine.random();
    if (r < 0.55) orthoRoute(a, b);
    else if (r < 0.8) ink([[a.x, a.y], [b.x, b.y]], wt('reg'), [u * 0.6 * bs, u * 0.3 * bs]);
    else cable(a, b, 1);
  }

  // Patch cable(s): a bezier that sweeps or sags between the two nodes.
  function cable(a, b, count) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const L = engine.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / L, ny = dx / L;
    const kind = engine.random();
    const sag = u * engine.random(2, 7) * bs * (engine.random() < 0.5 ? -1 : 1);
    for (let i = 0; i < count; i++) {
      const off = (i - (count - 1) / 2) * u * 0.38 * bs;
      const ox = nx * off, oy = ny * off;
      let c1, c2;
      if (kind < 0.45) { c1 = [a.x + dx * 0.5, a.y]; c2 = [b.x - dx * 0.5, b.y]; }
      else if (kind < 0.8) {
        c1 = [a.x + dx * 0.2 + nx * sag, a.y + dy * 0.2 + ny * sag];
        c2 = [b.x - dx * 0.2 + nx * sag, b.y - dy * 0.2 + ny * sag];
      } else { c1 = [a.x, a.y + dy * 0.5]; c2 = [b.x, b.y - dy * 0.5]; }
      ink(bezierPts(a.x + ox, a.y + oy, c1[0] + ox, c1[1] + oy, c2[0] + ox, c2[1] + oy, b.x + ox, b.y + oy, 40), wt('cable'));
    }
  }

  // Orthogonal route with one or two right-angle bends.
  function orthoRoute(a, b) {
    const r = engine.random();
    let pts;
    if (r < 0.4) pts = [[a.x, a.y], [b.x, a.y], [b.x, b.y]];
    else if (r < 0.8) pts = [[a.x, a.y], [a.x, b.y], [b.x, b.y]];
    else {
      const mx = snap(engine.lerp(a.x, b.x, 0.5));
      pts = [[a.x, a.y], [mx, a.y], [mx, b.y], [b.x, b.y]];
    }
    ink(pts, wt('reg'));
    if (engine.random() < 0.5) for (let i = 1; i < pts.length - 1; i++) dotBlot(pts[i][0], pts[i][1], u * 0.12 * bs);
  }

  // ---------------------------------------------------------------- labels

  function label(n, cad) {
    if (n.kind === 'bubble' || n.kind === 'section') return;
    if (!cad) {
      // a number beside the node, with a smaller one hung below it
      const x = n.x + n.rx + u * 0.5 * bs;
      const p = txt(num(), x, n.y - u * 0.2 * bs, fs(0.72), 'left', 'bottom');
      if (p && engine.random() < 0.8) txt(num(), p[0], p[1] + u * 0.4 * bs, fs(0.6), 'left', 'top');
    } else {
      // an underlined number above the node
      const s = num();
      const size = fs(0.62);
      const p = txt(s, n.x, n.y - n.ry - u * 0.45 * bs, size, 'center', 'bottom');
      if (!p) return;
      const tw = measure(s, size);
      ink([[p[0] - tw / 2, p[1] + u * 0.12 * bs], [p[0] + tw / 2, p[1] + u * 0.12 * bs]], wt('thin'));
    }
  }

  // ---------------------------------------------------------------- decorations

  function decorate(n, prev, cad) {
    if (cad) {
      if (prev && engine.random() < 0.45) dimension(prev, n);
      if (engine.random() < 0.35) callout(n);
      if (engine.random() < 0.2) contours(n);
      if (engine.random() < 0.15) hatch(n);
      if (engine.random() < 0.3) leaderNote(n);
      if (engine.random() < 0.1) numArrow(n);
      if (engine.random() < 0.12) axisLine(n, true);
      if (!prev && engine.random() < 0.5) callout(n);
    } else {
      if (st && st.nodes.length >= 2 && engine.random() < 0.5) loopback(n);
      if (engine.random() < 0.08) chart(n);
      if (engine.random() < 0.12) axisLine(n, false);
      if (engine.random() < 0.2) ports(n);
      if (!prev && engine.random() < 0.5) ports(n);
    }
  }

  // Dimension line offset from the pair, with extension lines, tick slashes
  // and a measurement.
  function dimension(a, b) {
    const horiz = engine.abs(b.x - a.x) >= engine.abs(b.y - a.y);
    const span = horiz ? engine.abs(b.x - a.x) : engine.abs(b.y - a.y);
    if (span < u * 2 * bs) return;
    const sgn = engine.random() < 0.5 ? -1 : 1;
    const off = u * engine.random(2.5, 4.5) * bs * sgn;
    const tk = u * 0.22 * bs, w = wt('thin');
    const s = num();
    if (horiz) {
      const y = snap((sgn < 0 ? engine.min(a.y, b.y) : engine.max(a.y, b.y)) + off);
      for (const p of [a, b]) ink([[p.x, p.y + sgn * u * 0.6 * bs], [p.x, y + sgn * u * 0.5 * bs]], w);
      ink([[a.x, y], [b.x, y]], w);
      for (const p of [a, b]) ink([[p.x - tk, y + tk], [p.x + tk, y - tk]], wt('reg'));
      txt(s, (a.x + b.x) / 2, y - u * 0.15 * bs, fs(0.6), 'center', 'bottom');
    } else {
      const x = snap((sgn < 0 ? engine.min(a.x, b.x) : engine.max(a.x, b.x)) + off);
      for (const p of [a, b]) ink([[p.x + sgn * u * 0.6 * bs, p.y], [x + sgn * u * 0.5 * bs, p.y]], w);
      ink([[x, a.y], [x, b.y]], w);
      for (const p of [a, b]) ink([[x - tk, p.y + tk], [x + tk, p.y - tk]], wt('reg'));
      txt(s, x - u * 0.15 * bs, (a.y + b.y) / 2, fs(0.6), 'center', 'bottom', -engine.HALF_PI);
    }
  }

  // Bubble on a leader line pointing at the node.
  function callout(n) {
    const r = u * 1.1 * bs;
    let cx, cy, box = null;
    for (let i = 0; i < 8 && !box; i++) {
      const a = engine.random(engine.TWO_PI);
      const d = u * engine.random(3, 5) * bs + n.r;
      cx = snap(n.x + engine.cos(a) * d); cy = snap(n.y + engine.sin(a) * d);
      const b = [cx - r, cy - r, cx + r, cy + r];
      if (isFree(b)) box = b;
    }
    if (!box) return;
    claim(box);
    const ang = engine.atan2(n.y - cy, n.x - cx);
    ink([[n.x, n.y], [cx + engine.cos(ang) * r, cy + engine.sin(ang) * r]], wt('thin'));
    if (engine.random() < 0.5) dotBlot(n.x, n.y, u * 0.12 * bs);
    circ(cx, cy, r, wt('reg'), null, '#fff');
    ink([[cx - r, cy], [cx + r, cy]], wt('thin'));
    txtRaw(smallNum(), cx, cy - u * 0.1 * bs, fs(0.66), 'center', 'bottom');
    txtRaw(refNum(), cx, cy + u * 0.12 * bs, fs(0.52), 'center', 'top');
  }

  // Nested U-shaped contours (a bowl) opening toward one side of the node.
  function contours(n) {
    const count = engine.floor(engine.random(3, 7));
    const rot = engine.floor(engine.random(4)) * engine.HALF_PI;
    const step = u * 0.45 * bs;
    const w0 = n.rx * 2 + u * 1.2 * bs, h0 = n.ry + u * 1.2 * bs;
    const cr = engine.cos(rot), sr = engine.sin(rot);
    for (let i = 0; i < count; i++) {
      const w = w0 + i * step * 2, h = h0 + i * step;
      const local = [];
      local.push([-w / 2, h]);
      local.push([-w / 2, 0]);
      for (let k = 0; k <= 14; k++) {
        const a = engine.PI + engine.PI * k / 14;
        local.push([engine.cos(a) * w / 2, engine.sin(a) * w / 2]);
      }
      local.push([w / 2, h]);
      const pts = local.map(([px, py]) => [n.x + px * cr - py * sr, n.y + px * sr + py * cr]);
      ink(pts, wt(i === count - 1 ? 'reg' : 'thin'));
      if (i === count - 1) claim(bounds(pts));
    }
  }

  function bounds(pts) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { x0 = engine.min(x0, x); y0 = engine.min(y0, y); x1 = engine.max(x1, x); y1 = engine.max(y1, y); }
    return [x0, y0, x1, y1];
  }

  // Small rectangle filled with diagonal hatching.
  function hatch(n) {
    const w = u * engine.random(1.5, 3) * bs, h = u * engine.random(0.6, 1.2) * bs;
    const x = snap(n.x + u * engine.random(-4, 4) * bs), y = snap(n.y + u * engine.random(1.5, 3.5) * bs * (engine.random() < 0.5 ? -1 : 1));
    if (!isFree([x, y, x + w, y + h])) return;
    claim([x, y, x + w, y + h]);
    ink([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]], wt('thin'));
    const step = u * 0.28 * bs;
    for (let o = step; o < w + h; o += step) {
      const p1 = o <= w ? [x + o, y] : [x + w, y + (o - w)];
      const p2 = o <= h ? [x, y + o] : [x + (o - h), y + h];
      ink([p1, p2], wt('thin'));
    }
  }

  // Leader line out to a short shelf with a number written on it.
  function leaderNote(n) {
    const s = num();
    const size = fs(0.6);
    const tw = measure(s, size);
    for (const a of engine.shuffle([-engine.QUARTER_PI, -3 * engine.QUARTER_PI, engine.QUARTER_PI, 3 * engine.QUARTER_PI])) {
      const d = u * engine.random(2.5, 4.5) * bs + n.r;
      const px = snap(n.x + engine.cos(a) * d), py = snap(n.y + engine.sin(a) * d);
      const dir = engine.cos(a) > 0 ? 1 : -1;
      const tx = px + dir * u * 0.15 * bs, ty = py - u * 0.1 * bs;
      const align = dir > 0 ? 'left' : 'right';
      const b = textBox(s, tx, ty, size, align, 'bottom', 0);
      if (!isFree(b)) continue;
      claim(b);
      ink([[n.x + engine.cos(a) * n.r * 0.6, n.y + engine.sin(a) * n.r * 0.6], [px, py], [px + dir * (tw + u * 0.3 * bs), py]], wt('thin'));
      txtRaw(s, tx, ty, size, align, 'bottom');
      return;
    }
  }

  // Short arrow with a number beside it.
  function numArrow(n) {
    const px = snap(n.x + u * engine.random(-3, 3) * bs), py = snap(n.y + u * engine.random(2, 4) * bs * (engine.random() < 0.5 ? -1 : 1));
    const L = u * 1.6 * bs, dir = engine.random() < 0.5 ? -1 : 1;
    const s = smallNum(), size = fs(0.6), align = dir > 0 ? 'right' : 'left';
    const tx = px - dir * u * 0.15 * bs;
    const b = textBox(s, tx, py, size, align, 'center', 0);
    if (!isFree([engine.min(b[0], px), b[1], engine.max(b[2], px + dir * L), b[3]])) return;
    claim(b);
    ink([[px, py], [px + dir * L, py]], wt('thin'));
    const hx = px + dir * L;
    blot([[hx, py], [hx - dir * u * 0.35 * bs, py - u * 0.2 * bs], [hx - dir * u * 0.35 * bs, py + u * 0.2 * bs]]);
    txtRaw(s, tx, py, size, align, 'center');
  }

  // Long thin construction line ending in a marker.
  function axisLine(n, cad) {
    const horiz = engine.random() < 0.5;
    const L = u * engine.random(10, 26) * bs;
    const s = engine.random() < 0.5 ? -1 : 1;
    const ex = snap(horiz ? n.x + s * L : n.x), ey = snap(horiz ? n.y : n.y + s * L);
    const mr = cad ? u * 1.8 * bs : u * 0.75 * bs;
    if (!isFree([ex - mr, ey - mr, ex + mr, ey + mr])) return;
    claim([ex - mr, ey - mr, ex + mr, ey + mr]);
    ink([[n.x, n.y], [ex, ey]], wt('thin'), engine.random() < 0.5 ? [u * 0.9 * bs, u * 0.35 * bs] : null);
    if (cad) nodeSection({ x: ex, y: ey, r: u * 0.85 * bs });
    else {
      const r = u * 0.4 * bs;
      circ(ex, ey, r, wt('reg'), null, '#fff');
      ink([[ex - r * 1.8, ey], [ex + r * 1.8, ey]], wt('thin'));
      ink([[ex, ey - r * 1.8], [ex, ey + r * 1.8]], wt('thin'));
    }
  }

  // Cable back to a node a few steps earlier in the stroke.
  function loopback(n) {
    const k = engine.floor(engine.random(1, engine.min(5, st.nodes.length)));
    const target = st.nodes[st.nodes.length - 1 - k];
    if (!target) return;
    cable(target, n, 1);
  }

  // Small ports beside the node, each wired to it with a tiny line.
  function ports(n) {
    const k = engine.floor(engine.random(2, 4));
    const side = engine.random() < 0.5 ? -1 : 1;
    const x = snap(n.x + side * (n.rx + u * 1.6 * bs));
    for (let i = 0; i < k; i++) {
      const y = snap(n.y + (i - (k - 1) / 2) * u * 1.2 * bs);
      ink([[n.x + side * n.rx, y], [x, y]], wt('thin'));
      circ(x, y, u * 0.3 * bs, wt('reg'), null, '#fff');
    }
  }

  // Little graph inset with a couple of rising curves.
  function chart(n) {
    const w = u * 7 * bs, h = u * 4.5 * bs;
    const x0 = snap(n.x + u * engine.random(3, 6) * bs), y0 = snap(n.y - u * engine.random(1, 3) * bs);
    const box = [x0, y0, x0 + w, y0 + h + fs(0.55) + u * 0.4 * bs];
    if (!isFree(box)) return;
    claim(box);
    ink([[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h], [x0, y0]], wt('thin'));
    const ax = x0 + u * 0.6 * bs, ay = y0 + h - u * 0.6 * bs;
    ink([[ax, y0 + u * 0.4 * bs], [ax, ay], [x0 + w - u * 0.4 * bs, ay]], wt('thin'));
    const curves = engine.floor(engine.random(2, 4));
    for (let c = 0; c < curves; c++) {
      const p = engine.random(0.6, 2), amp = engine.random(0.5, 0.85), seed = engine.random(1000);
      const pts = [];
      for (let i = 0; i <= 30; i++) {
        const t = i / 30;
        const v = 0.1 + amp * engine.pow(t, p) + (engine.noise(seed + t * 3) - 0.5) * 0.15;
        pts.push([ax + u * 0.2 * bs + t * (w - u * 1.2 * bs), ay - u * 0.2 * bs - v * (h - u * 1.4 * bs)]);
      }
      ink(pts, wt('thin'));
    }
    txtRaw(num(), x0 + u * 0.2 * bs, y0 + h + u * 0.15 * bs, fs(0.55), 'left', 'top');
  }

  // ---------------------------------------------------------------- auto fill

  function autoFill() {
    // with mirror on, only draft the left half; the mirror fills in the right
    const w = mirror ? engine.width / 2 : engine.width;
    const runs = [];
    const unit = u * bs;
    const rows = engine.max(1, engine.floor(engine.height / (unit * 18)));
    for (let r = 0; r < rows; r++) {
      const y = unit * 9 + r * unit * 18 + engine.random(-unit * 2, unit * 2);
      runs.push([[engine.random(unit * 3, unit * 10), y], [w - engine.random(unit * 3, unit * 14), y + engine.random(-unit * 3, unit * 3)]]);
    }
    for (let c = 0; c < 1; c++) {
      const x = engine.random(w * 0.2, w * 0.8);
      runs.push([[x, engine.random(unit * 4, unit * 10)], [x + engine.random(-unit * 4, unit * 4), engine.height - engine.random(unit * 4, unit * 10)]]);
    }
    for (let d = 0; d < 1; d++) {
      runs.push([[engine.random(w * 0.1, w * 0.4), engine.random(engine.height * 0.1, engine.height * 0.9)], [engine.random(w * 0.6, w * 0.9), engine.random(engine.height * 0.1, engine.height * 0.9)]]);
    }
    let t = 0;
    for (const [a, b] of runs) {
      beginStroke(a[0], a[1]);
      const steps = engine.floor(engine.dist(a[0], a[1], b[0], b[1]) / (5 * bs));
      const seed = engine.random(1000);
      for (let i = 1; i <= steps; i++) {
        const q = i / steps;
        autoDelay = t + q * 1400;
        const wob = (engine.noise(seed + q * 4) - 0.5) * unit * 6;
        strokeTo(engine.lerp(a[0], b[0], q) + wob, engine.lerp(a[1], b[1], q) + wob);
      }
      autoDelay = t + 1500;
      endStroke();
      t += 500;
    }
    autoDelay = 0;
  }

  // ---------------------------------------------------------------- UI

  function clearAll() {
    st = null;
    paint.clear();
    active = [];
    boxes = [];
  }

  // The studio owns the canvas, input, history and export. This brush owns
  // its marks, animation and settings; no globals or DOM controls are installed.
  function finish() {
    if (st) {
      st.pressed = false;
      for (let i = 0; st && i < 240; i++) advanceStroke();
      if (st) endStroke();
    }

    for (const stamp of active) renderStamp(stamp, paint, Infinity);
    active = [];
  }

  function setSetting(name, value) {
    if (name === 'size') bs = engine.constrain(Number(value), 0.25, 4);
    if (name === 'density') density = engine.constrain(Number(value), 0.25, 6);
    if (name === 'style') styleLock = STYLES.includes(value) ? value : null;
    if (name === 'mirror') mirror = Boolean(value);
  }

  return {
    setup,
    resize() {
      clearAll();
      if (paint.pixelDensity() !== engine.pixelDensity()) paint.pixelDensity(engine.pixelDensity());
      paint.resizeCanvas(engine.width, engine.height);
      paint.strokeCap(engine.ROUND);
      paint.strokeJoin(engine.ROUND);
      paint.textFont(FONT);
    },
    draw,
    pointerDown(x, y) { finish(); beginStroke(x, y); },
    pointerMove(x, y) { if (st) { st.tx = x; st.ty = y; } },
    pointerUp() { if (st) st.pressed = false; },
    finish,
    clear: clearAll,
    autoFill,
    randomize() { clearAll(); u = engine.floor(engine.random(9, 16)); },
    getSettings() { return { size: bs, density, style: styleLock || 'auto', mirror }; },
    setSetting,
  };

}
