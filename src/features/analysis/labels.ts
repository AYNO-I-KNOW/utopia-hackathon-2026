import { copy } from "@/content";
import type { CryLabel } from "./parse";
import type { activityKinds } from "../activities/options";

type ActivityKind = (typeof activityKinds)[number];

const ACTIVITY_KIND: Record<CryLabel, ActivityKind> = {
  hungry: "hungry",
  hug: "wantsHolding",
  awake: "awake",
  uncomfortable: "uncomfortable",
  sleepy: "sleepy",
  diaper: "diaper",
};

export function labelCopy(label: CryLabel) {
  return copy.cryLabels[label];
}

export function activityKindForLabel(label: CryLabel): ActivityKind {
  return ACTIVITY_KIND[label];
}

export function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function toPercent(prob: number) {
  return Math.round(Math.min(1, Math.max(0, prob)) * 100);
}
