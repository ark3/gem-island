const DEFAULT_LETTER_WEIGHTS = Object.freeze({
  e: 0.0872,
  t: 0.0714,
  a: 0.0671,
  o: 0.0636,
  i: 0.061,
  n: 0.0594,
  s: 0.0573,
  h: 0.0562,
  r: 0.0556,
  d: 0.0455,
  l: 0.0436,
  c: 0.0352,
  u: 0.0352,
  w: 0.0321,
  m: 0.0321,
  f: 0.0305,
  g: 0.0288,
  y: 0.0288,
  p: 0.0279,
  b: 0.0242,
  v: 0.019,
  k: 0.0166,
  x: 0.0072,
  j: 0.0061,
  q: 0.0048,
  z: 0.0038,
});

function buildWeightedChoices({ prompts, weights }) {
  if (Array.isArray(prompts) && prompts.length) {
    return prompts.map((prompt) => ({ prompt, weight: 1 }));
  }
  const entries = Object.entries(weights || {});
  return entries.map(([prompt, weight]) => ({ prompt, weight: Math.max(0, Number(weight) || 0) }));
}

function pickWeightedPrompt(choices, random) {
  const total = choices.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) {
    const index = Math.floor(random() * choices.length);
    return choices[index]?.prompt ?? null;
  }
  let threshold = random() * total;
  for (const entry of choices) {
    threshold -= entry.weight;
    if (threshold <= 0) return entry.prompt;
  }
  return choices[choices.length - 1]?.prompt ?? null;
}

export function createPromptTrainer({
  prompts,
  weights = DEFAULT_LETTER_WEIGHTS,
  random = Math.random,
} = {}) {
  const choices = buildWeightedChoices({ prompts, weights });
  if (!choices.length) {
    throw new Error("Prompt trainer requires at least one prompt");
  }

  return {
    nextPrompt() {
      return pickWeightedPrompt(choices, random);
    },
  };
}
