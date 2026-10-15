export const CRY_LABELS = [
  "hungry",
  "hug",
  "awake",
  "uncomfortable",
  "sleepy",
  "diaper",
] as const;
export type CryLabel = (typeof CRY_LABELS)[number];
export type AnalysisCase = "confident" | "close" | "unsure" | "no_cry";
export type AskKey = "last_feed" | "last_diaper";
export type TopItem = { label: CryLabel; prob: number };
export type AnalysisResult = {
  case: AnalysisCase;
  cry_prob: number;
  top: TopItem[];
  ask: AskKey[];
  summary: string;
  checklist: string[];
  suggest_lullaby: boolean;
  see_doctor: boolean;
};
export type AnalysisContext = {
  last_feed_min: number | null;
  last_diaper_min: number | null;
  last_sleep_end_min: number | null;
};

const CASES: readonly string[] = ["confident", "close", "unsure", "no_cry"];
const ASK_KEYS: readonly string[] = ["last_feed", "last_diaper"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}
function isTopItem(value: unknown): value is TopItem {
  return (
    isRecord(value) &&
    typeof value.label === "string" &&
    (CRY_LABELS as readonly string[]).includes(value.label) &&
    typeof value.prob === "number" &&
    Number.isFinite(value.prob)
  );
}

/** Narrow an untrusted /analyze body; returns null when the shape is wrong. */
export function parseAnalysis(value: unknown): AnalysisResult | null {
  if (!isRecord(value)) return null;
  const { top, ask, checklist } = value;
  if (
    typeof value.case !== "string" ||
    !CASES.includes(value.case) ||
    typeof value.cry_prob !== "number" ||
    !Array.isArray(top) ||
    !top.every(isTopItem) ||
    !isStringArray(ask) ||
    !ask.every((key) => ASK_KEYS.includes(key)) ||
    typeof value.summary !== "string" ||
    !isStringArray(checklist) ||
    typeof value.suggest_lullaby !== "boolean" ||
    typeof value.see_doctor !== "boolean"
  )
    return null;
  return {
    case: value.case as AnalysisCase,
    cry_prob: value.cry_prob,
    top,
    ask: ask as AskKey[],
    summary: value.summary,
    checklist,
    suggest_lullaby: value.suggest_lullaby,
    see_doctor: value.see_doctor,
  };
}
