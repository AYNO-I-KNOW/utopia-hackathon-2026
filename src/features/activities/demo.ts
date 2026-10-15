import type { Activity } from "./storage";

/** Fixed prototype calendar; replace with server time when real data is connected. */
export const DEMO_CURRENT_DATE = "2026-10-16";
const dailySchedule = [
  ["06:30", "awake", "Woke up, stretching and making sounds"],
  ["07:00", "hungry", "Sucking hands and showing rooting cues"],
  ["09:15", "sleepy", "Yawning and rubbing eyes; settled in a quiet space"],
  ["11:40", "uncomfortable", "Wet diaper; more comfortable after changing"],
  ["13:10", "hungry", "Crying on and off before a feed"],
  ["15:20", "wantsHolding", "Settled when held and gently rocked"],
  ["17:00", "awake", "Woke from an afternoon nap in a happy mood"],
  ["19:30", "sleepy", "Getting sleepy; dimmed the lights for bedtime"],
] as const;

export const demoActivities: Activity[] = Array.from(
  { length: 7 },
  (_, index) => {
    const date = `2026-10-${String(10 + index).padStart(2, "0")}`;
    return dailySchedule.map(([time, activity, note], position) => {
      const [hours, minutes] = time.split(":").map(Number);
      const shifted = minutes + (index % 3) * 5;
      const from = `${String(hours + Math.floor(shifted / 60)).padStart(2, "0")}:${String(shifted % 60).padStart(2, "0")}`;
      return {
        id: `demo-${date}-${position}`,
        date,
        activity,
        from,
        to: from,
        note,
      };
    });
  },
).flat();
