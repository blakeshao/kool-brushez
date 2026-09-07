const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function simplifyGuide(points) {
  const loop = [...points, points[0]];
  const keep = new Set([0, loop.length - 1]);
  const stack = [[0, loop.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    const a = loop[first], b = loop[last];
    const dx = b.x - a.x, dy = b.y - a.y;
    let furthest = -1, error = 0.65 ** 2;
    for (let i = first + 1; i < last; i++) {
      const point = loop[i];
      const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
      const distance = (point.x - a.x - dx * t) ** 2 + (point.y - a.y - dy * t) ** 2;
      if (distance > error) { error = distance; furthest = i; }
    }
    if (furthest !== -1) {
      keep.add(furthest);
      stack.push([first, furthest], [furthest, last]);
    }
  }
  // Simplify only the hidden reveal guide; preserve the actual source ink.
  return [...keep].sort((a, b) => a - b).slice(0, -1).map(i => loop[i]);
}

export function planTrace(ink) {
  const contours = [];
  for (const match of ink.matchAll(/M\s+([^Z]+)Z/g)) {
    const numbers = match[1].match(/-?\d+(?:\.\d+)?/g).map(Number);
    let points = [];
    for (let i = 0; i < numbers.length; i += 2)
      points.push({ x: numbers[i], y: numbers[i + 1] });
    if (points.length < 3) continue;
    if (Math.hypot(points[0].x - points.at(-1).x, points[0].y - points.at(-1).y) < 0.1)
      points.pop();
    const simplified = simplifyGuide(points);
    if (simplified.length >= 3) points = simplified;
    let start = 0;
    for (let i = 1; i < points.length; i++)
      if (points[i].y > points[start].y) start = i;
    const ordered = [...points.slice(start), ...points.slice(0, start)];
    let length = 0;
    const segments = ordered.map((a, i) => {
      const b = ordered[(i + 1) % ordered.length];
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      const segment = { a, b, distance, start: length };
      length += distance;
      return segment;
    });
    contours.push({ segments, length, bottom: ordered[0].y });
  }
  const height = Math.max(1, ...contours.flatMap(contour => contour.segments.map(segment => -segment.a.y)));
  for (const contour of contours)
    contour.delay = clamp(-contour.bottom / height * 0.8, 0, 0.8);
  return contours;
}

function capsule(mask, a, b, radius = 2.6) {
  const distance = Math.hypot(b.x - a.x, b.y - a.y);
  if (!distance) return;
  const nx = -(b.y - a.y) / distance * radius;
  const ny = (b.x - a.x) / distance * radius;
  // Matching winding directions make overlapping reveal segments a union.
  mask.moveTo(a.x - nx, a.y - ny);
  mask.lineTo(b.x - nx, b.y - ny);
  mask.lineTo(b.x + nx, b.y + ny);
  mask.lineTo(a.x + nx, a.y + ny);
  mask.closePath();
  for (const point of [a, b]) {
    mask.moveTo(point.x + radius, point.y);
    mask.arc(point.x, point.y, radius, 0, Math.PI * 2);
    mask.closePath();
  }
}

export function traceMask(contours, progress) {
  const mask = new Path2D();
  for (const contour of contours) {
    const t = clamp((progress - contour.delay) / (1 - contour.delay), 0, 1);
    if (!t) continue;
    const traveled = contour.length * t / 2;
    // Both sides trace away from the feet, rather than wiping across height.
    for (const segment of contour.segments) {
      const forward = clamp((traveled - segment.start) / (segment.distance || 1), 0, 1);
      const backward = clamp((traveled - (contour.length - segment.start - segment.distance)) / (segment.distance || 1), 0, 1);
      const { a, b } = segment;
      if (forward) capsule(mask, a, {
        x: a.x + (b.x - a.x) * forward,
        y: a.y + (b.y - a.y) * forward,
      });
      if (backward) capsule(mask, b, {
        x: b.x + (a.x - b.x) * backward,
        y: b.y + (a.y - b.y) * backward,
      });
    }
  }
  return mask;
}
