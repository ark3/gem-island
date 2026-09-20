# Agent Context: Gem Island

This is the canonical guidance file for both human contributors and agents.
`CLAUDE.md` points here; do not add substantive content there.

---

## 1. Project overview

Gem Island is a typing-based exploration game for a young child. Players explore
a procedurally generated island by typing visible word prompts to activate
actions (move, pick up gems, talk to NPCs). Each session lasts 5–15 minutes and
resets completely when finished.

## 2. Working agreements

How the owner of this project wants to be worked with. These are preferences,
not deductions — follow them.

- **Discuss design before building it.** Context given in conversation is not
  authorization to implement. When a design choice is open, put the options and
  a recommendation, and wait. A round spent agreeing is cheaper than a round
  spent undoing, and this file exists partly because that lesson was learned the
  expensive way: a tier-based prompt system was built without discussion, then
  removed (`docs/decisions.md`, D6).
- **Number your questions** when there is more than one, so answers can refer to
  them by number.
- **Check claims that are checkable.** Counts, distributions, whether a source
  exists, whether a fix actually fixes anything — measure it rather than
  reasoning about it, and say which you did.
- **When a decision is reversed, record the reversal; do not delete the
  original.** The reasoning is what makes the new decision legible. Rejected
  alternatives belong in the decision log too, so they stay rejected.

## 3. Authority and documentation

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

## 4. Operational directives

**Environment:** native browser ES modules.

- **No build step.** Do not introduce bundlers (Webpack/Vite) or transpilers.
- **Imports:** always include the `.js` extension, e.g.
  `import { x } from "./utils.js"`.
- **Run the game:** serve the folder and open `index.html` — for example
  `npx http-server -p 8765 -c-1 .`. There is nothing to build, but `index.html`
  and `tools/gallery.html` load ES modules, which browsers refuse over
  `file://`, so opening the file directly fails.

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

**Working on visuals:**

Look at the change. Every visual bug found in the September 2026 overhaul was
found by looking, and two of them were invisible in a normal playthrough.

1. **Open `tools/gallery.html` first.** It renders every biome, coastline,
   feature, map state, typing state and the win screen from the game's own
   modules, on one page, with no setup. Most visual work needs nothing else.
2. **Drive the real game** for the things the gallery cannot show: page chrome
   and layout, the node transition, and frame rate.
   - Serve the folder first — `npx http-server -p 8765 -c-1 .`. ES modules do
     not load over `file://`, so opening `index.html` directly will fail.
   - Claude Code web sessions have Chromium and Playwright preinstalled:
     `require` Playwright from `/opt/node22/lib/node_modules/` and launch with
     `executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"`.
     Check the `chromium-*` directory name; the build number changes.
   - For a reproducible island, override `Math.random` in `addInitScript`
     before the page loads — the seed is drawn from it at boot.
   - To activate a prompt, send the characters **then Enter**; a match alone
     does nothing. `document.title` carries the current node, which is the
     cheapest way to detect that a move landed.
   - Reduced motion is verifiable: grab two canvas frames a second apart while
     idle and assert they are byte-identical.
3. **Prove a refactor changed nothing** by diffing the gallery against the
   commit you started from. `git archive HEAD | tar -x -C <tmp>` and serve that
   on a second port, then load both galleries and compare
   `canvas.toDataURL()` per `figcaption`.
   - Compare **canvas contents, not page screenshots**. An element screenshot
     moves when anything above it changes height, and a half-pixel shift lights
     up every outline on the page — the September 2026 palette work spent a
     round chasing a 17% "regression" that was entirely sub-pixel layout.
   - `makeIsland()` in the gallery numbers islands in call order, and that
     number seeds the hand-drawn wobble. Adding a section above an existing one
     reseeds everything below it, which looks exactly like a rendering change.
     Populate new sections at the end of the module.

**Do not add Playwright to the repository.** No `package.json`, no lockfile, no
CI job — that decision is still open and is tracked in `tasks.md`. Use the
preinstalled copy from a scratch directory and leave nothing behind.

## 5. Architecture

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
- **`src/map-renderer.js`** — the island map. Split out of `main.js` so it can
  be reviewed in `tools/gallery.html` without playing a real game.
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
- **`src/prompt-service.js`** — draws the whole on-screen set of prompts at one
  difficulty, and remembers what was shown recently
- **`src/island-utils.js`**, **`src/island.manual.js`** — shared helpers and a
  hand-built island used by tests

**Typing difficulty** (pure; wired into the game via `main.js` — see
`docs/decisions.md`, D6):

- **`src/typing-difficulty.js`** — scores how hard a string is to type, from
  finger movement and transitions. Holds the tunable weights.
- **`src/prompt-vocabulary.js`** — scores the vocabulary once, then draws a set
  of prompts at a chosen difficulty.
- **`src/typing-recorder.js`** — turns keyboard events into one timing sample
  per completed prompt. Pure reducer; the shell reads the clock and passes
  timestamps in, so no timing rule lives in the untested shell.
- **`src/typing-estimate.js`** — turns typing speed into the difficulty target.
  Pure reducer; nothing it measures is ever shown to the player.
- **`src/data/`** — generated vocabulary data. Do not hand-edit; regenerate with
  `node scripts/build-vocabulary.mjs`.
- **`scripts/`** — maintenance tools, not a build step. The game never needs
  them. `build-vocabulary.mjs` regenerates `src/data/`;
  `analyze-difficulty.mjs` prints score distributions and sample sessions for
  tuning weights against real output; `simulate-session.mjs` plays a whole
  session against a simulated player, so pathologies turn up there rather than
  in front of a child. Treat its player model as the guess it is — see D6's
  2026-09-20 correction for what happens when you forget that.

**Tools:**

- **`tools/gallery.html`** — every biome, coastline, typing state and feature on
  one page, drawn by the game's own renderer. Open it in a browser after any
  visual change; it is the fastest way to see the whole art set, and the closest
  thing the renderer has to a regression check
  ([`docs/decisions.md`](docs/decisions.md), D4).

## 6. Key concepts

- **Nodes** — grid-based locations the player navigates between. Each has a
  biome, position, features and actions.
- **Actions** — player interactions: `move`, `pickup`, `say`, `ship`.
- **Features** — visual elements on nodes tied to actions (gems, NPCs, ship).
  Features can carry conditions and a removable flag.
- **Conditions** — evaluated via `evaluateCondition()`. Types: `visited`,
  `hasItem`, `featureComplete`. Combinators: `all`, `any`, `not`.
- **Quests** — emerge from NPC dialog that changes with game state. Two types:
  discover (visit a location) and collect (gather items).

## 7. Conventions

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
