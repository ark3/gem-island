import { coordinateKey, createMovementActionsForNode } from "./island-utils.js";

const SURFACE_NODES = [
  {
    id: "ship",
    title: "Ship",
    biome: "dock",
    color: "#4c6ef5",
    position: { x: 0, y: 1 },
    actions: [{ id: "ship_leave", kind: "ship", label: "Sail Away" }],
    features: [
      {
        id: "ship_feature",
        type: "ship",
        biomeVariant: "dock",
        actionId: "ship_leave",
      },
    ],
  },
  {
    id: "beach",
    title: "Beach",
    biome: "beach",
    color: "#fbbf24",
    position: { x: 0, y: 0 },
    actions: [{ id: "beach_pick_gem", kind: "pickup", label: "Pick Up Gem", item: "gem", amount: 1 }],
    features: [
      {
        id: "beach_gem_feature",
        type: "gem",
        actionId: "beach_pick_gem",
        amount: 1,
        item: "gem",
      },
    ],
  },
  {
    id: "cave",
    title: "Cave Entrance",
    biome: "cave",
    color: "#94a3b8",
    position: { x: 1, y: 0 },
    actions: [{ id: "cave_pick_gem", kind: "pickup", label: "Pick Up Gem", item: "gem", amount: 1 }],
    features: [
      {
        id: "cave_gem_feature",
        type: "gem",
        actionId: "cave_pick_gem",
        amount: 1,
        item: "gem",
      },
    ],
  },
];

function buildNodesFromGrid() {
  const nodesByCoordinate = new Map();
  for (const node of SURFACE_NODES) {
    const key = coordinateKey(node.position.x, node.position.y);
    if (nodesByCoordinate.has(key)) {
      throw new Error(`Multiple nodes share the same grid square at ${key}`);
    }
    nodesByCoordinate.set(key, node);
  }

  const nodes = {};
  for (const node of SURFACE_NODES) {
    nodes[node.id] = {
      id: node.id,
      title: node.title,
      biome: node.biome,
      color: node.color,
      position: { ...node.position },
      features: Array.isArray(node.features) ? [...node.features] : [],
      actions: [...createMovementActionsForNode(node, nodesByCoordinate), ...node.actions],
    };
  }
  return nodes;
}

export function createManualIsland() {
  return {
    id: "manual-grid-v1",
    requiredGems: 2,
    nodes: buildNodesFromGrid(),
  };
}
