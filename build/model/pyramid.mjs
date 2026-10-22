// Gi's max pyramid, modelled the way Gi builds it.
//
//   cells  -> tiles   -> nodes  -> root
//   1024²      32²         4²        1
//
// Gi's pyramid has a fan-out of 8: a node holds 8x8 child slots. For a 1024²
// grid that gives 1024 tiles, 16 nodes (each covering 8x8 tiles) and one root
// holding 16 live node slots.
//
// A descent reads the root's slots, picks the largest, descends into that
// node, reads its 64 tile slots, picks the largest, then loads that tile's
// 2048 B page and scans its 1024 cells. The maximum is preserved at every
// level, so all four numbers are the same value.
import { kernelValue, VALUE, KERNEL_PEAK, TILE } from "./field.mjs";

export const GRID_SIDE = 1024;
export const TILE_CELLS = 32;
export const TILES_PER_SIDE = GRID_SIDE / TILE_CELLS;      // 32
export const FANOUT = 8;
export const NODE_SIDE = TILES_PER_SIDE / FANOUT; // 4
export const NODE_COUNT = NODE_SIDE * NODE_SIDE;  // 16
export const CELLS_PER_TILE = TILE_CELLS * TILE_CELLS;         // 1024
export const PAGE_BYTES = CELLS_PER_TILE * 2;      // int16

// The sources on this field. A cone, a tent, a box, a disk and a second cone,
// each with its own gain: the field's peak is the strongest one, 90 * 5.
export const SOURCES = [
  { kind: "Cone", x: 300.5, y: 300.5, gain: 4 },
  { kind: "Tent", x: 700.5, y: 500.5, gain: 3 },
  { kind: "Box", x: 500.5, y: 800.5, gain: 2 },
  { kind: "Disk", x: 150.5, y: 900.5, gain: 1 },
  { kind: "Cone", x: 820.5, y: 180.5, gain: 5 },
];

// The cells one source deposits, as a Map from "i,j" to value.
function tapsOf(source) {
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
      if (v) cells.set(i + "," + j, v * source.gain);
    }
  }
  return cells;
}

export class Field {
  constructor(sources = SOURCES) {
    this.sources = sources;
    // tile key -> Map(cell key -> value)
    this.tiles = new Map();
    for (const source of sources) {
      for (const [key, value] of tapsOf(source)) {
        const [i, j] = key.split(",").map(Number);
        const tile = (j >> 5) * TILES_PER_SIDE + (i >> 5);
        let page = this.tiles.get(tile);
        if (!page) this.tiles.set(tile, (page = new Map()));
        page.set(key, (page.get(key) || 0) + value);
      }
    }
    this.tileStats = new Map();
    for (const [tile, page] of this.tiles) {
      let max = -Infinity;
      let argmax = null;
      for (const [key, value] of page) {
        if (value > max) {
          max = value;
          argmax = key;
        }
      }
      this.tileStats.set(tile, { max, argmax });
    }
  }

  tileOf(x, y) {
    return (y >> 5) * TILES_PER_SIDE + (x >> 5);
  }

  nodeOf(x, y) {
    return ((y >> 8) * NODE_SIDE) + (x >> 8);
  }

  // The tile's maximum, or 0 for a tile that holds no page at all.
  tileMax(tx, ty) {
    const stat = this.tileStats.get(ty * TILES_PER_SIDE + tx);
    return stat ? stat.max : 0;
  }

  tileArgmax(tx, ty) {
    const stat = this.tileStats.get(ty * TILES_PER_SIDE + tx);
    return stat ? stat.argmax : null;
  }

  // The node's maximum: the largest of the 8x8 tiles it covers.
  nodeMax(nx, ny) {
    let max = 0;
    for (let ty = ny * FANOUT; ty < ny * FANOUT + FANOUT; ty++) {
      for (let tx = nx * FANOUT; tx < nx * FANOUT + FANOUT; tx++) {
        const value = this.tileMax(tx, ty);
        if (value > max) max = value;
      }
    }
    return max;
  }

  // The root's maximum: the largest of the live node slots.
  rootMax() {
    let max = 0;
    for (let ny = 0; ny < NODE_SIDE; ny++) {
      for (let nx = 0; nx < NODE_SIDE; nx++) {
        const value = this.nodeMax(nx, ny);
        if (value > max) max = value;
      }
    }
    return max;
  }

  // The descent Gi performs for QueryMax: root -> node -> tile -> cell.
  // Returns the running maximum at each level, and the winning cell.
  descend(nx = null, ny = null) {
    const root = this.rootMax();
    if (nx === null) {
      let best = 0;
      for (let y = 0; y < NODE_SIDE; y++) {
        for (let x = 0; x < NODE_SIDE; x++) {
          const value = this.nodeMax(x, y);
          if (value > best) {
            best = value;
            nx = x;
            ny = y;
          }
        }
      }
    }
    const node = this.nodeMax(nx, ny);
    let bx = nx * FANOUT;
    let by = ny * FANOUT;
    let tile = 0;
    for (let ty = ny * FANOUT; ty < ny * FANOUT + FANOUT; ty++) {
      for (let tx = nx * FANOUT; tx < nx * FANOUT + FANOUT; tx++) {
        const value = this.tileMax(tx, ty);
        if (value > tile) {
          tile = value;
          bx = tx;
          by = ty;
        }
      }
    }
    const argmax = this.tileArgmax(bx, by);
    const cell = argmax ? argmax.split(",").map(Number) : [bx * TILE_CELLS, by * TILE_CELLS];
    return {
      root,
      node,
      tile,
      cell: cell[1] * VALUE >= 0 ? this.tileMax(bx, by) : 0,
      nodeX: nx,
      nodeY: ny,
      tileX: bx,
      tileY: by,
      cellX: cell[0],
      cellY: cell[1],
    };
  }

  // How many pyramid slots a descent reads, the way Gi's Visit loop counts them.
  slotsRead(nx, ny) {
    const liveNodes = NODE_SIDE * NODE_SIDE;
    const liveTiles = FANOUT * FANOUT;
    return { nodes: liveNodes, tiles: liveTiles, total: liveNodes + liveTiles };
  }
}
