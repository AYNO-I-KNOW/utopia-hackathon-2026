import { test } from "node:test";
import assert from "node:assert/strict";
import { recordedSeries } from "./series.ts";
test("filters recorded metrics, dates and periods without inserting demo data", () => {
  const entries = [
    { id: "a", metric: "weight" as const, value: 6.7, date: "2026-10-01" },
    { id: "b", metric: "weight" as const, value: 6.8, date: "2026-10-15" },
    { id: "c", metric: "height" as const, value: 63, date: "2026-10-15" },
  ];
  assert.deepEqual(
    recordedSeries(entries, "weight", "week", "2026-10-15").map((e) => e.id),
    ["b"],
  );
  assert.deepEqual(
    recordedSeries(entries, "weight", "month", "2026-10-15").map((e) => e.id),
    ["a", "b"],
  );
  assert.equal(
    recordedSeries(entries, "sleep", "year", "2026-10-15").length,
    0,
  );
});
