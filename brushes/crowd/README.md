# Crowd

Royal-blue (`#4169E1`) figures traced directly from the supplied architectural
section drawing. Eleven people motifs include a juggler, a waving figure, a
seated conversation, people lounging on steps, and someone pushing a stroller.
Seven optional scene details add a dog, a cat, three birds, a cafe table with
chairs, and a reader at a table. Each gathering varies their scale and facing
direction while preserving the traced proportions.

The vector paths follow both edges of the original source ink, preserving its
irregular contours and line weight. Their interiors stay transparent so the
drawing underneath remains visible. Each motif records its crop coordinates in the
1200 × 849 reference image in `figures.js`.

Drag to place gatherings along a path, or click for one small group. The path
follows their feet; people stay upright even on a curved or vertical stroke.
Placement follows distance traveled, so drawing slowly or pausing does not pile
up extra people. Outlines trace out from their feet over about 0.8 seconds,
growing around both sides of each contour while the feet stay fixed. Higher
details follow later. Each group starts growing as soon as you draw it, with
just 25 milliseconds between people. Waiting figures catch up when the pen
reaches a new group, keeping entrances in stroke order without a growing delay.
The original silhouettes keep their proportions and texture. Growth continues
after releasing the pen; even a dense batch starts within 120 milliseconds.

After each person finishes drawing in, they gently sway and breathe on their
own rhythm. Movement varies between standing, walking and seated poses, and
the feet stay planted. The seated trio moves individually; the reader moves
above a stationary table. Earlier people keep moving as you add more strokes.

| Control | Effect |
| --- | --- |
| Figure size | Scales people and their line weight together; default 1× |
| Crowd density | Changes group size and distance between gatherings |
| Spread | Scatters feet in depth; zero keeps them on the stroke |
| Objects | Frequency of animals and table scenes; zero draws people only |
| Outline color | Royal blue (default), vermilion, graphite or sage |
| People | Everyday mix, standing & talking, on the move, or sitting & lounging |
| Animate people | Toggles the ongoing movement after figures finish drawing in |

**Auto-fill** grows loose rows of gatherings across the paper. Export, switching
brushes and history finish every pending figure, including scheduled auto-fill
groups. **New variation**
reshuffles future figures while keeping existing marks. Settings, undo, redo,
eraser, aspect ratios and PNG export use the shared studio interface.
Editing tools and export settle the current people into their original still
poses. Drawing again resumes movement in the current Crowd layer. Switching
brushes, resizing, undo and redo commit still artwork, as with the other brushes.

Open `?brush=crowd`, or add `&auto` for a populated page. Optional presets are
`&color=blue|red|graphite|green`, `&pose=mixed|standing|walking|seated`,
`&size=0.4` to `3`, `&density=0.35` to `2.5`, `&spread=0` to `2`,
`&details=0` to `2`, and `&motion=false` for still people after the entrance.

`figures.js` holds the original vector contours, `tracing.js` follows their
outlines, `animation.js` schedules growth and the idle motion, `sketch.js` handles
placement and the brush lifecycle, and `registry.js` supplies the controls
and preview.
