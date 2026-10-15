import Link from "next/link";
import { copy } from "@/content";
import { activityKindForLabel, labelCopy, toPercent } from "./labels";
import type { AnalysisResult as Result } from "./parse";
import {
  AskCard,
  ListenButton,
  TopBars,
  type AnswerContext,
} from "./result-parts";
import { useFocusHeading } from "./use-focus-heading";

type Props = {
  result: Result;
  onChat: () => void;
  onAnswer: AnswerContext;
  onRetry: () => void;
};

export function headline(result: Result) {
  const [first, second] = result.top;
  if (result.case === "no_cry")
    return { title: copy.titleNoCry, chip: "", hint: copy.hintNoCry };
  if (!first || result.case === "unsure")
    return {
      title: copy.titleUnsure,
      chip: copy.confidenceLow,
      hint: copy.hintUnsure,
    };
  const chip = `${copy.confidence} ${toPercent(first.prob)}%`;
  if (result.case === "close" && second)
    return {
      title: `${copy.titleClosePrefix}${labelCopy(first.label).name}${copy.titleCloseJoin}${labelCopy(second.label).name}`,
      chip,
      hint: "",
    };
  return {
    title: copy.titleConfident + labelCopy(first.label).name,
    chip,
    hint: labelCopy(first.label).hint,
  };
}

function saveHref(result: Result) {
  const first = result.top[0];
  if (!first) return "";
  const note = copy.analysisNoteTemplate
    .replace("{label}", labelCopy(first.label).name)
    .replace("{percent}", String(toPercent(first.prob)));
  const params = new URLSearchParams({
    add: "1",
    state: activityKindForLabel(first.label),
    note,
  });
  return `/?${params}`;
}

export function AnalysisResult({ result, onChat, onAnswer, onRetry }: Props) {
  const { title, chip, hint } = headline(result);
  const heading = useFocusHeading();
  const noCry = result.case === "no_cry";
  const href = saveHref(result);
  return (
    <div className="analysis-result">
      <section className="result-content">
        <Link href="/" className="result-close" aria-label={copy.backHome}>
          <img src="/images/result/close.svg" alt="" />
        </Link>
        <div className="result-summary">
          <div className="result-baby-mask">
            <img src="/images/analysis/baby.png" alt={copy.cryingBabyAlt} />
          </div>
          <h1 ref={heading} tabIndex={-1}>
            {title}
          </h1>
          {chip && <span className="result-confidence">{chip}</span>}
          {hint && <p className="result-explanation">{hint}</p>}
        </div>
        {result.case === "close" && result.ask.length > 0 && (
          <AskCard ask={result.ask} onAnswer={onAnswer} />
        )}
        <div className="result-cards">
          {!noCry && <TopBars top={result.top.slice(0, 3)} />}
          <article className="result-advice">
            <img src="/images/result/bottle.png" alt="" />
            <div>
              <h2>{copy.summaryTitle}</h2>
              <p>{result.summary}</p>
              {!noCry && result.summary && (
                <ListenButton text={result.summary} />
              )}
            </div>
          </article>
          {result.checklist.length > 0 && (
            <article className="result-care">
              <img src="/images/result/care.png" alt="" />
              <div>
                <h2>{copy.checklistTitle}</h2>
                <ul>
                  {result.checklist.map((item, index) => (
                    <li key={`${index}-${item}`}>{item}</li>
                  ))}
                </ul>
              </div>
            </article>
          )}
          {result.suggest_lullaby && (
            <article className="result-lullaby">
              <span aria-hidden="true">🎵</span>
              <div>
                <h2>{copy.lullabyTitle}</h2>
                <p>{copy.lullabyText}</p>
              </div>
            </article>
          )}
          {result.see_doctor && (
            <article className="result-doctor" role="alert">
              <span aria-hidden="true">⚠️</span>
              <div>
                <h2>{copy.seeDoctorTitle}</h2>
                <p>{copy.seeDoctorText}</p>
              </div>
            </article>
          )}
        </div>
        <p className="result-disclaimer">{copy.disclaimer}</p>
      </section>
      <footer className="result-actions">
        {noCry ? (
          <button className="primary" onClick={onRetry}>
            {copy.recordAgain}
          </button>
        ) : (
          <>
            <button onClick={onChat}>{copy.chat}</button>
            {href && <Link href={href}>{copy.addAction}</Link>}
          </>
        )}
      </footer>
    </div>
  );
}
