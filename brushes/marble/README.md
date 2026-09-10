# Marbling

Ink floated on thickened water and pushed around. Nothing here is a texture or
a filter: the pattern is the ink, and the ink is moved.

## Why it nests

A drop of ink landing on a full tray does not sit on top of what is there. It
pushes it aside, and every boundary already floating is displaced outward
around the new drop. That one rule is the whole technique, and it has a closed
form — a point at distance *r* from a drop of radius *R* moves out to
`sqrt(r² + R²)`, exactly conserving area. So pigment boundaries are carried as
polygons and mapped, rather than pixels being blurred.

Pour a line of drops with each landing inside the last and they nest into
concentric bands. Drag the pen and the same bands are drawn out into feathered
points. Turn it and they fold into whorls and cells. All four classical
gestures are closed-form maps over those boundaries — a drop, a tine dragged
through, a vortex, and a travelling ripple — which is why the result holds
together at any scale and never repeats.

The rest is bookkeeping. Boundaries are refined where a map has stretched them
and thinned where points have bunched up, so a band that has been drawn out
twenty times still has a smooth edge without carrying twenty times the points.
Drops bloom as they land, wet and slightly blurred, before settling. Older,
settled shapes are baked into a raster once the tray exceeds its point budget,
which keeps a page of veining at sixty frames while the ink you are still
moving stays vector.

## Drawing with it

Drag slowly to pour bands of ink and quickly to feather them out. Click the
same spot twice for nested rings. A stroke pours drops slightly wide of the
path rather than dead along it, because ink poured on a line combs into an
even chevron; letting each drop fall a little wide gives the pour body, and a
band's width then depends on where its neighbours happened to land. Drop sizes
vary, and the occasional heavy one floods a broad field for the finer drops to
vein.

- **Drop size** scales each drop, and with it the width of the bands it nests around itself.
- **Pour density** sets how closely drops follow one another. Dense pours nest into finer veins.
- **Rake** sets how far ink travels with the pen. Zero leaves plain nested drops.
- **Swirl** sets how much a turn folds veins back into whorls and cells.
- **Metallic leaf** sets how often a band pours as leafing, with streaked highlights and flecks.
- **Pour palette** picks indigo, opal and gold, ember and aqua, or sea mist — or mixes them per stroke.
- **Fine veins** toggles the pale line size leaves where two pigments meet. Shortcut **V**.

Auto-fill marbles a whole tray. A marbler floods the size with a ground coat
before throwing any pattern, because ink thrown onto bare size only covers the
fraction of the tray it landed on, so the paper is grounded and a few broad
fields laid over it. Then it is *poured* — along sweeping paths, with the same
alternation of dropping ink and raking it that a stroke performs, because that
is the only thing that nests bands deeply enough to read as marbling. The pour
is scaled up as a whole, drops and spacing together, so a page's worth fits
the tray's budget while keeping the proportions that make it look poured at
all. A final rake, comb or whorl gives the page one coherent flow.

Every drop's geometry is final the moment it is poured; only the order it
becomes visible is staggered. Settling early for history, export or a brush
switch therefore loses nothing.

The palettes are sampled from four reference pours, by hue histogram rather
than by clustering — averaging neighbouring colours is exactly what destroys
the vivid accents these pours are chosen for.

Open `?brush=marble` or add `&auto` for a full tray. Presets: `size=0.4`–`3`,
`density=0.4`–`2.2`, `rake=0`–`2`, `swirl=0`–`2`, `shimmer=0`–`2`,
`color=auto|indigo|opal|ember|mist`, and `veins=true|false`.

`palette.js` holds the sampled pours and the ink order. `fluid.js` is the four
maps and the boundary refinement; `render.js` paints pigment, veins, leafing
and the wet bloom; `sketch.js` owns settings, the tray and the pour lifecycle.
