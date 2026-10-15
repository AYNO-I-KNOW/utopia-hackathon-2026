"use client";
import { copy } from "@/content";
import { capitalize, labelCopy, toPercent } from "./labels";
import type { AnalysisContext, AskKey, TopItem } from "./parse";
import { ListenWave } from "./listen-wave";
import { useSpeech } from "./use-speech";

const ASK: Record<
  AskKey,
  { label: string; field: "last_feed_min" | "last_diaper_min" }
> = {
  last_feed: { label: copy.askFeed, field: "last_feed_min" },
  last_diaper: { label: copy.askDiaper, field: "last_diaper_min" },
};
const CHOICES = [
  [copy.askUnderHour, 30],
  [copy.askOneToThree, 120],
  [copy.askOverThree, 240],
] as const;

export type AnswerContext = (
  field: keyof AnalysisContext,
  minutes: number,
) => void;

export function AskCard({
  ask,
  onAnswer,
}: {
  ask: AskKey[];
  onAnswer: AnswerContext;
}) {
  return (
    <section className="result-ask">
      <h2>{copy.askTitle}</h2>
      {ask.map((key, index) => (
        <div key={`${index}-${key}`} className="result-ask-row">
          <p>{ASK[key].label}</p>
          <div className="result-ask-choices">
            {CHOICES.map(([label, minutes]) => (
              <button
                key={minutes}
                aria-label={`${ASK[key].label.replace(/^\S+\s/, "")} ${label}`}
                onClick={() => onAnswer(ASK[key].field, minutes)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

export function TopBars({ top }: { top: TopItem[] }) {
  return (
    <section className="result-top">
      <h2>{copy.topTitle}</h2>
      <ul>
        {top.map((item, index) => (
          <li key={`${index}-${item.label}`}>
            <span>{capitalize(labelCopy(item.label).name)}</span>
            <b>{toPercent(item.prob)}%</b>
            <div className="result-bar" aria-hidden="true">
              <i style={{ width: `${toPercent(item.prob)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ListenButton({ text }: { text: string }) {
  const { status, error, toggle, readLevels } = useSpeech(text);
  if (status === "hidden") return null;
  return (
    <>
      <button
        className="result-listen"
        onClick={toggle}
        aria-label={copy.listen}
        aria-pressed={status !== "idle"}
      >
        {/* All states share one grid cell so the widest label sizes the button. */}
        <span
          className="result-listen-label"
          data-active={status === "idle"}
          aria-hidden="true"
        >
          🔊 {copy.listen}
        </span>
        <span
          className="result-listen-label"
          data-active={status === "loading"}
          aria-hidden="true"
        >
          {copy.listenLoading}
        </span>
        {status === "playing" && <ListenWave readLevels={readLevels} />}
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
