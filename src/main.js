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
const SCENE_FRAME_COLOR = "#030712";
const SCENE_FRAME_LINE_WIDTH = 6;
const PATH_THICKNESS = 44;

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
    <div class="status-card__title">Status</div>
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
  drawBiomePaths(node, movementEntries, width, height, biome);
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

function drawBiomeBase(biome, width, height) {
  if (!biome) {
    drawSceneFrame(width, height);
    return;
  }

  switch (biome.id) {
    case "dock":
      drawDockBiomeDetails(biome, width, height);
      break;
    case "beach":
      drawBeachBiomeDetails(biome, width, height);
      break;
    case "cave":
      drawCaveBiomeDetails(biome, width, height);
      break;
    default:
      break;
  }

  drawSceneFrame(width, height);
}

function drawSceneFrame(width, height) {
  sceneCtx.save();
  sceneCtx.strokeStyle = SCENE_FRAME_COLOR;
  sceneCtx.lineWidth = SCENE_FRAME_LINE_WIDTH;
  drawRoundedRectPath(
    sceneCtx,
    SCENE_FRAME_LINE_WIDTH,
    SCENE_FRAME_LINE_WIDTH,
    width - SCENE_FRAME_LINE_WIDTH * 2,
    height - SCENE_FRAME_LINE_WIDTH * 2,
    24
  );
  sceneCtx.stroke();
  sceneCtx.restore();
}

function drawDockBiomeDetails(biome, width, height) {
  sceneCtx.save();
  const pierHeight = Math.min(height * 0.28, 180);
  const pierTop = height - pierHeight;
  sceneCtx.fillStyle = biome.edgeColor || "rgba(15, 23, 42, 0.45)";
  sceneCtx.fillRect(0, pierTop, width, pierHeight);

  sceneCtx.strokeStyle = biome.textureColor || "rgba(226, 232, 240, 0.25)";
  sceneCtx.lineWidth = 4;
  const plankCount = 4;
  const plankSpacing = pierHeight / plankCount;
  for (let i = 1; i < plankCount; i += 1) {
    const y = pierTop + i * plankSpacing;
    sceneCtx.beginPath();
    sceneCtx.moveTo(0, y);
    sceneCtx.lineTo(width, y);
    sceneCtx.stroke();
  }

  const postCount = 3;
  const postSpacing = width / (postCount + 1);
  sceneCtx.fillStyle = SCENE_FRAME_COLOR;
  sceneCtx.strokeStyle = SCENE_FRAME_COLOR;
  sceneCtx.lineWidth = 2;
  for (let i = 1; i <= postCount; i += 1) {
    const x = postSpacing * i;
    sceneCtx.beginPath();
    sceneCtx.rect(x - 12, pierTop - 46, 24, 46);
    sceneCtx.fill();
    sceneCtx.stroke();
  }

  const waveCount = 4;
  const waveSpacing = 36;
  sceneCtx.strokeStyle = biome.accentColor || "rgba(248, 250, 252, 0.4)";
  sceneCtx.lineWidth = 3;
  for (let i = 0; i < waveCount; i += 1) {
    const y = pierTop - 24 - i * waveSpacing;
    if (y < 40) break;
    sceneCtx.beginPath();
    sceneCtx.moveTo(0, y);
    const step = width / 4;
    for (let segment = 0; segment < 4; segment += 1) {
      const startX = segment * step;
      const cpX = startX + step / 2;
      const cpY = y + (segment % 2 === 0 ? 10 : -10);
      const endX = startX + step;
      sceneCtx.quadraticCurveTo(cpX, cpY, endX, y);
    }
    sceneCtx.stroke();
  }

  sceneCtx.restore();
}

function drawBeachBiomeDetails(biome, width, height) {
  sceneCtx.save();
  const seaHeight = Math.min(height * 0.28, 160);
  sceneCtx.fillStyle = biome.waveColor || "#38bdf8";
  sceneCtx.beginPath();
  sceneCtx.moveTo(0, 0);
  sceneCtx.lineTo(0, seaHeight);
  const waveSegments = 6;
  const segmentWidth = width / waveSegments;
  for (let i = 0; i < waveSegments; i += 1) {
    const startX = i * segmentWidth;
    const cpX = startX + segmentWidth / 2;
    const cpY = seaHeight + (i % 2 === 0 ? 18 : -18);
    const endX = startX + segmentWidth;
    sceneCtx.quadraticCurveTo(cpX, cpY, endX, seaHeight);
  }
  sceneCtx.lineTo(width, 0);
  sceneCtx.closePath();
  sceneCtx.fill();

  drawTextureDots({
    color: biome.textureColor || "rgba(146, 64, 14, 0.35)",
    width,
    height,
    startY: seaHeight + 30,
    endY: height - 30,
    stepX: 80,
    stepY: 60,
  });
  sceneCtx.restore();
}

function drawCaveBiomeDetails(biome, width, height) {
  sceneCtx.save();
  const ceilingBase = Math.min(height * 0.28, 170);
  sceneCtx.fillStyle = biome.edgeColor || "#475569";
  sceneCtx.beginPath();
  sceneCtx.moveTo(0, ceilingBase);
  const segments = 5;
  const segWidth = width / segments;
  for (let i = 0; i <= segments; i += 1) {
    const x = i * segWidth;
    const offset = i % 2 === 0 ? -26 : 26;
    sceneCtx.lineTo(x, ceilingBase + offset);
  }
  sceneCtx.lineTo(width, 0);
  sceneCtx.lineTo(0, 0);
  sceneCtx.closePath();
  sceneCtx.fill();

  const floorTop = height - Math.min(height * 0.2, 120);
  sceneCtx.beginPath();
  sceneCtx.moveTo(0, height);
  sceneCtx.lineTo(0, floorTop);
  for (let i = 0; i <= segments; i += 1) {
    const x = i * segWidth;
    const offset = i % 2 === 0 ? 20 : -20;
    sceneCtx.lineTo(x, floorTop + offset);
  }
  sceneCtx.lineTo(width, height);
  sceneCtx.closePath();
  sceneCtx.fill();

  drawStalagmites({
    color: biome.accentColor || "#1f2937",
    width,
    baseY: floorTop,
    height: 60,
    count: 4,
  });
  sceneCtx.restore();
}

function drawTextureDots({ color, width, height, startY, endY, stepX, stepY }) {
  sceneCtx.save();
  sceneCtx.fillStyle = color;
  const safeStartY = Math.max(startY, 40);
  const safeEndY = Math.min(endY, height - 40);
  for (let y = safeStartY; y < safeEndY; y += stepY) {
    const stagger = (y / stepY) % 2 === 0 ? 0 : stepX / 2;
    for (let x = 40 + stagger; x < width - 40; x += stepX) {
      sceneCtx.beginPath();
      sceneCtx.arc(x, y, 3, 0, Math.PI * 2);
      sceneCtx.fill();
    }
  }
  sceneCtx.restore();
}

function drawStalagmites({ color, width, baseY, height, count }) {
  sceneCtx.save();
  const spacing = width / (count + 1);
  sceneCtx.fillStyle = color;
  sceneCtx.strokeStyle = SCENE_FRAME_COLOR;
  sceneCtx.lineWidth = 2;
  for (let i = 1; i <= count; i += 1) {
    const x = spacing * i;
    sceneCtx.beginPath();
    sceneCtx.moveTo(x - 18, baseY);
    sceneCtx.lineTo(x, baseY - height);
    sceneCtx.lineTo(x + 18, baseY);
    sceneCtx.closePath();
    sceneCtx.fill();
    sceneCtx.stroke();
  }
  sceneCtx.restore();
}

function drawBiomePaths(node, movementEntries, width, height, biome) {
  if (!node || movementEntries.length === 0) return;
  const centerX = width / 2;
  const centerY = height / 2;
  const pathThickness = Math.min(PATH_THICKNESS, width * 0.08);
  const fillColor = biome?.pathColor || "rgba(15, 23, 42, 0.35)";
  const outlineColor = biome?.pathOutline || "rgba(15, 23, 42, 0.55)";
  movementEntries.forEach(({ direction }) => {
    const rect = getPathRect(direction, width, height, centerX, centerY, pathThickness);
    if (!rect) return;
    sceneCtx.save();
    sceneCtx.fillStyle = fillColor;
    sceneCtx.strokeStyle = outlineColor;
    sceneCtx.lineWidth = 3;
    drawRoundedRectPath(sceneCtx, rect.x, rect.y, rect.width, rect.height, 24);
    sceneCtx.fill();
    sceneCtx.stroke();
    sceneCtx.restore();
  });
}

function getPathRect(direction, width, height, centerX, centerY, thickness) {
  const margin = 36;
  switch (direction) {
    case "north": {
      const y = MOVEMENT_PROMPT_HEIGHT + margin;
      const rectHeight = Math.max(18, centerY - y);
      return { x: centerX - thickness / 2, y, width: thickness, height: rectHeight };
    }
    case "south": {
      const startY = centerY;
      const rectHeight = Math.max(18, height - startY - MOVEMENT_PROMPT_HEIGHT - margin);
      return { x: centerX - thickness / 2, y: startY, width: thickness, height: rectHeight };
    }
    case "west": {
      const x = MOVEMENT_PROMPT_WIDTH + margin;
      const rectWidth = Math.max(18, centerX - x);
      return { x, y: centerY - thickness / 2, width: rectWidth, height: thickness };
    }
    case "east": {
      const startX = centerX;
      const rectWidth = Math.max(18, width - startX - MOVEMENT_PROMPT_WIDTH - margin);
      return { x: startX, y: centerY - thickness / 2, width: rectWidth, height: thickness };
    }
    default:
      return null;
  }
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
  const hintRect = getAdjacencyHintRect(direction, rect);
  if (!hintRect) return;
  sceneCtx.save();
  sceneCtx.fillStyle = color;
  sceneCtx.strokeStyle = SCENE_FRAME_COLOR;
  sceneCtx.lineWidth = 2;
  drawRoundedRectPath(sceneCtx, hintRect.x, hintRect.y, hintRect.width, hintRect.height, 8);
  sceneCtx.fill();
  sceneCtx.stroke();
  sceneCtx.restore();
}

function getAdjacencyHintRect(direction, rect) {
  const pad = 12;
  const shortSide = 14;
  switch (direction) {
    case "north": {
      const width = Math.min(rect.width - pad, 70);
      return {
        x: rect.x + (rect.width - width) / 2,
        y: rect.y - shortSide - 10,
        width,
        height: shortSide,
      };
    }
    case "south": {
      const width = Math.min(rect.width - pad, 70);
      return {
        x: rect.x + (rect.width - width) / 2,
        y: rect.y + rect.height + 10,
        width,
        height: shortSide,
      };
    }
    case "west": {
      const height = Math.min(rect.height - pad, 60);
      return {
        x: rect.x - shortSide - 10,
        y: rect.y + (rect.height - height) / 2,
        width: shortSide,
        height,
      };
    }
    case "east": {
      const height = Math.min(rect.height - pad, 60);
      return {
        x: rect.x + rect.width + 10,
        y: rect.y + (rect.height - height) / 2,
        width: shortSide,
        height,
      };
    }
    default:
      return null;
  }
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
