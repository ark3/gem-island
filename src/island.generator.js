import { getBiomeById, listBiomes } from "./biomes.js";
import { CARDINAL_DIRECTIONS, coordinateKey, createMovementActionsForNode } from "./island-utils.js";

export const DEFAULT_GRID_BOUNDS = Object.freeze({
  minX: -5,
  maxX: 4,
  minY: -5,
  maxY: 4,
});

export const MIN_SURFACE_NODES = 20;
export const MAX_SURFACE_NODES = 30;
const MIN_GEMS = 1;
const SURFACE_BIOMES = listBiomes().filter((biome) => biome.id !== "dock");
const SAND_BIOME_ID = "sand";

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

  const shipPosition = getShipStartPosition(bounds);
  const nodes = [];
  const nodesByCoordinate = new Map();
  const biomeCounters = new Map();
  const blockedCoordinates = new Set();
  const reservedHole = findCentralHole(bounds, shipPosition);
  if (reservedHole) {
    blockedCoordinates.add(coordinateKey(reservedHole.x, reservedHole.y));
  }
  const shipNode = createNode({
    id: "ship",
    title: "Ship",
    biomeId: "dock",
    position: shipPosition,
  });
  nodes.push(shipNode);
  nodesByCoordinate.set(coordinateKey(shipPosition.x, shipPosition.y), shipNode);

  while (nodes.length < nodeCount) {
    const expandable = nodes.filter(
      (node) => getAvailableNeighbors(node, nodesByCoordinate, bounds, blockedCoordinates).length > 0
    );
    if (!expandable.length) break;
    const anchor = pickRandom(expandable, random);
    const openNeighbors = getAvailableNeighbors(anchor, nodesByCoordinate, bounds, blockedCoordinates);
    if (!openNeighbors.length) continue;
    const spot = pickRandom(openNeighbors, random);
    const node = createNode({
      id: `node_${nodes.length}`,
      position: spot,
    });
    nodes.push(node);
    nodesByCoordinate.set(coordinateKey(spot.x, spot.y), node);
  }

  const adjacency = new Map();
  nodes.forEach((node) => adjacency.set(node.id, getNeighborNodes(node, nodesByCoordinate)));

  assignBiomesToSurfaceNodes(nodes, shipNode, nodesByCoordinate, random, biomeCounters);

  addShipActions(shipNode);
  addBeachPerson(nodes, shipNode, nodesByCoordinate, bounds);

  const gemHosts = selectGemHosts(nodes, shipNode, adjacency, random);
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
    mapLandmarks: createMapLandmarks(nodes, shipNode, nodesByCoordinate, bounds, reservedHole),
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

function createNode({ id, title, biomeId, position }) {
  const biome = getBiomeById(biomeId);
  return {
    id,
    title,
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

function assignBiomesToSurfaceNodes(nodes, shipNode, nodesByCoordinate, random, counters) {
  const surfaceNodes = nodes.filter((node) => node.id !== shipNode.id);
  if (!surfaceNodes.length) return;
  const targetBiomeCount = determineBiomeCount(surfaceNodes.length);
  const biomeIds = selectBiomeIds(random, targetBiomeCount);
  const centroid = calculateCentroid(surfaceNodes);
  const bounds = calculateBounds(surfaceNodes);
  const maxDistance = calculateMaxDistance(surfaceNodes, centroid);
  const sandBiasStrength = calculateSandBiasStrength(surfaceNodes.length);
  const adjacency = new Map();
  surfaceNodes.forEach((node) => {
    const neighbors = getNeighborNodes(node, nodesByCoordinate).filter((neighbor) => neighbor.id !== shipNode.id);
    adjacency.set(node.id, neighbors);
  });

  const baseWeights = new Map();
  surfaceNodes.forEach((node) => {
    const normalized = maxDistance > 0 ? calculateDistance(node.position, centroid) / maxDistance : 0;
    const isEdge = isEdgeNode(node, bounds);
    const weights = biomeIds.map((biomeId) => ({
      id: biomeId,
      weight: calculateBiomeWeight(biomeId, normalized, isEdge, sandBiasStrength),
    }));
    baseWeights.set(node.id, weights);
  });

  let assignments = new Map();
  surfaceNodes.forEach((node) => {
    const weights = baseWeights.get(node.id) || [];
    assignments.set(node.id, pickWeightedBiome(weights, random));
  });
  assignments = smoothBiomeAssignments(surfaceNodes, adjacency, baseWeights, assignments, random, 2);

  surfaceNodes.forEach((node) => {
    const biomeId = assignments.get(node.id) || biomeIds[0] || SAND_BIOME_ID;
    const biome = getBiomeById(biomeId);
    node.biome = biome.id;
    node.color = biome.dominantColor;
    node.title = generateNodeTitle(biome, counters);
  });
}

function determineBiomeCount(surfaceNodeCount) {
  if (surfaceNodeCount <= 0) return 0;
  const target = Math.round(surfaceNodeCount / 3);
  return clamp(target, 1, SURFACE_BIOMES.length);
}

function selectBiomeIds(random, targetCount) {
  const selected = [];
  const sandBiome = SURFACE_BIOMES.find((biome) => biome.id === SAND_BIOME_ID);
  if (sandBiome && targetCount > 0) {
    selected.push(sandBiome.id);
  }
  const available = SURFACE_BIOMES.map((biome) => biome.id).filter((id) => !selected.includes(id));
  while (selected.length < Math.min(targetCount, SURFACE_BIOMES.length) && available.length) {
    const pickIndex = Math.floor(random() * available.length);
    selected.push(available.splice(pickIndex, 1)[0]);
  }
  return selected;
}

function calculateCentroid(nodes) {
  const total = nodes.reduce(
    (sum, node) => {
      sum.x += node.position.x;
      sum.y += node.position.y;
      return sum;
    },
    { x: 0, y: 0 }
  );
  return { x: total.x / nodes.length, y: total.y / nodes.length };
}

function calculateBounds(nodes) {
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
  return { minX, maxX, minY, maxY };
}

function isEdgeNode(node, bounds) {
  return (
    node.position.x === bounds.minX ||
    node.position.x === bounds.maxX ||
    node.position.y === bounds.minY ||
    node.position.y === bounds.maxY
  );
}

function calculateDistance(position, centroid) {
  return Math.abs(position.x - centroid.x) + Math.abs(position.y - centroid.y);
}

function calculateMaxDistance(nodes, centroid) {
  let maxDistance = 0;
  nodes.forEach((node) => {
    maxDistance = Math.max(maxDistance, calculateDistance(node.position, centroid));
  });
  return maxDistance;
}

function calculateSandBiasStrength(nodeCount) {
  return clamp((nodeCount - 6) / 12, 0, 1);
}

function calculateBiomeWeight(biomeId, normalizedDistance, isEdge, sandBiasStrength) {
  let weight = 1;
  switch (biomeId) {
    case SAND_BIOME_ID:
      weight += normalizedDistance * 1.6;
      weight *= 1 + sandBiasStrength * (isEdge ? 2.2 : 0.8);
      break;
    case "rock":
      weight += (1 - normalizedDistance) * 1.4;
      break;
    case "forest":
      weight += bellWeight(normalizedDistance, 0.5, 0.5) * 1.1;
      break;
    case "plains":
      weight += normalizedDistance * 0.9;
      break;
    case "farm":
      weight += normalizedDistance * 0.6 + bellWeight(normalizedDistance, 0.6, 0.4) * 0.4;
      break;
    default:
      weight += bellWeight(normalizedDistance, 0.5, 0.6) * 0.6;
      break;
  }
  return Math.max(0.1, weight);
}

function bellWeight(value, center, width) {
  if (width <= 0) return 0;
  const distance = Math.abs(value - center);
  return Math.max(0, 1 - distance / width);
}

function pickWeightedBiome(entries, random) {
  if (!entries.length) return null;
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) {
    return entries[Math.floor(random() * entries.length)]?.id ?? null;
  }
  let threshold = random() * total;
  for (const entry of entries) {
    threshold -= entry.weight;
    if (threshold <= 0) return entry.id;
  }
  return entries[entries.length - 1].id;
}

function smoothBiomeAssignments(nodes, adjacency, baseWeights, assignments, random, iterations) {
  let current = new Map(assignments);
  for (let pass = 0; pass < iterations; pass += 1) {
    const next = new Map();
    nodes.forEach((node) => {
      const neighborCounts = new Map();
      (adjacency.get(node.id) || []).forEach((neighbor) => {
        const biomeId = current.get(neighbor.id);
        if (!biomeId) return;
        neighborCounts.set(biomeId, (neighborCounts.get(biomeId) ?? 0) + 1);
      });
      const base = baseWeights.get(node.id) || [];
      const weights = base.map((entry) => ({
        id: entry.id,
        weight: entry.weight + (neighborCounts.get(entry.id) ?? 0) * 1.4,
      }));
      next.set(node.id, pickWeightedBiome(weights, random) || current.get(node.id));
    });
    current = next;
  }
  return current;
}

function getAvailableNeighbors(node, nodesByCoordinate, bounds, blockedCoordinates) {
  if (!node?.position) return [];
  const neighbors = [];
  CARDINAL_DIRECTIONS.forEach((direction) => {
    const x = node.position.x + direction.dx;
    const y = node.position.y + direction.dy;
    if (!isWithinBounds(x, y, bounds)) return;
    const key = coordinateKey(x, y);
    if (blockedCoordinates?.has(key)) return;
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

function selectGemHosts(nodes, shipNode, adjacency, random) {
  const candidates = nodes.filter((node) => node.id !== shipNode.id);
  if (!candidates.length) return [];
  const target = determineGemCount(candidates.length);
  if (target <= 0) return [];
  const scored = candidates.map((node) => {
    const neighborCount = adjacency.get(node.id)?.length ?? 0;
    return {
      node,
      score: calculateGemScore(node, shipNode.position, neighborCount),
    };
  });
  return pickWeightedWithoutReplacement(scored, target, random);
}

function determineGemCount(candidateCount) {
  if (candidateCount <= 0) {
    return 0;
  }
  const scaled = Math.round(candidateCount / 2);
  return Math.min(candidateCount, Math.max(MIN_GEMS, scaled));
}

function pickWeightedWithoutReplacement(entries, count, random) {
  const pool = entries.filter((entry) => entry.score > 0);
  const result = [];
  while (pool.length && result.length < count) {
    const total = pool.reduce((sum, entry) => sum + entry.score, 0);
    if (total <= 0) {
      result.push(pool.shift().node);
      continue;
    }
    let threshold = random() * total;
    let index = 0;
    for (let i = 0; i < pool.length; i += 1) {
      threshold -= pool[i].score;
      if (threshold <= 0) {
        index = i;
        break;
      }
      index = i;
    }
    result.push(pool.splice(index, 1)[0].node);
  }
  return result;
}

function calculateGemScore(node, shipPosition, neighborCount) {
  const distance =
    node?.position && shipPosition
      ? Math.abs(node.position.x - shipPosition.x) + Math.abs(node.position.y - shipPosition.y)
      : 0;
  const distanceWeight = Math.max(1, distance);
  const deadEndBonus = neighborCount <= 1 ? 2 : 0;
  return distanceWeight + deadEndBonus;
}

function findCentralHole(bounds, shipPosition) {
  const center = {
    x: Math.round((bounds.minX + bounds.maxX) / 2),
    y: Math.round((bounds.minY + bounds.maxY) / 2),
  };
  const queue = [center];
  const visited = new Set();
  while (queue.length) {
    const current = queue.shift();
    const key = coordinateKey(current.x, current.y);
    if (visited.has(key)) continue;
    visited.add(key);
    if (!isWithinBounds(current.x, current.y, bounds)) continue;
    if (!(current.x === shipPosition.x && current.y === shipPosition.y)) {
      return current;
    }
    CARDINAL_DIRECTIONS.forEach((direction) => {
      queue.push({ x: current.x + direction.dx, y: current.y + direction.dy });
    });
  }
  return null;
}

function createMapLandmarks(nodes, shipNode, nodesByCoordinate, bounds, forcedPosition) {
  const surfaceNodes = nodes.filter((node) => node.id !== shipNode.id);
  if (!surfaceNodes.length) return [];
  const position =
    forcedPosition || findNearestEmptyCoordinate(calculateCentroid(surfaceNodes), nodesByCoordinate, bounds);
  if (!position) return [];
  return [
    {
      id: "volcano",
      type: "volcano",
      position,
    },
  ];
}

function findNearestEmptyCoordinate(centroid, nodesByCoordinate, bounds) {
  if (!centroid) return null;
  const start = {
    x: Math.round(centroid.x),
    y: Math.round(centroid.y),
  };
  const queue = [start];
  const visited = new Set();
  while (queue.length) {
    const current = queue.shift();
    const key = coordinateKey(current.x, current.y);
    if (visited.has(key)) continue;
    visited.add(key);
    if (!isWithinBounds(current.x, current.y, bounds)) continue;
    if (!nodesByCoordinate.has(key)) {
      return { x: current.x, y: current.y };
    }
    CARDINAL_DIRECTIONS.forEach((direction) => {
      queue.push({ x: current.x + direction.dx, y: current.y + direction.dy });
    });
  }
  return null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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

function addBeachPerson(nodes, shipNode, nodesByCoordinate, bounds) {
  const candidates = nodes.filter(
    (node) =>
      node.id !== shipNode.id &&
      node.biome === SAND_BIOME_ID &&
      hasWaterNeighbor(node, nodesByCoordinate, bounds)
  );
  if (!candidates.length) return;
  const target = findNearestNode(candidates, shipNode.position);
  if (!target) return;
  const actionId = `${target.id}_say_surfer`;
  target.actions.push({
    id: actionId,
    kind: "say",
    label: "Say hi",
    message: "Surf's up, dude!",
  });
  target.features.push({
    id: `${target.id}_surfer_feature`,
    type: "person",
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

function findNearestNode(nodes, position) {
  if (!position) return nodes[0] || null;
  return nodes.reduce((nearest, node) => {
    if (!node?.position) return nearest;
    const distance = Math.abs(node.position.x - position.x) + Math.abs(node.position.y - position.y);
    if (!nearest) {
      return { node, distance };
    }
    if (distance < nearest.distance) {
      return { node, distance };
    }
    return nearest;
  }, null)?.node;
}

function hasWaterNeighbor(node, nodesByCoordinate, bounds) {
  if (!node?.position) return false;
  return CARDINAL_DIRECTIONS.some((direction) => {
    const x = node.position.x + direction.dx;
    const y = node.position.y + direction.dy;
    if (!isWithinBounds(x, y, bounds)) {
      return true;
    }
    return !nodesByCoordinate.has(coordinateKey(x, y));
  });
}
