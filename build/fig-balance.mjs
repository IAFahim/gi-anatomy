// Fig 4 - The balance.
//
// Gi's derived layers. A derived layer is an ordinary layer handle whose
// cells always equal a formula over other layers. The README's own example:
//
//   byte safety = Layer.Sum(world, food, 1, threat, -2);   // food - 2 * threat
//
// The rig weighs the two channels against each other. The food channel sits
// in the left pan as a dome of standing cells; the threat channel sits in the
// right pan as a cone of standing cells twice as tall, because the formula
// counts the threat twice. The derived page stands beside them with the
// difference engraved cell by cell, and a lit peg stands in its best cell.
//
// Every number in the drawing comes from build/model/derive.mjs, which runs
// the same World.process() the other figures run.
import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import * as A from "../kit/audit.mjs";
import { kitScript } from "../tools/inline-kit.mjs";
import { sitePage } from "./site.mjs";
import { build, loads, tiltOf, THREAT_WEIGHT } from "./model/derive.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const WIDTH = 960;
const HEIGHT = 486;

// ------------------------------------------------------------------ the model
const MODEL = build(THREAT_WEIGHT);
const LOAD = loads(MODEL);
const TILT = tiltOf(MODEL);
const PEAK = 90;               // the peak value of a stamp, in Gi's own units

// ------------------------------------------------------------------ the bench
const BASE = { x: -152, y: -86, w: 322, d: 178, r: 14 };
const BASE_H = 13;

// ------------------------------------------------------------------ the balance
const PIVOT = { x: -58, y: -42, z: 78 };
const ARM = 62;                // the beam's half length
const CORD = 30;               // the length of the cords a pan hangs on
const PAN_H = 5;               // the depth of a pan
const PAN_FLOOR = 3;           // the thickness of a pan's floor
const PAN_SPAN = 52;           // a pan is 52 units across
const TILE = 32;
const CELLU = 3;
const SPAN = TILE * CELLU;     // a tile is 96 units across
const LOAD_R = 18;             // a channel's footprint: six cells across
const LOAD_H = 13;             // the height of the food dome
const BEAM_R = 2.8;             // the radius of the beam
const COLLAR_R = 3.6;           // the radius of the boss the cords hang from
const COLLAR_L = 2;             // its length along the beam
const CORD_R = 0.9;             // the radius of a cord
const CORD_DOWN = 5.4;          // how far below the beam a cord leaves the boss

// The beam leans by the ratio of the two loads: the threat side goes down
// when it is the heavier one.
const CT = Math.cos(TILT);
const ST = Math.sin(TILT);
const END = {
  food: [PIVOT.x - ARM * CT, PIVOT.y, PIVOT.z + ARM * ST],
  threat: [PIVOT.x + ARM * CT, PIVOT.y, PIVOT.z - ARM * ST],
};
const RIM = { food: END.food[2] - CORD, threat: END.threat[2] - CORD };
const FLOOR = { food: RIM.food - PAN_H, threat: RIM.threat - PAN_H };
const PLAN = {
  food: { x: END.food[0] - PAN_SPAN / 2, y: PIVOT.y - PAN_SPAN / 2, w: PAN_SPAN, d: PAN_SPAN, r: 3 },
  threat: { x: END.threat[0] - PAN_SPAN / 2, y: PIVOT.y - PAN_SPAN / 2, w: PAN_SPAN, d: PAN_SPAN, r: 3 },
};

// ------------------------------------------------------------------ the page
const PAGE = { x: 58, y: -6, w: SPAN, d: SPAN, r: 3 };
const PAGE_T = 5;
const PAGE_BASE = 20;

// The calibration weights that live on the bench beside the balance.
const WEIGHTS = { x: -140, y: 26, w: 84, d: 14, r: 2 };

const P = k.fitProjection(
  [
    ...k.boxCorners(BASE, -BASE_H - 6, 0),
    ...k.boxCorners(PAGE, 0, PAGE_BASE + PAGE_T),
    [END.food[0], PIVOT.y, END.food[2]],
    [END.threat[0], PIVOT.y, END.threat[2]],
    ...k.boxCorners(PLAN.food, FLOOR.food - PAN_FLOOR, RIM.food),
    ...k.boxCorners(PLAN.threat, FLOOR.threat - PAN_FLOOR, RIM.threat),
    [PIVOT.x, PIVOT.y, PIVOT.z + 12],
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

const R = A.recorder(P, { order: [], spring: {} });
const items = [];
const put = (name, piece, at, svg, shapes, bias = 0) => {
  items.push({ name, piece, at, svg, shapes, bias });
};

// A rod between two points, drawn by the kit's lathe so it shades round.
function rod(from, to, r, tone, name, owner = "rig", steps = 14) {
  const dir = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  const length = Math.hypot(dir[0], dir[1], dir[2]);
  const F = G.frameAlong(from, dir);
  const profile = [[0, r], [length, r]];
  return {
    svg: S(G.solidOf(profile, F, P, { steps }), { tone }),
    shape: A.solid(F, profile, { name, owner }),
  };
}

// ------------------------------------------------------------------ the bench
function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BASE, -BASE_H - 6, BASE_H, P)}"/>`];
  const shapes = [A.slab(BASE, -BASE_H, BASE_H, { name: "stand.base", ground: true, owner: "rig" })];
  for (const [x, y] of byDepth(k.corners(BASE, 26))) {
    out.push(S(k.cylinder(x, y, 7.5, -BASE_H - 6, 1.8, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.6, -BASE_H - 4.2, 4.2, P, 28), { tone: "mid" }));
    shapes.push(A.cylinder(x, y, 5.6, -BASE_H - 4.2, 4.2, { name: "stand.foot", owner: "rig" }));
  }
  out.push(S(k.slabOf(BASE, -BASE_H, BASE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(BASE, 6), 0, P), { tone: "lo" }));
  const screws = k.corners(BASE, 12);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  for (const [x, y] of screws) shapes.push(A.cylinder(x, y, 2.2, 0, 0.4, { name: "stand.screw", owner: "rig" }));

  // The ruler along the front edge.
  const strip = { x: -56, y: BASE.y + BASE.d - 16, w: 106, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.7, P, 3), { tone: "lo", crease: "none" }));
  shapes.push(A.slab(strip, 0, 0.7, { name: "stand.ruler", owner: "rig" }));
  const ticks = k.topTicks(strip.x + 5, strip.x + strip.w - 5, 5, 4, strip.y + 0.9, 0.7, [2, 3.8], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 3, strip.y + 3.5, 0.7]), at([strip.x + strip.w - 3, strip.y + 3.5, 0.7])], { size: 0.45 }));

  // The calibration weights, each with its lifting knob.
  const set = [10, 7.6, 5.6, 4];
  let wx = WEIGHTS.x + 9;
  for (const r of set) {
    out.push(S(k.cylinder(wx, WEIGHTS.y + 7, r, 0, 5.6, P, 26), { tone: "mid" }));
    shapes.push(A.cylinder(wx, WEIGHTS.y + 7, r, 0, 5.6, { name: "stand.weight", owner: "rig" }));
    out.push(S(k.cylinder(wx, WEIGHTS.y + 7, r * 0.42, 5.6, 2.4, P, 18), { tone: "lo" }));
    shapes.push(A.cylinder(wx, WEIGHTS.y + 7, r * 0.42, 5.6, 2.4, { name: "stand.weightknob", owner: "rig" }));
    wx += r * 2 + 7;
  }
  return { svg: out.join(""), shapes };
}

// ------------------------------------------------------------------ the balance
// The pillar, the fulcrum and the beam.
function balance() {
  const out = [];
  const shapes = [];
  const { x, y, z } = PIVOT;

  // The footing.
  out.push(S(k.cylinder(x, y, 27, 0, 7, P, 36), { tone: "lo" }));
  shapes.push(A.cylinder(x, y, 27, 0, 7, { name: "stand.footing", owner: "rig" }));
  out.push(S(k.cylinder(x, y, 13, 7, 6, P, 30), { tone: "mid" }));
  shapes.push(A.cylinder(x, y, 13, 7, 6, { name: "stand.collar", owner: "rig" }));

  // The shaft, in three turned sections.
  out.push(S(k.cylinder(x, y, 7.6, 13, 8, P, 28), { tone: "mid" }));
  shapes.push(A.cylinder(x, y, 7.6, 13, 8, { name: "stand.shaftfoot", owner: "rig" }));
  out.push(S(k.cylinder(x, y, 6.2, 21, 34, P, 28), { tone: "mid" }));
  shapes.push(A.cylinder(x, y, 6.2, 21, 34, { name: "stand.shaft", owner: "rig" }));
  out.push(S(k.cylinder(x, y, 8.4, 55, 6, P, 28), { tone: "mid" }));
  shapes.push(A.cylinder(x, y, 8.4, 55, 6, { name: "stand.shaftcap", owner: "rig" }));

  // The capital the fulcrum stands on.
  out.push(S(k.cylinder(x, y, 12, 61, 7, P, 30), { tone: "mid" }));
  shapes.push(A.cylinder(x, y, 12, 61, 7, { name: "stand.capital", owner: "rig" }));
  out.push(S(k.cylinder(x, y, 9, 68, 5.4, P, 26), { tone: "lo" }));
  shapes.push(A.cylinder(x, y, 9, 68, 5.4, { name: "stand.crest", owner: "rig" }));

  // The zero adjuster: a knurled drum on a stub at the shaft's side.
  const knobX = x + 13;
  out.push(S(k.cylinder(knobX, y, 2.2, 24, 2.2, P, 16), { tone: "lo" }));
  shapes.push(A.cylinder(knobX, y, 2.2, 24, 2.2, { name: "stand.knobstub", owner: "rig" }));
  out.push(S(k.cylinder(knobX, y, 6.4, 26.2, 7.4, P, 30), { tone: "mid" }));
  shapes.push(A.cylinder(knobX, y, 6.4, 26.2, 7.4, { name: "stand.knob", owner: "rig" }));
  out.push(L(k.knurl(knobX, y, 6.4, 26.2, 33.6, 18, P), { tone: "lo" }));
  out.push(S(k.cylinder(knobX, y, 2.2, 33.6, 1.4, P, 16), { tone: "lo" }));
  shapes.push(A.cylinder(knobX, y, 2.2, 33.6, 1.4, { name: "stand.knobcap", owner: "rig" }));

  // The beam: a round rod through the fulcrum, leaning by the tilt.
  const axis = [CT, 0, -ST];
  const u = [0, 1, 0];
  const v = [ST, 0, CT];
  const F = G.frameOf([END.food[0], PIVOT.y, END.food[2]], axis, u, v);
  const length = 2 * ARM;
  out.push(S(G.solidOf([[0, BEAM_R], [length, BEAM_R]], F, P, { steps: 26 }), { tone: "mid" }));
  shapes.push(A.solid(F, [[0, BEAM_R], [length, BEAM_R]], { name: "rig.beam", owner: "rig" }));

  // The collars the cords hang from. Each one is socketed onto the end of
  // the beam and runs outwards, so a cord that leaves it is always nearer
  // the reader than the beam it hangs from.
  for (const side of ["food", "threat"]) {
    const end = END[side];
    const dir = side === "food" ? [-axis[0], 0, -axis[2]] : [axis[0], 0, axis[2]];
    const collarF = G.frameOf([end[0], PIVOT.y, end[2]], dir, u, v);
    out.push(S(G.solidOf([[0, 3.6], [3, 3.6]], collarF, P, { steps: 20 }), { tone: "lo" }));
    shapes.push(A.solid(collarF, [[0, COLLAR_R], [COLLAR_L, COLLAR_R]], { name: `rig.collar.${side}`, owner: "rig" }));
  }

  // The boss the beam turns on.
  const bossF = G.frameAlong([x, y - 9, z], [0, 1, 0]);
  out.push(S(G.solidOf([[0, 5.6], [18, 5.6]], bossF, P, { steps: 22 }), { tone: "lo" }));
  shapes.push(A.solid(bossF, [[0, 5.6], [18, 5.6]], { name: "rig.boss", owner: "rig" }));
  out.push(S(k.cylinder(x, y + 9, 4.6, z - 5.6, 11.2, P, 22), { tone: "mid" }));
  shapes.push(A.cylinder(x, y + 9, 4.6, z - 5.6, 11.2, { name: "rig.bosscap", owner: "rig" }));

  return { svg: out.join(""), shapes };
}

// ------------------------------------------------------------------ a pan
// A shallow pan that hangs from the beam on four cords and carries one
// channel. It is drawn in two parts, so the load can sit between them: the
// floor and the far walls are behind the load, the near walls in front.
function panFloor(side) {
  const out = [];
  const shapes = [];
  const plan = PLAN[side];
  const floor = FLOOR[side];

  // The floor of the pan.
  out.push(S(k.slabOf(plan, floor - PAN_FLOOR, PAN_FLOOR, P, 4, 0.6), { tone: "lo" }));
  shapes.push(A.slab(plan, floor - PAN_FLOOR, PAN_FLOOR, { name: `stand.pan.${side}`, owner: "rig" }));

  // The two far walls.
  for (const bar of [
    { x: plan.x, y: plan.y, w: plan.w, d: 3.2, r: 1 },
    { x: plan.x, y: plan.y, w: 3.2, d: plan.d, r: 1 },
  ]) {
    out.push(S(k.slabOf(bar, floor, PAN_H, P, 3, 0.5), { tone: "lo" }));
    shapes.push(A.slab(bar, floor, PAN_H, { name: `stand.panwall.${side}.far`, owner: "rig" }));
  }
  return { svg: out.join(""), shapes };
}

// The near half of the pan: the two walls the reader sees past, the rim and
// the one mark in the drawing.
function panNear(side) {
  const out = [];
  const shapes = [];
  const plan = PLAN[side];
  const rim = RIM[side];
  const floor = FLOOR[side];

  // The two near walls.
  for (const bar of [
    { x: plan.x, y: plan.y + plan.d - 3.2, w: plan.w, d: 3.2, r: 1 },
    { x: plan.x + plan.w - 3.2, y: plan.y, w: 3.2, d: plan.d, r: 1 },
  ]) {
    out.push(S(k.slabOf(bar, floor, PAN_H, P, 3, 0.5), { tone: "lo" }));
    shapes.push(A.slab(bar, floor, PAN_H, { name: `stand.panwall.${side}.near`, owner: "rig" }));
  }
  // The rim's top edge.
  out.push(L(k.planOutline(k.insetPlan(plan, 0), rim, P), { tone: "lo" }));

  // A rule along the near rim, so the pan is not a bare face. It runs from
  // wall to wall, so both of its ends land on a wall's inner edge.
  out.push(L(k.lineOnTop([plan.x + 3.2, plan.y + plan.d - 1.6], [plan.x + PAN_SPAN - 3.2, plan.y + plan.d - 1.6], rim, P), { tone: "faint" }));

  // The one mark in the drawing: the threat side is counted twice.
  if (side === "threat") {
    out.push(k.faceTextSvg(
      k.sideMatrix([plan.x + 12, plan.y + PAN_SPAN], floor + 4, P, "left"),
      "\u00d72",
      { size: 5.5, tone: "hi" },
    ));
  }

  return { svg: out.join(""), shapes };
}

// The four cords a pan hangs on, from the beam's collar down to the corners
// of the rim. The far pair is drawn first: the near pair crosses it.
function panCords(side) {
  const out = [];
  const shapes = [];
  const end = END[side];
  const rim = RIM[side];
  // The cord leaves just clear of the collar, so the collar reads as the
  // eye the pan hangs from.
  const outward = side === "food" ? [-CT, 0, ST] : [CT, 0, -ST];
  const start = [end[0] + outward[0] * 1.5 - ST * CORD_DOWN, end[1], end[2] + outward[2] * 1.5 - CT * CORD_DOWN];
  for (const [dx, dy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const cx = end[0] + dx * (PAN_SPAN / 2 - 1.6);
    const cy = end[1] + dy * (PAN_SPAN / 2 - 1.6);
    // The cord is seated so that its surface just kisses the rim: the end of
    // the rod hangs a little above the rim, and the rod's own thickness
    // brings it down onto it.
    const run = Math.abs(cx - start[0]);
    const span = start[2] - rim;
    let lift = (CORD_R * run) / Math.hypot(run, span);
    for (let step = 0; step < 6; step++) lift = (CORD_R * run) / Math.hypot(run, span - lift);
    const corner = [cx, cy, rim + lift];
    const cord = rod(start, corner, CORD_R, "lo", `rig.cord.${side}.${dx}.${dy}`);
    out.push(cord.svg);
    shapes.push(cord.shape);
  }
  return { svg: out.join(""), shapes };
}

// ------------------------------------------------------------------ the load
// The channel a pan carries. The Dome kernel is a paraboloid and the Cone
// kernel a cone - roundAt() in model.mjs is exactly h = H(1 - r/R) for the
// cone and h = H(1 - r^2/R^2) for the dome - so the pans hold the shapes Gi
// actually stamps. The threat cone stands twice as tall, because the formula
// counts the threat twice.
function loadProfile(kind, h) {
  if (kind === "Cone") return [[0, LOAD_R], [h, 0]];
  const prof = [];
  for (let i = 0; i <= 9; i++) {
    const s = (h * i) / 9;
    prof.push([s, LOAD_R * Math.sqrt(Math.max(0, 1 - s / h)), 1]);
  }
  return prof;
}

function panLoad(side, kind, height, tone) {
  const out = [];
  const shapes = [];
  const F = G.frameAlong([END[side][0], PIVOT.y, FLOOR[side]], [0, 0, 1]);
  const prof = loadProfile(kind, height);
  out.push(S(G.solidOf(prof, F, P, { steps: 56 }), { tone, face: true }));
  shapes.push(A.solid(F, prof, { name: `stand.load.${side}`, owner: "rig" }));
  return { svg: out.join(""), shapes };
}

// ------------------------------------------------------------------ the page
// The derived layer: the difference, engraved cell by cell.
function pageTray() {
  const out = [];
  const shapes = [];
  const ped = { x: PAGE.x + 5, y: PAGE.y + 5, w: PAGE.w - 10, d: PAGE.d - 10, r: 3 };
  out.push(S(k.slabOf(ped, 0, PAGE_BASE, P, 6, 1.2), { tone: "lo" }));
  shapes.push(A.slab(ped, 0, PAGE_BASE, { name: "stand.pedestal", owner: "rig" }));
  for (const z of [4, PAGE_BASE / 2, PAGE_BASE - 4]) out.push(L(k.sideSeam(ped, z, P, 6), { tone: "faint" }));

  out.push(S(k.slabOf(PAGE, PAGE_BASE, PAGE_T, P, 6, 1), { tone: "mid" }));
  shapes.push(A.slab(PAGE, PAGE_BASE, PAGE_T, { name: "stand.page", owner: "rig" }));

  // The engraved grid of the tile.
  const top = PAGE_BASE + PAGE_T;
  const grid = [];
  for (let i = 0; i <= TILE; i++) {
    const gx = PAGE.x + i * CELLU;
    grid.push(k.lineOnTop([gx, PAGE.y], [gx, PAGE.y + SPAN], top, P));
    grid.push(k.lineOnTop([PAGE.x, PAGE.y + i * CELLU], [PAGE.x + SPAN, PAGE.y + i * CELLU], top, P));
  }
  out.push(L(grid.join(""), { tone: "lo" }));

  // The frame around the grid, and its screws.
  for (const bar of [
    { x: PAGE.x - 4, y: PAGE.y - 4, w: SPAN + 8, d: 4, r: 1 },
    { x: PAGE.x - 4, y: PAGE.y + SPAN, w: SPAN + 8, d: 4, r: 1 },
    { x: PAGE.x - 4, y: PAGE.y, w: 4, d: SPAN, r: 1 },
    { x: PAGE.x + SPAN, y: PAGE.y, w: 4, d: SPAN, r: 1 },
  ]) {
    out.push(S(k.slabOf(bar, top, 2.4, P, 3, 0.4), { tone: "lo" }));
    shapes.push(A.slab(bar, top, 2.4, { name: "stand.pageframe", owner: "rig" }));
  }
  const screws = k.corners(PAGE, 9);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 1.7, top + 2.4, P, 14)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, top + 2.4])), { size: 0.45 }));
  for (const [x, y] of screws) shapes.push(A.cylinder(x, y, 1.7, top, 2.4, { name: "stand.pagescrew", owner: "rig" }));

  return { svg: out.join(""), shapes };
}

// ------------------------------------------------------------------ the peg
// The one lit thing in the drawing: the cell of the derived layer that holds
// its maximum, which is where QueryMax lands.
const BEST = MODEL.best;
const PEG = {
  x: PAGE.x + (BEST.i + 0.5) * CELLU,
  y: PAGE.y + (BEST.j + 0.5) * CELLU,
  z: PAGE_BASE + PAGE_T,
  r: 2.1,
  h: 9.4,
};

function peg() {
  const out = [];
  const shapes = [];
  out.push(S(k.cylinder(PEG.x, PEG.y, PEG.r, PEG.z, PEG.h, P, 24), { tone: "hi", lit: true, crease: "lo" }));
  shapes.push(A.cylinder(PEG.x, PEG.y, PEG.r, PEG.z, PEG.h, { name: "rig.peg", owner: "rig" }));
  return { svg: out.join(""), shapes };
}

// ------------------------------------------------------------------ the scene
const basePart = base();
const balancePart = balance();
const foodPanFloor = panFloor("food");
const foodCords = panCords("food");
const foodLoad = panLoad("food", "Dome", LOAD_H, "hi");
const foodPanNear = panNear("food");
const threatPanFloor = panFloor("threat");
const threatCords = panCords("threat");
const threatLoad = panLoad("threat", "Cone", LOAD_H * THREAT_WEIGHT, "mid");
const threatPanNear = panNear("threat");
const pagePart = pageTray();
const pegPart = peg();

put("base", "rig", [BASE.x + BASE.w / 2, BASE.y + BASE.d / 2, 0], basePart.svg, basePart.shapes);
put("balance", "rig", [PIVOT.x, PIVOT.y, PIVOT.z], balancePart.svg, balancePart.shapes);
put("cords-food", "rig", [END.food[0], PIVOT.y, RIM.food - 20], foodCords.svg, foodCords.shapes);
put("pan-food", "rig", [END.food[0], PIVOT.y, FLOOR.food], foodPanFloor.svg, foodPanFloor.shapes);
put("load-food", "rig", [END.food[0], PIVOT.y, FLOOR.food], foodLoad.svg, foodLoad.shapes);
put("panfood-food", "rig", [END.food[0], PIVOT.y, RIM.food], foodPanNear.svg, foodPanNear.shapes);
put("cords-threat", "rig", [END.threat[0], PIVOT.y, RIM.threat - 20], threatCords.svg, threatCords.shapes);
put("pan-threat", "rig", [END.threat[0], PIVOT.y, FLOOR.threat], threatPanFloor.svg, threatPanFloor.shapes);
put("load-threat", "rig", [END.threat[0], PIVOT.y, FLOOR.threat], threatLoad.svg, threatLoad.shapes);
put("panwall-threat", "rig", [END.threat[0], PIVOT.y, RIM.threat], threatPanNear.svg, threatPanNear.shapes);
put("page", "rig", [PAGE.x + PAGE.w / 2, PAGE.y + PAGE.d / 2, PAGE_BASE + PAGE_T], pagePart.svg, pagePart.shapes);
put("peg", "rig", [PEG.x, PEG.y, PEG.z], `<g data-part="peg">${pegPart.svg}</g>`, pegPart.shapes);

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

// The page's cells, filled by the page.
const cellMatrix = (() => {
  const o = at([PAGE.x, PAGE.y, PAGE_BASE + PAGE_T]);
  const u = at([PAGE.x + CELLU, PAGE.y, PAGE_BASE + PAGE_T]);
  const v = at([PAGE.x, PAGE.y + CELLU, PAGE_BASE + PAGE_T]);
  return `matrix(${(u[0] - o[0]).toFixed(4)} ${(u[1] - o[1]).toFixed(4)} ${(v[0] - o[0]).toFixed(4)} ${(v[1] - o[1]).toFixed(4)} ${o[0].toFixed(3)} ${o[1].toFixed(3)})`;
})();

const bodySvg =
  R.items.map((item) => item.svg).join("") +
  `<g data-part="pagecells" transform="${cellMatrix}"></g>`;

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A beam balance with a pan on each arm. The left pan carries the food channel, the paraboloid a Dome kernel stamps; the right pan carries the threat channel, a cone twice as tall because the formula counts the threat twice. The beam leans by the ratio of the two loads, and the derived page beside it carries the difference engraved cell by cell, with a lit peg in the cell that holds the maximum.",
  body: [bodySvg],
});

// ------------------------------------------------------------------ the live page
const live = `
const P = ${JSON.stringify(P)};
const PAGE = ${JSON.stringify(PAGE)};
const TILE_CELLS = ${TILE};
const CELLU = ${CELLU};
const PAGE_TOP = ${PAGE_BASE + PAGE_T};
const PEG_HOME = ${JSON.stringify(PEG)};
${readFileSync(join(HERE, "model", "model.mjs"), "utf8").replace(/^export /gm, "").replace(/^import .*$/gm, "")}
${readFileSync(join(HERE, "model", "field.mjs"), "utf8").replace(/^export /gm, "").replace(/^import .*$/gm, "")}
${readFileSync(join(HERE, "model", "derive.mjs"), "utf8").replace(/^export /gm, "").replace(/^import .*$/gm, "")}

const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const cells = svg.querySelector('[data-part="pagecells"]');
const peg = svg.querySelector('[data-part="peg"]');

const model = build(2);
const SAFETY = model.safety;
const PEAK = 90;

// The derived page, drawn cell by cell. A cell that is safe stands proud in
// the light tone; a cell the threat owns is cut into the dark one.
function drawCells(upto) {
  const out = [];
  let index = 0;
  for (let j = 0; j < TILE_CELLS; j++) {
    for (let i = 0; i < TILE_CELLS; i++) {
      const value = SAFETY.get(i + "," + j);
      if (value === undefined) continue;
      if (index++ > upto) continue;
      if (value > 0) {
        const alpha = (0.34 + 0.66 * Math.pow(value / PEAK, 0.7)).toFixed(3);
        out.push('<rect x="' + (i + 0.03) + '" y="' + (j + 0.03) + '" width="0.94" height="0.94" style="fill:var(--anatomy-hi);opacity:' + alpha + '"/>');
      } else {
        const alpha = (0.42 + 0.58 * Math.pow(-value / (PEAK * 2), 0.7)).toFixed(3);
        out.push('<rect x="' + (i + 0.03) + '" y="' + (j + 0.03) + '" width="0.94" height="0.94" style="fill:var(--anatomy-mid);opacity:' + alpha + '"/>');
      }
    }
  }
  cells.innerHTML = out.join("");
}

const TEXT = "food " + model.foodSum + " \\u00b7 threat " + model.threatSum + " \\u00b7 safety " + model.sum + " \\u00b7 best " + model.best.value + " at (" + model.best.i + "," + model.best.j + ")";

// The recombination pass: one sweep over the 1 024 cells of the tile, then
// the peg drops into the cell that holds the maximum.
let shown = -1;
let sweep = 0;
let clock = 0;
let last = 0;
let visible = false;
let frame = 0;
const HOLD = 2.6;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  const cycle = 1.9 + HOLD;
  const phase = clock % cycle;
  const progress = phase < 1.9 ? phase / 1.9 : 1;
  const upto = Math.round(progress * (SAFETY.size - 1));
  if (upto !== shown) {
    shown = upto;
    drawCells(upto);
    // The peg hovers over its cell while the page is being filled and drops
    // into it when the sweep finishes. It is never hidden: it is the answer.
    const drop = progress < 1 ? 1 : 0;
    peg.setAttribute("transform", translateAlong(P, [0, 0, drop * 7]));
    peg.setAttribute("opacity", "1");
  }
  frame = visible ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);

// Hovering the page reads the cell under the pointer.
stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  const px = (event.clientX - box.left) / box.width * ${WIDTH};
  const py = (event.clientY - box.top) / box.height * ${HEIGHT};
  const origin = iso([PAGE.x, PAGE.y, PAGE_TOP], P);
  const u = iso([PAGE.x + PAGE.w, PAGE.y, PAGE_TOP], P);
  const v = iso([PAGE.x, PAGE.y + PAGE.d, PAGE_TOP], P);
  const dx = px - origin[0], dy = py - origin[1];
  const det = (u[0] - origin[0]) * (v[1] - origin[1]) - (v[0] - origin[0]) * (u[1] - origin[1]);
  if (!det) return;
  const gx = (dx * (v[1] - origin[1]) - dy * (v[0] - origin[0])) / det;
  const gy = ((u[0] - origin[0]) * dy - (u[1] - origin[1]) * dx) / det;
  if (gx < 0 || gx > 1 || gy < 0 || gy > 1) return;
  const i = Math.min(TILE_CELLS - 1, Math.max(0, Math.floor(gx * TILE_CELLS)));
  const j = Math.min(TILE_CELLS - 1, Math.max(0, Math.floor(gy * TILE_CELLS)));
  const cell = model.safety.get(i + "," + j) || 0;
  const food = model.food.get(i + "," + j) || 0;
  const threat = model.threat.get(i + "," + j) || 0;
  const text = "cell (" + i + "," + j + ") \\u00b7 food " + food + " \\u00b7 threat " + threat + " \\u00b7 safety " + cell;
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuetext", text);
});

drawCells(SAFETY.size - 1);
readout.textContent = TEXT;
stage.setAttribute("aria-valuetext", TEXT);
`;

const card = k.plateHtml({
  fig: "Fig 4",
  title: "The balance",
  hint: "Hover the derived page to read a cell",
  readout: "food 5058 · threat 3398 · safety −1738 · best 90 at (9,9)",
  keys: [
    { mark: "lit", label: "The peg: the cell of the derived layer that holds its maximum" },
    { mark: "raised", label: "One channel in each pan: the food dome and the threat cone" },
  ],
  caption:
    "A derived layer is an ordinary layer whose cells always equal a formula over other layers: food minus twice the threat. The two channels are weighed against each other - the threat side carries its cone twice over, because the formula counts it twice - and the beam leans by the ratio of the two loads. The page beside them carries the difference cell by cell: 199 of the 1 024 cells are not zero, and every query that works on a deposited layer works on this one too, maximum included.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="The derived layer: the balance of the food channel against twice the threat channel" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50">${svg}</div>`,
});

const NOTES = `
<div class="notes">
  <h2>What the figure shows</h2>
  <ul>
    <li>The <strong>left pan</strong> carries the food channel: a <code>Dome</code> stamped at cell (9,9). The kernel is a paraboloid, <code>h = H(1 - r²/R²)</code>, so the pan holds exactly the shape Gi stamps.</li>
    <li>The <strong>right pan</strong> carries the threat channel: a <code>Cone</code> stamped at cell (15,15), <code>h = H(1 - r/R)</code>. It stands twice as tall, because <code>Layer.Sum(world, food, 1, threat, -2)</code> counts the threat twice.</li>
    <li>The <strong>beam</strong> leans by the ratio of the two loads: 5 058 of food against 6 796 of threat, so 8.3° toward the threat. That lean is the tile's net, −1 738.</li>
    <li>The <strong>page</strong> is the derived layer itself: the formula applied to each of the 1 024 cells. 199 of them are not zero - 97 safe, 102 owned by the threat - and the <strong>peg</strong> stands where the layer holds its maximum of 90.</li>
  </ul>
  <p class="source">The recipe, the weights and the saturation come from Gi's own <code>Layer.Sum</code> and <code>LayerRecombine</code>; the cells come from <code>build/model/derive.mjs</code>, which runs the same deposit and the same recombination Gi does.</p>
</div>`;

const page = (theme) =>
  sitePage({
    title: "Fig 4 · The balance",
    description: "Anatomy of Gi: how two channels combine into a derived layer, and how that layer is queried.",
    theme,
    active: "balance",
    base: "../",
    body: `
<div class="lede">
  <p class="kicker">Fig 4 · how channels combine</p>
  <h1>The balance</h1>
  <p>Food minus twice the threat. A derived layer is not a special kind of layer: it is an ordinary one whose cells always equal a formula over other layers, so it answers every query they answer.</p>
</div>
${card}
${NOTES}
`,
    script: kitScript() + live,
  });

for (const theme of ["dark", "light"]) {
  writeFileSync(join(HERE, "..", "site", "figures", `balance${theme === "light" ? "-light" : ""}.html`), page(theme));
}
A.auditOrExit(R, P, { crowd: [] });
console.log("wrote site/figures/balance.html (+ light)");
console.log(
  `food ${MODEL.foodSum} threat ${MODEL.threatSum} (x2 = ${LOAD.threat}) net ${LOAD.net} tilt ${(TILT * 180 / Math.PI).toFixed(2)}deg best ${BEST.i},${BEST.j} = ${BEST.value}`,
);
export { R, P };
