# Island Exploration Typing Game — Visual Notes (v1)

## Purpose of this document

This document captures the **current visual direction** of the game at a descriptive level.

It is intentionally:
- **non-prescriptive**,
- **subject to change**,
- and grounded in concrete exemplar screens rather than abstract rules.

It complements **Design Snapshot v2** by describing how the game *should look and feel*, without locking down final art style, assets, or rendering techniques.

---

## High-level visual goals

- Friendly, calm, and readable for children
- Exploration feels safe and non-threatening
- Visuals support **recognition over memory**
- Typing interaction is visible but not dominant
- Scenes feel hand-made rather than polished or realistic

---

## Overall visual style

### Coloring-book aesthetic

- Thick black outlines for **objects and icons**
- Flat fills with solid colors
- No gradients, lighting, or shading
- Minimal detail: *just enough* to identify objects

The visual inspiration is pen drawings colored in by hand.

---

### Camera and composition

- Slightly tilted top-down view
- Large, readable shapes
- Clear negative space near screen edges
- Scene art never overlaps the description text area

---

## Playable screen visuals

### Dominant color

- Each node has a **single dominant background color**
  - e.g. sand for beaches, green for forest, gray for caves
- This color defines the node’s identity
- The same color is later reused on the map

---

### Scene detail

- Objects are symbolic, not realistic
- Flat shapes with outlines
- Optional very subtle internal patterning is allowed (e.g. sand grain)
  - Must not resemble shading
  - Must not imply lighting or depth

---

### Movement and spatial cues

- Movement directions are conveyed spatially:
  - forward/north → top of screen
  - back/south → bottom
  - west/east → left/right

- Paths or scene geometry visually suggest direction
- No arrows or textual explanations are required

---

### Action prompts

- All actions use a **uniform prompt container**
- Prompt containers:
  - have rounded outlines
  - are placed directly on or near the object they act on
  - change color to indicate typing state

- Movement prompts are placed near path endpoints
- Pickup prompts are placed next to the object

Completed non-movement actions disappear entirely.

---

### Description text area

- Each playable screen reserves space below the scene for:
  - 0–2 short sentences of descriptive text
- This area is optional and may be empty
- Text never overlaps the scene rendering

---

### World continuity hints

- Scenes always represent the “real world”
- Visuals do not change based on discovery state

- Near the ends of paths, **adjacency color hints** may appear:
  - flat shapes using the adjacent node’s dominant color
  - limited to a small area near the path
  - never mixing unrelated regions (e.g. sand into ocean)

These hints subtly suggest connection without revealing new scenes.

---

## Map visuals

### Purpose of the map

- The map is informational, not interactive
- It reflects player knowledge, not the world itself

---

### Layout

- Grid-based layout
- Each surface node occupies one grid cell
- Adjacency is shown by shared edges
- The entire map may rotate in 90° increments to fit the viewport

---

### Node regions

- Nodes are rendered as **rectangular regions**
- Regions:
  - do not have black outlines by default
  - are differentiated by fill color

- Fill color is derived from the node’s dominant scene color

---

### Node states

- **Undiscovered**: no fill (background only)
- **Discovered**: filled with scene color
- **Completed**: filled with scene color + large green check mark

---

### Icons on the map

- **Player icon**:
  - outlined
  - placed inside the current node
  - slightly offset to avoid overlapping other icons

- **Pocket entrance icon**:
  - outlined
  - placed inside the parent node
  - appears only after the node is discovered

- **Pocket completion**:
  - shown with a small green check on the entrance icon

Icons use the same coloring-book outline style as scene objects.

---

### Progress indicators

- Gem progress (collected vs required) is always visible
- Uses the same gem icon style as playable screens

---

## What is intentionally not defined yet

The following are deliberately left open:

- exact color palette
- exact line weights
- typography choices
- animation or transitions
- asset production pipeline

These are expected to evolve through implementation and iteration.

---

## Status

This document represents **Visual Notes v1**.

It should be treated as:
- a shared reference,
- a guide for consistency,
- and a starting point for iteration,
not as a final art specification.

