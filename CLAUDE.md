# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

**All project guidance lives in [`AGENTS.md`](AGENTS.md).** Read that file.

It is the canonical location so that every tool used against this repository —
Claude Code and otherwise — reads the same instructions. Do not add substantive
content here; it will drift out of sync with `AGENTS.md`.

Quick orientation:

| What you need | Where it lives |
|---|---|
| Commands, architecture, conventions | [`AGENTS.md`](AGENTS.md) |
| Design intent | [`docs/README.md`](docs/README.md) — indexes every design document |
| Where the code deliberately differs from the design | [`docs/decisions.md`](docs/decisions.md) |
| Open and completed work | [`tasks.md`](tasks.md) |

Run the tests with `node --test`. Open `index.html` in a browser to play; there
is no build step.
