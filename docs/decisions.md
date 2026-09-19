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

An action or feature being *completed* (logic state) is independent of it being
*removed* from the scene (visual state). Removal is driven by an explicit
removable flag, not by completion status.

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

Roughly 60% of `src/` (`scene-renderer.js`, `main.js`, `explorer.js`,
`features.js` — about 2,530 of 4,246 lines) has no test coverage. This is a
consequence of the functional-core/imperative-shell split: pure logic stays
testable under `node --test` with no DOM, and everything touching Canvas is
deliberately left outside that boundary.

**Rationale:** keeping the shell untested is what keeps the core pure and the
test suite dependency-free.

**Known cost:** the renderer has no regression safety net, which matters
whenever renderer changes are on the table. A headless browser smoke test would
cover the integration path without compromising the split — tracked in
`../tasks.md`.
