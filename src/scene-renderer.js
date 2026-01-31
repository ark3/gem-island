// Scene rendering module for Gem Island
// Extracted from main.js to enable standalone rendering for visual test harnesses

import { getBiomeById, resolveNodeColor } from "./biomes.js";
import { normalizeFeatureEntry } from "./features.js";
import { drawExplorer } from "./explorer.js";

// ============================================================================
// Constants
// ============================================================================

const SCENE_DEFAULT_COLOR = "#0b1220";
const ACCENT_COLOR = "#f472b6";
const CARD_BACKGROUND = "#0b1220";
const CARD_BORDER = "#1f2937";
const LABEL_COLOR = "#e2e8f0";
const PROMPT_COLOR = "#a5b4fc";
const CENTER_PROMPT_HEIGHT = 54;
const CENTER_PROMPT_GAP = 14;
const MOVEMENT_PROMPT_HEIGHT = 52;
const MOVEMENT_PROMPT_WIDTH = 168;
const FEATURE_SLOT_RADIUS = 50;
const ANCHORED_PROMPT_WIDTH = 190;
const ANCHORED_PROMPT_HEIGHT = 52;
const PROMPT_CARD_MARGIN = 16;
const SCENE_FRAME_LINE_WIDTH = 6;
const PATH_THICKNESS = 44;

// ============================================================================
// Pure Utilities
// ============================================================================

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function pseudoRandom(seed) {
  const x = Math.sin(seed * 43758.5453);
  return x - Math.floor(x);
}

export function drawRoundedRectPath(ctx, x, y, width, height, radius = 12) {
  const r = Math.max(4, Math.min(radius, Math.min(width, height) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ============================================================================
// Texture Helpers
// ============================================================================

function drawTextureDots(ctx, { color, width, height, startY, endY, stepX, stepY }) {
  ctx.save();
  ctx.fillStyle = color;
  const safeStartY = Math.max(startY, 40);
  const safeEndY = Math.min(endY, height - 40);
  for (let y = safeStartY; y < safeEndY; y += stepY) {
    const stagger = (y / stepY) % 2 === 0 ? 0 : stepX / 2;
    for (let x = 40 + stagger; x < width - 40; x += stepX) {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ============================================================================
// Feature Drawing Functions
// ============================================================================

function drawShipFeature(ctx, slot) {
  ctx.save();
  ctx.fillStyle = "#1e3a8a";
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(slot.x - 40, slot.y + 30);
  ctx.lineTo(slot.x + 40, slot.y + 30);
  ctx.lineTo(slot.x + 20, slot.y - 20);
  ctx.lineTo(slot.x - 20, slot.y - 20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(slot.x - 5, slot.y - 50, 10, 30);
  ctx.fillStyle = "#94a3b8";
  ctx.fillRect(slot.x - 30, slot.y - 50, 25, 15);
  ctx.restore();
}

function drawSignFeature(ctx, slot) {
  ctx.save();
  const postHeight = 50;
  const postWidth = 12;
  ctx.fillStyle = "#7c3f1d";
  ctx.fillRect(slot.x - postWidth / 2, slot.y, postWidth, postHeight);

  const boardWidth = 90;
  const boardHeight = 44;
  const boardX = slot.x - boardWidth / 2;
  const boardY = slot.y - boardHeight + 6;
  ctx.fillStyle = "#f8dca8";
  ctx.strokeStyle = "#8b5e34";
  ctx.lineWidth = 3;
  ctx.fillRect(boardX, boardY, boardWidth, boardHeight);
  ctx.strokeRect(boardX, boardY, boardWidth, boardHeight);

  ctx.fillStyle = "#6b4b2c";
  ctx.fillRect(boardX + 10, boardY + 12, boardWidth - 20, 6);
  ctx.fillRect(boardX + 16, boardY + 24, boardWidth - 32, 6);
  ctx.restore();
}

function drawPersonFeature(ctx, slot) {
  ctx.save();
  const headRadius = 16;
  ctx.fillStyle = "#b7795f";
  ctx.beginPath();
  ctx.arc(slot.x, slot.y - 26, headRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#3f2a1d";
  ctx.beginPath();
  ctx.arc(slot.x, slot.y - 32, headRadius * 1.05, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#38bdf8";
  ctx.strokeStyle = "#0ea5e9";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(slot.x - 22, slot.y - 6);
  ctx.lineTo(slot.x + 22, slot.y - 6);
  ctx.lineTo(slot.x + 16, slot.y + 34);
  ctx.lineTo(slot.x - 16, slot.y + 34);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(slot.x - 14, slot.y + 34, 28, 18);
  ctx.restore();
}

function drawGemFeature(ctx, feature) {
  const { slot, color } = feature;
  ctx.save();
  ctx.fillStyle = color?.fill ?? "#f472b6";
  ctx.strokeStyle = color?.stroke ?? "#fbcfe8";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(slot.x, slot.y - FEATURE_SLOT_RADIUS / 2);
  ctx.lineTo(slot.x + FEATURE_SLOT_RADIUS / 2, slot.y);
  ctx.lineTo(slot.x, slot.y + FEATURE_SLOT_RADIUS / 2);
  ctx.lineTo(slot.x - FEATURE_SLOT_RADIUS / 2, slot.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawShellFeature(ctx, slot) {
  const radius = FEATURE_SLOT_RADIUS * 0.6;
  ctx.save();
  ctx.fillStyle = "#fde68a";
  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(slot.x - radius, slot.y + radius * 0.45);
  ctx.arc(slot.x, slot.y + radius * 0.45, radius, Math.PI, 0);
  ctx.lineTo(slot.x + radius, slot.y + radius * 0.45);
  ctx.lineTo(slot.x, slot.y + radius * 1.1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgba(146, 64, 14, 0.4)";
  ctx.lineWidth = 1.5;
  const ridgeCount = 4;
  for (let i = 0; i < ridgeCount; i += 1) {
    const offset = (i - (ridgeCount - 1) / 2) * (radius * 0.4);
    ctx.beginPath();
    ctx.moveTo(slot.x + offset * 0.9, slot.y - radius * 0.2);
    ctx.lineTo(slot.x + offset * 0.5, slot.y + radius * 0.9);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPebbleFeature(ctx, slot) {
  ctx.save();
  ctx.fillStyle = "#cbd5f5";
  ctx.strokeStyle = "#64748b";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(slot.x, slot.y + 6, 22, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawPineconeFeature(ctx, slot) {
  ctx.save();
  ctx.fillStyle = "#8b5e34";
  ctx.strokeStyle = "#5b3a1d";
  ctx.lineWidth = 2.5;
  const width = 26;
  const height = 40;
  ctx.beginPath();
  ctx.ellipse(slot.x, slot.y + 6, width / 2, height / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 1.5;
  for (let i = -2; i <= 2; i += 1) {
    ctx.beginPath();
    ctx.moveTo(slot.x - 10, slot.y - 6 + i * 6);
    ctx.lineTo(slot.x + 10, slot.y + 2 + i * 6);
    ctx.stroke();
  }
  ctx.restore();
}

function drawWildflowerFeature(ctx, slot) {
  ctx.save();
  ctx.strokeStyle = "#166534";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(slot.x, slot.y + 18);
  ctx.lineTo(slot.x, slot.y - 6);
  ctx.stroke();

  ctx.fillStyle = "#facc15";
  const petalRadius = 7;
  const petalCount = 6;
  for (let i = 0; i < petalCount; i += 1) {
    const angle = (i / petalCount) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(
      slot.x + Math.cos(angle) * 10,
      slot.y - 12 + Math.sin(angle) * 6,
      petalRadius,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  ctx.fillStyle = "#f59e0b";
  ctx.beginPath();
  ctx.arc(slot.x, slot.y - 12, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCarrotFeature(ctx, slot) {
  ctx.save();
  ctx.fillStyle = "#f97316";
  ctx.strokeStyle = "#c2410c";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(slot.x, slot.y + 24);
  ctx.lineTo(slot.x - 12, slot.y - 10);
  ctx.lineTo(slot.x + 12, slot.y - 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "#166534";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(slot.x, slot.y - 14);
  ctx.lineTo(slot.x - 8, slot.y - 26);
  ctx.moveTo(slot.x, slot.y - 14);
  ctx.lineTo(slot.x + 8, slot.y - 26);
  ctx.stroke();
  ctx.restore();
}

function drawSandcastleFeature(ctx, slot) {
  ctx.save();
  ctx.fillStyle = "#f5d791";
  ctx.strokeStyle = "#c0841a";
  ctx.lineWidth = 2.5;
  ctx.fillRect(slot.x - 22, slot.y - 2, 44, 28);
  ctx.strokeRect(slot.x - 22, slot.y - 2, 44, 28);
  ctx.fillRect(slot.x - 28, slot.y - 18, 18, 16);
  ctx.strokeRect(slot.x - 28, slot.y - 18, 18, 16);
  ctx.fillRect(slot.x + 10, slot.y - 18, 18, 16);
  ctx.strokeRect(slot.x + 10, slot.y - 18, 18, 16);

  ctx.fillStyle = "#f59e0b";
  ctx.beginPath();
  ctx.moveTo(slot.x, slot.y - 24);
  ctx.lineTo(slot.x, slot.y - 34);
  ctx.lineTo(slot.x + 10, slot.y - 32);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCaveSignFeature(ctx, slot) {
  ctx.save();
  const postHeight = 50;
  const postWidth = 12;
  ctx.fillStyle = "#5b3a1d";
  ctx.fillRect(slot.x - postWidth / 2, slot.y, postWidth, postHeight);

  const boardWidth = 90;
  const boardHeight = 44;
  const boardX = slot.x - boardWidth / 2;
  const boardY = slot.y - boardHeight + 6;
  ctx.fillStyle = "#d9cab3";
  ctx.strokeStyle = "#5f4b3a";
  ctx.lineWidth = 3;
  ctx.fillRect(boardX, boardY, boardWidth, boardHeight);
  ctx.strokeRect(boardX, boardY, boardWidth, boardHeight);

  ctx.fillStyle = "#3f2a1d";
  ctx.fillRect(boardX + 12, boardY + 12, boardWidth - 24, 6);
  ctx.fillRect(boardX + 18, boardY + 24, boardWidth - 36, 6);
  ctx.restore();
}

function drawOwlFeature(ctx, slot) {
  ctx.save();
  ctx.fillStyle = "#6b4b2c";
  ctx.strokeStyle = "#3f2a1d";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(slot.x, slot.y + 4, 20, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#fef3c7";
  ctx.beginPath();
  ctx.ellipse(slot.x - 8, slot.y - 2, 6, 8, 0, 0, Math.PI * 2);
  ctx.ellipse(slot.x + 8, slot.y - 2, 6, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(slot.x - 8, slot.y - 2, 2.5, 0, Math.PI * 2);
  ctx.arc(slot.x + 8, slot.y - 2, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawKiteFeature(ctx, slot) {
  ctx.save();
  ctx.fillStyle = "#60a5fa";
  ctx.strokeStyle = "#1d4ed8";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(slot.x, slot.y - 28);
  ctx.lineTo(slot.x + 24, slot.y);
  ctx.lineTo(slot.x, slot.y + 28);
  ctx.lineTo(slot.x - 24, slot.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(slot.x, slot.y + 28);
  ctx.lineTo(slot.x + 18, slot.y + 42);
  ctx.lineTo(slot.x + 8, slot.y + 54);
  ctx.stroke();
  ctx.restore();
}

function drawTractorFeature(ctx, slot) {
  ctx.save();
  ctx.fillStyle = "#16a34a";
  ctx.strokeStyle = "#166534";
  ctx.lineWidth = 2.5;
  ctx.fillRect(slot.x - 28, slot.y - 4, 56, 24);
  ctx.strokeRect(slot.x - 28, slot.y - 4, 56, 24);
  ctx.fillRect(slot.x - 10, slot.y - 24, 26, 18);
  ctx.strokeRect(slot.x - 10, slot.y - 24, 26, 18);

  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(slot.x - 18, slot.y + 22, 10, 0, Math.PI * 2);
  ctx.arc(slot.x + 18, slot.y + 22, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlaceholderFeature(ctx, slot) {
  ctx.save();
  ctx.fillStyle = "rgba(15, 23, 42, 0.4)";
  ctx.beginPath();
  ctx.arc(slot.x, slot.y, FEATURE_SLOT_RADIUS / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFeature(ctx, feature) {
  const { slot } = feature;
  if (!slot) return;
  switch (feature.type) {
    case "ship":
      drawShipFeature(ctx, slot);
      break;
    case "gem":
      drawGemFeature(ctx, feature);
      break;
    case "shell":
      drawShellFeature(ctx, slot);
      break;
    case "pebble":
      drawPebbleFeature(ctx, slot);
      break;
    case "pinecone":
      drawPineconeFeature(ctx, slot);
      break;
    case "wildflower":
      drawWildflowerFeature(ctx, slot);
      break;
    case "carrot":
      drawCarrotFeature(ctx, slot);
      break;
    case "sign":
      drawSignFeature(ctx, slot);
      break;
    case "sandcastle":
      drawSandcastleFeature(ctx, slot);
      break;
    case "cave_sign":
      drawCaveSignFeature(ctx, slot);
      break;
    case "owl":
      drawOwlFeature(ctx, slot);
      break;
    case "kite":
      drawKiteFeature(ctx, slot);
      break;
    case "tractor":
      drawTractorFeature(ctx, slot);
      break;
    case "person":
      drawPersonFeature(ctx, slot);
      break;
    default:
      drawPlaceholderFeature(ctx, slot);
      break;
  }
}

export function drawFeatures(ctx, features) {
  features.forEach((feature) => drawFeature(ctx, feature));
}

// ============================================================================
// Biome Background Drawing
// ============================================================================

function drawDockShore(ctx, biome, width, shoreHeight) {
  const sandColor = "#f4d09c";
  const grassColor = "#a7c957";
  ctx.fillStyle = grassColor;
  ctx.fillRect(0, 0, width, shoreHeight);
  ctx.fillStyle = sandColor;
  ctx.fillRect(0, shoreHeight * 0.4, width, shoreHeight * 0.6);
  drawTextureDots(ctx, {
    color: "rgba(107, 83, 43, 0.4)",
    width,
    height: shoreHeight,
    startY: shoreHeight * 0.1,
    endY: shoreHeight * 0.9,
    stepX: 90,
    stepY: 50,
  });
}

function drawDockWater(ctx, biome, width, waterHeight, shoreHeight) {
  const gradient = ctx.createLinearGradient(0, shoreHeight, 0, shoreHeight + waterHeight);
  gradient.addColorStop(0, "#071633");
  gradient.addColorStop(1, biome.edgeColor || "#1d4ed8");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, shoreHeight, width, waterHeight);

  const waveCount = 5;
  const spacing = waterHeight / (waveCount + 1);
  ctx.strokeStyle = biome.accentColor || "rgba(219, 234, 254, 0.5)";
  ctx.lineWidth = 3;
  for (let i = 1; i <= waveCount; i += 1) {
    const y = shoreHeight + i * spacing;
    const step = width / 4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let segment = 0; segment < 4; segment += 1) {
      const startX = segment * step;
      const cpX = startX + step / 2;
      const cpY = y + (segment % 2 === 0 ? 12 : -12);
      const endX = startX + step;
      ctx.quadraticCurveTo(cpX, cpY, endX, y);
    }
    ctx.stroke();
  }
}

function drawDockBoat(ctx, biome, width, waterHeight, shoreHeight) {
  const boatWidth = Math.max(140, width * 0.16);
  const boatHeight = Math.max(70, waterHeight * 0.18);
  const boatX = width * 0.75;
  const boatY = shoreHeight + waterHeight * 0.35;
  ctx.save();
  ctx.translate(boatX, boatY);
  ctx.rotate(-0.1);
  ctx.fillStyle = "#1e293b";
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-boatWidth / 2, boatHeight / 2);
  ctx.lineTo(boatWidth / 2, boatHeight / 2);
  ctx.quadraticCurveTo(boatWidth / 2 + 30, 0, boatWidth / 2, -boatHeight / 2);
  ctx.lineTo(-boatWidth / 2, -boatHeight / 2);
  ctx.quadraticCurveTo(-boatWidth / 2 - 30, 0, -boatWidth / 2, boatHeight / 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(-6, -boatHeight / 2 - 20, 12, 30);
  ctx.fillStyle = "#cbd5f5";
  ctx.beginPath();
  ctx.moveTo(0, -boatHeight / 2 - 20);
  ctx.lineTo(boatWidth * 0.2, 0);
  ctx.lineTo(0, boatHeight * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawDockPier(ctx, biome, width, shoreHeight, pierWidth, pierHeight) {
  const pierTop = shoreHeight;
  const pierBottom = shoreHeight + pierHeight;
  const pierCenter = width / 2;
  ctx.save();

  // shadow
  ctx.fillStyle = "rgba(15, 23, 42, 0.35)";
  ctx.beginPath();
  ctx.moveTo(pierCenter - pierWidth / 2 - 10, pierBottom);
  ctx.lineTo(pierCenter + pierWidth / 2 + 10, pierBottom);
  ctx.lineTo(pierCenter + pierWidth / 2, pierTop + 20);
  ctx.lineTo(pierCenter - pierWidth / 2, pierTop + 20);
  ctx.closePath();
  ctx.fill();

  // planks
  ctx.fillStyle = "#8d6b4a";
  ctx.strokeStyle = "#4b341f";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(pierCenter - pierWidth / 2, pierBottom);
  ctx.lineTo(pierCenter + pierWidth / 2, pierBottom);
  ctx.lineTo(pierCenter + pierWidth * 0.35, pierTop);
  ctx.lineTo(pierCenter - pierWidth * 0.35, pierTop);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const plankSpacing = 36;
  for (let y = pierBottom - plankSpacing; y > pierTop; y -= plankSpacing) {
    const progress = (pierBottom - y) / pierHeight;
    const widthAtY = pierWidth * (1 - 0.3 * progress);
    ctx.beginPath();
    ctx.moveTo(pierCenter - widthAtY / 2, y);
    ctx.lineTo(pierCenter + widthAtY / 2, y);
    ctx.stroke();
  }

  // posts
  ctx.fillStyle = "#3f2c1c";
  const postCount = 4;
  for (let i = 0; i < postCount; i += 1) {
    const t = i / (postCount - 1);
    const topWidth = pierWidth * 0.35;
    const widthAtT = topWidth + (pierWidth - topWidth) * t;
    const xLeft = pierCenter - widthAtT / 2 - 12;
    const xRight = pierCenter + widthAtT / 2 + 12;
    const y = pierTop + pierHeight * t;
    ctx.fillRect(xLeft, y - 60, 18, 60);
    ctx.fillRect(xRight - 18, y - 60, 18, 60);
  }

  ctx.restore();
}

function drawDockBiomeDetails(ctx, biome, width, height) {
  ctx.save();
  const waterHeight = Math.max(height * 0.45, 200);
  const shoreHeight = height - waterHeight;
  const pierWidth = Math.max(width * 0.28, 150);
  const pierHeight = Math.max(waterHeight * 0.75, 200);

  drawDockShore(ctx, biome, width, shoreHeight);
  drawDockWater(ctx, biome, width, waterHeight, shoreHeight);
  drawDockPier(ctx, biome, width, shoreHeight, pierWidth, pierHeight);
  drawDockBoat(ctx, biome, width, waterHeight, shoreHeight);

  ctx.restore();
}

function drawSandDunes(ctx, biome, width, height) {
  const duneColor = biome.duneAccent || "#fca311";
  const duneCount = 3;
  const baseY = height * 0.58;
  ctx.save();
  for (let i = 0; i < duneCount; i += 1) {
    const offset = i % 2 === 0 ? 0 : 30;
    const startX = (width / duneCount) * i - width * 0.2;
    const duneWidth = width * 0.65;
    ctx.globalAlpha = 0.18 + i * 0.12;
    ctx.fillStyle = duneColor;
    ctx.beginPath();
    ctx.moveTo(startX, baseY + offset);
    ctx.quadraticCurveTo(startX + duneWidth / 2, baseY - 50 - offset, startX + duneWidth, baseY + offset);
    ctx.lineTo(startX + duneWidth, height);
    ctx.lineTo(startX, height);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  drawTextureDots(ctx, {
    color: "rgba(146, 64, 14, 0.25)",
    width,
    height,
    startY: height * 0.35,
    endY: height - 40,
    stepX: 70,
    stepY: 55,
  });
}

function getNeighborIdForDirection(node, direction, getNodeIdAtPosition) {
  if (!node?.position) return null;
  const { x, y } = node.position;
  switch (direction) {
    case "north":
      return getNodeIdAtPosition(x, y - 1);
    case "south":
      return getNodeIdAtPosition(x, y + 1);
    case "west":
      return getNodeIdAtPosition(x - 1, y);
    case "east":
      return getNodeIdAtPosition(x + 1, y);
    default:
      return null;
  }
}

function hasNeighborInDirection(node, direction, getNodeIdAtPosition) {
  const neighborId = getNeighborIdForDirection(node, direction, getNodeIdAtPosition);
  return Boolean(neighborId);
}

function drawShoreFoam(ctx, direction, biome, sandRect, width, height) {
  const foamColor = biome.foamColor || "#fef3c7";
  const segments = 6;
  const amplitude = 16;
  ctx.save();
  ctx.strokeStyle = foamColor;
  ctx.lineWidth = 3;

  switch (direction) {
    case "north": {
      const y = sandRect.y;
      const segmentWidth = sandRect.width / segments;
      ctx.beginPath();
      for (let i = 0; i < segments; i += 1) {
        const startX = sandRect.x + i * segmentWidth;
        const cpX = startX + segmentWidth / 2;
        const cpY = y - (i % 2 === 0 ? amplitude : -amplitude);
        const endX = startX + segmentWidth;
        if (i === 0) ctx.moveTo(startX, y);
        ctx.quadraticCurveTo(cpX, cpY, endX, y);
      }
      ctx.stroke();
      break;
    }
    case "south": {
      const y = sandRect.y + sandRect.height;
      const segmentWidth = sandRect.width / segments;
      ctx.beginPath();
      for (let i = 0; i < segments; i += 1) {
        const startX = sandRect.x + i * segmentWidth;
        const cpX = startX + segmentWidth / 2;
        const cpY = y + (i % 2 === 0 ? amplitude : -amplitude);
        const endX = startX + segmentWidth;
        if (i === 0) ctx.moveTo(startX, y);
        ctx.quadraticCurveTo(cpX, cpY, endX, y);
      }
      ctx.stroke();
      break;
    }
    case "west": {
      const x = sandRect.x;
      const segmentHeight = sandRect.height / segments;
      ctx.beginPath();
      for (let i = 0; i < segments; i += 1) {
        const startY = sandRect.y + i * segmentHeight;
        const cpY = startY + segmentHeight / 2;
        const cpX = x - (i % 2 === 0 ? amplitude : -amplitude);
        const endY = startY + segmentHeight;
        if (i === 0) ctx.moveTo(x, startY);
        ctx.quadraticCurveTo(cpX, cpY, x, endY);
      }
      ctx.stroke();
      break;
    }
    case "east": {
      const x = sandRect.x + sandRect.width;
      const segmentHeight = sandRect.height / segments;
      ctx.beginPath();
      for (let i = 0; i < segments; i += 1) {
        const startY = sandRect.y + i * segmentHeight;
        const cpY = startY + segmentHeight / 2;
        const cpX = x + (i % 2 === 0 ? amplitude : -amplitude);
        const endY = startY + segmentHeight;
        if (i === 0) ctx.moveTo(x, startY);
        ctx.quadraticCurveTo(cpX, cpY, x, endY);
      }
      ctx.stroke();
      break;
    }
    default:
      break;
  }

  ctx.restore();
}

function calculateSandRect(node, width, height, getNodeIdAtPosition) {
  const shoreMargin = Math.min(width, height) * 0.18;
  const padding = 12;
  const hasNeighbor = (direction) =>
    node ? hasNeighborInDirection(node, direction, getNodeIdAtPosition) : false;
  const north = hasNeighbor("north") ? padding : shoreMargin;
  const south = hasNeighbor("south") ? padding : shoreMargin;
  const west = hasNeighbor("west") ? padding : shoreMargin;
  const east = hasNeighbor("east") ? padding : shoreMargin;
  return {
    x: west,
    y: north,
    width: Math.max(40, width - west - east),
    height: Math.max(40, height - north - south),
  };
}

function drawSandWaterFoam(ctx, node, biome, sandRect, width, height, getNodeIdAtPosition) {
  if (!node) return;
  const directions = ["north", "south", "east", "west"];
  directions.forEach((direction) => {
    if (hasNeighborInDirection(node, direction, getNodeIdAtPosition)) return;
    drawShoreFoam(ctx, direction, biome, sandRect, width, height);
  });
}

function drawSandBiomeDetails(ctx, node, biome, width, height, getNodeIdAtPosition) {
  ctx.save();
  const waterColor = biome.waterColor || "#44b4e2";
  ctx.fillStyle = waterColor;
  ctx.fillRect(0, 0, width, height);

  const sandRect = calculateSandRect(node, width, height, getNodeIdAtPosition);
  const gradient = ctx.createLinearGradient(0, sandRect.y, 0, sandRect.y + sandRect.height);
  gradient.addColorStop(0, biome.sandLight || "#fef3c7");
  gradient.addColorStop(1, biome.sandShadow || "#eab676");
  ctx.fillStyle = gradient;
  ctx.fillRect(sandRect.x, sandRect.y, sandRect.width, sandRect.height);

  ctx.save();
  ctx.beginPath();
  ctx.rect(sandRect.x, sandRect.y, sandRect.width, sandRect.height);
  ctx.clip();
  drawSandDunes(ctx, biome, width, height);
  ctx.restore();

  drawSandWaterFoam(ctx, node, biome, sandRect, width, height, getNodeIdAtPosition);

  ctx.restore();
}

function drawRockPlates(ctx, biome, width, height) {
  const plateColor = biome.ridgeAccent || "rgba(71, 85, 105, 0.4)";
  const spacing = Math.max(70, Math.min(width, height) * 0.22);
  ctx.save();
  ctx.fillStyle = plateColor;
  for (let layer = -2; layer <= 2; layer += 1) {
    const offset = layer * spacing + spacing * 0.5;
    const skew = layer % 2 === 0 ? width * 0.12 : width * 0.04;
    ctx.beginPath();
    ctx.moveTo(-skew, offset);
    ctx.lineTo(width + skew, offset + spacing * 0.35);
    ctx.lineTo(width + skew, offset + spacing * 0.35 + 18);
    ctx.lineTo(-skew, offset + 18);
    ctx.closePath();
    ctx.globalAlpha = 0.15 + (layer + 2) * 0.05;
    ctx.fill();
  }
  ctx.restore();
}

function drawRockBoulders(ctx, biome, width, height) {
  const colors = [
    biome.rockDark || "#4b5563",
    biome.ridgeAccent || "#475569",
    "rgba(15, 23, 42, 0.45)",
  ];
  const placements = [
    { u: 0.2, v: 0.35, scale: 1.1 },
    { u: 0.45, v: 0.28, scale: 0.9 },
    { u: 0.65, v: 0.4, scale: 1.3 },
    { u: 0.35, v: 0.55, scale: 0.8 },
    { u: 0.7, v: 0.62, scale: 1.0 },
    { u: 0.15, v: 0.6, scale: 0.7 },
  ];
  ctx.save();
  placements.forEach((placement, index) => {
    const baseRadius = Math.max(18, width * 0.04);
    const noise = pseudoRandom(index + 1);
    const radius = baseRadius * placement.scale * (0.85 + noise * 0.35);
    const x = width * placement.u + (noise - 0.5) * 40;
    const y = height * placement.v + (pseudoRandom(index + 10) - 0.5) * 30;
    const rotation = pseudoRandom(index + 20) * Math.PI * 0.4;
    ctx.beginPath();
    ctx.ellipse(x, y, radius, radius * (0.6 + noise * 0.2), rotation, 0, Math.PI * 2);
    ctx.fillStyle = colors[index % colors.length];
    ctx.fill();
  });
  ctx.restore();
}

function drawRockCracks(ctx, biome, width, height) {
  ctx.save();
  ctx.strokeStyle = "rgba(15, 23, 42, 0.35)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i += 1) {
    const startX = width * (0.2 + i * 0.25);
    const startY = height * 0.2;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    let currentX = startX;
    let currentY = startY;
    for (let segment = 0; segment < 4; segment += 1) {
      currentX += segment % 2 === 0 ? 30 : -24;
      currentY += height * 0.15;
      const controlX = currentX + (segment % 2 === 0 ? 12 : -12);
      const controlY = currentY - 18;
      ctx.quadraticCurveTo(controlX, controlY, currentX, currentY);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawRockBiomeDetails(ctx, biome, width, height) {
  ctx.save();
  const baseGradient = ctx.createLinearGradient(0, 0, 0, height);
  baseGradient.addColorStop(0, biome.rockLight || "#cbd5f5");
  baseGradient.addColorStop(1, biome.rockDark || "#4b5563");
  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, width, height);

  drawRockPlates(ctx, biome, width, height);
  drawRockBoulders(ctx, biome, width, height);
  drawRockCracks(ctx, biome, width, height);

  ctx.restore();
}

function drawForestMist(ctx, width, height) {
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
  const bandHeight = height * 0.2;
  for (let i = 0; i < 3; i += 1) {
    const y = bandHeight * i + bandHeight / 2;
    ctx.beginPath();
    ctx.ellipse(width / 2, y, width * 0.7, bandHeight * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawForestTrees(ctx, biome, width, height) {
  const rows = [
    { depth: 0.45, count: 4, scale: 0.9 },
    { depth: 0.62, count: 6, scale: 1 },
    { depth: 0.78, count: 7, scale: 1.2 },
  ];
  const trunkColor = biome.trunkColor || "#5b3716";
  const canopyLight = biome.canopyLight || "#3a9b59";
  const canopyDark = biome.canopyDark || "#1f6f3c";
  rows.forEach((row, rowIndex) => {
    const y = height * row.depth;
    for (let i = 0; i < row.count; i += 1) {
      const t = (i + 0.5) / row.count;
      const noise = pseudoRandom(rowIndex * 10 + i) - 0.5;
      const x = width * t + noise * 60;
      const trunkHeight = 30 * row.scale;
      const canopyRadius = 28 * row.scale;
      ctx.save();
      ctx.fillStyle = trunkColor;
      ctx.fillRect(x - 5, y, 10, trunkHeight);
      const gradient = ctx.createRadialGradient(x, y, canopyRadius * 0.3, x, y, canopyRadius);
      gradient.addColorStop(0, canopyLight);
      gradient.addColorStop(1, canopyDark);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(x, y, canopyRadius * 1.2, canopyRadius, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });
}

function drawForestBiomeDetails(ctx, biome, width, height) {
  ctx.save();
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, biome.canopyDark || "#1f6f3c");
  gradient.addColorStop(0.5, biome.canopyLight || "#3a9b59");
  gradient.addColorStop(1, biome.groundColor || "#0d2f20");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  drawForestMist(ctx, width, height);
  drawForestTrees(ctx, biome, width, height);
  ctx.restore();
}

function drawPlainsPatches(ctx, biome, width, height) {
  const patchCount = 4;
  const colors = [biome.bloomColor || "#fcd34d", "rgba(255, 255, 255, 0.25)"];
  for (let i = 0; i < patchCount; i += 1) {
    const noise = pseudoRandom(200 + i);
    const x = width * ((i + 1) / (patchCount + 1)) + (noise - 0.5) * 60;
    const y = height * (0.4 + 0.2 * noise);
    const rx = width * 0.18;
    const ry = height * 0.08;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((noise - 0.5) * 0.4);
    ctx.fillStyle = colors[i % colors.length];
    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawPlainsBrush(ctx, biome, width, height) {
  const strokeCount = 18;
  ctx.save();
  ctx.lineWidth = 6;
  for (let i = 0; i < strokeCount; i += 1) {
    const noise = pseudoRandom(300 + i);
    const x = width * noise;
    const y = height * (0.35 + 0.5 * pseudoRandom(320 + i));
    const length = 30 + 20 * pseudoRandom(340 + i);
    const angle = -Math.PI / 2 + (noise - 0.5) * 0.6;
    ctx.strokeStyle = i % 2 === 0 ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.12)";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlainsBiomeDetails(ctx, biome, width, height) {
  ctx.save();
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, biome.grassLight || "#b9e08b");
  gradient.addColorStop(1, biome.grassShadow || "#7ea75c");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  drawPlainsPatches(ctx, biome, width, height);
  drawPlainsBrush(ctx, biome, width, height);
  ctx.restore();
}

function drawFarmFields(ctx, biome, width, height) {
  const rowCount = 5;
  const colors = [biome.cropGreen || "#7cb342", biome.cropYellow || "#f5ca3a", biome.soilLight || "#c07d3a"];
  const rowHeight = height / rowCount;
  for (let i = 0; i < rowCount; i += 1) {
    const y = i * rowHeight;
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.moveTo(-40, y);
    ctx.lineTo(width + 40, y + rowHeight * 0.2);
    ctx.lineTo(width + 40, y + rowHeight);
    ctx.lineTo(-40, y + rowHeight * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.1)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // divider lines
  ctx.save();
  ctx.strokeStyle = "rgba(15, 23, 42, 0.2)";
  ctx.lineWidth = 3;
  const columnCount = 4;
  for (let col = 0; col <= columnCount; col += 1) {
    const x = (width / columnCount) * col;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - 30, height);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFarmBiomeDetails(ctx, biome, width, height) {
  ctx.save();
  ctx.fillStyle = biome.soilDark || "#8a5a2c";
  ctx.fillRect(0, 0, width, height);
  drawFarmFields(ctx, biome, width, height);
  ctx.restore();
}

function drawBiomeBase(ctx, node, biome, width, height, getNodeIdAtPosition) {
  if (!biome) return;

  switch (biome.id) {
    case "dock":
      drawDockBiomeDetails(ctx, biome, width, height);
      break;
    case "sand":
      drawSandBiomeDetails(ctx, node, biome, width, height, getNodeIdAtPosition);
      break;
    case "rock":
      drawRockBiomeDetails(ctx, biome, width, height);
      break;
    case "forest":
      drawForestBiomeDetails(ctx, biome, width, height);
      break;
    case "plains":
      drawPlainsBiomeDetails(ctx, biome, width, height);
      break;
    case "farm":
      drawFarmBiomeDetails(ctx, biome, width, height);
      break;
    default:
      break;
  }
}

export function drawBiomeBackground(ctx, width, height, node, biome, getNodeIdAtPosition) {
  drawBiomeBase(ctx, node, biome, width, height, getNodeIdAtPosition);
}

// ============================================================================
// Path Drawing
// ============================================================================

function buildPathOutline(movementEntries, width, height, centerX, centerY, thickness, frameInset) {
  const half = thickness / 2;
  const hasDirection = (direction) => movementEntries.some((entry) => entry.direction === direction);

  const northExtent = hasDirection("north") ? frameInset : centerY - half;
  const southExtent = hasDirection("south") ? height - frameInset : centerY + half;
  const westExtent = hasDirection("west") ? frameInset : centerX - half;
  const eastExtent = hasDirection("east") ? width - frameInset : centerX + half;

  const innerTopLeft = { x: centerX - half, y: centerY - half };
  const innerTopRight = { x: centerX + half, y: centerY - half };
  const innerBottomRight = { x: centerX + half, y: centerY + half };
  const innerBottomLeft = { x: centerX - half, y: centerY + half };

  const outline = [innerTopLeft];

  if (hasDirection("north")) {
    outline.push({ x: innerTopLeft.x, y: northExtent });
    outline.push({ x: innerTopRight.x, y: northExtent });
    outline.push({ x: innerTopRight.x, y: innerTopRight.y });
  } else {
    outline.push(innerTopRight);
  }

  if (hasDirection("east")) {
    outline.push({ x: eastExtent, y: innerTopRight.y });
    outline.push({ x: eastExtent, y: innerBottomRight.y });
    outline.push({ x: innerBottomRight.x, y: innerBottomRight.y });
  } else {
    outline.push(innerBottomRight);
  }

  if (hasDirection("south")) {
    outline.push({ x: innerBottomRight.x, y: southExtent });
    outline.push({ x: innerBottomLeft.x, y: southExtent });
    outline.push({ x: innerBottomLeft.x, y: innerBottomLeft.y });
  } else {
    outline.push(innerBottomLeft);
  }

  if (hasDirection("west")) {
    outline.push({ x: westExtent, y: innerBottomLeft.y });
    outline.push({ x: westExtent, y: innerTopLeft.y });
    outline.push({ x: innerTopLeft.x, y: innerTopLeft.y });
  } else {
    outline.push(innerTopLeft);
  }

  return outline;
}

export function drawBiomePaths(ctx, node, movementEntries, width, height, biome) {
  if (!node || movementEntries.length === 0) return;
  const centerX = width / 2;
  const centerY = height / 2;
  const pathThickness = Math.min(PATH_THICKNESS, width * 0.08);
  const fillColor = biome?.pathColor || "rgba(15, 23, 42, 0.35)";
  const outlineColor = biome?.pathOutline || "rgba(15, 23, 42, 0.55)";
  const frameInset = SCENE_FRAME_LINE_WIDTH;

  const outline = buildPathOutline(movementEntries, width, height, centerX, centerY, pathThickness, frameInset);
  if (!outline.length) return;

  ctx.save();
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = Math.max(3, Math.round(pathThickness * 0.18));
  ctx.beginPath();
  outline.forEach((point, index) => {
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  });
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// ============================================================================
// Adjacency Arc Drawing
// ============================================================================

function normalizeAngle(angle) {
  const twoPi = Math.PI * 2;
  let normalized = angle % twoPi;
  if (normalized < 0) normalized += twoPi;
  return normalized;
}

function getArcMidpoint(cx, cy, radius, startAngle, endAngle, anticlockwise) {
  const twoPi = Math.PI * 2;
  let delta = endAngle - startAngle;
  if (anticlockwise) {
    if (delta < 0) delta += twoPi;
  } else {
    if (delta > 0) delta -= twoPi;
  }
  const midAngle = startAngle + delta / 2;
  return {
    x: cx + Math.cos(midAngle) * radius,
    y: cy + Math.sin(midAngle) * radius,
  };
}

function isMidpointInside(direction, point, centerX, centerY) {
  switch (direction) {
    case "north":
      return point.y >= centerY;
    case "south":
      return point.y <= centerY;
    case "west":
      return point.x >= centerX;
    case "east":
      return point.x <= centerX;
    default:
      return true;
  }
}

function getArcGeometry(direction, centerX, centerY, width, height, radius, chordHalf, inset) {
  const edgeTop = inset;
  const edgeBottom = height - inset;
  const edgeLeft = inset;
  const edgeRight = width - inset;

  let chordA = null;
  let chordB = null;
  let arcCenterX = centerX;
  let arcCenterY = centerY;

  if (direction === "north") {
    chordA = { x: centerX - chordHalf, y: edgeTop };
    chordB = { x: centerX + chordHalf, y: edgeTop };
    const offset = Math.sqrt(Math.max(0, radius * radius - chordHalf * chordHalf));
    arcCenterX = centerX;
    arcCenterY = edgeTop - offset;
  } else if (direction === "south") {
    chordA = { x: centerX + chordHalf, y: edgeBottom };
    chordB = { x: centerX - chordHalf, y: edgeBottom };
    const offset = Math.sqrt(Math.max(0, radius * radius - chordHalf * chordHalf));
    arcCenterX = centerX;
    arcCenterY = edgeBottom + offset;
  } else if (direction === "west") {
    chordA = { x: edgeLeft, y: centerY + chordHalf };
    chordB = { x: edgeLeft, y: centerY - chordHalf };
    const offset = Math.sqrt(Math.max(0, radius * radius - chordHalf * chordHalf));
    arcCenterX = edgeLeft - offset;
    arcCenterY = centerY;
  } else if (direction === "east") {
    chordA = { x: edgeRight, y: centerY - chordHalf };
    chordB = { x: edgeRight, y: centerY + chordHalf };
    const offset = Math.sqrt(Math.max(0, radius * radius - chordHalf * chordHalf));
    arcCenterX = edgeRight + offset;
    arcCenterY = centerY;
  } else {
    return null;
  }

  const angleA = normalizeAngle(Math.atan2(chordA.y - arcCenterY, chordA.x - arcCenterX));
  const angleB = normalizeAngle(Math.atan2(chordB.y - arcCenterY, chordB.x - arcCenterX));

  const clockwiseMid = getArcMidpoint(arcCenterX, arcCenterY, radius, angleA, angleB, false);
  const counterMid = getArcMidpoint(arcCenterX, arcCenterY, radius, angleA, angleB, true);

  const clockwiseInside = isMidpointInside(direction, clockwiseMid, centerX, centerY);
  const counterInside = isMidpointInside(direction, counterMid, centerX, centerY);

  const anticlockwise = counterInside && !clockwiseInside;

  return {
    chordA,
    chordB,
    arcCenterX,
    arcCenterY,
    startAngle: angleA,
    endAngle: angleB,
    anticlockwise,
  };
}

function drawAdjacencyArc(ctx, direction, color, outlineColor, width, height, pathThickness) {
  const outlineWidth = Math.max(3, Math.round(pathThickness * 0.18));
  const chordHalf = pathThickness / 2;
  const inset = SCENE_FRAME_LINE_WIDTH + outlineWidth;
  const sceneCenterX = width / 2;
  const sceneCenterY = height / 2;
  const radius = Math.max(90, pathThickness * 1.8);

  const geometry = getArcGeometry(
    direction,
    sceneCenterX,
    sceneCenterY,
    width,
    height,
    radius,
    chordHalf,
    inset
  );
  if (!geometry) return;

  const { chordA, arcCenterX, arcCenterY, startAngle, endAngle, anticlockwise } = geometry;

  ctx.beginPath();
  ctx.moveTo(chordA.x, chordA.y);
  ctx.arc(arcCenterX, arcCenterY, radius, startAngle, endAngle, anticlockwise);
  ctx.lineTo(chordA.x, chordA.y);
  ctx.closePath();

  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = outlineWidth;
  ctx.beginPath();
  ctx.arc(arcCenterX, arcCenterY, radius, 0, Math.PI * 2);
  ctx.stroke();
}

export function drawAdjacencyHint(ctx, node, direction, width, height, biome, island) {
  if (!node || !node.position || !island) return;
  const neighborId = getNeighborIdForDirection(node, direction, (x, y) => {
    return (
      Object.values(island.nodes).find(
        (n) => n.position?.x === x && n.position?.y === y
      )?.id || null
    );
  });
  if (!neighborId) return;
  const neighbor = island.nodes[neighborId];
  if (!neighbor) return;
  const color = resolveNodeColor(neighbor);
  const pathThickness = Math.min(PATH_THICKNESS, width * 0.08);
  const outlineColor = biome?.pathOutline || "rgba(15, 23, 42, 0.55)";
  ctx.save();
  drawAdjacencyArc(ctx, direction, color, outlineColor, width, height, pathThickness);
  ctx.restore();
}

// ============================================================================
// Layout Functions
// ============================================================================

function getFeatureSlots(width, height) {
  const center = { x: width / 2, y: height / 2 };
  const insetX = Math.min(220, width * 0.3);
  const insetY = Math.min(190, height * 0.27);
  const corners = [
    { id: "southwest", x: center.x - insetX, y: center.y + insetY },
    { id: "northeast", x: center.x + insetX, y: center.y - insetY },
    { id: "northwest", x: center.x - insetX, y: center.y - insetY },
    { id: "southeast", x: center.x + insetX, y: center.y + insetY },
  ];
  corners.push({ id: "center-low", x: center.x, y: center.y + insetY * 0.65 });
  return corners;
}

function getShipSlot(width, height) {
  return {
    id: "ship-dock",
    x: width * 0.35,
    y: Math.min(height - 80, height * 0.6),
  };
}

function allocateFeatureSlots(features, slotsById) {
  const allocation = new Map();
  const available = Array.from(slotsById.values());
  const assignables = features.filter((feature) => feature.type !== "ship" && feature.id);
  const usedSlotIds = new Set();

  assignables.forEach((feature) => {
    if (feature.slotId && slotsById.has(feature.slotId)) {
      const slot = slotsById.get(feature.slotId);
      allocation.set(feature.id, slot);
      usedSlotIds.add(feature.slotId);
    }
  });

  const remainingSlots = available.filter((slot) => !usedSlotIds.has(slot.id));
  const remainingFeatures = assignables
    .filter((feature) => !allocation.has(feature.id))
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));

  remainingFeatures.forEach((feature, index) => {
    const slot = remainingSlots[index];
    if (!slot) return;
    allocation.set(feature.id, slot);
  });
  return allocation;
}

export function placeFeatures(features, width, height, node, isFeatureVisible) {
  const layout = [];
  const slots = getFeatureSlots(width, height);
  const slotsById = new Map(slots.map((slot) => [slot.id, slot]));
  const allocation = allocateFeatureSlots(features, slotsById);
  features.forEach((feature) => {
    const slot = feature.type === "ship" ? getShipSlot(width, height) : allocation.get(feature.id);
    if (!slot) return;
    if (!isFeatureVisible(feature)) return;
    layout.push({ ...feature, slot });
  });
  return layout;
}

function clampAnchor(anchor, canvasWidth, canvasHeight) {
  return {
    x: clamp(anchor.x, PROMPT_CARD_MARGIN, canvasWidth - PROMPT_CARD_MARGIN),
    y: clamp(anchor.y, PROMPT_CARD_MARGIN, canvasHeight - PROMPT_CARD_MARGIN),
  };
}

export function buildFeatureAnchors(features, width, height) {
  const anchors = new Map();
  features.forEach((feature) => {
    if (!feature?.actionId || !feature?.slot) return;
    const anchor = {
      x: feature.slot.x,
      y: feature.slot.y + FEATURE_SLOT_RADIUS + 28,
    };
    anchors.set(feature.actionId, clampAnchor(anchor, width, height));
  });
  return anchors;
}

// ============================================================================
// Prompt Card Drawing
// ============================================================================

function drawPromptCardBackground(ctx, x, y, width, height, isHighlighted, radius = 12) {
  ctx.save();
  ctx.fillStyle = CARD_BACKGROUND;
  ctx.strokeStyle = CARD_BORDER;
  ctx.lineWidth = 2;
  drawRoundedRectPath(ctx, x, y, width, height, radius);
  ctx.fill();
  ctx.stroke();
  if (isHighlighted) {
    ctx.strokeStyle = ACCENT_COLOR;
    ctx.lineWidth = 2;
    drawRoundedRectPath(ctx, x + 6, y + 6, width - 12, height - 12, Math.max(4, radius - 6));
    ctx.stroke();
  }
  ctx.restore();
}

function drawPromptCard(ctx, action, rect, highlightedActionId) {
  const isHighlighted = action.id === highlightedActionId;
  ctx.save();
  drawPromptCardBackground(ctx, rect.x, rect.y, rect.width, rect.height, isHighlighted);

  ctx.textBaseline = "middle";
  ctx.font = "600 16px 'Fira Mono', 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = PROMPT_COLOR;
  ctx.fillText(action.prompt, rect.x + rect.width / 2, rect.y + rect.height / 2);
  ctx.restore();
}

function rectFromAnchor(anchor, rectWidth, rectHeight, canvasWidth, canvasHeight) {
  const x = clamp(anchor.x - rectWidth / 2, PROMPT_CARD_MARGIN, canvasWidth - rectWidth - PROMPT_CARD_MARGIN);
  const y = clamp(anchor.y - rectHeight / 2, PROMPT_CARD_MARGIN, canvasHeight - rectHeight - PROMPT_CARD_MARGIN);
  return { x, y, width: rectWidth, height: rectHeight };
}

export function drawActionPrompts(ctx, actions, featureAnchors, width, height, highlightedActionId) {
  if (!actions.length) return;
  const anchoredEntries = [];
  const unanchored = [];
  actions.forEach((action) => {
    if (action.kind !== "move" && action.isCompleted) {
      return;
    }
    const anchor = featureAnchors.get(action.id);
    if (anchor) {
      anchoredEntries.push({ action, anchor });
    } else {
      unanchored.push(action);
    }
  });

  anchoredEntries.forEach(({ action, anchor }) => {
    const rect = rectFromAnchor(anchor, ANCHORED_PROMPT_WIDTH, ANCHORED_PROMPT_HEIGHT, width, height);
    drawPromptCard(ctx, action, rect, highlightedActionId);
  });

  if (!unanchored.length) return;

  const cardWidth = Math.min(360, width - 80);
  const totalHeight = unanchored.length * CENTER_PROMPT_HEIGHT + (unanchored.length - 1) * CENTER_PROMPT_GAP;
  const startY = Math.max(20, (height - totalHeight) / 2);
  const x = (width - cardWidth) / 2;

  unanchored.forEach((action, index) => {
    const y = startY + index * (CENTER_PROMPT_HEIGHT + CENTER_PROMPT_GAP);
    drawPromptCard(ctx, action, { x, y, width: cardWidth, height: CENTER_PROMPT_HEIGHT }, highlightedActionId);
  });
}

function getMovementRect(direction, width, height) {
  const w = Math.min(MOVEMENT_PROMPT_WIDTH, width - 80);
  const h = MOVEMENT_PROMPT_HEIGHT;
  const margin = 16;
  switch (direction) {
    case "north":
      return { x: (width - w) / 2, y: margin, width: w, height: h };
    case "south":
      return { x: (width - w) / 2, y: height - h - margin, width: w, height: h };
    case "west":
      return { x: margin, y: (height - h) / 2, width: w, height: h };
    case "east":
      return { x: width - w - margin, y: (height - h) / 2, width: w, height: h };
    default:
      return null;
  }
}

export function drawMovementPrompt(ctx, node, action, direction, width, height, highlightedActionId) {
  const rect = getMovementRect(direction, width, height);
  if (!rect) return;
  const isHighlighted = action.id === highlightedActionId;
  ctx.save();
  if (action.isCompleted) {
    ctx.globalAlpha = 0.5;
  }
  drawPromptCardBackground(ctx, rect.x, rect.y, rect.width, rect.height, isHighlighted);

  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.font = "600 16px 'Fira Mono', 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
  ctx.fillStyle = PROMPT_COLOR;
  ctx.fillText(action.prompt, rect.x + rect.width / 2, rect.y + rect.height / 2);
  ctx.restore();
}

// ============================================================================
// Win Screen
// ============================================================================

function drawWinScreen(ctx, width, height, successAction) {
  ctx.save();
  ctx.fillStyle = "rgba(248, 250, 252, 0.95)";
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  const headingY = Math.max(80, height * 0.25);
  ctx.save();
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 56px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("You win!", width / 2, headingY);
  ctx.restore();

  const scale = clamp(Math.min(width, height) / 520, 0.7, 1.25);
  const explorerBaseline = height * 0.65;
  drawExplorer(ctx, width / 2, explorerBaseline, scale);
  const cardBase = Math.max(headingY + 60, explorerBaseline + 90);

  const cardWidth = 280;
  const cardHeight = 56;
  const rect = {
    x: (width - cardWidth) / 2,
    y: Math.min(height - cardHeight - 40, cardBase),
    width: cardWidth,
    height: cardHeight,
  };
  drawPromptCard(ctx, { ...successAction, prompt: successAction.prompt }, rect, null);
}

// ============================================================================
// Explorer Drawing (delegates to explorer.js)
// ============================================================================

function drawExplorerInScene(ctx, width, height, status) {
  if (status !== "playing") return;
  const scale = clamp(Math.min(width, height) / 520, 0.7, 1.05);
  const x = width / 2;
  const y = height / 2;
  drawExplorer(ctx, x, y, scale);
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Renders a complete scene to a canvas context.
 *
 * @param {CanvasRenderingContext2D} ctx - The canvas 2D context
 * @param {number} width - Canvas width in CSS pixels
 * @param {number} height - Canvas height in CSS pixels
 * @param {object} config - Configuration object
 * @param {object} config.node - The current node being rendered
 * @param {Array} config.actions - Actions available at this node (with prompt, kind, etc.)
 * @param {object} config.state - Game state (status, completedFeatures, etc.)
 * @param {object} config.island - The island data structure
 * @param {string|null} config.highlightedActionId - ID of action to highlight
 * @param {object} config.successAction - Action shown on win screen
 * @param {boolean} config.hidePrompts - Whether to hide prompt cards
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
  } = config;

  const safeActions = Array.isArray(actions) ? actions : [];

  // Helper to find node at position
  const getNodeIdAtPosition = (targetX, targetY) => {
    if (!island?.nodes) return null;
    return (
      Object.values(island.nodes).find(
        (n) => n.position?.x === targetX && n.position?.y === targetY
      )?.id || null
    );
  };

  // Helper to check feature visibility - use callback if provided
  const isFeatureVisibleFn = isFeatureVisibleCallback || ((feature) => {
    if (!feature) return false;
    if (feature.removable && state?.completedFeatures?.has(feature.id)) {
      return false;
    }
    return true;
  });

  // Clear and fill background
  const color = resolveNodeColor(node) || SCENE_DEFAULT_COLOR;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);

  // Categorize actions
  const movementEntries = [];
  const centerEntries = [];
  safeActions.forEach((action) => {
    if (action.kind === "move") {
      const direction = getMovementDirection(node, action, island);
      if (direction) {
        movementEntries.push({ action, direction });
        return;
      }
    }
    centerEntries.push(action);
  });

  // Normalize and place features
  const normalizedFeatures = Array.isArray(node?.features)
    ? node.features
        .map((feature) => {
          const normalized = normalizeFeatureEntry(feature);
          if (!normalized) return null;
          const isComplete = state?.completedFeatures?.has(feature.id) ?? false;
          return { ...normalized, isComplete };
        })
        .filter((feature) => feature)
    : [];

  const featureLayout = placeFeatures(normalizedFeatures, width, height, node, isFeatureVisibleFn);
  const featureAnchors = buildFeatureAnchors(featureLayout, width, height);

  // Draw biome background
  const biome = getBiomeById(node?.biome);
  drawBiomeBackground(ctx, width, height, node, biome, getNodeIdAtPosition);

  // Draw paths
  drawBiomePaths(ctx, node, movementEntries, width, height, biome);

  // Draw explorer
  drawExplorerInScene(ctx, width, height, state?.status);

  // Draw adjacency hints
  movementEntries.forEach(({ direction }) => {
    drawAdjacencyHint(ctx, node, direction, width, height, biome, island);
  });

  // Draw features
  drawFeatures(ctx, featureLayout);

  // Draw prompts (unless hidden)
  if (!hidePrompts) {
    movementEntries.forEach(({ action, direction }) => {
      drawMovementPrompt(ctx, node, action, direction, width, height, highlightedActionId);
    });
  }

  // Draw win screen or action prompts
  if (state?.status === "success" && successAction) {
    drawWinScreen(ctx, width, height, successAction);
  } else {
    if (!hidePrompts) {
      drawActionPrompts(ctx, centerEntries, featureAnchors, width, height, highlightedActionId);
    }
  }

  return { featureLayout, featureAnchors };
}

// ============================================================================
// Helper Functions
// ============================================================================

function getMovementDirection(node, action, island) {
  if (!node || action.kind !== "move" || !action.to) return null;
  const destination = island?.nodes?.[action.to];
  if (!destination || !destination.position || !node.position) {
    return null;
  }
  const deltaX = destination.position.x - node.position.x;
  const deltaY = destination.position.y - node.position.y;
  if (deltaX === 0 && deltaY === -1) return "north";
  if (deltaX === 0 && deltaY === 1) return "south";
  if (deltaX === -1 && deltaY === 0) return "west";
  if (deltaX === 1 && deltaY === 0) return "east";
  return null;
}
