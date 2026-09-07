const INK = "#171b1e";
const BLUE = "#287e9d";
const TYPES = ["accessible", "transfer", "express", "bus", "rail", "airport", "ferry", "direction", "clock"];
const NOTES = { transfer: "Free transfer", express: "Peak direction", bus: "Bus connection",
  rail: "Rail connection", airport: "AirTrain", ferry: "Ferry connection", direction: "Uptown", clock: "Weekdays only" };

export function stationDetail(path, stop) {
  if (!path.details) return null;
  const hash = (Math.imul((path.annotationSeed || 0) ^ (stop.index + 1), 2654435761) >>> 0);
  if ((hash % 100) / 100 > Math.min(.96, path.details * .72)) return null;
  const type = TYPES[(hash >>> 8) % TYPES.length];
  const services = path.services || path.tracks;
  return { type, note: NOTES[type] || "", services: services.slice(0, type === "transfer" ? 3 : 2) };
}

export function annotationExtent(ctx, detail, size) {
  if (!detail) return { width: 0, height: 0 };
  ctx.save();
  ctx.font = `${6 * size}px Helvetica, Arial, sans-serif`;
  const rowWidth = detail.type === "accessible" || detail.type === "transfer" || detail.type === "express"
    ? (14 + detail.services.length * 10) * size
    : 14 * size + ctx.measureText(detail.note).width;
  const width = Math.max(rowWidth, ctx.measureText(detail.note).width);
  ctx.restore();
  return { width, height: (detail.type === "transfer" || detail.type === "express" ? 19 : 11) * size };
}

export function badge(ctx, service, x, y, size, diamond = false) {
  ctx.save();
  ctx.fillStyle = service.ink;
  ctx.beginPath();
  if (diamond) {
    ctx.moveTo(x, y - size); ctx.lineTo(x + size, y);
    ctx.lineTo(x, y + size); ctx.lineTo(x - size, y); ctx.closePath();
  } else ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ["#f9d51c", "#f4a02d"].includes(service.ink) ? INK : "#fff";
  ctx.font = `700 ${size * 1.35}px Helvetica, Arial, sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(service.code, x, y + size * .04);
  ctx.restore();
}

// Small vector pictograms stay sharp at every canvas/export density. No emoji
// or font glyphs: their geometry and visual weight match the printed map.
export function symbol(ctx, type, x, y, size) {
  ctx.save(); ctx.translate(x, y); ctx.scale(size, size);
  ctx.strokeStyle = BLUE; ctx.fillStyle = BLUE;
  ctx.lineWidth = .9; ctx.lineCap = "round"; ctx.lineJoin = "round";
  const line = (points) => {
    ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
  };
  if (type === "accessible") {
    ctx.beginPath(); ctx.arc(4.1, 1.5, 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(3.8, 7, 2.7, -.4, Math.PI * 1.55); ctx.stroke();
    line([[4, 3.2], [4.6, 6.4], [7.3, 6.4], [8.5, 9], [10, 8.4]]);
    line([[4.3, 4.5], [7.4, 4.5]]);
  } else if (type === "transfer") {
    line([[2.7, 5], [8, 5]]);
    for (const x of [2.7, 8]) { ctx.beginPath(); ctx.arc(x, 5, 2.1, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill(); ctx.stroke(); }
  } else if (type === "airport") {
    ctx.beginPath();
    [[5, 0], [6, 1], [6, 4], [10, 6], [10, 7], [6, 6], [6, 9], [8, 10], [5, 9.3], [2, 10], [4, 9], [4, 6], [0, 7], [0, 6], [4, 4], [4, 1]].forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath(); ctx.fill();
  } else if (type === "ferry") {
    line([[1, 5], [9, 5], [7.5, 8], [3, 8], [1, 5]]);
    line([[3, 5], [3, 2.5], [7, 2.5], [7, 5]]);
    line([[5, 2.5], [5, .5]]); line([[0, 9.5], [2, 9], [4, 9.5], [6, 9], [8, 9.5], [10, 9]]);
  } else if (type === "rail" || type === "bus") {
    ctx.strokeRect(1.6, .8, 7, 7);
    ctx.strokeRect(2.6, 2, 5, 2.7);
    for (const x of [3, 7]) { ctx.beginPath(); ctx.arc(x, 6.2, .5, 0, Math.PI * 2); ctx.fill(); }
    line(type === "rail" ? [[3, 8], [1.5, 10]] : [[2.4, 8], [2.4, 9]]);
    line(type === "rail" ? [[7, 8], [8.5, 10]] : [[7.6, 8], [7.6, 9]]);
  } else if (type === "clock") {
    ctx.beginPath(); ctx.arc(5, 5, 4.2, 0, Math.PI * 2); ctx.stroke();
    line([[5, 2], [5, 5], [7, 6.2]]);
  } else if (type === "express") {
    line([[5, .5], [9.5, 5], [5, 9.5], [.5, 5], [5, .5]]);
    line([[3, 5], [7, 5], [5.5, 3.5]]);
  } else {
    line([[.5, 5], [9, 5], [6, 2]]); line([[9, 5], [6, 8]]);
  }
  ctx.restore();
}

export function drawAnnotation(ctx, detail, x, y, size) {
  if (!detail) return;
  ctx.save();
  symbol(ctx, detail.type, x, y + size, size * .8);
  if (["accessible", "transfer", "express"].includes(detail.type)) {
    detail.services.forEach((service, i) => badge(ctx, service, x + (16 + i * 10) * size, y + 5 * size, 3.7 * size, detail.type === "express"));
    if (detail.note) {
      ctx.fillStyle = "#5a6268"; ctx.font = `${6 * size}px Helvetica, Arial, sans-serif`;
      ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillText(detail.note, x, y + 11 * size);
    }
  } else {
    ctx.fillStyle = "#5a6268"; ctx.font = `${6 * size}px Helvetica, Arial, sans-serif`;
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(detail.note, x + 13 * size, y + 5 * size);
  }
  ctx.restore();
}
