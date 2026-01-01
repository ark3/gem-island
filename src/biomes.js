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
    id: "beach",
    title: "Beach",
    dominantColor: "#fcd34d",
    pathColor: "rgba(146, 64, 14, 0.55)",
    pathOutline: "rgba(0, 0, 0, 0.35)",
    waveColor: "#38bdf8",
    textureColor: "#f59e0b",
    accentColor: "#fde68a",
  },
  {
    id: "cave",
    title: "Cave",
    dominantColor: "#94a3b8",
    pathColor: "rgba(15, 23, 42, 0.45)",
    pathOutline: "rgba(2, 6, 23, 0.7)",
    edgeColor: "#475569",
    textureColor: "#cbd5f5",
    accentColor: "#64748b",
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
