// Gi's derived layer: safety = food - 2 * threat.
//
// This is the README's own example:
//
//   byte safety = Layer.Sum(world, food, 1, threat, -2);
//
// A derived layer is an ordinary layer handle whose cells always equal a
// formula over other layers. Two channels are deposited on one 32 x 32 tile,
// the formula is applied cell by cell, and the result answers every query a
// deposited layer answers - QueryMax included.
//
// The arithmetic is the model's, not the drawing's: build() runs the same
// World.process() the other figures run, so the sums, the maximum and the
// winning cell are the values Gi would publish.
import { World } from "./field.mjs";

// The two channels. A Dome of food and a Cone of threat, close enough that
// their footprints overlap and the formula has to decide between them.
export const FOOD = { kind: "Dome", x: 9.5, y: 9.5 };
export const THREAT = { kind: "Cone", x: 15.5, y: 15.5 };

// The README's weight on the threat channel.
export const THREAT_WEIGHT = 2;

// The tile both channels live on.
export const TILE_KEY = "0,0";

export function build(weight = THREAT_WEIGHT) {
  const world = new World();
  world.place("food", FOOD.kind, FOOD.x, FOOD.y, 1);
  world.place("threat", THREAT.kind, THREAT.x, THREAT.y, 1);
  world.derive("safety", [["food", 1], ["threat", -weight]]);
  world.process();

  const stat = (layer) => world.tiles.get(layer).get(TILE_KEY);
  return {
    weight,
    food: world.field.get("food"),
    threat: world.field.get("threat"),
    safety: world.field.get("safety"),
    foodSum: stat("food").sum,
    threatSum: stat("threat").sum,
    sum: stat("safety").sum,
    max: stat("safety").max,
    best: bestOf(world.field.get("safety")),
  };
}

// The cell that holds the largest value, the way QueryMax finds it.
export function bestOf(map) {
  let value = -Infinity;
  let key = null;
  for (const [cell, v] of map) {
    if (v > value) {
      value = v;
      key = cell;
    }
  }
  if (!key) return null;
  const [i, j] = key.split(",").map(Number);
  return { i, j, value, key };
}

// The two loads the balance carries: the food channel, and the threat channel
// counted the number of times the formula counts it.
export function loads(model) {
  const food = model.foodSum;
  const threat = model.threatSum * model.weight;
  return { food, threat, net: food - threat };
}

// How far the beam leans, in radians. The threat side goes down when it is
// the heavier load, so the lean is the ratio of the difference to the total.
export function tiltOf(model) {
  const { food, threat } = loads(model);
  return Math.atan((threat - food) / (threat + food));
}
