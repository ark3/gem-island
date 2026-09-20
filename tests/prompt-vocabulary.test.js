import test from "node:test";
import assert from "node:assert/strict";

import { buildVocabulary, selectPrompts, vocabularyRange } from "../src/prompt-vocabulary.js";
import { isTypeable } from "../src/typing-difficulty.js";
import { WORD_CORPUS } from "../src/data/word-corpus.js";
import { NONSENSE_POOL } from "../src/data/nonsense-pool.js";
import { createSeededRandom } from "./helpers/random.js";

const VOCABULARY = buildVocabulary({ words: WORD_CORPUS, nonsense: NONSENSE_POOL });

test("vocabulary is scored, sorted, and entirely typeable", () => {
  assert.ok(VOCABULARY.length > WORD_CORPUS.length);
  for (let i = 1; i < VOCABULARY.length; i += 1) {
    assert.ok(VOCABULARY[i - 1].score <= VOCABULARY[i].score, "entries must be sorted by score");
  }
  for (const entry of VOCABULARY) {
    assert.ok(isTypeable(entry.text), `${entry.text} is not typeable`);
    assert.ok(Number.isFinite(entry.score));
  }
});

test("corpus words carry ranks and nonsense does not", () => {
  const word = VOCABULARY.find((entry) => entry.isWord);
  const nonsense = VOCABULARY.find((entry) => !entry.isWord);
  assert.ok(word.rank >= 1);
  assert.equal(nonsense.rank, null);
});

test("nonsense fills the easy end that real words leave sparse", () => {
  // The reason the pool exists: of 2000 corpus words only about 30 score
  // below 2.0, which is too few to sustain a session for a beginner.
  const wordsOnly = buildVocabulary({ words: WORD_CORPUS });
  const easyWords = wordsOnly.filter((entry) => entry.score < 2).length;
  const easyAll = VOCABULARY.filter((entry) => entry.score < 2).length;
  assert.ok(easyWords < 50, `expected few easy words, got ${easyWords}`);
  assert.ok(easyAll > 200, `expected the pool to fill the gap, got ${easyAll}`);
});

test("selection returns the requested number of distinct prompts", () => {
  const chosen = selectPrompts({
    vocabulary: VOCABULARY,
    target: 2.0,
    count: 6,
    random: createSeededRandom(7),
  });
  assert.equal(chosen.length, 6);
  assert.equal(new Set(chosen.map((entry) => entry.text)).size, 6);
});

test("the whole selected set sits near the target", () => {
  // Every prompt on screen is at the same difficulty, so choosing between
  // them is a choice about where to go, never about how hard to work.
  for (const target of [1.5, 2.5, 3.5]) {
    const chosen = selectPrompts({
      vocabulary: VOCABULARY,
      target,
      count: 6,
      random: createSeededRandom(11),
    });
    for (const entry of chosen) {
      assert.ok(
        Math.abs(entry.score - target) < 0.75,
        `${entry.text} at ${entry.score.toFixed(2)} is far from target ${target}`,
      );
    }
  }
});

test("raising the target yields harder prompts", () => {
  const mean = (target) => {
    const chosen = selectPrompts({
      vocabulary: VOCABULARY,
      target,
      count: 8,
      random: createSeededRandom(3),
    });
    return chosen.reduce((sum, entry) => sum + entry.score, 0) / chosen.length;
  };
  assert.ok(mean(1.5) < mean(2.5));
  assert.ok(mean(2.5) < mean(3.5));
});

test("an easy target favours the keys taught first", () => {
  const chosen = selectPrompts({
    vocabulary: VOCABULARY,
    target: 1.2,
    count: 10,
    random: createSeededRandom(5),
  });
  const letters = new Set(chosen.flatMap((entry) => [...entry.text]));
  for (const letter of letters) {
    assert.ok("asdfghjkl".includes(letter), `${letter} should not appear at the easiest target`);
  }
});

test("excluded prompts are never selected", () => {
  const exclude = new Set(VOCABULARY.slice(0, 40).map((entry) => entry.text));
  const chosen = selectPrompts({
    vocabulary: VOCABULARY,
    target: 1.2,
    count: 5,
    exclude,
    random: createSeededRandom(13),
  });
  for (const entry of chosen) assert.ok(!exclude.has(entry.text));
});

test("selection is deterministic for a given random sequence", () => {
  const draw = () =>
    selectPrompts({
      vocabulary: VOCABULARY,
      target: 2.2,
      count: 5,
      random: createSeededRandom(21),
    }).map((entry) => entry.text);
  assert.deepEqual(draw(), draw());
});

test("asking for more prompts than exist returns what there is", () => {
  const tiny = buildVocabulary({ words: ["as", "add"], nonsense: ["fj"] });
  const chosen = selectPrompts({ vocabulary: tiny, target: 2, count: 9, random: createSeededRandom(2) });
  assert.equal(chosen.length, 3);
});

test("a target outside the vocabulary still returns prompts", () => {
  const { max } = vocabularyRange(VOCABULARY);
  const chosen = selectPrompts({
    vocabulary: VOCABULARY,
    target: max + 50,
    count: 3,
    random: createSeededRandom(4),
  });
  assert.equal(chosen.length, 3);
});
