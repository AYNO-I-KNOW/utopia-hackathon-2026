"use client";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { growthCopy as text } from "@/content/development";
import { dateKey } from "@/lib/date";
import {
  metrics,
  metricIds,
  isMetric,
  type GrowthEntry,
  type MetricId,
} from "./data";
export function GrowthForm({
  initial,
  onSave,
  onClose,
}: {
  initial: MetricId;
  onSave: (entry: GrowthEntry) => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState(initial);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="growth-overlay"
      aria-labelledby="growth-form-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <section className="growth-dialog">
        <h2 id="growth-form-title">{text.add}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            onSave({
              id: crypto.randomUUID(),
              metric: kind,
              value: Number(data.get("value")),
              date: String(data.get("date")),
            });
          }}
          className="activity-form"
        >
          <label>
            {text.metric}
            <div className="lucide-select">
              <ChevronDown size={18} aria-hidden="true" />
              <select
                value={kind}
                onChange={(e) => {
                  if (isMetric(e.target.value)) setKind(e.target.value);
                }}
                autoFocus
              >
                {metricIds.map((id) => (
                  <option value={id} key={id}>
                    {metrics[id].label}
                  </option>
                ))}
              </select>
            </div>
          </label>
          <label>
            {text.value} ({metrics[kind].unit})
            <input
              name="value"
              type="number"
              min="0.01"
              max="1000"
              step="0.01"
              required
            />
          </label>
          <label>
            {text.date}
            <input
              name="date"
              type="date"
              defaultValue={dateKey()}
              max={dateKey()}
              required
            />
          </label>
          <div className="growth-form-actions">
            <button type="button" onClick={onClose}>
              {text.cancel}
            </button>
            <button className="primary" type="submit">
              {text.save}
            </button>
          </div>
        </form>
      </section>
    </dialog>
  );
}
