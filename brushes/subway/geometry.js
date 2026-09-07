const EPSILON = 1e-6;
const OCTANT = Math.PI / 4;
const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

/** Walk toward input on an eight-direction grid, merging straight runs.
 * Hysteresis keeps a slightly wavering hand from alternating directions.
 * Minimum-length segments leave room for concentric, parallel corners.
 */
export function extendRoute(points, target, step) {
  let end = points.at(-1);
  const budget = Math.ceil(distance(end, target) / step) + 8;
  for (let moves = 0; moves < budget && distance(end, target) >= step; moves++) {
    const previous = points.at(-2);
    const angle = Math.atan2(target.y - end.y, target.x - end.x);
    let direction = Math.round(angle / OCTANT) * OCTANT;
    if (previous) {
      const heading = Math.atan2(end.y - previous.y, end.x - previous.x);
      const turn = Math.atan2(Math.sin(angle - heading), Math.cos(angle - heading));
      if (Math.abs(turn) < Math.PI / 7.2) direction = heading;
      else {
        // Even a sudden reversal gets a proper bend instead of a folded ribbon.
        const snapped = Math.round(turn / OCTANT) * OCTANT;
        direction = heading + Math.max(-Math.PI / 2, Math.min(Math.PI / 2, snapped));
      }
    }
    const next = {
      x: end.x + Math.cos(direction) * step,
      y: end.y + Math.sin(direction) * step,
    };
    if (previous) {
      const ux = end.x - previous.x, uy = end.y - previous.y;
      const vx = next.x - end.x, vy = next.y - end.y;
      if (Math.abs(ux * vy - uy * vx) < EPSILON && ux * vx + uy * vy > 0)
        points[points.length - 1] = next;
      else points.push(next);
    } else points.push(next);
    end = next;
  }
}

/** Circular fillets with analytic tangents: offset lanes stay concentric. */
export function roundedRoute(points, radius) {
  if (points.length < 2) return [];
  const samples = [];
  let section = 0;
  function add(x, y, tx, ty, straight) {
    const last = samples.at(-1);
    const length = last ? distance(last, { x, y }) : 0;
    if (last && length < EPSILON) return;
    samples.push({ x, y, tx, ty, straight, section, d: (last?.d || 0) + length });
  }
  function line(a, b) {
    const length = distance(a, b);
    if (length < EPSILON) return;
    const tx = (b.x - a.x) / length, ty = (b.y - a.y) / length;
    const count = Math.max(1, Math.ceil(length / 4));
    for (let i = 0; i <= count; i++)
      add(a.x + (b.x - a.x) * i / count, a.y + (b.y - a.y) * i / count, tx, ty, true);
  }
  let cursor = points[0];
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1], b = points[i], c = points[i + 1];
    const incoming = distance(a, b), outgoing = distance(b, c);
    if (incoming < EPSILON || outgoing < EPSILON) continue;
    const ux = (b.x - a.x) / incoming, uy = (b.y - a.y) / incoming;
    const vx = (c.x - b.x) / outgoing, vy = (c.y - b.y) / outgoing;
    const turn = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    if (Math.abs(turn) < EPSILON || Math.abs(turn) > Math.PI - EPSILON) {
      line(cursor, b);
      if (Math.abs(turn) > Math.PI - EPSILON) section++;
      cursor = b;
      continue;
    }
    const tangent = Math.tan(Math.abs(turn) / 2);
    const trim = Math.min(radius * tangent, incoming * 0.48, outgoing * 0.48);
    const r = trim / tangent, sign = Math.sign(turn);
    const entry = { x: b.x - ux * trim, y: b.y - uy * trim };
    const exit = { x: b.x + vx * trim, y: b.y + vy * trim };
    const center = { x: entry.x - uy * sign * r, y: entry.y + ux * sign * r };
    line(cursor, entry);
    const start = Math.atan2(entry.y - center.y, entry.x - center.x);
    const count = Math.max(2, Math.ceil(Math.abs(turn) / (Math.PI / 48)), Math.ceil(r * Math.abs(turn) / 4));
    for (let k = 1; k <= count; k++) {
      if (k === Math.ceil(count / 2)) section++;
      const angle = start + turn * k / count;
      add(center.x + Math.cos(angle) * r, center.y + Math.sin(angle) * r,
        -Math.sin(angle) * sign, Math.cos(angle) * sign, false);
    }
    cursor = exit;
  }
  line(cursor, points.at(-1));
  return samples;
}

export function pointAt(samples, distance) {
  if (!samples.length) return null;
  let low = 0, high = samples.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (samples[mid].d < distance) low = mid + 1;
    else high = mid;
  }
  const b = samples[low], a = samples[Math.max(0, low - 1)];
  const t = b.d === a.d ? 0 : Math.max(0, Math.min(1, (distance - a.d) / (b.d - a.d)));
  const tx = a.tx + (b.tx - a.tx) * t, ty = a.ty + (b.ty - a.ty) * t;
  const length = Math.hypot(tx, ty) || 1;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t,
    tx: tx / length, ty: ty / length, straight: a.straight && b.straight };
}
