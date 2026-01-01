function cloneState(state) {
  return {
    ...state,
    completedActions: new Set(state.completedActions),
    visitedNodes: new Set(state.visitedNodes),
  };
}

function findActionById(island, actionId) {
  for (const node of Object.values(island.nodes)) {
    const action = node.actions.find((entry) => entry.id === actionId);
    if (action) return action;
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

export function applyAction(island, state, actionId) {
  if (state.status === "success") {
    return { state, events: [] };
  }

  const action = findActionById(island, actionId);
  if (!action) {
    return { state, events: [] };
  }

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
      const completed = new Set(nextState.completedActions);
      completed.add(action.id);
      const amount = typeof action.amount === "number" ? action.amount : 0;
      nextState = {
        ...nextState,
        completedActions: completed,
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
      const completed = new Set(nextState.completedActions);
      completed.add(action.id);
      nextState = {
        ...nextState,
        completedActions: completed,
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
    const nonMove = node.actions.filter((action) => action.kind !== "move");
    if (nonMove.length === 0) {
      completed += 1;
      return;
    }
    if (nonMove.every((action) => state.completedActions.has(action.id))) {
      completed += 1;
    }
  });
  return completed;
}
