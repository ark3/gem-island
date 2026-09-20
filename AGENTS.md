# Agent Context: Gem Island

This is the canonical guidance file for both human contributors and agents.
`CLAUDE.md` points here; do not add substantive content there.

---

## 1. Project overview

Gem Island is a typing-based exploration game for a young child. Players explore
a procedurally generated island by typing visible word prompts to activate
actions (move, pick up gems, talk to NPCs). Each session lasts 5–15 minutes and
resets completely when finished.

## 2. Authority and documentation

- **Design intent** lives in [`docs/`](docs/README.md). Start with
  [`docs/README.md`](docs/README.md), which indexes every document and says what
  each one governs.
- **Deliberate divergences** from that intent live in
  [`docs/decisions.md`](docs/decisions.md). Read it before assuming the code is
  wrong.
- **Work tracking** lives in [`tasks.md`](tasks.md). Anything that lands in the
  code belongs there before the branch merges.

**When code and design documents disagree**, exactly one of these is true:

1. The divergence is recorded in `docs/decisions.md` — the decision wins, and
   the design document is out of date on that point.
2. The divergence is not recorded — this is an open question. Either the code
   drifted or a decision went unwritten. Resolve it and record it; do not
   silently follow one side.

> An earlier version of this file said "if code contradicts the design docs,
> trust the design docs." That rule predated any deliberate divergence and is
> now actively misleading — the shipping prompt behaviour contradicts the design
> docs on purpose. See `docs/decisions.md`, entry D1.

## 3. Operational directives

**Environment:** native browser ES modules.

- **No build step.** Do not introduce bundlers (Webpack/Vite) or transpilers.
- **Imports:** always include the `.js` extension, e.g.
  `import { x } from "./utils.js"`.
- **Run the game:** open `index.html` in a browser. There is nothing to build.

**Testing:**

```bash
node --test                    # full suite
node --test tests/engine.test.js   # single file
```

- Tests live in `tests/` and use the native Node test runner. There is no
  `package.json` and no dependencies — keep it that way unless there is a
  concrete reason.
- Logic in `island-engine.js` and `island.generator.js` must stay pure and
  testable in Node (no DOM or Canvas references).
- Tests use seeded random for deterministic generation — see
  `tests/helpers/random.js`.

## 4. Architecture

The codebase follows a **functional core, imperative shell** pattern.

**Pure logic layer** (Node-testable, no DOM/Canvas):

- **`src/island-engine.js`** — state reducer and query functions. Exports
  `createInitialState`, `applyAction`, `getVisibleActions`, `evaluateCondition`.
  All state transitions happen here, through pure functions returning new state.
- **`src/island.generator.js`** — procedural island generation. Builds the graph
  of nodes, biomes, features, gems and quests. Takes a `random` function so
  tests can be deterministic.
- **`src/typing-engine.js`** — matches typed input against action prompts.
  Buffer-based: `append()`, `backspace()`, `activateMatch()`.

**Imperative shell** (browser only):

- **`src/main.js`** — DOM/Canvas rendering, keyboard input, game loop. Connects
  the pure logic to the browser.
- **`src/scene-renderer.js`** — canvas scene drawing, extracted from `main.js`.
  Paints the static layers of a node once into an offscreen canvas and animates
  everything above them, which is why a fully animated scene is cheap.
- **`src/ink.js`** — the drawing vocabulary every canvas surface shares: ink and
  paper colour tokens, seeded hand-drawn line wobble, flat fills, texture and
  text. Read [`docs/visual-v2.md`](docs/visual-v2.md) before changing it. Two
  rules: flat colour only (no gradients, ever), and every wobble is seeded from
  something stable so an animated scene does not shimmer.

**Supporting modules:**

- **`src/biomes.js`** — biome definitions (sand, rock, forest, …) with colors
- **`src/quest-catalog.js`** — quest definitions (discover and collect types)
- **`src/features.js`** — visual feature rendering (gems, people, ship)
- **`src/explorer.js`** — player character art
- **`src/prompt-service.js`** — assigns typing prompts to actions
- **`src/prompt-trainer.js`** — chooses which prompt to serve next
- **`src/island-utils.js`**, **`src/island.manual.js`** — shared helpers and a
  hand-built island used by tests

**Tools:**

- **`tools/gallery.html`** — every biome, coastline, typing state and feature on
  one page, drawn by the game's own renderer. Open it in a browser after any
  visual change; it is the fastest way to see the whole art set, and the closest
  thing the renderer has to a regression check
  ([`docs/decisions.md`](docs/decisions.md), D4).

## 5. Key concepts

- **Nodes** — grid-based locations the player navigates between. Each has a
  biome, position, features and actions.
- **Actions** — player interactions: `move`, `pickup`, `say`, `ship`.
- **Features** — visual elements on nodes tied to actions (gems, NPCs, ship).
  Features can carry conditions and a removable flag.
- **Conditions** — evaluated via `evaluateCondition()`. Types: `visited`,
  `hasItem`, `featureComplete`. Combinators: `all`, `any`, `not`.
- **Quests** — emerge from NPC dialog that changes with game state. Two types:
  discover (visit a location) and collect (gather items).

## 6. Conventions

- **Derived state over stored state.** Calculate `isCompleted` by checking
  conditions; do not store a boolean.
- **Completion is not removal.** An action completing and an action disappearing
  are separate, explicitly flagged concerns (`docs/decisions.md`, D2).
- **The island is immutable after generation.** Rewards are pre-placed and
  revealed by conditions, never spawned (`docs/decisions.md`, D3).
- **Functional core, imperative shell.** Keep pure functions pure.
- **Animation is a pure function of `time`.** The renderer takes one number —
  seconds since boot — and draws the frame for it. Nothing reads a clock
  directly. That is what lets `prefers-reduced-motion` be honoured by pinning
  `time` to zero, and what keeps the scene reproducible.
