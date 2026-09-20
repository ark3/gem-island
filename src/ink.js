// Ink — the drawing vocabulary shared by every surface in Gem Island.
//
// Everything visible is drawn with these primitives so the game reads as one
// hand-coloured picture book rather than a set of unrelated canvases. See
// `docs/visual-v2.md` for the art direction these tokens encode.
//
// Two rules govern this module:
//
//   1. Flat colour only. No gradients, no shading, no lighting. Depth comes
//      from outline weight and overlap, never from a light source.
//   2. Every wobble is seeded. A shape drawn with the same seed wobbles the
//      same way on every frame, so an animated scene never shimmers.
//
// Pure canvas helpers with no game knowledge — nothing here imports game state.

// ============================================================================
// Tokens
// ============================================================================

export const INK = "#2f2418";
export const INK_LIGHT = "#6b5a46";
export const PAPER = "#fdf4e0";
export const PAPER_DEEP = "#f4e6c8";
export const PAPER_EDGE = "#e2cfa6";

// Typing states. HIGHLIGHT marks the letters already entered, READY the prompt
// the buffer currently completes.
export const HIGHLIGHT = "#f2a516";
export const READY = "#3fa34d";
export const ALERT = "#d1495b";

export const FONT_STACK =
  '"Baloo 2", "Trebuchet MS", "Segoe UI", system-ui, -apple-system, sans-serif';

export function font(size, weight = 700) {
  return `${weight} ${Math.round(size)}px ${FONT_STACK}`;
}

// ============================================================================
// Numbers
// ============================================================================

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Smooth 0..1 ramp — used for every transition so easing is consistent. */
export function easeInOut(t) {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
}

export function easeOut(t) {
  return 1 - (1 - clamp(t, 0, 1)) ** 3;
}

/** Deterministic 0..1 noise. Same inputs always give the same output. */
export function noise(a, b = 0) {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Deterministic -1..1 noise. */
export function signedNoise(a, b = 0) {
  return noise(a, b) * 2 - 1;
}

export function alpha(hex, a) {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Mix two hex colours. Used to derive flat tints, never to fake a gradient. */
export function mix(hexA, hexB, t) {
  const parse = (hex) => {
    const value = hex.replace("#", "");
    const full =
      value.length === 3
        ? value
            .split("")
            .map((c) => c + c)
            .join("")
        : value;
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
    ];
  };
  const a = parse(hexA);
  const b = parse(hexB);
  const out = a.map((channel, i) => Math.round(lerp(channel, b[i], clamp(t, 0, 1))));
  return `#${out.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

// ============================================================================
// Hand-drawn geometry
// ============================================================================

/**
 * Resamples a polygon, nudging the new points sideways so the edge looks drawn
 * by hand. The wobble tapers to zero at the original vertices, so corners stay
 * where they were put and short edges stay straight.
 */
export function roughen(points, { seed = 1, rough = 2, closed = true, step = 22 } = {}) {
  if (points.length < 2) return points.slice();
  const out = [];
  const count = points.length;
  const edges = closed ? count : count - 1;
  let index = 0;
  for (let i = 0; i < edges; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % count];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;
    const steps = clamp(Math.round(length / step), 1, 28);
    for (let s = 0; s < steps; s += 1) {
      const t = s / steps;
      const taper = Math.sin(Math.PI * t);
      const amp = signedNoise(seed * 7.3 + 1, index * 1.7 + 1) * rough * taper;
      out.push({ x: a.x + dx * t + nx * amp, y: a.y + dy * t + ny * amp });
      index += 1;
    }
  }
  if (!closed) out.push(points[count - 1]);
  return out;
}

/** Traces straight segments — keeps intended corners sharp. */
export function traceLinear(ctx, points, closed = true) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  if (closed) ctx.closePath();
}

/** Traces a rounded curve through the points — for organic contours. */
export function traceSmooth(ctx, points, closed = true) {
  if (points.length < 3) {
    traceLinear(ctx, points, closed);
    return;
  }
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  ctx.beginPath();
  if (closed) {
    const start = mid(points[points.length - 1], points[0]);
    ctx.moveTo(start.x, start.y);
    for (let i = 0; i < points.length; i += 1) {
      const current = points[i];
      const next = points[(i + 1) % points.length];
      const m = mid(current, next);
      ctx.quadraticCurveTo(current.x, current.y, m.x, m.y);
    }
    ctx.closePath();
    return;
  }
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length - 1; i += 1) {
    const m = mid(points[i], points[i + 1]);
    ctx.quadraticCurveTo(points[i].x, points[i].y, m.x, m.y);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
}

function applyInkStroke(ctx, lw, color) {
  ctx.lineWidth = lw;
  ctx.strokeStyle = color;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
}

/**
 * The workhorse: fill a shape flat and outline it in ink.
 *
 * @param {Array<{x:number,y:number}>} points
 * @param {object} opts
 * @param {string} [opts.fill]    flat fill colour, omit for outline only
 * @param {string} [opts.stroke]  outline colour, defaults to INK
 * @param {number} [opts.lw]      outline weight, 0 for no outline
 * @param {number} [opts.seed]    wobble seed — keep stable across frames
 * @param {number} [opts.rough]   wobble amplitude in pixels
 * @param {boolean} [opts.smooth] round the corners (organic shapes)
 * @param {boolean} [opts.closed]
 */
export function inkShape(ctx, points, opts = {}) {
  const {
    fill = null,
    stroke = INK,
    lw = 3,
    seed = 1,
    rough = 1.6,
    smooth = false,
    closed = true,
    step = 22,
  } = opts;
  const pts = rough > 0 ? roughen(points, { seed, rough, closed, step }) : points;
  const trace = smooth ? traceSmooth : traceLinear;
  if (fill) {
    trace(ctx, pts, closed);
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (lw > 0) {
    trace(ctx, pts, closed);
    applyInkStroke(ctx, lw, stroke);
  }
  return pts;
}

/** A circle with a hand-drawn contour. */
export function inkCircle(ctx, cx, cy, radius, opts = {}) {
  const { sides = Math.max(10, Math.round(radius / 2.2)) } = opts;
  const points = [];
  for (let i = 0; i < sides; i += 1) {
    const angle = (i / sides) * Math.PI * 2;
    points.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
  }
  return inkShape(ctx, points, { smooth: true, rough: 1.1, step: 999, ...opts });
}

/** An ellipse with a hand-drawn contour. */
export function inkEllipse(ctx, cx, cy, rx, ry, opts = {}) {
  const { rotation = 0, sides = 22 } = opts;
  const points = [];
  for (let i = 0; i < sides; i += 1) {
    const angle = (i / sides) * Math.PI * 2;
    const x = Math.cos(angle) * rx;
    const y = Math.sin(angle) * ry;
    points.push({
      x: cx + x * Math.cos(rotation) - y * Math.sin(rotation),
      y: cy + x * Math.sin(rotation) + y * Math.cos(rotation),
    });
  }
  return inkShape(ctx, points, { smooth: true, rough: 1.1, step: 999, ...opts });
}

/** A rounded rectangle with a hand-drawn contour. */
export function inkRect(ctx, x, y, width, height, opts = {}) {
  const { radius = 10 } = opts;
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  const points = [];
  const corner = (cx, cy, from) => {
    const steps = 5;
    for (let i = 0; i <= steps; i += 1) {
      const angle = from + (i / steps) * (Math.PI / 2);
      points.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
    }
  };
  if (r <= 0.5) {
    points.push({ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height });
  } else {
    corner(x + width - r, y + r, -Math.PI / 2);
    corner(x + width - r, y + height - r, 0);
    corner(x + r, y + height - r, Math.PI / 2);
    corner(x + r, y + r, Math.PI);
  }
  return inkShape(ctx, points, { rough: 1.1, ...opts });
}

/** An open ink line — paths, stems, whiskers, ropes. */
export function inkLine(ctx, points, opts = {}) {
  const { stroke = INK, lw = 3, seed = 1, rough = 1.4, smooth = true, step = 22 } = opts;
  const pts = rough > 0 ? roughen(points, { seed, rough, closed: false, step }) : points;
  (smooth ? traceSmooth : traceLinear)(ctx, pts, false);
  applyInkStroke(ctx, lw, stroke);
  return pts;
}

/** A pointed star — sparkles, celebration confetti, map markers. */
export function inkStar(ctx, cx, cy, outer, opts = {}) {
  const { points: spokes = 5, inner = outer * 0.44, rotation = -Math.PI / 2 } = opts;
  const points = [];
  for (let i = 0; i < spokes * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = rotation + (i / (spokes * 2)) * Math.PI * 2;
    points.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
  }
  return inkShape(ctx, points, { rough: 0.6, step: 999, ...opts });
}

// ============================================================================
// Flat texture
//
// visual-v1 allows "very subtle internal patterning" but forbids anything that
// reads as shading. These draw marks — dots, dashes, hatching — never washes.
// ============================================================================

/** Scattered dots. Deterministic for a given seed. */
export function stipple(ctx, rect, opts = {}) {
  const { color = alpha(INK, 0.18), count = 60, radius = 2, seed = 3 } = opts;
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < count; i += 1) {
    const x = rect.x + noise(seed + i * 1.13, 11) * rect.width;
    const y = rect.y + noise(seed + i * 2.07, 29) * rect.height;
    const r = radius * (0.6 + noise(seed + i, 5) * 0.8);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Short parallel dashes — grass, fur, grain. */
export function hatch(ctx, rect, opts = {}) {
  const {
    color = alpha(INK, 0.16),
    count = 40,
    length = 14,
    angle = -Math.PI / 2,
    lw = 2.5,
    seed = 7,
    jitter = 0.35,
  } = opts;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  for (let i = 0; i < count; i += 1) {
    const x = rect.x + noise(seed + i * 1.71, 13) * rect.width;
    const y = rect.y + noise(seed + i * 3.11, 41) * rect.height;
    const a = angle + signedNoise(seed + i, 3) * jitter;
    const len = length * (0.7 + noise(seed + i, 17) * 0.6);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.restore();
}

/** Paper grain for the page itself. Very low contrast by design. */
export function paperGrain(ctx, width, height, seed = 1) {
  ctx.save();
  ctx.fillStyle = alpha(PAPER_EDGE, 0.5);
  const count = Math.round((width * height) / 7000);
  for (let i = 0; i < count; i += 1) {
    const x = noise(seed + i * 1.37, 23) * width;
    const y = noise(seed + i * 2.91, 57) * height;
    ctx.fillRect(x, y, 1.6, 1.6);
  }
  ctx.restore();
}

// ============================================================================
// Text
// ============================================================================

export function inkText(ctx, text, x, y, opts = {}) {
  const {
    size = 18,
    weight = 700,
    color = INK,
    align = "center",
    baseline = "middle",
  } = opts;
  ctx.save();
  ctx.font = font(size, weight);
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function measureText(ctx, text, size, weight = 700) {
  ctx.save();
  ctx.font = font(size, weight);
  const width = ctx.measureText(text).width;
  ctx.restore();
  return width;
}
