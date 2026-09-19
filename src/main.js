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
import {
  DIRECTION_VECTORS,
  clearSceneCache,
  getMovementDirection,
  renderSceneToCanvas,
} from "./scene-renderer.js";
import {
  INK,
  INK_LIGHT,
  PAPER,
  PAPER_DEEP,
  READY,
  alpha,
  clamp,
  easeInOut,
  inkLine,
  inkRect,
  inkText,
} from "./ink.js";

const SUCCESS_ACTION = Object.freeze({
  id: "new-island",
  kind: "reset",
  label: "New island",
  prompt: "new",
});

const MAP_OCEAN = "#bfe0ea";
const TRANSITION_SECONDS = 0.34;

const elements = {
  buffer: document.querySelector("[data-buffer]"),
  typing: document.querySelector("[data-typing]"),
  message: document.querySelector("[data-message]"),
  scene: document.querySelector("[data-scene]"),
  toast: document.querySelector("[data-toast]"),
  title: document.querySelector("[data-node-title]"),
  progress: document.querySelector("[data-progress]"),
  inventory: document.querySelector("[data-inventory]"),
  gemLabel: document.querySelector("[data-gem-label]"),
  gemFill: document.querySelector("[data-gem-fill]"),
  map: document.querySelector("[data-map]"),
};

let engine = null;
let island = null;
let state = null;
const promptService = createPromptService();

let lastSceneNode = null;
let lastSceneActions = [];
let lastFeatureLayout = [];
let highlightedActionId = null;
let typedBuffer = "";
let facing = 1;

// Animation. `time` is seconds since boot and drives every moving thing in the
// renderer; freezing it is all that reduced-motion needs to do.
const reducedMotion =
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let time = 0;
let bootTimestamp = null;
let effects = [];
let transition = null;

// Offscreen canvases used to slide one scene out as the next slides in.
let workCanvas = null;
let previousCanvas = null;

// ============================================================================
// State-driven rendering (runs on action, not per frame)
// ============================================================================

function render() {
  const node = state.status === "success" ? null : getCurrentNode(island, state);
  const title = state.status === "success" ? "You did it!" : node?.title || "Unknown";
  elements.title.textContent = title;
  document.title = `Gem Island — ${title}`;

  renderProgress();
  renderMap();
  const actions = getRenderableActions(node);
  lastSceneNode = node;
  lastSceneActions = actions;
  if (engine) {
    engine.setActions(actions.filter((action) => !action.isCompleted));
  }
}

function formatCount(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function renderProgress() {
  const visited = state.visitedNodes.size;
  const completed = countCompletedNodes(island, state);
  const gems = getItemCount(state, "gem");
  const required = island.requiredGems || 1;

  elements.gemLabel.textContent = `Gems ${gems} / ${island.requiredGems}`;
  elements.gemFill.style.width = `${clamp((gems / required) * 100, 0, 100)}%`;
  elements.progress.textContent = `${formatCount(visited, "place")} explored · ${completed} finished`;

  const pockets = Object.entries(state.inventory ?? {})
    .filter(([item, count]) => item !== "gem" && Number.isFinite(count) && count > 0)
    .map(([item, count]) => `<span class="pocket">${formatCount(count, item)}</span>`);
  elements.inventory.innerHTML = pockets.length
    ? pockets.join("")
    : '<span class="pocket pocket--empty">nothing yet</span>';
}

function getRenderableActions(node) {
  if (state.status === "success") {
    return [{ ...SUCCESS_ACTION, isCompleted: false }];
  }
  const usedPrompts = new Set();
  return getVisibleActions(island, state, node).map((action) => {
    const prompt = promptService.getPrompt(action.id, usedPrompts);
    usedPrompts.add(prompt);
    return { ...action, prompt };
  });
}

// ============================================================================
// Canvas plumbing
// ============================================================================

function sizeCanvas(canvas, fallbackWidth, aspect) {
  if (!canvas) return null;
  const width = canvas.clientWidth || canvas.offsetWidth || fallbackWidth;
  const height = canvas.clientHeight || Math.round(width * aspect);
  const dpr = window.devicePixelRatio || 1;
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height, dpr };
}

function ensureOffscreen(name, width, height, dpr) {
  const existing = name === "work" ? workCanvas : previousCanvas;
  const canvas = existing || document.createElement("canvas");
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  if (name === "work") workCanvas = canvas;
  else previousCanvas = canvas;
  return canvas;
}

function paintScene(ctx, width, height) {
  const result = renderSceneToCanvas(ctx, width, height, {
    node: lastSceneNode,
    actions: lastSceneActions,
    state,
    island,
    highlightedActionId,
    successAction: SUCCESS_ACTION,
    isFeatureVisible: (feature) => isFeatureVisible(feature, state, island),
    typedBuffer,
    time,
    effects,
    facing,
  });
  lastFeatureLayout = result.featureLayout;
}

function drawFrame() {
  const sized = sizeCanvas(elements.scene, 720, 3 / 4);
  if (!sized) return;
  const { ctx, width, height, dpr } = sized;

  if (!transition) {
    paintScene(ctx, width, height);
    return;
  }

  const progress = clamp((time - transition.start) / TRANSITION_SECONDS, 0, 1);
  if (progress >= 1) {
    transition = null;
    paintScene(ctx, width, height);
    return;
  }

  const eased = easeInOut(progress);
  const work = ensureOffscreen("work", width, height, dpr);
  const workCtx = work.getContext("2d");
  workCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  workCtx.clearRect(0, 0, width, height);
  paintScene(workCtx, width, height);

  // The world scrolls against the direction of travel, the way it does when
  // you walk: head north and the land slides down past you while the new place
  // comes in over the top edge.
  const dx = transition.vector.x * width;
  const dy = transition.vector.y * height;

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  if (transition.previous) {
    ctx.drawImage(transition.previous, -dx * eased, -dy * eased, width, height);
  }
  ctx.drawImage(work, dx * (1 - eased), dy * (1 - eased), width, height);
  ctx.restore();
}

function loop(timestamp) {
  if (bootTimestamp === null) bootTimestamp = timestamp;
  time = reducedMotion ? 0 : (timestamp - bootTimestamp) / 1000;
  if (effects.length) {
    effects = effects.filter((effect) => time - effect.start < (effect.duration ?? 0.9));
  }
  drawFrame();
  window.requestAnimationFrame(loop);
}

// ============================================================================
// Map
// ============================================================================

function renderMap() {
  if (!island || !state) return;
  const nodes = Object.values(island.nodes || {}).filter((entry) => entry?.position);
  if (!nodes.length) return;
  const sized = sizeCanvas(elements.map, 260, 1);
  if (!sized) return;
  const { ctx, width, height } = sized;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = MAP_OCEAN;
  ctx.fillRect(0, 0, width, height);

  const xs = nodes.map((node) => node.position.x);
  const ys = nodes.map((node) => node.position.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const cols = Math.max(1, maxX - minX + 1);
  const rows = Math.max(1, maxY - minY + 1);
  const padding = 16;
  const cell = Math.max(14, Math.min((width - padding * 2) / cols, (height - padding * 2) / rows));
  const startX = (width - cell * cols) / 2;
  const startY = (height - cell * rows) / 2;

  // Only what the player has seen is drawn — the map is a record of the trip,
  // not a picture of the island (visual-v1, "Node states").
  nodes.forEach((node) => {
    if (!state.visitedNodes?.has(node.id)) return;
    const x = startX + (node.position.x - minX) * cell;
    const y = startY + (node.position.y - minY) * cell;
    inkRect(ctx, x + 1, y + 1, cell - 2, cell - 2, {
      fill: resolveNodeColor(node) || PAPER_DEEP,
      stroke: alpha(INK, 0.75),
      lw: 2,
      radius: Math.max(3, cell * 0.16),
      seed: (node.position.x + 1) * 31 + (node.position.y + 1) * 7,
      rough: 0.7,
    });
    if (isNodeCompleted(node, state)) {
      drawMapCheck(ctx, x + cell * 0.72, y + cell * 0.28, cell * 0.2);
    }
  });

  const current = island.nodes?.[state.currentNodeId];
  if (state.status !== "success" && current?.position) {
    const x = startX + (current.position.x - minX) * cell;
    const y = startY + (current.position.y - minY) * cell;
    drawExplorerIcon(ctx, x + cell / 2, y + cell / 2, clamp(cell / 96, 0.32, 0.62), {
      skin: "#f3d2b4",
      hairPink: "#ef8fb4",
      hairPurple: "#b78ad6",
      tieBlue: "#5bb0d6",
    });
  }

  drawCompass(ctx, width - 26, 26);
}

function drawMapCheck(ctx, x, y, size) {
  const stroke = Math.max(2.5, size * 0.55);
  const points = [
    { x: x - size, y },
    { x: x - size * 0.2, y: y + size * 0.8 },
    { x: x + size, y: y - size * 0.9 },
  ];
  // A paper halo under the tick, so it reads on the green tiles as clearly as
  // on the sandy ones — forest and plains are close enough to the tick colour
  // that it disappeared into them.
  inkLine(ctx, points, {
    stroke: PAPER,
    lw: stroke + Math.max(2, size * 0.45),
    seed: 12,
    rough: 0.4,
    smooth: false,
  });
  inkLine(ctx, points, { stroke: READY, lw: stroke, seed: 12, rough: 0.4, smooth: false });
}

function drawCompass(ctx, x, y) {
  inkText(ctx, "N", x, y - 8, { size: 13, weight: 800, color: INK_LIGHT });
  inkLine(
    ctx,
    [
      { x, y: y - 1 },
      { x, y: y + 10 },
    ],
    { stroke: INK_LIGHT, lw: 2, seed: 4, rough: 0.3 }
  );
  inkLine(
    ctx,
    [
      { x: x - 4, y: y + 3 },
      { x, y: y - 2 },
      { x: x + 4, y: y + 3 },
    ],
    { stroke: INK_LIGHT, lw: 2, seed: 5, rough: 0.3, smooth: false }
  );
}

// ============================================================================
// Typing feedback
// ============================================================================

function updateBufferDisplay(text, match) {
  typedBuffer = text;
  elements.buffer.textContent = text;
  highlightedActionId = match?.id || null;
  elements.typing.classList.toggle("typing--ready", Boolean(match));
}

function showActivation(text, variant = "neutral") {
  elements.message.textContent = text;
  elements.message.classList.remove("message--success", "message--error");
  if (variant === "success") elements.message.classList.add("message--success");
  else if (variant === "error") elements.message.classList.add("message--error");
}

function showToast(text, variant = "neutral") {
  elements.toast.textContent = text;
  elements.toast.classList.remove("message--success", "message--error");
  if (variant === "success") elements.toast.classList.add("message--success");
  else if (variant === "error") elements.toast.classList.add("message--error");
}

function clearActivation() {
  elements.message.textContent = "";
  elements.message.classList.remove("message--success", "message--error");
}

function clearToast() {
  elements.toast.textContent = "";
  elements.toast.classList.remove("message--success", "message--error");
}

// ============================================================================
// Effects
// ============================================================================

function burstAt(x, y, color) {
  if (reducedMotion) return;
  effects = [
    ...effects,
    { x, y, start: time, duration: 0.85, seed: Math.random() * 100, count: 9, color },
  ];
}

function burstAtAction(action) {
  const feature = lastFeatureLayout.find((entry) => entry.actionId === action.id);
  if (!feature?.slot) return;
  burstAt(feature.slot.x, feature.slot.y, feature.color?.fill);
}

function beginTransition(direction) {
  if (reducedMotion || !direction) return;
  // The grid vector *is* the slide vector: walking north means the new place
  // arrives from the north edge of the screen.
  const vector = DIRECTION_VECTORS[direction];
  if (!vector) return;

  const dpr = window.devicePixelRatio || 1;
  const width = elements.scene.clientWidth || 720;
  const height = elements.scene.clientHeight || 540;
  const snapshot = ensureOffscreen("previous", width, height, dpr);
  const snapshotCtx = snapshot.getContext("2d");
  snapshotCtx.setTransform(1, 0, 0, 1, 0, 0);
  snapshotCtx.clearRect(0, 0, snapshot.width, snapshot.height);
  snapshotCtx.drawImage(elements.scene, 0, 0);

  transition = { vector, start: time, previous: snapshot };
}

// ============================================================================
// Actions
// ============================================================================

function handleAction(action) {
  if (!action) return;

  if (state.status === "success" && action.id === SUCCESS_ACTION.id) {
    showActivation("Starting a new island!", "success");
    restartIsland();
    return;
  }

  switch (action.kind) {
    case "move": {
      const direction = getMovementDirection(lastSceneNode, action, island);
      if (direction === "west") facing = -1;
      if (direction === "east") facing = 1;
      beginTransition(direction);
      if (action.to) {
        const destination = island.nodes[action.to];
        showActivation(`You walked to ${destination?.title || action.to}.`, "success");
      }
      break;
    }
    case "ship": {
      showActivation("You climb aboard the ship...", "success");
      break;
    }
    case "pickup": {
      burstAtAction(action);
      clearActivation();
      break;
    }
    default: {
      burstAtAction(action);
      showActivation(action.label, "success");
    }
  }

  const result = applyAction(island, state, action.id);
  state = result.state;
  promptService.refresh(action.id);

  result.events?.forEach((event) => {
    if (event.type === "toast") {
      showToast(event.message, event.message === "Success!" ? "success" : "error");
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
    if (!engine.activateMatch()) {
      showActivation("That is not one of the words. Try again!", "error");
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

// ============================================================================
// Boot
// ============================================================================

function createSeededRandom(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function nextSeed() {
  return Math.floor(Math.random() * 1_000_000_000) + 1;
}

function newIsland() {
  const seed = nextSeed();
  island = generateIsland({ random: createSeededRandom(seed) });
  logIsland(seed, island);
  state = createInitialState(island);
  clearSceneCache();
  effects = [];
  transition = null;
  facing = 1;
}

function restartIsland() {
  newIsland();
  promptService.reset();
  clearActivation();
  clearToast();
  render();
}

function boot() {
  newIsland();
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
    clearSceneCache();
    renderMap();
  });

  window.requestAnimationFrame(loop);
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
