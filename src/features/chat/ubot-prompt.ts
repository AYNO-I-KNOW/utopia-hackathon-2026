import { th } from "../../content/th.ts";
import type { RecentSummary } from "../activities/context";
import type { AnalysisResult } from "../analysis/parse";

const MINUTES_PER_HOUR = 60;
const TOP_IN_PROMPT = 2;

const percent = (prob: number) =>
  Math.round(Math.min(1, Math.max(0, prob)) * 100);

function duration(minutes: number) {
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const rest = minutes % MINUTES_PER_HOUR;
  const parts = [];
  if (hours) parts.push(`${hours} ${th.hourUnit}`);
  if (rest || !hours) parts.push(`${rest} ${th.minuteUnit}`);
  return parts.join(" ");
}

const ago = (minutes: number | null) =>
  minutes === null
    ? th.promptNone
    : th.promptAgo.replace("{x}", duration(minutes));

/** Handoff text for U-bot (docs/BACKEND.md §6): analysis result plus the last 24 h. */
export function buildPrompt(result: AnalysisResult, recent: RecentSummary) {
  const list = result.top
    .slice(0, TOP_IN_PROMPT)
    .map((item) => `${th.cryLabels[item.label].name} ${percent(item.prob)}%`)
    .join(" / ");
  return [
    th.promptIntro,
    th.promptResult
      .replace("{list}", list || "-")
      .replace("{case}", th.caseNames[result.case]),
    th.promptActivity
      .replace("{n}", String(recent.feeds))
      .replace("{feed}", ago(recent.lastFeedMin))
      .replace("{diaper}", ago(recent.lastDiaperMin))
      .replace(
        "{sleep}",
        recent.sleepMin === null ? th.promptNone : duration(recent.sleepMin),
      ),
    th.promptAsk,
  ].join("\n");
}
