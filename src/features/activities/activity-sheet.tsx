"use client";

import { Plus } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { copy } from "@/content";
import { growthCopy } from "@/content/development";
import { DEMO_CURRENT_DATE } from "./demo";
import "./sheet.css";
import { WeekRail } from "./week-rail";
import { DateTransition } from "./date-transition";

const snaps = [30, 65, 100] as const;

export function ActivitySheet({
  date,
  onDate,
  onAdd,
  children,
}: {
  date: string;
  onDate: (date: string) => void;
  onAdd: () => void;
  children: ReactNode;
}) {
  const [snap, setSnap] = useState<number>(65);
  const [drag, setDrag] = useState(0);
  const origin = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const dragDistance = useRef(0);
  const wheelLock = useRef(0);
  const sheet = useRef<HTMLElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = scrollArea.current;
    if (!element) return;
    let touch: { y: number; atTop: boolean; handled: boolean } | null = null;
    function wheel(event: WheelEvent) {
      if (Date.now() < wheelLock.current) {
        event.preventDefault();
        return;
      }
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      if (snap < 100 && event.deltaY > 6) {
        event.preventDefault();
        wheelLock.current = Date.now() + 450;
        setSnap(100);
      } else if (
        snap === 100 &&
        element!.scrollTop <= 0 &&
        event.deltaY < -12
      ) {
        event.preventDefault();
        wheelLock.current = Date.now() + 450;
        setSnap(65);
      }
    }
    function start(event: TouchEvent) {
      if (event.touches.length !== 1) return;
      touch = {
        y: event.touches[0].clientY,
        atTop: element!.scrollTop <= 0,
        handled: false,
      };
    }
    function move(event: TouchEvent) {
      if (!touch || event.touches.length !== 1) return;
      const distance = touch.y - event.touches[0].clientY;
      if (touch.handled) {
        event.preventDefault();
        return;
      }
      if (snap < 100 && distance > 12) {
        event.preventDefault();
        touch.handled = true;
        setSnap(100);
      } else if (snap === 100 && touch.atTop && distance < -60) {
        event.preventDefault();
        touch.handled = true;
        setSnap(65);
      }
    }
    function end() {
      touch = null;
    }
    element.addEventListener("wheel", wheel, { passive: false });
    element.addEventListener("touchstart", start, { passive: true });
    element.addEventListener("touchmove", move, { passive: false });
    element.addEventListener("touchend", end);
    element.addEventListener("touchcancel", end);
    return () => {
      element.removeEventListener("wheel", wheel);
      element.removeEventListener("touchstart", start);
      element.removeEventListener("touchmove", move);
      element.removeEventListener("touchend", end);
      element.removeEventListener("touchcancel", end);
    };
  }, [snap]);
  const today = DEMO_CURRENT_DATE;
  const selected = date || today;
  const anchor = new Date(selected + "T12:00:00+07:00");
  // Keep the rail stable while selecting nearby days so it does not jump.
  const [railDate, setRailDate] = useState(selected);
  function finishDrag() {
    if (origin.current === null) return;
    const distance = dragDistance.current;
    suppressClick.current = Math.abs(distance) > 4;
    if (distance > 32)
      setSnap([...snaps].reverse().find((point) => point < snap) ?? 30);
    else if (distance < -32)
      setSnap(snaps.find((point) => point > snap) ?? 100);
    dragDistance.current = 0;
    origin.current = null;
    setDrag(0);
  }
  const parentHeight = sheet.current?.parentElement?.clientHeight ?? 720;
  const topGap = ((100 - snap) / 100) * parentHeight + drag;
  const cornerRadius = Math.min(32, Math.max(0, topGap / 3));
  return (
    <section
      ref={sheet}
      className="activity-sheet"
      aria-label={growthCopy.daily}
      data-dragging={origin.current !== null}
      style={{
        height: `calc(${snap}% - ${drag}px)`,
        borderTopLeftRadius: cornerRadius,
        borderTopRightRadius: cornerRadius,
      }}
    >
      <button
        className="activity-sheet-handle"
        aria-label={growthCopy.resizeSheet}
        aria-expanded={snap === 100}
        onClick={() => {
          if (!suppressClick.current) setSnap(snap === 100 ? 65 : 100);
          suppressClick.current = false;
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setSnap(snaps.find((point) => point > snap) ?? 100);
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setSnap([...snaps].reverse().find((point) => point < snap) ?? 30);
          }
        }}
        onPointerDown={(event) => {
          origin.current = event.clientY;
          dragDistance.current = 0;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (origin.current !== null) {
            const delta = event.clientY - origin.current;
            dragDistance.current = delta;
            setDrag(delta);
          }
        }}
        onPointerUp={finishDrag}
        onPointerCancel={() => {
          origin.current = null;
          setDrag(0);
        }}
      >
        <span />
      </button>
      <div className="activity-sheet-date-heading">
        <label className="activity-sheet-calendar">
          <h2>
            {anchor.toLocaleDateString("en-GB", { month: "long" })}{" "}
            {anchor.getFullYear()}
          </h2>
          <input
            max={DEMO_CURRENT_DATE}
            type="date"
            aria-label={growthCopy.date}
            value={selected}
            onChange={(event) => {
              if (
                event.target.value &&
                event.target.value <= DEMO_CURRENT_DATE
              ) {
                onDate(event.target.value);
                setRailDate(event.target.value);
              }
            }}
          />
        </label>
        {selected !== today && (
          <button
            className="activity-sheet-today"
            onClick={() => {
              onDate(today);
              setRailDate(today);
            }}
          >
            {growthCopy.today}
          </button>
        )}
        <button
          className="activity-sheet-add"
          aria-label={copy.addActivity}
          onClick={onAdd}
        >
          <Plus size={18} strokeWidth={1.75} aria-hidden="true" />{" "}
          {growthCopy.addShort}
        </button>
      </div>
      <WeekRail anchor={railDate} selected={selected} onSelect={onDate} />
      <div ref={scrollArea} className="activity-sheet-scroll">
        <DateTransition date={selected}>{children}</DateTransition>
      </div>
    </section>
  );
}
