"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { copy } from "@/content";
import { claimPlayback, onOtherPlayback } from "./exclusive-playback";
import { LULLABY_SRC, type LullabyTrack } from "./lullaby";

const OWNER = "lullaby";
const FADE_IN_MS = 1000;
const FADE_OUT_MS = 600;
const FADE_STEP_MS = 50;

/** Looping lullaby with volume-ramped start/stop. */
export function useLullaby(track: LullabyTrack) {
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const audio = useRef<HTMLAudioElement | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const clearTimer = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);
  const fade = useCallback(
    (element: HTMLAudioElement, to: number, ms: number, done?: () => void) => {
      clearTimer();
      const step = (to - element.volume) / Math.max(1, ms / FADE_STEP_MS);
      timer.current = setInterval(() => {
        const next = element.volume + step;
        const reached = step >= 0 ? next >= to : next <= to;
        element.volume = reached ? to : next;
        if (!reached) return;
        clearTimer();
        done?.();
      }, FADE_STEP_MS);
    },
    [clearTimer],
  );
  const release = useCallback(() => {
    clearTimer();
    audio.current?.pause();
    audio.current = null;
  }, [clearTimer]);
  const stop = useCallback(() => {
    setPlaying(false);
    const element = audio.current;
    if (!element) return;
    fade(element, 0, FADE_OUT_MS, () => {
      if (audio.current === element) release();
    });
  }, [fade, release]);
  useEffect(() => release, [release]);
  useEffect(() => onOtherPlayback(OWNER, stop), [stop]);
  async function start() {
    setError("");
    claimPlayback(OWNER);
    const element = audio.current ?? new Audio(LULLABY_SRC[track]);
    if (!audio.current) {
      element.loop = true;
      element.volume = 0;
      element.onerror = () => {
        if (audio.current !== element) return;
        release();
        setError(copy.errLullaby);
        setPlaying(false);
      };
      audio.current = element;
    }
    setPlaying(true);
    try {
      await element.play();
      if (audio.current === element) fade(element, 1, FADE_IN_MS);
    } catch {
      if (audio.current !== element) return;
      release();
      setError(copy.errLullaby);
      setPlaying(false);
    }
  }
  return { playing, error, toggle: () => (playing ? stop() : void start()) };
}
