// Build the whole site: every figure, the index, and the preview images.
//
//   node build/build.mjs          figures and index
//   node build/build.mjs --shots  also capture the preview images
import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SITE = join(ROOT, "site");
const shots = process.argv.includes("--shots");

mkdirSync(join(SITE, "figures"), { recursive: true });
mkdirSync(join(SITE, "previews"), { recursive: true });

const run = (file, args = []) => {
  process.stdout.write(`> ${file} ${args.join(" ")}\n`);
  execFileSync(process.execPath, [join(HERE, file), ...args], { stdio: "inherit" });
};

for (const figure of ["fig-bench.mjs", "fig-pyramid.mjs", "fig-planes.mjs", "fig-balance.mjs"]) {
  run(figure, ["--audit"]);
}
run("index.mjs");

if (shots) {
  const previews = [
    ["field-bench", "bench"],
    ["pyramid", "pyramid"],
    ["planes", "planes"],
    ["balance", "balance"],
  ];
  for (const [file, name] of previews) {
    process.stdout.write(`> capture ${name}\n`);
    execFileSync(process.execPath, [join(ROOT, "tools", "capture.mjs"), join(SITE, "figures", `${file}.html`), "--out", join(SITE, "previews", `${name}.png`), "--width", "1100", "--height", "760"], { stdio: "inherit" });
  }
  // The index carries the previews, so it is written again once they exist.
  run("index.mjs");
}

console.log("\nsite ready:", SITE);
