import { PARTS, COMPONENT_POOLS } from "./components.js";
import { plasticSprite } from "./material.js";
import { canvasFont } from "../../shared/typography.js";

export { COMPONENT_POOLS };
export const INKS = {
  white: { plastic: "#f5f5f1", rgb: [244, 245, 242], rail: "#eeeeea", edge: "#b3b6b1", highlight: "#fdfdfb", label: "#3e3b43" },
  graphite: { plastic: "#c1c3c0", rgb: [193, 195, 192], rail: "#c4c6c2", edge: "#91968f", highlight: "#e1e3de", label: "#3e3b43" },
  blue: { plastic: "#9eafc6", rgb: [158, 175, 198], rail: "#a5b7ce", edge: "#697e98", highlight: "#d2dcea", label: "#344968" },
  red: { plastic: "#d4a79e", rgb: [212, 167, 158], rail: "#d8b3aa", edge: "#a9776d", highlight: "#edd0c7", label: "#75463e" },
  olive: { plastic: "#c0c7a6", rgb: [192, 199, 166], rail: "#c5ccb3", edge: "#8d9873", highlight: "#e0e4d1", label: "#52583b" },
};

export function createComponent(random, settings, number, selectedKind) {
  const pool = COMPONENT_POOLS[settings.parts];
  const kind = selectedKind || pool[Math.floor(random() * pool.length)];
  const definition = PARTS[kind];
  const variation = settings.variation ?? 1;
  return {
    ...settings, texture: settings.texture ?? 0.35,
    kind, number, width: definition.w, height: definition.h,
    flip: random() < 0.5 ? -1 : 1,
    // Preserve physical differences: a polycap is tiny, a cannon is long.
    // Variation changes mold size instead of normalizing every silhouette.
    scale: Math.pow(0.68 + random() * 0.66, variation),
    labelCorner: Math.floor(random() * 4), unused: random() < 0.055,
    molded: random() < 0.28,
  };
}

const paths = new Map();
function partPaths(kind) {
  if (!paths.has(kind)) {
    const definition = PARTS[kind];
    paths.set(kind, {
      shape: new Path2D(definition.shape),
      seams: new Path2D(definition.seams),
      fine: new Path2D(definition.fine),
      facet: definition.facet ? new Path2D(definition.facet) : null,
    });
  }
  return paths.get(kind);
}

function segment(ctx, points) {
  ctx.moveTo(points[0], points[1]);
  ctx.lineTo(points[2], points[3]);
}
function moldedRunner(ctx, path, ink, width) {
  ctx.save();
  ctx.translate(0.22, 0.38);
  ctx.strokeStyle = "rgba(100, 106, 98, 0.19)";
  ctx.lineWidth = width + 0.8;
  ctx.stroke(path);
  ctx.restore();
  ctx.strokeStyle = ink.edge;
  ctx.lineWidth = width;
  ctx.stroke(path);
  ctx.strokeStyle = ink.rail;
  ctx.lineWidth = width - 0.65;
  ctx.stroke(path);
  ctx.save();
  ctx.translate(-0.24, -0.24);
  ctx.strokeStyle = ink.highlight;
  ctx.lineWidth = width * 0.28;
  ctx.stroke(path);
  ctx.restore();
}

export function drawComponent(ctx, part, x, y, width, height, edges) {
  const ink = INKS[part.color];
  const definition = PARTS[part.kind];
  const geometry = partPaths(part.kind);
  const scale = Math.min(part.scale, (width - 12) / definition.w, (height - 13) / definition.h);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(part.size, part.size);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const rails = new Path2D();
  for (const points of edges) segment(rails, points);
  moldedRunner(ctx, rails, ink, 2.8);

  const [top, bottom] = definition.gates || [-definition.h / 2, definition.h / 2];
  const gates = new Path2D();
  segment(gates, [0, -height / 2, 0, (top + 1) * scale]);
  segment(gates, [0, (bottom - 1) * scale, 0, height / 2]);
  moldedRunner(ctx, gates, ink, 1.65);

  const sprite = plasticSprite(definition, geometry, ink, part.details, part.texture, part.flip);
  ctx.drawImage(sprite.canvas, -sprite.width * scale / 2, -sprite.height * scale / 2,
    sprite.width * scale, sprite.height * scale);
  if (part.labels) {
    const right = part.labelCorner % 2 === 1;
    const bottomLabel = part.labelCorner >= 2;
    const labelX = (right ? 1 : -1) * (width / 2 - 4.3);
    const labelY = (bottomLabel ? 1 : -1) * (height / 2 - 4.3);
    ctx.fillStyle = ink.label;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(labelX, labelY, 3.8, 4.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = canvasFont(6.8);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const number = part.kind === "ballcap" || part.kind === "bushing"
      ? String.fromCharCode(65 + (part.number - 1) % 14) : String(part.number);
    ctx.fillText(number, labelX, labelY + 0.3, 6.1);
    if (part.unused) {
      ctx.strokeStyle = ink.label;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      segment(ctx, [labelX + (right ? -9 : 9) - 2, labelY - 2.5, labelX + (right ? -9 : 9) + 2, labelY + 2.5]);
      segment(ctx, [labelX + (right ? -9 : 9) + 2, labelY - 2.5, labelX + (right ? -9 : 9) - 2, labelY + 2.5]);
      ctx.stroke();
    }
    if (part.molded && width > 40) {
      ctx.fillStyle = ink.edge;
      ctx.font = canvasFont(3.2);
      ctx.fillText(`${part.number < 10 ? "0" : ""}${part.number}  ${part.kind === "ballcap" ? "PE" : "PS"}`, 0, height / 2 - 3);
    }
  }
  ctx.restore();
}

export function drawHeading(ctx, target) {
  const { layout, settings, x, y, cell, letter } = target;
  if (!settings.labels || !layout.pieces.length) return;
  const ink = INKS[settings.color];
  const width = (layout.maxColumn - layout.minColumn) * layout.unit;
  ctx.save();
  ctx.translate(x + (layout.minColumn - 0.5) * cell, y + (layout.minRow - 0.5) * cell);
  ctx.scale(settings.size, settings.size);
  ctx.fillStyle = ink.label;
  ctx.strokeStyle = ink.label;
  ctx.lineWidth = 0.65;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  const wide = width >= 155;
  const material = settings.parts === "mechanical" ? "ABS樹脂：ABS" : "スチロール樹脂：PS";
  ctx.strokeRect(0, wide ? -17 : -25, 44, 11);
  ctx.font = canvasFont(9.5);
  ctx.fillText(`${letter}パーツ`, 3, wide ? -8 : -16, 38);
  ctx.font = canvasFont(wide ? 8 : 6);
  ctx.fillText(`（${material}）`, wide ? 47 : 0, wide ? -8 : -5, Math.max(25, wide ? width - 47 : width));
  ctx.restore();
}
