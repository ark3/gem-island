# Gem Island Documentation Index

This index exists so that no one — human or agent — has to guess which document
is authoritative. Each entry states what the document governs and whether it is
still current.

**Read this file first.** If you only read one other thing, read
[`decisions.md`](decisions.md), which records where the code deliberately
differs from the design documents.

---

## How authority works here

The design documents describe **intent**. The code describes **what is**.

When the two disagree, exactly one of these is true:

1. **The divergence is recorded in [`decisions.md`](decisions.md).** The
   decision wins. The design document is out of date on that point, and the
   decision entry says so.
2. **The divergence is not recorded.** This is an open question, not a silent
   preference. Either the code has drifted (fix the code) or a decision was made
   and never written down (add it to `decisions.md`). Do not quietly follow one
   side.

This supersedes the older rule — "if code contradicts the design docs, trust the
design docs" — which was written before any deliberate divergences existed and
is now misleading. See `decisions.md`, entry D1.

---

## Current documents

| Document | Governs | Status |
|---|---|---|
| [`initial-full-design.md`](initial-full-design.md) | What the game *is*: player experience, core loop, node/action model, quest structure. The broadest description. | **Current** |
| [`design-v2.md`](design-v2.md) | Spatial semantics, directional consistency, map behavior, node and pocket completion rules. | **Current** |
| [`rendering-v1.md`](rendering-v1.md) | How scenes are drawn: the layer stack, biome and feature metadata, adjacency hints. | **Current**, partly aspirational |
| [`visual-v1.md`](visual-v1.md) | How the game *looks*: coloring-book aesthetic, camera, composition, map visuals. Explicitly not a final art spec. | **Current** |
| [`decisions.md`](decisions.md) | Deliberate divergences from the above, with rationale and date. | **Current** |

## Partly superseded documents

| Document | Status |
|---|---|
| [`design-v1.md`](design-v1.md) | **Superseded in part.** `design-v2.md` supersedes and clarifies *parts* of it — spatial semantics, map behaviour, completion rules and pockets — and says so in its own preamble. The rest still stands, notably the "Design invariant" summary and the out-of-scope list, neither of which v2 restates. Check v2 first on the topics above; fall back here otherwise. |

---

## Conventions for these documents

- Design documents are **snapshots**, revised intentionally rather than
  incrementally. A new major revision gets a new `-vN` file; the older one stays,
  and this index records which parts of it the new revision replaced. A revision
  that supersedes only part of its predecessor should say which part.
- Implementation decisions that contradict a snapshot go in `decisions.md`, not
  into the snapshot. Snapshots record what we meant; the decision log records
  what we chose instead, and why.
- Work tracking lives in [`../tasks.md`](../tasks.md), not here.
- Agent and contributor guidance lives in [`../AGENTS.md`](../AGENTS.md).
