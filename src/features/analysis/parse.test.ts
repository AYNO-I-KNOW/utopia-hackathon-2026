import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAnalysis } from "./parse.ts";

const valid = {
  case: "close",
  cry_prob: 0.9,
  top: [{ label: "hungry", prob: 0.5 }],
  ask: ["last_feed"],
  summary: "s",
  checklist: ["a", "b", "c"],
  suggest_lullaby: false,
  see_doctor: false,
};

test("accepts a well-formed analysis body", () => {
  assert.deepEqual(parseAnalysis(valid), valid);
});

test("accepts no_cry with empty top", () => {
  assert.ok(parseAnalysis({ ...valid, case: "no_cry", top: [], ask: [] }));
});

test("rejects unknown case, bad ask key and wrong types", () => {
  assert.equal(parseAnalysis({ ...valid, case: "maybe" }), null);
  assert.equal(parseAnalysis({ ...valid, ask: ["last_nap"] }), null);
  assert.equal(parseAnalysis({ ...valid, top: [{ label: "x" }] }), null);
  assert.equal(
    parseAnalysis({ ...valid, top: [{ label: "belly_pain", prob: 0.5 }] }),
    null,
  );
  assert.equal(parseAnalysis({ ...valid, see_doctor: "no" }), null);
  assert.equal(parseAnalysis(null), null);
  assert.equal(parseAnalysis("x"), null);
});
