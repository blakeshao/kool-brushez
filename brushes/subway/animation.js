import { pointAt } from "./geometry.js";

const FOLLOW_MS = 70;
const SETTLE_DISTANCE = .35;

export function createFollower(size, now) {
  return { distance: 0, target: 0, lastAt: now, settledAt: now, maxLag: 42 * size };
}

export function advanceFollower(follower, now) {
  const gap = Math.max(0, follower.target - follower.distance);
  const elapsed = Math.max(0, now - follower.lastAt);
  const settleAfter = gap > SETTLE_DISTANCE ? FOLLOW_MS * Math.log(gap / SETTLE_DISTANCE) : 0;
  if (elapsed >= settleAfter) {
    follower.distance = follower.target;
    follower.settledAt ??= follower.lastAt + settleAfter;
  } else follower.distance = follower.target - gap * Math.exp(-elapsed / FOLLOW_MS);
  follower.lastAt = now;
  return follower.distance;
}

export function followTo(follower, target, now) {
  // Settle the old target first, so resuming after a pause does not spend the
  // paused time instantly drawing a newly added section.
  advanceFollower(follower, now);
  if (Math.abs(target - follower.target) < .001) return;
  follower.target = target;
  follower.distance = Math.min(target, Math.max(follower.distance, target - follower.maxLag));
  follower.settledAt = null;
}

export function arrivalAt(follower, distance, now) {
  if (distance <= follower.distance) return now;
  const remaining = Math.max(SETTLE_DISTANCE, follower.target - distance);
  return now + FOLLOW_MS * Math.log((follower.target - follower.distance) / remaining);
}

export function schedulePath(path, startedAt, followPointer = false) {
  const speed = 260 * Math.sqrt(path.size); // logical pixels per second
  // Hand-drawn spines follow a short eased distance behind input. Like Schematic's stamps,
  // each offshoot gets its own clock when that junction is first encountered.
  if (followPointer && !path.branch && !path.spur)
    return { follower: path.follower, offset: path.followAt || 0, start: startedAt, speed, end: Infinity };
  const start = followPointer ? (path.bornAt ?? startedAt) : startedAt + (path.lane || 0) * 75 +
    (path.branch || path.spur ? (path.branchAt || 0) / speed * 1000 + 100 : (path.followAt || 0) / speed * 1000);
  return { start, speed, end: start + path.samples.at(-1).d / speed * 1000 + 300 };
}

export function revealedDistance(timing, now) {
  if (now === Infinity) return Infinity;
  if (timing.follower) {
    const follower = timing.follower;
    const distance = advanceFollower(follower, now);
    // Continue the detail fade after the line itself has caught up.
    return Math.max(0, distance - timing.offset + (follower.settledAt === null ? 0 : Math.max(0, now - follower.settledAt) * timing.speed / 1000));
  }
  return Math.max(0, (now - timing.start) * timing.speed / 1000);
}

export function timingComplete(timing, now) {
  if (!timing.follower) return now >= timing.end;
  advanceFollower(timing.follower, now);
  return timing.follower.settledAt !== null && now >= timing.follower.settledAt + 300;
}

export function prefix(samples, distance) {
  if (distance <= 0) return [];
  if (distance >= samples.at(-1).d) return samples;
  let low = 0, high = samples.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (samples[mid].d < distance) low = mid + 1;
    else high = mid;
  }
  return [...samples.slice(0, low), { ...pointAt(samples, distance), d: distance }];
}

export function detailOpacity(timing, distance, at) {
  return Math.max(0, Math.min(1, (distance - at) / (timing.speed * .18)));
}
