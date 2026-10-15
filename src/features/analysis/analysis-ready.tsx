import { copy } from "@/content";
import Link from "next/link";

/** Native Figma layers for node 3:31, adapted to a fluid mobile viewport. */
export function AnalysisReady({ onStart }: { onStart: () => void }) {
  return (
    <section className="analysis-ready">
      <img
        className="analysis-background"
        src="/images/analysis/background.png"
        alt=""
      />
      <Link href="/" className="analysis-back" aria-label={copy.backHome}>
        <img src="/images/analysis/back.svg" alt="" />
      </Link>
      <div className="analysis-heading">
        <h1>{copy.analysisTitle}</h1>
        <p className="analysis-intro">
          {copy.analysisIntro}
          <br />
          {copy.analysisIntroEnd}
        </p>
      </div>
      <div className="analysis-illustration">
        <img
          className="analysis-baby"
          src="/images/analysis/baby.png"
          alt={copy.cryingBabyAlt}
        />
      </div>
      <div className="analysis-action">
        <button
          className="analysis-microphone"
          onClick={onStart}
          aria-label={copy.startAnalysis}
        >
          <img src="/images/analysis/microphone.svg" alt="" />
        </button>
        <p className="analysis-caption">{copy.tapToListen}</p>
      </div>
    </section>
  );
}
