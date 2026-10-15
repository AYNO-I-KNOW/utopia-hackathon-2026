"use client";
import { copy } from "@/content";
import { useEffect, useRef, useState } from "react";
import { MobileShell } from "@/components/mobile-shell";
import { ChatScreen } from "@/features/chat/chat-screen";
import { AnalysisResult } from "./analysis-result";
import { AnalysisCapture } from "./analysis-capture";
type Step = "ready" | "record" | "loading" | "result" | "chat";
export function AnalysisScreen() {
  const [step, setStep] = useState<Step>("ready"),
    [elapsed, setElapsed] = useState(0),
    [started, setStarted] = useState(0),
    [confirm, setConfirm] = useState(false);
  const [paused, setPaused] = useState(false);
  const recordedMs = useRef(0);
  function togglePause() {
    if (paused) setStarted(performance.now() - recordedMs.current);
    else {
      recordedMs.current = performance.now() - started;
      setElapsed(Math.floor(recordedMs.current / 1000));
    }
    setPaused((value) => !value);
  }
  useEffect(() => {
    if (step !== "record" || paused) return;
    const update = () =>
      setElapsed(Math.floor((performance.now() - started) / 1000));
    update();
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [step, started, paused]);
  useEffect(() => {
    if (step !== "loading") return;
    const timer = setTimeout(() => setStep("result"), 2200);
    return () => clearTimeout(timer);
  }, [step]);
  function start() {
    setPaused(false);
    recordedMs.current = 0;
    setStarted(performance.now());
    setElapsed(0);
    setStep("record");
  }
  if (step === "ready" || step === "record")
    return (
      <MobileShell>
        <AnalysisCapture
          recording={step === "record"}
          elapsed={elapsed}
          paused={paused}
          onTogglePause={togglePause}
          onStart={start}
          onConfirm={() => setStep("loading")}
          onCancel={() => setConfirm(true)}
        />
        {confirm && (
          <div className="overlay">
            <div
              className="dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="exit-title"
            >
              <h2 id="exit-title">{copy.exitRecordingTitle}</h2>
              <p>{copy.discardAudio}</p>
              <div className="actions">
                <button autoFocus onClick={() => setConfirm(false)}>
                  {copy.continueRecording}
                </button>
                <button
                  className="primary"
                  onClick={() => {
                    setConfirm(false);
                    setStep("ready");
                  }}
                >
                  {copy.exitRecording}
                </button>
              </div>
            </div>
          </div>
        )}
      </MobileShell>
    );
  return (
    <MobileShell>
      {step === "chat" ? (
        <ChatScreen onBack={() => setStep("result")} />
      ) : step === "loading" ? (
        <section className="content loading-content">
          <div className="center" role="status">
            <div className="spinner" />
            <h1>{copy.analyzing}</h1>
          </div>
        </section>
      ) : step === "result" ? (
        <AnalysisResult onChat={() => setStep("chat")} onRetry={start} />
      ) : null}
    </MobileShell>
  );
}
