import { REFERENCE_PARTS } from "./reference-parts.js";

// Original, top-down model-kit silhouettes in local part coordinates. Compound
// paths leave sockets open to the artwork underneath, just like a real sprue.
export const PARTS = {
  chest: {
    w: 42, h: 34, gates: [-17, 10],
    shape: "M-19-10 L-11-14 -6-14 -5-17 5-17 6-14 11-14 19-10 21-3 17 10 8 13 5 10 -5 10 -8 13 -17 10 -21-3 Z M-4-10 H4 V-5 H-4 Z",
    seams: "M-17-8 L-9-11 -6-3 -14 0 Z M17-8 L9-11 6-3 14 0 Z M-14 3 L-10 8 -5 6 5 6 10 8 14 3 M0-2 V5",
    fine: "M-14-7 L-11-8 M-13-5 L-10-6 M-12-3 L-9-4 M14-7 L11-8 M13-5 L10-6 M12-3 L9-4 M-15 6 L-14 8 M15 6 L14 8",
  },
  shoulder: {
    w: 40, h: 32, gates: [-15, 5],
    shape: "M-20-6 L-13-15 10-15 19-7 20 10 12 15 9 5 -10 5 -13 15 -20 10 Z M-10-9 H9 V-2 H-10 Z",
    seams: "M-18-5 L-13-10 M12-11 L16-6 16 8 13 10 M-16-3 V9 M-9 2 H8",
    fine: "M-6-13 H5 M-19 1 H-16 M16 1 H19 M-14 12 L-12 6",
  },
  shin: {
    w: 27, h: 44,
    shape: "M-9-22 L8-22 13-14 10 3 6 20 0 22 -9 17 -13-8 Z",
    seams: "M-7-17 L5-17 8-11 4 3 2 16 -5 13 -8-7 Z M-7-17 L-9-22 M5-17 L8-22 M2 16 L0 22 M4 3 L10 3",
    fine: "M-5-12 L4-12 M-5-9 L3-9 M-4 8 L1 10 M-3 10 L0 11",
  },
  skirt: {
    w: 36, h: 36,
    shape: "M-10-18 L9-18 13-12 18 12 12 18 -16 15 -18 9 -13-12 Z",
    seams: "M-8-12 L7-12 12 9 9 12 -11 10 Z M-8-12 L-10-18 M12 9 L18 12 M-11 10 L-16 15",
    fine: "M-7-7 H7 M-6-4 H7 M-9 6 L8 8 M-8 8 L7 10",
  },
  foot: {
    w: 28, h: 43,
    shape: "M-8-20 L7-20 10-13 9-1 14 8 14 17 9 22 -12 20 -14 13 -11-3 -12-12 Z M-5-14 H5 V-4 H-5 Z",
    seams: "M-10 5 L8 6 11 10 10 16 -10 15 Z M-9 18 L9 19 M-8-18 H6 M-9-1 H8",
    fine: "M-8 9 L8 10 M-8 12 L8 13 M-8-10 V-5 M8-10 V-5",
  },
  helmet: {
    w: 31, h: 35,
    shape: "M-11-12 L-5-17 5-17 12-11 15 2 10 13 4 17 -5 17 -12 10 -15 0 Z M-9-1 L9-1 7 4 -7 4 Z",
    seams: "M-4-14 L-3-4 3-4 4-14 M-11 2 L-6 7 -4 13 4 13 6 7 11 2 M-2 7 L0 4 2 7 1 10 -1 10 Z",
    fine: "M-11-8 L-8-10 M11-8 L8-10 M-10 6 L-8 11 M10 6 L8 11 M-3 15 H3",
  },
  shield: {
    w: 27, h: 54,
    shape: "M-8-27 L8-27 13-20 13 15 0 27 -13 15 -13-20 Z M-5-19 H5 V-12 H-5 Z",
    seams: "M-9-8 H9 V13 L0 21 -9 13 Z M0-5 V17 M-6 6 H6 M-9-23 L-11-19 M9-23 L11-19",
    fine: "M-6-5 H-3 M3-5 H6 M-6 12 L-3 15 M6 12 L3 15 M-4-24 H4",
  },
  rifle: {
    w: 62, h: 26, gates: [-13, 3],
    shape: "M-31-7 L-23-7 -23-10 -11-10 -11-13 1-13 1-9 15-9 15-6 30-6 31-3 30 0 15 0 15 3 0 3 -3 8 -10 8 -9 3 -14 3 -19 13 -24 11 -21 3 -30 3 Z M-8 0 H-2 L-4 5 H-9 Z",
    seams: "M-27-4 H-14 V0 H-27 Z M-11-6 H11 V-2 H-11 M17-4 H29 M-17 3 L-21 10 M-6-11 H-1",
    fine: "M-24-9 V-6 M-19-9 V-6 M-14-9 V-6 M-8-5 V-2 M-4-5 V-2 M0-5 V-2 M4-5 V-2 M8-5 V-2",
  },
  saber: {
    w: 58, h: 10,
    shape: "M-29-4 H-14 V-2 H21 L29 0 21 2 H-14 V4 H-29 Z",
    seams: "M-25-4 V4 M-21-4 V4 M-17-4 V4 M-12 0 H20",
    fine: "M-28-2 H-25 M-28 2 H-25",
  },
  thruster: {
    w: 29, h: 32,
    shape: "M-7-16 H7 V-10 L14 8 12 14 6 16 -6 16 -12 14 -14 8 -7-10 Z M-9 7 Q0 2 9 7 L8 11 Q0 15 -8 11 Z",
    seams: "M-7-9 H7 M-7-6 L-11 6 M7-6 L11 6 M-3-7 L-4 3 M3-7 L4 3",
    fine: "M-5-13 H5 M-1-7 V2 M-11 12 L-8 14 M11 12 L8 14",
  },
  joint: {
    w: 29, h: 29,
    shape: "M-6-14 H6 V-11 L11-6 H14 V6 H11 L6 11 V14 H-6 V11 L-11 6 H-14 V-6 H-11 L-6-11 Z M6 0 A6 6 0 1 0 -6 0 A6 6 0 1 0 6 0 Z",
    seams: "M9 0 A9 9 0 1 0 -9 0 A9 9 0 1 0 9 0 M-4-12 H4 M-4 12 H4",
    fine: "M-12-3 V3 M12-3 V3 M-3-9 V-7 M3 7 V9",
  },
  hand: {
    w: 27, h: 30,
    shape: "M-7-15 H6 V-10 L11-9 13-4 12 9 8 14 -8 14 -12 9 -12-4 -8-8 Z M-5-3 H5 V5 H-5 Z",
    seams: "M-8-8 H7 M-8 8 H8 M-7 8 V13 M-2 8 V14 M3 8 V14 M8 8 V12 M-10-1 V6 M10-1 V6",
    fine: "M-5-12 H4 M-9 10 H-7 M-1 10 H2 M4 10 H7",
  },
  piston: {
    w: 18, h: 44,
    shape: "M-7-22 H7 V-13 H3 V-2 H7 V16 H9 V22 H-9 V16 H-7 V-2 H-3 V-13 H-7 Z M-4-19 H4 V-16 H-4 Z M-4 17 H4 V20 H-4 Z",
    seams: "M-4 1 H4 V14 H-4 Z M-1-12 V-3 M-7 15 H7",
    fine: "M-6 4 H-4 M-6 8 H-4 M-6 12 H-4 M4 4 H6 M4 8 H6 M4 12 H6",
  },
  vfin: {
    w: 64, h: 24, gates: [-3, 10],
    shape: "M-32-12 L-5 1 -3-3 3-3 5 1 32-12 20 5 7 8 3 12 -3 12 -7 8 -20 5 Z",
    seams: "M-25-7 L-7 5 -3 6 M25-7 L7 5 3 6 M-2-1 H2 V8 H-2 Z", fine: "M-17-1 L-9 5 M17-1 L9 5",
  },
  collar: {
    w: 50, h: 26, gates: [-13, -6],
    shape: "M-25-7 L-18-13 18-13 25-7 21 13 12 13 12-2 7-6 -7-6 -12-2 -12 13 -21 13 Z",
    seams: "M-21-5 L-18 9 -15 9 M21-5 L18 9 15 9 M-16-10 H16", fine: "M-22-3 H-17 M22-3 H17 M-6-10 H6",
  },
  waist: {
    w: 54, h: 32, gates: [-9, 16],
    shape: "M-27-8 L-20-13 -8-13 -5-9 5-9 8-13 20-13 27-8 24 10 14 12 7 9 4 16 -4 16 -7 9 -14 12 -24 10 Z M-20-5 H-10 V4 H-20 Z M10-5 H20 V4 H10 Z",
    seams: "M-5-5 H5 V6 H-5 Z M-22 7 L-14 9 M22 7 L14 9", fine: "M-18-10 H-11 M18-10 H11 M-2 9 V12 M2 9 V12",
  },
  hip: {
    w: 31, h: 29, gates: [-10, 11],
    shape: "M-9-14 H9 V-10 H15 V10 H9 V14 H-9 V10 H-15 V-10 H-9 Z M-5-6 H5 V6 H-5 Z",
    seams: "M-11-7 V7 M11-7 V7 M-7-11 H7 M-7 11 H7", fine: "M-13-4 H-11 M11 4 H13",
  },
  forearm: {
    w: 26, h: 49,
    shape: "M-8-24 H8 L12-16 10 3 13 17 7 24 -7 24 -13 17 -10 3 -12-16 Z M-5-17 H5 V-8 H-5 Z",
    seams: "M-8-5 L-6 4 -8 15 -4 19 4 19 8 15 6 4 8-5 M-6 1 H6", fine: "M-4 8 H4 M-4 11 H4 M-4 14 H4",
  },
  legframe: {
    w: 27, h: 68,
    shape: "M-8-34 H8 L12-26 8-15 5-12 6 8 12 12 13 25 8 34 -8 34 -13 25 -12 12 -6 8 -5-12 -8-15 -12-26 Z M-4-26 H4 V-19 H-4 Z M-5 17 H5 V26 H-5 Z",
    seams: "M-3-11 H3 V8 H-3 Z M-8 12 H8 M-7 30 H7 M-8-30 H8", fine: "M0-8 V5 M-9 15 V25 M9 15 V25",
  },
  sole: {
    w: 28, h: 59,
    shape: "M-8-29 H8 L12-18 11-6 14 8 12 25 7 29 -7 29 -12 25 -14 8 -11-6 -12-18 Z M-5-19 H5 V-8 H-5 Z M-7 6 H7 V18 H-7 Z",
    seams: "M-9-23 H9 M-9-4 H9 M-10 23 H10 M-11 1 V18 M11 1 V18", fine: "M-4-26 H4 M-4 25 H4 M-3-4 V2 M3-4 V2",
  },
  backpack: {
    w: 52, h: 47, gates: [-18, 19],
    shape: "M-20-23 H-9 V-18 H9 V-23 H20 V-16 H26 V15 H20 V23 H9 V19 H-9 V23 H-20 V15 H-26 V-16 H-20 Z M-16-8 H-8 V8 H-16 Z M8-8 H16 V8 H8 Z",
    seams: "M-5-13 H5 V13 H-5 Z M-22-11 V11 M22-11 V11 M-18 17 H-10 M10 17 H18", fine: "M-3-9 H3 M-3-5 H3 M-3-1 H3 M-3 3 H3 M-3 7 H3",
  },
  tank: {
    w: 18, h: 64,
    shape: "M-4-32 H4 V-27 Q9-25 9-19 V20 Q9 27 4 29 V32 H-4 V29 Q-9 27 -9 20 V-19 Q-9-25 -4-27 Z",
    seams: "M-8-18 H8 M-9 15 H9 M-7 23 H7 M-4-23 V11", fine: "M-8-15 H8 M-9 18 H9 M-3 28 H3",
  },
  ballcap: {
    w: 13, h: 13,
    shape: "M-3-6 H3 V-4 Q6-4 6 0 Q6 4 3 4 V6 H-3 V4 Q-6 4 -6 0 Q-6-4 -3-4 Z M2.5 0 A2.5 2.5 0 1 0 -2.5 0 A2.5 2.5 0 1 0 2.5 0 Z",
    seams: "M-4-2 V2 M4-2 V2", fine: "M-2-5 H2 M-2 5 H2",
  },
  bushing: {
    w: 16, h: 19,
    shape: "M-6-9 H6 V-5 H8 V5 H6 V9 H-6 V5 H-8 V-5 H-6 Z M3 0 A3 3 0 1 0 -3 0 A3 3 0 1 0 3 0 Z",
    seams: "M-5-6 H5 M-5 6 H5", fine: "M-6-3 V3 M6-3 V3",
  },
  hinge: {
    w: 38, h: 16, gates: [-5, 5],
    shape: "M-19-6 H-9 V-3 H-5 V-8 H5 V-3 H9 V-6 H19 V6 H9 V3 H5 V8 H-5 V3 H-9 V6 H-19 Z M-16-2 H-12 V2 H-16 Z M12-2 H16 V2 H12 Z",
    seams: "M-3-5 H3 V5 H-3 Z M-10-3 V3 M10-3 V3", fine: "M-17-4 H-11 M17 4 H11",
  },
  crossjoint: {
    w: 40, h: 41,
    shape: "M-5-20 H5 V-8 L8-5 H20 V5 H8 L5 8 V20 H-5 V8 L-8 5 H-20 V-5 H-8 L-5-8 Z M3.5 0 A3.5 3.5 0 1 0 -3.5 0 A3.5 3.5 0 1 0 3.5 0 Z",
    seams: "M-3-16 H3 M-3 16 H3 M-16-3 V3 M16-3 V3", fine: "M-2-12 H2 M-2 12 H2 M-12-2 V2 M12-2 V2",
  },
  linkrod: {
    w: 72, h: 16, gates: [-3, 3],
    shape: "M-36-5 L-31-8 -24-8 -20-3 H20 L24-8 31-8 36-5 V5 L31 8 24 8 20 3 H-20 L-24 8 -31 8 -36 5 Z M-25 0 A3 3 0 1 0 -31 0 A3 3 0 1 0 -25 0 Z M31 0 A3 3 0 1 0 25 0 A3 3 0 1 0 31 0 Z",
    seams: "M-19 0 H19 M-4-3 V3 M4-3 V3", fine: "M-15-2 V2 M15-2 V2",
  },
  yoke: {
    w: 32, h: 36, gates: [-18, 10],
    shape: "M-12-18 H12 L16-13 V13 H10 V18 H5 V8 H-5 V18 H-10 V13 H-16 V-13 Z M-9-11 H9 V3 H-9 Z",
    seams: "M-12-10 V8 M12-10 V8 M-10-15 H10 M-5 6 H5", fine: "M-8 12 V15 M8 12 V15",
  },
  vernier: {
    w: 18, h: 23,
    shape: "M-4-11 H4 V-6 L9 7 7 11 H-7 L-9 7 -4-6 Z M-5 6 H5 L4 8 H-4 Z",
    seams: "M-3-4 L-6 4 M3-4 L6 4", fine: "M-2-8 H2",
  },
  cannon: {
    w: 116, h: 22, gates: [-8, 8],
    shape: "M-58-5 H-47 V-8 H-34 V-5 H-12 V-10 H16 V-7 H28 V-4 H55 L58-2 V2 L55 4 H28 V7 H16 V10 H-12 V5 H-34 V8 H-47 V5 H-58 Z",
    seams: "M-54-2 H-14 M-10-7 H13 V7 H-10 Z M18-4 H27 M29 0 H56", fine: "M-43-6 V6 M-39-6 V6 M-7-5 V5 M-3-5 V5 M1-5 V5 M5-5 V5 M9-5 V5",
  },
  bazooka: {
    w: 126, h: 29, gates: [-10, 7],
    shape: "M-63-9 H-50 V-6 H-28 V-10 H15 V-7 H48 V-11 H59 L63-7 V7 L59 11 H48 V7 H13 V12 H5 V7 H-9 L-13 18 H-20 L-19 7 H-28 V4 H-50 V9 H-63 Z M-10 7 H0 V11 H-12 Z",
    seams: "M-58-6 V6 M-49-3 H-29 M-25-6 H12 V3 H-25 Z M16-3 H46 M52-8 V8", fine: "M-21-4 V1 M-16-4 V1 M-11-4 V1 M-6-4 V1 M-1-4 V1 M4-4 V1 M54-5 H60 M54 5 H60",
  },
  barrel: {
    w: 91, h: 12, gates: [-4, 4],
    shape: "M-45-5 H-32 V-3 H-18 V-6 H-10 V-4 H32 V-6 H43 L45-4 V4 L43 6 H32 V4 H-10 V6 H-18 V3 H-32 V5 H-45 Z",
    seams: "M-40-3 V3 M-35-3 V3 M-29 0 H30 M35-4 V4 M40-4 V4", fine: "M-13-4 V4 M-5-3 V3 M0-3 V3 M5-3 V3 M10-3 V3 M15-3 V3 M20-3 V3 M25-3 V3",
  },
  magazine: {
    w: 20, h: 33,
    shape: "M-10-16 H8 V-9 L10 8 6 16 -8 16 -10 9 Z",
    seams: "M-6-10 H4 L6 9 3 12 H-5 Z M-9-13 H7", fine: "M-5-7 H4 M-5-3 H4 M-5 1 H4 M-5 5 H4 M-5 9 H3",
  },
  stock: {
    w: 35, h: 27, gates: [-5, 7],
    shape: "M-17-13 H-9 V-5 H12 V-9 H17 V9 H12 V5 H-3 L-9 13 H-17 Z M-10-2 H3 L-5 6 H-10 Z",
    seams: "M-14-10 V10 M6-2 H14 V2 H6", fine: "M-16-6 H-14 M-16-2 H-14 M-16 2 H-14 M-16 6 H-14",
  },
  bipod: {
    w: 46, h: 39, gates: [-19, -6],
    shape: "M-6-19 H6 V-10 L23 16 19 20 3-5 H-3 L-19 20 -23 16 -6-10 Z M-3-16 H3 V-11 H-3 Z",
    seams: "M-4-7 L-19 15 M4-7 L19 15 M-2-9 H2", fine: "M-14 8 L-11 10 M14 8 L11 10",
  },
  blade: {
    w: 91, h: 11, gates: [-3, 3],
    shape: "M-45-3 H-28 V-6 H-24 V-3 H34 L46 0 34 3 H-24 V6 H-28 V3 H-45 Z",
    seams: "M-41-3 V3 M-37-3 V3 M-33-3 V3 M-21 0 H34", fine: "M-43-1 H-41 M-39-1 H-37",
  },
  scope: {
    w: 28, h: 15, gates: [-4, 7],
    shape: "M-14-7 H-7 V-4 H7 V-6 H14 V6 H7 V3 H3 V7 H-3 V3 H-7 V7 H-14 Z",
    seams: "M-11-5 V5 M10-4 V4 M-6-1 H6", fine: "M-5 1 H5",
  },
};

Object.assign(PARTS, REFERENCE_PARTS);

export const COMPONENT_POOLS = {
  armor: ["chest", "shoulder", "shin", "skirt", "foot", "helmet", "vfin", "collar", "waist", "hip", "forearm", "sole", "backpack"],
  mechanical: ["thruster", "joint", "hand", "piston", "legframe", "tank", "ballcap", "bushing", "hinge", "crossjoint", "linkrod", "yoke", "vernier"],
  weapons: ["rifle", "shield", "saber", "cannon", "bazooka", "barrel", "magazine", "stock", "bipod", "blade", "scope"],
};
COMPONENT_POOLS.mixed = [...COMPONENT_POOLS.armor, ...COMPONENT_POOLS.mechanical, ...COMPONENT_POOLS.weapons];
