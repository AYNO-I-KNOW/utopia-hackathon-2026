"use client";
import { ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { SceneLink } from "@/components/scene-navigation";
import { MobileShell } from "@/components/mobile-shell";
import { copy } from "@/content";
import { growthCopy as text } from "@/content/development";
import {
  metrics,
  metricIds,
  parseEntries,
  type GrowthEntry,
  type MetricId,
  type Period,
} from "./data";
import { MetricIcon } from "./metric-icon";
import { GrowthForm } from "./growth-form";
import { GrowthChart } from "./growth-chart";
const KEY = "crybaby-growth";
export function DevelopmentScreen({ metric }: { metric?: MetricId }) {
  const [entries, setEntries] = useState<GrowthEntry[]>([]),
    [showForm, setShowForm] = useState(false),
    [error, setError] = useState(""),
    [period, setPeriod] = useState<Period>("week");
  useEffect(() => {
    try {
      setEntries(parseEntries(localStorage.getItem(KEY)));
    } catch {
      setError(text.saveError);
    }
  }, []);
  const item = metric ? metrics[metric] : null;
  const latest = metric
    ? entries
        .filter((entry) => entry.metric === metric)
        .reverse()
        .sort((a, b) => b.date.localeCompare(a.date))
        .at(0)
    : undefined;
  function save(entry: GrowthEntry) {
    try {
      const next = [...entries, entry];
      localStorage.setItem(KEY, JSON.stringify(next));
      setEntries(next);
      setShowForm(false);
    } catch {
      setError(text.saveError);
    }
  }
  return (
    <MobileShell>
      <div className={"growth-page " + (!metric ? "growth-overview" : "")}>
        {!metric && (
          <div className="growth-shared-scene" aria-hidden="true">
            <img
              src="/images/analysis/background.png"
              className="growth-scene-background"
              alt=""
            />
          </div>
        )}
        <header className="growth-header">
          <SceneLink
            className="growth-back"
            href={metric ? "/development" : "/"}
            aria-label={copy.back}
          >
            <ChevronLeft size={22} strokeWidth={1.75} />
          </SceneLink>
        </header>
        <section className="growth-content">
          {metric && item ? (
            <>
              <div className="growth-summary">
                <MetricIcon metric={metric} />
                <div>
                  <h1>{item.label}</h1>
                  <div className="growth-value-row">
                    <strong>
                      {latest?.value ?? item.value} {item.unit}
                    </strong>
                    <span className="growth-chip">
                      {latest ? text.recorded : item.change}
                    </span>
                  </div>
                </div>
              </div>
              <div
                className="growth-tabs"
                data-period={period}
                role="tablist"
                aria-label={text.title}
              >
                <span className="growth-tab-indicator" aria-hidden="true" />
                {(["week", "month", "year"] as const).map((id, index) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={period === id}
                    tabIndex={period === id ? 0 : -1}
                    onKeyDown={(event) => {
                      const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
                      if (!keys.includes(event.key)) return;
                      event.preventDefault();
                      const next =
                        event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? 2
                            : (index + (event.key === "ArrowRight" ? 1 : 2)) %
                              3;
                      setPeriod((["week", "month", "year"] as const)[next]);
                      const tabs =
                        event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                          "button",
                        );
                      tabs?.[next]?.focus();
                    }}
                    onClick={() => setPeriod(id)}
                  >
                    <b>{[text.week, text.month, text.year][index]}</b>
                  </button>
                ))}
              </div>
              <GrowthChart
                key={metric + period}
                metric={metric}
                period={period}
                entries={entries}
              />
              <div className="growth-advice-cards">
                <article className="result-advice">
                  <img src="/images/result/bottle.png" alt="" />
                  <div>
                    <h2>{copy.resultAdviceTitle}</h2>
                    <p>{copy.resultAdvice}</p>
                  </div>
                </article>
                <article className="result-care">
                  <img src="/images/result/care.png" alt="" />
                  <div>
                    <h2>{copy.resultCareTitle}</h2>
                    <p>{copy.resultCare}</p>
                  </div>
                </article>
              </div>
            </>
          ) : (
            <>
              <div className="growth-heading">
                <h1>{text.title}</h1>
                <button onClick={() => setShowForm(true)}>
                  {text.add}
                  <img
                    src="/images/development/3-582-imgAkarIconsPlus.svg"
                    alt=""
                  />
                </button>
              </div>
              <div className="growth-card-grid">
                {metricIds.map((id) => {
                  const config = metrics[id],
                    entry = entries
                      .filter((e) => e.metric === id)
                      .reverse()
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .at(0);
                  return (
                    <Link
                      href={"/development/" + id}
                      className="growth-metric-card"
                      key={id}
                    >
                      <MetricIcon metric={id} />
                      <h2>{config.label}</h2>
                      <p>
                        {entry?.value ?? config.value} {config.unit}
                      </p>
                      <span className="growth-chip">
                        {entry ? text.recorded : config.change}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
          {error && <p role="alert">{error}</p>}
        </section>
        {metric && (
          <footer className="growth-footer">
            <button onClick={() => setShowForm(true)}>{copy.addAction}</button>
          </footer>
        )}
      </div>
      {showForm && (
        <GrowthForm
          entries={entries}
          initial={metric ?? "weight"}
          onSave={save}
          onClose={() => setShowForm(false)}
        />
      )}
    </MobileShell>
  );
}
