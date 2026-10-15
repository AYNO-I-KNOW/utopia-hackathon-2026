import Link from "next/link";
import { copy } from "@/content";
import { MOCK_RESULT as result } from "./mock";
export function AnalysisResult({ onRetry }: { onRetry: () => void }) {
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
      </section>
      <footer className="result-actions">
        <button onClick={onRetry}>{copy.retry}</button>
        <Link href="/?add=1">{copy.addAction}</Link>
      </footer>
    </div>
  );
}
