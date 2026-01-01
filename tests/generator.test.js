import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_GRID_BOUNDS, generateIsland } from "../src/island.generator.js";
import { CARDINAL_DIRECTIONS } from "../src/island-utils.js";
import { createCycleRandom, createSeededRandom } from "./helpers/random.js";

function getMovementActions(node) {
  return node.actions.filter((action) => action.kind === "move");
}

function getGemActions(island) {
  const actions = [];
  Object.values(island.nodes).forEach((node) => {
    node.actions
      .filter((action) => action.kind === "pickup" && action.item === "gem")
      .forEach((action) => actions.push({ node, action }));
  });
  return actions;
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
    getMovementActions(node).forEach((action) => {
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
  getMovementActions(ship).forEach((action) => {
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

  const gemActions = getGemActions(island).map((entry) => entry.action);

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

test("custom bounds and node limits are honored", () => {
  const customBounds = { minX: -3, maxX: 3, minY: -2, maxY: 2 };
  const island = generateIsland({
    bounds: customBounds,
    minNodes: 8,
    maxNodes: 9,
    random: createSeededRandom(7),
  });
  const nodes = Object.values(island.nodes);
  assert.ok(nodes.length >= 8 && nodes.length <= 9, "node count should respect the provided range");

  nodes.forEach((node) => {
    assert.ok(node.position, `node ${node.id} must have a position`);
    assert.ok(
      node.position.x >= customBounds.minX && node.position.x <= customBounds.maxX,
      `node ${node.id} violates custom x bounds`
    );
    assert.ok(
      node.position.y >= customBounds.minY && node.position.y <= customBounds.maxY,
      `node ${node.id} violates custom y bounds`
    );
  });

  assert.equal(
    island.nodes.ship.position.y,
    customBounds.maxY,
    "ship should respect custom bounds for its starting position"
  );
});

test("ship and gem nodes expose matching feature payloads", () => {
  const island = generateIsland({ random: createSeededRandom(5) });
  const ship = island.nodes.ship;
  const shipFeature = (ship.features || []).find((feature) => feature.type === "ship");
  assert.ok(shipFeature, "ship feature should exist");
  assert.ok(ship.actions.some((action) => action.id === shipFeature.actionId), "ship feature must reference an action");

  const gemEntries = getGemActions(island);
  assert.ok(gemEntries.length > 0, "expected at least one gem host");
  gemEntries.forEach(({ node, action }) => {
    const feature = node.features.find((entry) => entry.type === "gem" && entry.actionId === action.id);
    assert.ok(feature, `gem node ${node.id} should expose a matching feature`);
    assert.equal(feature.amount, 1, "gem feature must report its amount");
  });
});

test("movement labels stay aligned with spatial directions", () => {
  const island = generateIsland({ random: createSeededRandom(13) });
  const directionLookup = new Map();
  CARDINAL_DIRECTIONS.forEach((direction) => {
    directionLookup.set(`${direction.dx},${direction.dy}`, direction);
  });
  Object.values(island.nodes).forEach((node) => {
    getMovementActions(node).forEach((action) => {
      const destination = island.nodes[action.to];
      assert.ok(destination?.position, `move action ${action.id} should target a positioned node`);
      const dx = destination.position.x - node.position.x;
      const dy = destination.position.y - node.position.y;
      const direction = directionLookup.get(`${dx},${dy}`);
      assert.ok(direction, `move ${action.id} should stay within cardinal directions`);
      assert.equal(action.label, direction.label, `move ${action.id} label should match its direction`);
    });
  });
});

test("multiple seeds continue to respect generator invariants", () => {
  const seeds = [1, 2, 3, 4, 5, 42, 99];
  seeds.forEach((seed) => {
    const island = generateIsland({ random: createSeededRandom(seed) });
    const nodes = Object.values(island.nodes);
    assert.ok(nodes.length >= 6 && nodes.length <= 8, "default node range should hold");

    const coordinates = new Set();
    nodes.forEach((node) => {
      const key = `${node.position?.x},${node.position?.y}`;
      assert.ok(!coordinates.has(key), `duplicate position detected for ${node.id}`);
      coordinates.add(key);
      assert.ok(node.position, `node ${node.id} missing position`);
      assert.ok(
        node.position.x >= DEFAULT_GRID_BOUNDS.minX && node.position.x <= DEFAULT_GRID_BOUNDS.maxX,
        `node ${node.id} exceeds default bounds`
      );
      assert.ok(
        node.position.y >= DEFAULT_GRID_BOUNDS.minY && node.position.y <= DEFAULT_GRID_BOUNDS.maxY,
        `node ${node.id} exceeds default bounds`
      );
    });

    const visited = new Set();
    const queue = ["ship"];
    while (queue.length) {
      const nodeId = queue.shift();
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      island.nodes[nodeId].actions
        .filter((action) => action.kind === "move" && action.to && !visited.has(action.to))
        .forEach((action) => queue.push(action.to));
    }
    assert.equal(
      visited.size,
      Object.keys(island.nodes).length,
      `all nodes should remain reachable for seed ${seed}`
    );

    const gemActions = getGemActions(island);
    assert.equal(
      gemActions.length,
      island.requiredGems,
      `required gem count should match pickup actions for seed ${seed}`
    );
    assert.ok(
      gemActions.length === 0 || gemActions.length >= 3,
      `seed ${seed} should host at least three gems unless map is tiny`
    );
  });
});
