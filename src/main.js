import { TypingEngine } from "./typing-engine.js";
import { createManualIsland } from "./island.manual.js";
import {
  applyAction,
  countCompletedNodes,
  createInitialState,
  getCurrentNode,
  getVisibleActions,
} from "./island-engine.js";
import { createPromptService } from "./prompt-service.js";

const SUCCESS_ACTION = Object.freeze({
  id: "new-island",
  kind: "reset",
  label: "New island",
  prompt: "new",
});

const elements = {
  actions: document.querySelector("[data-actions]"),
  buffer: document.querySelector("[data-buffer]"),
  message: document.querySelector("[data-message]"),
  toast: document.querySelector("[data-toast]"),
  title: document.querySelector("[data-node-title]"),
  progress: document.querySelector("[data-progress]"),
};

const actionElements = new Map();
let engine = null;
let island = null;
let state = null;
const promptService = createPromptService();

function render() {
  const node = state.status === "success" ? null : getCurrentNode(island, state);
  const title = state.status === "success" ? "Voyage Complete" : node?.title || "Unknown";
  elements.title.textContent = title;
  document.title = `Gem Island — ${title}`;

  renderProgress();
  const actions = getRenderableActions(node);
  renderActions(actions);
  if (engine) {
    const interactiveActions = actions.filter((action) => !action.isCompleted);
    engine.setActions(interactiveActions);
  }
}

function renderProgress() {
  const visited = state.visitedNodes.size;
  const completed = countCompletedNodes(island, state);
  elements.progress.innerHTML = `
    <div>Gems: ${state.gemsCollected} / ${island.requiredGems}</div>
    <div>Location: ${state.currentNodeId}</div>
    <div>Visited nodes: ${visited}</div>
    <div>Completed nodes: ${completed}</div>
  `;
}

function getRenderableActions(node) {
  if (state.status === "success") {
    return [{ ...SUCCESS_ACTION, isCompleted: false }];
  }
  const usedPrompts = new Set();
  return getVisibleActions(island, state, node).map((action) => {
    const prompt = promptService.getPrompt(action.id, usedPrompts);
    usedPrompts.add(prompt);
    return {
      ...action,
      prompt,
    };
  });
}

function renderActions(actions) {
  actionElements.clear();
  elements.actions.innerHTML = "";
  actions.forEach((action) => {
    const item = document.createElement("li");
    item.className = "action";
    if (action.isCompleted) {
      item.classList.add("action--completed");
    }
    item.dataset.actionId = action.id;

    const labelSpan = document.createElement("span");
    labelSpan.className = "action__label";
    labelSpan.textContent = action.label;

    const promptSpan = document.createElement("span");
    promptSpan.className = "action__prompt";
    promptSpan.textContent = action.prompt;

    item.appendChild(labelSpan);
    item.appendChild(promptSpan);
    elements.actions.appendChild(item);
    actionElements.set(action.id, item);
  });
}

function updateBufferDisplay(text, match) {
  elements.buffer.textContent = text;
  highlightMatch(match);
}

function highlightMatch(match) {
  actionElements.forEach((element, id) => {
    const isMatch = Boolean(match && match.id === id);
    element.classList.toggle("action--match", isMatch);
    if (isMatch) {
      element.setAttribute("aria-current", "true");
    } else {
      element.removeAttribute("aria-current");
    }
  });
}

function showActivation(text, variant = "neutral") {
  elements.message.textContent = text;
  elements.message.classList.remove("message--success", "message--error");
  if (variant === "success") {
    elements.message.classList.add("message--success");
  } else if (variant === "error") {
    elements.message.classList.add("message--error");
  }
}

function showToast(text, variant = "neutral") {
  elements.toast.textContent = text;
  elements.toast.classList.remove("message--success", "message--error");
  if (variant === "success") {
    elements.toast.classList.add("message--success");
  } else if (variant === "error") {
    elements.toast.classList.add("message--error");
  }
}

function clearActivation() {
  elements.message.textContent = "";
  elements.message.classList.remove("message--success", "message--error");
}

function clearToast() {
  elements.toast.textContent = "";
  elements.toast.classList.remove("message--success", "message--error");
}

function handleAction(action) {
  if (!action) return;

  if (state.status === "success" && action.id === SUCCESS_ACTION.id) {
    showActivation("Starting a new run!", "success");
    restartIsland();
    return;
  }

  if (action.kind === "move" && action.to) {
    const destination = island.nodes[action.to];
    const destinationTitle = destination?.title || action.to;
    showActivation(`You moved to: ${destinationTitle}`, "success");
  } else if (action.kind === "ship") {
    showActivation("Trying to leave the island...", "success");
  } else {
    showActivation(`Activated: ${action.label}`, "success");
  }

  const result = applyAction(island, state, action.id);
  state = result.state;
  promptService.refresh(action.id);

  result.events?.forEach((event) => {
    if (event.type === "toast") {
      const variant = event.message === "Success!" ? "success" : "error";
      showToast(event.message, variant);
    }
  });

  render();
}

function handleKeydown(event) {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (!engine) return;

  if (event.key === "Backspace") {
    event.preventDefault();
    engine.backspace();
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    const activated = engine.activateMatch();
    if (!activated) {
      showActivation("No matching action", "error");
    }
    return;
  }

  if (event.key.length === 1) {
    event.preventDefault();
    clearActivation();
    clearToast();
    engine.append(event.key);
  }
}

function restartIsland() {
  island = createManualIsland();
  state = createInitialState(island);
  promptService.reset();
  clearActivation();
  clearToast();
  render();
}

function boot() {
  island = createManualIsland();
  state = createInitialState(island);
  engine = new TypingEngine({
    actions: [],
    onActivate: handleAction,
    onBufferChange: updateBufferDisplay,
  });

  render();
  updateBufferDisplay("", null);
  clearActivation();
  clearToast();
  window.addEventListener("keydown", handleKeydown);
}

boot();
