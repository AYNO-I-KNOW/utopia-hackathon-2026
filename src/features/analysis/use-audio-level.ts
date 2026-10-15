"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createRecorder, type Recorder } from "./recorder";

/** Draw live volume outside React; sample history scrolls at a continuous speed. */
export function useAudioLevel(enabled: boolean, paused = false) {
  const pausedRef = useRef(paused);
  const recorderRef = useRef<Recorder | null>(null);
  useEffect(() => {
    pausedRef.current = paused;
    if (paused) recorderRef.current?.pause();
    else recorderRef.current?.resume();
  }, [paused]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);
  // True once MediaRecorder has actually started; the recording clock keys off this.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let disposed = false,
      stream: MediaStream | undefined,
      context: AudioContext | undefined,
      frame = 0;
    setError(false);
    setReady(false);
    async function connect() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (disposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        recorderRef.current = createRecorder(stream);
        if (pausedRef.current) recorderRef.current.pause();
        setReady(true);
      } catch {
        stream?.getTracks().forEach((track) => track.stop());
        if (!disposed) setError(true);
        return;
      }
      // The waveform is optional: if AudioContext fails (e.g. Safari resume()), keep recording.
      try {
        context = new AudioContext();
        await context.resume();
        if (disposed) return;
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        context.createMediaStreamSource(stream).connect(analyser);
        const data = new Float32Array(analyser.fftSize);
        const history = Array<number>(160).fill(0);
        let lastTime = 0,
          accumulated = 0,
          level = 0;
        const samplePeriod = 90;
        const reducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        function draw(time: number) {
          if (disposed) return;
          stream?.getAudioTracks().forEach((track) => {
            track.enabled = !pausedRef.current;
          });
          if (pausedRef.current) {
            lastTime = 0;
            frame = requestAnimationFrame(draw);
            return;
          }
          const dt = lastTime ? Math.min(time - lastTime, 100) : 16;
          lastTime = time;
          analyser.getFloatTimeDomainData(data);
          const rms = Math.sqrt(
            data.reduce((sum, value) => sum + value * value, 0) / data.length,
          );
          const target = Math.min(1, Math.max(0, (rms - 0.004) * 9));
          // Fast attack, slower release: keep actual speech changes without jitter.
          level +=
            (target - level) *
            (1 - Math.exp(-dt / (target > level ? 65 : 190)));
          accumulated += dt;
          while (accumulated >= samplePeriod) {
            history.shift();
            history.push(level);
            accumulated -= samplePeriod;
          }
          const canvas = canvasRef.current,
            paint = canvas?.getContext("2d");
          if (canvas && paint) {
            const width = canvas.clientWidth,
              height = canvas.clientHeight,
              dpr = window.devicePixelRatio || 1;
            if (
              canvas.width !== Math.round(width * dpr) ||
              canvas.height !== Math.round(height * dpr)
            ) {
              canvas.width = Math.round(width * dpr);
              canvas.height = Math.round(height * dpr);
            }
            paint.setTransform(dpr, 0, 0, dpr, 0, 0);
            paint.clearRect(0, 0, width, height);
            paint.fillStyle = getComputedStyle(canvas).color;
            const pitch = 6,
              count = Math.ceil(width / pitch) + 2,
              offset = reducedMotion ? 0 : (accumulated / samplePeriod) * pitch;
            for (let i = 0; i < count; i++) {
              const amplitude = history[history.length - count + i] ?? 0;
              const barHeight = 4 + amplitude * 76;
              paint.globalAlpha = 0.35 + (0.65 * i) / count;
              paint.beginPath();
              const bar = [
                i * pitch - offset,
                (height - barHeight) / 2,
                4,
                barHeight,
              ] as const;
              if (typeof paint.roundRect === "function")
                paint.roundRect(...bar, 2);
              else paint.rect(...bar);
              paint.fill();
            }
            paint.globalAlpha = 1;
          }
          frame = requestAnimationFrame(draw);
        }
        frame = requestAnimationFrame(draw);
      } catch {
        // Waveform dropped; the recorder and stream stay alive.
      }
    }
    void connect();
    return () => {
      disposed = true;
      recorderRef.current?.dispose();
      recorderRef.current = null;
      setReady(false);
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      if (context && context.state !== "closed") void context.close();
    };
  }, [enabled]);
  const finish = useCallback(
    () => recorderRef.current?.finish() ?? Promise.resolve(null),
    [],
  );
  return { canvasRef, error, ready, finish };
}
