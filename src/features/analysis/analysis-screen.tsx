"use client";
import { Button } from "@/components/button";
import { copy } from "@/content";
import { useEffect, useState } from "react";
import Link from "next/link";
import { MobileShell } from "@/components/mobile-shell";
import { formatElapsed } from "@/lib/date";
import { ChatScreen } from "@/features/chat/chat-screen";
import { MOCK_RESULT as result } from "./mock";
import { AnalysisReady } from "./analysis-ready";
type Step = "ready" | "record" | "loading" | "result" | "chat";
export function AnalysisScreen() {
  const [step, setStep] = useState<Step>("ready"),
    [elapsed, setElapsed] = useState(0),
    [started, setStarted] = useState(0),
    [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (step !== "record") return;
    const update = () =>
      setElapsed(Math.floor((performance.now() - started) / 1000));
    update();
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [step, started]);
  useEffect(() => {
    if (step !== "loading") return;
    const timer = setTimeout(() => setStep("result"), 2200);
    return () => clearTimeout(timer);
  }, [step]);
  function start() {
    setStarted(performance.now());
    setElapsed(0);
    setStep("record");
  }
  if (step === "ready")
    return (
      <MobileShell>
        <AnalysisReady onStart={start} />
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
        <>
          <section className="content">
            <div className="center">
              <div
                className="baby-image"
                aria-label={copy.babyPlaceholderAlt}
                role="img"
              />
              <h1>{result.reason}</h1>
              <div className="tag">
                {copy.confidence} {result.confidence}%
              </div>
              <p>{copy.observeHunger}</p>
            </div>
            <div className="card">
              <h2>{copy.advice}</h2>
              <p>{result.advice}</p>
            </div>
            <div className="card">
              <h2>{copy.extraChecks}</h2>
              <p>{result.extra}</p>
            </div>
            <Button className="full" onClick={start}>
              {copy.analyzeAgain}
            </Button>
          </section>
          <footer className="footer">
            <button onClick={() => setStep("chat")}>{copy.chat}</button>
            <Link className="button primary" href="/?add=1">
              {copy.save}
            </Link>
          </footer>
        </>
      ) : (
        <>
          {step === "record" && (
            <header className="top">
              <button
                aria-label={copy.cancelRecording}
                onClick={() => setConfirm(true)}
              >
                ‹
              </button>
              <b>{copy.analyzeCry}</b>
            </header>
          )}
          <section className="content home-content">
            <div className="center">
              <h1>{copy.listening}</h1>
              <p>{copy.recordingHint}</p>
              {step === "record" && (
                <>
                  <div className="wave" aria-hidden="true">
                    {Array.from({ length: 40 }, (_, i) => (
                      <i
                        key={i}
                        style={{
                          height: 18 + ((i * 37) % 75),
                          animationDelay: `${i * -0.09}s`,
                        }}
                      />
                    ))}
                  </div>
                  <div className="timer">{formatElapsed(elapsed)}</div>
                  <p>{copy.recording}</p>
                </>
              )}
              <div className="home-action">
                <button
                  className="mic"
                  aria-label={copy.confirmAudio}
                  onClick={() => setStep("loading")}
                >
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m5 12 4 4L19 6" />
                  </svg>
                </button>
              </div>
            </div>
          </section>
        </>
      )}
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
}
