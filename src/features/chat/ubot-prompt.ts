import { en } from "../../content/en.ts";
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
  if (hours) parts.push(`${hours} ${en.hourUnit}`);
  if (rest || !hours) parts.push(`${rest} ${en.minuteUnit}`);
  return parts.join(" ");
}

const ago = (minutes: number | null) =>
  minutes === null
    ? en.promptNone
    : en.promptAgo.replace("{x}", duration(minutes));

/** Handoff text for U-bot (docs/BACKEND.md §6): analysis result plus the last 24 h. */
export function buildPrompt(result: AnalysisResult, recent: RecentSummary) {
  const list = result.top
    .slice(0, TOP_IN_PROMPT)
    .map((item) => `${en.cryLabels[item.label].name} ${percent(item.prob)}%`)
    .join(" / ");
  return [
    en.promptIntro,
    en.promptResult
      .replace("{list}", list || "-")
      .replace("{case}", en.caseNames[result.case]),
    en.promptActivity
      .replace("{n}", String(recent.feeds))
      .replace("{feed}", ago(recent.lastFeedMin))
      .replace("{diaper}", ago(recent.lastDiaperMin))
      .replace(
        "{sleep}",
        recent.sleepMin === null ? en.promptNone : duration(recent.sleepMin),
      ),
    en.promptAsk,
  ].join("\n");
}
