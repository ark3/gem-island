const FALLBACK_BIOME = Object.freeze({
  id: "fallback",
  title: "Default",
  dominantColor: "#0b1220",
});

const BIOME_LIST = [
  { id: "dock", title: "Dock", dominantColor: "#4c6ef5" },
  { id: "beach", title: "Beach", dominantColor: "#fbbf24" },
  { id: "cave", title: "Cave", dominantColor: "#94a3b8" },
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
