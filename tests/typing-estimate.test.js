import test from "node:test";
import assert from "node:assert/strict";

import {
  ESTIMATE_SETTINGS,
  createTypingEstimate,
  effectiveIntervalMs,
  isUsableSample,
  recordSample,
} from "../src/typing-estimate.js";

const fast = { keyCount: 5, typingMs: 1600, firstKeypressMs: 400 };   // 400ms per key
const slow = { keyCount: 5, typingMs: 6000, firstKeypressMs: 400 };   // 1500ms per key
const middling = { keyCount: 5, typingMs: 3600, firstKeypressMs: 400 }; // 900ms per key

test("a fresh session starts easy", () => {
  const estimate = createTypingEstimate();
  assert.equal(estimate.target, ESTIMATE_SETTINGS.startingTarget);
  assert.equal(estimate.samples, 0);
});

test("typing fast raises the target, slow lowers it, in between holds", () => {
  const start = createTypingEstimate();
  assert.ok(recordSample(start, fast).target > start.target);
  assert.ok(recordSample(start, slow).target < start.target);
  assert.equal(recordSample(start, middling).target, start.target);
});

test("the target rises faster than it falls", () => {
  // One distracted word should not undo a run of good ones.
  const start = createTypingEstimate();
  const up = recordSample(start, fast).target - start.target;
  const down = start.target - recordSample(start, slow).target;
  assert.ok(up > down, `rise ${up} should exceed fall ${down}`);
});

test("speed is measured per keystroke, so word length does not bias it", () => {
  // Same pace, different lengths: a long word must not read as slower.
  const short = { keyCount: 3, typingMs: 800, firstKeypressMs: 0 };
  const long = { keyCount: 9, typingMs: 3200, firstKeypressMs: 0 };
  assert.equal(effectiveIntervalMs(short), effectiveIntervalMs(long));
});

test("a long pause before the first key is capped, not allowed to dominate", () => {
  const base = { keyCount: 5, typingMs: 2000 };
  const wandered = effectiveIntervalMs({ ...base, firstKeypressMs: 120000 });
  const capped = effectiveIntervalMs({ ...base, firstKeypressMs: ESTIMATE_SETTINGS.firstKeypressCapMs });
  assert.equal(wandered, capped, "two minutes away should count the same as the cap");
  // And even at the cap it stays a nudge rather than the signal.
  const undelayed = effectiveIntervalMs({ ...base, firstKeypressMs: 0 });
  assert.ok(capped - undelayed < ESTIMATE_SETTINGS.fastIntervalMs / 2);
});

test("corrections count as slowness rather than being discarded", () => {
  // Backspacing and retyping shows up as a longer interval, which is exactly
  // the signal that should pull difficulty down.
  const clean = { keyCount: 4, typingMs: 1200, firstKeypressMs: 300 };
  const fumbled = { keyCount: 4, typingMs: 5200, firstKeypressMs: 300 };
  assert.ok(effectiveIntervalMs(fumbled) > effectiveIntervalMs(clean));
});

test("the target converges quickly, since nothing persists between sessions", () => {
  let estimate = createTypingEstimate();
  for (let i = 0; i < 10; i += 1) estimate = recordSample(estimate, fast);
  assert.ok(
    estimate.target > ESTIMATE_SETTINGS.startingTarget + 1,
    `expected a fast climb, reached ${estimate.target}`,
  );
});

test("the target stays within bounds however lopsided the samples", () => {
  let high = createTypingEstimate();
  for (let i = 0; i < 500; i += 1) high = recordSample(high, fast);
  assert.equal(high.target, ESTIMATE_SETTINGS.maximumTarget);

  let low = createTypingEstimate();
  for (let i = 0; i < 500; i += 1) low = recordSample(low, slow);
  assert.equal(low.target, ESTIMATE_SETTINGS.minimumTarget);
});

test("unusable samples are ignored without disturbing the estimate", () => {
  const estimate = recordSample(createTypingEstimate(), fast);
  const junk = [
    null,
    undefined,
    { keyCount: 1, typingMs: 100 },
    { keyCount: 4, typingMs: Number.NaN },
    { keyCount: 4, typingMs: -5 },
    { keyCount: 4, typingMs: 900, firstKeypressMs: Number.POSITIVE_INFINITY },
  ];
  for (const sample of junk) {
    assert.equal(isUsableSample(sample), false, `${JSON.stringify(sample)} should be rejected`);
    assert.deepEqual(recordSample(estimate, sample), estimate);
  }
});

test("estimates are immutable", () => {
  const estimate = createTypingEstimate();
  const next = recordSample(estimate, fast);
  assert.notEqual(next, estimate);
  assert.equal(estimate.target, ESTIMATE_SETTINGS.startingTarget);
  assert.throws(() => {
    "use strict";
    estimate.target = 99;
  });
});
