# Score Brush

A p5.js brush that lays down a ribbon of five staff lines along each stroke
and paints randomized graphic-score snippets onto it. Dots melt into tapered
rods, rods swell into dots, thick bars thin out into hairlines, and arches,
hooks, fans, parentheses and spirals start from a dot and taper to a small
drop, all in a black / red / blue / green / yellow palette.

Every snippet is animated as it is drawn: it spreads outward from the point
where the brush stamped it, lines advancing with a liquid drop at their tip
and dots swelling up as the drop arrives. The staff ribbon follows a smoothed
version of the mouse path, so jittery drags still produce clean curves, and
it behaves like a physical strip: a fast turn rolls it over so the five lines
pinch together and cross, then it settles flat again once the turn is over.

## Run and controls

Run `npm install` and `npm run dev` from the repository root, then choose
Score in the brush library or open `/?brush=score`.
The shared app provides mouse, pen and touch input, brush controls, an eraser,
undo/redo, auto-fill and PNG export. See [the app guide](../../README.md) for
shortcuts and URL presets, and [the brush interface](../README.md) for the
module lifecycle.

Choose mixed colors or lock black, red, blue, green or yellow. **Glob size**
scales the musical marks; **Staff size** independently scales the five lines'
spacing and thickness from 0.25× to 4× (default 1×). Marks stay anchored to
the staff without changing their dot diameters. These sliders and density
live in the right column; staff visibility appears below them. Staff visibility affects
the current brush layer; artwork committed by switching brushes stays intact.
**New variation** picks a new staff spacing and preserves the existing drawing.

## Tweaking

Everything in `sketch.js` is built from `u`, the base unit. `bs` scales the globs,
while `staffSize` scales the line spacing and weight. The
`SNIPPETS` table sets how often each snippet type is chosen, and
`COLOR_WEIGHTS` sets the colour mix.

Snippets are described in the local frame of the stroke (x along it, y
across it), with staff line k at `ly(L, k)`. The `snip*` functions record
primitives (`dot`, `path`, blob) rather than drawing directly; `schedule`
then gives each primitive a start time from its distance to the stamp point
and `renderSnippet` draws them at the current progress. `GROW_SPEED` and
`DOT_MS` set the pace of the animation. `meltProfile` / `rod` build the
teardrop taper from a dot into a line, and `drawGrowingPath` adds the
travelling drop at the tip of a path while it is still growing.

Path smoothing lives in `advanceStroke`: two chained follower points each
close a small fraction of their remaining distance per substep (`SMOOTH_A`,
`SMOOTH_B`), and the ribbon heading is blended separately (`SMOOTH_HEADING`).
On fast drags the ribbon trails the cursor dot by a few dozen pixels. Raise
the constants for a snappier, less filtered line. New motifs can be added by writing a `snip*` function
and registering it in `SNIPPETS` and the `switch` in `stamp()`.

The twist is driven by the turn rate of the smoothed heading. `TWIST_THRESHOLD`
is the rate (radians per pixel of travel) above which the ribbon starts to
roll, `TWIST_GAIN` scales how much roll a turn adds, and `TWIST_RELAX` sets
how quickly it settles back to flat. Snippets are not stamped while the
ribbon is mid-twist, since its lines are bunched together there.
