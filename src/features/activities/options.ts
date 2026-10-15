import { copy } from "@/content";
import { th } from "@/content/th";
export const activityKinds = [
  "feeding",
  "diaper",
  "sleep",
  "play",
  "comfort",
  "other",
] as const;
export function activityLabel(value: string) {
  const key = activityKinds.find(
    (kind) => kind === value || th[kind] === value,
  );
  return key ? copy[key] : value;
}
