import { ChevronLeft, Pause, Play } from "lucide-react";
import { copy } from "@/content";
import { SceneLink } from "@/components/scene-navigation";
import { formatElapsed } from "@/lib/date";
import { useAudioLevel } from "./use-audio-level";

type Props = {
  recording: boolean;
  elapsed: number;
  paused: boolean;
  onTogglePause: () => void;
  onStart: () => void;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Keep the same action mounted so its size and icon can transition continuously. */
export function AnalysisCapture({
  recording,
  elapsed,
  paused,
  onTogglePause,
  onStart,
  onConfirm,
  onCancel,
}: Props) {
  const { canvasRef, error } = useAudioLevel(recording, paused);
  return (
    <section
      className="analysis-ready"
      data-recording={recording}
      data-paused={paused}
    >
      <img
        className="analysis-background"
        src="/images/analysis/background.png"
        alt=""
      />
      {recording ? (
        <button
          className="analysis-back"
          aria-label={copy.cancelRecording}
          onClick={onCancel}
        >
          <ChevronLeft size={22} strokeWidth={1.75} />
        </button>
      ) : (
        <SceneLink
          href="/"
          className="analysis-back"
          aria-label={copy.backHome}
        >
          <ChevronLeft size={22} strokeWidth={1.75} />
        </SceneLink>
      )}
      <div className="analysis-heading">
        <h1>{recording ? copy.listening : copy.analysisTitle}</h1>
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
          alt={recording ? "" : copy.cryingBabyAlt}
        />
      </div>
      <div className="analysis-action">
        <div className="capture-feedback" aria-hidden={!recording}>
          <canvas
            ref={canvasRef}
            className="listening-wave"
            aria-hidden="true"
          />
          <p
            className="analysis-caption recording-status"
            data-error={error}
            role={recording ? "status" : undefined}
          >
            {error
              ? copy.microphoneError
              : paused
                ? copy.recordingPaused
                : copy.recording}
          </p>
          <span className="recording-time">{formatElapsed(elapsed)}</span>
        </div>
        <div className="capture-controls">
          <div className="capture-exit-slot">
            <button
              className="capture-exit"
              onClick={onTogglePause}
              aria-pressed={paused}
              tabIndex={recording ? 0 : -1}
              aria-hidden={!recording}
            >
              {paused ? (
                <Play size={20} fill="currentColor" />
              ) : (
                <Pause size={20} fill="currentColor" />
              )}
              <span>{paused ? copy.continueRecording : copy.pause}</span>
            </button>
          </div>
          <button
            className="analysis-microphone"
            onClick={recording ? onConfirm : onStart}
            aria-label={recording ? copy.stopRecording : copy.startAnalysis}
            disabled={recording && error}
          >
            <img
              className="capture-mic-icon"
              src="/images/analysis/microphone.svg"
              alt=""
            />
            <span className="capture-stop-icon" aria-hidden="true" />
            <span className="capture-stop-label">{copy.finish}</span>
          </button>
        </div>
        <p
          className="capture-start-caption analysis-caption"
          aria-hidden={recording}
        >
          {copy.tapToListen}
        </p>
      </div>
    </section>
  );
}
