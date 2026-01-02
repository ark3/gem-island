const FALLBACK_FEATURE = Object.freeze({
  id: "fallback",
  title: "Unknown Feature",
  kind: "decor",
});

const FEATURE_LIST = [
  { id: "ship", title: "Ship", kind: "structure" },
  { id: "gem", title: "Gem", kind: "pickup" },
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
