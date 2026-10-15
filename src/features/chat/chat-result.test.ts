import { test } from "node:test";
import assert from "node:assert/strict";
import { toChatResult } from "./chat-result.ts";
import type { AnalysisResult } from "../analysis/parse.ts";

const base: AnalysisResult = {
  case: "confident",
  cry_prob: 0.9,
  top: [{ label: "diaper", prob: 0.824 }],
  ask: [],
  summary: "",
  checklist: [],
  suggest_lullaby: false,
  see_doctor: false,
};

test("maps top-1 to a 0-100 confidence with the case", () => {
  assert.deepEqual(toChatResult(base), {
    label: "diaper",
    confidence: 82,
    case: "confident",
  });
});

test("returns null when there is no top label", () => {
  assert.equal(toChatResult({ ...base, case: "no_cry", top: [] }), null);
});
