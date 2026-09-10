/** Pigments sampled from the reference pours: a hue histogram over each
 * photograph, taking the most saturated tenth of every populated bin so the
 * cobalt veins and gold leaf survive instead of averaging into their
 * neighbours. Weights are roughly the share of the tray each pigment covers,
 * and `metal` is the leafing color a pour uses for its shimmer. */
export const PALETTES = {
  indigo: {
    label: "Indigo pour",
    swatch: "#1a33bd",
    metal: "#e9eff9",
    inks: [
      ["#2e6ea6", 5],
      ["#1a33bd", 3],
      ["#0f7798", 3],
      ["#f4f6fa", 4],
      ["#a9b6d4", 2],
      ["#3d37ae", 2],
      ["#2b2440", 1],
      ["#e7c3d4", 1],
    ],
  },
  opal: {
    label: "Opal & gold",
    swatch: "#f3c0d9",
    metal: "#c39a3f",
    inks: [
      ["#7fb3c9", 4],
      ["#f3c0d9", 4],
      ["#b9b3de", 3],
      ["#0f7f9e", 2],
      ["#efe6d2", 3],
      ["#f7f8fa", 2],
      ["#d9bae1", 1],
    ],
  },
  ember: {
    label: "Ember & aqua",
    swatch: "#d9491c",
    metal: "#e0a53a",
    inks: [
      ["#a8e2e9", 5],
      ["#ec8330", 3],
      ["#d9491c", 3],
      ["#f5bb1c", 2],
      ["#f6a9a6", 2],
      ["#f3ece0", 2],
      ["#b7dccc", 1],
    ],
  },
  mist: {
    label: "Sea mist",
    swatch: "#7ea9c6",
    metal: "#dee4ec",
    inks: [
      ["#7ea9c6", 4],
      ["#f5f7f9", 5],
      ["#166f8e", 2],
      ["#78909f", 2],
      ["#c3c8d1", 3],
      ["#b3b0d4", 1],
    ],
  },
};

export const PALETTE_KEYS = Object.keys(PALETTES);

export function parseHex(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
export const css = (rgb) => `rgb(${rgb.map((v) => Math.round(v)).join(",")})`;
export const lighten = (rgb, t) => mix(rgb, [255, 255, 255], t);
export const darken = (rgb, t) => mix(rgb, [12, 16, 26], t);

/** A pour's pigments as a bag that hands out one ink after another. Order is
 * shuffled per stroke and weighted, so touching bands rarely repeat a color
 * and each pour still favours the pigments that dominate its reference. */
export function createInkOrder(palette, random) {
  const bag = [];
  for (const [hex, weight] of palette.inks) {
    for (let i = 0; i < weight; i++) bag.push(parseHex(hex));
  }
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  let index = 0;
  let previous = null;
  return () => {
    let ink = bag[index++ % bag.length];
    // A repeat fuses two bands into one and hides the vein between them, so
    // step past a matching pigment rather than lay it down again. Every slot
    // is its own array, so this has to compare the colour and not the box it
    // came in, and it has to keep stepping — a heavily weighted pigment can
    // easily land three deep in the shuffle.
    for (let tries = 0; previous && same(ink, previous) && tries < bag.length; tries++) {
      ink = bag[index++ % bag.length];
    }
    previous = ink;
    // A little tonal drift keeps neighbouring bands of one pigment distinct.
    const drift = (random() - 0.5) * 0.16;
    return drift > 0 ? lighten(ink, drift) : darken(ink, -drift);
  };
}
