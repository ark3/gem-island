# Island Exploration Typing Game — Visual Notes (v2)

## Purpose of this document

Visual Notes v1 described how the game should *look and feel* and deliberately
left five things open:

> exact color palette · exact line weights · typography choices · animation or
> transitions · asset production pipeline

This document closes the first four. It keeps every goal and rule v1 stated —
the coloring-book aesthetic, the camera, the composition rules, the map
behaviour — and adds the specifics that were missing, so that two people
drawing two different features end up with art that belongs in the same book.

**Read [`visual-v1.md`](visual-v1.md) first.** It still governs intent. This
document supersedes exactly one section of it: *"What is intentionally not
defined yet"*. Everything else in v1 stands.

It is still not a final art specification. It is the level of detail below
which choices can be made case by case.

---

## 1. Why v1 needed closing

Between v1 and this document, the code drifted away from v1 in ways nobody
recorded:

- v1 says **"No gradients, lighting, or shading."** Every biome background was
  drawn with `createLinearGradient` or `createRadialGradient`.
- v1 says objects have **"thick black outlines"**. Only the explorer had any
  outline at all; biome art and features had none, which is why the explorer
  looked pasted in from a different game.
- v1 says undiscovered map nodes are **"no fill (background only)"**. The map
  filled them dark, so the island's full shape was visible from the first
  screen — the opposite of "reflects player knowledge".

None of these were recorded as decisions, so by the rule in
[`README.md`](README.md) they were open questions rather than preferences. They
have been resolved **toward v1**: the code now does what v1 said. This document
exists so the same drift is harder next time — it says what the colours, weights
and motion actually are, rather than leaving them to each new renderer change.

---

## 2. Palette

All colours are flat. A colour may be used as a fill or as a line; it may never
be one end of a gradient.

### Ink and paper

| Token | Value | Use |
|---|---|---|
| `INK` | `#2f2418` | every outline, all body text. A warm near-black; pure black reads cold next to cream. |
| `INK_LIGHT` | `#6b5a46` | secondary text, captions, the compass |
| `PAPER` | `#fdf4e0` | the page, prompt labels, highlights inside art |
| `PAPER_DEEP` | `#f4e6c8` | sidebar cards, the typing bar |
| `PAPER_EDGE` | `#e2cfa6` | the flat offset shadow under cards, paper grain |
| `--sky` | `#cfe9f2` | the surface the page sits on |

### State colours

| Token | Value | Meaning |
|---|---|---|
| `HIGHLIGHT` | `#f2a516` | letters typed so far — the progress fill on a prompt |
| `READY` | `#3fa34d` | this prompt is complete; press Enter |
| `ALERT` | `#d1495b` | something went wrong |

### Biomes

Each biome owns one `dominantColor`. That colour identifies the place, fills
most of its scene, and is the colour of its square on the map — one colour, three
jobs, which is what makes the map legible. Supporting tints live alongside it in
`src/biomes.js`.

| Biome | Dominant | Character |
|---|---|---|
| `dock` | `#5bb0d6` | sea blue: grass, then sand, then open water and the jetty |
| `sand` | `#f3d79c` | warm beach, ripples, a little dune grass |
| `rock` | `#bdb4a6` | warm stone — never blue-grey, which fights the paper |
| `forest` | `#57a05e` | a floor darker than plains, under overlapping canopies |
| `plains` | `#a6cf6a` | bright meadow, blooms and tufts |
| `farm` | `#dfb777` | tilled earth in flat furrows of soil and crop |

### Gems

Gem colours live in `src/island.generator.js` as `{ fill, stroke }` pairs. In
this style `fill` is the body and `stroke` is the **facet tint** drawn inside
the gem — the outline itself is always `INK`, like everything else.

### Object colours — a known gap

There is **no token, list or rule for the body colour of a prop**. The palette
above closes the ink, paper, state, biome and gem colours, and stops. Every
feature's body colour is a bare hex literal inside its own painter in
`src/scene-renderer.js` — 51 distinct ones, in no registry.

Until that is fixed, the convention holding the art together is reuse. These
are the recurring literals, in order of how often they appear:

`#e8615a` red · `#f2d79c` straw · `#5bb0d6` sky · `#f2a516` amber ·
`#3f9052` leaf · `#a9702f` wood · `#b78ad6` violet · `#b07d44` tan

Pick from those before inventing a colour, and never fill a prop with the
biome's `dominantColor` — that is the land it stands on.

---

## 3. Line and shape

- **One outline colour**: `INK`. Not per-object, not tinted.
- **Weights**, at a 4:3 scene around 900px wide:
  - scene frame — 5px
  - feature outlines — 3.5–4.5px
  - internal detail (planks, facets, ridges) — 2–3px
  - path edges — 3.5px at 70% ink
- **Joins and caps are round**, always. Square corners look machined.
- **Lines wobble.** `roughen()` in `src/ink.js` resamples every polygon and
  nudges the new points sideways, tapering to zero at the original vertices so
  intended corners stay sharp and short edges stay straight. This is the single
  thing that makes the art look drawn rather than computed.
- **Every wobble is seeded** from something stable — usually the node or feature
  id. The same shape must wobble identically on every frame; a wobble derived
  from time makes the whole scene shimmer.
- **Depth comes from outline weight and overlap only.** Nearer things are drawn
  later and are not smaller. There is no light source, so there are no shadows.
  Where an object needs anchoring to the ground, draw a flat patch of scuffed
  ground beneath it — a *lighter* tint of the biome, not a darker one.
- **Texture is marks, not washes.** `stipple()` and `hatch()` draw dots and
  dashes. Anything that fades is out of bounds.

---

## 4. Typography

- **Family:** [Baloo 2](https://fonts.google.com/specimen/Baloo+2), weights
  400/600/700/800 — rounded, heavy, friendly, and clear at small sizes.
- **Fallback:** `"Trebuchet MS", "Segoe UI", system-ui, -apple-system,
  sans-serif`. The game is fully playable and still looks intentional on the
  fallback; see [decision D5](decisions.md#d5--the-page-loads-one-webfont-and-degrades-to-a-system-stack).
- **Prompt text is 24px at weight 800**, lowercase, letter-spaced by the font's
  own metrics. Prompts are the thing the player reads most, so they get the
  heaviest weight on screen.
- **No monospace anywhere.** The previous UI set prompts in a monospace face,
  which read as a developer tool rather than a game.
- The same stack is declared twice on purpose: as `FONT_STACK` in `src/ink.js`
  for canvas text, and as `--font` in `index.html` for DOM text. If one changes,
  change both.

---

## 5. Composition

The camera is unchanged from v1: **a slightly tilted top-down view**. In
practice that means the ground is seen from above while objects on it —
trees, people, signs, the ship — are drawn standing up, in elevation. This is
deliberate and has been reversed once before by proposal; see `tasks.md`,
*Track: Rendering and Visuals*, PR #2. Any future move to a frontal camera
starts by revising v1, not by quietly redrawing.

Each scene is built in this order (`renderSceneToCanvas`):

1. **Frame.** The scene sits inside a rounded ink border with paper showing at
   the corners. Everything is clipped to it; prompts draw on top of it.
2. **Coast.** Every edge with no neighbouring node shows open water with a
   hand-drawn shoreline and two bands of foam. An interior node has no water at
   all. This is new in v2: standing at the edge of the island now looks like
   standing at the edge of the island.
3. **Land.** One flat dominant colour.
4. **Paths.** A single pale trail — the same colour in every biome, so "the pale
   road is where you walk" is learned once — running from the centre of the
   scene to each open edge, ink-outlined, with stepping dots down the middle.
5. **Adjacency doorways.** v1 asks for "flat shapes using the adjacent node's
   dominant color, limited to a small area near the path". They are drawn as a
   band capping each path opening at the frame edge, so the neighbouring land
   reads as showing through a doorway.
6. **Decor.** Biome character: trees, boulders, furrows, blooms, ripples. Placed
   from a seed derived from the node id, so a place looks the same every visit,
   and kept clear of the centre where the player stands.
7. **Features, explorer, effects, prompts.**

Layers 1–6 do not change while the player stands still, so they are painted once
into an offscreen canvas and blitted each frame. This is what makes a fully
animated scene cost almost nothing.

---

## 6. Prompts and typing feedback

A prompt is a cream label with a heavy ink outline, and — where it belongs to an
object rather than a direction — a nub pointing at that object.

The important part is that **the prompt shows its own progress**:

| State | Appearance |
|---|---|
| untouched | cream fill, ink text |
| partly typed | the label fills with `HIGHLIGHT` from the left, in proportion to how much of the word is done; the typed letters are overdrawn in a deeper red |
| complete | the whole label turns `READY` green with cream text and grows slightly |
| not a match | unchanged — nothing flashes or scolds |

The player watches the word complete where they are already looking, instead of
in a text field somewhere else on the page. This matters more, not less, as
prompts move from single letters to whole words.

Labels claim rectangles as they are placed, and each new label dodges the ones
already down, so a character standing near an exit never ends up underneath that
exit's prompt.

Movement prompts sit at the four edge midpoints with a chevron pointing outward.

---

## 7. Motion

v1 left animation undefined. It is defined here, and the rule is: **motion shows
life and confirms actions; it never asks to be watched.**

| What | Motion |
|---|---|
| explorer | a slow breathing bob; faces the direction last travelled |
| water | foam drifts along the shore; open water carries drifting wave marks |
| gems | a sparkle that swells and fades |
| people | a gentle bob, each on their own phase |
| kite, ship | sway and rock |
| owl | blinks about every eight seconds |
| moving between nodes | the world scrolls *against* your travel, the way it does when you walk: head north and the land slides down past you while the new place arrives over the top edge |
| picking something up | a short burst of ink stars at the object |
| winning | confetti, a bouncing headline |

Timing: node transitions take 0.34s on an ease-in-out.

Idle motion is written as `Math.sin(time * k + seed)`, where **`k` is radians
per second** — not Hz, which is the easy misreading and gives something
effectively motionless. Shipped values run `k` = 0.8 to 2.0, or about 0.13 to
0.32 Hz: the ship rocks at 1.1, a person bobs at 1.6, the explorer breathes at
2.0. Stay inside that band; nothing should loop faster than about 3 rad/s.

**Reduced motion.** The whole renderer takes `time` in seconds as its only
animation input. When `prefers-reduced-motion: reduce` is set, `time` is pinned
to zero and transitions and bursts are skipped: the game renders a still,
complete, correct frame. Keeping every animation a pure function of `time` is
what makes that one-line guarantee possible — do not add motion that reads a
clock directly.

---

## 8. The map

Per v1, the map reflects what the player knows, not what the island is.

- Ocean-blue background, the whole map.
- **Discovered** nodes are ink-outlined rounded tiles in the node's dominant
  colour. **Undiscovered** nodes are not drawn at all, so the island's shape is
  revealed by exploring.
- **Completed** nodes carry a green hand-drawn check, over a paper halo. Any
  mark drawn on a node tile has to read against *every* biome colour, and the
  check is close enough to the forest and plains greens to vanish into them
  without one.
- The player is the explorer's own face icon, at her node.
- A small compass sits in a corner, because north always means the top of the
  screen and it is worth saying so.

---

## 9. The page around the game

The game is a picture book, so the page is one too: cream paper, a heavy ink
border, cards with a flat offset shadow in `PAPER_EDGE` — a solid colour block,
never a blur, so the page obeys the same no-shading rule as the art.

The typing bar sits **directly under the scene**, not in the sidebar, so the
player's eyes stay near the picture. The sidebar carries only what is worth
glancing at: where you are, the map, what is in your pockets.

---

## 10. Where this lives in the code

| Concern | File |
|---|---|
| tokens, hand-drawn primitives, texture, text | `src/ink.js` |
| the island map | `src/map-renderer.js` |
| biome palettes | `src/biomes.js` |
| the layer stack, biome art, features, prompts | `src/scene-renderer.js` |
| the explorer | `src/explorer.js` |
| animation loop, transitions, page wiring | `src/main.js` |
| page chrome and CSS tokens | `index.html` |
| the whole art set on one page | `tools/gallery.html` |

`tools/gallery.html` renders the whole art set — biomes, coastlines, the map at
four stages, typing states, the win screen and every feature — from the game's
own modules, with no build step and no dependencies. Open it after any renderer change; it is far
faster than hunting for a rock biome in a real run, and it is the closest thing
the renderer has to a regression test
([D4](decisions.md#d4--canvas-and-dom-code-is-intentionally-untested)).

### Adding a new feature type

Four registries are hand-maintained and there is no code path that will warn
you about missing one:

1. `src/features.js` — `FEATURE_LIST`, for the id and title.
2. `src/scene-renderer.js` — `FEATURE_PAINTERS`, or it draws as a `?` disc.
3. `src/scene-renderer.js` — `PROMPT_ANCHORS`, or its label uses the default
   spacing, which is too tight for anything tall.
4. `tools/gallery.html` — `FEATURE_TYPES`, or it never appears in the gallery.

Placement in a real island is the generator's job, separately.

### Three things that will bite

Each of these cost an afternoon during the overhaul.

1. **`traceSmooth` on a four-point polygon returns a circle.** The midpoint
   quadratics have nothing to hold the edges straight. Smoothing needs the
   dense point list `roughen()` produces, so the two always travel together —
   if `rough` is 0, use `traceLinear`.
2. **The static layer is cached per node**, keyed on id, size, biome and which
   sides are open. Two nodes sharing an id share a background. Real islands
   have unique ids; hand-built test data often does not.
3. **Wobble seeded from anything that changes per frame makes the scene
   shimmer.** Seed from the node or feature id, never from `time`.

---

## 11. Still not defined

- **Asset production pipeline.** Still none, and still not needed: everything is
  drawn in code from the primitives in `src/ink.js`. If real assets ever arrive,
  that is a v3 conversation.
- **Sound.** Never discussed. Out of scope.
- **The explorer's own art.** Her silhouette predates this document and was left
  alone on purpose; only her outline colour, facing and bob are new.

---

## Status

**Visual Notes v2.** Supersedes v1's *"What is intentionally not defined yet"*
section only. Treat it as a shared reference and a guide for consistency, not as
a final art specification.
