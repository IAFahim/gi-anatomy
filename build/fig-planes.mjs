// Fig 3 — The planes.
//
// A live tile owns four planes: the published int16 page, the int32 I plane
// (box, raster and round contributions), the int64 tent plane and the int64
// bell plane. The planes are summed into the short cells only at publish
// time, after summation, so cancellation stays exact.
//
// The rig shows the three source planes as hoppers whose faces carry the
// footprint of their contributions, a trough that sums them, and the page
// they are published into.
import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import * as A from "../kit/audit.mjs";
import { kitScript } from "../tools/inline-kit.mjs";
import { sitePage } from "./site.mjs";
import { Tile } from "./model/planes.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const WIDTH = 900;
const HEIGHT = 420;

// ------------------------------------------------------------------ the bench
const BASE = { x: -252, y: -84, w: 492, d: 190, r: 14 };
const BASE_H = 13;

// The page: one 32 x 32 tile, 1024 int16 cells, 2 048 B.
const PAGE = { x: 120, y: -70, w: 96, d: 96, r: 3 };
const PAGE_T = 5;
const CELLS = 32;
const CELL = PAGE.w / CELLS;

// The three source planes, as hoppers. Deeper means more bytes.
const HOPPERS = [
  { id: "I", label: 4096, x: -232, w: 70, d: 70, h: 44 },
  { id: "T", label: 8192, x: -152, w: 70, d: 70, h: 62 },
  { id: "B", label: 8192, x: -72, w: 70, d: 70, h: 62 },
];
const HOP_Y = 10;
const HOP_SCALE = 2;   // the face's cell size, in world units

// The trough that sums the planes, and the gate at its end.
const TROUGH = { x: 26, y: 30, w: 74, d: 30, r: 2 };

const P = k.fitProjection(
  [
    ...k.boxCorners(BASE, -BASE_H - 6, 0),
    ...HOPPERS.map((h) => k.boxCorners({ x: h.x, y: HOP_Y, w: h.w, d: h.d, r: 2 }, 0, h.h)).flat(),
    ...k.boxCorners(PAGE, 0, PAGE_T),
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
  const strip = { x: -238, y: BASE.y + BASE.d - 15, w: 210, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.7, P, 3), { tone: "lo", crease: "none" }));
  shapes.push(A.slab(strip, 0, 0.7, { name: "rig.ruler", owner: "rig" }));
  const ticks = k.topTicks(strip.x + 5, strip.x + strip.w - 5, 5, 4, strip.y + 0.9, 0.7, [2, 3.8], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 3, strip.y + 3.5, 0.7]), at([strip.x + strip.w - 3, strip.y + 3.5, 0.7])], { size: 0.45 }));
  return { svg: out.join(""), shapes };
}

// ------------------------------------------------------------------ a hopper
// One source plane. Its front face carries the footprint of the cells that
// plane holds, engraved as a dot grid; the page draws those dots.
function hopper(h) {
  const out = [];
  const shapes = [];
  const plan = { x: h.x, y: HOP_Y, w: h.w, d: h.d, r: 2 };
  out.push(S(k.slabOf(plan, 0, h.h, P, 6, 1.2), { tone: "lo" }));
  shapes.push(A.slab(plan, 0, h.h, { name: `rig.hopper.${h.id}`, owner: "rig" }));
  for (const z of [h.h * 0.34, h.h * 0.68]) {
    out.push(L(k.sideSeam(plan, z, P, 6), { tone: "faint" }));
  }
  // The rim around the face.
  const rim = { x: h.x + 3, y: HOP_Y + h.d - 3, w: h.w - 6, d: 3, r: 1 };
  out.push(S(k.slabOf(rim, h.h, 2.2, P, 3, 0.4), { tone: "mid" }));
  shapes.push(A.slab(rim, h.h, 2.2, { name: `rig.hoprim.${h.id}`, owner: "rig" }));
  // A label plate on the hopper's side.
  const label = { x: h.x + 8, y: HOP_Y + h.d + 1, w: h.w - 16, d: 9, r: 1.5 };
  out.push(S(k.slabOf(label, 0, 0.9, P, 3), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.9, P), { tone: "faint" }));
  out.push(L(k.lineOnTop([label.x + 3, label.y + 3.4], [label.x + 26, label.y + 3.4], 0.9, P), { tone: "lo", free: true }));
  out.push(L(k.lineOnTop([label.x + 3, label.y + 6], [label.x + 18, label.y + 6], 0.9, P), { tone: "lo", free: true }));
  shapes.push(A.slab(label, 0, 0.9, { name: `rig.hoplabel.${h.id}`, owner: "rig" }));
  // The spout that carries the plane into the trough.
  const spout = { x: h.x + h.w, y: HOP_Y + 22, w: 24, d: 22, r: 2 };
  out.push(S(k.slabOf(spout, 0, 9, P, 4, 0.5), { tone: "mid" }));
  shapes.push(A.slab(spout, 0, 9, { name: `rig.spout.${h.id}`, owner: "rig" }));
  // The screws at the corners.
  const screws = k.corners(plan, 8);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 1.7, h.h + 2.2, P, 14)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, h.h + 2.2])), { size: 0.45 }));
  for (const [x, y] of screws) shapes.push(A.cylinder(x, y, 1.7, h.h, 2.2, { name: `rig.hopscrew.${h.id}`, owner: "rig" }));
  return { svg: out.join(""), shapes };
}

// ------------------------------------------------------------------ the trough
// Where the planes are summed, and the gate that lets them into the page.
function trough() {
  const out = [];
  const shapes = [];
  const floor = { x: TROUGH.x, y: TROUGH.y, w: TROUGH.w, d: TROUGH.d, r: 2 };
  out.push(S(k.slabOf(floor, 0, 3, P, 4, 0.5), { tone: "mid" }));
  shapes.push(A.slab(floor, 0, 3, { name: "rig.trough", owner: "rig" }));
  for (const bar of [
    { x: TROUGH.x, y: TROUGH.y, w: TROUGH.w, d: 3, r: 1 },
    { x: TROUGH.x, y: TROUGH.y + TROUGH.d - 3, w: TROUGH.w, d: 3, r: 1 },
  ]) {
    out.push(S(k.slabOf(bar, 3, 7, P, 3, 0.4), { tone: "lo" }));
    shapes.push(A.slab(bar, 3, 7, { name: "rig.troughwall", owner: "rig" }));
  }
  // The gate: a post, a pivot and a lever, standing open.
  const pivot = { x: TROUGH.x + TROUGH.w - 6, y: TROUGH.y + TROUGH.d / 2 };
  out.push(S(k.cylinder(pivot.x, pivot.y, 3.2, 3, 7, P, 18), { tone: "mid" }));
  shapes.push(A.cylinder(pivot.x, pivot.y, 3.2, 3, 7, { name: "rig.gatepost", owner: "rig" }));
  out.push(S(k.cylinder(pivot.x, pivot.y, 2.6, 10, 5, P, 18), { tone: "lo" }));
  shapes.push(A.cylinder(pivot.x, pivot.y, 2.6, 10, 5, { name: "rig.gatepivot", owner: "rig" }));
  const lever = { x: pivot.x - 2, y: pivot.y - 1, w: 4, d: 26, r: 1 };
  out.push(S(k.slabOf(lever, 14, 3, P, 3, 0.4), { tone: "mid" }));
  shapes.push(A.slab(lever, 14, 3, { name: "rig.gate", owner: "rig" }));
  out.push(D([at([pivot.x, pivot.y, 17])], { size: 0.7 }));
  return { svg: out.join(""), shapes };
}

// ------------------------------------------------------------------ the page
// The published tile: 1 024 int16 cells, one 2 048 B page.
function pageTray() {
  const out = [];
  const shapes = [];
  out.push(S(k.slabOf(PAGE, 0, PAGE_T, P, 6, 1), { tone: "mid" }));
  shapes.push(A.slab(PAGE, 0, PAGE_T, { name: "rig.page", owner: "rig" }));
  for (const bar of [
    { x: PAGE.x, y: PAGE.y, w: PAGE.w, d: 3.4, r: 1 },
    { x: PAGE.x, y: PAGE.y + PAGE.d - 3.4, w: PAGE.w, d: 3.4, r: 1 },
    { x: PAGE.x, y: PAGE.y, w: 3.4, d: PAGE.d, r: 1 },
    { x: PAGE.x + PAGE.w - 3.4, y: PAGE.y, w: 3.4, d: PAGE.d, r: 1 },
  ]) {
    out.push(S(k.slabOf(bar, PAGE_T, 2.6, P, 3, 0.4), { tone: "lo" }));
    shapes.push(A.slab(bar, PAGE_T, 2.6, { name: "rig.pagerim", owner: "rig" }));
  }
  const screws = k.corners(PAGE, 8);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 1.7, PAGE_T + 2.6, P, 14)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, PAGE_T + 2.6])), { size: 0.45 }));
  for (const [x, y] of screws) shapes.push(A.cylinder(x, y, 1.7, PAGE_T, 2.6, { name: "rig.pagescrew", owner: "rig" }));
  return { svg: out.join(""), shapes };
}

// ------------------------------------------------------------------ the peg
// The one lit thing in the drawing: the cell that holds the tile's maximum.
const tile = new Tile();
let top = null;
for (const [key, value] of tile.page) {
  if (!top || value > top.value) {
    const [i, j] = key.split(",").map(Number);
    top = { i, j, value };
  }
}
const PEG = {
  x: PAGE.x + (top.i + 0.5) * CELL,
  y: PAGE.y + (top.j + 0.5) * CELL,
  z: PAGE_T,
  r: 1.4,
  h: 4.2,
};

function peg() {
  const out = [];
  const shapes = [];
  out.push(S(k.cylinder(PEG.x, PEG.y, PEG.r, PEG.z, PEG.h, P, 22), { tone: "hi", lit: true, crease: "lo" }));
  shapes.push(A.cylinder(PEG.x, PEG.y, PEG.r, PEG.z, PEG.h, { name: "rig.peg", owner: "rig" }));
  return { svg: out.join(""), shapes };
}

// ------------------------------------------------------------------ the scene
const basePart = base();
const hopperParts = HOPPERS.map(hopper);
const troughPart = trough();
const pagePart = pageTray();
const pegPart = peg();

put("base", "rig", [BASE.x + BASE.w / 2, BASE.y + BASE.d / 2, 0], basePart.svg, basePart.shapes);
HOPPERS.forEach((h, index) => {
  put(`hopper-${h.id}`, "rig", [h.x + h.w / 2, HOP_Y + h.d / 2, h.h], hopperParts[index].svg, hopperParts[index].shapes);
});
// The trough is drawn after the page: at the pixels where they overlap on
// screen the trough's near end is the nearer solid, and its centre does not
// say so.
put("trough", "rig", [TROUGH.x + TROUGH.w - 4, TROUGH.y + TROUGH.d - 4, 0], troughPart.svg, troughPart.shapes, 40);
put("page", "rig", [PAGE.x + PAGE.w / 2, PAGE.y + PAGE.d / 2, PAGE_T], pagePart.svg, pagePart.shapes);
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

// The groups the page fills: the three plane faces and the published page.
const cellMatrix = (() => {
  const o = at([PAGE.x, PAGE.y, PAGE_T]);
  const u = at([PAGE.x + CELL, PAGE.y, PAGE_T]);
  const v = at([PAGE.x, PAGE.y + CELL, PAGE_T]);
  return `matrix(${(u[0] - o[0]).toFixed(4)} ${(u[1] - o[1]).toFixed(4)} ${(v[0] - o[0]).toFixed(4)} ${(v[1] - o[1]).toFixed(4)} ${o[0].toFixed(3)} ${o[1].toFixed(3)})`;
})();

const faces = HOPPERS.map((h) => `<g data-part="face-${h.id}"></g>`).join("");

const bodySvg = R.items.map((item) => item.svg).join("") + faces +
  `<g data-part="pagecells" transform="${cellMatrix}"></g>`;

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "Three hoppers hold the tile's source planes — the int32 plane for box, raster and round stamps, and the int64 tent and bell planes. Their spouts feed one trough, and the trough fills the page: a 32 by 32 tile of published short cells.",
  body: [bodySvg],
});

// ------------------------------------------------------------------ the live page
const live = `
const P = ${JSON.stringify(P)};
const PAGE = ${JSON.stringify(PAGE)};
const CELLS = ${CELLS};
const CELLU = ${CELL};
const PAGE_T = ${PAGE_T};
const HOP_Y = ${HOP_Y};
const HOP_SCALE = ${HOP_SCALE};
const HOPPERS = ${JSON.stringify(HOPPERS)};
const DIAL_MAX = 270;
${readFileSync(join(HERE, "model", "model.mjs"), "utf8").replace(/^export /gm, "").replace(/^import .*$/gm, "")}
${readFileSync(join(HERE, "model", "field.mjs"), "utf8").replace(/^export /gm, "").replace(/^import .*$/gm, "")}
${readFileSync(join(HERE, "model", "planes.mjs"), "utf8").replace(/^export /gm, "").replace(/^import .*$/gm, "")}

const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const cells = svg.querySelector('[data-part="pagecells"]');
const faces = {};
for (const h of HOPPERS) {
  faces[h.id] = svg.querySelector('[data-part="face-' + h.id + '"]');
  faces[h.id].setAttribute("class", "iso-face");
}

const tile = new Tile();

// The published page: only the cells that differ are stored.
function drawPage() {
  const out = [];
  for (let j = 0; j < CELLS; j++) {
    for (let i = 0; i < CELLS; i++) {
      const value = tile.page.get(i + "," + j);
      if (!value) continue;
      const alpha = (0.16 + 0.84 * Math.pow(Math.min(1, value / DIAL_MAX), 0.72)).toFixed(3);
      out.push('<rect x="' + (i + 0.07) + '" y="' + (j + 0.07) + '" width="0.86" height="0.86" style="fill:var(--anatomy-hi);opacity:' + alpha + '"/>');
    }
  }
  cells.innerHTML = out.join("");
}

// Each hopper's face carries the footprint of the cells its plane holds.
function drawFaces(plane) {
  for (const h of HOPPERS) {
    const points = [];
    for (const key of tile.planes[h.id].keys()) {
      const [i, j] = key.split(",").map(Number);
      points.push([i * HOP_SCALE + HOP_SCALE / 2, j * HOP_SCALE + HOP_SCALE / 2]);
    }
    const plan = { x: h.x, y: HOP_Y, w: h.w, d: h.d, r: 2 };
    const ox = plan.x + (plan.w - CELLS * HOP_SCALE) / 2;
    const oz = 6;
    const at3 = points.map(([x, y]) => iso([ox + x, plan.y + plan.d + 0.3, oz + y], P));
    const on = plane === h.id;
    faces[h.id].innerHTML = dotsSvg(at3, { size: on ? 0.9 : 0.62, tone: on ? "hi" : "lo" });
  }
}

const text = () => "sum " + tile.sum + " \\u00b7 max " + tile.max + " \\u00b7 stored " + tile.stored + " of 1 024 cells";

// The publish cycle: the three planes light in turn, then the page is written.
let phase = -1;
let clock = 0;
let last = 0;
let visible = false;
let frame = 0;
const ORDER = ["I", "T", "B"];
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  const step = Math.floor(clock / 0.55);
  if (step !== phase) {
    phase = step;
    const on = ORDER[phase % 4];
    drawFaces(on === "B" ? null : on);
    if (on === "B") drawPage();
    const t = text();
    if (readout.textContent !== t) readout.textContent = t;
  }
  frame = visible ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);

drawFaces(null);
drawPage();
readout.textContent = text();
stage.setAttribute("aria-valuetext", text());
`;

const card = k.plateHtml({
  fig: "Fig 3",
  title: "The planes",
  hint: "Watch the publish cycle",
  readout: "sum 30 882 · max 270 · stored 472 of 1 024 cells",
  keys: [
    { mark: "lit", label: "The published page: the short cells every query reads" },
    { mark: "raised", label: "One plane: 2 048 B of short, 4 096 of int32, 8 192 of int64" },
  ],
  caption:
    "A tile does not store one field. It stores four planes: the published int16 page, an int32 plane for box, raster and round stamps, and int64 tent and bell planes that keep the exact product. The planes are summed into the short cells only at publish, and the sum is taken after summation, so a deposit that cancels another leaves exactly zero. Only the cells that differ are stored, and a tile that publishes to zero frees its planes — a missing page reads as zero.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Tile planes: the source planes summed into the published page" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50">${svg}</div>`,
});

const NOTES = `
<div class="notes">
  <h2>What the figure shows</h2>
  <ul>
    <li>The <strong>I hopper</strong> is the int32 plane, 4 096 B. Box, raster and round stamps all write into it, because their contributions are already whole cell values.</li>
    <li>The <strong>T</strong> and <strong>B hoppers</strong> are the int64 tent and bell planes, 8 192 B each. They keep the exact product, so a cell can hold a fraction that is rounded only once, at publish.</li>
    <li>The <strong>trough</strong> is the sum. The planes are added together <em>before</em> the result is turned into a short, so cancellation is exact rather than approximate.</li>
    <li>The <strong>page</strong> is 1 024 int16 cells in 2 048 B. Only the 472 cells that differ from zero are stored; the rest of the page reads as zero without holding anything.</li>
  </ul>
  <p class="source">Plane sizes and the publish rule come from Gi's own <code>TilePlanes</code>, <code>TilePublish</code> and <code>PlaneFold</code>. The cells come from <code>build/model/planes.mjs</code>, which deposits the same kernels Gi does.</p>
</div>`;

const page = (theme) =>
  sitePage({
    title: "Fig 3 · The planes",
    description: "Anatomy of Gi: the four planes a tile owns, and how they become published cells.",
    theme,
    active: "planes",
    base: "../",
    body: `
<div class="lede">
  <p class="kicker">Fig 3 · how a deposit becomes a cell</p>
  <h1>The planes</h1>
  <p>A tile is not a buffer of values. It is four planes and a rule for folding them into one page of short cells — and the folding happens only when the tile publishes.</p>
</div>
${card}
${NOTES}
`,
    script: kitScript() + live,
  });

for (const theme of ["dark", "light"]) {
  writeFileSync(join(HERE, "..", "site", "figures", `planes${theme === "light" ? "-light" : ""}.html`), page(theme));
}
A.auditOrExit(R, P, { crowd: [] });
console.log("wrote site/figures/planes.html (+ light)");
export { R, P };
