/**
 * Typing prompt vocabularies, ordered to follow a touch-typing curriculum.
 *
 * Tiers exist so prompts can track what the player has actually been taught.
 * A tier is a flat list of prompts plus the set of letters it is allowed to
 * use; the allowed set is what the tests check the word list against, so a
 * typo cannot silently smuggle an untaught key into practice.
 *
 * Keep word lists short, concrete and calm. See docs/decisions.md, D5.
 */

export const KEYBOARD_ROWS = Object.freeze({
  home: "asdfghjkl",
  top: "qwertyuiop",
  bottom: "zxcvbnm",
});

function lettersFrom(...rows) {
  return Object.freeze(new Set(rows.join("").split("")));
}

const HOME = lettersFrom(KEYBOARD_ROWS.home);
const HOME_AND_TOP = lettersFrom(KEYBOARD_ROWS.home, KEYBOARD_ROWS.top);
const ALL_LETTERS = lettersFrom(
  KEYBOARD_ROWS.home,
  KEYBOARD_ROWS.top,
  KEYBOARD_ROWS.bottom,
);

/**
 * Home row only: a s d f g h j k l.
 *
 * Deliberately weighted toward two- and three-letter words so an early
 * touch typist finishes a prompt without losing the thread of the game.
 * `j` is nearly unusable in real English home-row words; `home-letters`
 * covers that finger instead.
 */
const HOME_ROW_WORDS = [
  "as", "ask", "add", "all", "ash", "dad", "fad", "gal", "gas", "had",
  "has", "lad", "lag", "sad", "sag", "jag", "adds", "asks", "dads", "dash",
  "fall", "flag", "gals", "glad", "hall", "half", "lads", "lags", "sags",
  "falls", "flags", "flash", "flask", "glass", "salad", "salsa", "shall",
  "alfalfa",
];

/** Home row plus the top row: adds q w e r t y u i o p. */
const HOME_AND_TOP_WORDS = [
  "the", "she", "her", "his", "how", "who", "why", "you", "our", "out",
  "sit", "top", "up", "us", "yes", "old", "let", "hot", "put", "toy",
  "that", "this", "they", "with", "will", "help", "play", "like", "look",
  "good", "take", "walk", "talk", "tree", "tall", "true", "were", "your",
  "there", "where", "after", "first", "great", "right", "water", "happy",
  "quiet", "sleep", "purple", "people", "little", "sister", "father",
];

/** The whole alphabet. Common words a second grader already reads. */
const COMMON_WORDS = [
  "and", "but", "can", "cat", "dog", "box", "cup", "van", "bus", "sun",
  "jump", "book", "bird", "milk", "nice", "name", "make", "move", "much",
  "come", "back", "best", "blue", "from", "have", "kind", "many", "next",
  "about", "brown", "bring", "climb", "every", "funny", "green", "house",
  "mouse", "music", "never", "night", "quick", "smile", "think", "zebra",
  "animal", "because", "friend", "garden", "number", "rabbit", "yellow",
];

export const PROMPT_TIERS = Object.freeze({
  "home-letters": Object.freeze({
    label: "Home row letters",
    description: "One key at a time, home row only. The gentlest start.",
    allowedLetters: HOME,
    prompts: Object.freeze(KEYBOARD_ROWS.home.split("")),
  }),
  "home-words": Object.freeze({
    label: "Home row words",
    description: "Short words typed without leaving the home row.",
    allowedLetters: HOME,
    prompts: Object.freeze([...HOME_ROW_WORDS]),
  }),
  "home-top-words": Object.freeze({
    label: "Home and top row words",
    description: "Adds the top row, once those keys have been taught.",
    allowedLetters: HOME_AND_TOP,
    prompts: Object.freeze([...HOME_AND_TOP_WORDS]),
  }),
  "common-words": Object.freeze({
    label: "Common words",
    description: "The whole keyboard, using words already familiar in print.",
    allowedLetters: ALL_LETTERS,
    prompts: Object.freeze([...COMMON_WORDS]),
  }),
});

/** Ordered easiest to hardest, which is also the order to progress through. */
export const TIER_ORDER = Object.freeze([
  "home-letters",
  "home-words",
  "home-top-words",
  "common-words",
]);

export const DEFAULT_TIER = "home-words";

export function listPromptTiers() {
  return TIER_ORDER.map((id) => ({ id, ...PROMPT_TIERS[id] }));
}

/**
 * Resolve a tier by name, falling back to the default rather than throwing.
 * Callers may pass untrusted input (a URL parameter), and an unrecognized
 * tier should degrade to a playable game, not a broken one.
 */
export function getPromptTier(name) {
  const id = typeof name === "string" && name in PROMPT_TIERS ? name : DEFAULT_TIER;
  return { id, ...PROMPT_TIERS[id] };
}
