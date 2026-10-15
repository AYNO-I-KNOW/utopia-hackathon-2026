"use client";
import { Button } from "@/components/button";
import { copy } from "@/content";
import { useState } from "react";
import { DEMO_CURRENT_DATE } from "./demo";
import { currentTime, dateKey } from "@/lib/date";
import { activityKinds, activityLabel } from "./options";
import type { Activity } from "./storage";
export function ActivityForm({
  onSave,
  onCancel,
  date,
  initialActivity = "sleepy",
}: {
  onSave: (item: Activity) => void;
  onCancel: () => void;
  date: string;
  initialActivity?: string;
}) {
  const [time] = useState(currentTime);
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
              max={DEMO_CURRENT_DATE}
              type="date"
              name="date"
              defaultValue={date || dateKey()}
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
