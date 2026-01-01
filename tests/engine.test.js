import test from "node:test";
import assert from "node:assert/strict";

import { TypingEngine } from "../src/typing-engine.js";
import { createManualIsland } from "../src/island.manual.js";
import {
  applyAction,
  countCompletedNodes,
  createInitialState,
  getCurrentNode,
  getVisibleActions,
} from "../src/island-engine.js";

function createRunHarness() {
  const island = createManualIsland();
  let state = createInitialState(island);

  function playPrompt(prompt) {
    const node = getCurrentNode(island, state);
    const action =
      getVisibleActions(island, state, node).find((entry) => entry.prompt === prompt) || null;
    assert.ok(action, `No action with prompt "${prompt}" at node "${node?.id}"`);
    const result = applyAction(island, state, action.id);
    state = result.state;
    return { action, ...result };
  }

  return {
    island,
    playPrompt,
    getState: () => state,
  };
}

test("ship refuses to leave before collecting enough gems", () => {
  const harness = createRunHarness();
  harness.playPrompt("cat"); // ship -> beach
  harness.playPrompt("dog"); // beach -> ship

  const result = harness.playPrompt("sun");
  assert.equal(harness.getState().status, "playing");
  assert.equal(result.events.at(-1).message, "You need 2 gems to finish. You have 0 gems right now.");
});

test("player can collect both gems and complete the run", () => {
  const harness = createRunHarness();
  harness.playPrompt("cat"); // ship -> beach

  const pickupOne = harness.playPrompt("pen");
  assert.equal(
    pickupOne.events.at(-1).message,
    "You picked up a gem! Now you have 1 gem."
  );

  harness.playPrompt("hat"); // beach -> cave
  const pickupTwo = harness.playPrompt("cup");
  assert.equal(
    pickupTwo.events.at(-1).message,
    "You picked up a gem! Now you have 2 gems."
  );

  harness.playPrompt("ram"); // cave -> beach
  harness.playPrompt("dog"); // beach -> ship

  const finish = harness.playPrompt("sun");
  assert.equal(finish.events.at(-1).message, "Success!");
  assert.equal(harness.getState().status, "success");
  assert.equal(countCompletedNodes(harness.island, harness.getState()), 3);
});

test("pickup actions cannot be repeated for extra gems", () => {
  const harness = createRunHarness();
  harness.playPrompt("cat"); // ship -> beach

  const firstPickup = harness.playPrompt("pen");
  assert.equal(firstPickup.events.at(-1).message, "You picked up a gem! Now you have 1 gem.");

  const repeat = harness.playPrompt("pen");
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
