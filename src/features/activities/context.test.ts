import { test } from "node:test";
import assert from "node:assert/strict";
import { buildContext, summarizeRecent } from "./context.ts";
import type { Activity } from "./storage.ts";

// 2026-10-15 12:00 Bangkok
const NOW = new Date("2026-10-15T05:00:00Z");
const entry = (
  activity: string,
  date: string,
  from: string,
  to = from,
): Activity => ({
  id: `${activity}${date}${from}`,
  activity,
  date,
  from,
  to,
  note: "",
});

test("returns all null without entries", () => {
  assert.deepEqual(buildContext([], NOW), {
    last_feed_min: null,
    last_diaper_min: null,
    last_sleep_end_min: null,
  });
});

test("measures minutes since the latest entry of each kind", () => {
  const items = [
    entry("hungry", "2026-10-15", "08:00"),
    entry("feeding", "2026-10-15", "11:15"),
    entry("diaper", "2026-10-15", "10:00"),
    entry("sleep", "2026-10-15", "09:00", "10:30"),
    entry("awake", "2026-10-15", "11:00"),
  ];
  assert.deepEqual(buildContext(items, NOW), {
    last_feed_min: 45,
    last_diaper_min: 120,
    last_sleep_end_min: 60,
  });
});

test("ignores sleepy and unrelated kinds for wake time", () => {
  const items = [
    entry("sleepy", "2026-10-15", "11:50"),
    entry("play", "2026-10-15", "11:55"),
  ];
  assert.equal(buildContext(items, NOW).last_sleep_end_min, null);
});

test("reads legacy Thai labels", () => {
  const items = [entry("ให้นม", "2026-10-15", "11:00")];
  assert.equal(buildContext(items, NOW).last_feed_min, 60);
});

test("cross-midnight entry ends on the next day", () => {
  const items = [entry("sleep", "2026-10-14", "22:00", "06:00")];
  assert.equal(buildContext(items, NOW).last_sleep_end_min, 360);
});

test("ignores future and malformed entries", () => {
  const items = [
    entry("hungry", "2026-10-15", "12:30"),
    entry("hungry", "2026-10-16", "08:00"),
    entry("hungry", "bad", "08:00"),
  ];
  assert.equal(buildContext(items, NOW).last_feed_min, null);
});

test("Bangkok date, not UTC date, anchors entries", () => {
  // 00:30 Bangkok on the 15th is 17:30Z on the 14th.
  const now = new Date("2026-10-14T17:45:00Z");
  const items = [entry("hungry", "2026-10-15", "00:30")];
  assert.equal(buildContext(items, now).last_feed_min, 15);
});

test("summarizes the last 24 hours", () => {
  const items = [
    entry("hungry", "2026-10-15", "08:00"),
    entry("hungry", "2026-10-14", "11:00"),
    entry("hungry", "2026-10-14", "13:00"),
    entry("sleep", "2026-10-15", "09:00", "10:30"),
  ];
  assert.deepEqual(summarizeRecent(items, NOW), {
    feeds: 2,
    lastFeedMin: 240,
    lastDiaperMin: null,
    sleepMin: 90,
  });
});
