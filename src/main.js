import { TypingEngine } from "./typing-engine.js";
import { generateIsland } from "./island.generator.js";
import {
  applyAction,
  countCompletedNodes,
  createInitialState,
  getCurrentNode,
  getItemCount,
  getVisibleActions,
  isFeatureVisible,
  isNodeCompleted,
} from "./island-engine.js";
import { createPromptService } from "./prompt-service.js";
import { resolveNodeColor } from "./biomes.js";
import { drawExplorerIcon } from "./explorer.js";
import { renderSceneToCanvas, clamp } from "./scene-renderer.js";

const SUCCESS_ACTION = Object.freeze({
  id: "new-island",
  kind: "reset",
  label: "New island",
  prompt: "new",
});

const ACCENT_COLOR = "#f472b6";
const LABEL_COLOR = "#e2e8f0";
const MAP_BACKGROUND = "#1e3a5f";
const MAP_GRID_COLOR = "#0f172a";
const MAP_PLAYER_COLOR = "#f8fafc";
const HIDE_PROMPTS = false;

const elements = {
  buffer: document.querySelector("[data-buffer]"),
  message: document.querySelector("[data-message]"),
  scene: document.querySelector("[data-scene]"),
  toast: document.querySelector("[data-toast]"),
  title: document.querySelector("[data-node-title]"),
  progress: document.querySelector("[data-progress]"),
  map: document.querySelector("[data-map]"),
};

let engine = null;
let island = null;
let state = null;
const promptService = createPromptService();
let sceneCtx = null;
let mapCtx = null;
let lastSceneNode = null;
let lastSceneActions = [];
let lastFeatureLayout = [];
let lastFeatureAnchors = new Map();
let highlightedActionId = null;

function render() {
  const node = state.status === "success" ? null : getCurrentNode(island, state);
  const title = state.status === "success" ? "You win!" : node?.title || "Unknown";
  elements.title.textContent = title;
  document.title = `Gem Island — ${title}`;

  renderProgress();
  renderMap();
  const actions = getRenderableActions(node);
  renderScene(node, actions);
  if (engine) {
    const interactiveActions = actions.filter((action) => !action.isCompleted);
    engine.setActions(interactiveActions);
  }
}

function formatCount(count, singular, plural = `${singular}s`) {
  const noun = count === 1 ? singular : plural;
  return `${count} ${noun}`;
}

function formatInventorySummary(currentState, options = {}) {
  const inventory = currentState?.inventory ?? {};
  const includeGems = options.includeGems ?? false;
  const includeZero = options.includeZero ?? false;
  const entries = Object.entries(inventory).filter(([item, count]) => {
    if (!Number.isFinite(count)) return false;
    if (!includeGems && item === "gem") return false;
    if (!includeZero && count <= 0) return false;
    return true;
  });
  if (!entries.length) return "none";
  return entries.map(([item, count]) => formatCount(count, item)).join(", ");
}

function renderProgress() {
  const visited = state.visitedNodes.size;
  const completed = countCompletedNodes(island, state);
  const inventorySummary = formatInventorySummary(state, { includeGems: true });
  elements.progress.innerHTML = `
    <div>Gems: ${getItemCount(state, "gem")} / ${island.requiredGems}</div>
    <div>Inventory: ${inventorySummary}</div>
    <div>Visited nodes: ${visited}</div>
    <div>Completed nodes: ${completed}</div>
  `;
}

function getRenderableActions(node) {
  if (state.status === "success") {
    return [{ ...SUCCESS_ACTION, isCompleted: false, layout: "center" }];
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

function ensureSceneContext() {
  const canvas = elements.scene;
  if (!canvas) return null;
  const width = canvas.clientWidth || canvas.offsetWidth || 720;
  const height = canvas.clientHeight || Math.max(420, Math.round(width * (3 / 4)));
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

function ensureMapContext() {
  const canvas = elements.map;
  if (!canvas) return null;
  const width = canvas.clientWidth || canvas.offsetWidth || 240;
  const height = canvas.clientHeight || width;
  const dpr = window.devicePixelRatio || 1;
  const displayWidth = Math.round(width * dpr);
  const displayHeight = Math.round(height * dpr);
  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  mapCtx = ctx;
  return { width, height };
}

function renderScene(node, actions) {
  const safeActions = Array.isArray(actions) ? actions : [];
  const dimensions = ensureSceneContext();
  if (!sceneCtx || !dimensions) return;
  lastSceneNode = node;
  lastSceneActions = safeActions;

  const { width, height } = dimensions;

  // Delegate to scene-renderer module
  const result = renderSceneToCanvas(sceneCtx, width, height, {
    node,
    actions: safeActions,
    state,
    island,
    highlightedActionId,
    successAction: SUCCESS_ACTION,
    hidePrompts: HIDE_PROMPTS,
    isFeatureVisible: (feature) => isFeatureVisible(feature, state, island),
  });

  lastFeatureLayout = result.featureLayout;
  lastFeatureAnchors = result.featureAnchors;
}

function renderMap() {
  if (!island || !state) return;
  const nodes = Object.values(island.nodes || {}).filter((entry) => entry?.position);
  if (!nodes.length) return;
  const dimensions = ensureMapContext();
  if (!mapCtx || !dimensions) return;
  const { width, height } = dimensions;
  mapCtx.clearRect(0, 0, width, height);
  mapCtx.fillStyle = MAP_BACKGROUND;
  mapCtx.fillRect(0, 0, width, height);

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  nodes.forEach((node) => {
    minX = Math.min(minX, node.position.x);
    maxX = Math.max(maxX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxY = Math.max(maxY, node.position.y);
  });
  const cols = Math.max(1, maxX - minX + 1);
  const rows = Math.max(1, maxY - minY + 1);
  const padding = 24;
  const cellSize = Math.max(20, Math.min((width - padding * 2) / cols, (height - padding * 2) / rows));
  const contentWidth = cellSize * cols;
  const contentHeight = cellSize * rows;
  const startX = (width - contentWidth) / 2;
  const startY = (height - contentHeight) / 2;
  const layout = { minX, minY, cellSize, startX, startY };

  nodes.forEach((node) => {
    const relativeX = node.position.x - minX;
    const relativeY = node.position.y - minY;
    const x = startX + relativeX * cellSize;
    const y = startY + relativeY * cellSize;
    drawMapCell(node, x, y, cellSize);
    if (state.status !== "success" && state.currentNodeId === node.id) {
      drawPlayerIcon(x, y, cellSize);
    }
  });

  drawMapLandmarks(island.mapLandmarks, layout);
  drawMapProgress(width, height);
}

function drawMapCell(node, x, y, size) {
  const discovered = state.visitedNodes?.has(node.id);
  const completed = discovered && isNodeCompleted(node, state);
  mapCtx.save();
  if (discovered) {
    mapCtx.fillStyle = resolveNodeColor(node) || "#1f2937";
    mapCtx.fillRect(x, y, size, size);
  } else {
    mapCtx.fillStyle = "#0f172a";
    mapCtx.fillRect(x, y, size, size);
    mapCtx.strokeStyle = MAP_GRID_COLOR;
    mapCtx.lineWidth = 2;
    mapCtx.strokeRect(x + 1, y + 1, size - 2, size - 2);
  }
  mapCtx.restore();
  if (discovered && completed) {
    drawMapCompletionIcon(x, y, size);
  }
}

function drawMapCompletionIcon(x, y, size) {
  const fontSize = Math.max(9, size * 0.28);
  const padding = Math.max(2, size * 0.06);
  mapCtx.save();
  mapCtx.font = `bold ${fontSize}px 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif`;
  mapCtx.textAlign = "left";
  mapCtx.textBaseline = "top";
  mapCtx.fillText("✅", x, y + padding);
  mapCtx.restore();
}

function drawPlayerIcon(x, y, size) {
  mapCtx.save();
  const iconScale = clamp(size / 120, 0.4, 0.8);
  const iconX = x + size / 2;
  const iconY = y + size / 2 + size * 0.05;
  drawExplorerIcon(mapCtx, iconX, iconY, iconScale, {
    shirtPink: ACCENT_COLOR,
    tieBlue: MAP_PLAYER_COLOR,
  });
  mapCtx.restore();
}

function drawMapProgress(width, height) {
  const inventorySummary = formatInventorySummary(state);
  const text =
    inventorySummary === "none"
      ? `Gems ${getItemCount(state, "gem")} / ${island.requiredGems}`
      : `Gems ${getItemCount(state, "gem")} / ${island.requiredGems} • ${inventorySummary}`;
  mapCtx.save();
  mapCtx.fillStyle = LABEL_COLOR;
  mapCtx.font = "600 14px 'Fira Mono', 'SFMono-Regular', Menlo, Monaco, Consolas, monospace";
  mapCtx.textAlign = "left";
  mapCtx.textBaseline = "top";
  mapCtx.fillText(text, 12, 10);
  mapCtx.restore();
}

function drawMapLandmarks(landmarks, layout) {
  if (!Array.isArray(landmarks) || !landmarks.length) return;
  landmarks.forEach((landmark) => {
    if (!landmark?.position) return;
    const relativeX = landmark.position.x - layout.minX;
    const relativeY = landmark.position.y - layout.minY;
    const x = layout.startX + relativeX * layout.cellSize;
    const y = layout.startY + relativeY * layout.cellSize;
    drawMapLandmark(landmark, x, y, layout.cellSize);
  });
}

function drawMapLandmark(landmark, x, y, size) {
  if (landmark.type !== "volcano") return;
  const inset = Math.max(2, size * 0.08);
  mapCtx.save();
  mapCtx.fillStyle = "#020617";
  mapCtx.fillRect(x + inset, y + inset, size - inset * 2, size - inset * 2);
  mapCtx.strokeStyle = "rgba(148, 163, 184, 0.35)";
  mapCtx.lineWidth = Math.max(1, size * 0.04);
  mapCtx.strokeRect(x + inset, y + inset, size - inset * 2, size - inset * 2);
  mapCtx.restore();

  const centerX = x + size / 2;
  const centerY = y + size / 2;
  const radius = Math.max(6, size * 0.28);
  mapCtx.save();
  mapCtx.fillStyle = "#1f2937";
  mapCtx.beginPath();
  mapCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  mapCtx.fill();
  mapCtx.strokeStyle = "#f97316";
  mapCtx.lineWidth = Math.max(2, size * 0.06);
  mapCtx.stroke();
  mapCtx.fillStyle = "#fb923c";
  mapCtx.beginPath();
  mapCtx.arc(centerX - radius * 0.2, centerY - radius * 0.15, radius * 0.3, 0, Math.PI * 2);
  mapCtx.fill();
  mapCtx.restore();
}

function updateBufferDisplay(text, match) {
  elements.buffer.textContent = text;
  highlightMatch(match);
}

function highlightMatch(match) {
  highlightedActionId = match?.id || null;
  renderScene(lastSceneNode, lastSceneActions);
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

  switch (action.kind) {
    case "move": {
      if (action.to) {
        const destination = island.nodes[action.to];
        const destinationTitle = destination?.title || action.to;
        showActivation(`You moved to: ${destinationTitle}`, "success");
      }
      break;
    }
    case "ship": {
      showActivation("Trying to leave the island...", "success");
      break;
    }
    case "pickup":
      clearActivation();
      break;
    default: {
      showActivation(`Activated: ${action.label}`, "success");
    }
  }

  const result = applyAction(island, state, action.id);
  state = result.state;
  promptService.refresh(action.id);

  result.events?.forEach((event) => {
    if (event.type === "toast") {
      const variant = event.message === "Success!" ? "success" : "error";
      showToast(event.message, variant);
    }
    if (event.type === "message") {
      showActivation(event.message, event.variant);
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

function createSeededRandom(seed) {
  let value = seed % 2147483647;
  if (value <= 0) {
    value += 2147483646;
  }
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function nextSeed() {
  return Math.floor(Math.random() * 1_000_000_000) + 1;
}

function restartIsland() {
  const seed = nextSeed();
  island = generateIsland({ random: createSeededRandom(seed) });
  logIsland(seed, island);
  state = createInitialState(island);
  promptService.reset();
  clearActivation();
  clearToast();
  render();
}

function boot() {
  const seed = nextSeed();
  island = generateIsland({ random: createSeededRandom(seed) });
  logIsland(seed, island);
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
    renderMap();
  });
}

boot();

function logIsland(seed, islandData) {
  if (!islandData) return;
  const dump = {
    seed,
    requiredGems: islandData.requiredGems,
    nodes: Object.values(islandData.nodes || {}).map((node) => ({
      id: node.id,
      title: node.title,
      biome: node.biome,
      position: node.position,
      actions: node.actions
        .filter((action) => action.kind === "move")
        .map((action) => ({ id: action.id, kind: action.kind, label: action.label, to: action.to })),
    })),
    mapLandmarks: islandData.mapLandmarks || [],
  };
  console.log("Gem Island seed:", seed);
  console.log("Gem Island map dump:", JSON.stringify(dump, null, 2));
}
