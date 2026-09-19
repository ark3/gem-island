# Gem Island — Work Tracker

This file is the tracker. Design intent lives in [`docs/`](docs/README.md);
deliberate divergences from it live in [`docs/decisions.md`](docs/decisions.md).

**Conventions**

- `- [ ]` open · `- [x]` done · `- [~]` in progress · `- [?]` blocked or
  undecided, with the blocker stated.
- Done items keep their commit ref so the tracker and the history agree.
- Anything that lands in the code belongs here before the branch merges. Two
  commits (`bc71be0`, `8a4c114`) were missed in Jan 2026 and had to be
  reconstructed from commit messages in Sept 2026 — that is the failure mode
  this convention exists to prevent.

_Last reconciled against `main`: 2026-09-18._

---

## Now

- [ ] **Typing progression.** The track that matches the player's current
      interest, and the only one never started. Start with D1: swap single-letter
      prompts for words. See *Track: Typing Progression*.
- [ ] **Headless smoke test in CI.** The one infra item left, deferred because it
      needs a dependency decision. See *Track: Infrastructure*.

_Cleared 2026-09-18: infra refresh, PR #2 decision._

---

## Track: Typing Progression

The whole track is unstarted. `prompt-service.js` has stub methods
(`refresh()`, `peek()`) and an ignored `actionId` parameter that were left as
seams for exactly this work.

- [ ] Revisit [decision D1](docs/decisions.md#d1--typing-prompts-are-single-letters-not-words):
      move from single-letter prompts to word prompts.
      `createPromptTrainer({ prompts: [...] })` already accepts a word list, so
      this is a word list plus a call-site change.
- [ ] Characterize the player's typing ability. Nothing currently measures
      typing at all — no timing, no accuracy, no per-letter statistics anywhere
      in `src/`.
- [ ] Implement letter/word difficulty characterization.
- [ ] Adjust action prompt difficulty based on player progress. The trainer's
      `weights` are currently a frozen constant; this is where adaptation hooks
      in.
- [ ] Either implement or remove the no-op stubs in `prompt-service.js`
      (`refresh()` is called from `main.js` and does nothing; `peek()` returns
      `null` and is never called).

## Track: Rendering and Visuals

- [ ] Improve path rendering.
- [x] **PR #2, "Renderer Redesign Proposal"** — closed unmerged 2026-09-18.
      Proposed replacing the top-down view with a frontal perspective
      ("Storybook Vignette") while reversing `visual-v1.md`'s explicit "slightly
      tilted top-down view" camera decision without acknowledging the conflict;
      doc-only and unreviewed since 2026-02-01. Branch
      `renderer-redesign-proposal-16992835481382031485` is retained, so the
      three proposals are recoverable if a perspective camera is ever
      reconsidered deliberately — which should start by revising `visual-v1.md`.
- [x] Add more biomes — forest, plains, farm, sand, rock, dock (`0ca4e90`,
      `e17ea52`)
- [x] Improve feature rendering (`a3c6745`, `ca7cc5f`, `fbedbfd`)
- [x] Extract scene rendering into a standalone module (`8a4c114`)

## Track: Infrastructure and Test Coverage

Added 2026-09-18 after a repo review.

- [x] Bump `actions/checkout` v4 → v7 and `actions/setup-node` v4 → v7
- [x] Bump CI `node-version` 22 → 24 (Active LTS; 22 is in maintenance). Suite
      verified passing on Node 24.21.0 before the switch, 37/37.
- [x] Add a `permissions: contents: read` block and a `concurrency:` group that
      cancels superseded in-flight runs
- [?] Add a headless browser smoke test to CI. Playwright can drive the real
      game — loading the page, typing prompts, asserting no console errors —
      covering the ~60% of `src/` with no tests today
      ([D4](docs/decisions.md#d4--canvas-and-dom-code-is-intentionally-untested)).
      **Blocked on a decision:** Playwright would be this repo's first
      dependency and would require a `package.json`, breaking the
      zero-dependency property that is the main reason the project still ran
      untouched after eight months. Options: accept a dev-only dependency; pin
      a CI-installed Playwright without committing a manifest; or leave the
      renderer uncovered. Worth settling before any renderer work starts.

## Track: Pockets (Sub-Areas)

- [?] Figure out a compelling reason to implement this. Blocked by design, not
      by code: `initial-full-design.md` explicitly calls pockets the last
      feature to implement and only if they prove non-redundant.

## Track: Inventory, Actions, Quests — complete

Finished Jan 2026. Retained for context on why the model looks the way it does.

- [x] Repeatable talk actions for NPCs and signs; talk features mark complete on
      first interaction without being removed or hidden (`25b9060`, `3b1117f`)
- [x] Generic inventory map (`{"gem": 5, "shell": 2}`) replacing
      `gemsCollected`; ship win condition reads "gem" from it (`276b597`)
- [x] Reducer handles generic item pickups; UI displays inventory counts
      (`276b597`, `d66aeb2`)
- [x] Completion (logic state) separated from removal (visual state) for all
      non-consumable actions, driven by an explicit flag
      ([D2](docs/decisions.md#d2--completion-and-removal-are-separate-explicitly-flagged-concerns), `9055c82`)
- [x] Quest givers implemented via feature completion state, with no standalone
      quest objects; they stay visible and interactive after completion
      (`22b530b`)
- [x] Conditional logic — visited nodes, inventory, completed features
      (`6cdc90f`, `9ebdd45`)
- [x] Quest metadata on talk actions: type, target, dialog lines, optional
      consume (`ddbd91e`)
- [x] Quest catalog definitions (`262f9cf`)
- [x] Reward spawning via pre-placed, condition-gated features rather than
      island mutation
      ([D3](docs/decisions.md#d3--the-island-is-immutable-rewards-are-revealed-never-spawned), `9ebdd45`)
- [x] Generator places NPCs, signs, discoverable targets and quest collectibles,
      attaching quest metadata from the catalog (`fbedbfd`)

## Unfiled — reconstructed 2026-09-18

Work that landed without a tracker entry. Recorded here so the history is
complete; no further action implied.

- [x] Kid-requested fixes (`bc71be0`): limit typing buffer to 15 characters;
      map ocean blue instead of black; remove the confusing volcano landmark;
      random gem colors; show item count in collect-quest dialog via templates.
