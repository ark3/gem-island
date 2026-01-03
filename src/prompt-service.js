import { createPromptTrainer } from "./prompt-trainer.js";

const RECENT_PROMPT_LIMIT = 15;

function rollUniquePrompt(trainer, avoidSet, recentSet, maxAttempts = 60) {
  let attempt = 0;
  while (attempt < maxAttempts) {
    const candidate = trainer.nextPrompt();
    if (!avoidSet.has(candidate) && !recentSet.has(candidate)) {
      return candidate;
    }
    attempt += 1;
  }
  return trainer.nextPrompt();
}

export function createPromptService({ trainer = createPromptTrainer() } = {}) {
  if (!trainer || typeof trainer.nextPrompt !== "function") {
    throw new Error("createPromptService requires a trainer with nextPrompt()");
  }

  let recentPrompts = [];

  function rememberPrompt(prompt) {
    if (!prompt) return;
    recentPrompts = [...recentPrompts, prompt].slice(-RECENT_PROMPT_LIMIT);
  }

  return {
    getPrompt(_actionId, avoidSet = new Set()) {
      const recentSet = new Set(recentPrompts);
      const prompt = rollUniquePrompt(trainer, avoidSet, recentSet);
      rememberPrompt(prompt);
      return prompt;
    },
    refresh() {},
    reset() {
      recentPrompts = [];
    },
    peek() {
      return null;
    },
  };
}
