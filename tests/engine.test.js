import test from "node:test";
import assert from "node:assert/strict";

import { createManualIsland } from "../src/island.manual.js";
import { generateIsland } from "../src/island.generator.js";
import { applyAction, countCompletedNodes, createInitialState } from "../src/island-engine.js";
import { TypingEngine } from "../src/typing-engine.js";
import { createSeededRandom } from "./helpers/random.js";

function createRunHarness() {
  const island = createManualIsland();
  let state = createInitialState(island);

  function playAction(actionId) {
    const result = applyAction(island, state, actionId);
    state = result.state;
    return { actionId, ...result };
  }

  return {
    island,
    playAction,
    getState: () => state,
  };
}

test("ship refuses to leave before collecting enough gems", () => {
  const harness = createRunHarness();
  harness.playAction("ship_move_north_beach"); // ship -> beach
  harness.playAction("beach_move_south_ship"); // beach -> ship

  const result = harness.playAction("ship_leave");
  assert.equal(harness.getState().status, "playing");
  assert.equal(result.events.at(-1).message, "You need 2 gems to finish. You have 0 gems right now.");
});

test("player can collect both gems and complete the run", () => {
  const harness = createRunHarness();
  harness.playAction("ship_move_north_beach");

  const pickupOne = harness.playAction("beach_pick_gem");
  assert.equal(
    pickupOne.events.at(-1).message,
    "You picked up a gem! Now you have 1 gem."
  );

  harness.playAction("beach_move_east_cave");
  const pickupTwo = harness.playAction("cave_pick_gem");
  assert.equal(
    pickupTwo.events.at(-1).message,
    "You picked up a gem! Now you have 2 gems."
  );

  harness.playAction("cave_move_west_beach");
  harness.playAction("beach_move_south_ship");

  const finish = harness.playAction("ship_leave");
  assert.equal(finish.events.at(-1).message, "Success!");
  assert.equal(harness.getState().status, "success");
  assert.equal(countCompletedNodes(harness.island, harness.getState()), 3);
});

test("pickup actions cannot be repeated for extra gems", () => {
  const harness = createRunHarness();
  harness.playAction("ship_move_north_beach");

  const firstPickup = harness.playAction("beach_pick_gem");
  assert.equal(firstPickup.events.at(-1).message, "You picked up a gem! Now you have 1 gem.");

  const repeat = harness.playAction("beach_pick_gem");
  assert.equal(repeat.events.length, 0);
  assert.equal(harness.getState().gemsCollected, 1);
});

test("typing engine matches prompts and clears buffer on activation", () => {
  const actions = [
    { id: "go", label: "Go North", prompt: "cat" },
    { id: "wait", label: "Wait", prompt: "sun" },
  ];

  let lastBuffer = "";
  let lastMatchId = null;
  let activated = null;

  const engine = new TypingEngine({
    actions,
    onActivate: (action) => {
      activated = action.id;
    },
    onBufferChange: (buffer, match) => {
      lastBuffer = buffer;
      lastMatchId = match?.id || null;
    },
  });

  engine.append("c");
  engine.append("a");
  engine.append("t");
  assert.equal(lastBuffer, "cat");
  assert.equal(lastMatchId, "go");

  const didActivate = engine.activateMatch();
  assert.equal(didActivate, true);
  assert.equal(activated, "go");
  assert.equal(lastBuffer, "");
  assert.equal(lastMatchId, null);

  engine.setActions([actions[1]]);
  engine.append("s");
  engine.append("u");
  engine.backspace();
  engine.append("u");
  engine.append("n");
  assert.equal(lastMatchId, "wait");

  engine.backspace();
  engine.backspace();
  engine.backspace();
  engine.backspace(); // extra backspace on empty buffer
  assert.equal(lastBuffer, "");
  assert.equal(lastMatchId, null);

  engine.append(" ");
  assert.equal(lastBuffer, " ");
  assert.equal(lastMatchId, null);
  engine.append("s");
  engine.append("u");
  engine.append("n");
  assert.equal(lastBuffer, " sun");
  assert.equal(lastMatchId, "wait");
});

function listGemPickups(island) {
  const entries = [];
  Object.values(island.nodes).forEach((node) => {
    node.actions
      .filter((action) => action.kind === "pickup" && action.item === "gem")
      .forEach((action) => entries.push({ nodeId: node.id, actionId: action.id }));
  });
  return entries;
}

function buildMovementGraph(island) {
  const graph = new Map();
  Object.values(island.nodes).forEach((node) => {
    const edges = node.actions
      .filter((action) => action.kind === "move" && action.to)
      .map((action) => ({ to: action.to, actionId: action.id }));
    graph.set(node.id, edges);
  });
  return graph;
}

function findMovementPath(graph, start, goal) {
  if (start === goal) {
    return [];
  }
  const queue = [start];
  const visited = new Set([start]);
  const prev = new Map();
  while (queue.length) {
    const current = queue.shift();
    const edges = graph.get(current) || [];
    for (const edge of edges) {
      if (visited.has(edge.to)) continue;
      visited.add(edge.to);
      prev.set(edge.to, { from: current, actionId: edge.actionId });
      if (edge.to === goal) {
        queue.length = 0;
        break;
      }
      queue.push(edge.to);
    }
  }

  if (!prev.has(goal)) {
    throw new Error(`No path from ${start} to ${goal}`);
  }

  const path = [];
  let cursor = goal;
  while (cursor !== start) {
    const link = prev.get(cursor);
    if (!link) break;
    path.push(link.actionId);
    cursor = link.from;
  }
  return path.reverse();
}

test("generated islands can be completed via movement and pickups", () => {
  const seeds = [3, 17, 77];
  seeds.forEach((seed) => {
    const island = generateIsland({ random: createSeededRandom(seed) });
    let state = createInitialState(island);
    const graph = buildMovementGraph(island);
    const gemPickups = listGemPickups(island);
    assert.equal(gemPickups.length, island.requiredGems, "generated gem count should match requirement");

    function play(actionId) {
      const result = applyAction(island, state, actionId);
      state = result.state;
      return result;
    }

    gemPickups.forEach((entry) => {
      const path = findMovementPath(graph, state.currentNodeId, entry.nodeId);
      path.forEach((moveAction) => play(moveAction));
      const pickup = play(entry.actionId);
      const message = pickup.events.at(-1)?.message || "";
      assert.ok(message.includes("picked up a gem"), "pickup should emit gem toast");
    });

    const returnPath = findMovementPath(graph, state.currentNodeId, "ship");
    returnPath.forEach((moveAction) => play(moveAction));

    const finish = play("ship_leave");
    assert.equal(finish.events.at(-1)?.message, "Success!");
    assert.equal(state.status, "success");
    assert.equal(state.gemsCollected, island.requiredGems);

    const completed = countCompletedNodes(island, state);
    assert.ok(
      completed >= gemPickups.length + 1,
      `expected at least ship plus gem hosts completed for seed ${seed}`
    );
  });
});
