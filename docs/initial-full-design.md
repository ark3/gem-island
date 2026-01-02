# Gem Island

This document describes the vision for **Gem Island** as it exists after design discussion and early implementation. It is a *descriptive snapshot* of the game we discovered we were making.

The purpose of this document is to preserve shared understanding that would otherwise only live in chat history or memory.

---

## High-Level Concept

Gem Island is a short, replayable **exploration and activity game** for a young child, where:

- The player explores a small island.
- Interaction is driven entirely by typing visible words.
- Exploration is safe, bounded, and non-threatening.
- Progress is visible, cumulative, and finishable.
- Typing skill develops incidentally, not as an explicit goal.

Each play session lasts approximately **5–15 minutes** and resets completely when finished.

---

## Core Player Experience

1. The player character arrives at an island by ship.
2. The island is explored screen by screen.
3. Each screen shows:
   - a static visual scene
   - a small set of clearly marked actions
4. Every action has a visible **text prompt** the player types to activate it.
5. The player character collects gems and explores points of interest.
6. When ready, the player returns to the ship.
7. If enough gems have been collected, the island run ends successfully. The player character sails away on the ship.

The player is never rushed, punished, or trapped. Exploring forever is allowed.

---

## Interaction Model (Typing)

- The player types freely at all times.
- Visible actions on the screen each have an associated prompt (common words, not semantically tied to the action).
- The typing system matches the input buffer against visible prompts.
- When a prompt is fully matched:
  - the player confirms activation (currently via Enter),
  - the action executes.
- Backspace is supported.
- There are no error states; incorrect typing simply doesn’t activate anything.

Typing is treated as a **motor activity**, not a language test.

---

## Screens and Actions

The game consists of **static screens**. There is no animation beyond:
- typing feedback,
- visual indication that an action completed.

An **action** is any visible affordance on a screen that can be activated by typing.

### Action Kinds
- **Move**: change the current location
- **Pickup**: collect a gem or item
- **Inspect / Talk**: display text or reveal information
- **Ship**: attempt to end the island run

### Action Lifecycle
- **Available**
- **Completed**

Rules:
- Movement actions are *never* completed.
- Non-movement actions complete once and stay that way for the rest of the run.

---

## Surface Nodes and Spatial Structure

The island consists of a small number of **surface nodes**, each corresponding to a distinct location on the island.

All surface nodes:
- appear explicitly on the map,
- are navigable via spatial adjacency,
- are structurally the same kind of thing.

Differences between nodes arise from **content, placement, and visual identity**, not from structural categories.

---

## Spatial Layout and Navigation

Surface nodes are laid out on a **grid**.

- Nodes that share an edge on the grid are connected.
- Movement is always in cardinal directions (north, south, east, west).
- All movement is reversible. There are no one-way paths.

The grid is used consistently for:
- gameplay navigation,
- map rendering,
- player mental model.

The map is not a projection of an abstract graph; it is a direct representation of the same spatial structure the game uses internally.

---

## How Surface Nodes Differ

Although all surface nodes are structurally equivalent, they differ in ways that affect gameplay and feel.

### 1. Content Density

Some nodes are primarily transitional, while others are rich with interaction.

A node may:
- offer only movement actions,
- include visible gems,
- include inspectable objects or NPCs,
- include entrances to bounded sub-areas.

Nodes with more non-movement actions naturally feel like points of interest.

---

### 2. Visual Identity (Biome and Landmark)

Each surface node has:
- a biome (beach, cave, forest, etc.),
- optionally a landmark (ship, cave mouth, structure, field).

Visual identity:
- supports recognition and memory,
- makes the map legible at a glance,
- provides meaning without relying on text.

---

### 3. Role in the Run

Some nodes play a special *role* in the overall run, without being mechanically different.

Examples:
- The ship node serves as the entry and exit point.
- Nodes farther from the ship tend to host more rewards.
- Edge or corner nodes often feel like natural ends of exploration.

These roles emerge from placement and content, not from hard-coded node types.

---

### 4. Discovery and Completion

Each surface node can be in one of three states:
- **Undiscovered**
- **Discovered**
- **Completed**

Discovery:
- A node is discovered when the player visits it.

Completion:
- A node is completed when *all non-movement actions on that node are completed*.
- Completion is derived from action state, not stored separately.

Completion:
- is visible on the map,
- supports the player’s enjoyment of finishing areas,
- helps reduce unnecessary revisiting.

Completion does not affect navigation.

---

## Sub-Areas (Pockets)

Some surface nodes may offer entry into small, bounded sub-areas (e.g., the inside of a cave or building).

These sub-area nodes:
- are not shown on the map,
- are shallow and non-branching,
- always return directly to their parent surface node.

Pockets exist to create a **brief change in pacing and feel** rather than new gameplay. Where surface nodes emphasize exploration, orientation, and deciding where to go next, pockets provide a short, focused moment of “doing something” and then returning to the world.

Because pockets do not introduce new mechanics and often overlap with surface-node interactions, they are **strictly optional**. They should only be added when they clearly enhance the experience through atmosphere, rhythm, or narrative framing.

As a result, pockets should be treated as the **last feature to implement**, and only introduced once compelling, non-redundant gameplay or experiential value is apparent.

---

## Procedural Generation (Current Direction)

- Each island is procedurally generated.
- The island consists of a small grid.
- Nodes are assigned biomes and visuals.
- Gems are placed automatically and are always visible.
- Generation guarantees enough gems to meet the requirement.

Procedural generation reshuffles layout and content while preserving structural rules and player expectations.

---

## Map / Mini-Map

The game includes a **reference-only mini-map**.

The map:
- shows the island grid,
- indicates discovery state,
- shows node completion (e.g., checkmarks),
- shows the player’s current position.

The map:
- helps track exploration and progress,
- serves as a catalog of accomplishments,
- is not used for navigation.

---

## Quests (Optional Side Activities)

Gem Island does not have quests as first-class objects or systems. Instead, the world contains **persistent quest givers**—such as signs, farmers, or other friendly NPCs—whose behavior changes based on player interaction and current game state.

Quests exist to:
- give reasons to explore,
- provide additional finishable activities,
- add light narrative flavor.

They are never required to complete an island.

---

### Quest Givers

A quest giver is a visible, persistent feature on a surface node.

Properties:
- Appears on the map once its node is discovered.
- Never disappears.
- Always has something useful to say.
- Has a **complete / incomplete** state.

Quest givers do not create, track, or own explicit quest objects.

---

### Quest Interaction Model

Quest givers change state **only when the player interacts with them**.

There is no notion of:
- quest acceptance,
- quest progress,
- automatic quest completion.

All state transitions occur as a direct result of interaction.

---

### Quest Types

All quests in Gem Island fall into one of two conceptual types. In both cases, the quest giver’s dialog depends on two things:
- whether the quest giver is **incomplete** or **complete**,
- whether the game state currently satisfies the quest condition.

Since quest conditions can be satisfied through exploration before meeting the quest giver, quest giver dialog must not assume prior interaction and must read naturally on first encounter. Put another way, NPCs react to the player’s current state, not past conversations.

---

#### 1. Discover Quests

**Form (examples):**
- “Have you seen the cave?”
- “I lost my tractor somewhere on the island.”
- “There’s something strange to the east.”

**Behavior and dialog:**

- **Incomplete quest giver, condition not met**
  (target node or object not yet discovered):
  - “I can’t find my tractor. Have you seen it anywhere?”

- **Incomplete quest giver, condition met**
  (target has been discovered):
  - “You’ve seen my tractor? Thank you! That helps a lot.”
  - The quest giver becomes complete.
  - A reward is granted (see Rewards below).

- **Complete quest giver**
  (on all future interactions):
  - “Thanks for helping me find my tractor.”

Discovery alone does not change the world; returning and interacting with the quest giver is required to complete the quest.

---

#### 2. Collect Quests

**Form (examples):**
- “I could use three carrots for my stew.”
- “Can you bring me two shells?”

**Behavior and dialog:**

- **Incomplete quest giver, condition not met**
  (player lacks required items):
  - “I could use three carrots for my stew.”

- **Incomplete quest giver, condition met**
  (player has required items):
  - “Oh, you have carrots. May I have them for my stew? Thank you!”
  - Required items are removed from the player’s inventory.
  - The quest giver becomes complete.
  - A reward is granted (see Rewards below).

- **Complete quest giver**
  (on all future interactions):
  - “Thanks for helping me with my stew.”

Collecting items alone does not change the quest giver; interaction is required.

---

### Rewards

Completing a quest grants a **small, visible reward**.

Reward rules:
- Rewards are never required for island completion.
- Rewards are predictable and consistent (typically one gem).
- Rewards are never granted silently or directly to the inventory.

**When a quest giver transitions from incomplete to complete, a gem appears visibly on the same surface node.**

The player must then explicitly collect the gem via a pickup action, just like any other gem in the world.

This preserves the invariant that:
- all gems are visible,
- all gems are collected through explicit player action.

---

### After Completion

Once a quest giver is complete:
- Their state remains complete for the rest of the run.
- They never offer new requests.
- They never grant additional rewards.

The quest giver continues to exist as part of the world and map, providing narrative closure rather than new objectives.

---

### Relationship to Exploration and Completion

- Quests are entirely optional.
- Ignoring a quest giver has no negative consequences.
- Returning to a quest giver after satisfying their condition is optional, but rewarding.

Completing a quest giver is treated as a non-movement action:
- until complete, the node remains incomplete,
- once complete (and any spawned reward collected), the node may become completed.

Quests add structure and motivation without introducing pressure, gating, or hidden state.

---

## Progress and Win Condition

### Gems
- Gems are always visible on the screen they appear on.
- Each gem is collected via a pickup action.
- Collected gems increment a global count.

### Required Gems
- Each island run specifies a required gem count.
- This requirement is shown to the player at the start and during play.

### Ending a Run
- The ship action is always available at the ship location.
- If the player attempts to leave without enough gems:
  - a message is shown (“Need N more gems.”),
  - the player remains on the island.
- If the player has enough gems:
  - a success screen is shown,
  - the run ends.

---

## Reset Semantics

When a run ends successfully:
- all island state is discarded,
- a new island is generated,
- no progress persists between runs.

Each run is self-contained.

---

## Visual Style

- Canvas-based rendering.
- Static biome-specific backgrounds.
- Clear, readable shapes and icons.
- No animation.
- A custom Explorer character appears on the success screen.

Visuals prioritize clarity, warmth, and calm over spectacle.

---

## Explicit Non-Goals

The following are intentionally not part of the game at this stage:

- Failure states
- Time pressure
- Combat
- Complex puzzles
- Text-heavy narrative
- Persistent progression across runs
- Explicit typing drills or scoring

These may evolve later, but the game is designed to function fully without them.

---

## Design Summary

Gem Island is an **exploration catalog game** where:

- Typing activates the world.
- Exploration is spatial, safe, and finishable.
- Progress is always visible.
- The player decides when they are done.
- Each run is short, complete, and replayable.
