import { canvasFont } from "../../shared/typography.js";
import { EYE, FLASH, FLOOR, FRIGHTENED, PAC, PUPIL, SCORE } from "./arcade.js";

const TAU = Math.PI * 2;

/** Pac-Man is a disc with a wedge taken out of it, and the wedge is the whole
 * character: it swings shut to nothing and back open on every stride, and it
 * points wherever he is going. */
export function drawPac(ctx, x, y, radius, dx, dy, open) {
  const facing = Math.atan2(dy, dx);
  const mouth = open * 0.29 * Math.PI;
  ctx.save();
  ctx.fillStyle = PAC;
  ctx.beginPath();
  if (mouth < 0.01) {
    ctx.arc(x, y, radius, 0, TAU);
  } else {
    ctx.moveTo(x, y);
    ctx.arc(x, y, radius, facing + mouth, facing - mouth + TAU);
    ctx.closePath();
  }
  ctx.fill();
  ctx.restore();
}

/** The dome, the two eyes and the flicking skirt. Frightened, the same body
 * turns blue and loses its eyes for a pair of dots and a wavy mouth, and
 * blinks white just before the ghosts come back. */
export function drawGhost(ctx, x, y, radius, dx, dy, options = {}) {
  const { color, frightened = false, flashing = false, frame = 0 } = options;
  const half = radius * 0.92;
  const top = y - radius;
  const bottom = y + radius * 0.88;
  const shoulder = top + half;
  ctx.save();
  ctx.fillStyle = frightened ? (flashing ? FLASH : FRIGHTENED) : color;
  ctx.beginPath();
  ctx.moveTo(x - half, bottom);
  ctx.lineTo(x - half, shoulder);
  ctx.arc(x, shoulder, half, Math.PI, 0);
  ctx.lineTo(x + half, bottom);
  // The skirt: a zigzag hem that swaps phase between the two frames, which is
  // the only animation the arcade gives a ghost.
  const teeth = 8;
  const lift = radius * 0.34;
  for (let i = 1; i <= teeth; i++) {
    const px = x + half - (i / teeth) * half * 2;
    ctx.lineTo(px, bottom - ((i + frame) % 2 ? lift : 0));
  }
  ctx.closePath();
  ctx.fill();

  if (frightened) {
    ctx.fillStyle = flashing ? "#ff0000" : EYE;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(x + side * radius * 0.34, y - radius * 0.22, radius * 0.15, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = flashing ? "#ff0000" : EYE;
    ctx.lineWidth = radius * 0.13;
    ctx.lineJoin = "miter";
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const px = x - half * 0.72 + (i / 6) * half * 1.44;
      const py = y + radius * 0.34 - (i % 2 ? radius * 0.16 : 0);
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }
  // Eyes lead the way, so a ghost reads as chasing rather than drifting.
  const look = radius * 0.15;
  for (const side of [-1, 1]) {
    const ex = x + side * radius * 0.36 + dx * look * 0.5;
    const ey = y - radius * 0.2 + dy * look * 0.5;
    ctx.fillStyle = EYE;
    ctx.beginPath();
    ctx.ellipse(ex, ey, radius * 0.28, radius * 0.34, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PUPIL;
    ctx.beginPath();
    ctx.arc(ex + dx * look, ey + dy * look, radius * 0.16, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** Bonus fruit, drawn plainly enough to be read at one tile across. */
export function drawFruit(ctx, kind, x, y, radius) {
  ctx.save();
  const stem = (fromX, fromY, toX, toY) => {
    ctx.strokeStyle = "#00a000";
    ctx.lineWidth = radius * 0.14;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.quadraticCurveTo((fromX + toX) / 2 + radius * 0.2, fromY - radius * 0.5, toX, toY);
    ctx.stroke();
  };
  const berry = (bx, by, br, fill) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, TAU);
    ctx.fill();
  };
  if (kind === "cherry") {
    stem(x - radius * 0.42, y + radius * 0.2, x + radius * 0.3, y - radius * 0.8);
    stem(x + radius * 0.42, y + radius * 0.3, x + radius * 0.3, y - radius * 0.8);
    berry(x - radius * 0.42, y + radius * 0.32, radius * 0.42, "#ff0000");
    berry(x + radius * 0.42, y + radius * 0.42, radius * 0.42, "#ff0000");
  } else if (kind === "strawberry") {
    ctx.fillStyle = "#ff0000";
    ctx.beginPath();
    ctx.moveTo(x, y + radius * 0.9);
    ctx.quadraticCurveTo(x - radius * 0.8, y + radius * 0.1, x - radius * 0.6, y - radius * 0.4);
    ctx.lineTo(x + radius * 0.6, y - radius * 0.4);
    ctx.quadraticCurveTo(x + radius * 0.8, y + radius * 0.1, x, y + radius * 0.9);
    ctx.fill();
    ctx.fillStyle = "#00a000";
    ctx.fillRect(x - radius * 0.66, y - radius * 0.66, radius * 1.32, radius * 0.3);
    ctx.fillStyle = EYE;
    for (const [ox, oy] of [[-0.3, 0.1], [0.3, 0.1], [0, 0.45]]) {
      ctx.beginPath();
      ctx.arc(x + ox * radius, y + oy * radius, radius * 0.08, 0, TAU);
      ctx.fill();
    }
  } else if (kind === "orange" || kind === "apple") {
    berry(x, y + radius * 0.15, radius * 0.72, kind === "orange" ? "#ffa000" : "#ff0000");
    stem(x, y - radius * 0.5, x + radius * 0.1, y - radius * 0.9);
    ctx.fillStyle = "#00a000";
    ctx.beginPath();
    ctx.ellipse(x + radius * 0.4, y - radius * 0.62, radius * 0.3, radius * 0.15, -0.5, 0, TAU);
    ctx.fill();
  } else {
    berry(x, y + radius * 0.1, radius * 0.75, "#2bb14a");
    ctx.strokeStyle = "#0a6b26";
    ctx.lineWidth = radius * 0.1;
    for (const offset of [-0.4, 0, 0.4]) {
      ctx.beginPath();
      ctx.moveTo(x + offset * radius, y - radius * 0.5);
      ctx.lineTo(x + offset * radius * 1.3, y + radius * 0.75);
      ctx.stroke();
    }
    stem(x, y - radius * 0.6, x + radius * 0.15, y - radius * 0.95);
  }
  ctx.restore();
}

/** The score left where something was eaten. In the cabinet the number takes
 * the place of what it scored, so it is cut out of the floor first — without
 * that a cyan number over Inky is a cyan number over cyan. */
export function drawScore(ctx, value, x, y, tile) {
  ctx.save();
  ctx.font = canvasFont(tile * 0.62, 700);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = tile * 0.2;
  ctx.strokeStyle = FLOOR;
  ctx.strokeText(String(value), x, y);
  ctx.fillStyle = SCORE;
  ctx.fillText(String(value), x, y);
  ctx.restore();
}
