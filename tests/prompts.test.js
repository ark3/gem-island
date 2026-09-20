import test from "node:test";
import assert from "node:assert/strict";

import { TypingEngine } from "../src/typing-engine.js";
import { createPromptService } from "../src/prompt-service.js";
import { buildVocabulary } from "../src/prompt-vocabulary.js";
import { WORD_CORPUS } from "../src/data/word-corpus.js";
import { NONSENSE_POOL } from "../src/data/nonsense-pool.js";
import { createSeededRandom } from "./helpers/random.js";

function serviceOver(words, nonsense = []) {
  return createPromptService({
    vocabulary: buildVocabulary({ words, nonsense }),
    random: createSeededRandom(4242),
  });
}

const SAMPLE_WORDS = [
  "dad", "sad", "lad", "fall", "glass", "salad", "ask", "flask", "half",
  "hall", "gash", "flag", "slash", "gala", "alfalfa", "shall", "lash",
];

test("a view never repeats a prompt", () => {
  const service = serviceOver(SAMPLE_WORDS);
  for (let view = 0; view < 40; view += 1) {
    const prompts = service.nextPrompts(6, 1.8);
    assert.equal(new Set(prompts).size, prompts.length, `view ${view} reused a prompt`);
  }
});

test("every action gets a prompt even when the recent window covers the vocabulary", () => {
  // The service remembers the last 15 prompts. With a vocabulary barely
  // larger than that, excluding them all can leave nothing to draw -- but a
  // visible action with no prompt is unreachable, so the set must still fill.
  const service = serviceOver(SAMPLE_WORDS.slice(0, 9));

  for (let view = 0; view < 10; view += 1) {
    const prompts = service.nextPrompts(6, 1.8);
    assert.equal(prompts.length, 6, `view ${view} came up short`);
    assert.ok(
      prompts.every((prompt) => typeof prompt === "string" && prompt.length > 0),
      `view ${view} produced an empty prompt`,
    );
    assert.equal(new Set(prompts).size, 6, `view ${view} reused a prompt`);
  }
});

test("a higher target draws harder prompts", () => {
  const vocabulary = buildVocabulary({ words: SAMPLE_WORDS });
  const scoreOf = new Map(vocabulary.map((entry) => [entry.text, entry.score]));
  const service = createPromptService({ vocabulary, random: createSeededRandom(99) });

  const mean = (prompts) =>
    prompts.reduce((sum, prompt) => sum + scoreOf.get(prompt), 0) / prompts.length;

  const easy = [];
  const hard = [];
  for (let view = 0; view < 20; view += 1) {
    easy.push(...service.nextPrompts(4, 1.5));
    hard.push(...service.nextPrompts(4, 3.0));
  }

  assert.ok(
    mean(easy) < mean(hard),
    `easy target averaged ${mean(easy).toFixed(2)}, hard averaged ${mean(hard).toFixed(2)}`,
  );
});

test("prompts sit near the target, against the vocabulary that ships", () => {
  // The whole visible set sits at one difficulty, so choosing among the
  // prompts is about where to go in the game, never about how hard to work.
  //
  // This runs against the real vocabulary rather than a sample, because the
  // property depends on the pool being dense relative to the selection
  // spread: with only a handful of candidates the kernel has to reach, and
  // reaching is the documented fallback, not a failure.
  const vocabulary = buildVocabulary({ words: WORD_CORPUS, nonsense: NONSENSE_POOL });
  const scoreOf = new Map(vocabulary.map((entry) => [entry.text, entry.score]));
  const service = createPromptService({ vocabulary, random: createSeededRandom(7) });

  for (const target of [1.3, 1.9, 2.5, 3.2]) {
    for (const prompt of service.nextPrompts(6, target)) {
      const distance = Math.abs(scoreOf.get(prompt) - target);
      assert.ok(
        distance <= 0.75, // three times the default spread
        `"${prompt}" scored ${scoreOf.get(prompt).toFixed(2)} for target ${target}`,
      );
    }
  }
});

test("reset clears the recent memory", () => {
  const service = serviceOver(SAMPLE_WORDS);
  service.nextPrompts(6, 1.8);
  service.reset();
  assert.equal(service.nextPrompts(6, 1.8).length, 6);
});

test("a service needs a vocabulary", () => {
  assert.throws(() => createPromptService({ vocabulary: [] }), /vocabulary/);
  assert.throws(() => createPromptService(), /vocabulary/);
});

test("typing engine activates the action whose prompt was assigned", () => {
  const service = serviceOver(SAMPLE_WORDS);
  const prompts = service.nextPrompts(2, 1.8);
  const renderedActions = [
    { id: "action_a", label: "Action A", kind: "move", prompt: prompts[0] },
    { id: "action_b", label: "Action B", kind: "move", prompt: prompts[1] },
  ];

  const triggered = [];
  const engine = new TypingEngine({
    actions: renderedActions,
    onActivate: (action) => triggered.push(action.id),
    onBufferChange: () => {},
  });

  [...renderedActions[1].prompt].forEach((char) => engine.append(char));

  assert.equal(engine.activateMatch(), true);
  assert.deepEqual(triggered, ["action_b"]);
});

test("typing engine reports failure when no prompt matches", () => {
  let activated = null;
  let lastBuffer = "";
  const engine = new TypingEngine({
    actions: [{ id: "only_action", label: "Solo", kind: "move", prompt: "dad" }],
    onActivate: (entry) => {
      activated = entry.id;
    },
    onBufferChange: (buffer) => {
      lastBuffer = buffer;
    },
  });

  engine.append("x");
  engine.append("y");

  assert.equal(engine.activateMatch(), false);
  assert.equal(activated, null);
  assert.equal(lastBuffer, "xy"); // buffer remains until cleared manually
});

test("typing engine limits buffer to 15 characters", () => {
  let lastBuffer = "";
  const engine = new TypingEngine({
    actions: [],
    onActivate: () => {},
    onBufferChange: (buffer) => {
      lastBuffer = buffer;
    },
  });

  [..."abcdefghijklmnopqrstuvwxyz"].forEach((char) => engine.append(char));

  assert.equal(lastBuffer.length, 15);
  assert.equal(lastBuffer, "abcdefghijklmno");
});

test("edits report whether they changed the buffer", () => {
  // The shell measures typing pace from these. A keystroke that changed
  // nothing is not typing: counting a backspace on an empty buffer would open
  // the timing window early and read as slowness she never spent.
  const engine = new TypingEngine({ actions: [], onActivate: () => {}, onBufferChange: () => {} });

  assert.equal(engine.backspace(), false, "backspace on an empty buffer changed nothing");
  assert.equal(engine.append("d"), true);
  assert.equal(engine.backspace(), true);

  [..."abcdefghijklmno"].forEach((char) => assert.equal(engine.append(char), true));
  assert.equal(engine.append("p"), false, "append past the cap changed nothing");
});
