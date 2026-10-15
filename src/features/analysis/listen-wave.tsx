"use client";
import { useEffect, useRef } from "react";

const BARS = 9; // odd so one bar sits in the centre
const BANDS = (BARS + 1) / 2; // mirrored: band 0 (lowest) centre, highest at the edges
const MIN_HZ = 80;
const MAX_HZ = 4000;
const BIN_COUNT = 512; // analyser fftSize / 2
const FLOOR = 0.15;
const SIGNAL_THRESHOLD = 0.03;
const PEAK_MIN = 0.1;
const PEAK_DECAY = 0.995;
const ATTACK = 0.5;
const RELEASE = 0.12;
const WOBBLE = 0.08;

/** Log-spaced [from, to) bin ranges between MIN_HZ and MAX_HZ. */
function bandRanges(sampleRate: number) {
  const binHz = sampleRate / 2 / BIN_COUNT;
  const ratio = (MAX_HZ / MIN_HZ) ** (1 / BANDS);
  return Array.from({ length: BANDS }, (_, band) => {
    const from = Math.max(1, Math.floor((MIN_HZ * ratio ** band) / binHz));
    const to = Math.max(
      from + 1,
      Math.round((MIN_HZ * ratio ** (band + 1)) / binHz),
    );
    return [from, Math.min(to, BIN_COUNT)] as const;
  });
}

/** Bars driven by the analyser outside React; without one, CSS keyframes animate them. */
export function ListenWave({
  readLevels,
}: {
  readLevels: (out: Uint8Array<ArrayBuffer>) => number;
}) {
  const root = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const data = new Uint8Array(new ArrayBuffer(BIN_COUNT));
    const bars = Array.from(element.children) as HTMLElement[];
    const levels = Array<number>(BANDS).fill(0);
    const values = Array<number>(BARS).fill(FLOOR);
    let peak = PEAK_MIN,
      frame = 0;
    function draw(time: number, ranges: ReturnType<typeof bandRanges>) {
      if (readLevels(data)) {
        let loudest = 0;
        ranges.forEach(([from, to], band) => {
          let sum = 0;
          for (let bin = from; bin < to; bin++) sum += data[bin];
          levels[band] = sum / (to - from) / 255;
          loudest = Math.max(loudest, levels[band]);
        });
        // Auto-gain: slowly decaying peak so quiet audio still fills the height.
        peak = Math.max(PEAK_MIN, peak * PEAK_DECAY, loudest);
        const active = loudest > SIGNAL_THRESHOLD;
        bars.forEach((bar, index) => {
          const band = Math.abs(index - (BARS - 1) / 2);
          const level = active ? Math.min(1, levels[band] / peak) : 0;
          const wobble = active
            ? Math.sin(time / 110 + index * 1.7) * WOBBLE * level
            : 0;
          const target = Math.min(
            1,
            Math.max(FLOOR, FLOOR + (1 - FLOOR) * level + wobble),
          );
          values[index] +=
            (target - values[index]) *
            (target > values[index] ? ATTACK : RELEASE);
          bar.style.transform = `scaleY(${values[index].toFixed(3)})`;
        });
      }
      frame = requestAnimationFrame((next) => draw(next, ranges));
    }
    function start() {
      const sampleRate = reduced.matches ? 0 : readLevels(data);
      if (!sampleRate) return;
      element!.dataset.live = "";
      const ranges = bandRanges(sampleRate);
      frame = requestAnimationFrame((time) => draw(time, ranges));
    }
    function stop() {
      cancelAnimationFrame(frame);
      delete element!.dataset.live;
      bars.forEach((bar) => bar.style.removeProperty("transform"));
    }
    function onChange() {
      stop();
      start();
    }
    start();
    reduced.addEventListener("change", onChange);
    return () => {
      reduced.removeEventListener("change", onChange);
      stop();
    };
  }, [readLevels]);
  return (
    <span ref={root} className="listen-wave" aria-hidden="true">
      {Array.from({ length: BARS }, (_, index) => (
        <i key={index} />
      ))}
    </span>
  );
}
