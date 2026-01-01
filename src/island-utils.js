const CARDINAL_DIRECTIONS = [
  { name: "north", label: "Go North", dx: 0, dy: -1 },
  { name: "south", label: "Go South", dx: 0, dy: 1 },
  { name: "west", label: "Go West", dx: -1, dy: 0 },
  { name: "east", label: "Go East", dx: 1, dy: 0 },
];

export { CARDINAL_DIRECTIONS };

export function coordinateKey(x, y) {
  return `${x},${y}`;
}

export function createMovementActionsForNode(node, nodesByCoordinate) {
  if (!node?.position) return [];
  const actions = [];
  for (const direction of CARDINAL_DIRECTIONS) {
    const x = node.position.x + direction.dx;
    const y = node.position.y + direction.dy;
    const neighbor = nodesByCoordinate.get(coordinateKey(x, y));
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
