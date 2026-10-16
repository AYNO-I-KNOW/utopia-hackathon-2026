import { test } from "node:test";
import assert from "node:assert/strict";
import { pickLullaby } from "./lullaby.ts";

const top = (label: "sleepy" | "hug" | "awake" | "hungry") => [
  { label, prob: 0.6 },
];

test("sleepy and hug get warm-rocking", () => {
  assert.equal(
    pickLullaby({ case: "confident", top: top("sleepy") }),
    "warm-rocking",
  );
  assert.equal(pickLullaby({ case: "close", top: top("hug") }), "warm-rocking");
});

test("awake gets music-box", () => {
  assert.equal(
    pickLullaby({ case: "confident", top: top("awake") }),
    "music-box",
  );
});

test("unsure gets music-box even when the top label is sleepy", () => {
  assert.equal(
    pickLullaby({ case: "unsure", top: top("sleepy") }),
    "music-box",
  );
});

test("falls back to music-box without a top label", () => {
  assert.equal(pickLullaby({ case: "close", top: [] }), "music-box");
});
