# Gunpla

Build a model-kit sprue one component at a time. A click adds a single numbered
part in its runner bay. Compartments grow to fit each component: tiny sockets
use one grid cell, armor spans several, and long barrels occupy wide bays. Drag
to add adjoining bays; turns make a connected, rectangular staircase. Draw alongside an existing row to expand the same tab.
Retracing a filled bay leaves its component unchanged.

The first component pops into existence at the starting point. New components
burst out of the nearest older part with a sharp launch, nearly 3× directional
stretch, shearing and alternating twist. They swell to 150% size in 72 ms,
overshoot their bays, then squash across the launch direction and snap back to
their undistorted shape in 240 ms. A 10 ms ripple is capped at 50 ms for responsive
fast strokes and auto-fill. Releasing the pointer lets the burst finish naturally.

The 37 molds include armor shells, sole plates, V-fins, collars,
backpacks, open limb frames, yokes, hinges, polycaps, cross joints, tanks,
thrusters, pistons, rifles, cannons, bazookas, barrels, blades, scopes and
bipods. A shuffled mold selection keeps the types varied. Native proportions
and randomized mold scales retain the difference between small connectors
and large weapons. Every reserved bay contains exactly one component.

Fourteen shell, frame and weapon molds use contours traced from the supplied
parts-list scan. Their recessed details are recovered from the scan after
removing its printing screen. The remaining molds use the vector library.

The default material is white injection-molded plastic, with smooth faces,
rounded rims, shaded sockets, shallow engraved panels and a restrained contact
shadow. Cylindrical runner bars carry a narrow highlight. Surface grain is
subtle and irregular, without a repeating halftone pattern. Dark circled
numbers, lettered polycap callouts, unused-part crosses and Japanese material
headings retain the assembly-manual annotation style. Empty space and open
sockets remain transparent over other brushes.

- **Size** scales components, rails and labels together.
- **Density** adjusts spacing around components in the runner grid.
- **Size variation** varies individual mold scales; native type sizes remain distinct even at zero.
- **Surface grain** controls fine molded-plastic grain; zero retains smooth lighting and bevels. Default: 0.35.
- **Details** controls recessed molding detail and engraved lines.
- **Plastic color** selects white plastic (default), neutral gray, blue, red or olive.
- **Components** selects a complete kit, armor, mechanical parts or weapons.
- **Part numbers** toggles callouts, unused-part crosses, molded IDs and Japanese material headings.

Settings changes start a fresh grid for future marks, retaining existing art.
New variation starts a new random sequence and grid. Auto-fill assembles
rectangular groups from individual bays, like a manual's parts catalog.

Input visits every grid cell crossed by a stroke, even during fast swipes.
The grid persists across strokes until settings change, clear, brush switching,
history restoration or resizing. Finish settles all bursts synchronously for
history, export and brush switching, and is safe to repeat. Clear and resize
cancel pending bursts without leaving ghost components.

Open `?brush=gunpla` or add `&auto` for a full page. Presets:
`size=0.4`–`2.5`, `density=0.4`–`1.8`, `variation=0`–`2`,
`details=0`–`2`, `texture=0`–`2`,
`color=white|graphite|blue|red|olive`, `parts=mixed|armor|mechanical|weapons`,
and `labels=true|false`.

`components.js` holds the mold library and imports the traced contours and
surface relief from `reference-parts.js`. `material.js` caches shaded plastic
sprites at 4× native resolution. `layout.js` reserves adjoining bays without
overlap; `burst.js` handles emergence origins and motion;
`plates.js` renders parts, rails and annotations; `sketch.js` owns
settings, grid traversal and the transparent p5 layer.
