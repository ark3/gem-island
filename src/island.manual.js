const DIRECTION_DELTAS = [
  { name: "north", label: "Go North", dx: 0, dy: -1 },
  { name: "south", label: "Go South", dx: 0, dy: 1 },
  { name: "west", label: "Go West", dx: -1, dy: 0 },
  { name: "east", label: "Go East", dx: 1, dy: 0 },
];

const SURFACE_NODES = [
  {
    id: "ship",
    type: "start",
    title: "Ship",
    color: "#4c6ef5",
    position: { x: 0, y: 1 },
    actions: [{ id: "ship_leave", kind: "ship", label: "Sail Away" }],
  },
  {
    id: "beach",
    type: "path",
    title: "Beach",
    color: "#fbbf24",
    position: { x: 0, y: 0 },
    actions: [{ id: "beach_pick_gem", kind: "pickup", label: "Pick Up Gem", item: "gem", amount: 1 }],
  },
  {
    id: "cave",
    type: "feature",
    title: "Cave Entrance",
    color: "#94a3b8",
    position: { x: 1, y: 0 },
    actions: [{ id: "cave_pick_gem", kind: "pickup", label: "Pick Up Gem", item: "gem", amount: 1 }],
  },
];

function coordinateKey(x, y) {
  return `${x},${y}`;
}

function createMovementActionsForNode(node, nodesByCoordinate) {
  const actions = [];
  for (const direction of DIRECTION_DELTAS) {
    const neighborKey = coordinateKey(node.position.x + direction.dx, node.position.y + direction.dy);
    const neighbor = nodesByCoordinate.get(neighborKey);
    if (!neighbor) continue;
    actions.push({
      id: `${node.id}_move_${direction.name}_${neighbor.id}`,
      kind: "move",
      label: direction.label,
      to: neighbor.id,
    });
  }
  return actions;
}

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
      type: node.type,
      title: node.title,
      color: node.color,
      position: { ...node.position },
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
