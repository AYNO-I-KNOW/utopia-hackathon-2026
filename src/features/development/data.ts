import { growthCopy } from "@/content/development";
export const metricIds = ["weight", "height", "sleep", "feeding"] as const;
export type MetricId = (typeof metricIds)[number];
export type Period = "week" | "month" | "year";
export const metrics = {
  weight: {
    label: growthCopy.weight,
    value: 6.8,
    unit: growthCopy.kg,
    change: growthCopy.weightChange,
    icon: "3-582-imgImage18.png",
    background: "3-582-imgGroup1.svg",
    color: "weight",
    frame: "3:430",
    chart: "line",
    max: 10,
  },
  height: {
    label: growthCopy.height,
    value: 63,
    unit: growthCopy.cm,
    change: growthCopy.heightChange,
    icon: "3-582-imgImage19.png",
    background: "3-582-imgGroup3.svg",
    color: "height",
    frame: "3:506",
    chart: "line",
    max: 100,
  },
  sleep: {
    label: growthCopy.sleep,
    value: 10.5,
    unit: growthCopy.hoursPerDay,
    change: growthCopy.sleepChange,
    icon: "3-582-imgImage21.png",
    background: "3-582-imgGroup2.svg",
    color: "sleep",
    frame: "3:260",
    chart: "bar",
    max: 25,
  },
  feeding: {
    label: growthCopy.feeding,
    value: 5,
    unit: growthCopy.timesPerDay,
    change: growthCopy.feedingChange,
    icon: "3-582-imgImage22.png",
    background: "3-582-imgGroup4.svg",
    color: "feeding",
    frame: "3:345",
    chart: "bar",
    max: 25,
  },
} as const;
export function isMetric(value: string): value is MetricId {
  return metricIds.some((id) => id === value);
}
export const sampleBars: Record<Period, number[]> = {
  week: [8, 9.5, 10.85, 10.5, 12.5, 11, 5.3],
  month: [8.5, 10, 11.5, 10.5, 12, 11, 10],
  year: [9, 10, 10.5, 11, 11.5, 10.5, 12],
};
export type GrowthEntry = {
  id: string;
  metric: MetricId;
  value: number;
  date: string;
};
export function parseEntries(raw: string | null): GrowthEntry[] {
  const value: unknown = JSON.parse(raw ?? "[]");
  return Array.isArray(value)
    ? value.filter(
        (item): item is GrowthEntry =>
          typeof item === "object" &&
          item !== null &&
          "id" in item &&
          typeof item.id === "string" &&
          "metric" in item &&
          typeof item.metric === "string" &&
          isMetric(item.metric) &&
          "value" in item &&
          typeof item.value === "number" &&
          Number.isFinite(item.value) &&
          item.value > 0 &&
          "date" in item &&
          typeof item.date === "string",
      )
    : [];
}
