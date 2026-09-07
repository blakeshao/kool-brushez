export const BURST_DURATION = 240;
const STAGGER = 10;
const MAX_DELAY = 50;
const clamp = value => Math.max(0, Math.min(1, value));

function pop(t, overshoot) {
  // Throw almost all the motion into the first 72 ms, then recoil and lock.
  if (t < 0.3) return (1 + overshoot) * (1 - (1 - t / 0.3) ** 3);
  const recoil = (t - 0.3) / 0.7;
  return 1 + overshoot * (1 - recoil) ** 3 * Math.cos(recoil * Math.PI * 2);
}

export function burstPose(burst, now) {
  const t = burst.settled ? 1 : clamp((now - burst.start) / BURST_DURATION);
  if (t === 1) return { x: burst.x, y: burst.y, scale: 1, stretch: 1, shear: 0, rotation: 0, alpha: 1, done: true };
  const travel = pop(t, 0.24);
  const launch = Math.sin(Math.PI * Math.min(t / 0.55, 1));
  const recoil = Math.sin(Math.PI * clamp((t - 0.35) / 0.65));
  return {
    x: burst.from.x + (burst.x - burst.from.x) * travel,
    y: burst.from.y + (burst.y - burst.from.y) * travel,
    scale: pop(t, 0.5),
    // Pull into a long, thin smear, then squash across the launch direction.
    // Reciprocal axes preserve area while the separate pop swells the part.
    stretch: Math.exp(1.05 * launch - 0.6 * recoil),
    shear: Math.sign(burst.twist) * 0.65 * Math.sin(t * Math.PI * 2) * (1 - t),
    rotation: burst.twist * (1 - t) ** 2 * Math.cos(t * Math.PI * 2),
    alpha: clamp(t / 0.035), done: false,
  };
}

export function createBurst(x, y, older, now, origin = { x, y }) {
  let source = null, nearest = Infinity;
  for (const candidate of older) {
    const distance = (candidate.x - x) ** 2 + (candidate.y - y) ** 2;
    if (distance < nearest) { source = candidate; nearest = distance; }
  }
  // A short ripple makes fast swipes grow from their earlier components.
  // Cap the ripple so a long stroke or auto-fill never builds a slow queue.
  const start = source && !source.settled
    ? Math.max(now, Math.min(now + MAX_DELAY, source.start + STAGGER)) : now;
  const from = source ? burstPose(source, start) : origin;
  return { x, y, start, from: { x: from.x, y: from.y }, settled: false,
    angle: Math.atan2(y - from.y, x - from.x),
    twist: (older.length % 2 ? -1 : 1) * 0.95 };
}
