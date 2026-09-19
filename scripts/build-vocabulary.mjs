/**
 * Regenerates the committed vocabulary data in src/data/.
 *
 * This is a maintenance tool, not a build step: the game runs from the
 * committed output and never needs this script. Run it when the source lists
 * change or the generation rules do.
 *
 *   node scripts/build-vocabulary.mjs
 *
 * Requires network access. Sources are named below so the corpus can be
 * swapped out later -- the frequency list is web-derived and underweights
 * child vocabulary (it has no "dad"), which we expect to replace.
 */
import { writeFile } from "node:fs/promises";

const SOURCES = {
  frequency:
    "https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-no-swears.txt",
  dictionary:
    "https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt",
  profanity:
    "https://raw.githubusercontent.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words/master/en",
};

const CORPUS_SIZE = 2000;
const HOME_ROW = "asdfghjkl";
const NONSENSE_LENGTHS = [2, 3];

/** Short strings the profanity list misses but that must never be shown. */
const EXTRA_BLOCKED = new Set(["kkk", "kkkk", "ddd", "fff", "sss", "lll", "jjj"]);

async function fetchLines(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} fetching ${url}`);
  const text = await response.text();
  return text.split("\n").map((line) => line.trim().toLowerCase()).filter(Boolean);
}

function isBlocked(word, profanity) {
  if (profanity.has(word) || EXTRA_BLOCKED.has(word)) return true;
  // Reject anything containing a short slur or obscenity as a substring, so
  // generated strings cannot smuggle one in.
  for (const bad of profanity) {
    if (bad.length >= 3 && bad.length <= 4 && word.includes(bad)) return true;
  }
  return false;
}

function buildCorpus({ frequency, dictionary, profanity }) {
  const seen = new Set();
  const corpus = [];
  for (const word of frequency) {
    if (corpus.length >= CORPUS_SIZE) break;
    if (!/^[a-z]+$/.test(word) || word.length < 2) continue;
    // The frequency list is web-derived; requiring a dictionary hit strips
    // artifacts like "ebay", "rss", "html", "pdf".
    if (!dictionary.has(word)) continue;
    if (isBlocked(word, profanity)) continue;
    if (seen.has(word)) continue;
    seen.add(word);
    corpus.push(word);
  }
  return corpus;
}

function buildNonsense({ dictionary, profanity }) {
  // Drawn from the home row only. The pool exists to fill the sparse easy end
  // of the score distribution, and the easy end is home-row keys by
  // construction. Curated once, weight-independent: which entries actually get
  // used is decided at run time by score, so tuning weights never invalidates
  // this list.
  const pool = [];
  const letters = HOME_ROW.split("");
  const build = (prefix, depth) => {
    if (depth === 0) {
      if (dictionary.has(prefix)) return;          // real words belong in the corpus
      if (isBlocked(prefix, profanity)) return;
      pool.push(prefix);
      return;
    }
    for (const letter of letters) build(prefix + letter, depth - 1);
  };
  for (const length of NONSENSE_LENGTHS) build("", length);
  return pool;
}

function moduleSource({ name, description, words, extra = "" }) {
  const lines = [];
  for (let i = 0; i < words.length; i += 10) {
    lines.push("  " + words.slice(i, i + 10).map((w) => `"${w}"`).join(", ") + ",");
  }
  return `// GENERATED FILE -- do not edit by hand.
// Regenerate with: node scripts/build-vocabulary.mjs
//
${description}
${extra}
export const ${name} = Object.freeze([
${lines.join("\n")}
]);
`;
}

const [frequency, dictionaryLines, profanityLines] = await Promise.all([
  fetchLines(SOURCES.frequency),
  fetchLines(SOURCES.dictionary),
  fetchLines(SOURCES.profanity),
]);
const dictionary = new Set(dictionaryLines);
const profanity = new Set(profanityLines.filter((w) => /^[a-z]+$/.test(w)));

const corpus = buildCorpus({ frequency, dictionary, profanity });
const nonsense = buildNonsense({ dictionary, profanity });

await writeFile(
  "src/data/word-corpus.js",
  moduleSource({
    name: "WORD_CORPUS",
    description: `// ${corpus.length} English words in descending frequency order, so a word's
// rank is its index + 1. Derived from google-10000-english-no-swears,
// intersected with a full dictionary to drop web artifacts (ebay, rss, html),
// and filtered against a profanity list.
//
// Known limitation: this is a web corpus, so it underweights child vocabulary
// ("dad" is absent) while ranking "administration" highly. Expected to be
// replaced or augmented with an age-appropriate source.`,
  words: corpus,
  }),
);

await writeFile(
  "src/data/nonsense-pool.js",
  moduleSource({
    name: "NONSENSE_POOL",
    description: `// ${nonsense.length} pronounceable-or-not two and three letter strings drawn from
// the home row, excluding real words and anything caught by a profanity
// filter. These fill the easy end of the difficulty range, which real words
// supply poorly: of 2000 corpus words only about 30 score below the level a
// beginning touch typist needs.`,
    words: nonsense,
  }),
);

console.log(`word-corpus.js   ${corpus.length} words`);
console.log(`nonsense-pool.js ${nonsense.length} strings`);
