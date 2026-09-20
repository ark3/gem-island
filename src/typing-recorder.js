/**
 * Turns keyboard events into one timing sample per completed prompt.
 *
 * Sits between the shell and the typing engine. The shell owns the clock --
 * reading it is I/O -- and passes every timestamp in, so this module stays
 * pure and testable while `main.js`, which has no tests, holds no timing
 * rules. The engine is left alone: its job is matching input to prompts, and
 * measuring is a different set of rules.
 *
 * Feeds `recordSample` in typing-estimate.js, which takes exactly the shape
 * `completed()` returns.
 *
 * The window opens when a set of prompts is rendered, because rendering is
 * what re-rolls them. Everything before the first keystroke -- reading the
 * screen, deciding where to go, looking at the scenery -- lands in
 * `firstKeypressMs`, which is why the estimate caps it and weights it low.
 *
 * Timestamps should come from a monotonic clock (`performance.now()`), not
 * `Date.now()`, so a system clock adjustment mid-word cannot produce a
 * negative interval.
 */

const EMPTY = Object.freeze({
  shownAt: null,
  firstKeyAt: null,
  lastKeyAt: null,
});

export function createRecorder() {
  return EMPTY;
}

/** A new set of prompts is on screen. Opens the window. */
export function promptsShown(recorder, { at } = {}) {
  return Object.freeze({ shownAt: Number.isFinite(at) ? at : null, firstKeyAt: null, lastKeyAt: null });
}

/**
 * One keystroke that edits the buffer -- a character or a backspace.
 *
 * Backspaces count. A match can be reached by deleting back to it (typing
 * "flag" when the prompt is "fla"), so the final edit is not always a
 * character, and the time it took is time she spent typing.
 */
export function keyPressed(recorder, { at } = {}) {
  if (!Number.isFinite(at)) return recorder;
  return Object.freeze({
    shownAt: recorder.shownAt,
    firstKeyAt: recorder.firstKeyAt ?? at,
    lastKeyAt: at,
  });
}

/** Nothing usable came of this window: a restart, or she wandered off. */
export function discarded() {
  return EMPTY;
}

/**
 * A prompt was matched and activated. Returns the cleared recorder and the
 * sample, or a null sample when the window holds nothing worth learning from.
 *
 * `keyCount` is the length of the matched prompt, **not** the number of keys
 * pressed. That is deliberate and it inverts the result: typing "fla",
 * backspacing twice and typing "ag" is nine keystrokes for a four-letter
 * word. Dividing the elapsed time by eight gaps would normalise the fumbling
 * away and read as fast; dividing by three keeps it as slowness, which is
 * what a correction should be.
 *
 * The time to the last keystroke is what counts, not the time to activation.
 * Enter is a separate, deliberate act, and a pause before pressing it is not
 * time spent typing.
 */
export function completed(recorder, { prompt } = {}) {
  if (typeof prompt !== "string" || prompt.length === 0) {
    return { recorder: EMPTY, sample: null };
  }
  if (recorder.firstKeyAt == null || recorder.lastKeyAt == null) {
    return { recorder: EMPTY, sample: null };
  }

  const sample = Object.freeze({
    keyCount: prompt.length,
    typingMs: Math.max(0, recorder.lastKeyAt - recorder.firstKeyAt),
    // Null rather than zero when the window never opened: the delay is
    // unknown, not instant. The estimate treats null as contributing nothing.
    firstKeypressMs:
      recorder.shownAt == null ? null : Math.max(0, recorder.firstKeyAt - recorder.shownAt),
  });

  return { recorder: EMPTY, sample };
}
