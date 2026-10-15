import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseAnalysis,
  parseChatReply,
  trimChatMessages,
  type ChatMessage,
} from "./parse.ts";

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

test("accepts a well-formed chat reply", () => {
  const reply = { reply: "ลองเปลี่ยนผ้าอ้อมนะคะ", source: "template" };
  assert.deepEqual(parseChatReply(reply), reply);
  assert.ok(parseChatReply({ reply: "x", source: "llm" }));
});

test("rejects empty, oversize, unknown-source and non-object chat bodies", () => {
  assert.equal(parseChatReply({ reply: "  ", source: "llm" }), null);
  assert.equal(parseChatReply({ reply: "a".repeat(601), source: "llm" }), null);
  assert.equal(parseChatReply({ reply: "x", source: "gpt" }), null);
  assert.equal(parseChatReply({ reply: 1, source: "llm" }), null);
  assert.equal(parseChatReply(null), null);
});

test("trims chat history to 8 messages and 4000 characters, keeping the newest", () => {
  const many: ChatMessage[] = Array.from({ length: 12 }, (_, i) => ({
    role: i % 2 ? "assistant" : "user",
    content: String(i),
  }));
  const trimmed = trimChatMessages(many);
  assert.equal(trimmed.length, 8);
  assert.equal(trimmed.at(-1)?.content, "11");

  const long: ChatMessage[] = [
    { role: "assistant", content: "a".repeat(600) },
    { role: "user", content: "b".repeat(1000) },
    { role: "assistant", content: "c".repeat(600) },
    { role: "user", content: "d".repeat(1000) },
    { role: "assistant", content: "e".repeat(600) },
    { role: "user", content: "f".repeat(1000) },
  ];
  const fit = trimChatMessages(long);
  assert.ok(fit.reduce((sum, m) => sum + m.content.length, 0) <= 4000);
  assert.equal(fit.at(-1)?.content[0], "f");
  assert.equal(trimChatMessages(long.slice(-1)).length, 1);
});
