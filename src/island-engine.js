function cloneState(state) {
  return {
    ...state,
    completedActions: new Set(state.completedActions),
    completedFeatures: new Set(state.completedFeatures),
    visitedNodes: new Set(state.visitedNodes),
  };
}

function findActionContext(island, actionId) {
  for (const node of Object.values(island.nodes)) {
    const action = node.actions.find((entry) => entry.id === actionId);
    if (action) {
      const feature = Array.isArray(node.features)
        ? node.features.find((entry) => entry.actionId === action.id)
        : null;
      return { node, action, feature };
    }
  }
  return null;
}

function formatCount(count, singular, plural = `${singular}s`) {
  const noun = count === 1 ? singular : plural;
  return `${count} ${noun}`;
}

export function createInitialState(_island) {
  return {
    currentNodeId: "ship",
    gemsCollected: 0,
    completedActions: new Set(),
    completedFeatures: new Set(),
    visitedNodes: new Set(["ship"]),
    status: "playing",
  };
}

export function getCurrentNode(island, state) {
  return island.nodes[state.currentNodeId];
}

export function getVisibleActions(island, state, node) {
  if (!node) return [];
  return node.actions.map((action) => ({
    ...action,
    isCompleted: action.kind !== "move" ? state.completedActions.has(action.id) : false,
  }));
}

function addValueToSet(set, value) {
  if (!value) return set;
  if (set.has(value)) return set;
  const next = new Set(set);
  next.add(value);
  return next;
}

export function applyAction(island, state, actionId) {
  if (state.status === "success") {
    return { state, events: [] };
  }

  const context = findActionContext(island, actionId);
  if (!context) {
    return { state, events: [] };
  }
  const { action, feature } = context;

  const events = [];
  let nextState = cloneState(state);

  switch (action.kind) {
    case "move": {
      const visited = new Set(nextState.visitedNodes);
      if (action.to) {
        visited.add(action.to);
        nextState = {
          ...nextState,
          currentNodeId: action.to,
          visitedNodes: visited,
        };
      }
      break;
    }
    case "pickup": {
      if (nextState.completedActions.has(action.id)) {
        break;
      }
      const completed = addValueToSet(nextState.completedActions, action.id);
      const amount = typeof action.amount === "number" ? action.amount : 0;
      const completedFeatures = feature?.id
        ? addValueToSet(nextState.completedFeatures, feature.id)
        : nextState.completedFeatures;
      nextState = {
        ...nextState,
        completedActions: completed,
        completedFeatures,
        gemsCollected: nextState.gemsCollected + amount,
      };
      events.push({
        type: "toast",
        message: `You picked up a gem! Now you have ${formatCount(nextState.gemsCollected, "gem")}.`,
      });
      break;
    }
    case "ship": {
      if (island.requiredGems > nextState.gemsCollected) {
        events.push({
          type: "toast",
          message: `You need ${formatCount(island.requiredGems, "gem")} to finish. You have ${formatCount(
            nextState.gemsCollected,
            "gem"
          )} right now.`,
        });
        return { state, events };
      }
      events.push({ type: "toast", message: "Success!" });
      const completed = addValueToSet(nextState.completedActions, action.id);
      const completedFeatures = feature?.id
        ? addValueToSet(nextState.completedFeatures, feature.id)
        : nextState.completedFeatures;
      nextState = {
        ...nextState,
        completedActions: completed,
        completedFeatures,
        status: "success",
      };
      break;
    }
    default:
      break;
  }

  return { state: nextState, events };
}

export function countCompletedNodes(island, state) {
  let completed = 0;
  state.visitedNodes.forEach((nodeId) => {
    const node = island.nodes[nodeId];
    if (!node) return;
    if (isNodeCompleted(node, state)) {
      completed += 1;
    }
  });
  return completed;
}

export function isNodeCompleted(node, state) {
  if (!node || !state) return false;
  const features = Array.isArray(node.features) ? node.features : [];
  if (features.length === 0) {
    return true;
  }
  return features.every((feature) => state.completedFeatures.has(feature.id));
}
