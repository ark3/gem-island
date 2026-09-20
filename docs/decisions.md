# Decision Log

Deliberate choices where the code differs from the design documents, or where
the code relies on a rule the design documents never state.

This log exists because the design snapshots in this directory describe intent,
and intent has been overridden more than once without anyone writing it down.
An undocumented override is indistinguishable from a bug — see
[`README.md`](README.md) for how authority is resolved.

**Format:** each entry is dated, points at the code and the document it
contradicts, and records rationale. Where the rationale was never captured at
the time, the entry says so explicitly rather than inventing one.

---

## D1 — Typing prompts are single letters, not words

- **Date:** 2026-01-01 (`3cb2233`, "Switch to single-letter typing prompts")
- **Status:** Active, **under review** as of 2026-09-18
- **Contradicts:** `initial-full-design.md` — "Visible actions on the screen each
  have an associated prompt (**common words**, not semantically tied to the
  action)."

`src/prompt-trainer.js` falls back to `DEFAULT_LETTER_WEIGHTS`, a table of the
26 lowercase letters weighted by English letter frequency, whenever no explicit
prompt list is supplied. `src/main.js` calls `createPromptService()` with no
arguments, so that fallback is what ships. Every prompt in the running game is a
single letter.

**Rationale:** at the time, finding a single key was slow enough for the player
that one letter per prompt was a good starting difficulty. Whole words would
have been a wall rather than a ramp.

_(Confirmed by the author on 2026-09-18. The original commit message recorded
the change without the reasoning, and no document mentioned it — this entry is
why the log exists.)_

**Why it is under review:** the condition that justified the decision has
expired. The player is older, now types fast enough that single keys no longer
pace the game, and is specifically motivated to practise typing. Single letters
train key-finding, not typing. `createPromptTrainer({ prompts: [...] })` already
accepts a word list and weights entries evenly, so the plumbing for a reversal
exists and is unused.

**If this is reversed**, update this entry rather than deleting it, and note
that `initial-full-design.md` becomes accurate again.

---

## D2 — Completion and removal are separate, explicitly flagged concerns

- **Date:** 2026-01-04 (`9055c82`, "Make removal behavior explicit for actions
  and features")
- **Status:** Active
- **Extends:** `initial-full-design.md`, which defines an action lifecycle of
  Available → Completed but says nothing about whether a completed action
  disappears.
- **Narrows:** `visual-v1.md`, "Completed non-movement actions disappear
  entirely." Recorded 2026-09-20; it should have been named here in the first
  place, since an unrecorded divergence is exactly what this file exists to
  prevent.

An action or feature being *completed* (logic state) is independent of it being
*removed* from the scene (visual state). Removal is driven by an explicit
removable flag, not by completion status.

**On v1's "disappear entirely":** the word doing the damage is *entirely*. A
completed non-movement action does disappear — its prompt is dropped
(`scene-renderer.js`, `action.kind !== "move" && action.isCompleted`). Its
**feature** does not, unless the feature is flagged `removable`
(`!(feature.removable && completedFeatures.has(feature.id))`). So a gem is
taken and gone; a signpost you have read keeps standing there with nothing to
type at it. v1 was describing actions and reads as though it were describing
the scene, which is a narrower conflict than it first appears — but a real
one.

**Rationale:** quest givers must stay visible and interactive after their quest
completes, and talk features must mark complete for node-completion purposes
without vanishing. Before this change only gems were removed, so talk actions
appeared to behave correctly by accident. The rule is now explicit so the
accident cannot regress.

---

## D3 — The island is immutable; rewards are revealed, never spawned

- **Date:** 2026-01-05 (`9ebdd45`, "Gate actions and features by conditions")
- **Status:** Active
- **Extends:** the design documents describe quest rewards without specifying a
  mechanism.

Reward gems are defined in the generated island up front and hidden behind
`featureComplete` conditions. Completing a quest does not add anything to the
island; it changes state so that an already-present feature becomes visible.

**Rationale:** keeps the island structure fixed after generation and keeps
visibility derived rather than stored, consistent with the project's
derived-state convention. Anyone tempted to "fix" a quest reward by mutating the
island after generation should gate a pre-placed feature instead.

---

## D4 — Canvas and DOM code is intentionally untested

- **Date:** ongoing convention, formalized in `AGENTS.md`
- **Status:** Active

Roughly 65% of `src/` (`scene-renderer.js`, `main.js`, `explorer.js`,
`features.js`, `ink.js` — about 3,230 of 4,960 lines, recounted 2026-09-19
after the visual overhaul) has no test coverage. This is a consequence of the
functional-core/imperative-shell split: pure logic stays testable under
`node --test` with no DOM, and everything touching Canvas is deliberately left
outside that boundary.

**Rationale:** keeping the shell untested is what keeps the core pure and the
test suite dependency-free.

**Known cost:** the renderer has no regression safety net, which matters
whenever renderer changes are on the table. A headless browser smoke test would
cover the integration path without compromising the split — tracked in
`../tasks.md`.

**Partial mitigation, 2026-09-19:** `tools/gallery.html` renders every biome,
coastline, typing state and feature from the game's own modules on one page. It
is a check by eye rather than an assertion, and it adds no dependency. It caught
two real bugs during the visual overhaul that a playthrough had not surfaced —
a shared static-layer cache key and a prompt-placement collision.

---

## D5 — The page loads one webfont and degrades to a system stack

- **Date:** 2026-09-19 (visual overhaul)
- **Status:** Active
- **Extends:** `visual-v1.md` left "typography choices" explicitly undefined;
  `visual-v2.md` now defines them.

`index.html` loads **Baloo 2** from Google Fonts. Everything drawn on canvas and
everything in the DOM shares the stack
`"Baloo 2", "Trebuchet MS", "Segoe UI", system-ui, -apple-system, sans-serif`.

This is the project's only runtime network request, in a codebase whose main
virtue is having no dependencies and no build step — so it needs recording
rather than discovering.

**Rationale:** the game is for a child and the prompts are the thing they look at
most. A rounded, heavy, friendly face does more for how the game feels than any
other single choice, and the previous monospace prompts actively read as a
developer tool. A webfont buys that for two `<link>` tags.

**Why it is acceptable:**

- It is not a *build* dependency. There is still no `package.json`, no install
  step, and nothing to keep up to date. Deleting the two `<link>` tags is a
  complete, working removal.
- It degrades. Offline, or if Google Fonts is blocked, the fallback stack
  renders and the game still looks deliberate — the layout, colour and line work
  carry it. This was checked, not assumed.
- Canvas text picks up the font as soon as it loads, because the renderer
  repaints every frame. There is no flash of a wrongly-measured label.

**If this is reversed**, drop the `<link>` tags and the `"Baloo 2"` entry from
both `FONT_STACK` in `src/ink.js` and `--font` in `index.html`; nothing else
depends on it.
