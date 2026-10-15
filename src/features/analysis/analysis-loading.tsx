import { copy } from "@/content";

// Add matching character poses here when more illustrations are available.
const analysisIllustrations = ["/images/analysis/baby.png"];

export function AnalysisLoading() {
  return (
    <section className="content loading-content">
      <div className="analysis-loading" role="status">
        <div
          className="result-baby-mask analysis-loading-baby"
          aria-hidden="true"
        >
          <img src={analysisIllustrations[0]} alt="" />
        </div>
        <h1>{copy.analyzing}</h1>
        <div className="analysis-loading-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </section>
  );
}
