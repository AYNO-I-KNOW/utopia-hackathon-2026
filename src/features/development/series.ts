import type { GrowthEntry, MetricId, Period } from "./data";
/** Select real local records for the period; never mix demo points into saved data. */
export function recordedSeries(
  entries: GrowthEntry[],
  metric: MetricId,
  period: Period,
  today: string,
) {
  const end = new Date(today + "T12:00:00Z");
  const start = new Date(end);
  if (period === "week") start.setUTCDate(start.getUTCDate() - 6);
  else if (period === "month") start.setUTCMonth(start.getUTCMonth() - 1);
  else start.setUTCFullYear(start.getUTCFullYear() - 1);
  const first = start.toISOString().slice(0, 10);
  return entries
    .filter(
      (entry) =>
        entry.metric === metric && entry.date >= first && entry.date <= today,
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}
