import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPrompt } from "./ubot-prompt.ts";
import type { AnalysisResult } from "../analysis/parse.ts";

const result: AnalysisResult = {
  case: "close",
  cry_prob: 0.9,
  top: [
    { label: "hungry", prob: 0.512 },
    { label: "sleepy", prob: 0.31 },
    { label: "diaper", prob: 0.1 },
  ],
  ask: [],
  summary: "",
  checklist: [],
  suggest_lullaby: false,
  see_doctor: false,
};

test("includes top two labels, case and 24 h activity", () => {
  const prompt = buildPrompt(result, {
    feeds: 3,
    lastFeedMin: 95,
    lastDiaperMin: null,
    sleepMin: 600,
  });
  assert.match(prompt, /hungry 51% \/ sleepy 31% \(case: close call\)/);
  assert.doesNotMatch(prompt, /due for a diaper change 10%/);
  assert.match(prompt, /3 feeds · last feed: 1 h 35 min ago/);
  assert.match(prompt, /last diaper change: no data · sleep: 10 h/);
});

test("marks missing data and empty result", () => {
  const prompt = buildPrompt(
    { ...result, case: "no_cry", top: [] },
    { feeds: 0, lastFeedMin: null, lastDiaperMin: null, sleepMin: null },
  );
  assert.match(prompt, /Result: - \(case: no crying detected\)/);
  assert.match(prompt, /sleep: no data/);
});
