// Fig 2 — The pyramid.
//
// Gi's max pyramid: cells live in tiles, tiles under nodes, nodes under one
// root. Each level keeps only the maximum of what is below it, so a descent
// from the root to the best cell never has to look at the whole field.
//
// The rig shows the three levels as three engraved plates on pedestals. The
// root plate carries the 16 live node slots, the node plate the 64 tile slots
// of one node, and the tile plate the 1024 cells of one tile. A lit bead
// carries the running maximum down the plates.
import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import * as A from "../kit/audit.mjs";
import { kitScript } from "../tools/inline-kit.mjs";
import { sitePage } from "./site.mjs";
import { Field } from "./model/pyramid.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const WIDTH = 900;
const HEIGHT = 440;

// ------------------------------------------------------------------ the bench
const BASE = { x: -246, y: -88, w: 486, d: 188, r: 14 };
const BASE_H = 13;

// The three levels. Each plate is the same size: what changes is the density
// of the grid engraved on it, which is the level's fan-out.
const PLATE = 124;
const PLATE_T = 5;
const PLATE_Y = -62;
const DIAL = { x: 222, y: -12, r: 15 };
const DIAL_MAX = 450;
const STATIONS = [
  { id: "root", n: 4, x: -232, top: 67 },
  { id: "node", n: 8, x: -74, top: 38 },
  { id: "tile", n: 32, x: 84, top: 9 },
];
for (const station of STATIONS) {
  station.y = PLATE_Y;
  station.plan = { x: station.x, y: PLATE_Y, w: PLATE, d: PLATE, r: 2 };
  station.cx = station.x + PLATE / 2;
  station.cy = PLATE_Y + PLATE / 2;
  station.foot = station.top - PLATE_T;
}

const P = k.fitProjection(
  [
    ...k.boxCorners(BASE, -BASE_H - 6, 0),
    ...STATIONS.flatMap((level) => k.boxCorners(level.plan, level.foot, level.top)),
    [DIAL.x + DIAL.r, DIAL.y, DIAL.r],
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

// The recorder, the same one the bench uses.
const R = A.recorder(P, { order: [], spring: {} });
const items = [];
const put = (name, piece, at, svg, shapes, bias = 0) => {
  items.push({ name, piece, at, svg, shapes, bias });
};

// ------------------------------------------------------------------ the bench
function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BASE, -BASE_H - 6, BASE_H, P)}"/>`];
  const shapes = [A.slab(BASE, -BASE_H, BASE_H, { name: "rig.base", ground: true, owner: "rig" })];
  for (const [x, y] of byDepth(k.corners(BASE, 26))) {
    out.push(S(k.cylinder(x, y, 7.5, -BASE_H - 6, 1.8, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.6, -BASE_H - 4.2, 4.2, P, 28), { tone: "mid" }));
    shapes.push(A.cylinder(x, y, 5.6, -BASE_H - 4.2, 4.2, { name: "rig.foot", owner: "rig" }));
  }
  out.push(S(k.slabOf(BASE, -BASE_H, BASE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(BASE, 6), 0, P), { tone: "lo" }));
  const screws = k.corners(BASE, 12);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  for (const [x, y] of screws) shapes.push(A.cylinder(x, y, 2.2, 0, 0.4, { name: "rig.screw", owner: "rig" }));

  // The ruler along the front edge, and a label plate under each station.
  const strip = { x: -226, y: BASE.y + BASE.d - 15, w: 300, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.7, P, 3), { tone: "lo", crease: "none" }));
  shapes.push(A.slab(strip, 0, 0.7, { name: "rig.ruler", owner: "rig" }));
  const ticks = k.topTicks(strip.x + 5, strip.x + strip.w - 5, 5, 4, strip.y + 0.9, 0.7, [2, 3.8], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 3, strip.y + 3.5, 0.7]), at([strip.x + strip.w - 3, strip.y + 3.5, 0.7])], { size: 0.45 }));

  for (const level of STATIONS) {
    const label = { x: level.x + PLATE / 2 - 21, y: BASE.y + BASE.d - 32, w: 42, d: 9, r: 1.5 };
    out.push(S(k.slabOf(label, 0, 0.9, P, 3), { tone: "lo" }));
    out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.9, P), { tone: "faint" }));
    out.push(L(k.lineOnTop([label.x + 4, label.y + 3.4], [label.x + 30, label.y + 3.4], 0.9, P), { tone: "lo", free: true }));
    out.push(L(k.lineOnTop([label.x + 4, label.y + 6], [label.x + 22, label.y + 6], 0.9, P), { tone: "lo", free: true }));
    out.push(D([at([label.x + 36, label.y + 4.5, 0.9])], { size: 0.45 }));
    shapes.push(A.slab(label, 0, 0.9, { name: `rig.label.${level.id}`, owner: "rig" }));
  }
  return { svg: out.join(""), shapes };
}

// ------------------------------------------------------------------ the dial
// Reads the maximum the current branch will carry down.
function dial() {
  const out = [];
  const shapes = [];
  const { x, y, r } = DIAL;
  out.push(S(k.cylinder(x, y, r, 0, 3, P, 44, 0.6), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, r - 2, 3, 4.4, P, 44, 0.6), { tone: "hi", crease: "lo" }));
  out.push(L(k.ring(x, y, r - 4.6, 7.4, P, 40), { tone: "lo" }));
  const ticks = k.radialTicks(x, y, r - 4.6, 5, 1, 7.4, [1.2, 2.4], P, -Math.PI * 0.62, Math.PI * 1.24);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(L(k.ring(x, y, 1.5, 7.4, P, 14), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 4.4, 7.4, 1.4, P, 20), { tone: "mid" }));
  shapes.push(A.cylinder(x, y, r, 0, 3, { name: "rig.dialfoot", owner: "rig" }));
  shapes.push(A.cylinder(x, y, r - 2, 3, 4.4, { name: "rig.dial", owner: "rig" }));
  return { svg: out.join(""), shapes };
}

// The needle's angle for a value on the dial's scale.
const needleAt = (value) => {
  const angle = -Math.PI * 0.62 + (Math.min(value, DIAL_MAX) / DIAL_MAX) * Math.PI * 1.24;
  const { x, y, r } = DIAL;
  return k.lineOnTop([x - Math.sin(angle) * 4.4, y + Math.cos(angle) * 4.4], [x + Math.sin(angle) * (r - 4.6), y - Math.cos(angle) * (r - 4.6)], 7.5, P);
};

// ------------------------------------------------------------------ a station
// A pedestal carrying one level's plate, with the level's fan-out engraved
// on the plate's face.
function station(level) {
  const out = [];
  const shapes = [];
  const { plan, top, foot, n } = level;

  // The pedestal. The bench's top face is z = 0.
  out.push(S(k.slabOf(plan, 0, foot, P, 6, 1.2), { tone: "lo" }));
  shapes.push(A.slab(plan, 0, foot, { name: `rig.pedestal.${level.id}`, owner: "rig" }));
  for (const z of [4, foot / 2, foot - 4]) {
    out.push(L(k.sideSeam(plan, z, P, 6), { tone: "faint" }));
  }

  // The plate.
  out.push(S(k.slabOf(plan, foot, PLATE_T, P, 6, 1), { tone: "mid" }));
  shapes.push(A.slab(plan, foot, PLATE_T, { name: `rig.plate.${level.id}`, owner: "rig" }));

  // The groove the grid is engraved in, and the grid itself.
  const inset = 5;
  const groove = k.insetPlan(plan, inset);
  out.push(L(k.planOutline(groove, top, P), { tone: "lo" }));
  const step = (PLATE - inset * 2) / n;
  const grid = [];
  for (let i = 0; i <= n; i++) {
    const gx = plan.x + inset + i * step;
    const gy = plan.y + inset + i * step;
    grid.push(k.lineOnTop([gx, groove.y], [gx, groove.y + groove.d], top, P));
    grid.push(k.lineOnTop([groove.x, gy], [groove.x + groove.w, gy], top, P));
  }
  out.push(L(grid.join(""), { tone: level.n >= 32 ? "faint" : "lo" }));

  // The pivot the pointer turns on.
  out.push(S(k.cylinder(level.cx, level.cy, 5.4, top, 4.4, P, 24), { tone: "lo" }));
  shapes.push(A.cylinder(level.cx, level.cy, 5.4, top, 4.4, { name: `rig.pivot.${level.id}`, owner: "rig" }));

  // Corner screws.
  const screws = k.corners(plan, 9);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 1.7, top, P, 14)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, top])), { size: 0.45 }));
  for (const [x, y] of screws) shapes.push(A.cylinder(x, y, 1.7, top, 0.4, { name: `rig.screw.${level.id}`, owner: "rig" }));

  return { svg: out.join(""), shapes };
}

// ------------------------------------------------------------------ the peg
// The one lit thing in the drawing: the winning cell, marked by a peg. It
// stands in the cell itself, so it can only ever be in the cell the descent
// actually found.
const field = new Field();
const home = field.descend();
const TILE_STATION = STATIONS[2];
const TILE_STEP = (PLATE - 10) / TILE_STATION.n;
const homeU = home.cellX - home.tileX * 32;
const homeV = home.cellY - home.tileY * 32;
const PEG = {
  x: TILE_STATION.x + 5 + (homeU + 0.5) * TILE_STEP,
  y: TILE_STATION.y + 5 + (homeV + 0.5) * TILE_STEP,
  z: TILE_STATION.top,        // seated on the plate
  r: 1.8,
  h: 4.4,
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
const stationParts = STATIONS.map(station);
const pegPart = peg();
const dialPart = dial();

put("base", "rig", [BASE.x + BASE.w / 2, BASE.y + BASE.d / 2, 0], basePart.svg, basePart.shapes);
STATIONS.forEach((level, index) => {
  put(`station-${level.id}`, "rig", [level.cx, level.cy, level.top], stationParts[index].svg, stationParts[index].shapes);
});
put("dial", "rig", [DIAL.x, DIAL.y, 0], dialPart.svg, dialPart.shapes);
put("peg", "rig", [PEG.x, PEG.y, PEG.z], `<g data-part="peg">${pegPart.svg}</g>`, pegPart.shapes);

// Empty groups the page fills with the pointer arms and the markers.
const pointers = STATIONS.map((level) => `<g data-part="pointer-${level.id}"></g>`).join("");

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

const bodySvg = R.items.map((item) => item.svg).join("") + pointers +
  `<path data-part="needle" class="iso-line" data-tone="hi" d="${needleAt(home.node)}" style="stroke-width:1.1"/>`;

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "Three engraved plates on pedestals: the root's sixteen live node slots, one node's sixty-four tile slots, and one tile's thousand and twenty-four cells. A lit bead carries the running maximum down from the root to the best cell.",
  body: [bodySvg],
});

// ------------------------------------------------------------------ the live page
const live = `
const P = ${JSON.stringify(P)};
const STATIONS = ${JSON.stringify(STATIONS.map((s) => ({ id: s.id, n: s.n, x: s.x, y: PLATE_Y, cx: s.cx, cy: s.cy, top: s.top, w: PLATE, d: PLATE })))};
${readFileSync(join(HERE, "model", "model.mjs"), "utf8").replace(/^export /gm, "").replace(/^import .*$/gm, "")}
${readFileSync(join(HERE, "model", "field.mjs"), "utf8").replace(/^export /gm, "").replace(/^import .*$/gm, "")}
${readFileSync(join(HERE, "model", "pyramid.mjs"), "utf8").replace(/^export /gm, "").replace(/^import .*$/gm, "")}

const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const peg = svg.querySelector('[data-part="peg"]');
const needle = svg.querySelector('[data-part="needle"]');
const DIAL = ${JSON.stringify(DIAL)};
const DIAL_MAX = ${DIAL_MAX};
const pointers = {};
for (const s of STATIONS) pointers[s.id] = svg.querySelector('[data-part="pointer-' + s.id + '"]');

const field = new Field();
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const inset = 5;
const PEG_HOME = ${JSON.stringify(PEG)};
const PEG_R = ${PEG.r};

function slotCentre(level, u, v) {
  const step = (level.w - inset * 2) / level.n;
  return [level.x + inset + (u + 0.5) * step, level.y + inset + (v + 0.5) * step];
}

// The three targets of a descent: the node slot, the tile slot, the cell.
function targets(nodeX, nodeY) {
  const node = field.nodeMax(nodeX, nodeY);
  let bx = nodeX * 8;
  let by = nodeY * 8;
  let tile = 0;
  for (let ty = nodeY * 8; ty < nodeY * 8 + 8; ty++) {
    for (let tx = nodeX * 8; tx < nodeX * 8 + 8; tx++) {
      const value = field.tileMax(tx, ty);
      if (value > tile) { tile = value; bx = tx; by = ty; }
    }
  }
  const argmax = field.tileArgmax(bx, by);
  const cell = argmax ? argmax.split(",").map(Number) : [bx * 32, by * 32];
  return {
    root: field.rootMax(),
    node,
    tile,
    cell: field.tileMax(bx, by),
    nodeX, nodeY,
    tileX: bx, tileY: by,
    cellX: cell[0], cellY: cell[1],
  };
}

// The plate-local slot of each target.
function slots(d) {
  const root = STATIONS[0];
  const node = STATIONS[1];
  const tile = STATIONS[2];
  return [
    { level: root, u: d.nodeX, v: d.nodeY, value: d.root },
    { level: node, u: d.tileX - d.nodeX * 8, v: d.tileY - d.nodeY * 8, value: d.node },
    { level: tile, u: d.cellX - d.tileX * 32, v: d.cellY - d.tileY * 32, value: d.cell },
  ];
}

function arm(level, u, v, toPeg) {
  const [x, y] = slotCentre(level, u, v);
  const z = level.top + 4.4;
  // The arm starts on the pivot's rim and ends on the marker's ring, so both
  // ends land on a real edge. On the tile plate the marker is the lit peg.
  const dx = x - level.cx;
  const dy = y - level.cy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const from = [level.cx + ux * 5.4, level.cy + uy * 5.4];
  const to = [x - ux * (toPeg ? PEG_R : 4.6), y - uy * (toPeg ? PEG_R : 4.6)];
  const path = lineOnTop(from, to, z, P);
  const mark = toPeg ? "" : lineSvg(ring(x, y, 4.6, z, P, 28), { tone: "hi" });
  return lineSvg(path, { tone: "hi" }) + mark;
}

let current = targets(3, 0);

function draw() {
  const list = slots(current);
  for (const item of list) {
    pointers[item.level.id].innerHTML = arm(item.level, item.u, item.v, item.level.id === "tile");
  }
  // The peg stands in the winning cell.
  const cell = list[2];
  const [px, py] = slotCentre(cell.level, cell.u, cell.v);
  peg.setAttribute("transform", translateAlong(P, [px - PEG_HOME.x, py - PEG_HOME.y, 0]));
  // The dial reads the maximum this branch carries down.
  const angle = -Math.PI * 0.62 + (Math.min(current.node, DIAL_MAX) / DIAL_MAX) * Math.PI * 1.24;
  needle.setAttribute("d", lineOnTop(
    [DIAL.x - Math.sin(angle) * 4.4, DIAL.y + Math.cos(angle) * 4.4],
    [DIAL.x + Math.sin(angle) * (DIAL.r - 4.6), DIAL.y - Math.cos(angle) * (DIAL.r - 4.6)],
    7.5, P));
  const text = "root " + current.root + " \\u00b7 node " + current.node + " \\u00b7 tile " + current.tile + " \\u00b7 cell " + current.cell;
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuetext", text);
}

// Hovering a plate picks the branch to descend.
stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  const px = (event.clientX - box.left) / box.width * ${WIDTH};
  const py = (event.clientY - box.top) / box.height * ${HEIGHT};
  for (const level of STATIONS) {
    if (level.id !== "root") continue;
    const origin = iso([level.x, level.y, level.top], P);
    const u = iso([level.x + level.w, level.y, level.top], P);
    const v = iso([level.x, level.y + level.d, level.top], P);
    const dx = px - origin[0], dy = py - origin[1];
    const det = (u[0] - origin[0]) * (v[1] - origin[1]) - (v[0] - origin[0]) * (u[1] - origin[1]);
    if (!det) continue;
    const gx = (dx * (v[1] - origin[1]) - dy * (v[0] - origin[0])) / det;
    const gy = ((u[0] - origin[0]) * dy - (u[1] - origin[1]) * dx) / det;
    if (gx < 0 || gx > 1 || gy < 0 || gy > 1) continue;
    const step = (level.w - inset * 2) / level.n;
    const cu = clamp(Math.floor((gx * level.w - inset) / step), 0, level.n - 1);
    const cv = clamp(Math.floor((gy * level.d - inset) / step), 0, level.n - 1);
    current = targets(cu, cv);
    draw();
    return;
  }
});

draw();
`;

const card = k.plateHtml({
  fig: "Fig 2",
  title: "The pyramid",
  hint: "Hover the root plate to follow a branch",
  readout: "root 450 · node 450 · tile 450 · cell 450",
  keys: [
    { mark: "lit", label: "The peg: the winning cell, the end of the descent" },
    { mark: "raised", label: "One level of the hierarchy, engraved with its fan-out" },
  ],
  caption:
    "Gi keeps two things per tile: the cells, and the maximum of those cells. That maximum is rolled up into a node, and the nodes into one root, so the biggest value in a 1024 x 1024 field is found by reading 16 node slots and 64 tile slots and then one 2048 B page — 80 numbers instead of 1 048 576 cells. The maximum never changes on the way down: root, node, tile and cell all read the same value.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Field pyramid: the descent from the root to the best cell" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50">${svg}</div>`,
});

const NOTES = `
<div class="notes">
  <h2>What the figure shows</h2>
  <ul>
    <li>The <strong>root plate</strong> carries the 16 live node slots of a 1024² field. The pyramid's array is 8×8 wide; only 16 of its slots are in use at this size.</li>
    <li>The <strong>node plate</strong> carries the 64 tile slots of one node — a node covers 8×8 tiles, which is 256×256 cells.</li>
    <li>The <strong>tile plate</strong> carries the 1024 cells of one tile, 32×32 int16, published as one 2048 B page.</li>
    <li>The <strong>bead</strong> is the maximum on its way down. Every level holds the same number, because a parent is the maximum of its children.</li>
  </ul>
  <p class="source">The descent is modelled from Gi's own <code>Pyramid&lt;T&gt;</code> (fan-out 8) and <code>MaxQueries.Visit</code>: the root's 16 live slots, then the node's 64 tile slots, then one page. Numbers come from <code>build/model/pyramid.mjs</code>, which deposits the same kernels Gi does.</p>
</div>`;

const page = (theme) =>
  sitePage({
    title: "Fig 2 · The pyramid",
    description: "Anatomy of Gi: how a query finds the best cell of a 1024² field without scanning it.",
    theme,
    active: "pyramid",
    base: "../",
    body: `
<div class="lede">
  <p class="kicker">Fig 2 · how queries never scan</p>
  <h1>The pyramid</h1>
  <p>A field of a million cells is not searched. It is descended: root, node, tile, cell — 80 numbers and one page, and the answer is the same number all the way down.</p>
</div>
${card}
${NOTES}
`,
    script: kitScript() + live,
  });

for (const theme of ["dark", "light"]) {
  writeFileSync(join(HERE, "..", "site", "figures", `pyramid${theme === "light" ? "-light" : ""}.html`), page(theme));
}
A.auditOrExit(R, P, { crowd: [] });
console.log("wrote site/figures/pyramid.html (+ light)");
export { R, P };
if (process.argv.includes("--probe")) {
  for (const level of STATIONS) {
    const step = (PLATE - 10) / level.n;
    const p = at([level.x + 5 + 0.5 * step, level.y + 5 + 0.5 * step, level.top]);
    console.log(level.id, "slot00 at user", p.map((v) => v.toFixed(2)).join(","), "-> fraction", (p[0] / WIDTH).toFixed(4), (p[1] / HEIGHT).toFixed(4));
  }
}
