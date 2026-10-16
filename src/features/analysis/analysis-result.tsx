import { CryingBaby } from "@/components/crying-baby";
import { X } from "lucide-react";
import { useRef } from "react";
import { useRouter } from "next/navigation";
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
import { LullabyPlayer } from "./lullaby-player";
import { pickLullaby } from "./lullaby";
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
      title: copy.titleClose
        .replace("{first}", labelCopy(first.label).name)
        .replace("{second}", labelCopy(second.label).name),
      chip,
      hint: "",
    };
  return {
    title: copy.titleConfident.replace("{label}", labelCopy(first.label).name),
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
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const noCry = result.case === "no_cry";
  const href = saveHref(result);
  return (
    <div className="analysis-result">
      <section className="result-content">
        <button
          type="button"
          className="result-close"
          aria-label={copy.backHome}
          onClick={() => dialog.current?.showModal()}
        >
          <X size={22} strokeWidth={1.75} />
        </button>
        <div className="result-summary">
          <div className="result-baby-mask">
            <CryingBaby alt={copy.cryingBabyAlt} />
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
                <LullabyPlayer track={pickLullaby(result)} />
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
        {!noCry && (
          <button type="button" className="result-retry" onClick={onRetry}>
            {copy.analyzeAgain}
          </button>
        )}
      </section>
      <dialog
        ref={dialog}
        className="result-exit-dialog"
        aria-labelledby="result-exit-title"
        aria-describedby="result-exit-description"
      >
        <h2 id="result-exit-title">{copy.exitResultTitle}</h2>
        <p id="result-exit-description">{copy.exitResultText}</p>
        <div className="result-exit-actions">
          <button autoFocus onClick={() => dialog.current?.close()}>
            {copy.keepViewing}
          </button>
          <button onClick={() => router.push("/")}>
            {copy.closeWithoutSaving}
          </button>
        </div>
      </dialog>
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
