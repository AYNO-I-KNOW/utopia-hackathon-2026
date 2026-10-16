import { Button } from "@/components/button";
import { copy } from "@/content";
import { useFocusHeading } from "./use-focus-heading";

export function AnalysisError({
  message,
  canRetry,
  permanent,
  onRetry,
  onReset,
}: {
  message: string;
  canRetry: boolean;
  permanent: boolean;
  onRetry: () => void;
  onReset: () => void;
}) {
  const heading = useFocusHeading();
  return (
    <>
      <section className="content loading-content">
        <div className="center" role="alert">
          <h1 ref={heading} tabIndex={-1}>
            {copy.analysisFailedTitle}
          </h1>
          <p>{message}</p>
        </div>
      </section>
      <footer className="footer">
        {canRetry && (
          <Button variant="primary" onClick={onRetry}>
            {copy.retryAnalysis}
          </Button>
        )}
        <Button variant={permanent ? "primary" : undefined} onClick={onReset}>
          {permanent ? copy.tryAgain : copy.recordAgain}
        </Button>
      </footer>
    </>
  );
}
