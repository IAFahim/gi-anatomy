import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { World, KINDS, depositOf, kernelValue } from "./field.mjs";

const dumps = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "dumps.json"), "utf8"));
let failures = 0;
const check = (name, ok, extra) => {
  if (!ok) failures++;
  console.log((ok ? "PASS  " : "FAIL  ") + name + (extra ? "   " + extra : ""));
};

// 1. Every kernel, placed at (15.5, 15.5) with gain 1, must reproduce the library's dump.
for (const kind of KINDS) {
  const world = new World();
  world.place("threat", kind, 15.5, 15.5, 1);
  world.process();
  let bad = 0;
  let first = null;
  for (let j = 0; j < 15; j++) {
    for (let i = 0; i < 15; i++) {
      const got = world.value("threat", 8 + i, 8 + j);
      if (got !== dumps[kind][j][i]) {
        bad++;
        if (!first) first = `(cell ${8 + i},${8 + j}) want ${dumps[kind][j][i]} got ${got}`;
      }
    }
  }
  check(`${kind} dump matches the library`, bad === 0, bad ? `${bad} cells differ, first ${first}` : "225 cells exact");
}

// 2. A source that moves must leave the field equal to a fresh world at the new position:
//    the old deposit is negated exactly and the new one added.
for (const kind of KINDS) {
  const moved = new World();
  moved.place("threat", kind, 15.5, 15.5, 1);
  moved.process();
  moved.move(1, 33.25, 20.5);
  moved.process();

  const fresh = new World();
  fresh.place("threat", kind, 33.25, 20.5, 1);
  fresh.process();

  let bad = 0;
  for (let j = 0; j < 64; j++) {
    for (let i = 0; i < 64; i++) {
      if (moved.value("threat", i, j) !== fresh.value("threat", i, j)) bad++;
    }
  }
  check(`${kind} move cancels exactly`, bad === 0, bad ? `${bad} cells differ` : "");
}

// 3. World.Remove is an exact negation: no rebuild, no residue.
const noResidue = new World();
noResidue.place("threat", "Cone", 15.5, 15.5, 1);
noResidue.process();
noResidue.move(1, 40.5, 40.5);
noResidue.process();
noResidue.remove(1);
noResidue.process();
let residue = 0;
for (let j = 0; j < 64; j++) for (let i = 0; i < 64; i++) if (noResidue.value("threat", i, j)) residue++;
check("remove leaves no residue", residue === 0, residue ? `${residue} cells left` : "");

// 3b. A source placed and removed inside one window must never touch a tile.
const inWindow = new World();
const before = inWindow.process().tiles;
inWindow.place("threat", "Cone", 15.5, 15.5, 1);
inWindow.remove(1);
const after = inWindow.process().tiles;
check("placed and removed in one window touches no tile", before === 0 && after === 0, `published ${after}`);

// 4. The derived layer: Layer.Sum(world, food, 1, threat, -2).
const derived = new World();
derived.derive("safety", [["food", 1], ["threat", -2]]);
derived.place("food", "Bell", 40.5, 40.5, 1);
derived.place("threat", "Cone", 70.5, 70.5, 1);
derived.process();
let derivedBad = 0;
for (let j = 0; j < 96; j++) {
  for (let i = 0; i < 96; i++) {
    const want = derived.value("food", i, j) - 2 * derived.value("threat", i, j);
    if (derived.value("safety", i, j) !== want) derivedBad++;
  }
}
check("derived layer equals food - 2 * threat", derivedBad === 0, derivedBad ? `${derivedBad} cells differ` : "");

// 5. Only the tiles a source touched may republish.
const tiles = new World();
tiles.place("threat", "Cone", 15.5, 15.5, 1);
const first = tiles.process();
const idle = tiles.process();
check("a still source republishes nothing", idle.tiles === 0, `idle published ${idle.tiles}`);
check("a moved source republishes only its tiles", first.tiles >= 1 && first.tiles <= 4, `published ${first.tiles}`);

// 6. The peak of every kernel is value * gain.
for (const kind of KINDS) {
  const world = new World();
  world.place("threat", kind, 15.5, 15.5, 1);
  world.process();
  const peak = Math.max(...depositOf(world.sources.get(1)).values());
  check(`${kind} peaks at 90`, peak === 90, "peak " + peak);
}

console.log(failures ? `\n${failures} FAILURES` : "\nall checks passed");
process.exit(failures ? 1 : 0);
