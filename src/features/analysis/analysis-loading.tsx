import { CryingBaby } from "@/components/crying-baby";
import { copy } from "@/content";

export function AnalysisLoading() {
  return (
    <section className="content loading-content">
      <div className="analysis-loading" role="status">
        <div
          className="result-baby-mask analysis-loading-baby"
          aria-hidden="true"
        >
          <CryingBaby />
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
