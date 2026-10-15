"use client";
import { Button } from "@/components/button";
import { copy } from "@/content";
import { useState } from "react";
import { currentTime, dateKey } from "@/lib/date";
import { activityKinds, activityLabel } from "./options";
import type { Activity } from "./storage";
export function ActivityForm({
  onSave,
  onCancel,
  date,
  initialActivity = "sleepy",
  initialNote = "",
}: {
  onSave: (item: Activity) => void;
  onCancel: () => void;
  date: string;
  initialActivity?: string;
  initialNote?: string;
}) {
  const [time] = useState(currentTime);
  // Same real clock as buildContext: never default or allow entries after today.
  const today = dateKey();
  return (
    <>
      <header className="top">
        <button onClick={onCancel} aria-label={copy.back}>
          ‹
        </button>
        <b>{copy.saveActivity}</b>
      </header>
      <section className="content">
        <form
          id="activity-form"
          className="activity-form"
          onSubmit={(event) => {
            event.preventDefault();
            const f = new FormData(event.currentTarget);
            onSave({
              id: crypto.randomUUID(),
              activity: String(f.get("activity")),
              date: String(f.get("date")),
              from: String(f.get("from")),
              to: String(f.get("to")),
              note: String(f.get("note")).trim(),
            });
          }}
        >
          <label>
            {copy.activities}
            <select
              name="activity"
              defaultValue={
                activityKinds.includes(
                  initialActivity as (typeof activityKinds)[number],
                )
                  ? initialActivity
                  : "sleepy"
              }
            >
              {activityKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {activityLabel(kind)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {copy.date}
            <input
              max={today}
              type="date"
              name="date"
              defaultValue={date && date <= today ? date : today}
              required
            />
          </label>
          <div className="time-fields">
            <label>
              {copy.startTime}
              <input name="from" type="time" defaultValue={time} required />
            </label>
            <label>
              {copy.endTime}
              <input name="to" type="time" defaultValue={time} required />
            </label>
          </div>
          <label>
            {copy.notes}
            <textarea
              name="note"
              rows={3}
              defaultValue={initialNote}
              placeholder={copy.notesPlaceholder}
            />
          </label>
        </form>
      </section>
      <footer className="footer">
        <Button variant="primary" type="submit" form="activity-form">
          {copy.save}
        </Button>
      </footer>
    </>
  );
}
