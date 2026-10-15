import { bangkokInstant } from "../../lib/date.ts";
import { th } from "../../content/th.ts";
import type { AnalysisContext } from "../analysis/parse";
import type { Activity } from "./storage";

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_DAY = 24 * 60;
type Kind = keyof typeof th;
type Point = "start" | "end";

const FEED: Kind[] = ["hungry", "feeding"];
const DIAPER: Kind[] = ["diaper"];

function isKind(item: Activity, kinds: Kind[]) {
  return kinds.some(
    (kind) => item.activity === kind || item.activity === th[kind],
  );
}

function instant(item: Activity, point: Point) {
  const start = bangkokInstant(item.date, item.from);
  if (point === "start") return start;
  const end = bangkokInstant(item.date, item.to);
  // An end clock time before the start means the entry crossed Bangkok midnight.
  return end < start ? end + MINUTES_PER_DAY * MS_PER_MINUTE : end;
}

function minutesAgo(items: Activity[], kinds: Kind[], point: Point, now: Date) {
  let best: number | null = null;
  for (const item of items) {
    if (!isKind(item, kinds)) continue;
    const time = instant(item, point);
    if (!Number.isFinite(time) || time > now.getTime()) continue;
    const minutes = Math.floor((now.getTime() - time) / MS_PER_MINUTE);
    if (best === null || minutes < best) best = minutes;
  }
  return best;
}

function earliest(a: number | null, b: number | null) {
  return a === null ? b : b === null ? a : Math.min(a, b);
}

/**
 * Context for /analyze from saved entries only. "Woke up" is the latest of a
 * sleep entry's end and an awake entry's start; "sleepy" marks the onset of
 * sleep, not waking, so it is ignored.
 */
export function buildContext(items: Activity[], now: Date): AnalysisContext {
  return {
    last_feed_min: minutesAgo(items, FEED, "end", now),
    last_diaper_min: minutesAgo(items, DIAPER, "end", now),
    last_sleep_end_min: earliest(
      minutesAgo(items, ["sleep"], "end", now),
      minutesAgo(items, ["awake"], "start", now),
    ),
  };
}

export type RecentSummary = {
  feeds: number;
  lastFeedMin: number | null;
  lastDiaperMin: number | null;
  sleepMin: number | null;
};

/** Last 24 h digest for the U-bot handoff prompt. */
export function summarizeRecent(items: Activity[], now: Date): RecentSummary {
  const since = now.getTime() - MINUTES_PER_DAY * MS_PER_MINUTE;
  const recent = (kinds: Kind[]) =>
    items.filter((item) => {
      const time = instant(item, "start");
      return isKind(item, kinds) && time >= since && time <= now.getTime();
    });
  const sleepMs = recent(["sleep"]).reduce(
    (sum, item) => sum + (instant(item, "end") - instant(item, "start")),
    0,
  );
  return {
    feeds: recent(FEED).length,
    lastFeedMin: minutesAgo(items, FEED, "end", now),
    lastDiaperMin: minutesAgo(items, DIAPER, "end", now),
    sleepMin: sleepMs > 0 ? Math.round(sleepMs / MS_PER_MINUTE) : null,
  };
}
