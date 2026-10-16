"use client";
import { Play, Square } from "lucide-react";
import { copy } from "@/content";
import type { LullabyTrack } from "./lullaby";
import { useLullaby } from "./use-lullaby";

const TRACK_NAME: Record<LullabyTrack, string> = {
  "music-box": copy.lullabyMusicBox,
  "warm-rocking": copy.lullabyWarmRocking,
};

export function LullabyPlayer({ track }: { track: LullabyTrack }) {
  const { playing, error, toggle } = useLullaby(track);
  const Icon = playing ? Square : Play;
  return (
    <>
      <div className="result-lullaby-player">
        <button
          className="result-listen"
          onClick={toggle}
          aria-label={copy.lullabyPlay}
          aria-pressed={playing}
        >
          <span className="result-listen-label" aria-hidden="true">
            <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
            {playing ? copy.lullabyStop : copy.lullabyPlayShort}
          </span>
        </button>
        <small>{TRACK_NAME[track]}</small>
      </div>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
