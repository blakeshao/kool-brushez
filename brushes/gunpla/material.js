// Molded-plastic shading built from the actual part silhouette. The height
// field rounds the rim, slopes into sockets and engraves the panel lines.
// Sprites are cached at 4× native resolution; size changes never rebuild them.
const cache = new Map();
const RESOLUTION = 4;
const PADDING = 4;
const reliefs = new WeakMap();

function sourceRelief(definition, x, y) {
  const relief = definition.relief;
  if (!relief) return 0;
  if (!reliefs.has(relief)) reliefs.set(relief, Uint8Array.from(atob(relief.data), c => c.charCodeAt(0)));
  const data = reliefs.get(relief);
  const px = Math.max(0, Math.min(relief.width - 1, (x / definition.w + 0.5) * (relief.width - 1)));
  const py = Math.max(0, Math.min(relief.height - 1, (y / definition.h + 0.5) * (relief.height - 1)));
  const left = Math.floor(px), top = Math.floor(py);
  const right = Math.min(relief.width - 1, left + 1), bottom = Math.min(relief.height - 1, top + 1);
  const tx = px - left, ty = py - top;
  return ((data[top * relief.width + left] * (1 - tx) + data[top * relief.width + right] * tx) * (1 - ty)
    + (data[bottom * relief.width + left] * (1 - tx) + data[bottom * relief.width + right] * tx) * ty) / 255;
}

function distanceField(alpha, width, height) {
  const d = new Float32Array(width * height);
  for (let i = 0; i < d.length; i++) d[i] = alpha[i * 4 + 3] > 127 ? 10000 : 0;
  const diagonal = Math.SQRT2;
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const i = y * width + x;
    d[i] = Math.min(d[i], d[i - 1] + 1, d[i - width] + 1,
      d[i - width - 1] + diagonal, d[i - width + 1] + diagonal);
  }
  for (let y = height - 2; y > 0; y--) for (let x = width - 2; x > 0; x--) {
    const i = y * width + x;
    d[i] = Math.min(d[i], d[i + 1] + 1, d[i + width] + 1,
      d[i + width + 1] + diagonal, d[i + width - 1] + diagonal);
  }
  return d;
}

export function plasticSprite(definition, geometry, material, details, texture, flip) {
  const detail = Math.round(details * 20) / 20;
  const grain = Math.round(texture * 20) / 20;
  const key = `${definition.shape}:${material.plastic}:${detail}:${grain}:${flip}`;
  if (cache.has(key)) return cache.get(key);
  const logicalWidth = definition.w + PADDING * 2;
  const logicalHeight = definition.h + PADDING * 2;
  const width = Math.ceil(logicalWidth * RESOLUTION);
  const height = Math.ceil(logicalHeight * RESOLUTION);
  function surface() {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.scale(RESOLUTION, RESOLUTION);
    ctx.translate(logicalWidth / 2, logicalHeight / 2);
    ctx.scale(flip, 1);
    return { canvas, ctx };
  }
  const mask = surface();
  mask.ctx.fill(geometry.shape, "evenodd");
  const pixels = mask.ctx.getImageData(0, 0, width, height);
  const distance = distanceField(pixels.data, width, height);
  const engravings = surface();
  engravings.ctx.lineJoin = "round";
  engravings.ctx.lineCap = "round";
  engravings.ctx.lineWidth = 0.65;
  engravings.ctx.globalAlpha = Math.min(1, detail);
  if (!definition.relief) engravings.ctx.stroke(geometry.seams);
  if (detail > 1 && !definition.relief) {
    engravings.ctx.globalAlpha = detail - 1;
    engravings.ctx.lineWidth = 0.4;
    engravings.ctx.stroke(geometry.fine);
  }
  const seams = engravings.ctx.getImageData(0, 0, width, height).data;
  const faces = surface();
  faces.ctx.filter = `blur(${RESOLUTION * 0.6}px)`;
  if (geometry.facet && !definition.relief) faces.ctx.fill(geometry.facet);
  const facets = faces.ctx.getImageData(0, 0, width, height).data;
  const elevations = new Float32Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    if (!pixels.data[i * 4 + 3]) continue;
    const d = distance[i] / RESOLUTION;
    const nx = (x / RESOLUTION - logicalWidth / 2) / (definition.w / 2);
    const ny = (y / RESOLUTION - logicalHeight / 2) / (definition.h / 2);
    const roundedRim = 1.1 * (1 - Math.exp(-d / 0.62));
    const crown = Math.max(0, 1 - nx * nx * 0.45 - ny * ny * 0.55) * 0.7;
    const referenceDetail = sourceRelief(definition,
      (x / RESOLUTION - logicalWidth / 2) * flip, y / RESOLUTION - logicalHeight / 2);
    elevations[i] = roundedRim + crown + facets[i * 4 + 3] / 255 * 0.6
      - seams[i * 4 + 3] / 255 * 0.38 * Math.min(1, d)
      - referenceDetail * detail * 0.22;
  }
  const rgb = material.rgb;
  let noise = 817;
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const i = y * width + x, offset = i * 4;
    if (!pixels.data[offset + 3]) continue;
    const gx = (elevations[i + 1] - elevations[i - 1]) * RESOLUTION / 2;
    const gy = (elevations[i + width] - elevations[i - width]) * RESOLUTION / 2;
    const normal = Math.sqrt(gx * gx + gy * gy + 1);
    const light = (gx * 0.46 + gy * 0.52 + 0.72) / normal;
    const bevel = Math.max(0, 0.45 - distance[i] / RESOLUTION) * 26;
    noise = (Math.imul(noise, 1664525) + 1013904223) >>> 0;
    const micrograin = (noise / 4294967296 - 0.5) * grain * 3.4;
    const shade = (light - 0.72) * 82 - bevel + micrograin;
    for (let channel = 0; channel < 3; channel++)
      pixels.data[offset + channel] = Math.max(0, Math.min(254, rgb[channel] + shade));
  }
  const painted = new OffscreenCanvas(width, height);
  painted.getContext("2d").putImageData(pixels, 0, 0);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.globalAlpha = 0.17;
  ctx.filter = `blur(${RESOLUTION * 0.55}px)`;
  ctx.drawImage(mask.canvas, RESOLUTION * 0.35, RESOLUTION * 0.7);
  ctx.globalAlpha = 1;
  ctx.filter = "none";
  ctx.drawImage(painted, 0, 0);
  const sprite = { canvas, width: logicalWidth, height: logicalHeight };
  if (cache.size >= 96) cache.delete(cache.keys().next().value);
  cache.set(key, sprite);
  return sprite;
}
