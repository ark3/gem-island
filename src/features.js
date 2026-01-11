const FALLBACK_FEATURE = Object.freeze({
  id: "fallback",
  title: "Unknown Feature",
  kind: "decor",
});

const FEATURE_LIST = [
  { id: "ship", title: "Ship", kind: "structure" },
  { id: "gem", title: "Gem", kind: "pickup" },
  { id: "shell", title: "Shell", kind: "pickup" },
  { id: "pebble", title: "Pebble", kind: "pickup" },
  { id: "pinecone", title: "Pinecone", kind: "pickup" },
  { id: "wildflower", title: "Wildflower", kind: "pickup" },
  { id: "carrot", title: "Carrot", kind: "pickup" },
  { id: "sign", title: "Sign", kind: "talk" },
  { id: "person", title: "Person", kind: "talk" },
  { id: "sandcastle", title: "Sandcastle", kind: "inspect" },
  { id: "cave_sign", title: "Cave Sign", kind: "inspect" },
  { id: "owl", title: "Owl", kind: "inspect" },
  { id: "kite", title: "Kite", kind: "inspect" },
  { id: "tractor", title: "Tractor", kind: "inspect" },
];

const FEATURES = new Map(FEATURE_LIST.map((feature) => [feature.id, { ...feature }]));

export function getFeatureByType(type) {
  if (type && FEATURES.has(type)) {
    return FEATURES.get(type);
  }
  return FALLBACK_FEATURE;
}

export function normalizeFeatureEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const definition = getFeatureByType(entry.type);
  return {
    ...definition,
    ...entry,
  };
}
