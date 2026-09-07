export const FAMILIES = {
  blue: { ink: "#0099c8", codes: ["A", "C", "E"] },
  red: { ink: "#ef5938", codes: ["1", "2", "3"] },
  yellow: { ink: "#f9d51c", codes: ["N", "Q", "R", "W"] },
  orange: { ink: "#f4a02d", codes: ["B", "D", "F", "M"] },
  green: { ink: "#008e69", codes: ["4", "5", "6"] },
  purple: { ink: "#ae3d89", codes: ["7"] },
};
export const COLORS = Object.keys(FAMILIES);

/** A stable new palette at each turn. Change half the lanes, rounding up
 * for odd counts, and choose colors absent from the preceding bundle. */
export function turnPalettes(tracks, turns, seed) {
  let state = (seed ^ 0x51f15e) >>> 0;
  const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
  const result = [tracks];
  for (let turn = 0; turn < turns; turn++) {
    const previous = result.at(-1), next = [...previous];
    const lanes = previous.map((_, index) => index);
    for (let i = lanes.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
    }
    const candidates = COLORS.filter((key) => !previous.some((track) => track.ink === FAMILIES[key].ink));
    for (const lane of lanes.slice(0, Math.ceil(lanes.length / 2))) {
      const index = Math.floor(random() * candidates.length);
      const family = FAMILIES[candidates.splice(index, 1)[0]];
      next[lane] = { ink: family.ink, code: family.codes[Math.floor(random() * family.codes.length)] };
    }
    result.push(next);
  }
  return result;
}

export function colorStops(samples, palettes, lane) {
  const stops = [];
  let section = -1;
  for (const point of samples) {
    const next = point.section || 0;
    if (next === section) continue;
    section = next;
    const services = palettes[Math.min(section, palettes.length - 1)];
    stops.push({ d: point.d, service: services[lane], services });
  }
  return stops;
}

export function serviceAt(path, distance) {
  let result = { d: 0, service: path.tracks[0], services: path.services || path.tracks };
  for (const stop of path.colorStops || []) {
    if (stop.d > distance) break;
    result = stop;
  }
  return result;
}
