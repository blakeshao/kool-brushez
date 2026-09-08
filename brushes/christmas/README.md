# Christmas Branch

Ported from an old Flash/ActionScript prototype (included in the commit that
adds this brush) whose `onEnterFrame` handler projected a point a little ahead
of the mouse along its direction of travel and stamped six needles there every
frame, each with a faint dark drop shadow beneath a randomized green line.

Dragging grows a fluffy pine bough along the path; a follower closes on the
pointer each frame so the branch keeps growing smoothly even through a pause.
Needles splay within about ±31° of the heading, in a randomized mix of greens
by default. Occasional strokes hang a small bauble (red, gold, blue or
silver) off the branch, standing in for the original's separate "add
ornament" tool.

| Control | Effect |
| --- | --- |
| Needle size | Scales needle length and weight; default 1× |
| Needle density | Needles per stamp and stamps per unit of drag |
| Needle color | Mixed greens (default), pine, spruce or frost |
| Hang ornaments | Toggles the occasional bauble along the branch |
