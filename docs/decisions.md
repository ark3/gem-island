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
- **Status:** **Reversed** on 2026-09-19. Retained in full below, because the
  reasoning is what makes the reversal legible.
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

### Reversal, 2026-09-19

Prompts are words, not single letters. `initial-full-design.md` is accurate
again on this point.

**What changed the decision:** the player is learning touch typing at school
and is working through the home row. Key-finding speed is no longer the skill
being built, so pacing prompts to it no longer serves her. Single letters
cannot practise touch typing at all, because there is no word shape to learn.

**How words are chosen** is a separate decision — see
[D6](#d6--prompt-difficulty-adapts-to-typing-speed), which supersedes the first
implementation of this reversal.

> **A transitional implementation, now removed.** The first version of this
> reversal shipped four vocabulary *tiers* in `src/prompt-lists.js`, selectable
> with a `?tier=` parameter. That approach was rejected: the difficulty scoring
> already favours the keys taught first, so tiers restate the curriculum
> somewhere it has to be kept in sync, and impose steps where a gradient is
> wanted. `prompt-lists.js` and `prompt-trainer.js` were deleted when D6 was
> integrated on 2026-09-20; the game now serves the scored vocabulary. D6's
> rejected-alternatives table keeps the full reasoning, because the tier idea
> is an obvious one to have again.

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
---

## D6 — Prompt difficulty adapts to typing speed

- **Date:** 2026-09-19
- **Status:** **Active — integrated 2026-09-20.** `main.js` serves the scored
  vocabulary and adapts to measured typing pace. The tier machinery it replaced
  (`prompt-lists.js`, `prompt-trainer.js`, `?tier=`) is deleted.

  The crossing below is therefore live, not prospective: the game now measures
  typing speed and varies difficulty by it.
- **Crosses:** `design-v1.md:276`, "Explicit non-goals (v1)", first item —
  *"Typing speed measurement or adaptive difficulty."*

Crossing that non-goal is deliberate. It was the right call when a single
keypress was itself the challenge: there was nothing for adaptation to act on.
Now that prompts are words, word selection has a difficulty axis, and the
non-goal has outlived its reason.

### The design

**Difficulty is a property of the string**, computed in
`src/typing-difficulty.js` from which fingers move and how: per-key cost by
finger and displacement (down harder than up, harder than sideways),
per-transition cost (same finger on different keys is worst, a repeated key is
cheap, alternating hands is free), averaged per keystroke. Small length and
familiarity terms sit on top. Averaging rather than summing is what keeps
length the least influential term — summing would make it dominate by
arithmetic alone.

**The vocabulary is never restricted by which keys have been taught.** All of
it is always available; the scoring decides what surfaces. This works because
a touch-typing curriculum teaches keys in roughly the order this model ranks
them — both follow finger comfort — so a low target naturally yields the keys
a beginner already knows. At the easiest setting, selection draws from `d`,
`f`, `j` and `k` without being told they are the ones she has learned.

**The whole visible set moves together.** Every prompt on screen sits near one
target difficulty, so choosing among them is a choice about where to go in the
game, never about how hard to work — and the timing sample stays unbiased,
since whichever prompt gets typed was drawn from the same place.

**Measurement is invisible and lives in `src/typing-estimate.js`.** The signal
is the average interval between keystrokes; the delay before the first
keystroke counts for a little, capped, because it also contains reading the
screen, deciding where to go and looking at the scenery. Corrections are
included rather than filtered out — fumbling is exactly what should pull
difficulty down. The target rises faster than it falls, so one distracted word
does not undo a good run. Nothing is displayed: no timer, no score, no
readout. The only observable effect is which words appear next.

### How it is wired, 2026-09-20

The order matters, and it is the one thing a reader of `main.js` could get
wrong: **sample, then estimate, then select, then show.**

1. `render()` draws the whole visible set at `estimate.target` and then calls
   `promptsShown`. Rendering is what re-rolls the prompts, so rendering is what
   starts the clock.
2. `handleKeydown` calls `keyPressed` for every edit that actually changes the
   buffer — characters and backspaces alike. `TypingEngine.append` and
   `.backspace` return whether they changed anything, so a backspace on an
   empty buffer or a character past the 15-char cap is not mistaken for typing.
   Enter never extends the window.
3. `handleAction` calls `completed` **first**, before `applyAction` and before
   the render that re-rolls. The sample therefore describes the word she
   actually typed, and the new target is in place before the next set is drawn.

The shell reads the clock — that is I/O — and passes timestamps in. Every rule
about what the numbers mean stays in `typing-recorder.js` and
`typing-estimate.js`, which are pure and tested. `main.js` has no test coverage
by [D4](#d4--canvas-and-dom-code-is-intentionally-untested), so it holds as
little judgement as possible.

**The estimate survives a new island but not a reload.** Within one page load
she is the same typist, and re-climbing from the starting target after every
win would waste the first minutes of each island. Reloading is how to start
over, which is cheap and needs no UI.

**The only trace of the measurement is a `console.debug` line per completed
prompt**, giving the word, the pace and the new target. Nothing reaches the
screen — no timer, no score, no readout. The console line exists because
calibrating `fastIntervalMs` / `slowIntervalMs` against a real session is an
open task with nothing to work from otherwise.

Verified in a real browser before landing: typing fast raised the target 1.30 →
2.50 over eight prompts and the screen moved from `fl, fjj, djs, ksl` to `up,
david, mail, forms`; typing slowly brought it back down; a deliberately fumbled
word scored 246ms/key against the 120ms/key it was typed at.

### Rejected alternatives

Recorded because each is a plausible idea that was tried and set aside. Please
read the reasons before proposing any of them again.

| Rejected | Why |
|---|---|
| **Difficulty tiers** (`home-letters`, `home-words`, …) | Redundant. The scoring already favours the keys taught first, so tiers restate the curriculum in a second place that must be kept in sync, and impose steps where a gradient is wanted. This was built first and is being removed. |
| **Restricting the vocabulary to keys already taught** | Same reason, and it fails on its own terms: she can type the keys she has not formally learned, just less comfortably. It is a gradient, not a cliff. |
| **Per-key or per-letter observed tracking** | Unnecessary. The static model already tilts toward comfortable keys; learning per-key costs adds state and complexity to reach a place the geometry already reaches. |
| **A runtime vocabulary switch (`?tier=…`)** | The target difficulty is the only control needed, and it sets itself. |
| **Persisting the estimate between sessions** | Deliberately not done. Adaptation converges in about ten prompts, which makes persistence unnecessary; persistence for web apps is solved elsewhere in the owner's projects and is not wanted here. |
| **A spread of difficulties within one visible set** | Would couple the difficulty she gets to the destination she wants, and would bias the timing sample by letting her self-select the easy option. |
| **Using her word choice as a difficulty signal** | She plays for the game. Her choices are driven by where she wants to go, not by which word looks easier, so the signal would be noise. |

### Known weaknesses

- **The weights are reasoned, not measured.** `fastIntervalMs` and
  `slowIntervalMs` in `typing-estimate.js` are guesses at a seven-year-old's
  pace and should be the first thing corrected against a real session.
- **The frequency corpus is web-derived.** It has no `dad` at all while
  ranking `administration` highly, so the familiarity term currently measures
  the internet's familiarity rather than hers. An age-of-acquisition or
  early-reader source would fit far better.
- **Nonsense dominates where she will actually play.** A simulated session
  (`scripts/simulate-session.mjs`) settles the target near 1.9, and at that
  level about **86%** of prompts are nonsense rather than real words — the
  pool fills everything below roughly 2.4 precisely because real words do not
  live there. By target 2.5 it is 30%, by 2.8 it is 3%. The model is behaving
  correctly; whether a child who can read enjoys a screen of `aaf, gha, fsg`
  is a separate question. Related: around 2.2 a single screen mixes registers
  — `hla`, `side`, `gf`, `digital` together.

  **Corrected 2026-09-20: that 86% is an artifact of the simulated player, not
  a property of the design.** The player's pace is proportional to the full
  score, familiarity term included, so the model assumes a nonsense string
  costs her exactly what the familiarity weight guesses it costs. The guess is
  then read back out as a finding. Holding everything else fixed and changing
  only that assumption, she settles at 1.93 with 86% nonsense at +1.0/key, and
  at 2.67 with 18% nonsense at +0.35/key — if nonsense is easier for her than
  the weight assumes, she climbs past it and the problem self-corrects.

  The familiarity weight is still the lever, but it runs the opposite way to
  the obvious guess: *lowering* it yields more real words, because it drops
  nonsense below her band and pulls mid-frequency words down into it. At
  weight 0 the band near 1.9 holds 396 real words and 2 nonsense; at 2.5 the
  whole band collapses to 5 entries and selection degenerates to repeating
  them. **Resolved: do not pre-tune.** The answer ranges over 7%-86% on a
  number only a real session can supply, and no amount of simulation narrows
  it. Left at 1.0 until she plays.
- **The rise/fall asymmetry was checked and is safe.** Rising 0.15 and falling
  0.08 is a ratchet in principle: noisy input could drift the target upward
  without any real improvement. Simulation shows it self-limits, because a
  higher target yields slower typing and so fewer "fast" readings. It settles
  in a band (1.55–2.39 over 200 prompts) rather than climbing to the ceiling.
  Re-run the simulation after changing any weight or threshold.
