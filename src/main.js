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
} from "./island-engine.js";
import { createPromptService } from "./prompt-service.js";
import {
  DIRECTION_VECTORS,
  clearSceneCache,
  getMovementDirection,
  renderSceneToCanvas,
} from "./scene-renderer.js";
import { renderMapToCanvas } from "./map-renderer.js";
import { clamp, easeInOut } from "./ink.js";

const SUCCESS_ACTION = Object.freeze({
  id: "new-island",
  kind: "reset",
  label: "New island",
  prompt: "new",
});

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
  const sized = sizeCanvas(elements.map, 260, 1);
  if (!sized) return;
  renderMapToCanvas(sized.ctx, sized.width, sized.height, { island, state });
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
