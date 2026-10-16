import type { AnalysisResult } from "./parse";

export type LullabyTrack = "music-box" | "warm-rocking";

export const LULLABY_SRC: Record<LullabyTrack, string> = {
  "music-box": "/audio/lullabies/music-box.mp3",
  "warm-rocking": "/audio/lullabies/warm-rocking.mp3",
};

/** One track per result: warm-rocking for sleepy/hug, music-box for everything else. */
export function pickLullaby(
  result: Pick<AnalysisResult, "case" | "top">,
): LullabyTrack {
  if (result.case === "unsure") return "music-box";
  const label = result.top[0]?.label;
  return label === "sleepy" || label === "hug" ? "warm-rocking" : "music-box";
}
