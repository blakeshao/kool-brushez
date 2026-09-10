/** The cabinet's own colours. Pac-Man, the four ghosts and the pellets are
 * fixed — a pink ghost is Pinky and nothing else — while the walls take the
 * colour of the board, which is the one thing the arcade changes between
 * levels. */
export const PAC = "#ffff00";
export const FLOOR = "#000000";
export const PELLET = "#ffb8ae";
export const SCORE = "#00ffff";
export const EYE = "#f8f8f8";
export const PUPIL = "#2121de";
export const FRIGHTENED = "#2121ff";
export const FLASH = "#f8f8f8";

export const GHOSTS = [
  { id: "blinky", name: "Blinky", color: "#ff0000" },
  { id: "pinky", name: "Pinky", color: "#ffb8ff" },
  { id: "inky", name: "Inky", color: "#00ffff" },
  { id: "clyde", name: "Clyde", color: "#ffb851" },
];

export const BOARDS = {
  blue: { label: "Level one blue", wall: "#2121de" },
  rose: { label: "Rose board", wall: "#e33bb0" },
  cyan: { label: "Ice board", wall: "#21c8de" },
  amber: { label: "Amber board", wall: "#dd9021" },
  green: { label: "Green board", wall: "#2bb14a" },
};
export const BOARD_KEYS = Object.keys(BOARDS);

/** Bonus fruit, in the order the arcade awards it, with its score. */
export const FRUIT = [
  { id: "cherry", value: 100 },
  { id: "strawberry", value: 300 },
  { id: "orange", value: 500 },
  { id: "apple", value: 700 },
  { id: "melon", value: 1000 },
];

export const TILE = 26; // px of one maze tile at size 1
export const SPEED = 5.4; // tiles per second, near enough to arcade pace
export const CHOMP = 0.46; // tiles per full open-and-shut of the mouth
export const SKIRT = 0.9; // tiles per flick of a ghost's skirt
// Fright is a phase of a chase, not its whole length: a window longer than
// the run would leave the ghosts blue for good and Blinky would never be red.
export const POWER_TILES = 9; // tiles the ghosts stay frightened after a pellet
export const FLASH_TILES = 4; // tiles of blinking before they turn back
