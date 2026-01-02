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
