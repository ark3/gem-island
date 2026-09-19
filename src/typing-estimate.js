/**
 * Tracks how hard the next set of prompts should be, from how fast the player
 * types. Pure: state in, new state out.
 *
 * The signal is the average interval between keystrokes, which is comparable
 * across words of different lengths in a way that total typing time is not --
 * a long word always takes longer, and feeding raw duration back would push
 * difficulty down every time it went up. The delay before the first keystroke
 * counts for a little, capped, because it includes reading the screen,
 * choosing where to go, and looking at the scenery.
 *
 * Nothing here is ever shown to the player. There is no score, no timer and
 * no readout; the only observable effect is which words appear next.
 */

export const ESTIMATE_SETTINGS = Object.freeze({
  // Where a fresh session starts. Deliberately easy: nothing persists between
  // sessions, so every run re-climbs, and climbing fast matters more than
  // starting in the right place.
  startingTarget: 1.3,
  minimumTarget: 1.1,
  maximumTarget: 5.0,

  // Typing faster than this (milliseconds between keystrokes) raises the
  // target; slower than the second lowers it; between the two holds steady.
  // Guesses, pending a session's worth of real numbers to calibrate against.
  fastIntervalMs: 600,
  slowIntervalMs: 1200,

  // Rise faster than it falls, so one distracted word does not undo a run of
  // good ones, while genuine capability is met quickly.
  riseStep: 0.15,
  fallStep: 0.08,

  // The delay before the first keystroke is unbounded in principle -- she may
  // simply have wandered off -- so cap it before letting it count, and let it
  // count only a little.
  firstKeypressCapMs: 3000,
  firstKeypressWeight: 0.08,
});

export function createTypingEstimate(settings = ESTIMATE_SETTINGS) {
  return Object.freeze({ target: settings.startingTarget, samples: 0 });
}

/**
 * Is this sample worth learning from? A prompt of one key yields no interval
 * to measure, and anything non-finite is a bug or a clock oddity.
 */
export function isUsableSample(sample) {
  if (!sample) return false;
  const { keyCount, typingMs, firstKeypressMs } = sample;
  if (!Number.isFinite(keyCount) || keyCount < 2) return false;
  if (!Number.isFinite(typingMs) || typingMs < 0) return false;
  if (firstKeypressMs != null && (!Number.isFinite(firstKeypressMs) || firstKeypressMs < 0)) {
    return false;
  }
  return true;
}

/**
 * The comparable speed number for one prompt: mean interval between
 * keystrokes, nudged by the capped delay before the first one.
 *
 * Corrections are included rather than excluded -- backspacing and retyping
 * makes this slower, and fumbling is exactly the thing that should pull
 * difficulty down.
 */
export function effectiveIntervalMs(sample, settings = ESTIMATE_SETTINGS) {
  const interval = sample.typingMs / (sample.keyCount - 1);
  const delay = Math.min(sample.firstKeypressMs ?? 0, settings.firstKeypressCapMs);
  return interval + settings.firstKeypressWeight * delay;
}

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

/** Fold one finished prompt into the estimate, returning the new state. */
export function recordSample(estimate, sample, settings = ESTIMATE_SETTINGS) {
  if (!isUsableSample(sample)) return estimate;

  const interval = effectiveIntervalMs(sample, settings);
  let target = estimate.target;
  if (interval < settings.fastIntervalMs) target += settings.riseStep;
  else if (interval > settings.slowIntervalMs) target -= settings.fallStep;

  return Object.freeze({
    target: clamp(target, settings.minimumTarget, settings.maximumTarget),
    samples: estimate.samples + 1,
  });
}
