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
  assert.match(prompt, /หิว 51% \/ ง่วงนอน 31% \(case: ใกล้เคียงกัน\)/);
  assert.doesNotMatch(prompt, /ผ้าอ้อม 10%/);
  assert.match(prompt, /ให้นม 3 ครั้ง ล่าสุด 1 ชม\. 35 นาทีที่แล้ว/);
  assert.match(prompt, /ผ้าอ้อม ล่าสุด ไม่มีข้อมูล · นอน 10 ชม\./);
});

test("marks missing data and empty result", () => {
  const prompt = buildPrompt(
    { ...result, case: "no_cry", top: [] },
    { feeds: 0, lastFeedMin: null, lastDiaperMin: null, sleepMin: null },
  );
  assert.match(prompt, /ผล: - \(case: ไม่พบเสียงร้อง\)/);
  assert.match(prompt, /นอน ไม่มีข้อมูล/);
});
