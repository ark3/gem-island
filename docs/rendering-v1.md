# Gem Island Rendering Notes (v1)

## Purpose

This document captures the initial rendering approach for Gem Island’s playable screens.
It supplements the design snapshots by explaining **how** we plan to draw nodes, biomes,
paths, and features inside the canvas-based scene renderer.

---

## Guiding principles

- Rendering is **data-driven**: scene visuals are derived from node metadata
  (type, biome, features, adjacency) instead of hard-coded DOM layouts.
- Layers are composable: biome base, path structure, and feature overlays draw sequentially
  so we can mix and match without rewriting renderers.
- Movement prompts stay tied to physical direction, supporting recognition over memory.
- Decorative cues (adjacency hints, biome textures) reinforce the mental map without
  affecting gameplay semantics.

---

## Scene layer stack

Each node render is composed of three conceptual layers:

1. **Biome base**
   - Provides the background color/texture, edge treatments, and any ambient decorations
     (e.g., waves on a beach edge, tree canopy in a forest).
   - Knows how to draw “solid edges” versus “path openings” based on movement directions.
   - Supplies style tokens for the path layer (boardwalk planks, dirt, stone, etc.).

2. **Path structure**
   - Interprets available movement directions (N/S/E/W) and lays out up to four “arms”
     that connect the center of the scene to each prompt location.
   - Reserves clear rectangular zones for each arm so prompts and art never intersect the
     paths.
   - Draws adjacency color hints near each movement prompt, using the neighbor node’s
     dominant color to suggest the upcoming area.

3. **Feature overlays**
   - Places node-specific objects like gems, pocket entrances, NPCs, or quest items.
   - Uses a slot system to avoid collisions: biomes expose known anchor points (center,
     corners, near-path slots) and the feature renderer selects from available slots.
   - Each feature definition includes prompt anchor offsets so typing prompts can be
     drawn adjacent to the object without visual overlap.

Layers render sequentially on the shared canvas, so new biomes or features can plug in
by implementing their `draw(ctx, node, theme)` hooks without touching the game loop.

---

## Node types and movement

- **Node types (start/path/feature/pocket/dialog)** still describe gameplay intent,
  but surface movement actions are now derived from grid adjacency.
  - The node type drives which features/actions are allowed, pacing, and map styling.
  - Movement prompts are auto-generated for north/south/east/west neighbors, guaranteeing
    consistent placement and return direction across the island.
- Pocket entrances and other non-surface transitions remain explicit actions; they render
  as features rather than surface movement prompts.

---

## Biomes

A biome definition provides:

- **Palette:** dominant background color plus optional secondary colors for edges,
  adjacency hints, and path fills.
- **Edge/Path treatments:** functions that render solid coastline, waves, boardwalks,
  forest floors, etc. based on which directions are open for movement.
- **Decor rune registry:** optional decorative shapes (rocks, shells, shrubs) that can be
  placed in reserved slots when a node requests them.

Biomes are referenced by ID in node data. This keeps island generation flexible:
switching a node from “beach” to “forest” only changes which biome renderer executes,
while features/prompt layout stay the same.

---

## Feature metadata

Features describe both gameplay objects and their visual footprint. Each feature entry
defines:

- `id` and optional parameters (e.g., gem cluster count).
- `draw(ctx, slot, theme)` hook to render the asset inside the assigned slot.
- `promptAnchor(slot)` function returning the offset for the prompt bubble relative to
  the drawn object.
- Optional constraints (requires corner slot, avoid center, etc.).

Node definitions list features by ID (with parameters if needed). The renderer runs a
placement pass:

1. Query the biome for available slots after path reservation.
2. For each feature, pick the first slot that satisfies its constraints.
3. Draw the feature and record the prompt anchor so actions can be positioned correctly.
4. If no slot fits, use a fallback (e.g., center stack) and log/debug for manual tuning.

---

## Adjacency color hints

Per Visual Notes v1, movement directions display subtle color hints from neighboring nodes:

- When rendering a path arm, the renderer looks up the neighbor’s dominant color
  (`island.nodes[to].color`) and draws a small block or pattern near the movement prompt.
- The hint uses biome-specific styling (e.g., wavy line for beaches) but always reuses the
  neighbor color to reinforce recognition.
- Movement prompts sit on top of the hint; if no neighbor exists, the hint is skipped.

---

## Prompt handling

- **Movement prompts** are cards anchored to the canvas edges (top/bottom/left/right).
  They show the typed prompt token, support highlight states, and remain available because
  movement actions never complete.
- **Non-movement prompts** are attached to feature slots. If a feature doesn’t provide a
  custom anchor, prompts fall back to the center stack as today.
  - Consumable features (gems, pickup-only items) remove their prompt and art entirely
    once completed.
  - Persistent features (NPCs, scenery) remain visible; their actions may update text but
    do not disappear or dim.
- The TypingEngine remains agnostic; only the canvas layer changes how prompts are drawn.

---

This document will evolve as the renderer gains real art assets and new gameplay
interactions. For now it serves as the shared reference for implementing the canvas
renderer and its supporting data structures.
