// The index: the map of Gi's algorithm, and the figures that open it up.
import { writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sitePage, FIGURES } from "./site.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = join(HERE, "..", "site");

const STEPS = [
  {
    n: 1,
    title: "Place a source, change nothing",
    text: "A source is a column: a position, a kernel, a gain. Placing or moving it writes that column and marks the slot on the changed list. No tile is touched, because a tile is only ever written by a publish.",
    fig: 1,
  },
  {
    n: 2,
    title: "Process: re-emit only what changed",
    text: "Process compares each marked source against the 16-byte record of what it last deposited. Where the two differ it adds the negated old taps and the new taps. Integer adds commute, so any sequence of mutations collapses to the same field.",
    fig: 1,
  },
  {
    n: 3,
    title: "Publish: the planes become cells",
    text: "A tile owns four planes. They are summed into the short cells only at publish, and the sum is taken after summation, so a deposit that cancels another leaves exactly zero. Only the cells that differ are stored.",
    fig: 3,
  },
  {
    n: 4,
    title: "Query: descend, never scan",
    text: "A region sum adds one int64 per fully covered tile. A best-cell query descends a max pyramid: root, node, tile, cell. Eighty numbers and one 2 048 B page stand in for a million cells.",
    fig: 2,
  },
  {
    n: 5,
    title: "Combine: derived layers",
    text: "A derived layer is a formula over other layers — food minus twice the threat. It is maintained only on the tiles whose inputs changed, and every query works on it as if it were any other layer.",
    fig: null,
  },
];

const card = (figure) => {
  const preview = join(SITE, "previews", `${figure.id}.png`);
  const shot = existsSync(preview)
    ? `<img src="previews/${figure.id}.png" alt="" loading="lazy">`
    : "";
  return `<a class="card" href="${figure.file}">
    <span class="n">Fig ${figure.n}</span>
    ${shot}
    <h3>${figure.title}</h3>
    <p>${figure.blurb}</p>
    <span class="needs">${figure.needs}</span>
  </a>`;
};

const body = `
<div class="lede">
  <p class="kicker">Anatomy of Gi</p>
  <h1>How the grid-influence algorithm works</h1>
  <p>Gi is a sparse tiled integer influence field for .NET. It never redraws the world: it redraws the tiles that changed, publishes them exactly, and answers queries by descending a hierarchy instead of scanning. These figures are that algorithm, drawn as machines — every number in them is produced by the library's own semantics.</p>
</div>

<h2>The algorithm in five moves</h2>
<ol class="steps">
${STEPS.map(
  (step) => `  <li><strong>${step.title}.</strong> ${step.text}${
    step.fig ? ` <span class="mono">Fig ${step.fig}</span>` : ""
  }</li>`,
).join("\n")}
</ol>

<h2>The figures</h2>
<ul class="cards">
${FIGURES.map(card).join("\n")}
</ul>

<div class="notes">
  <h2>What these are not</h2>
  <ul>
    <li>They are not illustrations of an idea. Each figure is driven by a model of the library: the kernels are bit-exact against the dumps in Gi's README, and the field semantics are asserted against the library's own receipts.</li>
    <li>They are not a rendering of Gi's internals. Gi is a native, unmanaged, allocation-free library; these are isometric drawings of the same arithmetic, built with the <span class="mono">Anatomy</span> kit.</li>
  </ul>
  <p class="source">Source: <span class="mono">github.com/IAFahim/grid-influence</span> — the library these figures explain. The figures themselves live in <span class="mono">github.com/IAFahim/gi-anatomy</span>.</p>
</div>
`;

for (const theme of ["dark", "light"]) {
  writeFileSync(join(SITE, theme === "light" ? "index-light.html" : "index.html"), sitePage({
    title: "Anatomy of Gi — how the grid-influence algorithm works",
    description: "Interactive isometric figures that explain Gi's algorithm: the change-rate deposit cycle, the max pyramid, and the planes a tile owns.",
    theme,
    active: "index",
    base: "",
    body,
  }));
}
console.log("wrote site/index.html (+ light)");
