import { test } from "node:test";
import assert from "node:assert/strict";
import { AUDIO_ACCEPT, isSupportedAudio } from "./audio-types.ts";

test("accepts supported extension even with empty MIME type", () => {
  assert.equal(isSupportedAudio({ name: "Cry.M4A", type: "" }), true);
});

test("accepts supported MIME type with codec suffix and odd name", () => {
  assert.equal(
    isSupportedAudio({ name: "recording", type: "audio/webm;codecs=opus" }),
    true,
  );
});

test("rejects flac, caf and non-audio files", () => {
  assert.equal(isSupportedAudio({ name: "a.flac", type: "audio/flac" }), false);
  assert.equal(isSupportedAudio({ name: "a.caf", type: "audio/x-caf" }), false);
  assert.equal(
    isSupportedAudio({ name: "a.pdf", type: "application/pdf" }),
    false,
  );
});

test("accepts m4a MIME types", () => {
  assert.equal(isSupportedAudio({ name: "a", type: "audio/x-m4a" }), true);
});

test("accepts audio/mp4 with empty extension", () => {
  assert.equal(isSupportedAudio({ name: "voice", type: "audio/mp4" }), true);
});

test("accepts uppercase .MOV and .M4A", () => {
  assert.equal(isSupportedAudio({ name: "CLIP.MOV", type: "" }), true);
  assert.equal(isSupportedAudio({ name: "CLIP.M4A", type: "" }), true);
});

test("accepts video/quicktime", () => {
  assert.equal(
    isSupportedAudio({ name: "clip", type: "video/quicktime" }),
    true,
  );
});

test("accept string lists both extensions and MIME types", () => {
  assert.match(AUDIO_ACCEPT, /audio\/mpeg/);
  assert.match(AUDIO_ACCEPT, /\.opus/);
});
