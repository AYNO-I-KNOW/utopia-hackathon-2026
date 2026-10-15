"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { copy } from "@/content";
import { ApiError, isAbort, speak } from "./api";

type Status = "idle" | "loading" | "playing" | "hidden";

/** Fetch TTS for `text` and play it; `hidden` once the backend has no voice (503). */
export function useSpeech(text: string) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = useRef("");
  const controller = useRef<AbortController | null>(null);
  const releaseAudio = useCallback(() => {
    audio.current?.pause();
    audio.current = null;
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = "";
  }, []);
  const release = useCallback(() => {
    controller.current?.abort();
    releaseAudio();
  }, [releaseAudio]);
  useEffect(() => release, [release]);
  async function toggle() {
    if (status === "loading" || status === "playing") {
      release();
      setStatus("idle");
      return;
    }
    setError("");
    setStatus("loading");
    const ctl = new AbortController();
    controller.current = ctl;
    try {
      const blob = await speak(text, "th", ctl.signal);
      if (ctl.signal.aborted) return;
      releaseAudio();
      url.current = URL.createObjectURL(blob);
      const element = new Audio(url.current);
      element.onended = () => {
        if (audio.current !== element) return;
        releaseAudio();
        setStatus("idle");
      };
      audio.current = element;
      await element.play();
      setStatus("playing");
    } catch (failure) {
      if (isAbort(failure)) return;
      release();
      if (failure instanceof ApiError && failure.kind === "unavailable")
        setStatus("hidden");
      else {
        setError(copy.errSpeak);
        setStatus("idle");
      }
    }
  }
  return { status, error, toggle };
}
