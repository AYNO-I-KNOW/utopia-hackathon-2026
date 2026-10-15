"use client";
import { Button } from "@/components/button";
import { copy } from "@/content";
import { X, ChevronDown, CalendarDays, Clock3 } from "lucide-react";
import { ActivityIcon } from "./activity-icon";
import "./activity-form.css";
import { useEffect, useRef, useState } from "react";
import { currentTime, dateKey } from "@/lib/date";
import { activityKinds, activityLabel } from "./options";
import type { Activity } from "./storage";
export function ActivityForm({
  onSave,
  onCancel,
  date,
  initialActivity = "sleepy",
  initialNote = "",
  error = "",
}: {
  onSave: (item: Activity) => void;
  onCancel: () => void;
  date: string;
  initialActivity?: string;
  initialNote?: string;
  error?: string;
}) {
  const modal = useRef<HTMLDialogElement>(null);
  const outside = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    modal.current?.showModal();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  function close() {
    if (closing) return;
    setClosing(true);
    timer.current = setTimeout(
      () => {
        modal.current?.close();
        onCancel();
      },
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 240,
    );
  }
  const [time] = useState(currentTime);
  // Real clock, same as buildContext: entries after today would be invisible to the analysis.
  const today = dateKey();
  const [kind, setKind] = useState(
    activityKinds.includes(initialActivity as (typeof activityKinds)[number])
      ? initialActivity
      : "sleepy",
  );
  const picker = useRef<HTMLDetailsElement>(null);
  return (
    <dialog
      onPointerDown={(event) => {
        outside.current = event.target === event.currentTarget;
      }}
      onPointerUp={(event) => {
        // Pointer capture can retarget pointerup, so check what is under the pointer.
        const released =
          document.elementFromPoint(event.clientX, event.clientY) ===
          event.currentTarget;
        if (outside.current && released) close();
        outside.current = false;
      }}
      ref={modal}
      className="activity-modal"
      data-closing={closing}
      aria-labelledby="activity-editor-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div className="activity-editor">
        <header className="activity-editor-header">
          <button onClick={close} aria-label={copy.cancel}>
            <X size={20} strokeWidth={1.75} />
          </button>
          <h1 id="activity-editor-title">{copy.saveActivity}</h1>
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
            <div className="activity-picker-field">
              <span id="activity-label">{copy.activities}</span>
              <input type="hidden" name="activity" value={kind} />
              <details
                ref={picker}
                className="activity-picker"
                onKeyDown={(event) => {
                  if (event.key === "Escape" && picker.current?.open) {
                    // Close only the picker, not the whole dialog.
                    event.preventDefault();
                    event.stopPropagation();
                    picker.current.open = false;
                    picker.current.querySelector("summary")?.focus();
                  }
                }}
              >
                <summary aria-labelledby="activity-label activity-selected">
                  <ActivityIcon kind={kind} />
                  <span id="activity-selected">{activityLabel(kind)}</span>
                  <ChevronDown size={20} strokeWidth={1.75} />
                </summary>
                <div
                  className="activity-picker-options"
                  role="group"
                  aria-label={copy.activities}
                >
                  {activityKinds.map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-label={activityLabel(value)}
                      aria-pressed={kind === value}
                      onClick={() => {
                        setKind(value);
                        if (picker.current) {
                          picker.current.open = false;
                          picker.current.querySelector("summary")?.focus();
                        }
                      }}
                    >
                      <ActivityIcon kind={value} />
                      <span>{activityLabel(value)}</span>
                    </button>
                  ))}
                </div>
              </details>
            </div>
            <label>
              {copy.date}
              <span className="editor-input-icon">
                <CalendarDays size={19} aria-hidden="true" />
                <input
                  max={today}
                  type="date"
                  name="date"
                  defaultValue={date && date <= today ? date : today}
                  required
                />
              </span>
            </label>
            <div className="time-fields">
              <label>
                {copy.startTime}
                <span className="editor-input-icon">
                  <Clock3 size={19} aria-hidden="true" />
                  <input name="from" type="time" defaultValue={time} required />
                </span>
              </label>
              <label>
                {copy.endTime}
                <span className="editor-input-icon">
                  <Clock3 size={19} aria-hidden="true" />
                  <input name="to" type="time" defaultValue={time} required />
                </span>
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
        {error && (
          <p role="alert" className="activity-editor-error">
            {error}
          </p>
        )}
        <footer className="footer">
          <Button variant="primary" type="submit" form="activity-form">
            {copy.save}
          </Button>
        </footer>
      </div>
    </dialog>
  );
}
