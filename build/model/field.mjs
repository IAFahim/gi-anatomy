// field.mjs — a faithful slice of Gi's world: sources, change-rate Process, dirty tiles,
// derived layers and the max pyramid. Units follow Gi: 1 cell = 512 Q-units.
import { roundAt, tentAt, bellAt, boxAt, CELL } from "./model.mjs";

export const GRID = 256;            // cells per side: Grid.New(world, power 8, size 256)
export const TILE = 32;             // cells per tile: Gi's TileSize
export const TILES = GRID / TILE;   // 8 x 8 tiles
export const NODE = 2;              // tiles per max-pyramid node
export const NODES = TILES / NODE;  // 4 x 4 nodes
export const VALUE = 90;            // the stamp value the README dumps use
export const GAIN = 1;

export const KINDS = ["Box", "Tent", "Bell", "New", "Disk", "Cone", "Dome"];
export const KERNEL_NOTE = {
  Box: "flat plateau, sharp edges",
  Tent: "piecewise-linear pyramid",
  Bell: "paraboloid dome",
  New: "your own w x h shape",
  Disk: "round plateau, one-cell rim",
  Cone: "linear radial falloff",
  Dome: "round paraboloid",
};
export const KERNEL_PEAK = { Box: 5.5, Tent: 5.5, Bell: 5.5, New: 5, Disk: 6, Cone: 6, Dome: 6 };

// The baked raster of Stamp.New: the library's own disc, 11 x 11, sampled bilinearly.
export const NEW_SAMPLES = [
  [0, 0, 0, 10, 36, 45, 36, 10, 0, 0, 0],
  [0, 0, 45, 90, 90, 90, 90, 90, 45, 0, 0],
  [0, 45, 90, 90, 90, 90, 90, 90, 90, 45, 0],
  [10, 90, 90, 90, 90, 90, 90, 90, 90, 90, 10],
  [36, 90, 90, 90, 90, 90, 90, 90, 90, 90, 36],
  [45, 90, 90, 90, 90, 90, 90, 90, 90, 90, 45],
  [36, 90, 90, 90, 90, 90, 90, 90, 90, 90, 36],
  [10, 90, 90, 90, 90, 90, 90, 90, 90, 90, 10],
  [0, 45, 90, 90, 90, 90, 90, 90, 90, 45, 0],
  [0, 0, 45, 90, 90, 90, 90, 90, 45, 0, 0],
  [0, 0, 0, 10, 36, 45, 36, 10, 0, 0, 0],
];

const Q = 512n;
const roundQ16 = (v) => Number((v + 32768n) >> 16n);

// The value one cell of `kind` receives, for a source whose centre is (x, y) in world units.
// Returns 0 outside the kernel. The arithmetic is Gi's own, so at a cell-centre source these
// numbers are the library's published values, not an approximation of them.
export function kernelValue(kind, x, y, i, j) {
  const sourceQ = Math.round(x * 512);
  const dxQ = BigInt(i * 512 + 256 - sourceQ);
  const dyQ = BigInt(j * 512 + 256 - Math.round(y * 512));
  const dx = Number(dxQ) / 512;
  const dy = Number(dyQ) / 512;
  if (kind === "Box") return boxAt(dx, dy, 5.5, VALUE);
  if (kind === "Tent") return tentAt(dx, dy, 5.5, VALUE);
  if (kind === "Bell") return bellAt(dx, dy, 5.5, VALUE);
  if (kind === "Disk") return roundAt("Disk", dxQ, dyQ, 3072n, VALUE);
  if (kind === "Cone") return roundAt("Cone", dxQ, dyQ, 3072n, VALUE);
  if (kind === "Dome") return roundAt("Dome", dxQ, dyQ, 3072n, VALUE);
  // New: bilinear sampling of the baked raster, in Gi's Q16/Q8 arithmetic.
  const sx = (i + 0.5 - x + 5) * 65536;
  const sy = (j + 0.5 - y + 5) * 65536;
  const ix = Math.floor(sx / 65536);
  const iy = Math.floor(sy / 65536);
  if (ix < -1 || iy < -1 || ix >= 11 || iy >= 11) return 0;
  const fx = Math.floor(sx / 256) % 256;
  const fy = Math.floor(sy / 256) % 256;
  const at = (r, c) => (r < 0 || c < 0 || r > 10 || c > 10 ? 0 : NEW_SAMPLES[r][c]);
  const top = at(iy, ix) * (256 - fx) + at(iy, ix + 1) * fx;
  const bottom = at(iy + 1, ix) * (256 - fx) + at(iy + 1, ix + 1) * fx;
  return roundQ16(BigInt(top * (256 - fy) + bottom * fy));
}

// The cells one source deposits, as a Map from "i,j" to value.
export function depositOf(source) {
  const cells = new Map();
  const half = KERNEL_PEAK[source.kind];
  const reach = Math.ceil(half) + 1;
  const i0 = Math.floor(source.x) - reach;
  const i1 = Math.floor(source.x) + reach;
  const j0 = Math.floor(source.y) - reach;
  const j1 = Math.floor(source.y) + reach;
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const v = kernelValue(source.kind, source.x, source.y, i, j);
      if (v) cells.set(i + "," + j, v);
    }
  }
  return cells;
}

export const tileKey = (i, j) => Math.floor(i / TILE) + "," + Math.floor(j / TILE);

export class World {
  constructor() {
    this.sources = new Map();
    this.field = new Map();      // layer -> Map("i,j" -> value)
    this.deposit = new Map();    // source id -> Map("i,j" -> value), the 16 B record expanded
    this.dirty = new Map();      // layer -> Set of tile keys
    this.tiles = new Map();      // layer -> Map(tile key -> { sum, max })
    this.derivedLayers = new Map(); // name -> [[layer, weight], ...]
    this.processed = 0;
    this.last = { tiles: 0, cells: 0 };
    this.nextId = 1;
  }

  layer(name) {
    if (!this.field.has(name)) this.field.set(name, new Map());
    return this.field.get(name);
  }

  tileStats(layer) {
    if (!this.tiles.has(layer)) this.tiles.set(layer, new Map());
    return this.tiles.get(layer);
  }

  dirtyTiles(layer) {
    if (!this.dirty.has(layer)) this.dirty.set(layer, new Set());
    return this.dirty.get(layer);
  }

  place(layer, kind, x, y, gain) {
    const id = this.nextId++;
    this.sources.set(id, { id, layer, kind, x, y, gain });
    return id;
  }

  move(id, x, y) {
    const s = this.sources.get(id);
    if (s) { s.x = x; s.y = y; }
  }

  setKind(id, kind) {
    const s = this.sources.get(id);
    if (s) s.kind = kind;
  }

  // World.Remove: an exact negation, no rebuild and no residue.
  remove(id) {
    const source = this.sources.get(id);
    if (!source) return;
    const previous = this.deposit.get(id);
    if (previous) {
      const layer = this.layer(source.layer);
      const dirty = this.dirtyTiles(source.layer);
      for (const [key, value] of previous) {
        layer.set(key, (layer.get(key) || 0) - value);
        dirty.add(tileKey(...key.split(",").map(Number)));
      }
      this.deposit.delete(id);
    }
    this.sources.delete(id);
  }

  // Layer.Sum(world, food, 1, threat, -2): a derived layer over other layers.
  derive(name, terms) {
    this.derivedLayers.set(name, terms);
    this.layer(name);
    return name;
  }

  // Process: re-emit only the sources whose state changed, and publish only the tiles they
  // touched. Integer adds commute, so the field is always the exact sum of live sources.
  process() {
    for (const source of this.sources.values()) {
      const next = depositOf(source);
      const previous = this.deposit.get(source.id);
      if (previous && sameDeposit(previous, next)) continue;
      const layer = this.layer(source.layer);
      const dirty = this.dirtyTiles(source.layer);
      if (previous) {
        for (const [key, value] of previous) {
          layer.set(key, (layer.get(key) || 0) - value);
          dirty.add(tileKey(...key.split(",").map(Number)));
        }
      }
      for (const [key, value] of next) {
        layer.set(key, (layer.get(key) || 0) + value);
        dirty.add(tileKey(...key.split(",").map(Number)));
      }
      this.deposit.set(source.id, next);
    }

    // Publish: the planes sum into short cells, and a tile keeps its sum and max exact.
    let published = 0;
    const snapshot = new Map();
    for (const [layer, dirty] of this.dirty) {
      if (!dirty.size) continue;
      snapshot.set(layer, new Set(dirty));
      const stats = this.tileStats(layer);
      for (const key of dirty) {
        stats.set(key, this.tileExtent(layer, key));
        published++;
      }
    }

    // Derived layers recombine only the tiles their inputs changed.
    for (const [name, terms] of this.derivedLayers) {
      const dirty = this.dirtyTiles(name);
      for (const [layer] of terms) {
        for (const key of snapshot.get(layer) || []) dirty.add(key);
      }
      const map = this.layer(name);
      const stats = this.tileStats(name);
      for (const key of dirty) {
        const [tx, ty] = key.split(",").map(Number);
        for (let j = ty * TILE; j < (ty + 1) * TILE; j++) {
          for (let i = tx * TILE; i < (tx + 1) * TILE; i++) {
            let sum = 0;
            for (const [layer, weight] of terms) sum += weight * this.value(layer, i, j);
            const cell = i + "," + j;
            if (sum) map.set(cell, sum); else map.delete(cell);
          }
        }
        stats.set(key, this.tileExtent(name, key));
      }
    }

    // The world is clean again: the next Process only sees what changed since this one.
    for (const dirty of this.dirty.values()) dirty.clear();

    let cells = 0;
    for (const dirty of snapshot.values()) cells += dirty.size;
    this.last = { tiles: cells, cells };
    this.processed++;
    return this.last;
  }

  tileExtent(layer, key) {
    const [tx, ty] = key.split(",").map(Number);
    let sum = 0;
    let max = 0;
    for (let j = ty * TILE; j < (ty + 1) * TILE; j++) {
      for (let i = tx * TILE; i < (tx + 1) * TILE; i++) {
        const v = this.value(layer, i, j);
        sum += v;
        if (v > max) max = v;
      }
    }
    return { sum, max };
  }

  value(layer, i, j) {
    const map = this.field.get(layer);
    return map ? map.get(i + "," + j) || 0 : 0;
  }

  // The max pyramid, level 1: each node holds the max over its 2 x 2 block of tiles.
  pyramid(layer) {
    const stats = this.tiles.get(layer) || new Map();
    const nodes = [];
    for (let ny = 0; ny < NODES; ny++) {
      for (let nx = 0; nx < NODES; nx++) {
        let max = 0;
        for (let ty = ny * NODE; ty < (ny + 1) * NODE; ty++) {
          for (let tx = nx * NODE; tx < (nx + 1) * NODE; tx++) {
            const t = stats.get(tx + "," + ty);
            if (t && t.max > max) max = t.max;
          }
        }
        nodes.push({ x: nx, y: ny, max });
      }
    }
    return nodes;
  }
}

function sameDeposit(a, b) {
  if (a.size !== b.size) return false;
  for (const [key, value] of a) if (b.get(key) !== value) return false;
  return true;
}
