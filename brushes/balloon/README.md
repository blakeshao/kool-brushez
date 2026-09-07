# Balloon Brush

A p5.js brush that hides a poster under the page: an upright rectangle
tiled edge to edge with rounded blobs that fit each other perfectly (pipes
with right-angle bends, blocks, the odd circle), each with a crisp coloured
rim and a soft airbrushed glow fading into the paper, and no two touching
blobs in the same colour. Red, blue, green, yellow and pink on white, in
the manner of a screen-printed poster. The print is imperfect: each layer
of a blob's glow sits a hair off centre, the rim is a soft band that fades
out past the edge rather than a hard line, the body carries an uneven
wash, and ink specks are scattered inside the blob and just outside it.

Draw a pencil line. When you let go, the blobs the line passed through
burst out of it one after another, a beat apart, in the order the line
reached them. Each bursts in two beats: first, in a fraction of a second,
the whole blob appears fat and saturated, blurred, its glow spilling past
the edges; then it bleeds slowly while the blur and the spill fade and the
crisp poster shape dries in underneath. The pencil line is gone the moment
you let go; only the blobs remain. Only what your lines touched
appears, so the poster stays incomplete until your strokes have covered it.
Blobs that are already showing are left alone.

The poster is dealt at random: blocks of up to 4 x 4 cells, pipes that walk
in straight legs with right-angle turns, and single cells, most of which
join a neighbour. Corners, including inner corners, are rounded with
circular arcs, so one-cell-wide pipes get semicircular ends. The drawing cursor is the shared black dot; the common eraser shows its radius.

## Run and controls

Run `npm install` and `npm run dev` from the repository root, then choose
Balloon in the brush library or open `/?brush=balloon`.
The shared app provides mouse, pen and touch input, brush controls, an eraser,
undo/redo, auto-fill and PNG export. See [the app guide](../../README.md) for
shortcuts and URL presets, and [the brush interface](../README.md) for the
module lifecycle.

The palette can use the poster's own colors or force red, blue, green, yellow
or pink. Cell size and **New variation** generate a new pattern while preserving
previous marks. The common eraser removes pixels from any brush. The original
reveal, burst and drying animations are retained.

## Tweaking

`PALETTE`, `PAPER` and `INK` set the colours. `CELL` is the grid cell at
size 1; blobs are built from cells and their glow, corner radius and rim are
`BAND`, `CORNER` and `EDGE`. `SHAPES` weights which blob kinds `deal` tries,
and the block sizes and pipe leg counts are the `pick` calls inside it; the
`0.3` in the stray-cell pass is the share of single cells left as dots. The
glow's colour ramp is the `0.3 + 0.7 * (1 - (1 - u)^1.8)` line in `deal`.
`BURST`, `DRY`, `BLUR`, `WET` and `STAGGER` shape the reveal: how fast the
burst is, how long the bleed takes to dry, how blurred the wet ink is at
the burst, how much wider the glow is while wet, and the beat between one
blob's burst and the next along the line. `JITTER`, `RIM`, `SPECKS`, `SPECK_REACH` and `WASH`
set the imperfections: the glow stack's offset, the widths and opacities of
the soft rim band, the specks per cell of area and how far past the edge
they scatter, and the wash patches per cell.

`outline` traces the boundary loops of a blob's cells, `roundedPath` turns
them into a Path2D with rounded corners, and `paintBlob` paints one by
clipping to that path, filling with paper and stroking the outline with a
stack of widening, lightening strokes so the glow stays inside the shape,
then adds the unclipped soft rim and specks.
`soakBlob` crossfades a blurred unclipped image of the blob into a cached
crisp one, both from offscreen canvases. The blur uses the canvas filter
and is skipped where the browser lacks it.
`addLine` schedules the pops for a line, while the shared studio handles erasing and history.
