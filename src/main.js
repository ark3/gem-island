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

const SCENE_DEFAULT_COLOR = "#0b1220";
const ACCENT_COLOR = "#f472b6";
const CARD_BACKGROUND = "#0b1220";
const CARD_BORDER = "#1f2937";
const LABEL_COLOR = "#e2e8f0";
const PROMPT_COLOR = "#a5b4fc";
const CENTER_PROMPT_HEIGHT = 64;
const CENTER_PROMPT_GAP = 16;
const MOVEMENT_PROMPT_HEIGHT = 56;
const MOVEMENT_PROMPT_WIDTH = 180;

const elements = {
  buffer: document.querySelector("[data-buffer]"),
  message: document.querySelector("[data-message]"),
  scene: document.querySelector("[data-scene]"),
  toast: document.querySelector("[data-toast]"),
  title: document.querySelector("[data-node-title]"),
  progress: document.querySelector("[data-progress]"),
};

let engine = null;
let island = null;
let state = null;
const promptService = createPromptService();
let sceneCtx = null;
let lastSceneNode = null;
let lastSceneActions = [];
let highlightedActionId = null;

function render() {
  const node = state.status === "success" ? null : getCurrentNode(island, state);
  const title = state.status === "success" ? "Voyage Complete" : node?.title || "Unknown";
  elements.title.textContent = title;
  document.title = `Gem Island — ${title}`;

  renderProgress();
  const actions = getRenderableActions(node);
  renderScene(node, actions);
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

function getMovementDirection(node, action) {
  if (!node || action.kind !== "move" || !action.to) return null;
  const destination = island?.nodes?.[action.to];
  if (!destination || !destination.position || !node.position) {
    return null;
  }
  const deltaX = destination.position.x - node.position.x;
  const deltaY = destination.position.y - node.position.y;
  if (deltaX === 0 && deltaY === -1) return "north";
  if (deltaX === 0 && deltaY === 1) return "south";
  if (deltaX === -1 && deltaY === 0) return "west";
  if (deltaX === 1 && deltaY === 0) return "east";
  return null;
}

function ensureSceneContext() {
  const canvas = elements.scene;
  if (!canvas) return null;
  const width = canvas.clientWidth || canvas.offsetWidth || 640;
  const height = canvas.clientHeight || Math.max(360, Math.round(width * (9 / 16)));
  const dpr = window.devicePixelRatio || 1;
  const displayWidth = Math.round(width * dpr);
  const displayHeight = Math.round(height * dpr);
  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  sceneCtx = ctx;
  return { width, height };
}

function renderScene(node, actions) {
  const safeActions = Array.isArray(actions) ? actions : [];
  const dimensions = ensureSceneContext();
  if (!sceneCtx || !dimensions) return;
  lastSceneNode = node;
  lastSceneActions = safeActions;

  const { width, height } = dimensions;
  sceneCtx.clearRect(0, 0, width, height);
  sceneCtx.fillStyle = node?.color || SCENE_DEFAULT_COLOR;
  sceneCtx.fillRect(0, 0, width, height);

  const movementEntries = [];
  const centerEntries = [];
  safeActions.forEach((action) => {
    if (action.kind === "move") {
      const direction = getMovementDirection(node, action);
      if (direction) {
        movementEntries.push({ action, direction });
        return;
      }
    }
    centerEntries.push(action);
  });

  movementEntries.forEach(({ action, direction }) => {
    drawMovementPrompt(action, direction, width, height);
  });
  drawCenterPrompts(centerEntries, width, height);
}

function updateBufferDisplay(text, match) {
  elements.buffer.textContent = text;
  highlightMatch(match);
}

function highlightMatch(match) {
  highlightedActionId = match?.id || null;
  renderScene(lastSceneNode, lastSceneActions);
}

function drawRoundedRectPath(ctx, x, y, width, height, radius = 12) {
  const r = Math.max(4, Math.min(radius, Math.min(width, height) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawPromptCardBackground(x, y, width, height, isHighlighted, radius = 12) {
  sceneCtx.save();
  sceneCtx.fillStyle = CARD_BACKGROUND;
  sceneCtx.strokeStyle = CARD_BORDER;
  sceneCtx.lineWidth = 2;
  drawRoundedRectPath(sceneCtx, x, y, width, height, radius);
  sceneCtx.fill();
  sceneCtx.stroke();
  if (isHighlighted) {
    sceneCtx.strokeStyle = ACCENT_COLOR;
    sceneCtx.lineWidth = 2;
    drawRoundedRectPath(sceneCtx, x + 6, y + 6, width - 12, height - 12, Math.max(4, radius - 6));
    sceneCtx.stroke();
  }
  sceneCtx.restore();
}

function drawCenterPrompts(actions, width, height) {
  if (!actions.length) return;
  const cardWidth = Math.min(360, width - 80);
  const totalHeight = actions.length * CENTER_PROMPT_HEIGHT + (actions.length - 1) * CENTER_PROMPT_GAP;
  const startY = Math.max(20, (height - totalHeight) / 2);
  const x = (width - cardWidth) / 2;

  actions.forEach((action, index) => {
    const y = startY + index * (CENTER_PROMPT_HEIGHT + CENTER_PROMPT_GAP);
    const isHighlighted = action.id === highlightedActionId;
    sceneCtx.save();
    if (action.isCompleted) {
      sceneCtx.globalAlpha = 0.5;
    }
    drawPromptCardBackground(x, y, cardWidth, CENTER_PROMPT_HEIGHT, isHighlighted);

    sceneCtx.textBaseline = "middle";
    sceneCtx.font = "700 18px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    sceneCtx.textAlign = "left";
    sceneCtx.fillStyle = LABEL_COLOR;
    sceneCtx.fillText(action.label, x + 16, y + CENTER_PROMPT_HEIGHT / 2);

    sceneCtx.font = "600 16px 'Fira Mono', 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
    sceneCtx.textAlign = "right";
    sceneCtx.fillStyle = PROMPT_COLOR;
    sceneCtx.fillText(action.prompt, x + cardWidth - 16, y + CENTER_PROMPT_HEIGHT / 2);
    sceneCtx.restore();
  });
}

function getMovementRect(direction, width, height) {
  const w = Math.min(MOVEMENT_PROMPT_WIDTH, width - 80);
  const h = MOVEMENT_PROMPT_HEIGHT;
  const margin = 16;
  switch (direction) {
    case "north":
      return { x: (width - w) / 2, y: margin, width: w, height: h };
    case "south":
      return { x: (width - w) / 2, y: height - h - margin, width: w, height: h };
    case "west":
      return { x: margin, y: (height - h) / 2, width: w, height: h };
    case "east":
      return { x: width - w - margin, y: (height - h) / 2, width: w, height: h };
    default:
      return null;
  }
}

function drawMovementPrompt(action, direction, width, height) {
  const rect = getMovementRect(direction, width, height);
  if (!rect) return;
  const isHighlighted = action.id === highlightedActionId;
  sceneCtx.save();
  if (action.isCompleted) {
    sceneCtx.globalAlpha = 0.5;
  }
  drawPromptCardBackground(rect.x, rect.y, rect.width, rect.height, isHighlighted);

  sceneCtx.textBaseline = "middle";
  sceneCtx.textAlign = "center";
  sceneCtx.font = "600 18px 'Fira Mono', 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
  sceneCtx.fillStyle = PROMPT_COLOR;
  sceneCtx.fillText(action.prompt, rect.x + rect.width / 2, rect.y + rect.height / 2);
  sceneCtx.restore();
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
  window.addEventListener("resize", () => {
    renderScene(lastSceneNode, lastSceneActions);
  });
}

boot();
