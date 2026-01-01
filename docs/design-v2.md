# Island Exploration Typing Game — Design Snapshot (v2)

## Purpose of this document

This document is a **design snapshot**, not an implementation guide.

It supersedes and clarifies parts of Design Snapshot v1 by making several previously implicit constraints explicit, especially around:

- spatial semantics,
- map behavior,
- completion rules,
- and pocket (interior) structure.

It remains intentionally agnostic about:
- UI layout specifics,
- rendering technology,
- art style details,
- and implementation strategy.

---

## What’s new in v2 (summary)

Compared to v1, this document:

- makes spatial directionality explicit and binding,
- tightens the definition and role of the map,
- fully specifies node and pocket completion semantics,
- finalizes the pocket model and its constraints,
- and clarifies which aspects remain undefined by design.

These changes are driven by player cognition and generation safety, not by visual polish.

---

## Clarified spatial model

### Directional consistency

- All movement actions are associated with a **screen direction**:
  - North / forward → top of the screen
  - South / backward → bottom of the screen
  - West → left side of the screen
  - East → right side of the screen

- When a player exits a node using a movement action on one side of the screen, the corresponding return action on the destination node appears on the **opposite side**.

This applies uniformly across the island.

### Design intent

This spatial consistency:
- supports recognition over memory,
- reduces disorientation without UI chrome,
- allows players to build a mental map through movement alone.

### Structural implications

- Screens must reserve usable space on all four edges for movement affordances.
- Graphs must be reversible and planar enough to preserve relative direction.

---

## Updated map semantics

### Role of the map

The map is a **reference and catalog screen**, not a navigation tool.

It exists to:
- reflect discovery,
- show progress and completion,
- reassure the player that exploration is bounded and safe.

The map does **not**:
- allow navigation,
- accept typing input in v1,
- replace moment-to-moment exploration.

---

### Spatial correspondence

- The map preserves **relative spatial relationships** between nodes.
- If a node is reached by moving north/east/etc., it appears correspondingly positioned on the map.
- This constrains island generation and is intentional.

---

### Node representation

- The map shows **surface nodes only**.
- Each node is rendered as a single shape with:
  - an outline,
  - a fill color (once discovered),
  - optional completion marking.

#### Node color

- Once a node is discovered, its **dominant scene color** becomes the node’s fill color on the map.
- Each node therefore has a single identity color.

---

### Node states

Nodes exist in exactly three states:

1. **Undiscovered**
   - Outline only
   - No fill color

2. **Discovered (not completed)**
   - Filled with the node’s scene color

3. **Completed**
   - Filled with the node’s scene color
   - Marked with a large green check mark

The current node is visually emphasized (e.g., thicker outline or ring) without implying interactivity.

---

### Progress display

- Gem progress (collected vs required) is always visible on the map.
- Gem icons reuse the same visual identity as in playable screens.

---

## Completion semantics (derived, not stored)

### Node completion

A node is **completed** when all **non-movement actions** on that node are completed.

- Completion is derived, not stored.
- Nodes with no non-movement actions may complete immediately upon discovery.

#### Visual signaling

- On playable screens: completed actions disappear; a completed node may show a check mark near the title.
- On the map: completed nodes display a large green check mark.

---

### Pocket completion

A pocket is **completed** when all non-movement actions in **all pocket nodes** are completed.

- Pocket completion is fully derivable.
- No persistent completion flags are required.

#### Visual signaling

- On the map: the pocket entrance icon receives a small green check mark.
- On the parent node screen: the pocket entrance rendering mirrors the same check mark.

Pocket completion does **not** affect parent node completion.

---

## Pocket model (finalized)

### Pocket structure

- Pockets are small interior sub-areas entered from a parent feature node.
- Pocket graphs:
  - are isolated,
  - are non-branching,
  - have a maximum depth of **1–3 nodes**,
  - always reconnect to their parent feature.

There are:
- no nested pockets,
- no cross-pocket connections.

---

### Pocket representation on the map

- Pocket **entrances** are shown on the map **inside the parent node’s area**.
- Pocket **nodes themselves never appear** on the map.

#### Discovery

- Pocket entrances do not appear until the parent node is discovered.
- There is no separate undiscovered-pocket state.

#### Completion

- When a pocket is completed, its entrance icon receives a check mark.

The map always represents the surface of the island only.

---

## Reset semantics (unchanged from v1)

On starting a new island:
- all state is discarded,
- all nodes reset to undiscovered,
- all completion is cleared.

No progress persists between runs.

---

## What remains intentionally undefined

The following are explicitly **out of scope** for this snapshot:

- detailed visual grammar or art style
- UI layout specifics
- animation or transition behavior
- audio
- typing difficulty scaling
- procedural generation algorithms

These are expected to be informed by implementation experience and future iteration.

---

## Design invariant (unchanged)

> Exploration is driven by **recognition, not memory**.
> Typing enables interaction but is never the point.
> Progress is visible, safe, and finishable.

All future changes should preserve this invariant.

