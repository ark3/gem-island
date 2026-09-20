// Scene rendering for Gem Island.
//
// The layer stack described in `docs/rendering-v1.md`, drawn in the
// coloring-book style described in `docs/visual-v2.md`:
//
//   1. page + frame       the scene sits on paper, inside an ink border
//   2. coast              ocean at every edge with no neighbour
//   3. land               one flat dominant colour, hand-inked contour
//   4. adjacency hints    the neighbour's colour showing through each opening
//   5. paths              a light trail from the centre to each opening
//   6. decor              biome character: trees, boulders, furrows, blooms
//   7. features           gems, people, signs, the ship
//   8. explorer           the player, at the centre
//   9. effects            sparkles and pickup bursts
//  10. prompts            typing labels, attached to what they act on
//
// Layers 1-6 are static for a given node and canvas size, so they are painted
// once into a cached offscreen canvas and blitted each frame. Everything above
// them is redrawn live, which is what makes the scene animate cheaply.

import { getBiomeById, resolveNodeColor } from "./biomes.js";
import { normalizeFeatureEntry } from "./features.js";
import { drawExplorer } from "./explorer.js";
import {
  ALERT,
  HIGHLIGHT,
  INK,
  INK_LIGHT,
  PAPER,
  PAPER_DEEP,
  READY,
  alpha,
  clamp,
  easeOut,
  font,
  hatch,
  inkCircle,
  inkEllipse,
  inkLine,
  inkRect,
  inkShape,
  inkStar,
  inkText,
  lerp,
  measureText,
  mix,
  noise,
  signedNoise,
  stipple,
} from "./ink.js";

export { clamp };

// ============================================================================
// Constants
// ============================================================================

const FRAME_INSET = 10;
const FRAME_RADIUS = 26;
const FRAME_LINE = 5;

const DIRECTIONS = ["north", "south", "east", "west"];

// Where the dock's waterline sits, as a fraction of the frame height. The shore
// scene and the pier both key off it.
const DOCK_SAND_BOTTOM = 0.58;

export const DIRECTION_VECTORS = {
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
  east: { x: 1, y: 0 },
};

// Feature anchor points, in frame-relative units. The diagonals keep features
// clear of the movement prompts, which live at the edge midpoints.
const SLOT_POSITIONS = [
  { id: "northwest", u: 0.2, v: 0.26 },
  { id: "northeast", u: 0.8, v: 0.26 },
  { id: "southwest", u: 0.2, v: 0.71 },
  { id: "southeast", u: 0.8, v: 0.71 },
  { id: "center-low", u: 0.5, v: 0.82 },
];

const PROMPT_HEIGHT = 46;

// How far a feature's prompt sits from its anchor, and which side it prefers.
// Tall art (the ship, a person) needs more room than a pebble.
const PROMPT_ANCHORS = {
  ship: { below: 80, above: 150, prefer: "below" },
  person: { below: 78, above: 96 },
  sign: { below: 74, above: 88 },
  cave_sign: { below: 74, above: 88 },
  tractor: { below: 66, above: 80 },
  sandcastle: { below: 62, above: 80 },
  owl: { below: 62, above: 78 },
  kite: { below: 98, above: 82 },
  gem: { below: 76, above: 78 },
  wildflower: { below: 60, above: 72 },
  carrot: { below: 60, above: 72 },
  default: { below: 58, above: 70 },
};
const PROMPT_PAD_X = 20;
const PROMPT_MIN_WIDTH = 74;
const PROMPT_FONT = 24;

// ============================================================================
// Small helpers
// ============================================================================

function seedFromString(value) {
  let hash = 0;
  const text = String(value ?? "");
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % 1000003;
  }
  return hash + 1;
}

function makeFrame(width, height) {
  return {
    x: FRAME_INSET,
    y: FRAME_INSET,
    width: Math.max(40, width - FRAME_INSET * 2),
    height: Math.max(40, height - FRAME_INSET * 2),
    radius: FRAME_RADIUS,
  };
}

function framePoint(frame, u, v) {
  return { x: frame.x + frame.width * u, y: frame.y + frame.height * v };
}

function roundedFramePath(ctx, frame, inset = 0) {
  const x = frame.x + inset;
  const y = frame.y + inset;
  const w = frame.width - inset * 2;
  const h = frame.height - inset * 2;
  const r = Math.max(0, Math.min(frame.radius - inset * 0.5, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function getNodeAtPosition(island, x, y) {
  if (!island?.nodes) return null;
  return (
    Object.values(island.nodes).find((n) => n.position?.x === x && n.position?.y === y) || null
  );
}

function neighborInDirection(node, direction, island) {
  if (!node?.position) return null;
  const vector = DIRECTION_VECTORS[direction];
  if (!vector) return null;
  return getNodeAtPosition(island, node.position.x + vector.x, node.position.y + vector.y);
}

export function getMovementDirection(node, action, island) {
  if (!node || action.kind !== "move" || !action.to) return null;
  const destination = island?.nodes?.[action.to];
  if (!destination?.position || !node.position) return null;
  const dx = destination.position.x - node.position.x;
  const dy = destination.position.y - node.position.y;
  return (
    DIRECTIONS.find((direction) => {
      const vector = DIRECTION_VECTORS[direction];
      return vector.x === dx && vector.y === dy;
    }) || null
  );
}

/** A flat patch of scuffed ground that anchors an object to the land. */
function groundPatch(ctx, x, y, radius, biome, seed) {
  inkEllipse(ctx, x, y, radius, radius * 0.34, {
    fill: mix(biome.ground || "#cbb994", PAPER, 0.3),
    lw: 0,
    seed,
    rough: 1.4,
  });
}

// ============================================================================
// Coast and land
// ============================================================================

/**
 * The land polygon: the frame, pulled in on every side that has no neighbour so
 * ocean shows through. An interior node fills the frame edge to edge.
 */
function computeLandInsets(node, island, frame) {
  const margin = Math.min(frame.width, frame.height) * 0.11;
  const insets = {};
  DIRECTIONS.forEach((direction) => {
    insets[direction] = neighborInDirection(node, direction, island) ? -2 : margin;
  });
  return insets;
}

function landPolygon(frame, insets) {
  const left = frame.x + insets.west;
  const right = frame.x + frame.width - insets.east;
  const top = frame.y + insets.north;
  const bottom = frame.y + frame.height - insets.south;
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

function drawFoam(ctx, direction, polygon, biome, seed, phase) {
  const foam = biome.foam || "#fdfbf2";
  const [topLeft, topRight, bottomRight, bottomLeft] = polygon;
  let from;
  let to;
  let outward;
  if (direction === "north") {
    from = topLeft;
    to = topRight;
    outward = { x: 0, y: -1 };
  } else if (direction === "south") {
    from = bottomLeft;
    to = bottomRight;
    outward = { x: 0, y: 1 };
  } else if (direction === "west") {
    from = topLeft;
    to = bottomLeft;
    outward = { x: -1, y: 0 };
  } else {
    from = topRight;
    to = bottomRight;
    outward = { x: 1, y: 0 };
  }
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const scallops = Math.max(4, Math.round(length / 46));

  for (let band = 0; band < 2; band += 1) {
    const offset = 7 + band * 11 + Math.sin(phase + band * 1.4) * 2.5;
    const points = [];
    for (let i = 0; i <= scallops * 2; i += 1) {
      const t = i / (scallops * 2);
      const wave = Math.sin(t * Math.PI * scallops + phase + band) * 4;
      points.push({
        x: from.x + dx * t + outward.x * (offset + wave),
        y: from.y + dy * t + outward.y * (offset + wave),
      });
    }
    ctx.save();
    ctx.globalAlpha = band === 0 ? 0.95 : 0.55;
    inkLine(ctx, points, { stroke: foam, lw: band === 0 ? 4 : 3, seed: seed + band, rough: 1 });
    ctx.restore();
  }
}

// ============================================================================
// Biome decor
//
// Each biome contributes scattered marks and objects over the flat land. All of
// it is deterministic in the node seed, so a node looks the same every visit.
// ============================================================================

function decorSpots(seed, count, bounds, minDistanceFromCentre = 0) {
  const spots = [];
  let attempt = 0;
  while (spots.length < count && attempt < count * 12) {
    const u = noise(seed + attempt * 1.7, 3);
    const v = noise(seed + attempt * 2.9, 11);
    attempt += 1;
    const x = bounds.x + u * bounds.width;
    const y = bounds.y + v * bounds.height;
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    if (Math.hypot(x - cx, y - cy) < minDistanceFromCentre) continue;
    spots.push({ x, y, u, v, seed: seed + attempt });
  }
  return spots;
}

function drawTree(ctx, x, y, scale, biome, seed) {
  const trunkWidth = 9 * scale;
  const trunkHeight = 22 * scale;
  groundPatch(ctx, x, y + trunkHeight * 0.55, 24 * scale, biome, seed);
  inkShape(
    ctx,
    [
      { x: x - trunkWidth / 2, y: y - trunkHeight * 0.2 },
      { x: x + trunkWidth / 2, y: y - trunkHeight * 0.2 },
      { x: x + trunkWidth * 0.7, y: y + trunkHeight * 0.6 },
      { x: x - trunkWidth * 0.7, y: y + trunkHeight * 0.6 },
    ],
    { fill: biome.trunk || "#9c6733", lw: 3 * scale, seed, rough: 1 }
  );
  const radius = 30 * scale;
  inkCircle(ctx, x, y - radius * 0.55, radius, {
    fill: biome.canopy || "#3f9052",
    lw: 3.4 * scale,
    seed: seed + 5,
    rough: 2.6,
  });
  inkCircle(ctx, x - radius * 0.42, y - radius * 0.95, radius * 0.6, {
    fill: biome.canopy || "#3f9052",
    lw: 3.4 * scale,
    seed: seed + 9,
    rough: 2.2,
  });
  inkCircle(ctx, x + radius * 0.45, y - radius * 0.85, radius * 0.52, {
    fill: biome.canopyDeep || "#2d7140",
    lw: 3.4 * scale,
    seed: seed + 13,
    rough: 2.2,
  });
}

function drawBoulder(ctx, x, y, scale, biome, seed) {
  groundPatch(ctx, x, y + 14 * scale, 30 * scale, biome, seed);
  const tint = noise(seed, 2) > 0.5 ? biome.stone : biome.stoneDeep;
  inkShape(
    ctx,
    [
      { x: x - 30 * scale, y: y + 14 * scale },
      { x: x - 22 * scale, y: y - 14 * scale },
      { x: x + 4 * scale, y: y - 22 * scale },
      { x: x + 27 * scale, y: y - 6 * scale },
      { x: x + 31 * scale, y: y + 14 * scale },
    ],
    { fill: tint || "#b7bdc9", lw: 3.6 * scale, seed, rough: 2.2, smooth: true }
  );
  inkLine(
    ctx,
    [
      { x: x - 10 * scale, y: y + 12 * scale },
      { x: x - 4 * scale, y: y - 6 * scale },
      { x: x + 10 * scale, y: y - 14 * scale },
    ],
    { stroke: alpha(INK, 0.4), lw: 2.4 * scale, seed: seed + 3, rough: 1.2 }
  );
}

function drawBloom(ctx, x, y, scale, biome, seed) {
  const color = noise(seed, 7) > 0.5 ? biome.bloom : biome.bloomAlt;
  inkLine(
    ctx,
    [
      { x, y: y + 12 * scale },
      { x: x + signedNoise(seed, 2) * 3, y: y - 6 * scale },
    ],
    { stroke: biome.detail || "#5f8f3c", lw: 2.8 * scale, seed, rough: 0.8 }
  );
  for (let i = 0; i < 5; i += 1) {
    const angle = (i / 5) * Math.PI * 2;
    inkCircle(ctx, x + Math.cos(angle) * 6 * scale, y - 8 * scale + Math.sin(angle) * 6 * scale, 4.4 * scale, {
      fill: color || "#f5c542",
      lw: 2 * scale,
      seed: seed + i,
      rough: 0.5,
    });
  }
  inkCircle(ctx, x, y - 8 * scale, 3 * scale, { fill: PAPER, lw: 1.8 * scale, seed: seed + 21, rough: 0.4 });
}

function scatterTufts(ctx, bounds, { count, color, scale, seed }) {
  decorSpots(seed, count, bounds).forEach((spot) => {
    drawGrassTuft(ctx, spot.x, spot.y, scale, color, spot.seed);
  });
}

function drawGrassTuft(ctx, x, y, scale, color, seed) {
  for (let i = -1; i <= 1; i += 1) {
    inkLine(
      ctx,
      [
        { x, y: y + 4 * scale },
        { x: x + i * 7 * scale, y: y - (10 + Math.abs(i) * -3) * scale },
      ],
      { stroke: color, lw: 2.6 * scale, seed: seed + i + 2, rough: 0.7 }
    );
  }
}

function drawBiomeDecor(ctx, node, biome, frame, land, seed) {
  const inset = 46;
  const bounds = {
    x: land.left + inset,
    y: land.top + inset,
    width: Math.max(10, land.right - land.left - inset * 2),
    height: Math.max(10, land.bottom - land.top - inset * 2),
  };
  const keepClear = Math.min(frame.width, frame.height) * 0.22;
  const scale = clamp(Math.min(frame.width, frame.height) / 560, 0.62, 1.15);

  switch (biome.id) {
    case "forest": {
      const spots = decorSpots(seed, 14, bounds, keepClear);
      spots
        .sort((a, b) => a.y - b.y)
        .forEach((spot, index) => {
          drawTree(ctx, spot.x, spot.y, scale * (0.9 + noise(spot.seed, 4) * 0.45), biome, spot.seed + index);
        });
      scatterTufts(ctx, bounds, {
        count: 12,
        color: alpha(biome.canopyDeep || "#2d7140", 0.6),
        scale: scale * 0.85,
        seed: seed + 41,
      });
      break;
    }
    case "rock": {
      decorSpots(seed + 60, 5, bounds, keepClear * 0.8).forEach((spot) => {
        inkEllipse(ctx, spot.x, spot.y, 34 * scale, 16 * scale, {
          fill: alpha(biome.moss || "#7fa86a", 0.55),
          lw: 0,
          seed: spot.seed,
          rough: 2.4,
        });
      });
      decorSpots(seed, 9, bounds, keepClear).forEach((spot, index) => {
        drawBoulder(ctx, spot.x, spot.y, scale * (0.7 + noise(spot.seed, 6) * 0.6), biome, spot.seed + index);
      });
      hatch(ctx, bounds, {
        color: alpha(INK, 0.13),
        count: 14,
        length: 13 * scale,
        angle: 0.1,
        seed: seed + 17,
      });
      break;
    }
    case "plains": {
      decorSpots(seed, 14, bounds, keepClear * 0.7).forEach((spot, index) => {
        if (index % 3 === 0) {
          drawBloom(ctx, spot.x, spot.y, scale, biome, spot.seed);
        } else {
          drawGrassTuft(ctx, spot.x, spot.y, scale, alpha(biome.detail || "#5f8f3c", 0.75), spot.seed);
        }
      });
      break;
    }
    case "farm": {
      // Furrows: flat bands of soil and crop, each one inked.
      const rows = 5;
      const rowHeight = (land.bottom - land.top) / rows;
      for (let i = 0; i < rows; i += 1) {
        const top = land.top + i * rowHeight;
        const colour = i % 2 === 0 ? biome.soil : biome.crop;
        inkShape(
          ctx,
          [
            { x: land.left, y: top + rowHeight * 0.18 },
            { x: land.right, y: top + rowHeight * 0.1 },
            { x: land.right, y: top + rowHeight * 0.62 },
            { x: land.left, y: top + rowHeight * 0.7 },
          ],
          { fill: colour, lw: 2.6, seed: seed + i * 3, rough: 1.6 }
        );
        if (i % 2 === 1) {
          for (let c = 0; c < 7; c += 1) {
            const x = land.left + ((c + 0.5) / 7) * (land.right - land.left);
            const y = top + rowHeight * 0.34;
            inkCircle(ctx, x, y, 5 * scale, {
              fill: biome.cropRipe || "#f0c64a",
              lw: 2 * scale,
              seed: seed + i * 11 + c,
              rough: 0.6,
            });
          }
        }
      }
      break;
    }
    case "sand": {
      stipple(ctx, bounds, {
        color: alpha(biome.detail || "#c79a4e", 0.4),
        count: 140,
        radius: 2.1,
        seed: seed + 5,
      });
      decorSpots(seed + 3, 8, bounds, keepClear * 0.75).forEach((spot) => {
        // Ripples in the sand: flat dashes, never a shadow.
        const span = (30 + noise(spot.seed, 8) * 26) * scale;
        inkLine(
          ctx,
          [
            { x: spot.x - span, y: spot.y },
            { x: spot.x, y: spot.y - 6 * scale },
            { x: spot.x + span, y: spot.y },
          ],
          { stroke: alpha(biome.detail || "#c79a4e", 0.6), lw: 3 * scale, seed: spot.seed, rough: 1 }
        );
      });
      scatterTufts(ctx, bounds, {
        count: 6,
        color: alpha("#8faa55", 0.85),
        scale: scale * 0.9,
        seed: seed + 91,
      });
      break;
    }
    default:
      break;
  }
}

// ============================================================================
// The dock — the island's front door, and the only scene with a horizon
// ============================================================================

function drawDockScene(ctx, frame, biome, seed) {
  const { x, y, width, height } = frame;
  const shoreBottom = y + height * 0.36;
  const sandBottom = y + height * DOCK_SAND_BOTTOM;

  ctx.fillStyle = biome.water;
  ctx.fillRect(x, y, width, height);

  inkShape(
    ctx,
    [
      { x: x - 4, y: y - 4 },
      { x: x + width + 4, y: y - 4 },
      { x: x + width + 4, y: shoreBottom },
      { x: x - 4, y: shoreBottom },
    ],
    { fill: biome.ground, lw: 0, seed, rough: 2 }
  );
  inkShape(
    ctx,
    [
      { x: x - 4, y: shoreBottom - 6 },
      { x: x + width + 4, y: shoreBottom - 6 },
      { x: x + width + 4, y: sandBottom },
      { x: x - 4, y: sandBottom },
    ],
    { fill: biome.sand, lw: 0, seed: seed + 1, rough: 2.4 }
  );

  scatterTufts(ctx, { x: x + 20, y: y + 16, width: width - 40, height: shoreBottom - y - 40 }, {
    count: 12,
    color: alpha(biome.detail, 0.5),
    scale: 0.85,
    seed: seed + 9,
  });
  stipple(ctx, { x, y: shoreBottom - 4, width, height: sandBottom - shoreBottom + 4 }, {
    color: alpha("#c79a4e", 0.4),
    count: 40,
    radius: 2,
    seed: seed + 13,
  });

}

/**
 * The pier, running down the middle into the water. Drawn with the animated
 * water rather than into the cached layer, so the drifting waves pass behind
 * it instead of washing over the planks.
 */
function drawDockPier(ctx, frame, biome, seed) {
  const sandBottom = frame.y + frame.height * DOCK_SAND_BOTTOM;
  const pierWidth = Math.max(86, frame.width * 0.19);
  const pierTop = sandBottom - 10;
  const pierBottom = frame.y + frame.height - 6;
  const centreX = frame.x + frame.width / 2;
  inkShape(
    ctx,
    [
      { x: centreX - pierWidth * 0.4, y: pierTop },
      { x: centreX + pierWidth * 0.4, y: pierTop },
      { x: centreX + pierWidth * 0.62, y: pierBottom },
      { x: centreX - pierWidth * 0.62, y: pierBottom },
    ],
    { fill: biome.wood, lw: 4, seed: seed + 21, rough: 1.6 }
  );
  const plankCount = 6;
  for (let i = 1; i < plankCount; i += 1) {
    const t = i / plankCount;
    const halfWidth = lerp(pierWidth * 0.4, pierWidth * 0.62, t);
    const py = lerp(pierTop, pierBottom, t);
    inkLine(
      ctx,
      [
        { x: centreX - halfWidth, y: py },
        { x: centreX + halfWidth, y: py },
      ],
      { stroke: alpha(biome.woodDeep, 0.8), lw: 3, seed: seed + 30 + i, rough: 0.8 }
    );
  }
}

// ============================================================================
// Paths
// ============================================================================

function pathThickness(frame) {
  return clamp(Math.min(frame.width, frame.height) * 0.14, 48, 108);
}

function buildPathOutline(directions, frame, thickness) {
  const centre = { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };
  const half = thickness / 2;
  const has = (direction) => directions.includes(direction);

  const north = frame.y - 4;
  const south = frame.y + frame.height + 4;
  const west = frame.x - 4;
  const east = frame.x + frame.width + 4;

  const topLeft = { x: centre.x - half, y: centre.y - half };
  const topRight = { x: centre.x + half, y: centre.y - half };
  const bottomRight = { x: centre.x + half, y: centre.y + half };
  const bottomLeft = { x: centre.x - half, y: centre.y + half };

  const outline = [topLeft];
  if (has("north")) {
    outline.push({ x: topLeft.x, y: north }, { x: topRight.x, y: north }, topRight);
  } else {
    outline.push(topRight);
  }
  if (has("east")) {
    outline.push({ x: east, y: topRight.y }, { x: east, y: bottomRight.y }, bottomRight);
  } else {
    outline.push(bottomRight);
  }
  if (has("south")) {
    outline.push({ x: bottomRight.x, y: south }, { x: bottomLeft.x, y: south }, bottomLeft);
  } else {
    outline.push(bottomLeft);
  }
  if (has("west")) {
    outline.push({ x: west, y: bottomLeft.y }, { x: west, y: topLeft.y });
  }
  return outline;
}

function drawPaths(ctx, directions, frame, biome, seed) {
  if (!directions.length) return;
  const thickness = pathThickness(frame);
  const outline = buildPathOutline(directions, frame, thickness);
  const trail = mix(PAPER_DEEP, biome.ground || "#cbb994", 0.18);
  inkShape(ctx, outline, {
    fill: trail,
    stroke: alpha(INK, 0.7),
    lw: 3.5,
    seed: seed + 77,
    rough: 2.2,
  });

  // Stepping dots down the middle of each arm, so direction reads at a glance.
  const centre = { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };
  directions.forEach((direction, armIndex) => {
    const vector = DIRECTION_VECTORS[direction];
    const reach =
      direction === "north" || direction === "south" ? frame.height / 2 : frame.width / 2;
    const steps = Math.max(2, Math.round(reach / 52));
    for (let i = 1; i <= steps; i += 1) {
      const t = i / (steps + 0.4);
      const px = centre.x + vector.x * reach * t;
      const py = centre.y + vector.y * reach * t;
      inkCircle(ctx, px, py, 4.6, {
        fill: alpha(INK, 0.2),
        lw: 0,
        seed: seed + armIndex * 13 + i,
        rough: 0.5,
      });
    }
  });
}

// ============================================================================
// Adjacency hints
//
// visual-v1: "flat shapes using the adjacent node's dominant colour, limited to
// a small area near the path". Drawn as a doorway in the frame edge, so the
// neighbouring land reads as literally showing through the opening.
// ============================================================================

function drawAdjacencyHint(ctx, direction, frame, neighborColor, seed) {
  const thickness = pathThickness(frame);
  const half = thickness / 2 + 3;
  const depth = 30;
  const centre = { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };
  const over = 24;
  let points;

  if (direction === "north") {
    const edge = frame.y;
    points = [
      { x: centre.x - half, y: edge - over },
      { x: centre.x + half, y: edge - over },
      { x: centre.x + half, y: edge + depth },
      { x: centre.x - half, y: edge + depth },
    ];
  } else if (direction === "south") {
    const edge = frame.y + frame.height;
    points = [
      { x: centre.x - half, y: edge - depth },
      { x: centre.x + half, y: edge - depth },
      { x: centre.x + half, y: edge + over },
      { x: centre.x - half, y: edge + over },
    ];
  } else if (direction === "west") {
    const edge = frame.x;
    points = [
      { x: edge - over, y: centre.y - half },
      { x: edge + depth, y: centre.y - half },
      { x: edge + depth, y: centre.y + half },
      { x: edge - over, y: centre.y + half },
    ];
  } else {
    const edge = frame.x + frame.width;
    points = [
      { x: edge - depth, y: centre.y - half },
      { x: edge + over, y: centre.y - half },
      { x: edge + over, y: centre.y + half },
      { x: edge - depth, y: centre.y + half },
    ];
  }

  inkShape(ctx, points, {
    fill: neighborColor,
    stroke: alpha(INK, 0.6),
    lw: 3,
    seed,
    rough: 1.8,
  });
}

// ============================================================================
// Features
// ============================================================================

/**
 * A brilliant-cut gem: flat table on top, girdle across the middle, pointed
 * pavilion below, and the facet lines that make it read as a cut stone rather
 * than a coloured shape.
 *
 * `size` is half the gem's height, so the whole stone fits 2*size — the same
 * bounding box the old diamond used.
 */
function paintGem(ctx, x, y, size, body, facet, seed, twinkle) {
  // Line weight follows the gem, so a small one is not all outline.
  const lw = clamp(size / 6, 2, 4);
  // Facet lines have to survive at the size the gem is actually played at, so
  // they get a floor rather than a pure proportion.
  const facetLine = Math.max(1.8, lw * 0.55);
  const facetInk = alpha(INK, 0.6);

  const tableHalf = size * 0.46;
  const girdleHalf = size * 0.92;
  const tableY = y - size;
  const girdleY = y - size * 0.28;
  const pointY = y + size;

  inkShape(
    ctx,
    [
      { x: x - tableHalf, y: tableY },
      { x: x + tableHalf, y: tableY },
      { x: x + girdleHalf, y: girdleY },
      { x, y: pointY },
      { x: x - girdleHalf, y: girdleY },
    ],
    { fill: body, lw, seed, rough: 0.7 }
  );

  // The table catches the light — one flat lighter facet, never a gradient.
  inkShape(
    ctx,
    [
      { x: x - tableHalf, y: tableY },
      { x: x + tableHalf, y: tableY },
      { x: x + tableHalf, y: girdleY },
      { x: x - tableHalf, y: girdleY },
    ],
    { fill: facet, stroke: facetInk, lw: facetLine, seed: seed + 3, rough: 0.5 }
  );

  // Girdle, then the pavilion facets fanning down to the point.
  inkLine(
    ctx,
    [
      { x: x - girdleHalf, y: girdleY },
      { x: x + girdleHalf, y: girdleY },
    ],
    { stroke: facetInk, lw: facetLine, seed: seed + 5, rough: 0.4 }
  );
  [-1, 1].forEach((side) => {
    inkLine(
      ctx,
      [
        { x: x + side * tableHalf, y: girdleY },
        { x, y: pointY },
      ],
      { stroke: facetInk, lw: facetLine, seed: seed + 7 + side, rough: 0.4 }
    );
  });

  const sparkle = 0.55 + Math.sin(twinkle * 2.4 + seed) * 0.45;
  ctx.save();
  ctx.globalAlpha = sparkle;
  inkStar(ctx, x + size * 0.95, y - size * 0.85, size * 0.33 * (0.7 + sparkle * 0.5), {
    points: 4,
    inner: size * 0.09,
    fill: PAPER,
    lw: clamp(size / 12, 1.2, 2),
    seed: seed + 11,
  });
  ctx.restore();
}

function drawGemFeature(ctx, feature, twinkle) {
  const { slot, color } = feature;
  const size = 24;
  const body = color?.fill ?? "#e8615a";
  const facet = color?.stroke ?? mix(body, PAPER, 0.45);
  groundPatch(ctx, slot.x, slot.y + size * 0.98, size * 0.95, feature.biome, feature.seed);
  paintGem(ctx, slot.x, slot.y, size, body, facet, feature.seed, twinkle);
}

function drawShellFeature(ctx, feature) {
  const { x, y } = feature.slot;
  const seed = feature.seed;
  const radius = 22;
  groundPatch(ctx, x, y + radius * 0.7, radius * 1.3, feature.biome, seed);
  const points = [{ x: x - radius, y: y + radius * 0.5 }];
  for (let i = 0; i <= 10; i += 1) {
    const angle = Math.PI + (i / 10) * Math.PI;
    points.push({
      x: x + Math.cos(angle) * radius,
      y: y + radius * 0.5 + Math.sin(angle) * radius,
    });
  }
  inkShape(ctx, points, { fill: "#f6d9b0", lw: 3.6, seed, rough: 0.9 });
  for (let i = -2; i <= 2; i += 1) {
    inkLine(
      ctx,
      [
        { x: x + i * 5, y: y + radius * 0.45 },
        { x: x + i * 8.5, y: y - radius * 0.5 },
      ],
      { stroke: alpha("#b4793a", 0.7), lw: 2.2, seed: seed + i + 5, rough: 0.5 }
    );
  }
}

function drawPebbleFeature(ctx, feature) {
  const { x, y } = feature.slot;
  const seed = feature.seed;
  groundPatch(ctx, x, y + 12, 26, feature.biome, seed);
  inkEllipse(ctx, x, y, 21, 15, { fill: "#c3cad6", lw: 3.6, seed, rough: 1.4 });
  inkEllipse(ctx, x - 6, y - 4, 7, 4, { fill: "#dde3eb", lw: 0, seed: seed + 2, rough: 0.6 });
}

function drawPineconeFeature(ctx, feature) {
  const { x, y } = feature.slot;
  const seed = feature.seed;
  groundPatch(ctx, x, y + 20, 24, feature.biome, seed);
  inkEllipse(ctx, x, y, 15, 22, { fill: "#a9702f", lw: 3.4, seed, rough: 1 });
  for (let row = -2; row <= 2; row += 1) {
    inkLine(
      ctx,
      [
        { x: x - 11, y: y + row * 7 + 2 },
        { x, y: y + row * 7 - 2 },
        { x: x + 11, y: y + row * 7 + 2 },
      ],
      { stroke: alpha("#5d3a14", 0.75), lw: 2.2, seed: seed + row + 4, rough: 0.5 }
    );
  }
}

function drawWildflowerFeature(ctx, feature) {
  const { x, y } = feature.slot;
  const seed = feature.seed;
  groundPatch(ctx, x, y + 22, 24, feature.biome, seed);
  inkLine(
    ctx,
    [
      { x, y: y + 22 },
      { x, y: y - 6 },
    ],
    { stroke: "#4c8b34", lw: 3.4, seed, rough: 0.8 }
  );
  inkShape(
    ctx,
    [
      { x: x + 2, y: y + 8 },
      { x: x + 15, y: y + 2 },
      { x: x + 4, y: y + 15 },
    ],
    { fill: "#4c8b34", lw: 2.4, seed: seed + 1, rough: 0.6 }
  );
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2;
    inkEllipse(ctx, x + Math.cos(angle) * 11, y - 10 + Math.sin(angle) * 11, 7.5, 6, {
      fill: "#f2a516",
      lw: 2.4,
      rotation: angle,
      seed: seed + i + 2,
      rough: 0.5,
    });
  }
  inkCircle(ctx, x, y - 10, 6, { fill: "#f6e3c4", lw: 2.4, seed: seed + 11, rough: 0.5 });
}

function drawCarrotFeature(ctx, feature) {
  const { x, y } = feature.slot;
  const seed = feature.seed;
  groundPatch(ctx, x, y + 20, 26, feature.biome, seed);
  inkShape(
    ctx,
    [
      { x: x - 13, y: y - 8 },
      { x: x + 13, y: y - 8 },
      { x, y: y + 26 },
    ],
    { fill: "#ef8135", lw: 3.6, seed, rough: 0.9 }
  );
  for (let i = -1; i <= 1; i += 1) {
    inkLine(
      ctx,
      [
        { x: x + i * 6, y: y - 2 },
        { x: x + i * 9, y: y + 4 },
      ],
      { stroke: alpha("#b8501a", 0.8), lw: 2, seed: seed + i + 3, rough: 0.4 }
    );
  }
  [-1, 0, 1].forEach((i) => {
    inkLine(
      ctx,
      [
        { x, y: y - 8 },
        { x: x + i * 11, y: y - 26 },
      ],
      { stroke: "#4c8b34", lw: 3.4, seed: seed + i + 7, rough: 0.8 }
    );
  });
}

function paintSign(ctx, feature, boardColor, postColor) {
  const { x, y } = feature.slot;
  const seed = feature.seed;
  groundPatch(ctx, x, y + 40, 30, feature.biome, seed);
  inkShape(
    ctx,
    [
      { x: x - 6, y: y - 4 },
      { x: x + 6, y: y - 4 },
      { x: x + 5, y: y + 42 },
      { x: x - 5, y: y + 42 },
    ],
    { fill: postColor, lw: 3.2, seed, rough: 0.8 }
  );
  inkRect(ctx, x - 40, y - 34, 80, 40, {
    fill: boardColor,
    lw: 4,
    radius: 7,
    seed: seed + 2,
    rough: 1.2,
  });
  [0, 1, 2].forEach((row) => {
    const width = row === 2 ? 34 : 52;
    inkLine(
      ctx,
      [
        { x: x - width / 2, y: y - 24 + row * 10 },
        { x: x + width / 2, y: y - 24 + row * 10 },
      ],
      { stroke: alpha(INK, 0.5), lw: 2.6, seed: seed + row + 4, rough: 0.5 }
    );
  });
}

function drawSignFeature(ctx, feature) {
  paintSign(ctx, feature, "#f2d79c", "#a9702f");
}

function drawCaveSignFeature(ctx, feature) {
  paintSign(ctx, feature, "#d6cbb4", "#7b6a51");
}

function drawPersonFeature(ctx, feature, time) {
  const { x, y } = feature.slot;
  const seed = feature.seed;
  const palettes = [
    { shirt: "#5bb0d6", hat: "#e8615a", skin: "#f0cba6" },
    { shirt: "#f2a516", hat: "#3f9052", skin: "#c98d52" },
    { shirt: "#b78ad6", hat: "#5bb0d6", skin: "#f3d7b8" },
    { shirt: "#7fbf6a", hat: "#f2d79c", skin: "#8a5f3c" },
  ];
  const palette = palettes[seed % palettes.length];
  const bob = Math.sin(time * 1.6 + seed) * 2;

  groundPatch(ctx, x, y + 44, 30, feature.biome, seed);
  ctx.save();
  ctx.translate(0, bob);

  // legs
  inkShape(ctx, [{ x: x - 11, y: y + 18 }, { x: x - 3, y: y + 18 }, { x: x - 3, y: y + 44 }, { x: x - 11, y: y + 44 }], {
    fill: "#4a6a8a",
    lw: 3,
    seed: seed + 1,
    rough: 0.6,
  });
  inkShape(ctx, [{ x: x + 3, y: y + 18 }, { x: x + 11, y: y + 18 }, { x: x + 11, y: y + 44 }, { x: x + 3, y: y + 44 }], {
    fill: "#4a6a8a",
    lw: 3,
    seed: seed + 2,
    rough: 0.6,
  });
  // body
  inkRect(ctx, x - 17, y - 8, 34, 30, { fill: palette.shirt, lw: 3.6, radius: 9, seed: seed + 3, rough: 0.9 });
  // arms
  inkRect(ctx, x - 25, y - 4, 9, 22, { fill: palette.skin, lw: 3, radius: 4.5, seed: seed + 4, rough: 0.6 });
  inkRect(ctx, x + 16, y - 4, 9, 22, { fill: palette.skin, lw: 3, radius: 4.5, seed: seed + 5, rough: 0.6 });
  // head
  inkCircle(ctx, x, y - 24, 16, { fill: palette.skin, lw: 3.6, seed: seed + 6, rough: 0.8 });
  // hat
  inkShape(
    ctx,
    [
      { x: x - 24, y: y - 32 },
      { x: x + 24, y: y - 32 },
      { x: x + 14, y: y - 38 },
      { x: x - 14, y: y - 38 },
    ],
    { fill: palette.hat, lw: 3.2, seed: seed + 7, rough: 0.7 }
  );
  inkShape(
    ctx,
    [
      { x: x - 13, y: y - 38 },
      { x: x + 13, y: y - 38 },
      { x: x + 10, y: y - 50 },
      { x: x - 10, y: y - 50 },
    ],
    { fill: palette.hat, lw: 3.2, seed: seed + 8, rough: 0.7 }
  );
  // face
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(x - 6, y - 26, 2.3, 0, Math.PI * 2);
  ctx.arc(x + 6, y - 26, 2.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y - 21, 6, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();
}

function drawShipFeature(ctx, feature, time) {
  const { x, y } = feature.slot;
  const seed = feature.seed;
  const rock = Math.sin(time * 1.1 + seed) * 0.035;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rock);

  inkShape(
    ctx,
    [
      { x: -62, y: -6 },
      { x: 62, y: -6 },
      { x: 44, y: 34 },
      { x: -44, y: 34 },
    ],
    { fill: "#c9603f", lw: 4.5, seed, rough: 1.2 }
  );
  inkLine(
    ctx,
    [
      { x: -56, y: 6 },
      { x: 56, y: 6 },
    ],
    { stroke: alpha(INK, 0.55), lw: 3, seed: seed + 1, rough: 0.8 }
  );
  inkShape(
    ctx,
    [
      { x: -4, y: -8 },
      { x: 4, y: -8 },
      { x: 4, y: -78 },
      { x: -4, y: -78 },
    ],
    { fill: "#a9702f", lw: 3.2, seed: seed + 2, rough: 0.6 }
  );
  inkShape(
    ctx,
    [
      { x: 6, y: -74 },
      { x: 52, y: -44 },
      { x: 6, y: -16 },
    ],
    { fill: PAPER, lw: 4, seed: seed + 3, rough: 1.2 }
  );
  inkShape(
    ctx,
    [
      { x: -6, y: -70 },
      { x: -40, y: -46 },
      { x: -6, y: -22 },
    ],
    { fill: "#f2d79c", lw: 4, seed: seed + 4, rough: 1.2 }
  );
  inkShape(
    ctx,
    [
      { x: -4, y: -86 },
      { x: 26, y: -80 },
      { x: -4, y: -74 },
    ],
    { fill: "#e8615a", lw: 2.6, seed: seed + 5, rough: 0.6 }
  );
  ctx.restore();
}

function drawSandcastleFeature(ctx, feature) {
  const { x, y } = feature.slot;
  const seed = feature.seed;
  groundPatch(ctx, x, y + 26, 40, feature.biome, seed);
  inkRect(ctx, x - 26, y - 2, 52, 28, { fill: "#edc784", lw: 3.6, radius: 4, seed, rough: 1 });
  [-1, 1].forEach((side) => {
    inkRect(ctx, x + side * 26 - 11, y - 20, 22, 46, {
      fill: "#f2d79c",
      lw: 3.6,
      radius: 4,
      seed: seed + side + 3,
      rough: 1,
    });
  });
  inkLine(
    ctx,
    [
      { x, y: y - 2 },
      { x, y: y - 26 },
    ],
    { stroke: "#a9702f", lw: 3, seed: seed + 6, rough: 0.6 }
  );
  inkShape(
    ctx,
    [
      { x: x + 2, y: y - 26 },
      { x: x + 22, y: y - 20 },
      { x: x + 2, y: y - 14 },
    ],
    { fill: "#e8615a", lw: 2.6, seed: seed + 7, rough: 0.5 }
  );
}

function drawOwlFeature(ctx, feature, time) {
  const { x, y } = feature.slot;
  const seed = feature.seed;
  // Blinks roughly every eight seconds (2*pi / 0.8).
  const blink = Math.sin(time * 0.8 + seed) > 0.97;
  groundPatch(ctx, x, y + 28, 28, feature.biome, seed);
  inkEllipse(ctx, x, y, 24, 30, { fill: "#b07d44", lw: 4, seed, rough: 1.2 });
  inkShape(
    ctx,
    [
      { x: x - 17, y: y - 20 },
      { x: x - 5, y: y - 30 },
      { x: x - 3, y: y - 16 },
    ],
    { fill: "#b07d44", lw: 3.2, seed: seed + 1, rough: 0.6 }
  );
  inkShape(
    ctx,
    [
      { x: x + 17, y: y - 20 },
      { x: x + 5, y: y - 30 },
      { x: x + 3, y: y - 16 },
    ],
    { fill: "#b07d44", lw: 3.2, seed: seed + 2, rough: 0.6 }
  );
  inkCircle(ctx, x - 9, y - 8, 10, { fill: PAPER, lw: 3, seed: seed + 3, rough: 0.6 });
  inkCircle(ctx, x + 9, y - 8, 10, { fill: PAPER, lw: 3, seed: seed + 4, rough: 0.6 });
  if (!blink) {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(x - 9, y - 8, 4, 0, Math.PI * 2);
    ctx.arc(x + 9, y - 8, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  inkShape(
    ctx,
    [
      { x: x - 4, y: y + 1 },
      { x: x + 4, y: y + 1 },
      { x, y: y + 9 },
    ],
    { fill: "#f2a516", lw: 2.4, seed: seed + 5, rough: 0.4 }
  );
}

function drawKiteFeature(ctx, feature, time) {
  const { x, y } = feature.slot;
  const seed = feature.seed;
  const sway = Math.sin(time * 1.3 + seed) * 6;
  ctx.save();
  ctx.translate(sway, Math.cos(time * 1.1 + seed) * 4);
  inkShape(
    ctx,
    [
      { x, y: y - 30 },
      { x: x + 24, y },
      { x, y: y + 30 },
      { x: x - 24, y },
    ],
    { fill: "#5bb0d6", lw: 4, seed, rough: 0.8 }
  );
  inkLine(
    ctx,
    [
      { x, y: y - 30 },
      { x, y: y + 30 },
    ],
    { stroke: alpha(INK, 0.5), lw: 2.4, seed: seed + 1, rough: 0.4 }
  );
  inkLine(
    ctx,
    [
      { x: x - 24, y },
      { x: x + 24, y },
    ],
    { stroke: alpha(INK, 0.5), lw: 2.4, seed: seed + 2, rough: 0.4 }
  );
  const tail = [];
  for (let i = 0; i <= 5; i += 1) {
    tail.push({ x: x + Math.sin(time * 2 + i * 0.8) * i * 2.4, y: y + 30 + i * 9 });
  }
  inkLine(ctx, tail, { stroke: INK, lw: 2.4, seed: seed + 3, rough: 0.4 });
  [1, 3, 5].forEach((i) => {
    inkShape(
      ctx,
      [
        { x: tail[i].x - 7, y: tail[i].y - 4 },
        { x: tail[i].x + 7, y: tail[i].y },
        { x: tail[i].x - 7, y: tail[i].y + 4 },
      ],
      { fill: "#e8615a", lw: 2, seed: seed + i + 6, rough: 0.3 }
    );
  });
  ctx.restore();
}

function drawTractorFeature(ctx, feature) {
  const { x, y } = feature.slot;
  const seed = feature.seed;
  groundPatch(ctx, x, y + 30, 48, feature.biome, seed);
  inkRect(ctx, x - 32, y - 6, 62, 26, { fill: "#3f9052", lw: 4, radius: 6, seed, rough: 1 });
  inkRect(ctx, x - 8, y - 28, 30, 24, { fill: "#4faa62", lw: 3.6, radius: 5, seed: seed + 1, rough: 0.8 });
  inkRect(ctx, x - 3, y - 24, 18, 14, { fill: "#bfe0ea", lw: 2.6, radius: 3, seed: seed + 2, rough: 0.6 });
  inkCircle(ctx, x - 19, y + 22, 13, { fill: "#4a4038", lw: 3.6, seed: seed + 3, rough: 0.7 });
  inkCircle(ctx, x - 19, y + 22, 5, { fill: "#f2d79c", lw: 2.4, seed: seed + 4, rough: 0.4 });
  inkCircle(ctx, x + 21, y + 18, 18, { fill: "#4a4038", lw: 3.6, seed: seed + 5, rough: 0.8 });
  inkCircle(ctx, x + 21, y + 18, 7, { fill: "#f2d79c", lw: 2.4, seed: seed + 6, rough: 0.4 });
}

function drawPlaceholderFeature(ctx, feature) {
  const { x, y } = feature.slot;
  inkCircle(ctx, x, y, 20, { fill: PAPER_DEEP, lw: 3.4, seed: feature.seed, rough: 1.2 });
  inkText(ctx, "?", x, y + 1, { size: 22, color: INK });
}

const FEATURE_PAINTERS = {
  ship: drawShipFeature,
  gem: drawGemFeature,
  shell: drawShellFeature,
  pebble: drawPebbleFeature,
  pinecone: drawPineconeFeature,
  wildflower: drawWildflowerFeature,
  carrot: drawCarrotFeature,
  sign: drawSignFeature,
  cave_sign: drawCaveSignFeature,
  person: drawPersonFeature,
  sandcastle: drawSandcastleFeature,
  owl: drawOwlFeature,
  kite: drawKiteFeature,
  tractor: drawTractorFeature,
};

export function drawFeatures(ctx, features, time) {
  features
    .slice()
    .sort((a, b) => a.slot.y - b.slot.y)
    .forEach((feature) => {
      const painter = FEATURE_PAINTERS[feature.type] || drawPlaceholderFeature;
      const scale = feature.scale ?? 1;
      ctx.save();
      // Scale about the feature's own anchor so its slot stays put.
      ctx.translate(feature.slot.x, feature.slot.y);
      ctx.scale(scale, scale);
      ctx.translate(-feature.slot.x, -feature.slot.y);
      painter(ctx, feature, time);
      ctx.restore();
    });
}

// ============================================================================
// Feature placement
// ============================================================================

function allocateSlots(features, slotsById) {
  const allocation = new Map();
  const assignable = features.filter((feature) => feature.type !== "ship" && feature.id);
  const used = new Set();

  assignable.forEach((feature) => {
    if (feature.slotId && slotsById.has(feature.slotId)) {
      allocation.set(feature.id, slotsById.get(feature.slotId));
      used.add(feature.slotId);
    }
  });

  const remainingSlots = Array.from(slotsById.values()).filter((slot) => !used.has(slot.id));
  assignable
    .filter((feature) => !allocation.has(feature.id))
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .forEach((feature, index) => {
      const slot = remainingSlots[index];
      if (slot) allocation.set(feature.id, slot);
    });
  return allocation;
}

export function placeFeatures(features, frame, isFeatureVisible) {
  const slots = SLOT_POSITIONS.map((slot) => ({ id: slot.id, ...framePoint(frame, slot.u, slot.v) }));
  const slotsById = new Map(slots.map((slot) => [slot.id, slot]));
  const allocation = allocateSlots(features, slotsById);
  const shipSlot = framePoint(frame, 0.63, 0.76);
  const baseScale = clamp(Math.min(frame.width, frame.height) / 540, 0.8, 1.25);

  const layout = [];
  features.forEach((feature) => {
    const isShip = feature.type === "ship";
    const slot = isShip ? shipSlot : allocation.get(feature.id);
    if (!slot) return;
    if (!isFeatureVisible(feature)) return;
    layout.push({ ...feature, slot, scale: baseScale * (isShip ? 1.35 : 1) });
  });
  return layout;
}

// ============================================================================
// Prompt labels
// ============================================================================

function promptWidth(ctx, text) {
  return Math.max(PROMPT_MIN_WIDTH, measureText(ctx, text, PROMPT_FONT, 800) + PROMPT_PAD_X * 2);
}

/**
 * How much of this prompt the player has already typed.
 * Returns -1 when the buffer is not a prefix of the prompt.
 */
function typedProgress(prompt, buffer) {
  if (!buffer) return 0;
  return prompt.startsWith(buffer) ? buffer.length : -1;
}

/**
 * The core typing affordance: the prompt shows its own progress. Letters
 * already typed are filled in and highlighted, so the player watches the word
 * complete where they are already looking instead of down in a text field.
 */
function drawPromptLabel(ctx, text, cx, cy, opts = {}) {
  const { buffer = "", isHighlighted = false, tail = null, pop = 0, faded = false } = opts;
  const matched = typedProgress(text, buffer);
  const isComplete = matched === text.length && text.length > 0;
  const scale = 1 + pop * 0.08 + (isComplete ? 0.04 : 0);

  const width = promptWidth(ctx, text);
  const height = PROMPT_HEIGHT;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  if (faded) ctx.globalAlpha = 0.45;

  const x = -width / 2;
  const y = -height / 2;

  // Nub pointing at the thing this prompt acts on.
  if (tail) {
    const dir = tail === "up" ? -1 : 1;
    inkShape(
      ctx,
      [
        { x: -11, y: dir * (height / 2 - 2) },
        { x: 11, y: dir * (height / 2 - 2) },
        { x: 0, y: dir * (height / 2 + 12) },
      ],
      { fill: isComplete ? READY : PAPER, lw: 3.4, seed: 91, rough: 0.4 }
    );
  }

  inkRect(ctx, x, y, width, height, {
    fill: isComplete ? READY : PAPER,
    stroke: INK,
    lw: isHighlighted || isComplete ? 4.6 : 3.6,
    radius: height / 2,
    seed: seedFromString(text) + 3,
    rough: 1,
  });

  // Fill the portion already typed.
  if (matched > 0 && !isComplete) {
    const ratio = matched / text.length;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width * ratio, height);
    ctx.clip();
    inkRect(ctx, x, y, width, height, {
      fill: alpha(HIGHLIGHT, 0.45),
      lw: 0,
      radius: height / 2,
      seed: seedFromString(text) + 3,
      rough: 1,
    });
    ctx.restore();
  }

  // The word, then the typed letters overdrawn in the highlight colour.
  const textWidth = measureText(ctx, text, PROMPT_FONT, 800);
  const left = -textWidth / 2;
  ctx.font = font(PROMPT_FONT, 800);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = isComplete ? PAPER : INK;
  ctx.fillText(text, left, 1);
  if (matched > 0 && !isComplete) {
    ctx.fillStyle = mix(INK, ALERT, 0.75);
    ctx.fillText(text.slice(0, matched), left, 1);
  }

  ctx.restore();
  return { width: width * scale, height: height * scale };
}

function labelRect(ctx, text, cx, cy) {
  const width = promptWidth(ctx, text);
  return {
    x: cx - width / 2 - 6,
    y: cy - PROMPT_HEIGHT / 2 - 6,
    width: width + 12,
    height: PROMPT_HEIGHT + 12,
  };
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/**
 * Picks a spot for a feature's prompt: its preferred side first, then the other
 * side, then a sideways nudge away from the centre line — whichever is the
 * first to land clear of every label already placed.
 */
function placePromptNear(ctx, text, feature, frame, claimed) {
  const anchor = PROMPT_ANCHORS[feature.type] || PROMPT_ANCHORS.default;
  const scale = feature.scale ?? 1;
  const preferBelow =
    anchor.prefer === "below" || feature.slot.y < frame.y + frame.height * 0.58;
  const minY = frame.y + 34;
  const maxY = frame.y + frame.height - 34;
  const awayFromCentre = feature.slot.x < frame.x + frame.width / 2 ? -1 : 1;

  const sideFor = (below) => {
    const wanted = feature.slot.y + (below ? anchor.below : -anchor.above) * scale;
    const y = clamp(wanted, minY, maxY);
    return {
      y,
      tail: below ? "up" : "down",
      // A candidate the frame had to drag back into view is no longer clear of
      // the art it labels, so it is only a fallback.
      clamped: Math.abs(wanted - y) > 4,
    };
  };
  const sides = [sideFor(preferBelow), sideFor(!preferBelow)];

  // Tried in order of how well the label stays attached to its object: both
  // sides directly above/below first (those keep the nub), then sideways —
  // inward before outward, since the movement prompts live at the edges.
  const candidates = [];
  sides.forEach((side) => {
    candidates.push({ x: feature.slot.x, y: side.y, tail: side.tail, clamped: side.clamped });
  });
  [-awayFromCentre, awayFromCentre].forEach((direction) => {
    sides.forEach((side) => {
      candidates.push({
        x: feature.slot.x + direction * 70 * scale,
        y: side.y,
        tail: null,
        clamped: side.clamped,
      });
    });
  });

  const isClear = (candidate) => {
    const rect = labelRect(ctx, text, candidate.x, candidate.y);
    return !claimed.some((other) => rectsOverlap(rect, other));
  };
  const chosen =
    candidates.find((candidate) => !candidate.clamped && isClear(candidate)) ||
    candidates.find(isClear) ||
    candidates[0];
  const x = clamp(
    chosen.x,
    frame.x + promptWidth(ctx, text) / 2 + 8,
    frame.x + frame.width - promptWidth(ctx, text) / 2 - 8
  );
  return { x, y: chosen.y, tail: chosen.tail, rect: labelRect(ctx, text, x, chosen.y) };
}

const DIRECTION_CHEVRON = {
  north: [{ x: -9, y: 5 }, { x: 0, y: -6 }, { x: 9, y: 5 }],
  south: [{ x: -9, y: -5 }, { x: 0, y: 6 }, { x: 9, y: -5 }],
  west: [{ x: 5, y: -9 }, { x: -6, y: 0 }, { x: 5, y: 9 }],
  east: [{ x: -5, y: -9 }, { x: 6, y: 0 }, { x: -5, y: 9 }],
};

function movementPromptPosition(direction, frame) {
  const inset = PROMPT_HEIGHT / 2 + 42;
  switch (direction) {
    case "north":
      return { x: frame.x + frame.width / 2, y: frame.y + inset };
    case "south":
      return { x: frame.x + frame.width / 2, y: frame.y + frame.height - inset };
    case "west":
      return { x: frame.x + inset + 30, y: frame.y + frame.height / 2 };
    case "east":
      return { x: frame.x + frame.width - inset - 30, y: frame.y + frame.height / 2 };
    default:
      return null;
  }
}

function drawMovementPrompt(ctx, action, direction, frame, opts) {
  const position = movementPromptPosition(direction, frame);
  if (!position) return;
  const size = drawPromptLabel(ctx, action.prompt, position.x, position.y, opts);

  // A chevron on the outward side, so direction reads without reading.
  const vector = DIRECTION_VECTORS[direction];
  const offsetX = vector.x * (size.width / 2 + 16);
  const offsetY = vector.y * (size.height / 2 + 16);
  ctx.save();
  ctx.translate(position.x + offsetX, position.y + offsetY);
  inkShape(ctx, DIRECTION_CHEVRON[direction], {
    fill: alpha(INK, 0.65),
    lw: 0,
    seed: 17,
    rough: 0.3,
  });
  ctx.restore();
}

// ============================================================================
// Effects
// ============================================================================

function drawEffects(ctx, effects, time) {
  effects.forEach((effect) => {
    const age = time - effect.start;
    const life = effect.duration ?? 0.9;
    if (age < 0 || age > life) return;
    const t = age / life;
    const fade = 1 - easeOut(t);
    ctx.save();
    ctx.globalAlpha = fade;
    const count = effect.count ?? 8;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + effect.seed;
      const distance = easeOut(t) * (46 + noise(effect.seed + i, 3) * 34);
      const x = effect.x + Math.cos(angle) * distance;
      const y = effect.y + Math.sin(angle) * distance - easeOut(t) * 16;
      inkStar(ctx, x, y, 8 * (1 - t * 0.5), {
        points: 4,
        inner: 2,
        fill: effect.color ?? HIGHLIGHT,
        lw: 2,
        seed: effect.seed + i,
      });
    }
    ctx.restore();
  });
}

// ============================================================================
// Win screen
// ============================================================================

function drawWinScreen(ctx, width, height, frame, successAction, time, buffer) {
  ctx.save();
  ctx.fillStyle = PAPER;
  roundedFramePath(ctx, frame);
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundedFramePath(ctx, frame);
  ctx.clip();

  // Confetti raining down the page.
  for (let i = 0; i < 46; i += 1) {
    const speed = 40 + noise(i, 2) * 70;
    const x = frame.x + noise(i, 5) * frame.width;
    const y = frame.y + ((noise(i, 9) * frame.height + time * speed) % (frame.height + 40)) - 20;
    const colors = ["#e8615a", "#f2a516", "#5bb0d6", "#3f9052", "#b78ad6"];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(time * 2 + i);
    inkShape(
      ctx,
      [
        { x: -6, y: -4 },
        { x: 6, y: -4 },
        { x: 6, y: 4 },
        { x: -6, y: 4 },
      ],
      { fill: colors[i % colors.length], lw: 1.8, seed: i + 2, rough: 0.3 }
    );
    ctx.restore();
  }

  const scale = clamp(Math.min(frame.width, frame.height) / 520, 0.75, 1.3);
  const centreX = frame.x + frame.width / 2;
  const headingY = frame.y + frame.height * 0.2;
  const bounce = Math.sin(time * 3) * 6;

  inkText(ctx, "You did it!", centreX, headingY + bounce, {
    size: 62 * scale,
    weight: 800,
    color: INK,
  });
  inkText(ctx, "The ship is loaded with gems.", centreX, headingY + 48 * scale + bounce, {
    size: 22 * scale,
    weight: 600,
    color: INK_LIGHT,
  });

  const explorerY = frame.y + frame.height * 0.7;
  drawExplorer(ctx, centreX, explorerY, scale * 1.45, { bob: Math.sin(time * 3) * 5 });

  // The haul, fanned out at her feet.
  const haul = [
    { fill: "#e8615a", stroke: "#f09a95" },
    { fill: "#5bb0d6", stroke: "#93cbe4" },
    { fill: "#3fa34d", stroke: "#7ec287" },
    { fill: "#b78ad6", stroke: "#cfb0e5" },
    { fill: "#f2a516", stroke: "#f6c463" },
    { fill: "#ef8fb4", stroke: "#f4b4cd" },
    { fill: "#5f9ea0", stroke: "#94bfc0" },
  ];
  haul.forEach((colour, index) => {
    const spread = (index - (haul.length - 1) / 2) / ((haul.length - 1) / 2);
    const x = centreX + spread * frame.width * 0.33;
    const y = explorerY + 38 * scale + Math.abs(spread) * 16 * scale;
    const size = (15 + (1 - Math.abs(spread)) * 8) * scale;
    paintGem(ctx, x, y, size, colour.fill, colour.stroke, index * 13 + 5, time);
  });

  ctx.restore();

  drawPromptLabel(
    ctx,
    successAction.prompt,
    frame.x + frame.width / 2,
    frame.y + frame.height - PROMPT_HEIGHT,
    { buffer }
  );
}

// ============================================================================
// Static layer cache
//
// Layers 1-6 only change when the node or the canvas size changes, so they are
// painted once into an offscreen canvas and blitted per frame.
// ============================================================================

const baseLayerCache = new Map();
const BASE_CACHE_LIMIT = 6;

function paintBaseLayer(canvas, width, height, node, island, biome, seed) {
  const ctx = canvas.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const frame = makeFrame(width, height);

  ctx.save();
  roundedFramePath(ctx, frame);
  ctx.clip();

  if (biome.id === "dock") {
    drawDockScene(ctx, frame, biome, seed);
  } else {
    const insets = computeLandInsets(node, island, frame);
    const hasCoast = DIRECTIONS.some((direction) => insets[direction] > 0);

    if (hasCoast) {
      ctx.fillStyle = biome.water || "#5bb0d6";
      ctx.fillRect(frame.x - 4, frame.y - 4, frame.width + 8, frame.height + 8);
    }

    const polygon = landPolygon(frame, insets);
    if (hasCoast) {
      // A coastline is worth drawing by hand; smoothing needs the dense point
      // list that roughen() produces, so the two always travel together.
      inkShape(ctx, polygon, {
        fill: biome.ground || "#cbb994",
        stroke: INK,
        lw: 4,
        seed,
        rough: 3.4,
        smooth: true,
      });
    } else {
      ctx.fillStyle = biome.ground || "#cbb994";
      ctx.fillRect(frame.x - 4, frame.y - 4, frame.width + 8, frame.height + 8);
    }

    const land = {
      left: frame.x + Math.max(insets.west, 0),
      right: frame.x + frame.width - Math.max(insets.east, 0),
      top: frame.y + Math.max(insets.north, 0),
      bottom: frame.y + frame.height - Math.max(insets.south, 0),
    };

    ctx.save();
    ctx.beginPath();
    ctx.rect(land.left, land.top, land.right - land.left, land.bottom - land.top);
    ctx.clip();
    drawBiomeDecor(ctx, node, biome, frame, land, seed);
    ctx.restore();
  }

  // Adjacency hints and paths sit above the land in every biome.
  const openDirections = DIRECTIONS.filter((direction) => neighborInDirection(node, direction, island));
  drawPaths(ctx, openDirections, frame, biome, seed);
  openDirections.forEach((direction, index) => {
    const neighbor = neighborInDirection(node, direction, island);
    drawAdjacencyHint(ctx, direction, frame, resolveNodeColor(neighbor), seed + index * 11);
  });

  ctx.restore();

  // The frame itself, drawn last so nothing spills over it.
  ctx.save();
  roundedFramePath(ctx, frame);
  ctx.lineWidth = FRAME_LINE;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.restore();

  return frame;
}

function getBaseLayer(node, width, height, island, biome, seed) {
  // The key names everything the painted layer depends on. Node id alone is not
  // enough: which sides are open changes the coast, the paths and the hints.
  const openings = DIRECTIONS.filter((direction) => neighborInDirection(node, direction, island))
    .map((direction) => `${direction[0]}${resolveNodeColor(neighborInDirection(node, direction, island))}`)
    .join("");
  const key = `${node?.id ?? "none"}|${Math.round(width)}x${Math.round(height)}|${biome.id}|${openings}`;
  const cached = baseLayerCache.get(key);
  if (cached) {
    // Refresh recency.
    baseLayerCache.delete(key);
    baseLayerCache.set(key, cached);
    return cached;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  paintBaseLayer(canvas, width, height, node, island, biome, seed);
  const entry = { canvas };
  baseLayerCache.set(key, entry);
  while (baseLayerCache.size > BASE_CACHE_LIMIT) {
    baseLayerCache.delete(baseLayerCache.keys().next().value);
  }
  return entry;
}

export function clearSceneCache() {
  baseLayerCache.clear();
}

// ============================================================================
// Animated overlays drawn on top of the cached base
// ============================================================================

function drawLiveWater(ctx, node, island, biome, frame, seed, time) {
  if (biome.id === "dock") {
    // The dock's shore is cached; the waterline and the open water move.
    ctx.save();
    roundedFramePath(ctx, frame);
    ctx.clip();
    const sandBottom = frame.y + frame.height * DOCK_SAND_BOTTOM;

    for (let band = 0; band < 2; band += 1) {
      const baseY = sandBottom + 5 + band * 12;
      const points = [];
      for (let i = 0; i <= 26; i += 1) {
        const t = i / 26;
        points.push({
          x: frame.x + t * frame.width,
          y: baseY + Math.sin(t * Math.PI * 6 + time * 1.5 + band) * 4,
        });
      }
      ctx.save();
      ctx.globalAlpha = band === 0 ? 0.95 : 0.5;
      inkLine(ctx, points, {
        stroke: biome.foam,
        lw: band === 0 ? 4 : 3,
        seed: seed + band,
        rough: 0.8,
      });
      ctx.restore();
    }

    for (let row = 0; row < 3; row += 1) {
      const waveY = sandBottom + frame.height * 0.12 + row * frame.height * 0.11;
      if (waveY > frame.y + frame.height - 12) break;
      for (let i = 0; i < 5; i += 1) {
        const drift = ((time * 16 + row * 60 + i * 150) % (frame.width + 200)) - 100;
        const wx = frame.x + drift;
        inkLine(
          ctx,
          [
            { x: wx - 22, y: waveY },
            { x: wx, y: waveY - 5 },
            { x: wx + 22, y: waveY },
          ],
          { stroke: alpha(biome.foam, 0.7), lw: 3, seed: seed + row * 7 + i, rough: 0.8 }
        );
      }
    }

    drawDockPier(ctx, frame, biome, seed);
    ctx.restore();
    return;
  }

  const insets = computeLandInsets(node, island, frame);
  const coastDirections = DIRECTIONS.filter((direction) => insets[direction] > 0);
  if (!coastDirections.length) return;
  const polygon = landPolygon(frame, insets);
  ctx.save();
  roundedFramePath(ctx, frame);
  ctx.clip();
  coastDirections.forEach((direction, index) => {
    drawFoam(ctx, direction, polygon, biome, seed + index * 5, time * 1.5);
  });
  ctx.restore();
}

// ============================================================================
// Main entry point
// ============================================================================

/**
 * Renders a complete scene.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width  CSS pixels
 * @param {number} height CSS pixels
 * @param {object} config
 * @param {object}  config.node              the node being rendered
 * @param {Array}   config.actions           visible actions, each with a prompt
 * @param {object}  config.state             game state
 * @param {object}  config.island
 * @param {string}  [config.highlightedActionId]
 * @param {object}  [config.successAction]   shown on the win screen
 * @param {boolean} [config.hidePrompts]
 * @param {Function}[config.isFeatureVisible]
 * @param {string}  [config.typedBuffer]     what the player has typed so far
 * @param {number}  [config.time]            seconds, drives all animation
 * @param {Array}   [config.effects]         transient sparkle bursts
 * @param {number}  [config.facing]          -1 or 1, which way the explorer looks
 */
export function renderSceneToCanvas(ctx, width, height, config) {
  const {
    node,
    actions = [],
    state,
    island,
    highlightedActionId = null,
    successAction = null,
    hidePrompts = false,
    isFeatureVisible: isFeatureVisibleCallback = null,
    typedBuffer = "",
    time = 0,
    effects = [],
    facing = 1,
  } = config;

  const frame = makeFrame(width, height);
  const biome = getBiomeById(node?.biome);
  const seed = seedFromString(node?.id ?? "none");
  const safeActions = Array.isArray(actions) ? actions : [];

  ctx.clearRect(0, 0, width, height);

  if (state?.status === "success" && successAction) {
    drawWinScreen(ctx, width, height, frame, successAction, time, typedBuffer);
    ctx.save();
    roundedFramePath(ctx, frame);
    ctx.lineWidth = FRAME_LINE;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.restore();
    return { featureLayout: [], frame };
  }

  const base = getBaseLayer(node, width, height, island, biome, seed);
  ctx.drawImage(base.canvas, 0, 0, width, height);

  drawLiveWater(ctx, node, island, biome, frame, seed, time);

  const isFeatureVisibleFn =
    isFeatureVisibleCallback ||
    ((feature) => !(feature.removable && state?.completedFeatures?.has(feature.id)));

  const normalizedFeatures = Array.isArray(node?.features)
    ? node.features
        .map((feature) => {
          const normalized = normalizeFeatureEntry(feature);
          if (!normalized) return null;
          return {
            ...normalized,
            isComplete: state?.completedFeatures?.has(feature.id) ?? false,
            seed: seedFromString(feature.id),
            biome,
          };
        })
        .filter(Boolean)
    : [];

  const featureLayout = placeFeatures(normalizedFeatures, frame, isFeatureVisibleFn);

  ctx.save();
  roundedFramePath(ctx, frame);
  ctx.clip();

  drawFeatures(ctx, featureLayout, time);

  const centre = framePoint(frame, 0.5, 0.5);
  const explorerScale = clamp(Math.min(frame.width, frame.height) / 560, 0.7, 1.05);
  inkEllipse(ctx, centre.x, centre.y + 20, 34 * explorerScale, 11 * explorerScale, {
    fill: alpha(INK, 0.1),
    lw: 0,
    seed,
    rough: 1.2,
  });
  drawExplorer(ctx, centre.x, centre.y + 18, explorerScale, {
    bob: Math.sin(time * 2) * 3,
    facing,
  });

  drawEffects(ctx, effects, time);
  ctx.restore();

  if (hidePrompts) return { featureLayout, frame };

  // Prompts last, above everything, never clipped by the frame.
  const movementEntries = [];
  const featureEntries = [];
  const looseEntries = [];

  safeActions.forEach((action) => {
    if (action.kind === "move") {
      const direction = getMovementDirection(node, action, island);
      if (direction) {
        movementEntries.push({ action, direction });
        return;
      }
    }
    if (action.kind !== "move" && action.isCompleted) return;
    const feature = featureLayout.find((entry) => entry.actionId === action.id);
    if (feature) featureEntries.push({ action, feature });
    else looseEntries.push(action);
  });

  const labelOpts = (action) => ({
    buffer: typedBuffer,
    isHighlighted: action.id === highlightedActionId,
  });

  // Every label claims a rectangle. Later labels dodge the ones already placed,
  // so a talkable NPC near an exit never ends up under that exit's prompt.
  const claimed = [];

  movementEntries.forEach(({ action, direction }) => {
    const position = movementPromptPosition(direction, frame);
    if (!position) return;
    claimed.push(labelRect(ctx, action.prompt, position.x, position.y));
    drawMovementPrompt(ctx, action, direction, frame, {
      ...labelOpts(action),
      faded: action.isCompleted,
    });
  });

  featureEntries.forEach(({ action, feature }) => {
    const placement = placePromptNear(ctx, action.prompt, feature, frame, claimed);
    claimed.push(placement.rect);
    drawPromptLabel(ctx, action.prompt, placement.x, placement.y, {
      ...labelOpts(action),
      tail: placement.tail,
    });
  });

  looseEntries.forEach((action, index) => {
    const y = frame.y + frame.height * 0.3 + index * (PROMPT_HEIGHT + 16);
    const x = frame.x + frame.width / 2;
    claimed.push(labelRect(ctx, action.prompt, x, y));
    drawPromptLabel(ctx, action.prompt, x, y, labelOpts(action));
  });

  return { featureLayout, frame };
}
