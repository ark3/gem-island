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
import { getBiomeById, resolveNodeColor } from "./biomes.js";
import { normalizeFeatureEntry } from "./features.js";

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
const CENTER_PROMPT_HEIGHT = 54;
const CENTER_PROMPT_GAP = 14;
const MOVEMENT_PROMPT_HEIGHT = 52;
const MOVEMENT_PROMPT_WIDTH = 168;
const FEATURE_SLOT_RADIUS = 50;
const ANCHORED_PROMPT_WIDTH = 190;
const ANCHORED_PROMPT_HEIGHT = 52;
const PROMPT_CARD_MARGIN = 16;

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
let lastFeatureLayout = [];
let lastFeatureAnchors = new Map();
let highlightedActionId = null;

function render() {
  const node = state.status === "success" ? null : getCurrentNode(island, state);
  const title = state.status === "success" ? "You win!" : node?.title || "Unknown";
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

function renderScene(node, actions) {
  const safeActions = Array.isArray(actions) ? actions : [];
  const dimensions = ensureSceneContext();
  if (!sceneCtx || !dimensions) return;
  lastSceneNode = node;
  lastSceneActions = safeActions;

  const { width, height } = dimensions;
  const color = resolveNodeColor(node) || SCENE_DEFAULT_COLOR;
  sceneCtx.clearRect(0, 0, width, height);
  sceneCtx.fillStyle = color;
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

  const normalizedFeatures = Array.isArray(node?.features)
    ? node.features
        .map((feature) => normalizeFeatureEntry(feature))
        .filter(Boolean)
    : [];
  lastFeatureLayout = placeFeatures(normalizedFeatures, width, height);
  lastFeatureAnchors = buildFeatureAnchors(lastFeatureLayout, width, height);

  const biome = getBiomeById(node?.biome);
  drawBiomeBase(biome, width, height);
  drawBiomePaths(node, movementEntries, width, height);
  drawFeatures(lastFeatureLayout);

  movementEntries.forEach(({ action, direction }) => {
    drawMovementPrompt(node, action, direction, width, height);
  });
  if (state.status === "success") {
    drawWinScreen(width, height);
  } else {
    drawActionPrompts(centerEntries, lastFeatureAnchors, width, height);
  }
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

function drawActionPrompts(actions, featureAnchors, width, height) {
  if (!actions.length) return;
  const anchoredEntries = [];
  const unanchored = [];
  actions.forEach((action) => {
    if (action.kind !== "move" && action.isCompleted) {
      return;
    }
    const anchor = featureAnchors.get(action.id);
    if (anchor) {
      anchoredEntries.push({ action, anchor });
    } else {
      unanchored.push(action);
    }
  });

  anchoredEntries.forEach(({ action, anchor }) => {
    const rect = rectFromAnchor(anchor, ANCHORED_PROMPT_WIDTH, ANCHORED_PROMPT_HEIGHT, width, height);
    drawPromptCard(action, rect);
  });

  if (!unanchored.length) return;

  const cardWidth = Math.min(360, width - 80);
  const totalHeight = unanchored.length * CENTER_PROMPT_HEIGHT + (unanchored.length - 1) * CENTER_PROMPT_GAP;
  const startY = Math.max(20, (height - totalHeight) / 2);
  const x = (width - cardWidth) / 2;

  unanchored.forEach((action, index) => {
    const y = startY + index * (CENTER_PROMPT_HEIGHT + CENTER_PROMPT_GAP);
    drawPromptCard(action, { x, y, width: cardWidth, height: CENTER_PROMPT_HEIGHT });
  });
}

function drawPromptCard(action, rect) {
  const isHighlighted = action.id === highlightedActionId;
  sceneCtx.save();
  drawPromptCardBackground(rect.x, rect.y, rect.width, rect.height, isHighlighted);

  sceneCtx.textBaseline = "middle";
  sceneCtx.font = "600 16px 'Fira Mono', 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
  sceneCtx.textAlign = "center";
  sceneCtx.fillStyle = PROMPT_COLOR;
  sceneCtx.fillText(action.prompt, rect.x + rect.width / 2, rect.y + rect.height / 2);
  sceneCtx.restore();
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

function drawMovementPrompt(node, action, direction, width, height) {
  const rect = getMovementRect(direction, width, height);
  if (!rect) return;
  const isHighlighted = action.id === highlightedActionId;
  sceneCtx.save();
  if (action.isCompleted) {
    sceneCtx.globalAlpha = 0.5;
  }
  drawAdjacencyHint(node, direction, rect);
  drawPromptCardBackground(rect.x, rect.y, rect.width, rect.height, isHighlighted);

  sceneCtx.textBaseline = "middle";
  sceneCtx.textAlign = "center";
  sceneCtx.font = "600 16px 'Fira Mono', 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
  sceneCtx.fillStyle = PROMPT_COLOR;
  sceneCtx.fillText(action.prompt, rect.x + rect.width / 2, rect.y + rect.height / 2);
  sceneCtx.restore();
}

function drawBiomeBase(_biome, _width, _height) {
  // Placeholder for future biome rendering logic.
}

function drawBiomePaths(node, movementEntries, width, height) {
  if (!node || movementEntries.length === 0) return;
  const centerX = width / 2;
  const centerY = height / 2;
  const pathThickness = 30;
  movementEntries.forEach(({ direction }) => {
    sceneCtx.save();
    sceneCtx.fillStyle = "rgba(0, 0, 0, 0.25)";
    switch (direction) {
      case "north": {
        const rectHeight = centerY - MOVEMENT_PROMPT_HEIGHT - 12;
        sceneCtx.fillRect(
          centerX - pathThickness / 2,
          MOVEMENT_PROMPT_HEIGHT + 40,
          pathThickness,
          rectHeight
        );
        break;
      }
      case "south": {
        const startY = centerY;
        const rectHeight = height - startY - MOVEMENT_PROMPT_HEIGHT - 40;
        sceneCtx.fillRect(centerX - pathThickness / 2, startY, pathThickness, rectHeight);
        break;
      }
      case "west": {
          const rectWidth = centerX - MOVEMENT_PROMPT_WIDTH - 16;
          sceneCtx.fillRect(
            MOVEMENT_PROMPT_WIDTH + 32,
            centerY - pathThickness / 2,
            rectWidth,
            pathThickness
          );
          break;
        }
      case "east": {
        const startX = centerX;
        const rectWidth = width - startX - MOVEMENT_PROMPT_WIDTH - 32;
        sceneCtx.fillRect(startX, centerY - pathThickness / 2, rectWidth, pathThickness);
        break;
      }
      default:
        break;
    }
    sceneCtx.restore();
  });
}

function placeFeatures(features, width, height) {
  const layout = [];
  const slots = getFeatureSlots(width, height);
  features.forEach((feature) => {
    if (feature.isConsumable && feature.actionId && state?.completedActions?.has(feature.actionId)) {
      return;
    }
    let slot = null;
    if (feature.type === "ship") {
      slot = {
        id: "ship-dock",
        x: width / 2,
        y: Math.max(height - 140, height * 0.65),
      };
    } else {
      slot = slots.shift();
    }
    if (!slot) return;
    layout.push({ ...feature, slot });
  });
  return layout;
}

function getFeatureSlots(width, height) {
  const center = { x: width / 2, y: height / 2 };
  const offset = 120;
  const slots = [
    { id: "north", x: center.x, y: center.y - offset },
    { id: "east", x: center.x + offset, y: center.y },
    { id: "west", x: center.x - offset, y: center.y },
    { id: "south", x: center.x, y: center.y + offset },
  ];
  slots.push({ id: "center", x: center.x, y: center.y });
  return slots;
}

function drawFeatures(features) {
  features.forEach((feature) => {
    const { slot } = feature;
    if (!slot) return;
    switch (feature.type) {
      case "ship":
        drawShipFeature(slot);
        break;
      case "gem":
        drawGemFeature(slot);
        break;
      default:
        drawPlaceholderFeature(slot);
        break;
    }
  });
}

function drawShipFeature(slot) {
  sceneCtx.save();
  sceneCtx.fillStyle = "#1e3a8a";
  sceneCtx.strokeStyle = "#0f172a";
  sceneCtx.lineWidth = 3;
  sceneCtx.beginPath();
  sceneCtx.moveTo(slot.x - 40, slot.y + 30);
  sceneCtx.lineTo(slot.x + 40, slot.y + 30);
  sceneCtx.lineTo(slot.x + 20, slot.y - 20);
  sceneCtx.lineTo(slot.x - 20, slot.y - 20);
  sceneCtx.closePath();
  sceneCtx.fill();
  sceneCtx.stroke();

  sceneCtx.fillStyle = "#e2e8f0";
  sceneCtx.fillRect(slot.x - 5, slot.y - 50, 10, 30);
  sceneCtx.fillStyle = "#94a3b8";
  sceneCtx.fillRect(slot.x - 30, slot.y - 50, 25, 15);
  sceneCtx.restore();
}

function drawGemFeature(slot) {
  sceneCtx.save();
  sceneCtx.fillStyle = "#f472b6";
  sceneCtx.strokeStyle = "#fbcfe8";
  sceneCtx.lineWidth = 3;
  sceneCtx.beginPath();
  sceneCtx.moveTo(slot.x, slot.y - FEATURE_SLOT_RADIUS / 2);
  sceneCtx.lineTo(slot.x + FEATURE_SLOT_RADIUS / 2, slot.y);
  sceneCtx.lineTo(slot.x, slot.y + FEATURE_SLOT_RADIUS / 2);
  sceneCtx.lineTo(slot.x - FEATURE_SLOT_RADIUS / 2, slot.y);
  sceneCtx.closePath();
  sceneCtx.fill();
  sceneCtx.stroke();
  sceneCtx.restore();
}

function drawPlaceholderFeature(slot) {
  sceneCtx.save();
  sceneCtx.fillStyle = "rgba(15, 23, 42, 0.4)";
  sceneCtx.beginPath();
  sceneCtx.arc(slot.x, slot.y, FEATURE_SLOT_RADIUS / 2, 0, Math.PI * 2);
  sceneCtx.fill();
  sceneCtx.restore();
}

function drawAdjacencyHint(node, direction, rect) {
  if (!node || !node.position || !island) return;
  const neighborId = getNeighborIdForDirection(node, direction);
  if (!neighborId) return;
  const neighbor = island.nodes[neighborId];
  if (!neighbor) return;
  const color = resolveNodeColor(neighbor);
  const pathThickness = 36;
  sceneCtx.save();
  sceneCtx.fillStyle = color;
  const hintDepth = 12;
  switch (direction) {
    case "north":
      sceneCtx.fillRect(rect.x, rect.y - hintDepth - 6, rect.width, hintDepth);
      break;
    case "south":
      sceneCtx.fillRect(rect.x, rect.y + rect.height + 6, rect.width, hintDepth);
      break;
    case "west":
      sceneCtx.fillRect(rect.x - hintDepth - 6, rect.y, hintDepth, rect.height);
      break;
    case "east":
      sceneCtx.fillRect(rect.x + rect.width + 6, rect.y, hintDepth, rect.height);
      break;
    default:
      break;
  }
  sceneCtx.restore();
}

function getNeighborIdForDirection(node, direction) {
  if (!node?.position) return null;
  const { x, y } = node.position;
  switch (direction) {
    case "north":
      return getNodeIdAtPosition(x, y - 1);
    case "south":
      return getNodeIdAtPosition(x, y + 1);
    case "west":
      return getNodeIdAtPosition(x - 1, y);
    case "east":
      return getNodeIdAtPosition(x + 1, y);
    default:
      return null;
  }
}

function getNodeIdAtPosition(targetX, targetY) {
  if (!island?.nodes) return null;
  return Object.values(island.nodes).find((node) => node.position?.x === targetX && node.position?.y === targetY)?.id || null;
}

function buildFeatureAnchors(features, width, height) {
  const anchors = new Map();
  features.forEach((feature) => {
    if (!feature?.actionId || !feature?.slot) return;
    const anchor = {
      x: feature.slot.x,
      y: feature.slot.y + FEATURE_SLOT_RADIUS + 28,
    };
    anchors.set(feature.actionId, clampAnchor(anchor, width, height));
  });
  return anchors;
}

function rectFromAnchor(anchor, rectWidth, rectHeight, canvasWidth, canvasHeight) {
  const x = clamp(anchor.x - rectWidth / 2, PROMPT_CARD_MARGIN, canvasWidth - rectWidth - PROMPT_CARD_MARGIN);
  const y = clamp(anchor.y - rectHeight / 2, PROMPT_CARD_MARGIN, canvasHeight - rectHeight - PROMPT_CARD_MARGIN);
  return { x, y, width: rectWidth, height: rectHeight };
}

function clampAnchor(anchor, canvasWidth, canvasHeight) {
  return {
    x: clamp(anchor.x, PROMPT_CARD_MARGIN, canvasWidth - PROMPT_CARD_MARGIN),
    y: clamp(anchor.y, PROMPT_CARD_MARGIN, canvasHeight - PROMPT_CARD_MARGIN),
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
function drawWinScreen(width, height) {
  const headingY = height / 2 - 40;
  sceneCtx.save();
  sceneCtx.fillStyle = "#e2e8f0";
  sceneCtx.font = "bold 56px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  sceneCtx.textAlign = "center";
  sceneCtx.textBaseline = "middle";
  sceneCtx.fillText("You win!", width / 2, headingY);
  sceneCtx.restore();

  const cardWidth = 280;
  const cardHeight = 56;
  const rect = {
    x: (width - cardWidth) / 2,
    y: headingY + 48,
    width: cardWidth,
    height: cardHeight,
  };
  drawPromptCard({ ...SUCCESS_ACTION, prompt: SUCCESS_ACTION.prompt }, rect);
}
