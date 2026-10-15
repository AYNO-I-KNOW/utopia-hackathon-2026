"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { copy } from "@/content";
import { growthCopy } from "@/content/development";
import { dateKey } from "@/lib/date";
import "./sheet.css";

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
  const sheet = useRef<HTMLElement>(null);
  const activeDay = useRef<HTMLButtonElement>(null);
  const today = dateKey();
  const selected = date || today;
  const anchor = new Date(selected + "T12:00:00+07:00");
  // Keep the rail stable while selecting nearby days so it does not jump.
  const [railDate, setRailDate] = useState(selected);
  const railAnchor = new Date(railDate + "T12:00:00+07:00");
  useEffect(() => {
    activeDay.current?.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }, [selected, railDate]);
  function finishDrag() {
    if (origin.current === null) return;
    const parentHeight = sheet.current?.parentElement?.clientHeight || 1;
    suppressClick.current = Math.abs(drag) > 4;
    const target = snap - (drag / parentHeight) * 100;
    setSnap(
      snaps.reduce<number>(
        (best, point) =>
          Math.abs(point - target) < Math.abs(best - target) ? point : best,
        60,
      ),
    );
    origin.current = null;
    setDrag(0);
  }
  return (
    <section
      ref={sheet}
      className="activity-sheet"
      aria-label={growthCopy.daily}
      data-dragging={origin.current !== null}
      style={{ height: `calc(${snap}% - ${drag}px)` }}
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
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (origin.current !== null) {
            const delta = event.clientY - origin.current;
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
          <span>
            {anchor.toLocaleDateString("th-TH", {
              month: "long",
              year: "numeric",
            })}
          </span>
          <input
            type="date"
            aria-label={growthCopy.date}
            value={selected}
            onChange={(event) => {
              if (event.target.value) {
                onDate(event.target.value);
                setRailDate(event.target.value);
              }
            }}
          />
        </label>
        <button
          className="activity-sheet-today"
          onClick={() => {
            onDate(today);
            setRailDate(today);
          }}
        >
          {growthCopy.today}
        </button>
      </div>
      <div className="activity-date-rail" aria-label={growthCopy.chooseDate}>
        {Array.from({ length: 61 }, (_, index) => {
          const day = new Date(railAnchor);
          day.setDate(day.getDate() + index - 30);
          const key = dateKey(day);
          return (
            <button
              key={key}
              ref={key === selected ? activeDay : undefined}
              aria-pressed={key === selected}
              aria-label={day.toLocaleDateString("th-TH", {
                dateStyle: "full",
              })}
              onClick={() => onDate(key)}
            >
              <small>{growthCopy.days[day.getDay()]}</small>
              <b>{day.getDate()}</b>
            </button>
          );
        })}
      </div>
      <div className="activities-heading">
        <h2>{growthCopy.daily}</h2>
        <button aria-label={copy.addActivity} onClick={onAdd}>
          +
        </button>
      </div>
      <div className="activity-sheet-scroll">{children}</div>
    </section>
  );
}
