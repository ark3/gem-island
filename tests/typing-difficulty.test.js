import test from "node:test";
import assert from "node:assert/strict";

import {
  DIFFICULTY_WEIGHTS,
  KEYBOARD,
  difficultyScore,
  isTypeable,
  keyCost,
  motorScore,
  transitionCost,
  unfamiliarity,
} from "../src/typing-difficulty.js";
import { WORD_CORPUS } from "../src/data/word-corpus.js";

test("movement outweighs finger position", () => {
  // The defining constraint of the model: "g" is typed by the index finger,
  // the strongest, but it has to stretch out of its column, and that costs
  // more than "a" resting under the weakest finger.
  assert.ok(keyCost("g") > keyCost("a"), "g should cost more than a");
  assert.ok(keyCost("h") > keyCost(";"), "h should cost more than ;");
});

test("finger cost rises from index to pinky", () => {
  assert.ok(keyCost("f") < keyCost("d"));
  assert.ok(keyCost("d") < keyCost("s"));
  assert.ok(keyCost("s") < keyCost("a"));
});

test("moving down costs more than up, which costs more than sideways", () => {
  const home = keyCost("f");
  assert.ok(keyCost("v") - home > keyCost("r") - home, "down should beat up");
  assert.ok(keyCost("r") - home > keyCost("g") - home, "up should beat sideways");
});

test("the first keys taught are the cheapest on the board", () => {
  const cheapest = [...KEYBOARD.keys()]
    .filter((c) => /[a-z]/.test(c))
    .sort((a, b) => keyCost(a) - keyCost(b))
    .slice(0, 4);
  assert.deepEqual(cheapest.sort(), ["d", "f", "j", "k"]);
});

test("transition costs are ordered: alternate, repeat, same hand, same finger", () => {
  const alternate = transitionCost("f", "j");
  const repeat = transitionCost("l", "l");
  const sameHand = transitionCost("a", "f");
  const sameFinger = transitionCost("d", "e");
  assert.ok(alternate < repeat, "alternating hands is the easiest");
  assert.ok(repeat < sameHand, "a repeated key is just a second press");
  assert.ok(sameHand < sameFinger, "one finger travelling is the worst case");
});

test("motor cost is per keystroke, not a total", () => {
  // Seven alternating home-row keys should not out-cost three awkward ones
  // simply by being longer. Length is handled by its own term.
  assert.ok(motorScore("alfalfa") < motorScore("dad"));
});

test("unfamiliarity is bounded and ordered, with non-words at the top", () => {
  assert.ok(unfamiliarity(1, 2000) < unfamiliarity(1000, 2000));
  assert.ok(unfamiliarity(1000, 2000) < unfamiliarity(null, 2000));
  assert.equal(unfamiliarity(null, 2000), 1);
  assert.equal(unfamiliarity(5000, 2000), 1, "beyond the corpus is fully unfamiliar");
  for (const rank of [1, 50, 2000]) {
    const value = unfamiliarity(rank, 2000);
    assert.ok(value >= 0 && value <= 1);
  }
});

test("length is the least influential term across the corpus", () => {
  // The stated design priority: difficulty is about which fingers move, with
  // length a minor consideration. If a weight tweak inverts this, say so.
  let motor = 0;
  let length = 0;
  let familiarity = 0;
  WORD_CORPUS.forEach((word, index) => {
    motor += motorScore(word);
    length += DIFFICULTY_WEIGHTS.lengthPerLetter * (word.length - 1);
    familiarity += DIFFICULTY_WEIGHTS.familiarity * unfamiliarity(index + 1, WORD_CORPUS.length);
  });
  assert.ok(motor > familiarity, "motor should dominate");
  assert.ok(familiarity > length, "length should be the smallest term");
});

test("a short comfortable word beats a long one, but not by much", () => {
  const dad = difficultyScore("dad", { rank: null });
  const alfalfa = difficultyScore("alfalfa", { rank: null });
  assert.ok(dad < alfalfa, "dad should be easier");
  assert.ok(alfalfa - dad < 0.5, "but the gap should stay small");
});

test("untypeable input is rejected rather than silently scored", () => {
  assert.equal(isTypeable("hello"), true);
  assert.equal(isTypeable("hi there"), false, "space is not a typeable key here");
  assert.equal(isTypeable(""), false);
  assert.throws(() => motorScore("héllo"));
});
