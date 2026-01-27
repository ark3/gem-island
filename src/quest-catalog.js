export const QUEST_CATALOG = [
  {
    id: "sand_collect_shells",
    biome: "sand",
    type: "collect",
    giver: { type: "person", title: "Child" },
    item: { id: "shell", amount: 2 },
    dialog: {
      incomplete: "I'm making a necklace. Can you bring me {amount} {items}?",
      success: "You brought me shells. Thank you!",
      complete: "My necklace looks great now.",
    },
  },
  {
    id: "sand_discover_sandcastle",
    biome: "sand",
    type: "discover",
    giver: { type: "person", title: "Child" },
    target: {
      type: "sandcastle",
      description: "A big sandcastle with a tiny flag.",
    },
    dialog: {
      incomplete: "There's a big sandcastle on the beach. Have you seen it?",
      success: "You found a big sandcastle on the beach! Thanks for checking.",
      complete: "That sandcastle makes the beach feel happy.",
    },
  },
  {
    id: "rock_collect_pebbles",
    biome: "rock",
    type: "collect",
    giver: { type: "person", title: "Miner" },
    item: { id: "pebble", amount: 2 },
    dialog: {
      incomplete: "I'm looking for {amount} shiny {items}. Can you find them?",
      success: "You found shiny pebbles. They're perfect.",
      complete: "Keep your eyes peeled for shiny stones.",
    },
  },
  {
    id: "rock_discover_cave_sign",
    biome: "rock",
    type: "discover",
    giver: { type: "person", title: "Miner" },
    target: {
      type: "cave_sign",
      description: "A wooden sign pointing to a dark cave.",
    },
    dialog: {
      incomplete: "There's a sign by a cave mouth. Have you seen it?",
      success: "You saw a sign by a cave mouth. That helps a lot.",
      complete: "That cave sign keeps people safe.",
    },
  },
  {
    id: "forest_collect_pinecones",
    biome: "forest",
    type: "collect",
    giver: { type: "person", title: "Ranger" },
    item: { id: "pinecone", amount: 2 },
    dialog: {
      incomplete: "Could you bring me {amount} {items}?",
      success: "You brought pinecones. That's just what I needed.",
      complete: "Thanks again for the pinecones.",
    },
  },
  {
    id: "forest_discover_owl",
    biome: "forest",
    type: "discover",
    giver: { type: "person", title: "Ranger" },
    target: {
      type: "owl",
      description: "A quiet owl blinking from a high branch.",
    },
    dialog: {
      incomplete: "There's an owl in a tree somewhere. Have you spotted it?",
      success: "You spotted an owl in a tree! That's wonderful.",
      complete: "The owl is my favorite forest neighbor.",
    },
  },
  {
    id: "plains_collect_wildflowers",
    biome: "plains",
    type: "collect",
    giver: { type: "person", title: "Traveler" },
    item: { id: "wildflower", amount: 2 },
    dialog: {
      incomplete: "I want {amount} {items} for my pack. Can you help?",
      success: "You found wildflowers. They're beautiful.",
      complete: "The wildflowers smell so nice.",
    },
  },
  {
    id: "plains_discover_kite",
    biome: "plains",
    type: "discover",
    giver: { type: "person", title: "Traveler" },
    target: {
      type: "kite",
      description: "A bright kite snagged in the tall grass.",
    },
    dialog: {
      incomplete: "I lost my kite in the plains. Have you seen it?",
      success: "You found a kite in the plains. I'm so glad it's safe.",
      complete: "That kite means a lot to me.",
    },
  },
  {
    id: "farm_collect_carrots",
    biome: "farm",
    type: "collect",
    giver: { type: "person", title: "Farmer" },
    item: { id: "carrot", amount: 2 },
    dialog: {
      incomplete: "I need {amount} {items} for dinner. Can you bring them?",
      success: "You brought carrots. Thank you!",
      complete: "Dinner will be tasty tonight.",
    },
  },
  {
    id: "farm_discover_tractor",
    biome: "farm",
    type: "discover",
    giver: { type: "person", title: "Farmer" },
    target: {
      type: "tractor",
      description: "A shiny green tractor resting by the field.",
    },
    dialog: {
      incomplete: "My tractor is out somewhere in the fields. Have you seen it?",
      success: "You spotted a tractor in the fields. Thanks for letting me know.",
      complete: "My tractor is right where it should be.",
    },
  },
];
