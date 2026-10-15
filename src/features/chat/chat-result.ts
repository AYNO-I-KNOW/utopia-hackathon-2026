import type { AnalysisResult, ChatResult } from "../analysis/parse";

/** Top-1 label for /chat; null (no_cry has no top) lets the backend use generic advice. */
export function toChatResult(result: AnalysisResult): ChatResult | null {
  const first = result.top[0];
  if (!first) return null;
  return {
    label: first.label,
    confidence: Math.round(Math.min(1, Math.max(0, first.prob)) * 100),
    case: result.case,
  };
}
