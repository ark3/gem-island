import { createPromptTrainer } from "./prompt-trainer.js";

const RECENT_PROMPT_LIMIT = 15;

function rollUniquePrompt(trainer, avoidSet, recentSet, maxAttempts = 60) {
  // Preferred: a prompt that is neither on screen already nor recently seen.
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = trainer.nextPrompt();
    if (!avoidSet.has(candidate) && !recentSet.has(candidate)) {
      return candidate;
    }
  }

  // The recent window can be as large as (or larger than) a small tier's whole
  // vocabulary, in which case no candidate is ever "not recent" and the loop
  // above can never succeed. Within-view uniqueness still has to hold: two
  // visible actions sharing a prompt makes one of them unreachable, because
  // TypingEngine matches the first action with that prompt and stops.
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = trainer.nextPrompt();
    if (!avoidSet.has(candidate)) {
      return candidate;
    }
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
