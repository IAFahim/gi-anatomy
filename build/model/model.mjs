// Gi kernel model, in Gi's own fixed-point units.
//   CELL = 512 Q-units per cell (Gi's CellHalf), HALF = 256 (Gi's CellHalf/2).
export const CELL = 512n;
export const HALF = 256n;

const roundQ24 = (v) => Number((v + (1n << 23n)) >> 24n);
const root = (v) => {
  const r = BigInt(Math.floor(Math.sqrt(Number(v))));
  if (r * r > v) return r - 1n;
  return (r + 1n) * (r + 1n) <= v ? r + 1n : r;
};
const bitLength = (v) => { let n = 0; while (v > 0n) { v >>= 1n; n++; } return n; };

// Gi's RoundAt for the round kinds (Disk, Cone, Dome). reachQ is the radius in Q units.
export function roundAt(kind, dx, dy, reachQ, value) {
  const distance = dx * dx + dy * dy;
  const reach = reachQ;
  const reachSq = reach * reach;
  let weight;
  if (kind === "Disk") {
    const bound = reach + HALF;
    if (distance >= bound * bound) return 0;
    const inner = reach > HALF - 1n ? (reach - (HALF - 1n)) ** 2n : 0n;
    if (distance < inner) weight = (CELL < 2n * reach ? CELL : 2n * reach) << 7n;
    else {
      const edge = reach - root(distance) + HALF;
      const a = edge < CELL ? edge : CELL;
      const b = 2n * reach;
      weight = (a < b ? a : b) << 7n;
    }
  } else {
    if (distance >= reachSq) return 0;
    if (kind === "Cone") {
      const inv = ((1n << 48n) + reach - 1n) / reach;
      weight = ((reach - root(distance)) * inv) >> 32n;
    } else {
      const reduce = BigInt(Math.max(0, bitLength(reachSq) - 46));
      const reduced = reachSq >> reduce;
      const inv = ((1n << 62n) - 1n) / reduced + 1n;
      weight = (((reachSq - distance) >> reduce) * inv) >> 46n;
    }
  }
  return roundQ24(BigInt(value) * weight * 256n);
}

// Gi's separable tent and bell, in exact rational arithmetic.
const frac = (d, h, kind) => {
  const t = Math.abs(d) / h;
  if (t >= 1) return 0;
  return kind === "lin" ? 1 - t : 1 - t * t;
};
export function tentAt(dx, dy, halfCells, value) {
  return Math.round(value * frac(dx, halfCells, "lin") * frac(dy, halfCells, "lin"));
}
export function bellAt(dx, dy, halfCells, value) {
  return Math.round(value * frac(dx, halfCells, "quad") * frac(dy, halfCells, "quad"));
}

// Gi's box: a 2D difference array, so each cell holds the rect's overlap in x times in y.
export function boxAt(dx, dy, halfCells, value) {
  const ox = Math.min(halfCells, dx + 0.5) - Math.max(-halfCells, dx - 0.5);
  const oy = Math.min(halfCells, dy + 0.5) - Math.max(-halfCells, dy - 0.5);
  const cx = Math.min(Math.max(ox, 0), 1);
  const cy = Math.min(Math.max(oy, 0), 1);
  return Math.round(value * cx * cy);
}
