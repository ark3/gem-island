const ACTIONS = [
  { id: "go-north", label: "Go North", prompt: "cat" },
  { id: "check-sign", label: "Check Sign", prompt: "sun" },
];

class TypingEngine {
  constructor(actions, { onActivate, onBufferChange }) {
    this.actions = actions;
    this.onActivate = onActivate;
    this.onBufferChange = onBufferChange;
    this.buffer = "";
  }

  type(char) {
    this.buffer += char;
    this.notifyBuffer();
    this.checkMatch();
  }

  backspace() {
    if (!this.buffer.length) return;
    this.buffer = this.buffer.slice(0, -1);
    this.notifyBuffer();
  }

  clearBuffer() {
    this.buffer = "";
    this.notifyBuffer();
  }

  notifyBuffer() {
    if (typeof this.onBufferChange === "function") {
      this.onBufferChange(this.buffer);
    }
  }

  checkMatch() {
    const matched = this.actions.find((action) => action.prompt === this.buffer);
    if (!matched) return;

    if (typeof this.onActivate === "function") {
      this.onActivate(matched);
    }
    this.clearBuffer();
  }
}

const actionsList = document.getElementById("actions");
const bufferEl = document.getElementById("buffer");
const messageEl = document.getElementById("message");
let messageTimer = null;

function renderActions(actions) {
  actionsList.innerHTML = "";
  actions.forEach((action) => {
    const li = document.createElement("li");
    li.className = "action";
    li.innerHTML = `
      <span class="action__label">${action.label}</span>
      <span class="action__prompt">${action.prompt}</span>
    `;
    actionsList.appendChild(li);
  });
}

function updateBufferDisplay(text) {
  bufferEl.textContent = text;
}

function showMessage(text, duration = 800) {
  clearMessageTimer();
  messageEl.textContent = text;
  messageTimer = window.setTimeout(() => {
    messageEl.textContent = "";
  }, duration);
}

function clearMessageTimer() {
  if (messageTimer) {
    window.clearTimeout(messageTimer);
    messageTimer = null;
  }
}

function handleKeydown(event, engine) {
  if (event.metaKey || event.ctrlKey || event.altKey) return;

  if (event.key === "Backspace") {
    event.preventDefault();
    engine.backspace();
    return;
  }

  if (event.key.length === 1) {
    engine.type(event.key);
  }
}

function init() {
  renderActions(ACTIONS);

  const engine = new TypingEngine(ACTIONS, {
    onActivate: (action) => {
      showMessage(`Activated: ${action.label}`);
    },
    onBufferChange: updateBufferDisplay,
  });

  updateBufferDisplay(engine.buffer);
  window.addEventListener("keydown", (event) => handleKeydown(event, engine));
}

init();
