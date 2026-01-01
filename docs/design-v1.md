# Island Exploration Typing Game — Design Snapshot (v1)

## Purpose of this document

This document is a **design snapshot**, not an implementation guide.

It captures:
- the intended player experience,
- the core game model,
- the structural constraints that make the game work.

It does **not** prescribe:
- UI layout details,
- file structure,
- specific technologies,
- or step-by-step implementation tasks.

Future changes should update this document intentionally, not incrementally.

---

## High-level goals

1. **Exploration-first**
   - The primary pleasure is discovering places and marking them as explored/completed.
   - Exploration is safe, bounded, and non-threatening.

2. **Typing as an invisible skill**
   - Typing drives interaction but is not framed as a test.
   - Typed text is decoupled from action semantics.
   - Speed and difficulty scaling are optional layers, not required for v1.

3. **Short, replayable runs**
   - Each island takes ~5–15 minutes.
   - Runs reset completely on completion.

4. **Child-friendly**
   - No failure states.
   - No penalties.
   - No time pressure.
   - Clear completion signals.

---

## Core gameplay loop

1. Player arrives at an island by ship.
2. Player explores the island, screen by screen.
3. Player collects visible gems.
4. Player may complete optional side activities (quests, exploration).
5. Player returns to the ship.
6. If enough gems are collected:
   - the island run ends successfully,
   - everything resets,
   - a new island can begin.

The player decides when they are done exploring. Exploring forever is allowed.

---

## Screen model

The game consists of **static screens**. There is no animation other than:
- typing feedback,
- and visual indication that an action succeeded.

Each screen:
- shows a single scene,
- shows all available actions simultaneously,
- associates each action with a visible text prompt to type.

There is no cursor-based selection system.

---

## Node types (screen types)

### 1. Start node (Ship / Dock)
- Entry point to the island.
- Hosts the ship action (used to end the run).
- May branch into multiple paths.

### 2. Path node
- Represents traversal space (beach, trail, forest edge).
- Typically has:
  - one forward movement action,
  - one backward movement action,
  - optional non-movement actions (e.g., gem pickup).

### 3. Feature node
- Represents a point of interest (house, cave entrance, field).
- Anchors discovery and rewards.
- Often hosts gems, NPCs, or entry into pockets.

### 4. Pocket node
- Small, bounded sub-area (inside a house or cave).
- Always shallow (1–3 screens max).
- Always reconnects to its parent feature.
- No further branching.

### 5. Dialog / info screen (transient)
- Used only to display text (NPC dialog, signs).
- Has a single continue action.
- Never stores persistent state.

---

## Actions

An **action** is any visible affordance on a screen that can be activated by typing its prompt.

### Action categories
- Movement (travel to another node)
- Pickup (e.g., gem)
- Inspect / Talk
- Enter / Exit pocket
- Ship (end run)

### Action lifecycle

Actions have a minimal lifecycle:

- **AVAILABLE**
  - Visible and selectable.
- **COMPLETED**
  - Permanently finished for the current run.

Notes:
- Movement actions are **never completed**.
- Completed actions never revert during a run.
- There are no failure states.

---

## Typing model (v1 minimum)

- The player types freely.
- The system matches the typed buffer against visible action prompts.
- When a full prompt is matched exactly, the corresponding action is highlighted.
- The player must press Enter / Return to confirm and activate the matched action.
- Backspace is allowed.
- No penalties for mistakes.

Typing difficulty scaling is explicitly **out of scope for v1**.

---

## Map semantics

The map is a **reference and catalog screen**, not a navigation system.

### What the map shows
- Island layout (schematic).
- Nodes in one of three states:
  1. Undiscovered
  2. Discovered
  3. Completed
- Current progress (e.g., gem count vs goal).

### Discovery rules
- The current node is discovered.
- Moving to a node discovers it immediately.
- Features on a node are discovered when the node is visited.

### Completion rules
- A node is **completed** when all non-movement actions on that node are completed.
- Completion is derived, not stored separately.

### Map surfacing
- The map is shown automatically whenever it changes
  (e.g., new discovery, node completion).
- The map may also be available on demand as a reference.

---

## Graph grammar (island structure)

The island is a small, bounded graph.

### Structural constraints

- Maximum depth from the ship: ~6–8 nodes.
- Branching occurs only near the start.
- Deeper paths are mostly linear.
- All edges are reversible.
- No teleportation in v1.
- No cycles beyond trivial backtracking.
- Pocket graphs:
  - are isolated,
  - are shallow,
  - never connect to each other.

This guarantees:
- short sessions,
- low cognitive load,
- no navigational traps.

---

## Screen action shape constraints

These constraints prevent empty or overwhelming screens.

### Start node
- Required:
  - Ship action
  - 1–3 movement actions
- Optional:
  - 0–1 non-movement action
- Total actions: 2–5

### Path node
- Required:
  - 1 forward movement
  - 1 backward movement
- Optional:
  - 0–1 gem pickup
  - 0–1 inspect / hint
- Total actions: 2–5

### Feature node
- Required:
  - 1 backward movement
- Optional (choose 1–3):
  - gem pickup
  - inspect / talk
  - enter pocket
- Total actions: 2–5

### Pocket node
- Required:
  - exit action
- Optional:
  - 1–2 pickups or interactions
- Total actions: 2–4

### Dialog / info screen
- Required:
  - continue action
- No other actions allowed.

---

## Gems and win condition

- Gems are always visible on the screen they are on.
- Each gem is a single pickup action.
- The required number of gems is decided during island generation.
- The requirement is shown to the player at the start of the run.

### Ending a run
- The ship action is always visible on the ship screen.
- If gems collected < required:
  - show a message (“Need N more gems.”),
  - remain on the ship screen.
- If gems collected ≥ required:
  - show a success screen,
  - offer to start a new island.

---

## Reset semantics

On starting a new island:
- All state is discarded.
- No progress persists between runs.
- Typing difficulty remains at its baseline.

---

## Explicit non-goals (v1)

The following are intentionally excluded from v1:

- Typing speed measurement or adaptive difficulty
- Fog of war
- Animation
- Failure states
- Timers
- Combat
- Saving/loading
- Persistent progression
- Required quests (all quests are optional)

These may be added later, but the v1 design must function without them.

---

## Design invariant (summary)

> Exploration is driven by **recognition, not memory**.  
> Typing enables interaction but is never the point.  
> Progress is visible, safe, and finishable.

This invariant should guide all future changes.
