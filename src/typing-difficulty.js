/**
 * How hard a string is to type, for a touch typist.
 *
 * The model is motor-first: difficulty comes from which fingers move and how,
 * not from how long the word is. Three terms, combined per keystroke so that
 * length stays a minor influence rather than dominating by arithmetic:
 *
 *   motor        average per-keystroke cost of the keys and the moves between
 *   length       a small penalty for each letter past the first
 *   familiarity  how unfamiliar the string is, from frequency rank; a
 *                non-word is maximally unfamiliar, because an unrecognized
 *                string has to be read letter by letter
 *
 * Weights are expected to be tuned. Invariants the model must preserve are
 * pinned in tests/typing-difficulty.test.js -- notably that movement outweighs
 * finger position, so "g" costs more than "a" despite using a stronger finger.
 */

// Piano-style finger numbering: 1 is the thumb (unused here), 5 the pinky.
// Each column lists its top, home and bottom key in that order.
const FINGER_COLUMNS = {
  left: { 5: "qaz", 4: "wsx", 3: "edc", 2: "rfv" },
  right: { 2: "ujm", 3: "ik,", 4: "ol.", 5: "p;/" },
};

// The index fingers also cover a second column, reached by stretching inward.
const REACH_COLUMNS = {
  left: { 2: "tgb" },
  right: { 2: "yhn" },
};

function buildKeyboard() {
  const keys = new Map();
  const place = (hand, finger, column, isReach) => {
    const rows = [1, 0, -1]; // top, home, bottom
    [...column].forEach((character, index) => {
      keys.set(character, { hand, finger, row: rows[index], isReach });
    });
  };
  for (const [hand, columns] of Object.entries(FINGER_COLUMNS)) {
    for (const [finger, column] of Object.entries(columns)) {
      place(hand, Number(finger), column, false);
    }
  }
  for (const [hand, columns] of Object.entries(REACH_COLUMNS)) {
    for (const [finger, column] of Object.entries(columns)) {
      place(hand, Number(finger), column, true);
    }
  }
  return keys;
}

export const KEYBOARD = buildKeyboard();

export const DIFFICULTY_WEIGHTS = Object.freeze({
  // Cost of using each finger at rest. Index is free, pinky costs most.
  finger: Object.freeze({ 2: 0, 3: 0.25, 4: 0.5, 5: 0.75 }),

  // Cost of moving off the home position. These deliberately exceed the
  // finger costs: moving a finger is harder than using an awkward one, which
  // is what makes "g" (index, stretched) cost more than "a" (pinky, at rest).
  moveSideways: 1.0,
  moveUp: 1.5,
  moveDown: 2.0,

  // Cost of getting from one key to the next.
  transitionAlternateHands: 0, // easiest: the other hand is already free
  transitionRepeatKey: 0.1, // same key twice is just a second press
  transitionSameHand: 0.5,
  transitionSameFinger: 1.5, // worst: one finger must travel and land again

  lengthPerLetter: 0.12,
  familiarity: 1.0,
});

export function isTypeable(text) {
  return typeof text === "string" && text.length > 0 && [...text].every((c) => KEYBOARD.has(c));
}

export function keyCost(character, weights = DIFFICULTY_WEIGHTS) {
  const key = KEYBOARD.get(character);
  if (!key) throw new Error(`Not a typeable character: ${JSON.stringify(character)}`);
  let cost = weights.finger[key.finger];
  if (key.isReach) cost += weights.moveSideways;
  if (key.row > 0) cost += weights.moveUp;
  else if (key.row < 0) cost += weights.moveDown;
  return cost;
}

export function transitionCost(from, to, weights = DIFFICULTY_WEIGHTS) {
  if (from === to) return weights.transitionRepeatKey;
  const a = KEYBOARD.get(from);
  const b = KEYBOARD.get(to);
  if (!a || !b) throw new Error(`Not a typeable pair: ${from}${to}`);
  if (a.hand !== b.hand) return weights.transitionAlternateHands;
  return a.finger === b.finger ? weights.transitionSameFinger : weights.transitionSameHand;
}

/** Average per-keystroke motor cost: the keys plus the moves between them. */
export function motorScore(text, weights = DIFFICULTY_WEIGHTS) {
  if (!isTypeable(text)) throw new Error(`Not typeable: ${JSON.stringify(text)}`);
  let total = 0;
  for (const character of text) total += keyCost(character, weights);
  for (let i = 0; i < text.length - 1; i += 1) {
    total += transitionCost(text[i], text[i + 1], weights);
  }
  return total / text.length;
}

/**
 * Unfamiliarity in [0, 1]. A null rank means a non-word, which scores 1 --
 * the same as a word so rare it has to be read letter by letter.
 */
export function unfamiliarity(rank, corpusSize) {
  if (rank == null || rank > corpusSize) return 1;
  return Math.log(rank + 1) / Math.log(corpusSize + 1);
}

/**
 * Total difficulty. `rank` is the word's 1-based frequency rank, or null for
 * a non-word. `corpusSize` scales the familiarity term.
 */
export function difficultyScore(text, { rank = null, corpusSize = 2000, weights = DIFFICULTY_WEIGHTS } = {}) {
  return (
    motorScore(text, weights) +
    weights.lengthPerLetter * (text.length - 1) +
    weights.familiarity * unfamiliarity(rank, corpusSize)
  );
}
