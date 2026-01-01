import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_GRID_BOUNDS, generateIsland } from "../src/island.generator.js";

function createCycleRandom(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("Random sequence must contain at least one value");
  }
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
}

test("generated surface nodes stay within bounds and movements are reversible", () => {
  const island = generateIsland({ random: createCycleRandom([0.1, 0.7, 0.3, 0.9]) });
  const nodes = Object.values(island.nodes);
  assert.ok(nodes.length >= 6 && nodes.length <= 8, "node count should match configured range");

  nodes.forEach((node) => {
    assert.ok(node.position, `node ${node.id} is missing a position`);
    assert.ok(
      node.position.x >= DEFAULT_GRID_BOUNDS.minX && node.position.x <= DEFAULT_GRID_BOUNDS.maxX,
      `node ${node.id} x=${node.position.x} is outside bounds`
    );
    assert.ok(
      node.position.y >= DEFAULT_GRID_BOUNDS.minY && node.position.y <= DEFAULT_GRID_BOUNDS.maxY,
      `node ${node.id} y=${node.position.y} is outside bounds`
    );
    const movementActions = node.actions.filter((action) => action.kind === "move");
    movementActions.forEach((action) => {
      assert.ok(action.to, `move action ${action.id} lacks destination`);
      const destination = island.nodes[action.to];
      assert.ok(destination, `destination node ${action.to} missing for action ${action.id}`);
      const reverse = destination.actions.find((entry) => entry.kind === "move" && entry.to === node.id);
      assert.ok(reverse, `move ${action.id} does not have a matching return path`);
    });
  });
});

test("ship starts on the south edge with no southern neighbors", () => {
  const island = generateIsland({ random: createCycleRandom([0.5, 0.6, 0.7, 0.1]) });
  const ship = island.nodes.ship;
  assert.ok(ship, "ship node must exist");
  const shipY = ship.position.y;
  assert.equal(shipY, DEFAULT_GRID_BOUNDS.maxY, "ship should sit at the southern boundary");
  Object.values(island.nodes).forEach((node) => {
    assert.ok(node.position.y <= shipY, `node ${node.id} should not sit south of the ship`);
  });
  ship.actions
    .filter((action) => action.kind === "move")
    .forEach((action) => {
      const destination = island.nodes[action.to];
      const deltaY = destination.position.y - shipY;
      assert.notEqual(deltaY, 1, "ship should not have a movement action going further south");
    });
});

test("generated islands expose gem pickups that match the required total", () => {
  const island = generateIsland({ random: createCycleRandom([0.2, 0.8, 0.4, 0.6]) });
  const nodes = Object.values(island.nodes);
  const ship = island.nodes.ship;
  assert.ok(ship, "ship node must exist");
  assert.ok(
    ship.actions.some((action) => action.kind === "ship"),
    "ship node must include the ship action"
  );

  const gemActions = [];
  nodes.forEach((node) => {
    node.actions
      .filter((action) => action.kind === "pickup" && action.item === "gem")
      .forEach((action) => gemActions.push(action));
  });

  assert.ok(gemActions.length >= 3 || nodes.length <= 4, "expected at least three gem pickups");
  assert.equal(island.requiredGems, gemActions.length, "required gem count should equal pickup actions");
});

test("surface graph remains connected via movement actions", () => {
  const island = generateIsland({ random: createCycleRandom([0.33, 0.66, 0.1, 0.9]) });
  const visited = new Set();
  const queue = ["ship"];
  while (queue.length) {
    const nodeId = queue.shift();
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    const node = island.nodes[nodeId];
    node.actions
      .filter((action) => action.kind === "move" && action.to && !visited.has(action.to))
      .forEach((action) => queue.push(action.to));
  }
  assert.equal(visited.size, Object.keys(island.nodes).length, "all nodes should be reachable from the ship");
});
