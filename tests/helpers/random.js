export function createCycleRandom(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("Random sequence must contain at least one value");
  }
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
}

// Park–Miller minimal standard generator, produces deterministic values
export function createSeededRandom(seed) {
  let value = seed % 2147483647;
  if (value <= 0) {
    value += 2147483646;
  }
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}
