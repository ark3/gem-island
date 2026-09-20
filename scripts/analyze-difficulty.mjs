/**
 * Prints what the current weights do to the vocabulary, so they can be tuned
 * by looking at real output rather than by argument.
 *
 *   node scripts/analyze-difficulty.mjs
 *
 * Edit DIFFICULTY_WEIGHTS in src/typing-difficulty.js and re-run.
 */
import { DIFFICULTY_WEIGHTS, motorScore, unfamiliarity } from "../src/typing-difficulty.js";
import { buildVocabulary, selectPrompts, vocabularyRange } from "../src/prompt-vocabulary.js";
import { ESTIMATE_SETTINGS } from "../src/typing-estimate.js";
import { WORD_CORPUS } from "../src/data/word-corpus.js";
import { NONSENSE_POOL } from "../src/data/nonsense-pool.js";

const vocabulary = buildVocabulary({ words: WORD_CORPUS, nonsense: NONSENSE_POOL });
const { min, max } = vocabularyRange(vocabulary);

console.log(`${vocabulary.length} entries (${WORD_CORPUS.length} words, ${NONSENSE_POOL.length} nonsense)`);
console.log(`score range ${min.toFixed(2)} .. ${max.toFixed(2)}\n`);

console.log("TERM SHARES across the corpus");
let motor = 0;
let length = 0;
let familiar = 0;
WORD_CORPUS.forEach((word, index) => {
  motor += motorScore(word);
  length += DIFFICULTY_WEIGHTS.lengthPerLetter * (word.length - 1);
  familiar += DIFFICULTY_WEIGHTS.familiarity * unfamiliarity(index + 1, WORD_CORPUS.length);
});
const total = motor + length + familiar;
for (const [name, value] of [["motor", motor], ["familiarity", familiar], ["length", length]]) {
  console.log(`  ${name.padEnd(12)} ${((100 * value) / total).toFixed(0).padStart(3)}%`);
}

console.log("\nDISTRIBUTION (0.2 buckets, * marks where nonsense dominates)");
const buckets = new Map();
for (const entry of vocabulary) {
  const key = (Math.floor(entry.score / 0.2) * 0.2).toFixed(1);
  const bucket = buckets.get(key) ?? { words: 0, nonsense: 0 };
  bucket[entry.isWord ? "words" : "nonsense"] += 1;
  buckets.set(key, bucket);
}
for (const [key, bucket] of [...buckets].sort((a, b) => Number(a[0]) - Number(b[0]))) {
  const count = bucket.words + bucket.nonsense;
  const mark = bucket.nonsense > bucket.words ? "*" : " ";
  console.log(`  ${key.padStart(4)} ${mark} ${"#".repeat(Math.min(44, Math.ceil(count / 8))).padEnd(44)} ${String(count).padStart(4)}`);
}

console.log("\nWHAT A SESSION LOOKS LIKE as the target climbs");
for (const target of [1.3, 1.8, 2.3, 2.8, 3.4]) {
  const chosen = selectPrompts({ vocabulary, target, count: 6, random: Math.random });
  console.log(`  target ${target.toFixed(1)}: ${chosen.map((e) => e.text).join(", ")}`);
}

console.log("\nCLIMB from a cold start, typing at a steady 400ms per key");
let estimate = { target: ESTIMATE_SETTINGS.startingTarget, samples: 0 };
const { recordSample } = await import("../src/typing-estimate.js");
const trace = [estimate.target.toFixed(2)];
for (let i = 0; i < 12; i += 1) {
  estimate = recordSample(estimate, { keyCount: 4, typingMs: 1200, firstKeypressMs: 500 });
  trace.push(estimate.target.toFixed(2));
}
console.log(`  ${trace.join(" -> ")}`);
