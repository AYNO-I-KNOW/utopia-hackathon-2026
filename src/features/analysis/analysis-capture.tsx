import { CryingBaby } from "@/components/crying-baby";
import { ChevronLeft, Pause, Play } from "lucide-react";
import { copy } from "@/content";
import { SceneLink } from "@/components/scene-navigation";
import { formatElapsed } from "@/lib/date";
import { useEffect, useRef } from "react";
import { MAX_RECORD_SECONDS, MIN_RECORD_SECONDS } from "./recorder";
import { useAudioLevel } from "./use-audio-level";

type Props = {
  recording: boolean;
  elapsed: number;
  paused: boolean;
  onTogglePause: () => void;
  onStart: () => void;
  onReady: () => void;
  onConfirm: (audio: Blob | null) => void;
  onMicError: () => void;
  onFile: (file: File) => void;
  onCancel: () => void;
};

/** Keep the same action mounted so its size and icon can transition continuously. */
export function AnalysisCapture({
  recording,
  elapsed,
  paused,
  onTogglePause,
  onStart,
  onReady,
  onConfirm,
  onMicError,
  onFile,
  onCancel,
}: Props) {
  const { canvasRef, error, ready, finish } = useAudioLevel(recording, paused);
  const fileInput = useRef<HTMLInputElement>(null);
  const finishing = useRef(false);
  const tooShort = elapsed < MIN_RECORD_SECONDS;
  async function confirm() {
    if (finishing.current) return;
    if (error) return onMicError();
    finishing.current = true;
    onConfirm(await finish());
  }
  useEffect(() => {
    if (!recording) finishing.current = false;
  }, [recording]);
  useEffect(() => {
    if (recording && ready) onReady();
  }, [recording, ready, onReady]);
  useEffect(() => {
    if (recording && !paused && elapsed >= MAX_RECORD_SECONDS) void confirm();
    // confirm is guarded by `finishing`, so re-running on identity change is safe.
  }, [recording, paused, elapsed, confirm]);
  return (
    <section
      className="analysis-ready"
      data-recording={recording}
      data-paused={paused}
    >
      <div className="analysis-backdrop" aria-hidden="true">
        <img
          className="analysis-background"
          src="/images/analysis/background.png"
          alt=""
        />
      </div>
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
        <CryingBaby
          className="analysis-baby"
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
                : tooShort
                  ? copy.minRecording
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
              disabled={!ready}
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
            onClick={recording ? confirm : onStart}
            aria-label={recording ? copy.stopRecording : copy.startAnalysis}
            disabled={recording && (error || !ready || tooShort)}
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
        <button
          className="capture-upload"
          onClick={() => fileInput.current?.click()}
          tabIndex={recording ? -1 : 0}
          aria-hidden={recording}
        >
          {copy.uploadAudio}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="audio/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onFile(file);
          }}
        />
      </div>
    </section>
  );
}
