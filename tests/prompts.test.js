import test from "node:test";
import assert from "node:assert/strict";

import { TypingEngine } from "../src/typing-engine.js";
import { createPromptTrainer } from "../src/prompt-trainer.js";
import { createPromptService } from "../src/prompt-service.js";

function createStubTrainer(sequence) {
  let index = 0;
  const prompts = Array.from(sequence);
  if (!prompts.length) {
    throw new Error("Sequence must contain at least one prompt");
  }
  return {
    nextPrompt() {
      const prompt = prompts[index % prompts.length];
      index += 1;
      return prompt;
    },
  };
}

test("prompt trainer uses provided word list and random function", () => {
  const randomValues = [0.1, 0.9];
  const trainer = createPromptTrainer({
    prompts: ["alpha", "beta"],
    random: () => randomValues.shift() ?? 0,
  });

  assert.equal(trainer.nextPrompt(), "alpha");
  assert.equal(trainer.nextPrompt(), "beta");
});

test("prompt service avoids duplicate prompts per view", () => {
  const trainer = createStubTrainer(["cat", "cat", "dog"]);
  const service = createPromptService({ trainer });
  const used = new Set();

  const first = service.getPrompt("a1", used);
  used.add(first);
  const second = service.getPrompt("a2", used);
  used.add(second);

  assert.equal(first, "cat");
  assert.equal(second, "dog");
});

test("prompt service does not cache prompts between calls", () => {
  const trainer = createStubTrainer(["one", "two", "three"]);
  const service = createPromptService({ trainer });

  const first = service.getPrompt("action");
  const second = service.getPrompt("action");
  const third = service.getPrompt("action");

  assert.equal(first, "one");
  assert.equal(second, "two");
  assert.equal(third, "three");

  service.refresh("action");
  service.reset();
});

test("typing engine activates the action whose prompt was assigned", () => {
  const trainer = createStubTrainer(["alpha", "beta"]);
  const service = createPromptService({ trainer });
  const actions = [
    { id: "action_a", label: "Action A", kind: "move" },
    { id: "action_b", label: "Action B", kind: "move" },
  ];

  const used = new Set();
  const renderedActions = actions.map((action) => {
    const prompt = service.getPrompt(action.id, used);
    used.add(prompt);
    return { ...action, prompt };
  });

  const triggered = [];
  const engine = new TypingEngine({
    actions: renderedActions,
    onActivate: (action) => triggered.push(action.id),
    onBufferChange: () => {},
  });

  const targetPrompt = renderedActions[1].prompt;
  [...targetPrompt].forEach((char) => engine.append(char));
  const activated = engine.activateMatch();

  assert.equal(activated, true);
  assert.deepEqual(triggered, ["action_b"]);
});

test("typing engine reports failure when no prompt matches", () => {
  const trainer = createStubTrainer(["alpha"]);
  const service = createPromptService({ trainer });
  const action = { id: "only_action", label: "Solo", kind: "move" };
  const prompt = service.getPrompt(action.id);

  let activated = null;
  let lastBuffer = "";
  const engine = new TypingEngine({
    actions: [{ ...action, prompt }],
    onActivate: (entry) => {
      activated = entry.id;
    },
    onBufferChange: (buffer) => {
      lastBuffer = buffer;
    },
  });

  engine.append("x");
  engine.append("y");
  const didActivate = engine.activateMatch();

  assert.equal(didActivate, false);
  assert.equal(activated, null);
  assert.equal(lastBuffer, "xy"); // buffer remains until cleared manually
});
