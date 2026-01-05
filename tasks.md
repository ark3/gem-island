# High-Level Tasks

## Track: Inventory, Actions, Quests
- DONE: Use repeatable talk actions (current `say` kind) for NPCs/signs.
  - Talk actions remain available after activation.
- DONE: Mark talk features as complete on first interaction for map completion.
  - Do not remove or hide talk features or talk actions after completion.
- Transition from `gemsCollected: number` to a generic inventory map (e.g., `{"gem": 5, "shell": 2}`).
  - *Context:* Ensure Win Condition (ship action) checks "gem" count in this new map.
- Update reducer to handle generic item pickups.
- Update UI to display inventory counts.
- Separate "completion" (logic state) from "removal" (visual state) for all non-consumable actions.
  - Needed so quest givers can complete without disappearing.
  - Currently only gems are removed, so talk appears to work by accident; make the rule explicit.
  - Define a general rule or flag for which actions/features are removable vs repeatable.
  - Drive visibility from that rule instead of completion status.
- Implement quest givers via feature completion state (no standalone quest objects).
  - Keep quest givers visible and interactive after completion.
  - *Context:* Logic must handle "Condition Met" (consume items, mark feature complete, spawn reward) vs "Already Complete" (flavor text).
- Implement conditional logic (check visited nodes, check inventory, check completed features).
- Implement quest metadata on talk actions (type, target, dialog lines, optional consume).
- Implement reward spawning (completing a quest reveals a gem).
  - Keep island immutable: define reward gem features/actions up front and gate their visibility with feature-complete conditions (derived state).
  - *Context:* Add `req` or `condition` fields to Actions; update `getVisibleActions` to filter.
- Update generator to place NPCs/Signs and attach quest metadata to talk actions.

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
