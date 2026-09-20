// Map rendering for Gem Island.
//
// The map is a record of the trip, not a picture of the island: it draws only
// what the player has seen (`visual-v1.md`, "Node states"). Kept beside
// `scene-renderer.js` rather than inside `main.js` so it can be reviewed in
// `tools/gallery.html` without running a real game.

import { isNodeCompleted } from "./island-engine.js";
import { resolveNodeColor } from "./biomes.js";
import { drawExplorerIcon } from "./explorer.js";
import {
  INK,
  INK_LIGHT,
  PAPER,
  PAPER_DEEP,
  READY,
  alpha,
  clamp,
  inkLine,
  inkRect,
  inkText,
} from "./ink.js";

const MAP_OCEAN = "#bfe0ea";
const PLAYER_PALETTE = Object.freeze({
  skin: "#f3d2b4",
  hairPink: "#ef8fb4",
  hairPurple: "#b78ad6",
  tieBlue: "#5bb0d6",
});

function drawMapCheck(ctx, x, y, size) {
  const stroke = Math.max(2.5, size * 0.55);
  const points = [
    { x: x - size, y },
    { x: x - size * 0.2, y: y + size * 0.8 },
    { x: x + size, y: y - size * 0.9 },
  ];
  // A paper halo under the tick, so it reads on the green tiles as clearly as
  // on the sandy ones — forest and plains are close enough to the tick colour
  // that it disappeared into them.
  inkLine(ctx, points, {
    stroke: PAPER,
    lw: stroke + Math.max(2, size * 0.45),
    seed: 12,
    rough: 0.4,
    smooth: false,
  });
  inkLine(ctx, points, { stroke: READY, lw: stroke, seed: 12, rough: 0.4, smooth: false });
}

function drawCompass(ctx, x, y) {
  inkText(ctx, "N", x, y - 8, { size: 13, weight: 800, color: INK_LIGHT });
  inkLine(
    ctx,
    [
      { x, y: y - 1 },
      { x, y: y + 10 },
    ],
    { stroke: INK_LIGHT, lw: 2, seed: 4, rough: 0.3 }
  );
  inkLine(
    ctx,
    [
      { x: x - 4, y: y + 3 },
      { x, y: y - 2 },
      { x: x + 4, y: y + 3 },
    ],
    { stroke: INK_LIGHT, lw: 2, seed: 5, rough: 0.3, smooth: false }
  );
}

/**
 * Draws the island map.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width  CSS pixels
 * @param {number} height CSS pixels
 * @param {object} config
 * @param {object} config.island
 * @param {object} config.state
 */
export function renderMapToCanvas(ctx, width, height, { island, state }) {
  const nodes = Object.values(island?.nodes || {}).filter((entry) => entry?.position);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = MAP_OCEAN;
  ctx.fillRect(0, 0, width, height);
  if (!nodes.length || !state) return;

  const xs = nodes.map((node) => node.position.x);
  const ys = nodes.map((node) => node.position.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const cols = Math.max(1, Math.max(...xs) - minX + 1);
  const rows = Math.max(1, Math.max(...ys) - minY + 1);
  const padding = 16;
  const cell = Math.max(14, Math.min((width - padding * 2) / cols, (height - padding * 2) / rows));
  const startX = (width - cell * cols) / 2;
  const startY = (height - cell * rows) / 2;
  const originX = (node) => startX + (node.position.x - minX) * cell;
  const originY = (node) => startY + (node.position.y - minY) * cell;

  // Only what the player has seen is drawn.
  nodes.forEach((node) => {
    if (!state.visitedNodes?.has(node.id)) return;
    const x = originX(node);
    const y = originY(node);
    inkRect(ctx, x + 1, y + 1, cell - 2, cell - 2, {
      fill: resolveNodeColor(node) || PAPER_DEEP,
      stroke: alpha(INK, 0.75),
      lw: 2,
      radius: Math.max(3, cell * 0.16),
      seed: (node.position.x + 1) * 31 + (node.position.y + 1) * 7,
      rough: 0.7,
    });
    if (isNodeCompleted(node, state)) {
      drawMapCheck(ctx, x + cell * 0.72, y + cell * 0.28, cell * 0.2);
    }
  });

  const current = island.nodes?.[state.currentNodeId];
  if (state.status !== "success" && current?.position) {
    drawExplorerIcon(
      ctx,
      originX(current) + cell / 2,
      originY(current) + cell / 2,
      clamp(cell / 96, 0.32, 0.62),
      PLAYER_PALETTE
    );
  }

  drawCompass(ctx, width - 26, 26);
}
