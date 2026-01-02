const FALLBACK_BIOME = Object.freeze({
  id: "fallback",
  title: "Default",
  dominantColor: "#0b1220",
});

const BIOME_LIST = [
  {
    id: "dock",
    title: "Dock",
    dominantColor: "#4c6ef5",
    pathColor: "rgba(15, 23, 42, 0.45)",
    pathOutline: "rgba(15, 23, 42, 0.7)",
    edgeColor: "#1d4ed8",
    textureColor: "#bfdbfe",
    accentColor: "#c7d2fe",
  },
  {
    id: "sand",
    title: "Sands",
    dominantColor: "#f5d791",
    pathColor: "rgba(170, 85, 0, 0.5)",
    pathOutline: "rgba(120, 53, 15, 0.6)",
    sandLight: "#fcecc5",
    sandShadow: "#f1c975",
    duneAccent: "#fca311",
    waterColor: "#44b4e2",
    foamColor: "#fef3c7",
  },
  {
    id: "rock",
    title: "Rocky Ridge",
    dominantColor: "#a0b4c5",
    pathColor: "rgba(15, 23, 42, 0.35)",
    pathOutline: "rgba(2, 6, 23, 0.55)",
    rockLight: "#bcccdc",
    rockDark: "#6b7280",
    ridgeAccent: "#475569",
    snowCap: "#f8fafc",
  },
  {
    id: "forest",
    title: "Forest",
    dominantColor: "#0f3d2e",
    pathColor: "rgba(15, 118, 110, 0.5)",
    pathOutline: "rgba(4, 47, 46, 0.7)",
    canopyLight: "#3a9b59",
    canopyDark: "#1f6f3c",
    trunkColor: "#5b3716",
    groundColor: "#13452f",
  },
  {
    id: "plains",
    title: "Plains",
    dominantColor: "#92c17b",
    pathColor: "rgba(148, 94, 28, 0.5)",
    pathOutline: "rgba(77, 46, 7, 0.6)",
    grassLight: "#b9e08b",
    grassShadow: "#7ea75c",
    bloomColor: "#fcd34d",
  },
  {
    id: "farm",
    title: "Fields",
    dominantColor: "#c6ad8a",
    pathColor: "rgba(99, 63, 25, 0.55)",
    pathOutline: "rgba(56, 30, 11, 0.6)",
    soilDark: "#8a5a2c",
    soilLight: "#c07d3a",
    cropGreen: "#7cb342",
    cropYellow: "#f5ca3a",
  },
];

const BIOMES = new Map(BIOME_LIST.map((biome) => [biome.id, { ...biome }]));

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
  return BIOME_LIST.map((biome) => ({ ...biome }));
}
