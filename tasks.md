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

_Last reconciled against `main`: 2026-09-19._

---

## Now

- [ ] **Typing progression.** The track that matches the player's current
      interest, and the only one never started. Start with D1: swap single-letter
      prompts for words. See *Track: Typing Progression*.
- [ ] **Headless smoke test in CI.** The one infra item left, deferred because it
      needs a dependency decision. See *Track: Infrastructure*. Note that
      `tools/gallery.html` now covers part of the gap by eye, with no dependency.

_Cleared 2026-09-18: infra refresh, PR #2 decision._
_Cleared 2026-09-19: the visual overhaul — see *Track: Rendering and Visuals*._

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

- [x] **Visual overhaul, 2026-09-19.** The game now looks the way
      `visual-v1.md` always said it should, and
      [`docs/visual-v2.md`](docs/visual-v2.md) fills in the palette, line
      weights, typography and motion that v1 deliberately left open. In detail:
  - [x] `src/ink.js` — a shared drawing vocabulary: ink/paper tokens, seeded
        hand-drawn line wobble, flat-fill and texture helpers, canvas text.
        Everything visible is now drawn with it.
  - [x] Every biome redrawn flat. All `createLinearGradient` /
        `createRadialGradient` calls are gone, per v1's "no gradients, lighting,
        or shading".
  - [x] Every feature and the explorer redrawn with ink outlines. The explorer's
        silhouette is unchanged; she gained a facing direction and an idle bob.
  - [x] Coastlines. Any edge with no neighbouring node now shows open water with
        a hand-drawn shore and foam, so the edge of the island looks like one.
  - [x] Improve path rendering — one pale trail, the same colour in every biome,
        ink-outlined, with stepping dots and a chevron at each exit.
  - [x] Adjacency hints redrawn as doorways capping each path opening, instead
        of arcs poking in at the frame edge.
  - [x] Prompts show their own typing progress: the label fills as the word is
        typed and turns green when it is complete. Labels also claim rectangles
        and dodge each other, so a prompt never lands under another one.
  - [x] Motion, at a steady 60fps: idle life, a directional slide between nodes,
        pickup bursts, a confetti win screen. Pinned to a still frame under
        `prefers-reduced-motion`.
  - [x] Page chrome rebuilt as a storybook page; the typing bar moved out of the
        sidebar to directly under the scene.
  - [x] Map redrawn: ocean background, ink-outlined tiles in each node's
        dominant colour, green checks, a compass.
  - [x] `tools/gallery.html` — every biome, coastline, typing state and feature
        on one page, rendered from the game's own modules. Zero dependencies.
  - [x] Three unrecorded divergences from `visual-v1.md` resolved **toward the
        document**: gradients removed, outlines added, and undiscovered map nodes
        no longer drawn (the map is a record of the trip, not a picture of the
        island). Recorded in `docs/visual-v2.md` §1.
  - [x] Win screen: the haul is on screen now — the explorer among a fan of
        gems, under confetti — rather than only described.
  - [x] Fixed along the way: the static-layer cache keyed only on node id and
        size, so two nodes with the same id and different exits shared a
        background; the gem meter's track was an inline element, so its fill
        never showed; on a short canvas a prompt clamped back into the frame
        landed on top of the art it labelled; the page did not fit an average
        laptop window. The first and third were found by `tools/gallery.html`,
        not by playing.
  - [x] Fixed after play-testing: the map's green completion check vanished into
        the green biome tiles (it now sits on a paper halo); the dock's drifting
        waves were drawn over the pier rather than behind it (the pier moved out
        of the cached layer); and the node transition scrolled the wrong way —
        walking north moved the world up instead of down. `visual-v2.md` had
        documented that last one as intended, so the doc was wrong too and is
        corrected.
  - [?] **Open:** the ship scene is the only one with a horizon. It reads well,
        but it is the one place the top-down camera bends. Left as is; worth a
        look if a frontal camera is ever reconsidered.
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
- [x] Add `src/ink.js` and redraw everything through it (visual overhaul, above)

## Track: Visual Iteration Support

Added 2026-09-20, after the overhaul merged, so the next round of visual work
does not start by rebuilding what this one figured out.

- [x] Extract the map into `src/map-renderer.js`. It was buried in `main.js`
      and could only be seen by playing far enough to discover nodes.
- [x] `tools/gallery.html` covers the map at four stages of discovery, which is
      where the completion check's contrast problem would have been caught.
- [x] Record how to iterate on visuals in `AGENTS.md`: gallery first, then how
      to drive the real game headlessly with the preinstalled Playwright,
      without adding a dependency to the repo.
- [x] Record the three renderer gotchas in `docs/visual-v2.md` §10.
- [x] Cold-read test of the documentation, 2026-09-20: a reader with no context
      was asked to work out how to draw a new feature using only the repo. It
      got the outline colour, weights, no-gradients rule, motion contract,
      seeding rule and the gallery right — and found six defects, now fixed:
      the owl's blink rate was documented as 4s when the code gives 7.9s; the
      idle-motion band was stated in Hz when the code uses radians/second, and
      the numbers did not match either way; `CLAUDE.md` and `AGENTS.md` both
      said to open `index.html` directly, which ES modules make impossible; and
      the untested-coverage figure disagreed with `decisions.md`.
- [x] Two gaps the cold read found, now documented: prop body colours were in
      no registry (51 hex literals in `scene-renderer.js`), and nothing said
      that adding a feature type means touching four hand-maintained lists.
- [?] **Open, raised by the cold read:** `rendering-v1.md`'s feature
      architecture — per-feature `draw()`/`promptAnchor()` hooks, biome slot
      queries, constraint-based placement — was never built. `docs/README.md`
      now says so, but the section itself still reads as a specification.
      Either build it, cut it, or mark it superseded in the file.
- [?] **Open:** `visual-v1.md` says completed non-movement actions "disappear
      entirely". [D2](docs/decisions.md) says completion and removal are
      separate, and cites `initial-full-design.md` without mentioning that v1
      says the opposite. The code keeps the art and drops the prompt. By this
      repo's own rule that is an unrecorded divergence; D2 should name v1.

## Track: Infrastructure and Test Coverage

Added 2026-09-18 after a repo review.

- [x] Bump `actions/checkout` v4 → v7 and `actions/setup-node` v4 → v7
- [x] Bump CI `node-version` 22 → 24 (Active LTS; 22 is in maintenance). Suite
      verified passing on Node 24.21.0 before the switch, 37/37.
- [x] Add a `permissions: contents: read` block and a `concurrency:` group that
      cancels superseded in-flight runs
- [?] Add a headless browser smoke test to CI. Playwright can drive the real
      game — loading the page, typing prompts, asserting no console errors —
      covering the ~65% of `src/` with no tests today
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
