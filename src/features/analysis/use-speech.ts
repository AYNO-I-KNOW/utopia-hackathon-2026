"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { activeLocale, copy } from "@/content";
import { ApiError, isAbort, speak } from "./api";

type Status = "idle" | "loading" | "playing" | "hidden";

const FFT_SIZE = 1024;

/**
 * iOS/iPadOS mute Web Audio output with the silent switch but not a plain <audio>
 * element, so demo phones must skip the analyser and use the CSS-animated wave.
 */
function isIos() {
  const { userAgent, maxTouchPoints } = navigator;
  return (
    /iPad|iPhone|iPod/.test(userAgent) ||
    (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
  );
}

/** Must run in the tap gesture (Safari); null means no live levels, plain playback. */
function openContext() {
  if (isIos()) return null;
  try {
    const context = new AudioContext();
    return { context, ready: context.resume().catch(() => undefined) };
  } catch {
    return null;
  }
}

/** Fetch TTS for `text` and play it; `hidden` once the backend has no voice (503). */
export function useSpeech(text: string) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = useRef("");
  const controller = useRef<AbortController | null>(null);
  const context = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const source = useRef<MediaElementAudioSourceNode | null>(null);
  const releaseAudio = useCallback(() => {
    audio.current?.pause();
    audio.current = null;
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = "";
    source.current?.disconnect();
    analyser.current?.disconnect();
    source.current = null;
    analyser.current = null;
  }, []);
  const closeAll = useCallback(() => {
    releaseAudio();
    const open = context.current;
    context.current = null;
    if (open && open.state !== "closed")
      void open.close().catch(() => undefined);
  }, [releaseAudio]);
  const release = useCallback(() => {
    controller.current?.abort();
    closeAll();
  }, [closeAll]);
  /** Fill `out` (length >= FFT_SIZE / 2) with frequency bytes; returns the sample rate, 0 without a live analyser. */
  const readLevels = useCallback((out: Uint8Array<ArrayBuffer>) => {
    if (!analyser.current) return 0;
    analyser.current.getByteFrequencyData(out);
    return analyser.current.context.sampleRate;
  }, []);
  useEffect(() => release, [release]);
  async function toggle() {
    if (status === "loading" || status === "playing") {
      release();
      setStatus("idle");
      return;
    }
    setError("");
    setStatus("loading");
    closeAll();
    const opened = openContext();
    context.current = opened?.context ?? null;
    const ctl = new AbortController();
    controller.current = ctl;
    try {
      const blob = await speak(text, activeLocale, ctl.signal);
      if (ctl.signal.aborted) return;
      releaseAudio();
      url.current = URL.createObjectURL(blob);
      const element = new Audio(url.current);
      element.onended = () => {
        if (audio.current !== element) return;
        closeAll();
        setStatus("idle");
      };
      element.onerror = () => {
        if (audio.current !== element) return;
        closeAll();
        setError(copy.errSpeak);
        setStatus("idle");
      };
      audio.current = element;
      await opened?.ready;
      if (ctl.signal.aborted) return;
      const live = context.current;
      if (live?.state === "running") {
        // Node creation can throw; the element then plays through its normal output.
        try {
          const node = live.createAnalyser();
          node.fftSize = FFT_SIZE;
          node.connect(live.destination);
          source.current = live.createMediaElementSource(element);
          source.current.connect(node);
          analyser.current = node;
        } catch {
          source.current?.disconnect();
          // Once captured by createMediaElementSource the element is silent unless routed out.
          try {
            source.current?.connect(live.destination);
          } catch {}
          analyser.current = null;
        }
      }
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
  return { status, error, toggle, readLevels };
}
