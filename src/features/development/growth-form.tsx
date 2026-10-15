"use client";
import { CalendarDays, ChevronDown, Minus, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { growthCopy as text } from "@/content/development";
import { dateKey } from "@/lib/date";
import { MetricIcon } from "./metric-icon";
import "@/features/activities/activity-form.css";
import { metrics, metricIds, type GrowthEntry, type MetricId } from "./data";
export function GrowthForm({
  initial,
  entries,
  onSave,
  onClose,
}: {
  initial: MetricId;
  entries: GrowthEntry[];
  onSave: (entry: GrowthEntry) => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState(initial);
  const [values, setValues] = useState<Record<MetricId, string>>(
    () =>
      Object.fromEntries(
        metricIds.map((id) => {
          const latest = entries
            .filter((entry) => entry.metric === id)
            .reverse()
            .sort((a, b) => b.date.localeCompare(a.date))[0];
          return [id, String(latest?.value ?? metrics[id].value)];
        }),
      ) as Record<MetricId, string>,
  );
  const step = kind === "feeding" ? 1 : kind === "sleep" ? 0.5 : 0.1;
  function adjust(direction: number) {
    const value = Number(values[kind]);
    const next = Math.min(
      1000,
      Math.max(
        step,
        Math.round(
          ((Number.isFinite(value) ? value : 0) + direction * step) * 100,
        ) / 100,
      ),
    );
    setValues((previous) => ({ ...previous, [kind]: String(next) }));
  }
  const [closing, setClosing] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const picker = useRef<HTMLDetailsElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outside = useRef(false);
  useEffect(() => {
    dialog.current?.showModal();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  function close() {
    if (closing) return;
    setClosing(true);
    timer.current = setTimeout(
      onClose,
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 240,
    );
  }
  return (
    <dialog
      ref={dialog}
      className="activity-modal measurement-modal"
      data-closing={closing}
      aria-labelledby="growth-form-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onPointerDown={(event) => {
        outside.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (outside.current && event.target === event.currentTarget) close();
        outside.current = false;
      }}
    >
      <section className="activity-editor">
        <header className="activity-editor-header">
          <button type="button" aria-label={text.close} onClick={close}>
            <X size={20} strokeWidth={1.75} />
          </button>
          <h1 id="growth-form-title">{text.add}</h1>
        </header>
        <div className="content">
          <form
            id="growth-form"
            className="activity-form"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              onSave({
                id: crypto.randomUUID(),
                metric: kind,
                value: Number(data.get("value")),
                date: String(data.get("date")),
              });
            }}
          >
            <div className="activity-picker-field">
              <span id="measurement-label">{text.metric}</span>
              <details
                ref={picker}
                className="activity-picker"
                onKeyDown={(event) => {
                  if (event.key === "Escape" && picker.current?.open) {
                    event.preventDefault();
                    event.stopPropagation();
                    picker.current.open = false;
                    picker.current.querySelector("summary")?.focus();
                  }
                }}
              >
                <summary aria-labelledby="measurement-label measurement-selected">
                  <MetricIcon metric={kind} />
                  <span id="measurement-selected">{metrics[kind].label}</span>
                  <ChevronDown size={20} strokeWidth={1.75} />
                </summary>
                <div
                  className="activity-picker-options"
                  role="group"
                  aria-label={text.metric}
                >
                  {metricIds.map((id) => (
                    <button
                      type="button"
                      key={id}
                      aria-label={metrics[id].label}
                      aria-pressed={id === kind}
                      onClick={() => {
                        setKind(id);
                        if (picker.current) {
                          picker.current.open = false;
                          picker.current.querySelector("summary")?.focus();
                        }
                      }}
                    >
                      <MetricIcon metric={id} />
                      <span>{metrics[id].label}</span>
                    </button>
                  ))}
                </div>
              </details>
            </div>
            <label>
              {text.value}
              <div className="measurement-stepper">
                <button
                  type="button"
                  aria-label="Decrease value"
                  onClick={() => adjust(-1)}
                  disabled={Number(values[kind]) <= step}
                >
                  <Minus size={20} strokeWidth={1.75} />
                </button>
                <div className="measurement-number">
                  <input
                    style={{
                      width: `${Math.max(2, values[kind].length) + 0.5}ch`,
                    }}
                    name="value"
                    aria-label={`${text.value} (${metrics[kind].unit})`}
                    value={values[kind]}
                    onChange={(event) =>
                      setValues((previous) => ({
                        ...previous,
                        [kind]: event.target.value,
                      }))
                    }
                    type="number"
                    inputMode="decimal"
                    placeholder="0.0"
                    min="0.01"
                    max="1000"
                    step={step}
                    required
                  />
                  <span className="measurement-unit">{metrics[kind].unit}</span>
                </div>
                <button
                  type="button"
                  aria-label="Increase value"
                  onClick={() => adjust(1)}
                  disabled={Number(values[kind]) >= 1000}
                >
                  <Plus size={20} strokeWidth={1.75} />
                </button>
              </div>
            </label>
            <label>
              {text.date}
              <div className="editor-input-icon">
                <CalendarDays size={19} aria-hidden="true" />
                <input
                  name="date"
                  type="date"
                  defaultValue={dateKey()}
                  max={dateKey()}
                  required
                />
              </div>
            </label>
          </form>
        </div>
        <footer className="footer">
          <button type="submit" form="growth-form" className="primary">
            {text.save}
          </button>
        </footer>
      </section>
    </dialog>
  );
}
