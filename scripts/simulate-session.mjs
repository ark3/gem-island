/**
 * Plays a whole session against the difficulty model with a simulated player,
 * so pathologies turn up here rather than in front of a child.
 *
 *   node scripts/simulate-session.mjs [prompts]
 *
 * The player model is crude on purpose: harder words take longer per key,
 * with log-normal variance so slow outliers happen the way they really do.
 * `base` and `slope` are the two numbers worth arguing about — they stand in
 * for "a beginner who has learned d f j k".
 *
 * What this is for: the estimate rises faster than it falls, which protects a
 * good run from one distracted word but is also a ratchet under noise. Run
 * this after changing any weight or threshold and check that the target still
 * settles instead of drifting to a bound.
 */
import { ESTIMATE_SETTINGS, createTypingEstimate, recordSample } from "../src/typing-estimate.js";
import { buildVocabulary, selectPrompts } from "../src/prompt-vocabulary.js";
import { WORD_CORPUS } from "../src/data/word-corpus.js";
import { NONSENSE_POOL } from "../src/data/nonsense-pool.js";

const PROMPTS = Number(process.argv[2]) || 200;
const PLAYER = { base: 350, slope: 260, noise: 0.35 };

const vocabulary = buildVocabulary({ words: WORD_CORPUS, nonsense: NONSENSE_POOL });

// Park-Miller, matching tests/helpers/random.js, so runs are reproducible.
function seeded(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => (value = (value * 16807) % 2147483647) / 2147483647;
}

function msPerKey(score, random) {
  const mean = PLAYER.base + PLAYER.slope * score;
  const z = Math.sqrt(-2 * Math.log(random() || 1e-9)) * Math.cos(2 * Math.PI * random());
  return Math.max(80, mean * Math.exp(PLAYER.noise * z));
}

const random = seeded(12345);
let estimate = createTypingEstimate();
const trace = [];

for (let i = 0; i < PROMPTS; i += 1) {
  const [chosen] = selectPrompts({ vocabulary, target: estimate.target, count: 1, random });
  const perKey = msPerKey(chosen.score, random);
  estimate = recordSample(estimate, {
    keyCount: chosen.text.length,
    typingMs: perKey * (chosen.text.length - 1),
    firstKeypressMs: 400 + random() * 800,
  });
  trace.push({ ...chosen, perKey, target: estimate.target });
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const settled = trace.slice(Math.floor(PROMPTS / 2));

console.log(`target over ${PROMPTS} prompts (a real session is more like 30-60):`);
const marks = [0, 9, 24, 49, 74, 99, 149, PROMPTS - 1].filter((i) => i < PROMPTS);
console.log("  " + marks.map((i) => `${i + 1}:${trace[i].target.toFixed(2)}`).join("  "));

const targets = settled.map((t) => t.target);
console.log(
  `\nsettles near ${mean(targets).toFixed(2)} ` +
    `(${Math.min(...targets).toFixed(2)}-${Math.max(...targets).toFixed(2)}) ` +
    `— should settle, not drift to ${ESTIMATE_SETTINGS.minimumTarget} or ${ESTIMATE_SETTINGS.maximumTarget}`,
);
console.log(`mean pace there: ${mean(settled.map((t) => t.perKey)).toFixed(0)}ms per key`);

const nonsense = settled.filter((t) => !t.isWord).length;
console.log(
  `\n${Math.round((100 * nonsense) / settled.length)}% of what she sees once settled is nonsense`,
);
console.log("  " + settled.slice(-12).map((t) => t.text).join(", "));

console.log("\nnonsense share by target, for tuning the familiarity weight:");
for (const target of [1.6, 1.9, 2.2, 2.5, 2.8]) {
  const draw = selectPrompts({ vocabulary, target, count: 40, random });
  const share = Math.round((100 * draw.filter((e) => !e.isWord).length) / draw.length);
  console.log(`  target ${target.toFixed(1)}: ${String(share).padStart(3)}% nonsense`);
}
