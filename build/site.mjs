// The site shell: every figure page is a standalone document with the kit CSS
// inlined, so it opens from disk and deploys as a flat static site.
import { ISO_CSS } from "../kit/iso-kit.mjs";

export const FIGURES = [
  {
    id: "bench",
    n: 1,
    title: "The field bench",
    file: "figures/field-bench.html",
    blurb: "A press that stamps a shaped die into one tile of the field. Moving the die changes nothing until the press cycles — then the old footprint is lifted exactly and only the touched tiles are republished.",
    needs: "the change-rate deposit cycle",
  },
  {
    id: "pyramid",
    n: 2,
    title: "The pyramid",
    file: "figures/pyramid.html",
    blurb: "The grid is a ziggurat of tiles and nodes. A query for the best cell descends it instead of scanning, so 65 536 cells become a handful of reads.",
    needs: "how queries never scan",
  },
  {
    id: "planes",
    n: 3,
    title: "The planes",
    file: "figures/planes.html",
    blurb: "Every tile owns four planes. Deposits land in the plane that suits their kernel, and the planes are summed into short cells only at publish time.",
    needs: "how a deposit becomes a cell",
  },
  {
    id: "balance",
    n: 4,
    title: "The balance",
    file: "figures/balance.html",
    blurb: "A derived layer is a formula over other layers: food minus twice the threat. It is maintained only on the tiles whose inputs changed.",
    needs: "how channels combine",
  },
];

export const SITE_CSS = `
*{box-sizing:border-box}
html{color-scheme:dark}
body[data-theme="light"]{color-scheme:light}
body{margin:0;background:var(--anatomy-page);color:var(--anatomy-text);font:14px/1.65 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
.iso-page{width:min(720px,100% - 32px);margin:56px auto 96px}
.iso-page.wide{width:min(980px,100% - 32px)}

.site-head{display:flex;align-items:baseline;gap:18px;flex-wrap:wrap;width:min(720px,100% - 32px);margin:28px auto 0;padding-bottom:14px;border-bottom:1px solid #ffffff12}
.site-head.wide{width:min(980px,100% - 32px)}
.site-title{font:600 13px/1.4 var(--anatomy-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--anatomy-strong);text-decoration:none}
.site-title span{color:var(--anatomy-muted)}
.site-nav{display:flex;gap:14px;flex-wrap:wrap;margin-left:auto}
.site-nav a{font:400 12px/1.4 var(--anatomy-mono);color:var(--anatomy-muted);text-decoration:none;padding:2px 0;border-bottom:1px solid transparent}
.site-nav a:hover{color:var(--anatomy-text)}
.site-nav a[aria-current="page"]{color:var(--anatomy-strong);border-bottom-color:#ffffff30}

h1{font:500 26px/1.25 var(--anatomy-mono);color:var(--anatomy-strong);letter-spacing:-.01em;margin:0 0 6px}
h2{font:500 15px/1.4 var(--anatomy-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--anatomy-strong);margin:44px 0 14px}
.lede p{margin:0 0 10px;max-width:62ch}
.lede .kicker{font:400 12px/1.5 var(--anatomy-mono);color:var(--anatomy-muted);margin:0 0 10px}

.notes{max-width:62ch}
.notes ul{margin:0;padding-left:18px}
.notes li{margin:0 0 7px}
.notes code,.mono{font:400 .92em var(--anatomy-mono);color:var(--anatomy-strong);background:#ffffff0d;padding:1px 5px;border-radius:3px}
.source{margin-top:26px;padding-top:14px;border-top:1px solid #ffffff12;font:400 12px/1.6 var(--anatomy-mono);color:var(--anatomy-muted)}

.cards{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));margin:22px 0 0;padding:0;list-style:none}
.card{display:block;padding:18px 20px 20px;border:1px solid #ffffff12;border-radius:10px;background:var(--anatomy-card);text-decoration:none;color:inherit;overflow:hidden}
.card:hover{border-color:#ffffff28}
.card img{display:block;width:100%;aspect-ratio:16/10;object-fit:cover;object-position:center 38%;margin:10px -20px 12px;border-bottom:1px solid #ffffff12;background:#000}
.card .n{font:400 11px/1.4 var(--anatomy-mono);color:var(--anatomy-muted);letter-spacing:.12em}
.card h3{margin:8px 0 8px;font:500 16px/1.35 var(--anatomy-mono);color:var(--anatomy-strong)}
.card p{margin:0 0 10px;font-size:13px;line-height:1.6}
.card .needs{font:400 11px/1.5 var(--anatomy-mono);color:var(--anatomy-muted)}

.steps{counter-reset:step;margin:0;padding:0;list-style:none;max-width:62ch}
.steps li{position:relative;padding:0 0 18px 44px;margin:0}
.steps li:before{counter-increment:step;content:counter(step);position:absolute;left:0;top:1px;width:26px;height:26px;border:1px solid #ffffff22;border-radius:50%;font:400 12px/25px var(--anatomy-mono);text-align:center;color:var(--anatomy-strong)}
.steps strong{color:var(--anatomy-strong);font-weight:500}
.steps em{font-style:normal;color:var(--anatomy-muted)}
`;

const nav = (active, base) =>
  `<nav class="site-nav"><a href="${base}index.html"${active === "index" ? ' aria-current="page"' : ""}>index</a>${FIGURES.map(
    (f) => `<a href="${base}${f.file}"${active === f.id ? ' aria-current="page"' : ""}>fig ${f.n}</a>`,
  ).join("")}</nav>`;

export function sitePage({ title, theme = "dark", body, script = "", active = "", base = "", wide = false, description = "" }) {
  const head = `<header class="site-head${wide ? " wide" : ""}"><a class="site-title" href="${base}index.html">Anatomy <span>of Gi</span></a>${nav(active, base)}</header>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
${description ? `<meta name="description" content="${description}">` : ""}
<style>${ISO_CSS}${SITE_CSS}</style>
</head>
<body class="iso" data-theme="${theme}">
${head}
<main class="iso-page${wide ? " wide" : ""}">
${body}
</main>
${script ? `<script type="module">${script.replace(/<\/(script)/gi, "<\\/$1")}</script>` : ""}
</body>
</html>`;
}
