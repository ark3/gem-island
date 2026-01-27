# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Gem Island is a typing-based exploration game for young children. Players explore a procedurally generated island by typing visible word prompts to activate actions (move, pickup gems, talk to NPCs). Each session lasts 5-15 minutes and resets completely when finished.

## Commands

**Run tests:**
```bash
node --test
```

**Run a single test file:**
```bash
node --test tests/engine.test.js
```

**Run the game:**
Open `index.html` in a browser (no build step required).

## Architecture

The codebase follows a **functional core, imperative shell** pattern:

### Pure Logic Layer (Node.js testable, no DOM/Canvas)

- **`src/island-engine.js`** - State reducer and query functions. Exports `createInitialState`, `applyAction`, `getVisibleActions`, `evaluateCondition`, etc. All state transitions happen here through pure functions that return new state.

- **`src/island.generator.js`** - Procedural island generation. Creates the graph structure with nodes, biomes, features, gems, and quests. Accepts a `random` function for deterministic testing.

- **`src/typing-engine.js`** - Matches typed input against action prompts. Buffer-based with `append()`, `backspace()`, and `activateMatch()`.

### Imperative Shell (Browser only)

- **`src/main.js`** - DOM/Canvas rendering, keyboard input, game loop. Connects the pure logic to the browser.

### Supporting Modules

- **`src/biomes.js`** - Biome definitions (sand, rock, forest, etc.) with colors
- **`src/quest-catalog.js`** - Quest definitions (discover and collect types)
- **`src/features.js`** - Visual feature rendering (gems, people, ship)
- **`src/prompt-service.js`** - Assigns typing prompts to actions

## Key Concepts

**Nodes**: Grid-based locations the player navigates between. Each node has a biome, position, features, and actions.

**Actions**: Player interactions - `move` (navigation), `pickup` (collect items), `say` (dialog), `ship` (end game).

**Features**: Visual elements on nodes tied to actions (gems, NPCs, ship). Features can have conditions and removable flag.

**Conditions**: Evaluated via `evaluateCondition()`. Types: `visited`, `hasItem`, `featureComplete`. Supports `all`, `any`, `not` combinators.

**Quests**: Emerge from NPC dialog that changes based on game state. Two types: discover (visit a location) and collect (gather items).

## Conventions

- **No build step** - Native ES modules only. Always include `.js` extension in imports.
- **Derived state over stored state** - Calculate `isCompleted` by checking conditions, don't store booleans.
- **Design docs are authoritative** - `docs/initial-full-design.md` is the source of truth for game design.
- **Tests use seeded random** - See `tests/helpers/random.js` for deterministic generation in tests.
