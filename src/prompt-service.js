/**
 * Assigns typing prompts to the actions visible on screen.
 *
 * Draws a whole set at once rather than one prompt per action, because the
 * set is the unit that matters: every prompt on screen sits at the same
 * difficulty, so choosing among them is a decision about where to go in the
 * game and never about how hard to work. It also keeps the timing sample
 * unbiased, since whichever prompt she types was drawn from the same place.
 *
 * Within-view uniqueness is structural here -- `selectPrompts` returns
 * distinct entries -- rather than something this module has to defend. Two
 * visible actions sharing a prompt makes one of them unreachable, because
 * TypingEngine matches the first action with that prompt and stops.
 *
 * The only state kept is a short memory of what was shown recently, so a word
 * does not come straight back on the next screen.
 */
import { selectPrompts } from "./prompt-vocabulary.js";

const RECENT_PROMPT_LIMIT = 15;

export function createPromptService({ vocabulary, spread = 0.25, random = Math.random } = {}) {
  if (!Array.isArray(vocabulary) || vocabulary.length === 0) {
    throw new Error("createPromptService requires a non-empty vocabulary");
  }

  let recentPrompts = [];

  function draw(count, target, exclude) {
    return selectPrompts({ vocabulary, target, count, spread, exclude, random });
  }

  return {
    /**
     * `count` prompts near `target`, as plain strings.
     *
     * Every visible action needs one, so a short draw is not acceptable: if
     * avoiding recent prompts cannot fill the set -- which only happens when
     * the vocabulary is barely larger than the recent window -- the shortfall
     * is drawn again with nothing excluded. Repeating a recent word is a
     * small annoyance; an action with no prompt is unreachable.
     */
    nextPrompts(count, target) {
      if (!Number.isFinite(count) || count <= 0) return [];

      const chosen = draw(count, target, new Set(recentPrompts));
      if (chosen.length < count) {
        const taken = new Set(chosen.map((entry) => entry.text));
        for (const entry of draw(count, target, taken)) {
          if (chosen.length >= count) break;
          chosen.push(entry);
        }
      }

      const prompts = chosen.map((entry) => entry.text);
      recentPrompts = [...recentPrompts, ...prompts].slice(-RECENT_PROMPT_LIMIT);
      return prompts;
    },

    reset() {
      recentPrompts = [];
    },
  };
}
