import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import * as A from "../kit/audit.mjs";
import { kitScript } from "../tools/inline-kit.mjs";
import { sitePage } from "./site.mjs";
import { World, KINDS, KERNEL_PEAK, TILE } from "./model/field.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const WIDTH = 660;
const HEIGHT = 450;

// ------------------------------------------------------------------ the bench
const BASE = { x: -194, y: -104, w: 376, d: 208, r: 13 };
const BASE_H = 14;

// The field plate: one 32 x 32 tile of the grid, 1024 int16 cells, 2048 bytes.
const PLATE = { x: -168, y: -50, w: 128, d: 128, r: 3 };
const BED = { x: PLATE.x - 3.4, y: PLATE.y - 3.4, w: PLATE.w + 6.8, d: PLATE.d + 6.8, r: 3 };
const PLATE_BODY = 4.4;    // the bed's top
const FIELD_TOP = 5;       // the published field's surface
const CELLS = 32;
const CELL = PLATE.w / CELLS;

// The tile the plate shows, in the library's grid.
const TILE_X0 = 96;
const TILE_Y0 = 32;

// The press: a column, a cantilever beam along y, a saddle that slides in y, a
// cross rail that carries the head along x, an arm that reaches out over the
// plate, a ram and the die.
const COLUMN = [-24, -86];
const BEAM_Y0 = -88;
const BEAM_Y1 = 48;
const Z_FOOT = 0;
const Z_COL = 2.4;
const Z_CAP = 71;
const Z_BEAM = 74.4;
const Z_RIB = 79;
const Z_BLOCK = 80.8;
const Z_RAIL = 86.4;
const Z_HEAD = 91.4;
const RAIL_X0 = -188;
const RAIL_X1 = -20;
const ARM = 24;             // the head's reach: +y from the rail's axis to the die
const DIE_Z = 35;           // the die's foot

const HOME = { x: 112.5, y: 48.5 };
const HOME_FIG = {
  x: PLATE.x + (HOME.x - TILE_X0) * CELL,
  y: PLATE.y + (HOME.y - TILE_Y0) * CELL,
};
const RAIL_HOME_Y = HOME_FIG.y - ARM;

// The set of dies standing in a tray.
const RACK = { x: -6, y: -30, w: 136, d: 92, r: 4 };
const RACK_SLOTS = [
  [16, -10], [50, -10], [84, -10],
  [16, 32], [50, 32], [84, 32], [112, 32],
];

const P = k.fitProjection(
  [
    ...k.boxCorners(BASE, -BASE_H - 6, 0),
    [COLUMN[0], COLUMN[1], Z_BEAM + 5],
    [RAIL_X0, 0, Z_RAIL + 5],
    [RACK.x + RACK.w, RACK.y + RACK.d, 26],
  ],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 42 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// The cell grid is drawn flat and transformed onto the plate.
const cellMatrix = (() => {
  const o = at([PLATE.x, PLATE.y, FIELD_TOP]);
  const u = at([PLATE.x + CELL, PLATE.y, FIELD_TOP]);
  const v = at([PLATE.x, PLATE.y + CELL, FIELD_TOP]);
  return `matrix(${(u[0] - o[0]).toFixed(4)} ${(u[1] - o[1]).toFixed(4)} ${(v[0] - o[0]).toFixed(4)} ${(v[1] - o[1]).toFixed(4)} ${o[0].toFixed(3)} ${o[1].toFixed(3)})`;
})();

// ------------------------------------------------------------------ the recorder
const R = A.recorder(P, { order: [], spring: {} });
const items = [];
const put = (name, piece, at, svg, shapes, bias = 0) => {
  items.push({ name, piece, at, svg, shapes, bias });
};

// ------------------------------------------------------------------ the dies
// A die's profile is the kernel's profile: the tool that makes the footprint.
const DIE_PROFILE = {
  Box: (r) => r * 0.46,
  Disk: (r) => r * 0.42,
  Cone: (r) => r * 1.05,
  Tent: (r) => r * 1.05,
  Bell: (r) => r * 0.92,
  Dome: (r) => r * 0.86,
  New: () => 4,
};

function diePaths(kind, cx, cy, base, r) {
  const F = G.frameAlong([cx, cy, base], [0, 0, 1]);
  if (kind === "Box") return k.slabOf({ x: cx - r, y: cy - r, w: r * 2, d: r * 2, r: 2 }, base, r * 0.46, P, 3, 0.7);
  if (kind === "Disk") return k.cylinder(cx, cy, r, base, r * 0.42, P, 56, 0.6);
  if (kind === "Cone") return G.solidOf([[0, r], [r * 1.05, 0]], F, P, { steps: 44 });
  if (kind === "Tent") {
    const S45 = Math.SQRT1_2;
    const Tf = G.frameOf([cx, cy, base], [0, 0, 1], [S45, S45, 0], [-S45, S45, 0]);
    return G.solidOf([[0, r * Math.SQRT2], [r * 1.05, 0]], Tf, P, { steps: 4 });
  }
  if (kind === "Bell") {
    const h = r * 0.92;
    const prof = [[0, r], [h * 0.25, r * 0.968, 1], [h * 0.5, r * 0.866, 1], [h * 0.75, r * 0.661, 1], [h, 0, 1]];
    return G.solidOf(prof, F, P, { steps: 48 });
  }
  if (kind === "Dome") {
    const h = r * 0.86;
    const prof = [];
    for (let i = 0; i <= 6; i++) {
      const s = (h * i) / 6;
      prof.push([s, Math.sqrt(Math.max(0, r * r - s * s)), 1]);
    }
    return G.solidOf(prof, F, P, { steps: 48 });
  }
  const prof = [[0, 0], [0, r - 4], [1.2, r - 2.6, 1], [3, r - 0.8, 1], [4, r, 1], [4, r]];
  return G.solidOf(prof, F, P, { steps: 48 });
}

// The shape the audit records for a die.
function dieShape(kind, cx, cy, base, r, name) {
  const F = G.frameAlong([cx, cy, base], [0, 0, 1]);
  if (kind === "Box") return A.slab({ x: cx - r, y: cy - r, w: r * 2, d: r * 2, r: 2 }, base, r * 0.46, { name, owner: "press" });
  if (kind === "Disk") return A.cylinder(cx, cy, r, base, r * 0.42, { name, owner: "press" });
  if (kind === "Cone") return A.solid(F, [[0, r], [r * 1.05, 0]], { name, owner: "press" });
  if (kind === "Tent") {
    const S45 = Math.SQRT1_2;
    const Tf = G.frameOf([cx, cy, base], [0, 0, 1], [S45, S45, 0], [-S45, S45, 0]);
    return A.solid(Tf, [[0, r * Math.SQRT2], [r * 1.05, 0]], { name, owner: "press" });
  }
  if (kind === "Bell") {
    const h = r * 0.92;
    return A.solid(F, [[0, r], [h * 0.25, r * 0.968, 1], [h * 0.5, r * 0.866, 1], [h * 0.75, r * 0.661, 1], [h, 0, 1]], { name, owner: "press" });
  }
  if (kind === "Dome") {
    const h = r * 0.86;
    const prof = [];
    for (let i = 0; i <= 6; i++) {
      const s = (h * i) / 6;
      prof.push([s, Math.sqrt(Math.max(0, r * r - s * s)), 1]);
    }
    return A.solid(F, prof, { name, owner: "press" });
  }
  return A.solid(F, [[0, 0], [0, r - 4], [1.2, r - 2.6, 1], [3, r - 0.8, 1], [4, r, 1], [4, r]], { name, owner: "press" });
}

const dieSvg = (kind, cx, cy, base, r, tone, lit) => {
  const out = [S(diePaths(kind, cx, cy, base, r), { tone, crease: lit ? "lo" : "faint", lit })];
  if (kind === "Box") {
    const plan = { x: cx - r, y: cy - r, w: r * 2, d: r * 2, r: 2 };
    out.push(L(k.planOutline(k.insetPlan(plan, 2.4), base + r * 0.46, P), { tone: "faint" }));
  }
  if (kind === "Disk" || kind === "New") out.push(L(k.ring(cx, cy, r - 1.6, base + r * 0.42, P, 44), { tone: "faint" }));
  if (kind === "Cone" || kind === "Tent") out.push(L(k.ring(cx, cy, r * 0.46, base + 0.4, P, 28), { tone: "faint" }));
  if (kind === "Bell" || kind === "Dome") out.push(L(k.ring(cx, cy, r * 0.42, base + 0.4, P, 28), { tone: "faint" }));
  return out.join("");
};

// ------------------------------------------------------------------ the bench parts
function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BASE, -BASE_H - 6, BASE_H, P)}"/>`];
  const shapes = [A.slab(BASE, -BASE_H, BASE_H, { name: "stand.base", ground: true, owner: "bench" })];
  for (const [x, y] of byDepth(k.corners(BASE, 26))) {
    out.push(S(k.cylinder(x, y, 7.5, -BASE_H - 6, 1.8, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.6, -BASE_H - 4.2, 4.2, P, 28), { tone: "mid" }));
    shapes.push(A.cylinder(x, y, 5.6, -BASE_H - 4.2, 4.2, { name: "stand.foot", owner: "bench" }));
  }
  out.push(S(k.slabOf(BASE, -BASE_H, BASE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(BASE, 6), 0, P), { tone: "lo" }));
  const screws = k.corners(BASE, 12);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  for (const [x, y] of screws) shapes.push(A.cylinder(x, y, 2.2, 0, 0.4, { name: "stand.screw", owner: "bench" }));
  const strip = { x: -170, y: BASE.y + BASE.d - 17, w: 170, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.7, P, 3), { tone: "lo", crease: "none" }));
  shapes.push(A.slab(strip, 0, 0.7, { name: "stand.ruler", owner: "bench" }));
  const ticks = k.topTicks(strip.x + 5, strip.x + strip.w - 5, 5, 4, strip.y + 0.9, 0.7, [2, 3.8], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 3, strip.y + 3.5, 0.7]), at([strip.x + strip.w - 3, strip.y + 3.5, 0.7])], { size: 0.45 }));
  const label = { x: 16, y: BASE.y + BASE.d - 18, w: 50, d: 9, r: 1.5 };
  out.push(S(k.slabOf(label, 0, 0.9, P, 3), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.9, P), { tone: "faint" }));
  out.push(L(k.lineOnTop([label.x + 4, label.y + 3.4], [label.x + 29, label.y + 3.4], 0.9, P), { tone: "lo", free: true }));
  out.push(L(k.lineOnTop([label.x + 4, label.y + 6], [label.x + 20, label.y + 6], 0.9, P), { tone: "lo", free: true }));
  out.push(D([at([label.x + 42, label.y + 4.5, 0.9])], { size: 0.45 }));
  shapes.push(A.slab(label, 0, 0.9, { name: "stand.label", owner: "bench" }));
  return { svg: out.join(""), shapes };
}

// The bed the tile sits in: a plain slab with a raised frame round the field.
function plate() {
  const out = [];
  const shapes = [A.slab(BED, 0, PLATE_BODY, { name: "stand.bed", owner: "bench" })];
  out.push(S(k.slabOf(BED, 0, PLATE_BODY, P, 3, 0.8), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(BED, 5), PLATE_BODY, P), { tone: "lo" }));
  return { svg: out.join(""), shapes };
}

// The frame that holds the field panel down.
function bezel() {
  const out = [];
  const shapes = [];
  const bars = [
    { x: BED.x, y: BED.y, w: BED.w, d: PLATE.y - BED.y },
    { x: BED.x, y: PLATE.y + PLATE.d, w: BED.w, d: BED.y + BED.d - PLATE.y - PLATE.d },
    { x: BED.x, y: PLATE.y, w: PLATE.x - BED.x, d: PLATE.d },
    { x: PLATE.x + PLATE.w, y: PLATE.y, w: BED.x + BED.w - PLATE.x - PLATE.w, d: PLATE.d },
  ];
  for (const bar of bars) {
    out.push(S(k.slabOf({ ...bar, r: 1 }, PLATE_BODY, 3.4, P, 2, 0.4), { tone: "mid" }));
    shapes.push(A.slab({ ...bar, r: 1 }, PLATE_BODY, 3.4, { name: "stand.bezel", owner: "bench" }));
  }
  const corners = [
    [BED.x + 1.7, BED.y + 1.7], [BED.x + BED.w - 1.7, BED.y + 1.7],
    [BED.x + 1.7, BED.y + BED.d - 1.7], [BED.x + BED.w - 1.7, BED.y + BED.d - 1.7],
  ];
  out.push(L(corners.map(([x, y]) => k.ring(x, y, 1.5, PLATE_BODY + 3.4, P, 14)).join(""), { tone: "lo" }));
  out.push(D(corners.map(([x, y]) => at([x, y, PLATE_BODY + 3.4])), { size: 0.45 }));
  for (const [x, y] of corners) shapes.push(A.cylinder(x, y, 1.5, PLATE_BODY, 3.4, { name: "stand.bezelscrew", owner: "bench" }));
  return { svg: out.join(""), shapes };
}

// The press: column, cantilever beam and the rail on top of it.
function press() {
  const out = [];
  const shapes = [];
  const [cx, cy] = COLUMN;
  out.push(S(k.cylinder(cx, cy, 9, Z_FOOT, 2.4, P, 32), { tone: "lo" }));
  out.push(S(k.cylinder(cx, cy, 6.6, Z_COL, Z_CAP - Z_COL, P, 32, 0.8), { tone: "mid" }));
  out.push(L(k.sideArc(cx, cy, 6.6, 14, P, 20), { tone: "faint" }));
  out.push(L(k.sideArc(cx, cy, 6.6, 30, P, 20), { tone: "faint" }));
  out.push(S(k.cylinder(cx, cy, 8.2, Z_CAP, 3.4, P, 32, 0.7), { tone: "mid" }));
  shapes.push(A.cylinder(cx, cy, 9, Z_FOOT, 2.4, { name: "press.columnfoot", owner: "press" }));
  shapes.push(A.cylinder(cx, cy, 6.6, Z_COL, Z_CAP - Z_COL, { name: "press.column", owner: "press" }));
  shapes.push(A.cylinder(cx, cy, 8.2, Z_CAP, 3.4, { name: "press.columncap", owner: "press" }));
  const beam = { x: cx - 4.4, y: BEAM_Y0, w: 8.8, d: BEAM_Y1 - BEAM_Y0, r: 1.6 };
  out.push(S(k.slabOf(beam, Z_BEAM, 4.6, P, 4, 0.6), { tone: "mid" }));
  out.push(L(k.sideSeam(beam, Z_BEAM + 2, P, 4), { tone: "faint" }));
  shapes.push(A.slab(beam, Z_BEAM, 4.6, { name: "press.beam", owner: "press" }));
  const rib = { x: cx - 1.6, y: BEAM_Y0 + 3, w: 3.2, d: BEAM_Y1 - BEAM_Y0 - 9, r: 1 };
  out.push(S(k.slabOf(rib, Z_RIB, 1.8, P, 3, 0.3), { tone: "lo" }));
  out.push(D([BEAM_Y0 + 9, BEAM_Y1 - 12].map((y) => at([cx, y, Z_RIB + 1.8])), { size: 0.4 }));
  shapes.push(A.slab(rib, Z_RIB, 1.8, { name: "press.beamrail", owner: "press" }));
  return { svg: out.join(""), shapes };
}

// The saddle block: it rides the beam and carries the cross rail.
function saddleBlock() {
  const out = [];
  const shapes = [];
  const ry = RAIL_HOME_Y;
  const block = { x: COLUMN[0] - 8.2, y: ry - 8, w: 16.4, d: 16, r: 2 };
  out.push(S(k.slabOf(block, Z_BLOCK, Z_RAIL - Z_BLOCK, P, 4, 0.6), { tone: "mid" }));
  out.push(D([[block.x + 3, block.y + 3], [block.x + block.w - 3, block.y + 3], [block.x + 3, block.y + block.d - 3], [block.x + block.w - 3, block.y + block.d - 3]].map(([x, y]) => at([x, y, Z_RAIL])), { size: 0.45 }));
  shapes.push(A.slab(block, Z_BLOCK, Z_RAIL - Z_BLOCK, { name: "press.saddle", owner: "press" }));
  return { svg: out.join(""), shapes };
}

// The cross rail: it runs in x under the head and slides through the saddle.
function crossRail() {
  const out = [];
  const shapes = [];
  const ry = RAIL_HOME_Y;
  const rail = { x: RAIL_X0, y: ry - 4.8, w: RAIL_X1 - RAIL_X0, d: 9.6, r: 1.6 };
  out.push(S(k.slabOf(rail, Z_RAIL, 5, P, 4, 0.6), { tone: "mid" }));
  out.push(L(k.sideSeam(rail, Z_RAIL + 2.4, P, 4), { tone: "faint" }));
  shapes.push(A.slab(rail, Z_RAIL, 5, { name: "press.crossrail", owner: "press" }));
  const rib = { x: RAIL_X0 + 3, y: ry + 4.8, w: RAIL_X1 - RAIL_X0 - 6, d: 1.6, r: 0.5 };
  out.push(S(k.slabOf(rib, Z_RAIL, 5, P, 3, 0.3), { tone: "lo" }));
  shapes.push(A.slab(rib, Z_RAIL, 5, { name: "press.railrib", owner: "press" }));
  return { svg: out.join(""), shapes };
}

// The leg that carries the rail's far end. It stands behind the plate, so it is
// drawn with the bench, before the bed.
function railLeg() {
  const out = [];
  const shapes = [];
  const ry = RAIL_HOME_Y;
  const leg = { x: RAIL_X0 + 4, y: ry - 4, w: 8, d: 8, r: 1.4 };
  out.push(S(k.slabOf(leg, 0, Z_RAIL, P, 4, 0.7), { tone: "mid" }));
  out.push(S(k.slabOf({ x: leg.x - 3, y: leg.y - 3, w: 14, d: 14, r: 2 }, 0, 2.2, P, 3, 0.4), { tone: "lo" }));
  out.push(D([[leg.x + 2.6, leg.y + 2.6], [leg.x + 5.4, leg.y + 5.4]].map(([x, y]) => at([x, y, 2.2])), { size: 0.45 }));
  shapes.push(A.slab(leg, 0, Z_RAIL, { name: "press.leg", owner: "press" }));
  shapes.push(A.slab({ x: leg.x - 3, y: leg.y - 3, w: 14, d: 14, r: 2 }, 0, 2.2, { name: "press.legfoot", owner: "press" }));
  return { svg: out.join(""), shapes };
}

// The head: a carriage on the rail and the arm that reaches out over the plate.
function head() {
  const out = [];
  const shapes = [];
  const hx = HOME_FIG.x;
  const ry = RAIL_HOME_Y;
  // The carriage rides the rail on two shoes, clear of the rail's top face.
  for (const sx of [hx - 8.4, hx + 2.4]) {
    const shoe = { x: sx, y: ry - 3, w: 6, d: 6, r: 1 };
    out.push(S(k.slabOf(shoe, Z_RAIL + 5, 1.6, P, 3, 0.3), { tone: "lo" }));
    shapes.push(A.slab(shoe, Z_RAIL + 5, 1.6, { name: "press.shoe", owner: "press" }));
  }
  const block = { x: hx - 8.4, y: ry - 8.4, w: 16.8, d: 16.8, r: 2 };
  out.push(S(k.slabOf(block, Z_HEAD + 1.6, 6.6, P, 4, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(block, 2.4), Z_HEAD + 8.2, P), { tone: "faint" }));
  out.push(D([[block.x + 3, block.y + 3], [block.x + block.w - 3, block.y + block.d - 3]].map(([x, y]) => at([x, y, Z_HEAD + 8.2])), { size: 0.45 }));
  shapes.push(A.slab(block, Z_HEAD + 1.6, 6.6, { name: "press.head", owner: "press" }));
  const arm = { x: hx - 5, y: ry + 8.4, w: 10, d: HOME_FIG.y + 5 - (ry + 8.4), r: 1.4 };
  out.push(S(k.slabOf(arm, Z_HEAD + 2.2, 4.2, P, 3, 0.5), { tone: "mid" }));
  out.push(D([[arm.x + 2.4, arm.y + arm.d - 2.4], [arm.x + arm.w - 2.4, arm.y + arm.d - 2.4]].map(([x, y]) => at([x, y, Z_HEAD + 6.4])), { size: 0.4 }));
  shapes.push(A.slab(arm, Z_HEAD + 2.2, 4.2, { name: "press.arm", owner: "press" }));
  return { svg: out.join(""), shapes };
}

// The scribe: a fine pin from the die down to the plate, marking the cell it stamps.
function scribe() {
  const out = [];
  const [sx, sy] = [HOME_FIG.x, HOME_FIG.y];
  out.push(S(k.cylinder(sx, sy, 0.9, FIELD_TOP, DIE_Z - FIELD_TOP, P, 12), { tone: "hi" }));
  out.push(S(k.cylinder(sx, sy, 1.8, FIELD_TOP, 1, P, 14), { tone: "hi" }));
  return {
    svg: out.join(""),
    shapes: [A.cylinder(sx, sy, 0.9, FIELD_TOP, DIE_Z - FIELD_TOP, { name: "press.scribe", owner: "press" })],
  };
}

// The set of dies standing in a tray.
function rack() {
  const out = [];
  const shapes = [];
  out.push(S(k.slabOf({ ...RACK, r: 4 }, 0, 2.2, P, 4, 0.5), { tone: "lo" }));
  shapes.push(A.slab({ ...RACK, r: 4 }, 0, 2.2, { name: "stand.rackfloor", owner: "bench" }));
  const lip = { x: RACK.x, y: RACK.y, w: RACK.w, d: 4, r: 1.5 };
  out.push(S(k.slabOf(lip, 2.2, 5, P, 3, 0.5), { tone: "mid" }));
  shapes.push(A.slab(lip, 2.2, 5, { name: "stand.racklip", owner: "bench" }));
  for (const x of [RACK.x, RACK.x + RACK.w - 4]) {
    const wall = { x, y: RACK.y + 4, w: 4, d: RACK.d - 4, r: 1.5 };
    out.push(S(k.slabOf(wall, 2.2, 7, P, 3, 0.5), { tone: "mid" }));
    shapes.push(A.slab(wall, 2.2, 7, { name: "stand.rackwall", owner: "bench" }));
  }
  RACK_SLOTS.forEach(([x, y], index) => {
    const kind = KINDS[index];
    out.push(`<g data-die="${kind}" data-part="die-${kind}">`);
    out.push(S(k.slabOf({ x: x - 14, y: y - 14, w: 28, d: 28, r: 2 }, 2.2, 1.2, P, 3, 0.3), { tone: "faint" }));
    out.push(dieSvg(kind, x, y, 3.4, 9, "mid", false));
    out.push("</g>");
    shapes.push(A.slab({ x: x - 14, y: y - 14, w: 28, d: 28, r: 2 }, 2.2, 1.2, { name: "stand.slot", owner: "bench" }));
    shapes.push(dieShape(kind, x, y, 3.4, 9, `stand.die.${kind.toLowerCase()}`));
  });
  return { svg: out.join(""), shapes };
}

// The dial that reads how many tiles the last press republished.
function dial() {
  const out = [];
  const shapes = [];
  const [x, y] = [RACK.x + RACK.w - 6, RACK.y - 30];
  out.push(S(k.cylinder(x, y, 15, 0, 3, P, 44, 0.6), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 13, 3, 4.4, P, 44, 0.6), { tone: "hi", crease: "lo" }));
  out.push(L(k.ring(x, y, 10.4, 7.4, P, 40), { tone: "lo" }));
  const ticks = k.radialTicks(x, y, 10.4, 5, 1, 7.4, [1.2, 2.4], P, -Math.PI * 0.62, Math.PI * 1.24);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(L(k.ring(x, y, 1.5, 7.4, P, 14), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 4.4, 7.4, 1.4, P, 20), { tone: "mid" }));
  shapes.push(A.cylinder(x, y, 15, 0, 3, { name: "stand.dialfoot", owner: "bench" }));
  shapes.push(A.cylinder(x, y, 13, 3, 4.4, { name: "stand.dial", owner: "bench" }));
  return { svg: out.join(""), shapes, centre: [x, y] };
}

const needleAt = (value) => {
  const angle = -Math.PI * 0.62 + (Math.min(value, 4) / 4) * Math.PI * 1.24;
  const x = RACK.x + RACK.w - 6;
  const y = RACK.y - 30;
  return k.lineOnTop([x - Math.sin(angle) * 4.4, y + Math.cos(angle) * 4.4], [x + Math.sin(angle) * 10.4, y - Math.cos(angle) * 10.4], 7.5, P);
};

// ------------------------------------------------------------------ the field
const world = new World();
world.place("threat", "Cone", HOME.x, HOME.y, 1);
world.process();

function rasterSvg() {
  const cells = [];
  for (let j = 0; j < CELLS; j++) {
    for (let i = 0; i < CELLS; i++) {
      const value = world.value("threat", TILE_X0 + i, TILE_Y0 + j);
      if (!value) continue;
      const alpha = (0.16 + 0.84 * Math.pow(Math.min(1, value / 90), 0.72)).toFixed(3);
      cells.push(`<rect x="${i + 0.07}" y="${j + 0.07}" width="0.86" height="0.86" style="fill:var(--anatomy-hi);opacity:${alpha}"/>`);
    }
  }
  return cells.join("");
}

// The well the field is published into: a dark bed with a tick every four cells.
function groundSvg() {
  const out = [`<rect x="0" y="0" width="${CELLS}" height="${CELLS}" style="fill:var(--anatomy-shade-0)"/>`];
  for (let i = 4; i < CELLS; i += 4) {
    out.push(`<path class="iso-line" data-tone="faint" d="M${i} 0 V${CELLS}"/>`);
    out.push(`<path class="iso-line" data-tone="faint" d="M0 ${i} H${CELLS}"/>`);
  }
  return out.join("");
}

// ------------------------------------------------------------------ the die in the head
// The loaded die: its shape, the ram that carries it and the collar that grips it.
// The ram runs a little into the arm, so no two faces share a plane.
function dieAssembly(kind, cx, cy, r, tone, lit) {
  const h = DIE_PROFILE[kind](r);
  const top = DIE_Z + h;
  const out = [];
  out.push(S(k.cylinder(cx, cy, 3.6, top - 3, Z_HEAD + 2 - top + 3, P, 24), { tone: "mid", crease: "none" }));
  out.push(S(diePaths(kind, cx, cy, DIE_Z, r), { tone, crease: lit ? "lo" : "faint", lit }));
  out.push(S(k.cylinder(cx, cy, 7.4, top - 4, 7, P, 28, 0.5), { tone: "mid" }));
  out.push(L(k.knurl(cx, cy, 7.4, top - 3.4, top + 2.6, 30, P), { tone: "lo" }));
  if (kind === "Box") {
    const plan = { x: cx - r, y: cy - r, w: r * 2, d: r * 2, r: 2 };
    out.push(L(k.planOutline(k.insetPlan(plan, 2.4), DIE_Z + r * 0.46, P), { tone: "faint" }));
  }
  if (kind === "Disk" || kind === "New") out.push(L(k.ring(cx, cy, r - 1.6, DIE_Z + r * 0.42, P, 44), { tone: "faint" }));
  if (kind === "Cone" || kind === "Tent") out.push(L(k.ring(cx, cy, r * 0.46, DIE_Z + 0.4, P, 28), { tone: "faint" }));
  if (kind === "Bell" || kind === "Dome") out.push(L(k.ring(cx, cy, r * 0.42, DIE_Z + 0.4, P, 28), { tone: "faint" }));
  return out.join("");
}

function dieAssemblyShapes(kind, cx, cy, r) {
  const h = DIE_PROFILE[kind](r);
  const top = DIE_Z + h;
  return [
    A.cylinder(cx, cy, 3.6, top - 3, Z_HEAD + 2 - top + 3, { name: "press.ram", owner: "press" }),
    dieShape(kind, cx, cy, DIE_Z, r, "press.die"),
    A.cylinder(cx, cy, 7.4, top - 4, 7, { name: "press.collar", owner: "press" }),
  ];
}

// ------------------------------------------------------------------ assemble
const basePart = base();
const legPart = railLeg();
const platePart = plate();
const bezelPart = bezel();
const pressPart = press();
const blockPart = saddleBlock();
const railPart = crossRail();
const headPart = head();
const scribePart = scribe();
const rackPart = rack();
const dialPart = dial();

const dieGroups = KINDS.map((kind) => {
  const r = KERNEL_PEAK[kind] * CELL;
  return `<g data-die="${kind}" style="display:none">${dieAssembly(kind, HOME_FIG.x, HOME_FIG.y, r, "hi", true)}</g>`;
}).join("");

put("base", "stand", [0, 0, 0], basePart.svg, basePart.shapes);
put("leg", "saddle", [RAIL_X0 + 8, RAIL_HOME_Y, Z_RAIL / 2], legPart.svg, legPart.shapes);
put("plate", "stand", [BED.x + BED.w / 2, BED.y + BED.d / 2, PLATE_BODY], platePart.svg, platePart.shapes);
put("field", "stand", [PLATE.x + PLATE.w / 2, PLATE.y + PLATE.d / 2, FIELD_TOP],
  `<g data-part="ground" transform="${cellMatrix}">${groundSvg()}</g><g data-part="raster" transform="${cellMatrix}">${rasterSvg()}</g>`,
  [A.slab(PLATE, PLATE_BODY, FIELD_TOP - PLATE_BODY, { name: "stand.field", owner: "bench" })]);
put("bezel", "stand", [BED.x + BED.w / 2, BED.y + BED.d / 2, PLATE_BODY + 3.4], bezelPart.svg, bezelPart.shapes);
put("rack", "stand", [RACK.x + RACK.w / 2, RACK.y + RACK.d / 2, 2.2], rackPart.svg, rackPart.shapes);
put("dial", "stand", [RACK.x + RACK.w - 6, RACK.y - 30, 3], dialPart.svg, dialPart.shapes);
put("scribe", "head", [HOME_FIG.x, HOME_FIG.y, FIELD_TOP],
  `<g data-part="scribe">${scribePart.svg}</g>`, scribePart.shapes);
put("die", "head", [HOME_FIG.x, HOME_FIG.y, DIE_Z],
  `<g data-part="die">${dieGroups}</g>`,
  dieAssemblyShapes("Cone", HOME_FIG.x, HOME_FIG.y, KERNEL_PEAK.Cone * CELL));
put("press", "stand", [COLUMN[0], (BEAM_Y0 + BEAM_Y1) / 2, Z_BEAM + 2], pressPart.svg, pressPart.shapes);
put("block", "saddle", [COLUMN[0], RAIL_HOME_Y, Z_BLOCK], blockPart.svg, blockPart.shapes);
put("rail", "saddle", [RAIL_X0, RAIL_HOME_Y, Z_RAIL], railPart.svg, railPart.shapes);
put("head", "head", [HOME_FIG.x, HOME_FIG.y - ARM, Z_HEAD], headPart.svg, headPart.shapes);

for (const item of items) {
  R.put({
    at: item.at,
    bias: item.bias,
    piece: item.piece,
    name: item.name,
    svg: `<g data-part="${item.name}">${item.svg}</g>`,
    shapes: item.shapes.map((shape) => R.solid(shape)),
  });
}
A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);

const bodySvg = R.items.map((item) => item.svg).join("") +
  `<path data-part="needle" class="iso-line" data-tone="hi" d="${needleAt(0)}" style="stroke-width:1.1"/>`;

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A bench press that stamps a shaped die into a tiled field plate. The die is the kernel: a cone leaves a round patch of graded cells, a pyramid a square one. The plate shows one 32 by 32 tile of the field, and the numbers in it are the library's own.",
  body: [bodySvg],
});

const card = k.plateHtml({
  fig: "Fig 1",
  title: "The field bench",
  hint: "Hover the tile to move the die",
  readout: "threat · cone · peak 90 · 1 tile republished",
  keys: [
    { mark: "lit", label: "The loaded die: the kernel it stamps, and where it stamps" },
    { mark: "raised", label: "One 32 x 32 tile: 1024 int16 cells, 2048 bytes" },
  ],
  caption:
    "A bench press that stamps a shaped die into a tiled field plate. The die's profile is the kernel it deposits: a cone leaves a round graded patch, a pyramid a square one. Move the die and the field does not change until the press cycles, because a source is only a column and a mark on a changed list. When it does cycle, the old footprint is lifted exactly and the new one pressed, and only the tiles the die touched are republished.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Field bench: move the die over the plate" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50">${svg}</div>`,
});

const live = `
const P = ${JSON.stringify(P)};
const PLATE = ${JSON.stringify(PLATE)};
const CELLS = ${CELLS};
const CELLU = ${CELL};
const FIELD_TOP = ${FIELD_TOP};
const DIE_Z = ${DIE_Z};
const ARM = ${ARM};
const HOME = ${JSON.stringify(HOME)};
const TILE_X0 = ${TILE_X0};
const TILE_Y0 = ${TILE_Y0};
const PEAKVALUE = 90;
${readFileSync(join(HERE, "model", "model.mjs"), "utf8").replace(/^export /gm, "").replace(/^import .*$/gm, "")}
${readFileSync(join(HERE, "model", "field.mjs"), "utf8").replace(/^export /gm, "").replace(/^import .*$/gm, "")}

const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const raster = svg.querySelector('[data-part="raster"]');
const block = svg.querySelector('[data-part="block"]');
const rail = svg.querySelector('[data-part="rail"]');
const leg = svg.querySelector('[data-part="leg"]');
const head = svg.querySelector('[data-part="head"]');
const die = svg.querySelector('[data-part="die"]');
const scribe = svg.querySelector('[data-part="scribe"]');
const needle = svg.querySelector('[data-part="needle"]');
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const DIAL = ${JSON.stringify([RACK.x + RACK.w - 6, RACK.y - 30])};
const needleAt = (value) => {
  const angle = -Math.PI * 0.62 + (Math.min(value, 4) / 4) * Math.PI * 1.24;
  return lineOnTop([DIAL[0] - Math.sin(angle) * 4.4, DIAL[1] + Math.cos(angle) * 4.4], [DIAL[0] + Math.sin(angle) * 10.4, DIAL[1] - Math.cos(angle) * 10.4], 7.5, P);
};

const world = new World();
const sourceId = world.place("threat", "Cone", HOME.x, HOME.y, 1);
// The first press really does publish: read its tile count, so the opening
// readout and the dial start where the field actually is, not at zero.
const first = world.process();

let kind = "Cone";
let pos = { x: HOME.x, y: HOME.y };
let target = { x: HOME.x, y: HOME.y };
let published = first.tiles;
let needleValue = first.tiles;
let needleTarget = first.tiles;
// The state of the source at the last press, so an idle bench stays idle.
let pressed = { kind: "Cone", x: HOME.x, y: HOME.y };
let clock = 0, lastCycle = 0;

function drawRaster() {
  const cells = [];
  for (let j = 0; j < CELLS; j++) {
    for (let i = 0; i < CELLS; i++) {
      const value = world.value("threat", TILE_X0 + i, TILE_Y0 + j);
      if (!value) continue;
      const alpha = (0.16 + 0.84 * Math.pow(Math.min(1, value / PEAKVALUE), 0.72)).toFixed(3);
      cells.push('<rect x="' + (i + 0.07) + '" y="' + (j + 0.07) + '" width="0.86" height="0.86" style="fill:var(--anatomy-hi);opacity:' + alpha + '"/>');
    }
  }
  raster.innerHTML = cells.join("");
}

function showKind(next) {
  kind = next;
  // The die IS the kernel: swapping it changes what the source deposits, so the
  // next press lifts the old profile and stamps this one.
  world.setKind(sourceId, next);
  die.querySelectorAll("[data-die]").forEach((node) => {
    node.style.display = node.getAttribute("data-die") === kind ? "" : "none";
  });
}

function place() {
  const fx = PLATE.x + (pos.x - TILE_X0) * CELLU;
  const fy = PLATE.y + (pos.y - TILE_Y0) * CELLU;
  const home = PLATE.x + (HOME.x - TILE_X0) * CELLU;
  const homeY = PLATE.y + (HOME.y - TILE_Y0) * CELLU;
  const along = translateAlong(P, [0, fy - homeY, 0]);
  block.setAttribute("transform", along);
  rail.setAttribute("transform", along);
  leg.setAttribute("transform", along);
  const d = translateAlong(P, [fx - home, fy - homeY, 0]);
  head.setAttribute("transform", d);
  die.setAttribute("transform", d);
  scribe.setAttribute("transform", d);
}

function say() {
  let peak = 0;
  for (let j = -7; j <= 7; j++) for (let i = -7; i <= 7; i++) {
    const v = world.value("threat", Math.floor(pos.x) + i, Math.floor(pos.y) + j);
    if (v > peak) peak = v;
  }
  const text = "threat \\u00b7 " + kind.toLowerCase() + " \\u00b7 peak " + peak + " \\u00b7 " + published + (published === 1 ? " tile" : " tiles") + " republished";
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuetext", text);
}

function cycle() {
  const result = world.process();
  published = result.tiles;
  needleTarget = published;
  drawRaster();
  say();
}

function steer(nx, ny) {
  target = {
    x: clamp(nx, TILE_X0 + 2, TILE_X0 + CELLS - 2),
    y: clamp(ny, TILE_Y0 + 2, TILE_Y0 + CELLS - 2),
  };
}

let frame = 0, last = 0, visible = false;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  pos.x = calm ? target.x : pos.x + (target.x - pos.x) * (1 - Math.exp(-dt / 0.22));
  pos.y = calm ? target.y : pos.y + (target.y - pos.y) * (1 - Math.exp(-dt / 0.22));
  if (Math.abs(target.x - pos.x) < 0.01) pos.x = target.x;
  if (Math.abs(target.y - pos.y) < 0.01) pos.y = target.y;
  place();
  clock += dt;
  if (clock - lastCycle > 1.1) {
    lastCycle = clock;
    // A press only happens when the source actually changed. Process on an
    // unchanged source republishes nothing, so there is nothing to press and
    // the dial keeps reading the last press that did work.
    const moved = Math.abs(pos.x - pressed.x) > 0.005 || Math.abs(pos.y - pressed.y) > 0.005;
    if (moved || kind !== pressed.kind) {
      world.move(sourceId, pos.x, pos.y);
      world.setKind(sourceId, kind);
      pressed = { kind, x: pos.x, y: pos.y };
      cycle();
    } else say();
  } else say();
  needleValue = calm ? needleTarget : needleValue + (needleTarget - needleValue) * (1 - Math.exp(-dt / 0.12));
  needle.setAttribute("d", needleAt(needleValue));
  frame = visible ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);

const cu = iso([PLATE.x + CELLU, PLATE.y, FIELD_TOP], P);
const cv = iso([PLATE.x, PLATE.y + CELLU, FIELD_TOP], P);
const ca = iso([PLATE.x, PLATE.y, FIELD_TOP], P);
const det = (cu[0] - ca[0]) * (cv[1] - ca[1]) - (cv[0] - ca[0]) * (cu[1] - ca[1]);
stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  const px = (event.clientX - box.left) / box.width * ${WIDTH};
  const py = (event.clientY - box.top) / box.height * ${HEIGHT};
  const dx = px - ca[0], dy = py - ca[1];
  const gx = (dx * (cv[1] - ca[1]) - dy * (cv[0] - ca[0])) / det;
  const gy = ((cu[0] - ca[0]) * dy - (cu[1] - ca[1]) * dx) / det;
  // Only the plate steers the die. Off the plate the die holds its place, so
  // reaching for a die in the rack swaps the kernel without moving the stamp.
  if (gx < 0 || gx > CELLS || gy < 0 || gy > CELLS) return;
  steer(TILE_X0 + gx, TILE_Y0 + gy);
});
stage.addEventListener("pointerleave", () => steer(target.x, target.y));
stage.addEventListener("keydown", (event) => {
  const step = event.shiftKey ? 8 : 2;
  if (event.key === "ArrowRight") steer(target.x + step, target.y);
  else if (event.key === "ArrowLeft") steer(target.x - step, target.y);
  else if (event.key === "ArrowUp") steer(target.x, target.y - step);
  else if (event.key === "ArrowDown") steer(target.x, target.y + step);
  else return;
  event.preventDefault();
});
svg.querySelectorAll("[data-part^='die-']").forEach((node) => {
  node.addEventListener("click", () => showKind(node.getAttribute("data-die")));
});
place();
showKind("Cone");
drawRaster();
say();
`;

const NOTES = `
<div class="notes">
  <h2>What the figure shows</h2>
  <ul>
    <li>The <strong>die</strong> is a source: a position, a kernel, a gain. Moving it writes a column and marks the slot — it touches no tile.</li>
    <li>The <strong>press</strong> is <code>World.Process</code>. It compares each marked source against the 16-byte record of what it last deposited, and where they differ it adds the negated old taps and the new taps.</li>
    <li>The <strong>bright patch</strong> is the deposited field: a cone kernel sampled at cell centres, peaking at <span class="mono">value · gain = 90</span>.</li>
    <li>The <strong>dial</strong> reads how many tiles that press republished. It is 1 while the die stays inside one tile, and 2 when the footprint crosses a tile edge — the old tile is dirtied by the lift as well.</li>
  </ul>
  <p class="source">Numbers are produced by the library's own semantics, reimplemented in <code>build/model/field.mjs</code> and asserted against the kernel dumps in Gi's README. The kernel math in <code>build/model/model.mjs</code> is bit-exact against those dumps.</p>
</div>`;

const page = (theme) =>
  sitePage({
    title: "Fig 1 · The field bench",
    description: "Anatomy of Gi: the change-rate deposit cycle, as a press that stamps a kernel into one tile of the field.",
    theme,
    active: "bench",
    base: "../",
    body: `
<div class="lede">
  <p class="kicker">Fig 1 · the change-rate deposit cycle</p>
  <h1>The field bench</h1>
  <p>Gi never redraws the world. It redraws the tiles that changed. A source is a column and a mark on a changed list; the press cycle is the only moment the field moves.</p>
</div>
${card}
${NOTES}
`,
    script: kitScript() + live,
  });

for (const theme of ["dark", "light"]) {
  writeFileSync(join(HERE, "..", "site", "figures", `field-bench${theme === "light" ? "-light" : ""}.html`), page(theme));
}
A.auditOrExit(R, P, { crowd: [] });
console.log("wrote site/figures/field-bench.html (+ light)");
export { R, P };
