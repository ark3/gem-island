export function createManualIsland() {
  return {
    id: "manual-v1",
    requiredGems: 2,
    nodes: {
      ship: {
        id: "ship",
        type: "start",
        title: "Ship",
        actions: [
          { id: "ship_go_beach", kind: "move", label: "Go North", prompt: "cat", to: "beach" },
          { id: "ship_leave", kind: "ship", label: "Sail Away", prompt: "sun" },
        ],
      },
      beach: {
        id: "beach",
        type: "path",
        title: "Beach",
        actions: [
          { id: "beach_back_ship", kind: "move", label: "Go Back", prompt: "dog", to: "ship" },
          { id: "beach_go_cave", kind: "move", label: "Go East", prompt: "hat", to: "cave" },
          { id: "beach_pick_gem", kind: "pickup", label: "Pick Up Gem", prompt: "pen", item: "gem", amount: 1 },
        ],
      },
      cave: {
        id: "cave",
        type: "feature",
        title: "Cave Entrance",
        actions: [
          { id: "cave_back_beach", kind: "move", label: "Go Back", prompt: "ram", to: "beach" },
          { id: "cave_pick_gem", kind: "pickup", label: "Pick Up Gem", prompt: "cup", item: "gem", amount: 1 },
        ],
      },
    },
  };
}
