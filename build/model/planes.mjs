// Gi's per-tile planes.
//
// A live tile owns four planes and a summary:
//
//   page    int16   2 048 B   the published cells every query reads
//   I       int32   4 096 B   box, raster and round contributions
//   T       int64   8 192 B   tent contributions, unrounded
//   B       int64   8 192 B   bell contributions, unrounded
//   summary         256 B     the tile's exact sum and max
//
// The four sources below are placed so their footprints do not overlap, so
// every published cell comes from exactly one plane and the sum is visible
// without any rounding to argue about.
import { kernelValue, VALUE, KERNEL_PEAK } from "./field.mjs";

export const TILE_CELLS = 32;
export const PLANE_CELLS = TILE_CELLS * TILE_CELLS;

export const PLANE_BYTES = { page: 2048, I: 4096, T: 8192, B: 8192, summary: 256 };
export const PLANE_LIVE = PLANE_BYTES.page + PLANE_BYTES.I + PLANE_BYTES.T + PLANE_BYTES.B;

// Which plane each stamp kind writes into.
export const PLANE_OF = { Box: "I", New: "I", Disk: "I", Cone: "I", Tent: "T", Bell: "B" };

export const SOURCES = [
  { kind: "Cone", x: 8.5, y: 8.5, gain: 2, plane: "I" },
  { kind: "Box", x: 23.5, y: 8.5, gain: 1, plane: "I" },
  { kind: "Tent", x: 8.5, y: 23.5, gain: 3, plane: "T" },
  { kind: "Bell", x: 23.5, y: 23.5, gain: 1, plane: "B" },
];

// The cells one source deposits, as a Map from "i,j" to value.
function tapsOf(source) {
  const cells = new Map();
  const half = KERNEL_PEAK[source.kind];
  const reach = Math.ceil(half) + 1;
  for (let j = Math.floor(source.y) - reach; j <= Math.floor(source.y) + reach; j++) {
    for (let i = Math.floor(source.x) - reach; i <= Math.floor(source.x) + reach; i++) {
      const v = kernelValue(source.kind, source.x, source.y, i, j);
      if (v) cells.set(i + "," + j, v * source.gain);
    }
  }
  return cells;
}

export class Tile {
  constructor(sources = SOURCES) {
    this.sources = sources;
    this.planes = { I: new Map(), T: new Map(), B: new Map() };
    this.page = new Map();
    for (const source of sources) {
      for (const [key, value] of tapsOf(source)) {
        const plane = this.planes[source.plane];
        plane.set(key, (plane.get(key) || 0) + value);
      }
    }
    // Publish: the planes sum into the short cells, after summation.
    for (const plane of Object.values(this.planes)) {
      for (const [key, value] of plane) {
        this.page.set(key, (this.page.get(key) || 0) + value);
      }
    }
    let sum = 0;
    let max = 0;
    for (const value of this.page.values()) {
      sum += value;
      if (value > max) max = value;
    }
    this.sum = sum;
    this.max = max;
    this.stored = this.page.size;      // only cells that differ are stored
  }

  // The four numbers behind one cell.
  cell(i, j) {
    const key = i + "," + j;
    return {
      I: this.planes.I.get(key) || 0,
      T: this.planes.T.get(key) || 0,
      B: this.planes.B.get(key) || 0,
      page: this.page.get(key) || 0,
    };
  }

  // Which plane touched this cell, and how many cells that plane holds.
  planeCells(plane) {
    return this.planes[plane].size;
  }
}

export const VALUE_STAMP = VALUE;
