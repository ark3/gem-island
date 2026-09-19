import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_TIER,
  KEYBOARD_ROWS,
  PROMPT_TIERS,
  TIER_ORDER,
  getPromptTier,
  listPromptTiers,
} from "../src/prompt-lists.js";

test("every prompt uses only the letters its tier allows", () => {
  for (const [id, tier] of Object.entries(PROMPT_TIERS)) {
    for (const prompt of tier.prompts) {
      for (const char of prompt) {
        assert.ok(
          tier.allowedLetters.has(char),
          `tier "${id}" prompt "${prompt}" uses "${char}", which that tier does not teach`,
        );
      }
    }
  }
});

test("every prompt is lowercase ascii with no whitespace", () => {
  for (const [id, tier] of Object.entries(PROMPT_TIERS)) {
    for (const prompt of tier.prompts) {
      assert.match(
        prompt,
        /^[a-z]+$/,
        `tier "${id}" prompt "${prompt}" must be lowercase a-z only`,
      );
    }
  }
});

test("no tier repeats a prompt", () => {
  for (const [id, tier] of Object.entries(PROMPT_TIERS)) {
    const seen = new Set(tier.prompts);
    assert.equal(seen.size, tier.prompts.length, `tier "${id}" repeats a prompt`);
  }
});

test("prompts fit the typing buffer", () => {
  // TypingEngine caps the buffer at 15 characters; a longer prompt could
  // never be completed.
  for (const tier of Object.values(PROMPT_TIERS)) {
    for (const prompt of tier.prompts) {
      assert.ok(prompt.length <= 15, `prompt "${prompt}" cannot be typed`);
    }
  }
});

test("each tier holds enough prompts for a crowded node", () => {
  // A node can show four movement actions plus several features. The prompt
  // service needs room to hand every visible action a distinct prompt.
  for (const [id, tier] of Object.entries(PROMPT_TIERS)) {
    assert.ok(tier.prompts.length >= 8, `tier "${id}" is too small to fill a node`);
  }
});

test("home-row tiers stay on the home row", () => {
  const homeLetters = new Set(KEYBOARD_ROWS.home.split(""));
  for (const id of ["home-letters", "home-words"]) {
    for (const prompt of PROMPT_TIERS[id].prompts) {
      for (const char of prompt) {
        assert.ok(homeLetters.has(char), `"${prompt}" leaves the home row`);
      }
    }
  }
});

test("home-letters covers every home row key", () => {
  const prompts = new Set(PROMPT_TIERS["home-letters"].prompts);
  for (const char of KEYBOARD_ROWS.home) {
    assert.ok(prompts.has(char), `home row key "${char}" is never practised`);
  }
});

test("tier order lists every tier, easiest first", () => {
  assert.deepEqual([...TIER_ORDER].sort(), Object.keys(PROMPT_TIERS).sort());
  assert.ok(TIER_ORDER.includes(DEFAULT_TIER));
});

test("getPromptTier falls back to the default for unknown input", () => {
  for (const bad of ["nonsense", "", null, undefined, 42, {}]) {
    assert.equal(getPromptTier(bad).id, DEFAULT_TIER);
  }
  assert.equal(getPromptTier("home-letters").id, "home-letters");
});

test("listPromptTiers returns tiers in progression order with ids", () => {
  const listed = listPromptTiers();
  assert.deepEqual(listed.map((tier) => tier.id), [...TIER_ORDER]);
  for (const tier of listed) {
    assert.ok(tier.label && tier.description && tier.prompts.length);
  }
});
