# Subway Brush

Draw an imaginary subway network inspired by the supplied New York maps and
Schematic's irregular offshoots: fine colored strands, rounded 45° and 90°
bends, tiny station dots, service letters and compact Gorton Digital station names.
The main strands follow your pen with a slight eased delay. At each turn, half
the services end and replacement colors start as separate lines, marked with
small open circles. The other services stay continuous through the bend.
Branches grow away from that spine, either
rejoining it or wandering out to colored terminal badges. Interchange stops have
white centers. Diagonal route letters turn with the line; station names stay upright.
Accessibility pictograms, transfer badges, express diamonds, direction arrows,
rail/bus/ferry/airport symbols and small service notes fill out the map.
The names and service letters are decorative, not a navigable transit map.

Choose **Subway** in the brush library or open `/?brush=subway`.
Drag to grow the main strands just behind your pen; a click makes a short station strip.
New junctions launch their own branch animations while you draw, like Schematic's
offshoots. Branches keep growing after you release the pointer, with station
markers, names and symbols appearing behind their drawing tips. Each new
stroke in **Subway mix** cycles to a different starting combination of services.
Single-color swatches choose the starting family. Turns introduce new colors
in either mode, replacing half the lines (rounding up for odd route counts).

- **Size** scales bands, corner radii, dots, route letters and station names.
- **Density** changes station spacing.
- **Map details** changes how many transit symbols, service badges and notes
  appear beside the station names. Zero leaves simple station names and dots.
- **Divergence** controls detour reach and branch frequency; zero keeps all
  strands parallel. The default is 1×, with a range up to 2×.
- **Parallel routes** selects one to four lines (four by default).
- **Station labels** controls names, route letters and annotation groups on future strokes.
- **Auto-fill** grows a random network from scattered nodes and shared junctions
  with the current settings. Each fill gets a different topology.
  Routes start in a staggered sequence, with branches beginning only after
  their parent service reaches the junction.
- **New variation** changes the next service bundle, names and auto-fill layout.

Presets: `?brush=subway&color=blue&routes=3`, or
`?brush=subway&auto&details=2&divergence=1.5`. Colors are `auto`, `blue`, `red`, `yellow`,
`orange`, `green` and `purple`.

Input is filtered onto eight compass directions. A per-stroke seed creates
independent detours and connected terminal branches without re-rolling them
on every frame. A short eased follower keeps the main lines close to input and
catches up when the pen pauses. Replacement services have separate paths and
a small gap from their predecessors, growing only once the follower reaches
their origins. Existing lines retain their colors. Each branch keeps the
geometry, color and start time it received when its
junction was first encountered; pausing or extending a stroke does not reset
existing branches or instantly finish new ones. A transparent live layer
reveals the branches by arc length at a steady pen speed. Offshoots inherit
the service color at their junction.
Labels and symbols are laid out once per geometry change, so they stay in place
throughout their fade-in. Labels try both sides of a route and
avoid other names, bands and paper edges. New crossings reconsider earlier
labels within the active brush. A fine white outline around each strand keeps
crossings legible over other artwork; the spaces between branches are transparent.

The shared studio owns undo/redo, brush switching, erasing, paper size and PNG
export. These actions finish all pending lines and details immediately, including
auto-fill routes whose scheduled start is still in the future. Clear cancels
pending animation. Settings and existing artwork survive switching. See the
[app guide](../../README.md) and [brush interface](../README.md).
