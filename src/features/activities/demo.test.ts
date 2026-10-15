import test from "node:test";
import assert from "node:assert/strict";
import { demoActivities, DEMO_CURRENT_DATE } from "./demo.ts";

test("prototype contains seven full days and all five cry states without future entries", () => {
  const dates = [...new Set(demoActivities.map((entry) => entry.date))];
  assert.equal(dates.length, 7);
  assert.equal(dates[0], "2026-10-10");
  assert.equal(dates.at(-1), DEMO_CURRENT_DATE);
  for (const date of dates) {
    const entries = demoActivities.filter((entry) => entry.date === date);
    assert.equal(entries.length, 8);
    assert.equal(new Set(entries.map((entry) => entry.activity)).size, 5);
    assert.ok(entries.every((entry) => entry.date <= DEMO_CURRENT_DATE));
  }
  assert.equal(
    new Set(demoActivities.map((entry) => entry.id)).size,
    demoActivities.length,
  );
});
