import { CHOMP, FLASH_TILES, POWER_TILES, SKIRT, SPEED } from "./arcade.js";

/**
 * How far along its corridor a chase has got.
 *
 * Pac-Man runs at the cabinet's pace, not the pen's, and he runs a set
 * distance and stops. That is what leaves a corridor half cleared, with
 * pellets still waiting ahead of him and the ghosts strung out behind — the
 * shape every screenshot of this game has. It also means the run is a
 * bounded, finite animation, so settling it early lands on exactly the same
 * frame as letting it play out.
 */
export function chaseReach(run) {
  return Math.min(run.chase, run.track.length);
}

export function chaseDistance(run, now) {
  const travelled = ((now - run.start) / 1000) * SPEED * run.tile;
  return Math.min(chaseReach(run), Math.max(0, travelled));
}

/** Everything Pac-Man has passed over is gone. The last power pellet he took
 * is what sets the ghosts running scared, and fruit leaves its score behind
 * where it was taken. */
export function eatTo(run, distance) {
  for (const pellet of run.pellets) {
    if (pellet.eaten || pellet.d > distance) continue;
    pellet.eaten = true;
    if (pellet.power) run.power = pellet.d;
  }
  const fruit = run.fruit;
  if (fruit && !fruit.eaten && fruit.d <= distance) {
    fruit.eaten = true;
    run.scores.push({ x: fruit.x, y: fruit.y, value: fruit.value });
  }
}

/** The mouth is driven by distance rather than by the clock, so a settled
 * stroke keeps the mouth it had when it stopped. */
export function chomp(distance, tile) {
  const phase = (distance / (CHOMP * tile)) % 1;
  return phase < 0.5 ? phase * 2 : 2 - phase * 2;
}

export function fright(run, distance) {
  if (run.power === null) return { frightened: false, flashing: false };
  const since = distance - run.power;
  const window = POWER_TILES * run.tile;
  const frightened = since >= 0 && since < window;
  const left = window - since;
  return {
    frightened,
    flashing:
      frightened &&
      left < FLASH_TILES * run.tile &&
      Math.floor(left / (run.tile * 0.9)) % 2 === 0,
  };
}

export function skirtFrame(distance, tile) {
  return Math.abs(Math.floor(distance / (SKIRT * tile))) % 2;
}
