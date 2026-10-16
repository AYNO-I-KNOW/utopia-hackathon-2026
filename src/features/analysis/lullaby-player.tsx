"use client";
import { Play } from "lucide-react";
import { copy } from "@/content";
import type { LullabyTrack } from "./lullaby";
import { ListenWave } from "./listen-wave";
import { useLullaby } from "./use-lullaby";

const TRACK_NAME: Record<LullabyTrack, string> = {
  "music-box": copy.lullabyMusicBox,
  "warm-rocking": copy.lullabyWarmRocking,
};

// Not routed through Web Audio: 0 keeps the wave on its CSS animation.
const noLevels = () => 0;

export function LullabyPlayer({ track }: { track: LullabyTrack }) {
  const { playing, error, toggle } = useLullaby(track);
  return (
    <article className="result-lullaby">
      <button
        className="result-lullaby-toggle"
        onClick={toggle}
        aria-label={copy.lullabyPlay}
        aria-pressed={playing}
      >
        {playing ? (
          <ListenWave readLevels={noLevels} />
        ) : (
          <Play size={20} strokeWidth={1.75} aria-hidden="true" />
        )}
      </button>
      <div>
        <h2>{copy.lullabyTitle}</h2>
        <p>{copy.lullabyText}</p>
        <small>{TRACK_NAME[track]}</small>
        {error && <p role="alert">{error}</p>}
      </div>
    </article>
  );
}
