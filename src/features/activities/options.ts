import { copy } from "@/content";
import { th } from "@/content/th";
export const activityKinds = [
  "sleepy",
  "hungry",
  "uncomfortable",
  "awake",
  "wantsHolding",
] as const;
const legacyKinds = [
  "feeding",
  "diaper",
  "sleep",
  "play",
  "comfort",
  "other",
] as const;
export function activityLabel(value: string) {
  const key = [...activityKinds, ...legacyKinds].find(
    (kind) => kind === value || th[kind] === value,
  );
  return key ? copy[key] : value;
}
