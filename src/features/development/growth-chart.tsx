"use client";
import { dateKey } from "@/lib/date";
import { recordedSeries } from "./series";
import type { GrowthEntry } from "./data";
import { useState } from "react";
import { growthCopy as text } from "@/content/development";
import { metrics, sampleBars, type MetricId, type Period } from "./data";
export function GrowthChart({
  metric,
  period,
  entries,
}: {
  metric: MetricId;
  period: Period;
  entries: GrowthEntry[];
}) {
  const [selected, setSelected] = useState(6);
  const item = metrics[metric];
  const actual = recordedSeries(entries, metric, period, dateKey());
  const hasRecorded = entries.some((entry) => entry.metric === metric);
  if (hasRecorded)
    return (
      <div className={"growth-chart growth-" + metric}>
        <p className="growth-demo-label">{text.recorded}</p>
        {actual.length ? (
          <svg
            className="growth-live-chart"
            viewBox="0 0 343 248"
            role="img"
            aria-label={item.label}
          >
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <g key={i}>
                <line
                  x1="36"
                  y1={16 + i * 40}
                  x2="330"
                  y2={16 + i * 40}
                  stroke="var(--color-growth-grid)"
                  strokeDasharray="4 4"
                />
                <text x="2" y={20 + i * 40}>
                  {(
                    (Math.max(item.max, ...actual.map((e) => e.value)) *
                      (5 - i)) /
                    5
                  ).toFixed(1)}
                </text>
              </g>
            ))}
            <polyline
              fill="none"
              stroke="var(--chart-color)"
              strokeWidth="3"
              points={actual
                .map(
                  (entry, i) =>
                    `${36 + (i / Math.max(1, actual.length - 1)) * 294},${216 - (entry.value / Math.max(item.max, ...actual.map((e) => e.value))) * 200}`,
                )
                .join(" ")}
            />
            {actual.map((entry, i) => (
              <g key={entry.id}>
                <circle
                  cx={36 + (i / Math.max(1, actual.length - 1)) * 294}
                  cy={
                    216 -
                    (entry.value /
                      Math.max(item.max, ...actual.map((e) => e.value))) *
                      200
                  }
                  r="4"
                  fill="var(--chart-color)"
                />
                <text
                  x={36 + (i / Math.max(1, actual.length - 1)) * 294}
                  y={
                    204 -
                    (entry.value /
                      Math.max(item.max, ...actual.map((e) => e.value))) *
                      200
                  }
                  textAnchor="middle"
                >
                  {entry.value}
                </text>
                {(actual.length <= 7 || i === actual.length - 1) && (
                  <text
                    x={36 + (i / Math.max(1, actual.length - 1)) * 294}
                    y="240"
                    textAnchor="middle"
                  >
                    {entry.date.slice(5)}
                  </text>
                )}
              </g>
            ))}
          </svg>
        ) : (
          <p className="growth-empty">{text.noPeriodData}</p>
        )}
      </div>
    );

  const labels =
    period === "week"
      ? text.days
      : period === "month"
        ? text.weeks
        : text.months;
  const bars = sampleBars[period];
  return (
    <div className={"growth-chart growth-" + metric}>
      <div
        className="growth-plot"
        role="img"
        aria-label={`${item.label} · ${text.sample}`}
      >
        <div className="growth-axis">
          {[5, 4, 3, 2, 1, 0].map((n) => (
            <span key={n}>{(item.max * n) / 5}</span>
          ))}
        </div>
        <div className="growth-graph-area">
          <div className="growth-grid">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} />
            ))}
          </div>
          {item.chart === "line" ? (
            <>
              <div className="growth-line-art">
                <img
                  src={
                    "/images/development/" +
                    (metric === "weight"
                      ? "3-430-imgVector7.svg"
                      : "3-506-imgVector7.svg")
                  }
                  alt=""
                />
                <img
                  src={
                    "/images/development/" +
                    (metric === "weight"
                      ? "3-430-imgVector6.svg"
                      : "3-506-imgVector6.svg")
                  }
                  alt=""
                />
              </div>
              <span className="growth-tooltip">
                {text.current}
                <br />
                {item.value} {item.unit}
              </span>
            </>
          ) : (
            <>
              <img
                className="growth-average-line"
                src={
                  "/images/development/" +
                  (metric === "sleep"
                    ? "3-260-imgLine3.svg"
                    : "3-345-imgLine3.svg")
                }
                alt=""
              />
              <div className="growth-bars">
                {bars.map((value, i) => (
                  <div key={i} className={selected === i ? "selected" : ""}>
                    <span>{value.toFixed(2)}</span>
                    <i
                      style={{ height: Math.round((value / item.max) * 204) }}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <div className="growth-chart-labels">
        {labels.map((label, i) => (
          <button
            key={label}
            onClick={() => setSelected(i)}
            aria-pressed={selected === i}
            aria-label={`${label} ${item.chart === "bar" ? bars[i] : item.value} ${item.unit}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="growth-legend">
        <span>
          <i />
          {item.label}
        </span>
        <span>
          <i />
          {text.comparison}
        </span>
      </div>
      <p className="growth-demo-label">{text.sample}</p>
    </div>
  );
}
