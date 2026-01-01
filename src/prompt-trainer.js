const DEFAULT_PROMPTS = [
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "v",
  "w",
  "x",
  "y",
  "z",
];

export function createPromptTrainer({ prompts = DEFAULT_PROMPTS, random = Math.random } = {}) {
  const choices = Array.from(prompts);
  if (!choices.length) {
    throw new Error("Prompt trainer requires at least one prompt");
  }

  return {
    nextPrompt() {
      const index = Math.floor(random() * choices.length);
      return choices[index];
    },
  };
}
