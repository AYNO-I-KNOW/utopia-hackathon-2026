"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

/** Retain the outgoing day's snapshot until its directional transition ends. */
export function DateTransition({
  date,
  children,
}: {
  date: string;
  children: ReactNode;
}) {
  const [view, setView] = useState({
    date,
    content: children,
    previous: null as ReactNode,
    direction: 1,
  });
  if (view.date !== date) {
    setView({
      date,
      content: children,
      previous: view.content,
      direction: date > view.date ? 1 : -1,
    });
  }
  if (view.date === date && view.content !== children) {
    setView({ ...view, content: children });
  }
  return (
    <div
      className="activity-day-transition"
      style={{ "--day-direction": view.direction } as CSSProperties}
    >
      {view.previous && (
        <div className="activity-day-out" aria-hidden="true" inert>
          {view.previous}
        </div>
      )}
      <div
        key={date}
        className={view.previous ? "activity-day-in" : ""}
        onAnimationEnd={() =>
          setView((current) => ({ ...current, previous: null }))
        }
      >
        {children}
      </div>
    </div>
  );
}
