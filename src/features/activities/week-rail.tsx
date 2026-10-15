"use client";

import { useLayoutEffect, useRef } from "react";
import { DEMO_CURRENT_DATE } from "./demo";
import { dateKey } from "@/lib/date";
import { growthCopy } from "@/content/development";

const centerPage = 10;

export function WeekRail({
  anchor,
  selected,
  onSelect,
}: {
  anchor: string;
  selected: string;
  onSelect: (date: string) => void;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ x: number; page: number; moved: boolean } | null>(
    null,
  );
  const suppressClick = useRef(false);
  const start = new Date(anchor + "T12:00:00+07:00");
  start.setDate(start.getDate() - start.getDay());
  const chosen = new Date(selected + "T12:00:00+07:00");
  const chosenIndex = chosen.getDay();
  useLayoutEffect(() => {
    const element = rail.current;
    if (element) element.scrollLeft = element.clientWidth * centerPage;
  }, [anchor]);
  function finish(element: HTMLDivElement, clientX: number) {
    const drag = gesture.current;
    if (!drag) return;
    const distance = drag.x - clientX;
    const step =
      Math.abs(distance) >= element.clientWidth * 0.2 ? Math.sign(distance) : 0;
    delete element.dataset.dragging;
    element.scrollTo({
      left: (drag.page + step) * element.clientWidth,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
    gesture.current = null;
  }
  return (
    <div
      ref={rail}
      className="activity-week-rail"
      aria-label={growthCopy.chooseDate}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        suppressClick.current = false;
        gesture.current = {
          x: event.clientX,
          page: Math.round(
            event.currentTarget.scrollLeft / event.currentTarget.clientWidth,
          ),
          moved: false,
        };
      }}
      onPointerMove={(event) => {
        const drag = gesture.current;
        if (!drag) return;
        const distance = drag.x - event.clientX;
        if (!drag.moved && Math.abs(distance) < 5) return;
        drag.moved = true;
        suppressClick.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.dataset.dragging = "true";
        event.currentTarget.scrollLeft =
          drag.page * event.currentTarget.clientWidth + distance;
      }}
      onPointerUp={(event) => finish(event.currentTarget, event.clientX)}
      onPointerCancel={(event) => {
        if (gesture.current) finish(event.currentTarget, gesture.current.x);
      }}
      onClickCapture={(event) => {
        if (suppressClick.current) {
          event.preventDefault();
          event.stopPropagation();
          suppressClick.current = false;
        }
      }}
    >
      {Array.from({ length: centerPage * 2 + 1 }, (_, page) => (
        <div className="activity-week-page" key={page}>
          {(() => {
            const first = new Date(start);
            first.setDate(first.getDate() + (page - centerPage) * 7);
            const last = new Date(first);
            last.setDate(last.getDate() + 6);
            return selected >= dateKey(first) && selected <= dateKey(last) ? (
              <span
                className="activity-day-indicator"
                aria-hidden="true"
                style={{ transform: `translateX(${chosenIndex * 100}%)` }}
              />
            ) : null;
          })()}
          {Array.from({ length: 7 }, (_, index) => {
            const day = new Date(start);
            day.setDate(day.getDate() + (page - centerPage) * 7 + index);
            const key = dateKey(day);
            return (
              <button
                key={key}
                disabled={key > DEMO_CURRENT_DATE}
                aria-pressed={selected === key}
                aria-label={day.toLocaleDateString("en-GB", {
                  dateStyle: "full",
                })}
                onClick={() => onSelect(key)}
              >
                <small>{growthCopy.days[day.getDay()]}</small>
                <b>{day.getDate()}</b>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
