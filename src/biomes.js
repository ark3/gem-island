// Biome definitions.
//
// Each biome carries one `dominantColor` — the flat colour that defines the
// node's identity and is reused for its square on the map — plus the flat
// tints its scene is painted from. Per `docs/visual-v2.md` every value here is
// a solid colour: nothing in this file may be used to build a gradient.

// Every biome inherits these, and overrides the ones it cares about. A biome
// draws things it has no colour of its own for — a tree at the edge of the
// plains, foam where a forest meets the sea — and the default is what it uses.
// These lived in `scene-renderer.js` as `biome.canopy || "#3f9052"` until Sept
// 2026, which put biome colours in two files and let two of them drift apart.
const BIOME_DEFAULTS = Object.freeze({
  ground: "#cbb994",
  groundDeep: "#b6a47f",
  detail: "#8e7c5b",
  water: "#5bb0d6",
  waterDeep: "#3d93bd",
  foam: "#fdfbf2",
  sand: "#f3d79c",
  sandDeep: "#e6c079",
  sandDetail: "#c79a4e",
  wood: "#c98d52",
  woodDeep: "#9c6733",
  canopy: "#3f9052",
  canopyDeep: "#2d7140",
  trunk: "#9c6733",
  moss: "#7fa86a",
  stone: "#b7bdc9",
  stoneDeep: "#b7bdc9",
  bloom: "#f5c542",
  bloomAlt: "#ef8fb4",
  soil: "#b47c42",
  crop: "#8fbf52",
  cropRipe: "#f0c64a",
  tuft: "#8faa55",
});

const FALLBACK_BIOME = Object.freeze({
  ...BIOME_DEFAULTS,
  id: "fallback",
  title: "Default",
  dominantColor: "#cbb994",
});

const BIOME_LIST = [
  {
    id: "dock",
    title: "Dock",
    dominantColor: "#5bb0d6",
    ground: "#a9cf6d",
    groundDeep: "#8fba57",
    sand: "#f3d79c",
    sandDeep: "#e6c079",
    water: "#5bb0d6",
    waterDeep: "#3d93bd",
    foam: "#fdfbf2",
    wood: "#c98d52",
    woodDeep: "#9c6733",
    detail: "#3d7f2f",
  },
  {
    id: "sand",
    title: "Sands",
    dominantColor: "#f3d79c",
    ground: "#f3d79c",
    groundDeep: "#e6c079",
    water: "#5bb0d6",
    waterDeep: "#3d93bd",
    foam: "#fdfbf2",
    shell: "#f6e3c4",
    detail: "#c79a4e",
  },
  {
    id: "rock",
    title: "Rocky Ridge",
    dominantColor: "#bdb4a6",
    ground: "#bdb4a6",
    groundDeep: "#a39a8c",
    stone: "#d5cdbe",
    stoneDeep: "#978e80",
    moss: "#7fa86a",
    detail: "#7a7264",
  },
  {
    id: "forest",
    title: "Forest",
    dominantColor: "#57a05e",
    ground: "#5fa44f",
    groundDeep: "#4c8b42",
    canopy: "#419455",
    canopyDeep: "#2c7040",
    trunk: "#9c6733",
    detail: "#2d7140",
  },
  {
    id: "plains",
    title: "Plains",
    dominantColor: "#a6cf6a",
    ground: "#a6cf6a",
    groundDeep: "#8dba54",
    bloom: "#f5c542",
    bloomAlt: "#ef8fb4",
    detail: "#5f8f3c",
  },
  {
    id: "farm",
    title: "Fields",
    dominantColor: "#dfb777",
    ground: "#dfb777",
    groundDeep: "#c99a58",
    soil: "#b47c42",
    crop: "#8fbf52",
    cropRipe: "#f0c64a",
    detail: "#8a5f30",
  },
];

const BIOMES = new Map(BIOME_LIST.map((biome) => [biome.id, { ...BIOME_DEFAULTS, ...biome }]));

export function getBiomeById(id) {
  if (id && BIOMES.has(id)) {
    return BIOMES.get(id);
  }
  return FALLBACK_BIOME;
}

export function resolveNodeColor(node) {
  if (node?.color) return node.color;
  const biome = getBiomeById(node?.biome);
  return biome.dominantColor;
}

export function listBiomes() {
  return BIOME_LIST.map((biome) => ({ ...BIOME_DEFAULTS, ...biome }));
}
