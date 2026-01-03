# High-Level Tasks

## Track: Inventory, Actions, Quests
- Transition from `gemsCollected: number` to a generic inventory map (e.g., `{"gem": 5, "shell": 2}`).
- Update reducer to handle generic item pickups.
- Update UI to display inventory counts.
- Support non-consumable actions (Talk, Inspect) that persist after activation.
- Separate "completion" (logic state) from "removal" (visual state).
- Implement Quest Giver state machine (Incomplete -> Complete).
- Implement conditional logic (check visited nodes, check inventory).
- Implement reward spawning (completing a quest spawns a gem).
- Update generator to place NPCs/Signs.
- Quest reward spawning model: keep island immutable, define reward gem features/actions up front and gate their visibility with quest-complete conditions (hidden-until-ready, derived state).

## Track: Rendering and Visuals
- DONE: Add more biomes (forest, desert, others?).
- Improve path rendering.
- Improve feature rendering.

## Track: Typing Progression
- Characterize player's typing ability.
- Implement letter/word difficulty characterization.
- Adjust action prompt difficulty based on player progress.

## Track: Pockets aka Sub-Areas
- Figure out a compelling reason to implement this.

