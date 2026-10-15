"use client";

import { useEffect, useRef, useState } from "react";
import "./crying-baby.css";

/** Deform the selected artwork continuously; no reconstructed anatomy or cutout seams. */
export function CryingBaby({
  className = "",
  alt = "",
}: {
  className?: string;
  alt?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const target = canvas.current;
    const context = target?.getContext("2d");
    if (!target || !context) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const image = new Image();
    let frame = 0;
    let disposed = false;
    let visible = true;
    let previous = 0;
    const width = 656,
      height = 600;
    target.width = width;
    target.height = height;
    // Smooth spatial envelopes keep the feet fixed and avoid boundaries between parts.
    const bump = (y: number, center: number, radius: number) =>
      Math.exp(-Math.pow((y - center) / radius, 4));
    const pulse = (phase: number, center: number, spread: number) =>
      Math.exp(-Math.pow((phase - center) / spread, 2));
    const draw = (time: number) => {
      if (disposed || reduced.matches) return;
      frame = requestAnimationFrame(draw);
      if (!visible || document.hidden || time - previous < 33) return;
      previous = time;
      const phase = (time % 3600) / 3600;
      const inhale = Math.sin(phase * Math.PI * 2);
      const sob = pulse(phase, 0.22, 0.038) + 0.65 * pulse(phase, 0.36, 0.032);
      context.clearRect(0, 0, width, height);
      const offset = (y: number) =>
        (-1.4 * inhale + 2.1 * sob) * bump(y, 230, 200) +
        (-1.1 * inhale + sob) * bump(y, 390, 85);
      for (let y = 0; y < height; y++) {
        const chest = bump(y, 400, 90);
        const head = bump(y, 220, 180);
        const scale = 1 + chest * (0.004 * inhale - 0.002 * sob);
        const dx = head * (0.45 * inhale + 0.35 * sob);
        const top = y + offset(y);
        const bottom = y + 1 + offset(y + 1);
        context.drawImage(
          image,
          0,
          (y * image.naturalHeight) / height,
          image.naturalWidth,
          image.naturalHeight / height,
          (width - width * scale) / 2 + dx,
          top,
          width * scale,
          bottom - top + 0.2,
        );
      }
      setReady(true);
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      setReady(false);
      if (!reduced.matches && image.complete && image.naturalWidth)
        frame = requestAnimationFrame(draw);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    observer.observe(target);
    reduced.addEventListener("change", sync);
    image.onload = sync;
    image.src = "/images/analysis/chosen-baby.png";
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      reduced.removeEventListener("change", sync);
      image.onload = null;
    };
  }, []);
  return (
    <span
      className={`crying-baby ${className}`}
      data-animated={ready}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
    >
      <img src="/images/analysis/chosen-baby.png" alt="" />
      <canvas ref={canvas} aria-hidden="true" />
    </span>
  );
}
