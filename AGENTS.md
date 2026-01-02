# Agent Context: Gem Island

## 1. Authority & Documentation
- **Design Truth:** The authoritative source for *what* we are building is in the `docs/` directory. Read those files first.
- **Priority:** If code contradicts the design docs, trust the design docs (unless explicitly told otherwise).
- **Current Focus:** We are currently aligning the implementation with `docs/initial-full-design.md`.

## 2. Operational Directives
- **Environment:** Native Browser ES Modules.
  - **No Build Step:** Do not introduce bundlers (Webpack/Vite) or transpilers.
  - **Imports:** Always include the `.js` extension (e.g., `import { x } from "./utils.js"`).
- **Testing:**
  - **Command:** `node --test`
  - **Location:** `tests/`
  - **Rule:** Logic in `island-engine.js` and `island.generator.js` must remain pure and testable in Node.js (no DOM/Canvas references).

## 3. Architectural Map
- **`src/island-engine.js`**: **Pure Logic**. The reducer, state transitions, and query functions.
- **`src/main.js`**: **The Shell**. Handles DOM, Input, and Canvas rendering.
- **`src/island.generator.js`**: **ProcGen**. Creates the graph structure.

## 4. Coding Conventions
- **State:** Prefer **derived state** over stored state.
  - *Example:* Calculate `isCompleted` by checking if all actions are done; do not store an `isCompleted` boolean.
- **Style:** Functional core (pure functions), imperative shell.
