import { CryingBaby } from "@/components/crying-baby";
import { X } from "lucide-react";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { copy } from "@/content";
import { MOCK_RESULT as result } from "./mock";
export function AnalysisResult({
  onChat,
  onRetry,
}: {
  onChat: () => void;
  onRetry: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
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
          <h1>{copy.resultTitle}</h1>
          <span className="result-confidence">
            {copy.highConfidence} {result.confidence}%
          </span>
          <p className="result-explanation">{copy.resultExplanation}</p>
        </div>
        <div className="result-cards">
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
        <button type="button" className="result-retry" onClick={onRetry}>
          Analyze again
        </button>
      </section>
      <dialog
        ref={dialog}
        className="result-exit-dialog"
        aria-labelledby="result-exit-title"
        aria-describedby="result-exit-description"
      >
        <h2 id="result-exit-title">Close this result?</h2>
        <p id="result-exit-description">
          This result has not been saved. Closing it will discard this analysis.
        </p>
        <div className="result-exit-actions">
          <button autoFocus onClick={() => dialog.current?.close()}>
            Keep viewing
          </button>
          <button onClick={() => router.push("/")}>Close without saving</button>
        </div>
      </dialog>
      <footer className="result-actions">
        <button onClick={onChat}>{copy.chat}</button>
        <Link href="/?add=1&state=hungry">{copy.addAction}</Link>
      </footer>
    </div>
  );
}
