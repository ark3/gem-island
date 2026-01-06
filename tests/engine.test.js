import test from "node:test";
import assert from "node:assert/strict";

import { createManualIsland } from "../src/island.manual.js";
import { generateIsland } from "../src/island.generator.js";
import {
  applyAction,
  countCompletedNodes,
  createInitialState,
  evaluateCondition,
  getVisibleActions,
  hasItem,
  isFeatureVisible,
  isNodeVisited,
  isNodeCompleted,
} from "../src/island-engine.js";
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
  assert.equal(harness.getState().inventory.gem, 1);
});

test("say actions complete features without marking actions complete", () => {
  const island = createManualIsland();
  island.nodes.beach.features.push({
    id: "beach_sign",
    type: "sign",
    actionId: "beach_say",
  });
  island.nodes.beach.actions.push({
    id: "beach_say",
    kind: "say",
    label: "Say hi",
  });
  let state = createInitialState(island);
  const result = applyAction(island, state, "beach_say");
  state = result.state;
  assert.equal(state.completedFeatures.has("beach_sign"), true);
  assert.equal(state.completedActions.has("beach_say"), false);
});

test("completed removable actions are hidden but non-removable actions remain visible", () => {
  const island = createManualIsland();
  island.nodes.beach.actions.push({
    id: "beach_sign",
    kind: "say",
    label: "Read sign",
    removable: false,
  });
  island.nodes.beach.actions.push({
    id: "beach_pick_shell",
    kind: "pickup",
    label: "Pick Up Shell",
    item: "shell",
    amount: 1,
  });
  const state = createInitialState(island);
  state.completedActions.add("beach_sign");
  state.completedActions.add("beach_pick_shell");

  const visible = getVisibleActions(island, state, island.nodes.beach);
  const visibleIds = visible.map((action) => action.id);
  assert.equal(visibleIds.includes("beach_sign"), true);
  assert.equal(visibleIds.includes("beach_pick_shell"), false);
});

test("condition helpers check inventory and visited nodes", () => {
  const island = createManualIsland();
  let state = createInitialState(island);

  assert.equal(isNodeVisited(state, "ship"), true);
  assert.equal(isNodeVisited(state, "beach"), false);
  assert.equal(hasItem(state, "gem", 1), false);

  state = applyAction(island, state, "ship_move_north_beach").state;
  state = applyAction(island, state, "beach_pick_gem").state;

  assert.equal(isNodeVisited(state, "beach"), true);
  assert.equal(hasItem(state, "gem", 1), true);
  assert.equal(hasItem(state, "gem", 2), false);
});

test("evaluateCondition supports visited, inventory, and boolean combinators", () => {
  const island = createManualIsland();
  let state = createInitialState(island);

  assert.equal(evaluateCondition(island, state, null), true);
  assert.equal(evaluateCondition(island, state, { type: "visited", nodeId: "ship" }), true);
  assert.equal(evaluateCondition(island, state, { type: "visited", nodeId: "beach" }), false);

  state = applyAction(island, state, "ship_move_north_beach").state;
  state = applyAction(island, state, "beach_pick_gem").state;

  assert.equal(evaluateCondition(island, state, { type: "hasItem", item: "gem", amount: 1 }), true);
  assert.equal(evaluateCondition(island, state, { type: "hasItem", item: "gem", amount: 2 }), false);
  assert.equal(
    evaluateCondition(island, state, {
      all: [
        { type: "visited", nodeId: "beach" },
        { type: "hasItem", item: "gem", amount: 1 },
      ],
    }),
    true
  );
  assert.equal(
    evaluateCondition(island, state, {
      any: [
        { type: "visited", nodeId: "cave" },
        { type: "hasItem", item: "gem", amount: 1 },
      ],
    }),
    true
  );
  assert.equal(
    evaluateCondition(island, state, {
      not: { type: "hasItem", item: "gem", amount: 2 },
    }),
    true
  );
  assert.equal(
    evaluateCondition(island, state, {
      type: "featureComplete",
      featureId: "beach_gem_feature",
    }),
    true
  );
});

test("getVisibleActions hides actions until their condition is met", () => {
  const island = createManualIsland();
  island.nodes.beach.actions.push({
    id: "beach_bonus",
    kind: "pickup",
    label: "Pick Up Bonus",
    item: "gem",
    amount: 1,
    condition: { type: "visited", nodeId: "cave" },
  });
  let state = createInitialState(island);
  let visible = getVisibleActions(island, state, island.nodes.beach);
  assert.equal(visible.some((action) => action.id === "beach_bonus"), false);

  state = applyAction(island, state, "ship_move_north_beach").state;
  state = applyAction(island, state, "beach_move_east_cave").state;
  state = applyAction(island, state, "cave_move_west_beach").state;

  visible = getVisibleActions(island, state, island.nodes.beach);
  assert.equal(visible.some((action) => action.id === "beach_bonus"), true);
});

test("say actions complete quest-giver features when conditions are met", () => {
  const island = createManualIsland();
  island.nodes.beach.features.push({
    id: "beach_farmer",
    type: "person",
    actionId: "beach_talk_farmer",
  });
  island.nodes.beach.actions.push({
    id: "beach_talk_farmer",
    kind: "say",
    label: "Talk",
    condition: { type: "visited", nodeId: "cave" },
    dialog: {
      incomplete: "Have you seen the cave?",
      success: "Thanks for finding the cave!",
      complete: "Thanks again!",
    },
  });

  let state = createInitialState(island);
  let result = applyAction(island, state, "beach_talk_farmer");
  state = result.state;
  assert.equal(state.completedFeatures.has("beach_farmer"), false);
  assert.equal(result.events.at(-1)?.message, "Have you seen the cave?");

  state = applyAction(island, state, "ship_move_north_beach").state;
  state = applyAction(island, state, "beach_move_east_cave").state;
  state = applyAction(island, state, "cave_move_west_beach").state;
  result = applyAction(island, state, "beach_talk_farmer");
  state = result.state;
  assert.equal(state.completedFeatures.has("beach_farmer"), true);
  assert.equal(result.events.at(-1)?.message, "Thanks for finding the cave!");

  result = applyAction(island, state, "beach_talk_farmer");
  assert.equal(result.events.at(-1)?.message, "Thanks again!");
});

test("say actions branch dialog and consume items when conditions are met", () => {
  const island = createManualIsland();
  island.nodes.beach.features.push({
    id: "beach_fisher",
    type: "person",
    actionId: "beach_talk_fisher",
  });
  island.nodes.beach.actions.push({
    id: "beach_talk_fisher",
    kind: "say",
    label: "Talk",
    condition: { type: "hasItem", item: "shell", amount: 2 },
    consume: { item: "shell", amount: 2 },
    dialog: {
      incomplete: "Could you bring me two shells?",
      success: "Wonderful shells, thanks!",
      complete: "Thanks for the shells.",
    },
  });

  let state = createInitialState(island);
  state = {
    ...state,
    inventory: {
      ...state.inventory,
      shell: 1,
    },
  };

  let result = applyAction(island, state, "beach_talk_fisher");
  state = result.state;
  assert.equal(result.events.at(-1)?.message, "Could you bring me two shells?");
  assert.equal(result.events.at(-1)?.variant, "neutral");
  assert.equal(state.completedFeatures.has("beach_fisher"), false);
  assert.equal(state.inventory.shell, 1);

  state = {
    ...state,
    inventory: {
      ...state.inventory,
      shell: 2,
    },
  };
  result = applyAction(island, state, "beach_talk_fisher");
  state = result.state;
  assert.equal(result.events.at(-1)?.message, "Wonderful shells, thanks!");
  assert.equal(result.events.at(-1)?.variant, "success");
  assert.equal(state.completedFeatures.has("beach_fisher"), true);
  assert.equal(state.inventory.shell, 0);

  result = applyAction(island, state, "beach_talk_fisher");
  assert.equal(result.events.at(-1)?.message, "Thanks for the shells.");
  assert.equal(result.events.at(-1)?.variant, "success");
});

test("feature visibility respects featureComplete conditions", () => {
  const island = createManualIsland();
  const feature = {
    id: "reward_gem",
    type: "gem",
    condition: { type: "featureComplete", featureId: "beach_farmer" },
  };
  let state = createInitialState(island);
  assert.equal(isFeatureVisible(feature, state, island), false);

  state = {
    ...state,
    completedFeatures: new Set(["beach_farmer"]),
  };
  assert.equal(isFeatureVisible(feature, state, island), true);
});

test("reward gems gated by quest completion remain hidden until the quest completes", () => {
  const island = createManualIsland();
  island.nodes.beach.features.push({
    id: "beach_quest_giver",
    type: "person",
    actionId: "beach_talk_quest",
  });
  island.nodes.beach.actions.push({
    id: "beach_talk_quest",
    kind: "say",
    label: "Talk",
    condition: { type: "visited", nodeId: "cave" },
    dialog: {
      incomplete: "Have you been to the cave?",
      success: "Thanks for visiting the cave!",
      complete: "Thanks again!",
    },
  });
  island.nodes.beach.features.push({
    id: "beach_reward_gem",
    type: "gem",
    actionId: "beach_reward_pickup",
    condition: { type: "featureComplete", featureId: "beach_quest_giver" },
  });
  island.nodes.beach.actions.push({
    id: "beach_reward_pickup",
    kind: "pickup",
    label: "Pick Up Gem",
    item: "gem",
    amount: 1,
    condition: { type: "featureComplete", featureId: "beach_quest_giver" },
  });

  let state = createInitialState(island);
  let actions = getVisibleActions(island, state, island.nodes.beach);
  assert.equal(actions.some((action) => action.id === "beach_reward_pickup"), false);

  state = applyAction(island, state, "ship_move_north_beach").state;
  state = applyAction(island, state, "beach_move_east_cave").state;
  state = applyAction(island, state, "cave_move_west_beach").state;
  state = applyAction(island, state, "beach_talk_quest").state;

  actions = getVisibleActions(island, state, island.nodes.beach);
  assert.equal(actions.some((action) => action.id === "beach_reward_pickup"), true);

  const pickup = applyAction(island, state, "beach_reward_pickup");
  assert.equal(pickup.state.inventory.gem, 1);
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

test("visiting generated nodes without actions immediately counts toward completion", () => {
  const island = generateIsland({ random: createSeededRandom(31) });
  const emptyNode = Object.values(island.nodes).find(
    (node) => node.id !== "ship" && node.actions.every((action) => action.kind === "move")
  );
  assert.ok(emptyNode, "expected at least one zero-action node");
  let state = createInitialState(island);
  const before = countCompletedNodes(island, state);
  const graph = buildMovementGraph(island);
  const path = findMovementPath(graph, state.currentNodeId, emptyNode.id);
  path.forEach((actionId) => {
    const result = applyAction(island, state, actionId);
    state = result.state;
  });
  const after = countCompletedNodes(island, state);
  assert.ok(after > before, "visiting a zero-action node should increase completion");
});

test("completing gem hosts on generated islands advances derived completion", () => {
  const island = generateIsland({ random: createSeededRandom(37) });
  const gemEntry = listGemPickups(island)[0];
  assert.ok(gemEntry, "expected at least one gem pickup");
  let state = createInitialState(island);
  const graph = buildMovementGraph(island);
  const path = findMovementPath(graph, state.currentNodeId, gemEntry.nodeId);
  path.forEach((actionId) => {
    const result = applyAction(island, state, actionId);
    state = result.state;
  });
  const before = countCompletedNodes(island, state);
  const pickup = applyAction(island, state, gemEntry.actionId);
  state = pickup.state;
  const after = countCompletedNodes(island, state);
  assert.equal(after, before + 1, "finishing the pickup should mark the host node as completed");
});

test("nodes only report completion when every feature is done", () => {
  const node = {
    id: "test-node",
    features: [
      { id: "feature_one", type: "gem" },
      { id: "feature_two", type: "ship" },
    ],
  };
  const baseState = {
    completedFeatures: new Set(),
  };
  assert.equal(isNodeCompleted(node, baseState), false, "no features complete yet");

  const partialState = {
    completedFeatures: new Set(["feature_one"]),
  };
  assert.equal(isNodeCompleted(node, partialState), false, "partial completion should not finish node");

  const fullState = {
    completedFeatures: new Set(["feature_one", "feature_two"]),
  };
  assert.equal(isNodeCompleted(node, fullState), true, "all features completed should finish node");
});

test("generated islands can be completed via movement and pickups", () => {
  const startSeed = 3;
  const totalSeeds = 25;
  for (let offset = 0; offset < totalSeeds; offset += 1) {
    const seed = startSeed + offset;
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
      const node = island.nodes[entry.nodeId];
      const pickupActions = node.actions.filter((action) => action.kind === "pickup");
      pickupActions.forEach((action) => {
        const pickup = play(action.id);
        if (action.item === "gem") {
          const message = pickup.events.at(-1)?.message || "";
          assert.ok(message.includes("picked up a gem"), "pickup should emit gem toast");
        }
      });
    });

    const returnPath = findMovementPath(graph, state.currentNodeId, "ship");
    returnPath.forEach((moveAction) => play(moveAction));

    const finish = play("ship_leave");
    assert.equal(finish.events.at(-1)?.message, "Success!");
    assert.equal(state.status, "success");
    assert.equal(state.inventory.gem, island.requiredGems);

    const completed = countCompletedNodes(island, state);
    assert.ok(
      completed >= gemPickups.length + 1,
      `expected at least ship plus gem hosts completed for seed ${seed}`
    );
  }
});
