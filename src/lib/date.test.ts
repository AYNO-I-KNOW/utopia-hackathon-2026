import { test } from "node:test";
import assert from "node:assert/strict";
import { dateKey, formatElapsed } from "./date.ts";
test("timer rolls into minutes and hours", () => {
  assert.equal(formatElapsed(59), "00:59");
  assert.equal(formatElapsed(60), "01:00");
  assert.equal(formatElapsed(3600), "01:00:00");
});
test("activity date follows Bangkok midnight", () => {
  assert.equal(dateKey(new Date("2026-10-14T18:00:00Z")), "2026-10-15");
});
