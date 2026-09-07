export const GROW_DURATION = 780;
export const FIGURE_STAGGER = 25;
const MAX_WAIT = 120;

export function scheduleFigures(pending, figures, now) {
  // Bring waiting people forward when the pen reaches a new group, so growth
  // starts at the pen without overtaking earlier marks or retiming active ones.
  for (const figure of pending)
    if (figure.bornAt > now) figure.bornAt = now;
  const stagger = Math.min(FIGURE_STAGGER, MAX_WAIT / Math.max(1, figures.length - 1));
  let start = now;
  for (const figure of figures) {
    figure.bornAt = start;
    figure.duration = GROW_DURATION;
    pending.push(figure);
    start += stagger;
  }
}

export function growthProgress(figure, now) {
  const t = Math.min(1, Math.max(0, (now - figure.bornAt) / figure.duration));
  return t * t * (3 - 2 * t);
}

export function idleMotion(figure, pose, now, resumedAt = -Infinity, individual = 0) {
  const completedAt = figure.completedAt ?? figure.bornAt + figure.duration;
  const elapsed = now - Math.max(completedAt, resumedAt);
  if (figure.kind === "object" || elapsed <= 0) return { lean: 0, breath: 1 };
  const ramp = Math.min(1, elapsed / 450);
  const strength = ramp * ramp * (3 - 2 * ramp);
  const phase = figure.index * 1.73 + figure.x * 0.021 + figure.y * 0.037 + individual * 2.1;
  const period = (pose === "walking" ? 2300 : pose === "seated" ? 4100 : 3300) + (figure.index % 4) * 170 + individual * 130;
  const t = (now - completedAt) / period * Math.PI * 2;
  const sway = pose === "walking" ? 0.035 : pose === "seated" ? 0.021 : 0.028;
  return {
    lean: strength * sway * (Math.sin(t + phase) + 0.22 * Math.sin(t * 0.47 + phase * 1.3)),
    breath: 1 + strength * 0.01 * Math.sin(t * 0.72 + phase + 0.8),
  };
}
