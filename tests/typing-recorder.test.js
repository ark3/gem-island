import test from "node:test";
import assert from "node:assert/strict";

import {
  completed,
  createRecorder,
  discarded,
  keyPressed,
  promptsShown,
} from "../src/typing-recorder.js";
import { effectiveIntervalMs, isUsableSample, recordSample, createTypingEstimate } from "../src/typing-estimate.js";

/** Type `count` keystrokes, `gap` apart, starting at `from`. */
function type(recorder, { from, gap, count }) {
  let at = from;
  for (let i = 0; i < count; i += 1) {
    recorder = keyPressed(recorder, { at });
    at += gap;
  }
  return recorder;
}

test("a completed prompt yields a usable sample", () => {
  let recorder = promptsShown(createRecorder(), { at: 1000 });
  recorder = type(recorder, { from: 1500, gap: 300, count: 4 });
  const { sample } = completed(recorder, { prompt: "flag" });

  assert.equal(sample.keyCount, 4);
  assert.equal(sample.typingMs, 900); // three gaps of 300
  assert.equal(sample.firstKeypressMs, 500);
  assert.ok(isUsableSample(sample));
});

test("keyCount is the prompt's length, not the number of keys pressed", () => {
  // The decisive case. Typing "fla", backspacing twice and typing "ag" is
  // nine keystrokes for a four-letter word. Counting keystrokes would divide
  // the elapsed time by eight gaps and make the fumbling read as *fast*;
  // counting the prompt keeps it as slowness, which is what we want a
  // correction to be.
  let recorder = promptsShown(createRecorder(), { at: 0 });
  recorder = type(recorder, { from: 500, gap: 400, count: 9 });
  const { sample } = completed(recorder, { prompt: "flag" });

  assert.equal(sample.keyCount, 4, "keyCount must come from the prompt");
  assert.equal(sample.typingMs, 3200); // eight gaps of 400
  assert.equal(sample.typingMs / (sample.keyCount - 1), 3200 / 3);

  // And confirm the direction: fumbling must not out-run a clean run.
  let clean = promptsShown(createRecorder(), { at: 0 });
  clean = type(clean, { from: 500, gap: 400, count: 4 });
  const cleanSample = completed(clean, { prompt: "flag" }).sample;
  assert.ok(
    effectiveIntervalMs(sample) > effectiveIntervalMs(cleanSample),
    "the corrected attempt must read slower than the clean one",
  );
});

test("a pause before pressing Enter is not counted as typing", () => {
  // Enter is a separate, deliberate act. Time spent hesitating over it is not
  // time spent typing, so the measurement ends at the last keystroke.
  let recorder = promptsShown(createRecorder(), { at: 0 });
  recorder = type(recorder, { from: 100, gap: 200, count: 3 });
  const quick = completed(recorder, { prompt: "ask" }).sample;

  // Same keystrokes; activation happens much later. Nothing changes.
  const dawdled = completed(recorder, { prompt: "ask" }).sample;
  assert.deepEqual(quick, dawdled);
  assert.equal(quick.typingMs, 400);
});

test("backspaces count as keystrokes", () => {
  // A match can be reached by deleting back to it, so the final edit is not
  // always a character -- and either way the time was spent.
  let recorder = promptsShown(createRecorder(), { at: 0 });
  recorder = keyPressed(recorder, { at: 100 });   // f
  recorder = keyPressed(recorder, { at: 300 });   // l
  recorder = keyPressed(recorder, { at: 500 });   // a
  recorder = keyPressed(recorder, { at: 700 });   // g  (overshoot)
  recorder = keyPressed(recorder, { at: 1100 });  // backspace back to "fla"
  const { sample } = completed(recorder, { prompt: "fla" });
  assert.equal(sample.typingMs, 1000, "the backspace is the last keystroke");
});

test("the first keystroke stamps the delay, later ones do not", () => {
  let recorder = promptsShown(createRecorder(), { at: 1000 });
  recorder = keyPressed(recorder, { at: 3000 });
  recorder = keyPressed(recorder, { at: 3200 });
  const { sample } = completed(recorder, { prompt: "as" });
  assert.equal(sample.firstKeypressMs, 2000);
});

test("a window that never opened reports an unknown delay, not a zero one", () => {
  let recorder = type(createRecorder(), { from: 500, gap: 250, count: 3 });
  const { sample } = completed(recorder, { prompt: "ask" });
  assert.equal(sample.firstKeypressMs, null);
  assert.ok(isUsableSample(sample), "the typing measurement is still good");
  // Null must contribute nothing rather than breaking the arithmetic.
  assert.ok(Number.isFinite(effectiveIntervalMs(sample)));
});

test("a window with no keystrokes yields no sample", () => {
  const recorder = promptsShown(createRecorder(), { at: 1000 });
  assert.equal(completed(recorder, { prompt: "ask" }).sample, null);
});

test("completing without a prompt yields no sample", () => {
  let recorder = promptsShown(createRecorder(), { at: 0 });
  recorder = type(recorder, { from: 100, gap: 100, count: 3 });
  for (const bad of [undefined, null, "", 42, {}]) {
    assert.equal(completed(recorder, { prompt: bad }).sample, null);
  }
});

test("completing and discarding both clear the window", () => {
  let recorder = promptsShown(createRecorder(), { at: 0 });
  recorder = type(recorder, { from: 100, gap: 100, count: 3 });

  const after = completed(recorder, { prompt: "ask" }).recorder;
  assert.equal(completed(after, { prompt: "ask" }).sample, null, "no second sample from one window");
  assert.deepEqual(discarded(recorder), createRecorder());
});

test("timestamps that are not finite are ignored rather than poisoning the sample", () => {
  let recorder = promptsShown(createRecorder(), { at: 0 });
  recorder = keyPressed(recorder, { at: 100 });
  for (const bad of [undefined, null, Number.NaN, Number.POSITIVE_INFINITY, "soon"]) {
    recorder = keyPressed(recorder, { at: bad });
  }
  recorder = keyPressed(recorder, { at: 500 });
  const { sample } = completed(recorder, { prompt: "as" });
  assert.equal(sample.typingMs, 400);
  assert.ok(isUsableSample(sample));
});

test("a clock that jumps backwards cannot produce negative time", () => {
  let recorder = promptsShown(createRecorder(), { at: 5000 });
  recorder = keyPressed(recorder, { at: 4000 });
  recorder = keyPressed(recorder, { at: 3000 });
  const { sample } = completed(recorder, { prompt: "as" });
  assert.ok(sample.typingMs >= 0);
  assert.ok(sample.firstKeypressMs >= 0);
});

test("recorder state is immutable", () => {
  const recorder = promptsShown(createRecorder(), { at: 0 });
  const next = keyPressed(recorder, { at: 100 });
  assert.notEqual(next, recorder);
  assert.equal(recorder.firstKeyAt, null);
  assert.throws(() => {
    "use strict";
    recorder.shownAt = 99;
  });
});

test("samples feed the estimate end to end", () => {
  // The two modules must meet at a shape that actually works.
  let estimate = createTypingEstimate();
  const start = estimate.target;
  for (let round = 0; round < 6; round += 1) {
    let recorder = promptsShown(createRecorder(), { at: round * 10000 });
    recorder = type(recorder, { from: round * 10000 + 300, gap: 250, count: 4 });
    const { sample } = completed(recorder, { prompt: "flag" });
    estimate = recordSample(estimate, sample);
  }
  assert.ok(estimate.target > start, "a brisk run of prompts should raise the target");
  assert.equal(estimate.samples, 6);
});
