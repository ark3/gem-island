import { getBiomeById, listBiomes } from "./biomes.js";
import { CARDINAL_DIRECTIONS, coordinateKey, createMovementActionsForNode } from "./island-utils.js";

export const DEFAULT_GRID_BOUNDS = Object.freeze({
  minX: -1,
  maxX: 2,
  minY: -1,
  maxY: 2,
});

const MIN_SURFACE_NODES = 6;
const MAX_SURFACE_NODES = 8;
const MIN_GEMS = 3;
const MAX_GEMS = 4;
const SURFACE_BIOMES = listBiomes().filter((biome) => biome.id !== "dock");

export function getShipStartPosition(bounds = DEFAULT_GRID_BOUNDS) {
  return { x: 0, y: bounds.maxY };
}

export function generateIsland(options = {}) {
  const random = typeof options.random === "function" ? options.random : Math.random;
  const bounds = normalizeBounds(options.bounds);
  const nodeCount = randomIntInRange(
    random,
    options.minNodes ?? MIN_SURFACE_NODES,
    options.maxNodes ?? MAX_SURFACE_NODES
  );

  const nodes = [];
  const nodesByCoordinate = new Map();
  const biomeCounters = new Map();

  const shipPosition = getShipStartPosition(bounds);
  const shipNode = createNode({
    id: "ship",
    title: "Ship",
    biomeId: "dock",
    type: "start",
    position: shipPosition,
  });
  nodes.push(shipNode);
  nodesByCoordinate.set(coordinateKey(shipPosition.x, shipPosition.y), shipNode);

  while (nodes.length < nodeCount) {
    const expandable = nodes.filter((node) => getAvailableNeighbors(node, nodesByCoordinate, bounds).length > 0);
    if (!expandable.length) break;
    const anchor = pickRandom(expandable, random);
    const openNeighbors = getAvailableNeighbors(anchor, nodesByCoordinate, bounds);
    if (!openNeighbors.length) continue;
    const spot = pickRandom(openNeighbors, random);
    const biome = pickRandom(SURFACE_BIOMES, random) || getBiomeById("beach");
    const node = createNode({
      id: `node_${nodes.length}`,
      title: generateNodeTitle(biome, biomeCounters),
      biomeId: biome.id,
      type: "path",
      position: spot,
    });
    nodes.push(node);
    nodesByCoordinate.set(coordinateKey(spot.x, spot.y), node);
  }

  const adjacency = new Map();
  nodes.forEach((node) => adjacency.set(node.id, getNeighborNodes(node, nodesByCoordinate)));

  nodes.forEach((node) => {
    if (node.id === "ship") {
      node.type = "start";
      return;
    }
    const neighborCount = adjacency.get(node.id)?.length ?? 0;
    node.type = neighborCount <= 1 ? "feature" : "path";
  });

  addShipActions(shipNode);

  const gemHosts = selectGemHosts(nodes, random);
  gemHosts.forEach((node, index) => addGemToNode(node, index));

  const finalNodes = {};
  nodes.forEach((node) => {
    const movement = createMovementActionsForNode(node, nodesByCoordinate);
    finalNodes[node.id] = {
      ...node,
      actions: [...movement, ...node.actions],
    };
  });

  return {
    id: options.id ?? "generated-surface-v1",
    requiredGems: gemHosts.length,
    nodes: finalNodes,
  };
}

function normalizeBounds(bounds = {}) {
  return {
    minX: Number.isFinite(bounds.minX) ? bounds.minX : DEFAULT_GRID_BOUNDS.minX,
    maxX: Number.isFinite(bounds.maxX) ? bounds.maxX : DEFAULT_GRID_BOUNDS.maxX,
    minY: Number.isFinite(bounds.minY) ? bounds.minY : DEFAULT_GRID_BOUNDS.minY,
    maxY: Number.isFinite(bounds.maxY) ? bounds.maxY : DEFAULT_GRID_BOUNDS.maxY,
  };
}

function isWithinBounds(x, y, bounds) {
  return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
}

function createNode({ id, title, biomeId, type, position }) {
  const biome = getBiomeById(biomeId);
  return {
    id,
    title,
    type,
    biome: biomeId,
    color: biome.dominantColor,
    position: { ...position },
    features: [],
    actions: [],
  };
}

function generateNodeTitle(biome, counters) {
  const count = (counters.get(biome.id) ?? 0) + 1;
  counters.set(biome.id, count);
  if (count === 1) return biome.title;
  return `${biome.title} ${count}`;
}

function getAvailableNeighbors(node, nodesByCoordinate, bounds) {
  if (!node?.position) return [];
  const neighbors = [];
  CARDINAL_DIRECTIONS.forEach((direction) => {
    const x = node.position.x + direction.dx;
    const y = node.position.y + direction.dy;
    if (!isWithinBounds(x, y, bounds)) return;
    const key = coordinateKey(x, y);
    if (nodesByCoordinate.has(key)) return;
    neighbors.push({ x, y });
  });
  return neighbors;
}

function getNeighborNodes(node, nodesByCoordinate) {
  const neighbors = [];
  CARDINAL_DIRECTIONS.forEach((direction) => {
    const x = node.position.x + direction.dx;
    const y = node.position.y + direction.dy;
    const neighbor = nodesByCoordinate.get(coordinateKey(x, y));
    if (neighbor) {
      neighbors.push(neighbor);
    }
  });
  return neighbors;
}

function pickRandom(entries, random) {
  if (!entries.length) return null;
  const index = Math.floor(random() * entries.length);
  return entries[index];
}

function randomIntInRange(random, min, max) {
  if (min >= max) return min;
  return Math.floor(random() * (max - min + 1)) + min;
}

function selectGemHosts(nodes, random) {
  const candidates = nodes.filter((node) => node.id !== "ship");
  if (!candidates.length) return [];
  const target = determineGemCount(candidates.length);
  const featureNodes = candidates.filter((node) => node.type === "feature");
  const pathNodes = candidates.filter((node) => node.type !== "feature");
  const selected = pickWithoutReplacement(featureNodes, target, random);
  if (selected.length < target) {
    const remaining = target - selected.length;
    const extras = pickWithoutReplacement(pathNodes, remaining, random);
    selected.push(...extras);
  }
  return selected;
}

function determineGemCount(candidateCount) {
  if (candidateCount <= MIN_GEMS) {
    return candidateCount;
  }
  const upper = Math.min(candidateCount, MAX_GEMS);
  return upper;
}

function pickWithoutReplacement(source, count, random) {
  const pool = [...source];
  const result = [];
  while (pool.length && result.length < count) {
    const index = Math.floor(random() * pool.length);
    result.push(pool.splice(index, 1)[0]);
  }
  return result;
}

function addShipActions(node) {
  const actionId = "ship_leave";
  node.actions.push({
    id: actionId,
    kind: "ship",
    label: "Sail Away",
  });
  node.features.push({
    id: "ship_feature",
    type: "ship",
    biomeVariant: node.biome,
    actionId,
  });
}

function addGemToNode(node) {
  const actionId = `${node.id}_pickup_gem`;
  node.actions.push({
    id: actionId,
    kind: "pickup",
    label: "Pick Up Gem",
    item: "gem",
    amount: 1,
  });
  node.features.push({
    id: `${node.id}_gem_feature`,
    type: "gem",
    actionId,
    amount: 1,
    item: "gem",
  });
}
