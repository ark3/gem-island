# Renderer Redesign Proposal

This document outlines three distinct design directions for improving the Gem Island renderer. The goal is to move away from the current "functional but ugly" implementation towards a more cohesive, pleasing aesthetic that aligns with the "Coloring-book" vision described in `docs/visual-v1.md`.

## Current State Analysis

The current renderer (`src/scene-renderer.js`) is functional but lacks visual cohesion.
- **Pros:** Clear separation of layers (Biomes -> Paths -> Features).
- **Cons:**
  - Shapes are primitive and rigid (perfect circles/rectangles).
  - "Texture" is achieved via simple dots, which looks mechanical.
  - No consistent "hand" or style unifying the elements.
  - Colors are flat without interest.

## Design Goals (from `docs/visual-v1.md`)
- **"Coloring-book aesthetic"**: Thick black outlines, flat fills.
- **"Friendly, calm, and readable"**.
- **"Slightly tilted top-down view"**.
- **"Recognition over memory"**.

---

## Option 1: The "Organic Ink" Style

### Concept
Emulate the look of a hand-drawn illustration. Lines should not be perfectly straight; circles should not be perfect circles. The aesthetic is "imperfectly perfect," like a well-executed doodle or a high-quality children's book illustration.

### Visual Characteristics
- **Line Quality:** "Wobbly" or "rough" lines. Varying thickness (simulated pressure).
- **Fills:** Solid colors, but perhaps slightly offset from the outlines or with a subtle "marker" texture (procedural noise).
- **Shapes:** Organic. Trees are clouds on sticks, rocks are lumpy potatoes.
- **Details:** Hatching or stippling for shading/texture instead of gradients.

### Technical Implementation
- **Vertex Perturbation:** Instead of drawing `lineTo(x, y)`, implementation a `roughLine(x1, y1, x2, y2)` function that subdivides the line and adds perpendicular noise to the vertices.
- **Double-Stroke:** Draw important outlines twice with slightly different noise seeds to create a "sketchy" look.
- **Noise Function:** Implement a simple 1D noise function (e.g., Perlin or value noise) to drive the wobble, ensuring continuity.
- **Context Wrapper:** Create a `RoughContext` wrapper around the canvas context to intercept `moveTo`, `lineTo`, `arc`, etc., and apply the roughness automatically.

### Pros
- **Highly Distinctive:** Immediately stands out as "Gem Island style".
- **Fits the Theme:** perfectly aligns with "safe", "calm", and "coloring book".
- **Forgiving:** Small placement errors look like artistic choices.

### Cons
- **Complexity:** Requires a custom drawing library (or a small internal implementation of one).
- **Performance:** Drawing many small segments for every line is more expensive (though likely negligible for this simple game).

---

## Option 2: The "Clean Vector" Style

### Concept
A bold, modern, "sticker-art" aesthetic. This leans into the digital nature of the medium but keeps the "thick outline" rule. It looks like a high-quality icon set or a vector illustration.

### Visual Characteristics
- **Line Quality:** Uniform, thick, consistent black outlines. Rounded caps and joins (`lineCap = 'round'`, `lineJoin = 'round'`).
- **Shapes:** Geometric simplification. Trees are triangles or perfect circles. Rocks are rounded rectangles.
- **Fills:** Bright, flat colors. High contrast.
- **Depth:** No shadows or texture. Purely flat.

### Technical Implementation
- **Standard Canvas API:** Relies heavily on standard `stroke()` and `fill()`.
- **Path Primitives:** Build a library of reusable geometric primitives (RoundedPoly, Star, Gear) to construct complex features.
- **Bold Palette:** Use a strictly limited, high-saturation color palette.

### Pros
- **Readability:** extremely clear and readable. "Recognition" is very high.
- **Simplicity:** Easiest to implement and maintain.
- **Performance:** Very fast rendering.

### Cons
- **"Generic" Feel:** Risk of looking like generic "clip art" or "corporate Memphis" style if not careful.
- **Less "Warm":** Might feel a bit sterile compared to the Organic option.

---

## Option 3: The "Paper Cutout" Style

### Concept
A "diorama" or "pop-up book" aesthetic. Elements look like they are cut out of construction paper and layered on top of each other.

### Visual Characteristics
- **Depth:** Every element has a "drop shadow" (a solid offset copy of the shape in a dark color) to simulate lifting off the page.
- **Layers:** Strong emphasis on layering. The "Path" layer sits clearly above the "Biome" layer, and "Features" sit clearly above "Paths".
- **Texture:** Subtle paper grain texture overlay (can be a static image or procedural noise).
- **Outlines:** Can be white (sticker style) or dark (cutout style).

### Technical Implementation
- **Shadow Pass:** For every object, draw it first at `(x + offset, y + offset)` with a shadow color, then draw it at `(x, y)` with the main color.
- **Ordering:** Strict painter's algorithm is crucial.
- **Paper Texture:** Apply a `globalCompositeOperation = 'multiply'` or `overlay` with a noise texture at the end of the frame.

### Pros
- **Tactile Feel:** Gives the world a sense of "toy-like" physicality.
- **Depth:** Solves the flatness issue without full 3D.
- **Playful:** Fits the "exploration" theme well.

### Cons
- **Visual Noise:** Drop shadows can add clutter if there are many objects.
- **"Coloring Book" Conflict:** Slightly deviations from the strict "flat fill" rule of the coloring book aesthetic (though "flat layers" is arguably still compatible).

---

## Recommendation

I recommend **Option 1 (The "Organic Ink" Style)**.

**Reasoning:**
1.  It is the truest realization of the "Coloring-book aesthetic" (hand-drawn, ink on paper).
2.  It inherently feels "safe" and "calm", matching the core design pillars.
3.  It sets the game apart visually from generic vector art games.
4.  The technical complexity is manageable (we don't need a full physics engine, just a line perturber).

**Proposed Next Steps:**
1.  Implement a `RoughCanvas` helper class in `src/renderer-utils.js` (or similar).
2.  Port the existing biome/feature drawing functions to use this helper.
3.  Tune the "roughness" parameters to ensure readability is maintained.
