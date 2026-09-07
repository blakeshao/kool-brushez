# kool-brushez

A small p5.js drawing app with six expressive brushes and one shared canvas.
Switch brushes without reloading or losing your drawing. Each brush keeps its
own JavaScript, settings, preview and registry entry.

The interface is a flat white grid. Each brush has its own cell in the left
column, the canvas fills the entire middle section, and the selected brush's
controls live in the right column. Blue (`#4C74EE`) borders and buttons define
the left side; green (`#00b807`) borders, text and buttons define the right.
Square controls and joined corner buttons define the grid. Brush cells have a fixed height, with blank
cells filling the space below. Every preview stays at full opacity and a fixed
size. A 1.5px border marks hover or keyboard focus; the selected cell uses 2px.
Stroke previews are rendered at 4× resolution. The empty canvas has no text.

## Run

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. `npm run build` creates a static site in
`dist/`; `npm run preview` serves that production build locally. p5.js is
installed locally, so the drawing engine doesn't depend on a CDN. The interface
uses locally bundled DM Sans (variable weight) and plain CSS, with
uppercase titles in regular weight and sideways vertical panel labels.
Brush annotations use the same font; Japanese characters and
other unsupported glyphs use system fallbacks. See the [font notice](assets/fonts/dm-sans/NOTICE.md)
for attribution and the SIL Open Font License.

## Brushes

| Brush                                    | What it draws                                                         |
| ---------------------------------------- | --------------------------------------------------------------------- |
| [Score](brushes/score/README.md)         | Flowing staff ribbons and animated graphic-score marks in five colors |
| [Schematic](brushes/schematic/README.md) | Wet-ink patch diagrams, CAD details and tiny numeric annotations      |
| [Balloon](brushes/balloon/README.md)     | A hidden patchwork of airbrushed shapes, revealed along each stroke   |
| [Subway](brushes/subway/README.md)       | Animated branching subway lines, station names and transit symbols |
| [Crowd](brushes/crowd/README.md)         | Royal-blue people tracing out from their feet, then swaying and breathing independently |
| [Gunpla](brushes/gunpla/README.md)       | Grow a connected model-kit sprue one numbered component at a time |

Click a sample stroke in the left column to switch brushes. Drag the sliders
in the right column to change size and density. Score starts at 0.75× glob size
and has a separate **Staff size** slider for line spacing and thickness (default 1×);
Schematic starts at 0.4×, Balloon at 0.5×, Subway at 1× with four parallel routes,
Crowd at 1× with royal-blue outlines, mixed poses and occasional scene objects,
and Gunpla at 1× with white plastic sprues and a complete mix of components. Arrow keys make small
adjustments. Colors and other brush-specific options appear below the sliders.
The **Brush options** toggle stays on the far-right edge. Its arrow points right
to collapse the panel and left to expand it; **H** also toggles the panel and
**Escape** collapses it. A matching **Brushes** toggle sits on the far-left
edge and collapses the brush column the same way, with **L** as its shortcut.
On small screens both open as drawers — brushes from the left, controls from
the right; tapping the canvas outside dismisses them without drawing, as does
**Escape**, and choosing a brush closes them. Desktop
collapse preferences survive switching between screen sizes. Brush settings survive switching. **Auto-fill** lets the
current brush draw for you; **New variation** keeps your artwork and starts a
new staff spacing, drafting grid, balloon pattern, subway service bundle, crowd grouping or sprue layout.

Joined square buttons occupy the canvas corners: brush and eraser at top left;
undo, redo, clear and PNG export at top right; aspect ratio at bottom left; and help
at bottom right. Clear is undoable.

The canvas automatically fits the middle section, with the entire paper visible.
The bottom-left aspect selector offers **Fit** (match the section), **1:1**,
**4:3**, **3:4**, **16:9** and **9:16**. Fixed ratios stay centered within the
available space. The paper uses a 1200-unit long edge, with rendering density matched to the
screen and fitted size (up to 3×). For example, 16:9 exports at 1200 × 675 on a
standard display and 2400 × 1350 on a typical Retina display. There are no zoom controls or canvas scrolling.

Changing the ratio or resizing the window fits existing artwork uniformly
inside the new paper, without cropping or stretching. The original pixels are
retained between resizes until another edit is committed. Brush settings and
undo/redo survive; each brush refreshes its temporary layers for the new size.
Mouse, pen and touch input use the same interface. The shared eraser removes
marks made by any brush, including earlier brushes.

Undo and redo retain up to 16 editing steps, including strokes, auto-fill and
clear. PNG export finishes pending animations and saves the full-resolution
paper without the UI or cursor as `Untitled study.png`.
Drawings live in the current tab's memory: export before closing or reloading.

### Shortcuts

| Key                                     | Action                                         |
| --------------------------------------- | ---------------------------------------------- |
| `B` / `E`                               | Brush / toggle eraser                          |
| `⌘` or `Ctrl` + `Z`                     | Undo                                           |
| `⌘` or `Ctrl` + `Shift Z` (or `Ctrl Y`) | Redo                                           |
| `[` / `]`                               | Decrease / increase brush size                 |
| `-` / `+`                               | Decrease / increase density, where supported   |
| `1`–`5` / `0`                           | Color or style / mixed palette or random style |
| `Space`                                 | Auto-fill                                      |
| `R`                                     | New variation, keeping existing marks          |
| `G` / `M`                               | Score staff lines / Schematic mirroring        |
| `C`                                     | Clear canvas (undoable)                        |
| `S` or `⌘` / `Ctrl S`                   | Export PNG                                     |
| `L` / `H`                               | Toggle brushes / brush options                 |
| `?`                                     | Show shortcuts                                 |

Shortcuts leave text fields, selectors and the help dialog alone. Space on a
focused button keeps the button's normal keyboard behavior.

### Direct links

`?brush=score`, `?brush=schematic`, `?brush=balloon`, `?brush=subway`,
`?brush=crowd`, and `?brush=gunpla` select a brush on load.
Add `&auto` for an automatically painted page. Existing presets still work:
`&style=patch|cad|mixed` and `&mirror` for Schematic, or
`&color=red|blue|green|yellow|pink` for Balloon. Subway supports
`&color=blue|red|yellow|orange|green|purple`, `&routes=1|2|3|4`, `&labels=false`, and
`&divergence=0` to `2` for parallel lines through tangled, branching networks.
`&details=0` to `2` controls Subway's transit symbols and connection notes.
Crowd supports `&color=red|graphite|blue|green`,
`&pose=mixed|standing|walking|seated`, `&size=0.4` to `3`,
`&density=0.35` to `2.5`, `&spread=0` to `2`, and `&details=0` to `2`
for the frequency of animals and table scenes.
Gunpla supports `&parts=mixed|armor|mechanical|weapons`,
`&color=white|graphite|blue|red|olive`, `&labels=false`,
`&size=0.4` to `2.5`, `&density=0.4` to `1.8`, `&variation=0` to `2`,
`&texture=0` to `2`, and `&details=0` to `2`. Its 37 molds retain their native
size differences, with molded white plastic shading, subtle surface grain and
Japanese material annotations. Fourteen molds are traced from the reference scan.

## Layout

```text
index.html                  shared drawing UI
shared/
  loader.js                 brush picker, settings, shortcuts and viewport
  studio.js                 one p5 instance; canvas, input, history and export
  hud.js                    controls generated from brush registrations
  registry.js               collection of independent brush registrations
  history.js                bounded undo/redo snapshots
  styles.css                flat white grid and responsive layout
brushes/<name>/
  registry.js               name, controls, preview and lazy module loader
  sketch.js                 isolated drawing algorithms and lifecycle
  preview.png               a single stroke rendered by the brush
  README.md                 brush-specific notes
```

The original brush geometry and animation remain in each `sketch.js`. They now
run in p5 instance mode, with no shared sketch globals, DOM controls or canvas
ownership. Vite supplies development serving and production bundling; the app
uses plain JavaScript and CSS.

See [the brush interface](brushes/README.md) to add a brush or split one into
additional JavaScript files.

## Check

```sh
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

If Google Chrome is already installed, `BROWSER_CHANNEL=chrome npm run
test:browser` uses it instead. Browser tests start their own server on port
4178 and cover compositing across brushes, undo/redo, erasing, resize, PNG
export, touch, control persistence, keyboard isolation, auto-fill, rapid
switching, slider dragging/keyboard adjustment, aspect ratios, Retina compositing and export dimensions. Unit tests cover registration, factory isolation and history limits.
