/**
 * The pool of things that can be asked of the player, each with a difficulty
 * score, plus selection of a set of prompts at a chosen difficulty.
 *
 * Selection is deliberately not a filter on which keys have been taught. The
 * whole vocabulary is always available; the scoring decides what surfaces.
 * Keys a beginner has not learned are the uncomfortable ones, so they carry
 * high scores and simply do not appear while the target is low -- and they
 * arrive on their own as the target rises, in roughly the order a
 * touch-typing curriculum teaches them.
 */
import { DIFFICULTY_WEIGHTS, difficultyScore, isTypeable } from "./typing-difficulty.js";

/**
 * Score every candidate once. Corpus words carry their frequency rank;
 * nonsense strings carry none, so they score as maximally unfamiliar.
 */
export function buildVocabulary({ words = [], nonsense = [], weights = DIFFICULTY_WEIGHTS } = {}) {
  const corpusSize = words.length;
  const entries = [];
  words.forEach((text, index) => {
    if (!isTypeable(text)) return;
    entries.push({
      text,
      rank: index + 1,
      isWord: true,
      score: difficultyScore(text, { rank: index + 1, corpusSize, weights }),
    });
  });
  for (const text of nonsense) {
    if (!isTypeable(text)) continue;
    entries.push({
      text,
      rank: null,
      isWord: false,
      score: difficultyScore(text, { rank: null, corpusSize, weights }),
    });
  }
  entries.sort((a, b) => a.score - b.score);
  return Object.freeze(entries);
}

export function vocabularyRange(vocabulary) {
  if (!vocabulary.length) return { min: 0, max: 0 };
  return { min: vocabulary[0].score, max: vocabulary[vocabulary.length - 1].score };
}

/**
 * Weight a candidate by how close it sits to the target. `spread` sets how
 * far from the target the selection is willing to wander; a larger spread
 * gives more variety and a looser grip on difficulty.
 */
function closeness(score, target, spread) {
  const distance = (score - target) / spread;
  return Math.exp(-distance * distance);
}

/**
 * Draw `count` distinct prompts clustered around `target`.
 *
 * The whole visible set moves together: every prompt on screen sits near the
 * same difficulty, so which one the player picks is a choice about where to
 * go in the game, never a choice about how hard to work. That also keeps the
 * timing sample unbiased, since whichever prompt is typed was drawn from the
 * same place.
 */
export function selectPrompts({
  vocabulary,
  target,
  count = 4,
  spread = 0.25,
  exclude = new Set(),
  random = Math.random,
}) {
  const candidates = vocabulary.filter((entry) => !exclude.has(entry.text));
  const chosen = [];
  const taken = new Set();

  while (chosen.length < count && taken.size < candidates.length) {
    let total = 0;
    const weights = candidates.map((entry, index) => {
      if (taken.has(index)) return 0;
      const weight = closeness(entry.score, target, spread);
      total += weight;
      return weight;
    });

    let index;
    if (total <= 0) {
      // Target is far outside the vocabulary, or the kernel underflowed.
      // Fall back to whichever remaining entry sits closest to the target.
      let best = -1;
      let bestDistance = Infinity;
      candidates.forEach((entry, i) => {
        if (taken.has(i)) return;
        const distance = Math.abs(entry.score - target);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = i;
        }
      });
      index = best;
    } else {
      let threshold = random() * total;
      index = weights.findIndex((weight) => {
        threshold -= weight;
        return threshold <= 0 && weight > 0;
      });
      if (index < 0) index = weights.findLastIndex((weight) => weight > 0);
    }

    if (index < 0) break;
    taken.add(index);
    chosen.push(candidates[index]);
  }

  return chosen;
}
