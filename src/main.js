import { TypingEngine } from "./typing-engine.js";

const ACTIONS = Object.freeze([
  { id: "go-north", label: "Go North", prompt: "cat" },
  { id: "check-sign", label: "Check Sign", prompt: "sun" },
]);

const elements = {
  actions: document.querySelector("[data-actions]"),
  buffer: document.querySelector("[data-buffer]"),
  message: document.querySelector("[data-message]"),
};

const actionElements = new Map();
let messageTimer = null;

function renderActions(actions) {
  actionElements.clear();
  elements.actions.innerHTML = "";
  actions.forEach((action) => {
    const item = document.createElement("li");
    item.className = "action";
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

function showMessage(text, variant = "neutral", duration = 800) {
  clearTimeout(messageTimer);
  elements.message.textContent = text;
  elements.message.classList.remove("message--success", "message--error");
  if (variant === "success") {
    elements.message.classList.add("message--success");
  } else if (variant === "error") {
    elements.message.classList.add("message--error");
  }
  messageTimer = window.setTimeout(() => {
    elements.message.textContent = "";
    elements.message.classList.remove("message--success", "message--error");
  }, duration);
}

function handleKeydown(event, engine) {
  if (event.metaKey || event.ctrlKey || event.altKey) return;

  if (event.key === "Backspace") {
    event.preventDefault();
    engine.backspace();
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    const activated = engine.activateMatch();
    if (!activated) {
      showMessage("No matching action", "error");
    }
    return;
  }

  if (event.key.length === 1) {
    event.preventDefault();
    engine.append(event.key);
  }
}

function boot() {
  renderActions(ACTIONS);

  const engine = new TypingEngine({
    actions: ACTIONS,
    onActivate: (action) => showMessage(`Activated: ${action.label}`, "success"),
    onBufferChange: updateBufferDisplay,
  });

  updateBufferDisplay("", null);
  window.addEventListener("keydown", (event) => handleKeydown(event, engine));
}

boot();
