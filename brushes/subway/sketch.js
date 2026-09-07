import { extendRoute, roundedRoute, pointAt } from "./geometry.js";
import { createStrands } from "./network.js";
import { schedulePath, revealedDistance, prefix, detailOpacity, createFollower, followTo, arrivalAt, timingComplete } from "./animation.js";
import { stationDetail, annotationExtent, drawAnnotation } from "./annotations.js";
import { FAMILIES, COLORS, serviceAt } from "./palette.js";
import { canvasFont } from "../../shared/typography.js";
const BUNDLES = [
  [["blue", "A"], ["blue", "C"], ["orange", "D"], ["yellow", "N"]],
  [["red", "1"], ["red", "2"], ["green", "4"], ["green", "5"]],
  [["yellow", "N"], ["yellow", "Q"], ["orange", "B"], ["orange", "D"]],
  [["blue", "A"], ["blue", "C"], ["blue", "E"], ["orange", "F"]],
  [["green", "4"], ["green", "5"], ["green", "6"], ["purple", "7"]],
  [["orange", "B"], ["orange", "D"], ["red", "2"], ["red", "3"]],
];
const STATIONS = [
  ["59 St", "Columbus Circle"], ["57 St", "7 Av"], ["53 St", "7 Av"],
  ["50 St", "Broadway"], ["42 St", "Times Sq"], ["34 St", "Penn Station"],
  ["34 St", "Herald Sq"], ["28 St"], ["23 St"], ["14 St", "Union Sq"],
  ["8 St", "NYU"], ["Broadway–", "Lafayette St"], ["Canal St"],
  ["Chambers St"], ["City Hall"], ["Fulton St"], ["Wall St"], ["South Ferry"],
  ["Atlantic Av", "Barclays Ctr"], ["Bergen St"], ["Jay St", "MetroTech"],
  ["DeKalb Av"], ["Coney Island", "Stillwell Av"], ["Grand St"],
  ["Delancey St", "Essex St"], ["Astoria", "Ditmars Blvd"], ["Queensboro Plaza"],
  ["Queens Plaza"], ["Jackson Hts", "Roosevelt Av"], ["Court Sq"],
  ["Jamaica Center"], ["161 St", "Yankee Stadium"], ["Fordham Rd"],
  ["Pelham Bay Park"], ["Broadway Junction"], ["Church Av"], ["Franklin Av"], ["Prospect Park"],
];
const BLACK = "#101010";
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const expand = (box, amount) => ({ x: box.x - amount, y: box.y - amount, w: box.w + amount * 2, h: box.h + amount * 2 });

export default function createBrush(p) {
  let paint, live, stroke = null, dirty = false, scene = null;
  let size = 1, density = 1, details = 1.25, divergence = 1, color = "auto", routes = "4", labels = true;
  let familyIndex = 0, stationIndex = 0;
  let labelBoxes = [], corridors = [], pending = [];

  function setup(params = new URLSearchParams()) {
    paint = p.createGraphics(p.width, p.height);
    live = p.createGraphics(p.width, p.height);
    if (COLORS.includes(params.get("color"))) color = params.get("color");
    if (["1", "2", "3", "4"].includes(params.get("routes"))) routes = params.get("routes");
    if (params.get("labels") === "false") labels = false;
    if (params.has("divergence")) setSetting("divergence", params.get("divergence"));
    if (params.has("details")) setSetting("details", params.get("details"));
  }

  function newRoute(points, family) {
    const selected = family || color;
    const count = Number(routes), pitch = 5 * size;
    const bundle = BUNDLES[familyIndex++ % BUNDLES.length];
    const tracks = Array.from({ length: count }, (_, i) => {
      const [key, code] = selected === "auto" ? bundle[i] : [selected, FAMILIES[selected].codes[i % FAMILIES[selected].codes.length]];
      return { ink: FAMILIES[key].ink, code };
    });
    const result = {
      points, tracks, size, count, pitch, width: 2.2 * size,
      span: (count - 1) * pitch + 2.2 * size, density, details, divergence, labels,
      startedAt: p.millis(),
      seed: Math.floor(p.random() * 4294967296),
      nameIndex: stationIndex, side: familyIndex % 2 ? 1 : -1,
    };
    stationIndex = (stationIndex + 3) % STATIONS.length;
    return result;
  }

  function geometry(route) {
    route.samples = roundedRoute(route.points, Math.max(28 * route.size, route.span * 1.15));
    route.strands = createStrands(route);
    if (route.followPointer) {
      const now = p.millis();
      for (const path of route.strands.filter((path) => !path.branch)) {
        const id = `main-${path.lane}`;
        if (!route.followers.has(id)) route.followers.set(id, createFollower(route.size, now));
        path.follower = route.followers.get(id);
        followTo(path.follower, path.laneLength, now);
      }
      for (const path of route.strands) {
        if (path.branch && !route.branches.has(path.id)) {
          const parent = route.followers.get(`main-${path.lane}`);
          route.branches.set(path.id, { ...path, bornAt: arrivalAt(parent, path.branchAt, now) });
        }
      }
      // Growing the spine must neither replay nor reshape existing offshoots.
      route.strands = [...route.strands.filter((path) => !path.branch), ...route.branches.values()];
    }
    return route;
  }

  function visibleRoute() {
    const points = stroke.points.map((point) => ({ ...point }));
    // A click is a short station strip; input thereafter grows from its origin.
    if (points.length === 1) {
      const start = points[0], target = stroke.target;
      const d = Math.hypot(target.x - start.x, target.y - start.y);
      const angle = d > 4 * stroke.size
        ? Math.round(Math.atan2(target.y - start.y, target.x - start.x) / (Math.PI / 4)) * Math.PI / 4
        : 0;
      const length = Math.max(70 * stroke.size, d);
      points[0] = { x: start.x - Math.cos(angle) * 24 * stroke.size, y: start.y - Math.sin(angle) * 24 * stroke.size };
      points.push({ x: points[0].x + Math.cos(angle) * length, y: points[0].y + Math.sin(angle) * length });
    } else {
      // Extend the final straight section to the pen without making a tiny kink.
      const a = points.at(-2), b = points.at(-1);
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      const tx = (b.x - a.x) / length, ty = (b.y - a.y) / length;
      const extra = Math.max(0, (stroke.target.x - b.x) * tx + (stroke.target.y - b.y) * ty);
      b.x += tx * extra;
      b.y += ty * extra;
    }
    return geometry({ ...stroke, points });
  }

  function drawLines(ctx, route, distance) {
    const samples = prefix(route.samples, distance);
    if (samples.length < 2) return;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // Opaque paper between lanes keeps crossings crisp over earlier artwork.
    // Only the ribbon itself has a white fill; the rest of the layer is clear.
    ctx.lineWidth = route.width + 1.4 * route.size;
    ctx.strokeStyle = "#fff";
    ctx.beginPath();
    samples.forEach((point, i) => {
      if (i === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
    ctx.lineWidth = route.width;
    ctx.strokeStyle = route.tracks[0].ink;
    ctx.beginPath(); ctx.moveTo(samples[0].x, samples[0].y);
    for (const point of samples.slice(1)) {
      ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function stations(route) {
    const length = route.samples.at(-1)?.d || 0;
    const margin = 18 * route.size;
    const spacing = Math.max(26 * route.size, 72 * route.size / route.density);
    const result = [];
    for (let d = margin; d < length - 16 * route.size; d += spacing) {
      let at = d;
      let point = pointAt(route.samples, d);
      // Prefer a straight stretch so the station dots line up like typography.
      if (!point.straight) {
        for (const shift of [16, -16, 30, -30]) {
          const shifted = clamp(d + shift * route.size, margin, length - margin);
          const candidate = pointAt(route.samples, shifted);
          if (candidate.straight) { point = candidate; at = shifted; break; }
        }
      }
      result.push({ ...point, d: at, index: result.length });
    }
    return result;
  }

  function drawStations(ctx, route, stops, distance) {
    const s = route.size;
    ctx.save();
    ctx.fillStyle = BLACK;
    ctx.strokeStyle = BLACK;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = canvasFont(6.5 * s, 700);
    if (route.startsService && distance > 0) {
      const origin = route.samples[0];
      ctx.save();
      ctx.globalAlpha = Math.min(1, distance / (8 * s));
      ctx.beginPath(); ctx.arc(origin.x, origin.y, 2.3 * s, 0, Math.PI * 2);
      ctx.fillStyle = "#fff"; ctx.fill();
      ctx.strokeStyle = route.tracks[0].ink; ctx.lineWidth = 1.1 * s; ctx.stroke();
      ctx.restore();
    }
    if (route.endsService && distance > route.samples.at(-1).d) {
      const end = route.samples.at(-1);
      ctx.save(); ctx.globalAlpha = detailOpacity(route.timing, distance, end.d);
      ctx.beginPath(); ctx.arc(end.x, end.y, 1.7 * s, 0, Math.PI * 2);
      ctx.fillStyle = route.tracks[0].ink; ctx.fill(); ctx.restore();
    }
    for (const stop of stops) {
      if (distance <= stop.d) continue;
      ctx.save();
      ctx.globalAlpha = detailOpacity(route.timing, distance, stop.d);
      const interchange = stop.index % 4 === 2;
      const offsets = Array.from({ length: route.count }, (_, i) => (i - (route.count - 1) / 2) * route.pitch);
      if (interchange && route.count > 1) {
        const first = offsets[0], last = offsets.at(-1);
        ctx.lineWidth = .8 * s;
        ctx.beginPath();
        ctx.moveTo(stop.x - stop.ty * first, stop.y + stop.tx * first);
        ctx.lineTo(stop.x - stop.ty * last, stop.y + stop.tx * last);
        ctx.stroke();
      }
      offsets.forEach((offset, lane) => {
        const x = stop.x - stop.ty * offset, y = stop.y + stop.tx * offset;
        ctx.beginPath();
        const express = route.details > 0 && stop.index % 5 === 3;
        if (express) {
          ctx.moveTo(x, y - 3 * s); ctx.lineTo(x + 3 * s, y);
          ctx.lineTo(x, y + 3 * s); ctx.lineTo(x - 3 * s, y); ctx.closePath();
        } else ctx.arc(x, y, (interchange ? 2.4 : 1.65) * s, 0, Math.PI * 2);
        ctx.fillStyle = interchange || express ? "#fff" : BLACK;
        ctx.fill();
        if (interchange || express) { ctx.lineWidth = .8 * s; ctx.stroke(); }
        // Codes follow the station row, as in the reference's diagonal bundles.
        if (route.labels && stop.index % 2 === 0 && stop.straight) {
          ctx.fillStyle = BLACK;
          ctx.save();
          ctx.translate(x + stop.tx * 9 * s, y + stop.ty * 9 * s);
          const diagonal = Math.abs(stop.tx) > .25 && Math.abs(stop.ty) > .25;
          if (diagonal) ctx.rotate(stop.tx * stop.ty > 0 ? -Math.PI / 4 : Math.PI / 4);
          ctx.fillText(serviceAt(route, stop.d).service.code, 0, 0);
          ctx.restore();
        }
      });
      if (route.details > 0 && stop.index % 3 === 1 && stop.straight && distance > stop.d + 20 * s) {
        ctx.save(); ctx.translate(stop.x + stop.tx * 18 * s, stop.y + stop.ty * 18 * s);
        ctx.rotate(Math.atan2(stop.ty, stop.tx)); ctx.lineWidth = .7 * s;
        ctx.beginPath(); ctx.moveTo(-2 * s, -2 * s); ctx.lineTo(1.5 * s, 0); ctx.lineTo(-2 * s, 2 * s); ctx.stroke(); ctx.restore();
      }
      ctx.restore();
    }
    if (route.spur && distance > route.samples.at(-1).d) {
      const terminal = route.samples.at(-1);
      ctx.globalAlpha = detailOpacity(route.timing, distance, terminal.d);
      ctx.beginPath();
      ctx.arc(terminal.x, terminal.y, 4.5 * s, 0, Math.PI * 2);
      ctx.fillStyle = route.tracks[0].ink;
      ctx.fill();
      if (route.labels) {
        ctx.fillStyle = ["#f9d51c", "#f4a02d"].includes(route.tracks[0].ink) ? BLACK : "#fff";
        ctx.fillText(route.tracks[0].code, terminal.x, terminal.y);
      }
    }
    ctx.restore();
  }

  function labelHitsRoute(box, obstacles) {
    for (const route of obstacles) {
      const radius = route.span / 2 + 3 * route.size;
      if (!overlaps(box, expand(route.bounds, radius))) continue;
      for (const point of route.samples) {
        const dx = point.x - clamp(point.x, box.x, box.x + box.w);
        const dy = point.y - clamp(point.y, box.y, box.y + box.h);
        if (dx * dx + dy * dy < radius * radius) return true;
      }
    }
    return false;
  }

  function layoutLabels(ctx, route, stops, boxes, obstacles) {
    const records = [];
    if (!route.labels) return records;
    const s = route.size;
    ctx.save();
    ctx.fillStyle = BLACK;
    ctx.textBaseline = "top";
    for (const stop of stops) {
      const name = STATIONS[(route.nameIndex + stop.index) % STATIONS.length];
      const bold = stop.index % 4 === 2 || name.length > 1;
      ctx.font = canvasFont(8 * s, bold ? 700 : 400);
      const service = serviceAt(route, stop.d);
      const detail = stationDetail({ ...route, tracks: [service.service], services: service.services }, stop);
      const extra = annotationExtent(ctx, detail, s);
      const width = Math.max(extra.width, ...name.map((line) => ctx.measureText(line).width));
      const height = name.length * 9 * s + extra.height;
      let placed = false;
      for (const side of [route.side, -route.side]) {
        if (placed) break;
        const nx = -stop.ty * side, ny = stop.tx * side;
        for (const shift of [0, 14 * s, -14 * s]) {
          const offset = route.span / 2 + 8 * s;
          const x = stop.x + nx * offset + stop.tx * shift;
          const y = stop.y + ny * offset + stop.ty * shift;
          const left = nx < -0.25 ? x - width : nx > 0.25 ? x : x - width / 2;
          const top = ny < -0.25 ? y - height : ny > 0.25 ? y : y - height / 2;
          const box = { x: left - 2 * s, y: top - 2 * s, w: width + 4 * s, h: height + 4 * s };
          if (box.x < 4 || box.y < 4 || box.x + box.w > p.width - 4 || box.y + box.h > p.height - 4) continue;
          if (boxes.some((other) => overlaps(box, other)) || labelHitsRoute(box, obstacles)) continue;
          records.push({ name, bold, detail, left, top, at: stop.d });
          boxes.push(box);
          placed = true;
          break;
        }
      }
    }
    ctx.restore();
    return records;
  }

  function drawLabels(ctx, route, records, distance) {
    const s = route.size;
    ctx.save(); ctx.fillStyle = BLACK; ctx.textAlign = "left"; ctx.textBaseline = "top";
    for (const record of records) {
      if (distance <= record.at) continue;
      ctx.globalAlpha = detailOpacity(route.timing, distance, record.at + 6 * s);
      ctx.font = canvasFont(8 * s, record.bold ? 700 : 400);
      record.name.forEach((line, i) => ctx.fillText(line, record.left, record.top + i * 9 * s));
      ctx.globalAlpha = detailOpacity(route.timing, distance, record.at + 16 * s);
      drawAnnotation(ctx, record.detail, record.left, record.top + record.name.length * 9 * s, s);
    }
    ctx.restore();
  }

  // Place labels and decide junction clearance once per geometry change.
  // Animation only clips paths and reveals these stable drawing records.
  function prepareScene(batch, boxes, obstacles) {
    const paths = batch.flatMap((route) => route.strands);
    const occupied = obstacles.flatMap((route) => route.strands);
    batch.forEach((route) => route.strands.forEach((path) => {
      path.timing = schedulePath(path, route.startedAt, route.followPointer);
    }));
    const stops = paths.map((route) => stations(route).filter((stop) => {
      // Leave junctions clear instead of piling station rows over crossing lines.
      const vicinity = { x: stop.x, y: stop.y, w: .1, h: .1 };
      return !occupied.some((other) => other !== route &&
        overlaps(expand(vicinity, (other.span + route.span) / 2 + 10 * route.size), other.bounds) && other.samples.some((point) =>
        Math.abs(point.tx * stop.tx + point.ty * stop.ty) < .9 &&
        Math.hypot(point.x - stop.x, point.y - stop.y) < (other.span + route.span) / 2 + 10 * route.size));
    }));
    const annotations = paths.map((route, i) => layoutLabels(paint.drawingContext, route, stops[i], boxes, occupied));
    return { paths, stops, annotations, boxes };
  }

  function renderScene(layer, plan, now) {
    const ctx = layer.drawingContext;
    const distances = plan.paths.map((path) => revealedDistance(path.timing, now));
    plan.paths.forEach((path, i) => drawLines(ctx, path, distances[i]));
    plan.paths.forEach((path, i) => drawStations(ctx, path, plan.stops[i], distances[i]));
    plan.paths.forEach((path, i) => drawLabels(ctx, path, plan.annotations[i], distances[i]));
  }

  function draw() {
    if (dirty) {
      const batch = [...pending, ...(stroke ? [visibleRoute()] : [])];
      scene = batch.length ? prepareScene(batch, [...labelBoxes], [...corridors, ...batch]) : null;
      dirty = false;
    }
    const now = p.millis();
    if (scene && !stroke && scene.paths.every((path) => timingComplete(path.timing, now))) finish();
    p.image(paint, 0, 0);
    if (scene) {
      live.clear();
      renderScene(live, scene, now);
      p.image(live, 0, 0);
    }
  }

  function pointerUp() {
    if (!stroke) return;
    pending.push(visibleRoute());
    stroke = null;
    dirty = true;
  }

  function finish() {
    pointerUp();
    if (!pending.length) return;
    corridors.push(...pending);
    // Reconsider earlier labels when a new route crosses their old location.
    paint.clear();
    labelBoxes = [];
    renderScene(paint, prepareScene(corridors, labelBoxes, corridors), Infinity);
    pending = [];
    scene = null;
    live.clear();
    dirty = false;
  }

  function pointerDown(x, y) {
    finish();
    stroke = newRoute([{ x, y }]);
    stroke.followPointer = true;
    stroke.branches = new Map();
    stroke.followers = new Map();
    stroke.target = { x, y };
    dirty = true;
  }

  function pointerMove(x, y) {
    if (!stroke || !Number.isFinite(x) || !Number.isFinite(y)) return;
    stroke.target = { x, y };
    extendRoute(stroke.points, stroke.target, Math.max(34 * stroke.size, stroke.span * 1.6));
    dirty = true;
  }

  function clear() {
    stroke = null;
    scene = null;
    pending = [];
    dirty = false;
    labelBoxes = [];
    corridors = [];
    paint.clear();
    live.clear();
  }

  function resize() {
    for (const layer of [paint, live]) {
      if (layer.pixelDensity() !== p.pixelDensity()) layer.pixelDensity(p.pixelDensity());
      layer.resizeCanvas(p.width, p.height);
    }
    clear();
  }

  function autoFill() {
    finish();
    // Grow irregular routes from scattered nodes and existing junctions,
    // borrowing Schematic's branching structure rather than a fixed map layout.
    const w = p.width, h = p.height, unit = Math.min(w, h);
    const batch = [], hubs = [];
    const startedAt = p.millis();
    const count = 8 + Math.floor(p.random() * 4);
    for (let i = 0; i < count; i++) {
      const origin = hubs.length && p.random() < .55
        ? hubs[Math.floor(p.random() * hubs.length)]
        : { x: w * (.1 + p.random() * .8), y: h * (.1 + p.random() * .8) };
      const points = [{ ...origin }];
      let heading = Math.floor(p.random() * 8);
      const segments = 3 + Math.floor(p.random() * 5);
      for (let j = 0; j < segments; j++) {
        const a = points.at(-1);
        heading += [-2, -1, 0, 1, 2][Math.floor(p.random() * 5)];
        let angle = heading * Math.PI / 4;
        let length = unit * (.1 + p.random() * .22);
        let b = { x: a.x + Math.cos(angle) * length, y: a.y + Math.sin(angle) * length };
        if (b.x < w * .05 || b.x > w * .95 || b.y < h * .05 || b.y > h * .95) {
          heading = Math.round(Math.atan2(h / 2 - a.y, w / 2 - a.x) / (Math.PI / 4));
          angle = heading * Math.PI / 4;
          length *= .7;
          b = { x: a.x + Math.cos(angle) * length, y: a.y + Math.sin(angle) * length };
        }
        points.push(b);
        hubs.push(b);
      }
      const route = newRoute(points);
      route.startedAt = startedAt + i * 160;
      batch.push(geometry(route));
    }
    pending.push(...batch);
    dirty = true;
  }

  function randomize() {
    finish();
    familyIndex = (familyIndex + 1 + Math.floor(p.random() * (COLORS.length - 1))) % COLORS.length;
    stationIndex = Math.floor(p.random() * STATIONS.length);
  }

  function getSettings() { return { size, density, details, divergence, color, routes, labels }; }

  function setSetting(id, value) {
    if (id === "size" && Number.isFinite(Number(value))) size = clamp(Number(value), 0.35, 3);
    if (id === "density" && Number.isFinite(Number(value))) density = clamp(Number(value), 0.4, 2.5);
    if (id === "details" && Number.isFinite(Number(value))) details = clamp(Number(value), 0, 2);
    if (id === "divergence" && Number.isFinite(Number(value))) divergence = clamp(Number(value), 0, 2);
    if (id === "color" && (value === "auto" || COLORS.includes(value))) color = value;
    if (id === "routes" && ["1", "2", "3", "4"].includes(String(value))) routes = String(value);
    if (id === "labels" && typeof value === "boolean") labels = value;
  }

  return { setup, resize, draw, pointerDown, pointerMove, pointerUp, finish, clear,
    autoFill, randomize, getSettings, setSetting };
}
