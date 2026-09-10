import { bounds } from "./fluid.js";
import { css, darken, lighten } from "./palette.js";

export const BLOOM = 260; // ms for a fresh drop to spread and lose its wet blur

/** Pigment is painted newest over oldest, exactly as it floats in a tray.
 * That order is also what draws the holes: a drop opens the boundary around
 * it into a ring, and the ring's missing middle is covered by the very drop
 * that made it, so filled outlines composite into the right image. */
export function pigmentPath(points) {
  const path = new Path2D();
  path.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) path.lineTo(points[i], points[i + 1]);
  path.closePath();
  return path;
}

/** Tones a pigment carries for its whole life, so nothing is recomputed per
 * frame and its bands stay the same color as they are pushed around. */
export function pigmentTones(ink, metal) {
  return {
    fill: css(ink),
    // The size shows through where two pigments meet; a fine pale edge is the
    // vein, and a trace of a darker tone under it stops bands from fusing.
    vein: css(lighten(ink, 0.62)),
    edge: css(darken(ink, 0.22)),
    leaf: metal ? css(lighten(metal, 0.45)) : null,
    metal: metal ? css(metal) : null,
    shadow: metal ? css(darken(metal, 0.3)) : null,
  };
}

/** Flecks recorded as positions around the boundary rather than on the paper,
 * so leafing travels with its band when later ink stretches it. */
export function scatterFlecks(random, count) {
  const flecks = [];
  for (let i = 0; i < count; i++) {
    flecks.push([random(), 0.3 + random() * 0.45, 0.35 + random() * 1.5]);
  }
  return flecks;
}

function fleckAt(points, fraction, across) {
  const count = points.length / 2;
  const a = Math.floor(fraction * count) % count;
  const b = Math.floor((fraction + 0.5) * count) % count;
  return [
    points[a * 2] + (points[b * 2] - points[a * 2]) * across,
    points[a * 2 + 1] + (points[b * 2 + 1] - points[a * 2 + 1]) * across,
  ];
}

function paintLeaf(ctx, shape, path, box) {
  // Leafing catches the light in streaks along a band, not evenly across it.
  const { minX, minY, maxX, maxY } = box;
  const angle = shape.sheen * Math.PI;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const span = Math.max(maxX - minX, maxY - minY, 1) / 2;
  const gradient = ctx.createLinearGradient(
    cx - Math.cos(angle) * span,
    cy - Math.sin(angle) * span,
    cx + Math.cos(angle) * span,
    cy + Math.sin(angle) * span,
  );
  gradient.addColorStop(0, shape.tones.shadow);
  gradient.addColorStop(0.35, shape.tones.metal);
  gradient.addColorStop(0.52, shape.tones.leaf);
  gradient.addColorStop(0.7, shape.tones.metal);
  gradient.addColorStop(1, shape.tones.shadow);
  ctx.save();
  ctx.clip(path);
  ctx.fillStyle = gradient;
  ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
  ctx.fillStyle = shape.tones.leaf;
  ctx.globalAlpha *= 0.55;
  for (const [fraction, across, radius] of shape.flecks) {
    const [x, y] = fleckAt(shape.points, fraction, across);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * One pigment, at whatever stage of spreading it has reached. A drop that has
 * just landed is still wet: it arrives soft and a little under size, then
 * settles to a crisp edge. Blur is reserved for the newest few, since a
 * filtered fill costs far more than a plain one.
 *
 * The boundary moves on every stroke, so its path is rebuilt rather than
 * cached; a stale path would draw ink where it no longer is.
 */
export function paintPigment(ctx, shape, now, options = {}) {
  const age = (now - shape.born) / BLOOM;
  const wet = age < 1;
  const eased = wet ? 1 - (1 - Math.max(0, age)) ** 2 : 1;
  const path = pigmentPath(shape.points);
  const box = bounds(shape.points);
  ctx.save();
  if (wet) {
    const cx = (box.minX + box.maxX) / 2;
    const cy = (box.minY + box.maxY) / 2;
    const grow = 0.9 + 0.1 * eased;
    ctx.globalAlpha = eased;
    if (options.blur) ctx.filter = `blur(${(2.6 * (1 - eased)).toFixed(2)}px)`;
    ctx.translate(cx, cy);
    ctx.scale(grow, grow);
    ctx.translate(-cx, -cy);
  }
  ctx.fillStyle = shape.tones.fill;
  ctx.fill(path);
  if (shape.metal) paintLeaf(ctx, shape, path, box);
  ctx.lineJoin = "round";
  const settled = wet ? eased : 1;
  // A hair of the pigment's own darker tone feathers the edge, so a band
  // reads as paint meeting paint instead of a filled polygon.
  ctx.globalAlpha = settled * 0.22;
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = shape.tones.edge;
  ctx.stroke(path);
  if (options.veins) {
    ctx.globalAlpha = settled * 0.55;
    ctx.lineWidth = 0.7;
    ctx.strokeStyle = shape.tones.vein;
    ctx.stroke(path);
  }
  ctx.restore();
}
