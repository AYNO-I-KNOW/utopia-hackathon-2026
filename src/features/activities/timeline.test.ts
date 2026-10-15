import test from "node:test";
import assert from "node:assert/strict";
import { timelineForDate } from "./timeline.ts";

const make = (id: string, date: string, from: string) => ({
  id,
  date,
  activity: "awake" as const,
  from,
  to: from,
  note: "",
});
const base = { date: "2026-10-16", today: "2026-10-16", now: "23:59" };
const ids = (items: { id: string }[]) => items.map((item) => item.id);

test("sorts newest start time first", () => {
  const demo = [make("d1", base.date, "07:00"), make("d2", base.date, "15:00")];
  const user = [make("u1", base.date, "10:00")];
  assert.deepEqual(ids(timelineForDate({ ...base, demo, user })), [
    "d2",
    "u1",
    "d1",
  ]);
});

test("ties: latest saved user entry first, demo last", () => {
  const demo = [make("d1", base.date, "10:00")];
  const user = [make("u1", base.date, "10:00"), make("u2", base.date, "10:00")];
  assert.deepEqual(ids(timelineForDate({ ...base, demo, user })), [
    "u2",
    "u1",
    "d1",
  ]);
});

test("hides future demo entries today but keeps user entries", () => {
  const demo = [make("d1", base.date, "09:00"), make("d2", base.date, "15:00")];
  const user = [make("u1", base.date, "18:00")];
  assert.deepEqual(
    ids(timelineForDate({ ...base, now: "10:00", demo, user })),
    ["u1", "d1"],
  );
});

test("keeps demo entry starting exactly now", () => {
  const demo = [make("d1", base.date, "10:00")];
  assert.deepEqual(
    ids(timelineForDate({ ...base, now: "10:00", demo, user: [] })),
    ["d1"],
  );
});

test("other dates are not time-filtered and other days are excluded", () => {
  const demo = [
    make("d1", "2026-10-15", "19:30"),
    make("d2", "2026-10-15", "06:30"),
    make("d3", "2026-10-16", "08:00"),
  ];
  assert.deepEqual(
    ids(
      timelineForDate({
        ...base,
        date: "2026-10-15",
        now: "01:00",
        demo,
        user: [],
      }),
    ),
    ["d1", "d2"],
  );
});

test("returns empty when every demo entry is in the future", () => {
  const demo = [make("d1", base.date, "09:00")];
  assert.deepEqual(
    timelineForDate({ ...base, now: "05:00", demo, user: [] }),
    [],
  );
});
