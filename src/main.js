import { TypingEngine } from "./typing-engine.js";
import { generateIsland } from "./island.generator.js";
import {
  applyAction,
  countCompletedNodes,
  createInitialState,
  getCurrentNode,
  getVisibleActions,
  isNodeCompleted,
} from "./island-engine.js";
import { createPromptService } from "./prompt-service.js";
import { getBiomeById, resolveNodeColor } from "./biomes.js";
import { normalizeFeatureEntry } from "./features.js";
import { drawExplorer, drawExplorerIcon } from "./explorer.js";

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
const MAP_BACKGROUND = "#020617";
const MAP_GRID_COLOR = "#0f172a";
const MAP_PLAYER_COLOR = "#f8fafc";

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

function renderProgress() {
  const visited = state.visitedNodes.size;
  const completed = countCompletedNodes(island, state);
  elements.progress.innerHTML = `
    <div>Gems: ${state.gemsCollected} / ${island.requiredGems}</div>
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
        .map((feature) => {
          const normalized = normalizeFeatureEntry(feature);
          if (!normalized) return null;
          const isComplete = state?.completedFeatures?.has(feature.id) ?? false;
          return { ...normalized, isComplete };
        })
        .filter((feature) => feature && shouldRenderFeature(feature))
    : [];
  lastFeatureLayout = placeFeatures(normalizedFeatures, width, height);
  lastFeatureAnchors = buildFeatureAnchors(lastFeatureLayout, width, height);

  const biome = getBiomeById(node?.biome);
  drawBiomeBase(node, movementEntries, biome, width, height);
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
  const text = `Gems ${state.gemsCollected} / ${island.requiredGems}`;
  mapCtx.save();
  mapCtx.fillStyle = LABEL_COLOR;
  mapCtx.font = "600 14px 'Fira Mono', 'SFMono-Regular', Menlo, Monaco, Consolas, monospace";
  mapCtx.textAlign = "left";
  mapCtx.textBaseline = "top";
  mapCtx.fillText(text, 12, 10);
  mapCtx.restore();
}

function shouldRenderFeature(feature) {
  if (!feature) return false;
  if (feature.type === "gem") {
    return !feature.isComplete;
  }
  return true;
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

function drawBiomeBase(node, movementEntries, biome, width, height) {
  if (!biome) {
    drawSceneFrame(width, height);
    return;
  }

  switch (biome.id) {
    case "dock":
      drawDockBiomeDetails(biome, width, height);
      break;
    case "sand":
      drawSandBiomeDetails(node, biome, width, height);
      break;
    case "rock":
      drawRockBiomeDetails(biome, width, height);
      break;
    case "forest":
      drawForestBiomeDetails(biome, width, height);
      break;
    case "plains":
      drawPlainsBiomeDetails(biome, width, height);
      break;
    case "farm":
      drawFarmBiomeDetails(biome, width, height);
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
  const waterHeight = Math.max(height * 0.45, 200);
  const shoreHeight = height - waterHeight;
  const pierWidth = Math.max(width * 0.28, 150);
  const pierHeight = Math.max(waterHeight * 0.75, 200);

  drawDockShore(biome, width, shoreHeight);
  drawDockWater(biome, width, waterHeight, shoreHeight);
  drawDockPier(biome, width, shoreHeight, pierWidth, pierHeight);
  drawDockBoat(biome, width, waterHeight, shoreHeight);

  sceneCtx.restore();
}

function drawDockShore(biome, width, shoreHeight) {
  const sandColor = "#f4d09c";
  const grassColor = "#a7c957";
  sceneCtx.fillStyle = grassColor;
  sceneCtx.fillRect(0, 0, width, shoreHeight);
  sceneCtx.fillStyle = sandColor;
  sceneCtx.fillRect(0, shoreHeight * 0.4, width, shoreHeight * 0.6);
  drawTextureDots({
    color: "rgba(107, 83, 43, 0.4)",
    width,
    height: shoreHeight,
    startY: shoreHeight * 0.1,
    endY: shoreHeight * 0.9,
    stepX: 90,
    stepY: 50,
  });
}

function drawDockWater(biome, width, waterHeight, shoreHeight) {
  const gradient = sceneCtx.createLinearGradient(0, shoreHeight, 0, shoreHeight + waterHeight);
  gradient.addColorStop(0, "#071633");
  gradient.addColorStop(1, biome.edgeColor || "#1d4ed8");
  sceneCtx.fillStyle = gradient;
  sceneCtx.fillRect(0, shoreHeight, width, waterHeight);

  const waveCount = 5;
  const spacing = waterHeight / (waveCount + 1);
  sceneCtx.strokeStyle = biome.accentColor || "rgba(219, 234, 254, 0.5)";
  sceneCtx.lineWidth = 3;
  for (let i = 1; i <= waveCount; i += 1) {
    const y = shoreHeight + i * spacing;
    const step = width / 4;
    sceneCtx.beginPath();
    sceneCtx.moveTo(0, y);
    for (let segment = 0; segment < 4; segment += 1) {
      const startX = segment * step;
      const cpX = startX + step / 2;
      const cpY = y + (segment % 2 === 0 ? 12 : -12);
      const endX = startX + step;
      sceneCtx.quadraticCurveTo(cpX, cpY, endX, y);
    }
    sceneCtx.stroke();
  }
}

function drawDockBoat(biome, width, waterHeight, shoreHeight) {
  const boatWidth = Math.max(140, width * 0.16);
  const boatHeight = Math.max(70, waterHeight * 0.18);
  const boatX = width * 0.75;
  const boatY = shoreHeight + waterHeight * 0.35;
  sceneCtx.save();
  sceneCtx.translate(boatX, boatY);
  sceneCtx.rotate(-0.1);
  sceneCtx.fillStyle = "#1e293b";
  sceneCtx.strokeStyle = "#0f172a";
  sceneCtx.lineWidth = 3;
  sceneCtx.beginPath();
  sceneCtx.moveTo(-boatWidth / 2, boatHeight / 2);
  sceneCtx.lineTo(boatWidth / 2, boatHeight / 2);
  sceneCtx.quadraticCurveTo(boatWidth / 2 + 30, 0, boatWidth / 2, -boatHeight / 2);
  sceneCtx.lineTo(-boatWidth / 2, -boatHeight / 2);
  sceneCtx.quadraticCurveTo(-boatWidth / 2 - 30, 0, -boatWidth / 2, boatHeight / 2);
  sceneCtx.closePath();
  sceneCtx.fill();
  sceneCtx.stroke();

  sceneCtx.fillStyle = "#f8fafc";
  sceneCtx.fillRect(-6, -boatHeight / 2 - 20, 12, 30);
  sceneCtx.fillStyle = "#cbd5f5";
  sceneCtx.beginPath();
  sceneCtx.moveTo(0, -boatHeight / 2 - 20);
  sceneCtx.lineTo(boatWidth * 0.2, 0);
  sceneCtx.lineTo(0, boatHeight * 0.05);
  sceneCtx.closePath();
  sceneCtx.fill();
  sceneCtx.restore();
}

function drawDockPier(biome, width, shoreHeight, pierWidth, pierHeight) {
  const pierTop = shoreHeight;
  const pierBottom = shoreHeight + pierHeight;
  const pierCenter = width / 2;
  sceneCtx.save();

  // shadow
  sceneCtx.fillStyle = "rgba(15, 23, 42, 0.35)";
  sceneCtx.beginPath();
  sceneCtx.moveTo(pierCenter - pierWidth / 2 - 10, pierBottom);
  sceneCtx.lineTo(pierCenter + pierWidth / 2 + 10, pierBottom);
  sceneCtx.lineTo(pierCenter + pierWidth / 2, pierTop + 20);
  sceneCtx.lineTo(pierCenter - pierWidth / 2, pierTop + 20);
  sceneCtx.closePath();
  sceneCtx.fill();

  // planks
  sceneCtx.fillStyle = "#8d6b4a";
  sceneCtx.strokeStyle = "#4b341f";
  sceneCtx.lineWidth = 3;
  sceneCtx.beginPath();
  sceneCtx.moveTo(pierCenter - pierWidth / 2, pierBottom);
  sceneCtx.lineTo(pierCenter + pierWidth / 2, pierBottom);
  sceneCtx.lineTo(pierCenter + pierWidth * 0.35, pierTop);
  sceneCtx.lineTo(pierCenter - pierWidth * 0.35, pierTop);
  sceneCtx.closePath();
  sceneCtx.fill();
  sceneCtx.stroke();

  const plankSpacing = 36;
  for (let y = pierBottom - plankSpacing; y > pierTop; y -= plankSpacing) {
    const progress = (pierBottom - y) / pierHeight;
    const widthAtY = pierWidth * (1 - 0.3 * progress);
    sceneCtx.beginPath();
    sceneCtx.moveTo(pierCenter - widthAtY / 2, y);
    sceneCtx.lineTo(pierCenter + widthAtY / 2, y);
    sceneCtx.stroke();
  }

  // posts
  sceneCtx.fillStyle = "#3f2c1c";
  const postCount = 4;
  for (let i = 0; i < postCount; i += 1) {
    const t = i / (postCount - 1);
    const topWidth = pierWidth * 0.35;
    const widthAtT = topWidth + (pierWidth - topWidth) * t;
    const xLeft = pierCenter - widthAtT / 2 - 12;
    const xRight = pierCenter + widthAtT / 2 + 12;
    const y = pierTop + pierHeight * t;
    sceneCtx.fillRect(xLeft, y - 60, 18, 60);
    sceneCtx.fillRect(xRight - 18, y - 60, 18, 60);
  }

  sceneCtx.restore();
}

function drawSandBiomeDetails(node, biome, width, height) {
  sceneCtx.save();
  const waterColor = biome.waterColor || "#44b4e2";
  sceneCtx.fillStyle = waterColor;
  sceneCtx.fillRect(0, 0, width, height);

  const sandRect = calculateSandRect(node, width, height);
  const gradient = sceneCtx.createLinearGradient(0, sandRect.y, 0, sandRect.y + sandRect.height);
  gradient.addColorStop(0, biome.sandLight || "#fef3c7");
  gradient.addColorStop(1, biome.sandShadow || "#eab676");
  sceneCtx.fillStyle = gradient;
  sceneCtx.fillRect(sandRect.x, sandRect.y, sandRect.width, sandRect.height);

  sceneCtx.save();
  sceneCtx.beginPath();
  sceneCtx.rect(sandRect.x, sandRect.y, sandRect.width, sandRect.height);
  sceneCtx.clip();
  drawSandDunes(biome, width, height);
  sceneCtx.restore();

  drawSandWaterFoam(node, biome, sandRect, width, height);

  sceneCtx.restore();
}

function drawRockBiomeDetails(biome, width, height) {
  sceneCtx.save();
  const baseGradient = sceneCtx.createLinearGradient(0, 0, 0, height);
  baseGradient.addColorStop(0, biome.rockLight || "#cbd5f5");
  baseGradient.addColorStop(1, biome.rockDark || "#4b5563");
  sceneCtx.fillStyle = baseGradient;
  sceneCtx.fillRect(0, 0, width, height);

  drawRockPlates(biome, width, height);
  drawRockBoulders(biome, width, height);
  drawRockCracks(biome, width, height);

  sceneCtx.restore();
}

function drawForestBiomeDetails(biome, width, height) {
  sceneCtx.save();
  const gradient = sceneCtx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, biome.canopyDark || "#1f6f3c");
  gradient.addColorStop(0.5, biome.canopyLight || "#3a9b59");
  gradient.addColorStop(1, biome.groundColor || "#0d2f20");
  sceneCtx.fillStyle = gradient;
  sceneCtx.fillRect(0, 0, width, height);

  drawForestMist(width, height);
  drawForestTrees(biome, width, height);
  sceneCtx.restore();
}

function drawPlainsBiomeDetails(biome, width, height) {
  sceneCtx.save();
  const gradient = sceneCtx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, biome.grassLight || "#b9e08b");
  gradient.addColorStop(1, biome.grassShadow || "#7ea75c");
  sceneCtx.fillStyle = gradient;
  sceneCtx.fillRect(0, 0, width, height);

  drawPlainsPatches(biome, width, height);
  drawPlainsBrush(biome, width, height);
  sceneCtx.restore();
}

function drawFarmBiomeDetails(biome, width, height) {
  sceneCtx.save();
  sceneCtx.fillStyle = biome.soilDark || "#8a5a2c";
  sceneCtx.fillRect(0, 0, width, height);
  drawFarmFields(biome, width, height);
  sceneCtx.restore();
}

function drawSandDunes(biome, width, height) {
  const duneColor = biome.duneAccent || "#fca311";
  const duneCount = 3;
  const baseY = height * 0.58;
  sceneCtx.save();
  for (let i = 0; i < duneCount; i += 1) {
    const offset = i % 2 === 0 ? 0 : 30;
    const startX = (width / duneCount) * i - width * 0.2;
    const duneWidth = width * 0.65;
    sceneCtx.globalAlpha = 0.18 + i * 0.12;
    sceneCtx.fillStyle = duneColor;
    sceneCtx.beginPath();
    sceneCtx.moveTo(startX, baseY + offset);
    sceneCtx.quadraticCurveTo(startX + duneWidth / 2, baseY - 50 - offset, startX + duneWidth, baseY + offset);
    sceneCtx.lineTo(startX + duneWidth, height);
    sceneCtx.lineTo(startX, height);
    sceneCtx.closePath();
    sceneCtx.fill();
  }
  sceneCtx.restore();

  drawTextureDots({
    color: "rgba(146, 64, 14, 0.25)",
    width,
    height,
    startY: height * 0.35,
    endY: height - 40,
    stepX: 70,
    stepY: 55,
  });
}

function drawSandWaterFoam(node, biome, sandRect, width, height) {
  if (!node) return;
  const directions = ["north", "south", "east", "west"];
  directions.forEach((direction) => {
    if (hasNeighborInDirection(node, direction)) return;
    drawShoreFoam(direction, biome, sandRect, width, height);
  });
}

function drawShoreFoam(direction, biome, sandRect, width, height) {
  const foamColor = biome.foamColor || "#fef3c7";
  const segments = 6;
  const amplitude = 16;
  sceneCtx.save();
  sceneCtx.strokeStyle = foamColor;
  sceneCtx.lineWidth = 3;

  switch (direction) {
    case "north": {
      const y = sandRect.y;
      const segmentWidth = sandRect.width / segments;
      sceneCtx.beginPath();
      for (let i = 0; i < segments; i += 1) {
        const startX = sandRect.x + i * segmentWidth;
        const cpX = startX + segmentWidth / 2;
        const cpY = y - (i % 2 === 0 ? amplitude : -amplitude);
        const endX = startX + segmentWidth;
        if (i === 0) sceneCtx.moveTo(startX, y);
        sceneCtx.quadraticCurveTo(cpX, cpY, endX, y);
      }
      sceneCtx.stroke();
      break;
    }
    case "south": {
      const y = sandRect.y + sandRect.height;
      const segmentWidth = sandRect.width / segments;
      sceneCtx.beginPath();
      for (let i = 0; i < segments; i += 1) {
        const startX = sandRect.x + i * segmentWidth;
        const cpX = startX + segmentWidth / 2;
        const cpY = y + (i % 2 === 0 ? amplitude : -amplitude);
        const endX = startX + segmentWidth;
        if (i === 0) sceneCtx.moveTo(startX, y);
        sceneCtx.quadraticCurveTo(cpX, cpY, endX, y);
      }
      sceneCtx.stroke();
      break;
    }
    case "west": {
      const x = sandRect.x;
      const segmentHeight = sandRect.height / segments;
      sceneCtx.beginPath();
      for (let i = 0; i < segments; i += 1) {
        const startY = sandRect.y + i * segmentHeight;
        const cpY = startY + segmentHeight / 2;
        const cpX = x - (i % 2 === 0 ? amplitude : -amplitude);
        const endY = startY + segmentHeight;
        if (i === 0) sceneCtx.moveTo(x, startY);
        sceneCtx.quadraticCurveTo(cpX, cpY, x, endY);
      }
      sceneCtx.stroke();
      break;
    }
    case "east": {
      const x = sandRect.x + sandRect.width;
      const segmentHeight = sandRect.height / segments;
      sceneCtx.beginPath();
      for (let i = 0; i < segments; i += 1) {
        const startY = sandRect.y + i * segmentHeight;
        const cpY = startY + segmentHeight / 2;
        const cpX = x + (i % 2 === 0 ? amplitude : -amplitude);
        const endY = startY + segmentHeight;
        if (i === 0) sceneCtx.moveTo(x, startY);
        sceneCtx.quadraticCurveTo(cpX, cpY, x, endY);
      }
      sceneCtx.stroke();
      break;
    }
    default:
      break;
  }

  sceneCtx.restore();
}

function calculateSandRect(node, width, height) {
  const shoreMargin = Math.min(width, height) * 0.18;
  const padding = 12;
  const hasNeighbor = (direction) => (node ? hasNeighborInDirection(node, direction) : false);
  const north = hasNeighbor("north") ? padding : shoreMargin;
  const south = hasNeighbor("south") ? padding : shoreMargin;
  const west = hasNeighbor("west") ? padding : shoreMargin;
  const east = hasNeighbor("east") ? padding : shoreMargin;
  return {
    x: west,
    y: north,
    width: Math.max(40, width - west - east),
    height: Math.max(40, height - north - south),
  };
}

function drawRockPlates(biome, width, height) {
  const plateColor = biome.ridgeAccent || "rgba(71, 85, 105, 0.4)";
  const spacing = Math.max(70, Math.min(width, height) * 0.22);
  sceneCtx.save();
  sceneCtx.fillStyle = plateColor;
  for (let layer = -2; layer <= 2; layer += 1) {
    const offset = layer * spacing + spacing * 0.5;
    const skew = layer % 2 === 0 ? width * 0.12 : width * 0.04;
    sceneCtx.beginPath();
    sceneCtx.moveTo(-skew, offset);
    sceneCtx.lineTo(width + skew, offset + spacing * 0.35);
    sceneCtx.lineTo(width + skew, offset + spacing * 0.35 + 18);
    sceneCtx.lineTo(-skew, offset + 18);
    sceneCtx.closePath();
    sceneCtx.globalAlpha = 0.15 + (layer + 2) * 0.05;
    sceneCtx.fill();
  }
  sceneCtx.restore();
}

function drawRockBoulders(biome, width, height) {
  const colors = [
    biome.rockDark || "#4b5563",
    biome.ridgeAccent || "#475569",
    "rgba(15, 23, 42, 0.45)",
  ];
  const placements = [
    { u: 0.2, v: 0.35, scale: 1.1 },
    { u: 0.45, v: 0.28, scale: 0.9 },
    { u: 0.65, v: 0.4, scale: 1.3 },
    { u: 0.35, v: 0.55, scale: 0.8 },
    { u: 0.7, v: 0.62, scale: 1.0 },
    { u: 0.15, v: 0.6, scale: 0.7 },
  ];
  sceneCtx.save();
  placements.forEach((placement, index) => {
    const baseRadius = Math.max(18, width * 0.04);
    const noise = pseudoRandom(index + 1);
    const radius = baseRadius * placement.scale * (0.85 + noise * 0.35);
    const x = width * placement.u + (noise - 0.5) * 40;
    const y = height * placement.v + (pseudoRandom(index + 10) - 0.5) * 30;
    const rotation = pseudoRandom(index + 20) * Math.PI * 0.4;
    sceneCtx.beginPath();
    sceneCtx.ellipse(x, y, radius, radius * (0.6 + noise * 0.2), rotation, 0, Math.PI * 2);
    sceneCtx.fillStyle = colors[index % colors.length];
    sceneCtx.fill();
  });
  sceneCtx.restore();
}

function drawRockCracks(biome, width, height) {
  sceneCtx.save();
  sceneCtx.strokeStyle = "rgba(15, 23, 42, 0.35)";
  sceneCtx.lineWidth = 2;
  for (let i = 0; i < 3; i += 1) {
    const startX = width * (0.2 + i * 0.25);
    const startY = height * 0.2;
    sceneCtx.beginPath();
    sceneCtx.moveTo(startX, startY);
    let currentX = startX;
    let currentY = startY;
    for (let segment = 0; segment < 4; segment += 1) {
      currentX += (segment % 2 === 0 ? 30 : -24);
      currentY += height * 0.15;
      const controlX = currentX + (segment % 2 === 0 ? 12 : -12);
      const controlY = currentY - 18;
      sceneCtx.quadraticCurveTo(controlX, controlY, currentX, currentY);
    }
    sceneCtx.stroke();
  }
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

function drawForestMist(width, height) {
  sceneCtx.save();
  sceneCtx.fillStyle = "rgba(255, 255, 255, 0.05)";
  const bandHeight = height * 0.2;
  for (let i = 0; i < 3; i += 1) {
    const y = bandHeight * i + bandHeight / 2;
    sceneCtx.beginPath();
    sceneCtx.ellipse(width / 2, y, width * 0.7, bandHeight * 0.6, 0, 0, Math.PI * 2);
    sceneCtx.fill();
  }
  sceneCtx.restore();
}

function drawForestTrees(biome, width, height) {
  const rows = [
    { depth: 0.45, count: 4, scale: 0.9 },
    { depth: 0.62, count: 6, scale: 1 },
    { depth: 0.78, count: 7, scale: 1.2 },
  ];
  const trunkColor = biome.trunkColor || "#5b3716";
  const canopyLight = biome.canopyLight || "#3a9b59";
  const canopyDark = biome.canopyDark || "#1f6f3c";
  rows.forEach((row, rowIndex) => {
    const y = height * row.depth;
    for (let i = 0; i < row.count; i += 1) {
      const t = (i + 0.5) / row.count;
      const noise = pseudoRandom(rowIndex * 10 + i) - 0.5;
      const x = width * t + noise * 60;
      const trunkHeight = 30 * row.scale;
      const canopyRadius = 28 * row.scale;
      sceneCtx.save();
      sceneCtx.fillStyle = trunkColor;
      sceneCtx.fillRect(x - 5, y, 10, trunkHeight);
      const gradient = sceneCtx.createRadialGradient(x, y, canopyRadius * 0.3, x, y, canopyRadius);
      gradient.addColorStop(0, canopyLight);
      gradient.addColorStop(1, canopyDark);
      sceneCtx.fillStyle = gradient;
      sceneCtx.beginPath();
      sceneCtx.ellipse(x, y, canopyRadius * 1.2, canopyRadius, 0, 0, Math.PI * 2);
      sceneCtx.fill();
      sceneCtx.restore();
    }
  });
}

function drawPlainsPatches(biome, width, height) {
  const patchCount = 4;
  const colors = [biome.bloomColor || "#fcd34d", "rgba(255, 255, 255, 0.25)"];
  for (let i = 0; i < patchCount; i += 1) {
    const noise = pseudoRandom(200 + i);
    const x = width * ((i + 1) / (patchCount + 1)) + (noise - 0.5) * 60;
    const y = height * (0.4 + 0.2 * noise);
    const rx = width * 0.18;
    const ry = height * 0.08;
    sceneCtx.save();
    sceneCtx.translate(x, y);
    sceneCtx.rotate((noise - 0.5) * 0.4);
    sceneCtx.fillStyle = colors[i % colors.length];
    sceneCtx.globalAlpha = 0.2;
    sceneCtx.beginPath();
    sceneCtx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    sceneCtx.fill();
    sceneCtx.restore();
  }
}

function drawPlainsBrush(biome, width, height) {
  const strokeCount = 18;
  sceneCtx.save();
  sceneCtx.lineWidth = 6;
  for (let i = 0; i < strokeCount; i += 1) {
    const noise = pseudoRandom(300 + i);
    const x = width * noise;
    const y = height * (0.35 + 0.5 * pseudoRandom(320 + i));
    const length = 30 + 20 * pseudoRandom(340 + i);
    const angle = -Math.PI / 2 + (noise - 0.5) * 0.6;
    sceneCtx.strokeStyle = i % 2 === 0 ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.12)";
    sceneCtx.beginPath();
    sceneCtx.moveTo(x, y);
    sceneCtx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    sceneCtx.stroke();
  }
  sceneCtx.restore();
}

function drawFarmFields(biome, width, height) {
  const rowCount = 5;
  const colors = [biome.cropGreen || "#7cb342", biome.cropYellow || "#f5ca3a", biome.soilLight || "#c07d3a"];
  const rowHeight = height / rowCount;
  for (let i = 0; i < rowCount; i += 1) {
    const y = i * rowHeight;
    sceneCtx.fillStyle = colors[i % colors.length];
    sceneCtx.beginPath();
    sceneCtx.moveTo(-40, y);
    sceneCtx.lineTo(width + 40, y + rowHeight * 0.2);
    sceneCtx.lineTo(width + 40, y + rowHeight);
    sceneCtx.lineTo(-40, y + rowHeight * 0.8);
    sceneCtx.closePath();
    sceneCtx.fill();
    sceneCtx.strokeStyle = "rgba(0,0,0,0.1)";
    sceneCtx.lineWidth = 2;
    sceneCtx.stroke();
  }
  // divider lines
  sceneCtx.save();
  sceneCtx.strokeStyle = "rgba(15, 23, 42, 0.2)";
  sceneCtx.lineWidth = 3;
  const columnCount = 4;
  for (let col = 0; col <= columnCount; col += 1) {
    const x = (width / columnCount) * col;
    sceneCtx.beginPath();
    sceneCtx.moveTo(x, 0);
    sceneCtx.lineTo(x - 30, height);
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
    if (!shouldRenderFeature(feature)) {
      return;
    }
    let slot = null;
    if (feature.type === "ship") {
      slot = {
        id: "ship-dock",
        x: width * 0.35,
        y: Math.min(height - 80, height * 0.6),
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

function hasNeighborInDirection(node, direction) {
  const neighborId = getNeighborIdForDirection(node, direction);
  return Boolean(neighborId);
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

function pseudoRandom(seed) {
  const x = Math.sin(seed * 43758.5453);
  return x - Math.floor(x);
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
  island = generateIsland();
  state = createInitialState(island);
  promptService.reset();
  clearActivation();
  clearToast();
  render();
}

function boot() {
  island = generateIsland();
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
function drawWinScreen(width, height) {
  sceneCtx.save();
  sceneCtx.fillStyle = "rgba(248, 250, 252, 0.95)";
  sceneCtx.fillRect(0, 0, width, height);
  sceneCtx.restore();

  const headingY = Math.max(80, height * 0.25);
  sceneCtx.save();
  sceneCtx.fillStyle = "#0f172a";
  sceneCtx.font = "bold 56px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  sceneCtx.textAlign = "center";
  sceneCtx.textBaseline = "middle";
  sceneCtx.fillText("You win!", width / 2, headingY);
  sceneCtx.restore();

  const scale = clamp(Math.min(width, height) / 520, 0.7, 1.25);
  const explorerBaseline = height * 0.65;
  drawExplorer(sceneCtx, width / 2, explorerBaseline, scale);
  const cardBase = Math.max(headingY + 60, explorerBaseline + 90);

  const cardWidth = 280;
  const cardHeight = 56;
  const rect = {
    x: (width - cardWidth) / 2,
    y: Math.min(height - cardHeight - 40, cardBase),
    width: cardWidth,
    height: cardHeight,
  };
  drawPromptCard({ ...SUCCESS_ACTION, prompt: SUCCESS_ACTION.prompt }, rect);
}
