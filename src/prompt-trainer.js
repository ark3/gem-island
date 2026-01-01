const DEFAULT_PROMPTS = [
  "cat",
  "sun",
  "dog",
  "hat",
  "pen",
  "cup",
  "ram",
  "tree",
  "bird",
  "shell",
  "star",
  "wind",
  "leaf",
  "wave",
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
