# Pac-Man

Every stroke is a corridor of the maze, and a chase down it.

Nothing in Pac-Man moves diagonally, and that single constraint is most of why
the board looks like the board. So the pen is not traced. It is followed one
tile at a time along a single axis, and a turn has to be earned: the corridor
holds its run until the pen has drifted a few tiles off it. A free-hand
diagonal drag comes out as long straights and square corners rather than a
one-tile staircase, and the corridor trails your hand slightly, spending that
lag on the straights. Corners round off the way the arcade's do. A click leaves
a single rounded dead-end cell.

The tile grid is anchored to the paper rather than to the stroke, so corridors
drawn minutes apart still line up. Draw one across another and the junction
opens between them into a single maze.

Pellets go down the middle on tile centres, a whole number of tiles apart at
any density. Power pellets are spaced out the way a board spaces its four, and
never at the mouth of a corridor.

## The chase

Pac-Man enters where you started and runs at the cabinet's pace, which is
slower than your hand. He clears the pellets he passes, chomping as he goes,
and stops after a set run. What is left is the picture the game always makes:
a corridor cleared behind him, pellets still waiting ahead, and Blinky, Pinky,
Inky and Clyde strung out in a train behind, eyes forward.

Take a power pellet on the way and the ghosts turn blue and blink before their
colours come back. The window is shorter than a chase on purpose — a fright
that outlasts the run would mean Blinky was never red.

Bonus fruit falls either well inside the chase, leaving its score cut into the
floor where it was eaten, or out in the stretch he never reaches, still
waiting. It is placed by which side of his stopping point it lands on rather
than by a distance, so a score can never end up on his face, and never on the
ghost train.

Mouth, skirts and eaten pellets are all driven by distance travelled rather
than by the clock. Settling a stroke early for history, export or a brush
switch therefore lands on exactly the frame it would have reached anyway.

- **Maze scale** scales the tile grid, and with it walls, pellets and every character.
- **Pellet density** sets how many tiles apart the pellets sit.
- **Chase length** sets how far Pac-Man runs. Short chases leave most of a corridor laid.
- **Ghosts** adds Blinky, Pinky, Inky and Clyde to the pursuit in that order.
- **Board colour** picks a wall colour, or changes it every stroke the way the cabinet changes it every level.
- **Bonus fruit** toggles fruit and the scores they leave behind. Shortcut **F**.

Auto-fill lays a board's worth of corridors on the shared grid, crossing into
one maze, each with its own chase entering a moment after the last.

## Walls

A board is not a line with an outline. Between two corridors the arcade shows
floor, a wall line, the dark inside of the wall block, another wall line, then
floor — which is four concentric bands along one path. Stroking a corridor's
whole stack at a time would paint it straight across its neighbour and shut
the junction, so every band is laid across every corridor before the next band
begins. The unions then merge and crossings stay open.

That is also why walls are held as vectors rather than painted down
immediately. A dozen corridors are kept live; older ones are frozen into the
raster, giving up the ability to merge with a new crossing in exchange for not
relaying the whole page each time a corridor grows. Pellets, fruit, scores and
the chase itself are cheap and change constantly, so they are drawn over the
walls each frame instead of forcing a repaint for every pellet eaten.

Open `?brush=pacman` or add `&auto` for a full board. Presets: `size=0.4`–`3`,
`density=0.4`–`2`, `chase=0.3`–`3`, `ghosts=0`–`4`,
`color=auto|blue|rose|cyan|amber|green`, and `extras=true|false`.

`arcade.js` holds the cabinet's colours and pace. `maze.js` owns the tile walk,
the pellets and the wall banding; `sprites.js` draws Pac-Man, the ghosts, the
fruit and the scores; `chase.js` is the run itself — distance, eating and
fright; `sketch.js` owns settings, the corridor lifecycle and the layers.
