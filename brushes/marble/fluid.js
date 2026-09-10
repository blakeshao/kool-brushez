/** The tray, as closed-form maps.
 *
 * Marbling is not a texture; it is the record of ink being pushed around on
 * size. Every pigment here is a closed boundary, and every action applies one
 * map to every boundary already floating in the tray. Ink laid down earlier
 * therefore keeps being displaced by whatever lands next, which is what
 * produces nested veins, cells, feathering and the fact that no two pours are
 * alike. Each map has a closed form, so a stroke is exact rather than a
 * simulation that has to converge. */

const TAU = Math.PI * 2;

/** A pigment boundary, sampled finely enough to bend smoothly. */
export function circle(cx, cy, radius, spacing = 2.4) {
  const count = Math.max(28, Math.min(200, Math.round((TAU * radius) / spacing)));
  const points = new Array(count * 2);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * TAU;
    points[i * 2] = cx + Math.cos(angle) * radius;
    points[i * 2 + 1] = cy + Math.sin(angle) * radius;
  }
  return points;
}

/** A drop of ink of `radius` landing at (cx, cy). It displaces the size
 * radially by exactly its own area, so every boundary around it opens up into
 * a ring and keeps the area it had. This is the whole reason concentric bands
 * appear: the tenth drop in one place has pushed the first nine into nine
 * thin rings around it. */
export function drop(points, cx, cy, radius) {
  const area = radius * radius;
  for (let i = 0; i < points.length; i += 2) {
    const dx = points[i] - cx;
    const dy = points[i + 1] - cy;
    const distance = dx * dx + dy * dy;
    if (distance < 1e-9) {
      points[i] = cx + radius;
      points[i + 1] = cy;
      continue;
    }
    const scale = Math.sqrt(1 + area / distance);
    points[i] = cx + dx * scale;
    points[i + 1] = cy + dy * scale;
  }
}

/** A tine — one tooth of a comb — drawn through the tray along (ux, uy). Ink
 * travels with the tooth, and the pull decays with distance from its line, so
 * bands crossing the tooth are drawn out into the long feathered points that
 * define combed marbling. */
export function tine(points, ax, ay, ux, uy, reach, falloff) {
  const nx = -uy;
  const ny = ux;
  for (let i = 0; i < points.length; i += 2) {
    const across = (points[i] - ax) * nx + (points[i + 1] - ay) * ny;
    const pull = reach * Math.exp(-Math.abs(across) / falloff);
    points[i] += ux * pull;
    points[i + 1] += uy * pull;
  }
}

/** A stylus turned in one spot: rotation about (cx, cy) that dies away with
 * distance. Feathered bands caught in it fold back on themselves, which is
 * how a pour gets whorls and cells instead of only parallel veins. */
export function vortex(points, cx, cy, angle, falloff) {
  for (let i = 0; i < points.length; i += 2) {
    const dx = points[i] - cx;
    const dy = points[i + 1] - cy;
    const turn = angle * Math.exp(-Math.hypot(dx, dy) / falloff);
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    points[i] = cx + dx * cos - dy * sin;
    points[i + 1] = cy + dx * sin + dy * cos;
  }
}

/** A wavy rake pulled the length of the tray: displacement along (ux, uy)
 * that swings with the crossways coordinate, giving the even ripples that run
 * under a finished pattern. */
export function ripple(points, ux, uy, amplitude, wavelength, phase) {
  const nx = -uy;
  const ny = ux;
  for (let i = 0; i < points.length; i += 2) {
    const across = points[i] * nx + points[i + 1] * ny;
    const swing = amplitude * Math.sin((across / wavelength) * TAU + phase);
    points[i] += ux * swing;
    points[i + 1] += uy * swing;
  }
}

/** Keeps a boundary faithful as it stretches.
 *
 * Displacing a fixed set of points is only as smooth as their spacing: a band
 * drawn out to ten times its length would show its original vertices as
 * corners. Long edges are therefore split and bunched-up points dropped, so
 * detail follows the ink instead of the sampling it started with. */
export function refine(points, maxSegment = 2.6, minSegment = 0.8, limit = 520) {
  const count = points.length / 2;
  if (count < 3) return points;
  const longest = maxSegment * maxSegment;
  const shortest = minSegment * minSegment;
  const out = [points[0], points[1]];
  let lastX = points[0];
  let lastY = points[1];
  for (let i = 1; i <= count; i++) {
    const index = (i % count) * 2;
    const x = points[index];
    const y = points[index + 1];
    const dx = x - lastX;
    const dy = y - lastY;
    const span = dx * dx + dy * dy;
    if (span < shortest && i < count) continue;
    if (span > longest) {
      const splits = Math.min(40, Math.ceil(Math.sqrt(span) / maxSegment));
      for (let k = 1; k < splits; k++) {
        out.push(lastX + (dx * k) / splits, lastY + (dy * k) / splits);
      }
    }
    // The closing edge subdivides but must not repeat the starting point.
    if (i < count) out.push(x, y);
    lastX = x;
    lastY = y;
  }
  if (out.length / 2 <= limit) return out;
  // Past the budget, thin the boundary evenly rather than let one sprawling
  // band starve the rest of the tray of detail.
  const stride = out.length / 2 / limit;
  const thinned = new Array(limit * 2);
  for (let i = 0; i < limit; i++) {
    const source = Math.floor(i * stride) * 2;
    thinned[i * 2] = out[source];
    thinned[i * 2 + 1] = out[source + 1];
  }
  return thinned;
}

/** Signed area, doubled. Its sign gives the winding direction and its
 * magnitude is what the drop map is supposed to preserve. */
export function shoelace(points) {
  let total = 0;
  const count = points.length / 2;
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    total += points[i * 2] * points[j * 2 + 1] - points[j * 2] * points[i * 2 + 1];
  }
  return total;
}

export function bounds(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < points.length; i += 2) {
    if (points[i] < minX) minX = points[i];
    if (points[i] > maxX) maxX = points[i];
    if (points[i + 1] < minY) minY = points[i + 1];
    if (points[i + 1] > maxY) maxY = points[i + 1];
  }
  return { minX, minY, maxX, maxY };
}

/** Ink carried right off the paper by later drops is gone for good and only
 * costs time to keep bending. */
export function offPaper(points, width, height, margin = 40) {
  const box = bounds(points);
  return (
    box.maxX < -margin ||
    box.maxY < -margin ||
    box.minX > width + margin ||
    box.minY > height + margin
  );
}
