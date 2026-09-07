# Brush registration and interface

Each brush is an independent folder. Its `registry.js` describes how it appears
in the shared UI and how to load its implementation. The app has no special
cases for individual brushes.

## Add a brush

1. Create `brushes/<id>/registry.js`, `sketch.js` and a preview image.
2. Export the registration object shown below from `registry.js`.
3. Export a factory from `sketch.js` implementing the lifecycle below. Split
   helpers into more JS modules with ordinary imports as needed; the loader
   follows the module graph.
4. Import your registration in `shared/registry.js` and add it to the
   `createRegistry([...])` list. The picker, settings and URL lookup update
   from that list.
   Use a transparent preview of a single stroke. The selector composites it
   inside its own grid cell in the left column, with no rotation or visible label.
5. Run `npm test`, `npm run build`, and exercise the new brush in the browser.

```js
export default {
  id: "my-brush",
  name: "My Brush",
  category: "A short subtitle",
  description: "What makes this brush special.",
  hint: "How to draw with it.",
  preview: new URL("./preview.png", import.meta.url).href,
  controls: [
    {
      id: "size",
      label: "Brush size",
      type: "range",
      min: 0.4,
      max: 4,
      step: 0.05,
    },
  ],
  load: () => import("./sketch.js"),
};
```

IDs must be unique lower-case slugs. The registry validates metadata and the
studio checks the implementation's methods before activating it. Modules load
on demand; each brush factory is initialized once per studio. Rapid switching
uses the latest selection and cannot activate a stale module load.

## Lifecycle

`sketch.js` exports `createBrush(p)`, which returns these methods. `p` is the
studio's p5 instance. Keep all mutable brush state inside the factory.

| Method                  | Responsibility                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setup(params)`         | Allocate transparent `p.createGraphics(p.width, p.height)` layers and read optional URL presets. Called once.                                                 |
| `resize()`              | Match graphics layers to `p.pixelDensity()`, `p.width` and `p.height`, clear transient state and retain settings. The host has already committed the artwork. |
| `draw()`                | Advance animation and composite the brush's transparent layers onto `p`.                                                                                      |
| `pointerDown(x, y)`     | Begin a stroke in paper coordinates.                                                                                                                          |
| `pointerMove(x, y)`     | Update its target.                                                                                                                                            |
| `pointerUp()`           | End input; a follower or animation may continue.                                                                                                              |
| `finish()`              | Synchronously settle followers and bake **all** pending marks, including future auto-fill marks. Must be safe to repeat.                                      |
| `clear()`               | Remove marks and cancel strokes, queues and animations; retain settings.                                                                                      |
| `autoFill()`            | Generate a drawing with the brush's current settings.                                                                                                         |
| `randomize()`           | Choose new brush geometry for future marks. The host commits existing artwork first.                                                                          |
| `getSettings()`         | Return an object keyed by control IDs.                                                                                                                        |
| `setSetting(id, value)` | Validate and apply a control value.                                                                                                                           |

Do not call `p.createCanvas`, `p.resizeCanvas`, `p.background`, `p.saveCanvas`,
or install global p5 callbacks from a brush. Use `layer.resizeCanvas()` inside
`resize()` to adapt offscreen graphics to the new paper size. The host owns paper, coordinates,
input, cursor, eraser and export. Use `p` for main-canvas drawing and p5 math;
use the brush's graphics layers for persistent marks. Draw without a full-page
background so earlier artwork stays visible. White fills inside individual
motifs are allowed and retain the original brushes' ink-on-paper behavior.

## Controls

The shared UI supports:

- `range`: `min`, `max`, `step`; state is numeric. Renders as a simple line slider
  in the right column, supporting native pointer, touch and keyboard input.
- `palette`: `options: [[value, label, hex], ...]`; omit hex for the mixed-color swatch.
- `select`: `options: [[value, label], ...]`.
- `toggle`: boolean state, with an optional single-letter `key` shortcut.

All controls appear together in the right column, which becomes a drawer on small screens.
An optional `caption` overrides a slider's short visible label; `note` provides
explanatory text in its tooltip. Set `commit: true` on a control
that rebuilds a brush's layer (Balloon's cell size, for example). The host
commits existing marks before applying it, so previous artwork survives.
Such ranges apply on release rather than rebuilding on every pointer movement.
The IDs `size` and `density` use shared size/density shortcuts. Digits select
options from the first palette or select control, with `0` selecting its first
option.

## Composition and history

The studio composites a white paper background, the committed artwork, and the
active brush. Switching finishes the outgoing brush, commits its pixels, and
clears its temporary layers. Settings persist, while its next activation starts
fresh geometry over the common artwork. A new variation follows the same rule.

Undo/redo stores raster snapshots of the whole paper, settling animation first.
Restoring one clears the active brush's temporary state and uses the snapshot
as the new base. It restores artwork, not procedural geometry or settings.
Consequently, a restored Balloon pattern starts revealing afresh, and Score's
staff visibility only controls its current uncommitted ribbons. The eraser
works on committed pixels from every brush. Brush layers stay allocated for
reuse instead of creating more p5 instances or event handlers on each switch.

The host resizes the paper to match the chosen aspect ratio, keeping its long
edge at 1200 logical units. The main canvas and brush layers use the screen
density, up to 3×, while input and brush geometry stay in logical units. It commits active marks first, resizes the main p5 canvas,
then calls every initialized brush's `resize()`. Committed artwork retains its
source resolution and is centered with a uniform fit, so repeated window or
ratio changes do not progressively resample it. History snapshots retain their
own logical dimensions, physical pixels and pixel density, and fit the current paper when restored. Resizing changes the
paper shape, not the brush settings or the undo stack.
