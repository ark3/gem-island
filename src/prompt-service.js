import { createPromptTrainer } from "./prompt-trainer.js";

function rollUniquePrompt(trainer, avoidSet, maxAttempts = 50) {
  let attempt = 0;
  while (attempt < maxAttempts) {
    const candidate = trainer.nextPrompt();
    if (!avoidSet.has(candidate)) {
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

  const assignments = new Map();

  return {
    getPrompt(actionId, avoidSet = new Set()) {
      const existing = assignments.get(actionId);
      if (existing && !avoidSet.has(existing)) {
        return existing;
      }
      const prompt = rollUniquePrompt(trainer, avoidSet);
      assignments.set(actionId, prompt);
      return prompt;
    },
    refresh(actionId) {
      assignments.delete(actionId);
    },
    reset() {
      assignments.clear();
    },
    peek(actionId) {
      return assignments.get(actionId) || null;
    },
  };
}
