"use client";
import { activeLocale, copy } from "@/content";
import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { MobileShell } from "@/components/mobile-shell";
import { buildContext } from "@/features/activities/context";
import { loadActivities } from "@/features/activities/storage";
import { ChatScreen } from "@/features/chat/chat-screen";
import { AnalysisLoading } from "./analysis-loading";
import { AnalysisResult, headline } from "./analysis-result";
import { AnalysisCapture } from "./analysis-capture";
import { AnalysisError } from "./analysis-error";
import { ExitDialog } from "./exit-dialog";
import { analyzeCry, ApiError, isAbort, MAX_UPLOAD_BYTES } from "./api";
import type { AnalysisContext, AnalysisResult as Result } from "./parse";
import "./styles.css";
type Step = "ready" | "record" | "loading" | "result" | "error" | "chat";

const EMPTY_CONTEXT: AnalysisContext = {
  last_feed_min: null,
  last_diaper_min: null,
  last_sleep_end_min: null,
};

function savedContext(): AnalysisContext {
  try {
    return buildContext(loadActivities(), new Date());
  } catch {
    return EMPTY_CONTEXT;
  }
}

export function AnalysisScreen() {
  const [step, setStep] = useState<Step>("ready"),
    [elapsed, setElapsed] = useState(0),
    [started, setStarted] = useState(0),
    [confirm, setConfirm] = useState(false);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const [canRetry, setCanRetry] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const recordedMs = useRef(0);
  const audio = useRef<Blob | null>(null);
  const context = useRef<AnalysisContext>(EMPTY_CONTEXT);
  const request = useRef({ id: 0, controller: new AbortController() });
  function togglePause() {
    if (paused) setStarted(performance.now() - recordedMs.current);
    else {
      recordedMs.current = performance.now() - started;
      setElapsed(Math.floor(recordedMs.current / 1000));
    }
    setPaused((value) => !value);
  }
  useEffect(() => {
    if (step !== "record" || paused || !ready) return;
    const update = () =>
      setElapsed(Math.floor((performance.now() - started) / 1000));
    update();
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [step, started, paused, ready]);
  // Drop any in-flight request when leaving the screen; late replies are ignored.
  useEffect(
    () => () => {
      request.current.id++;
      request.current.controller.abort();
    },
    [],
  );
  async function analyze(blob: Blob, next: AnalysisContext) {
    request.current.controller.abort();
    const current = {
      id: request.current.id + 1,
      controller: new AbortController(),
    };
    request.current = current;
    audio.current = blob;
    context.current = next;
    setStep("loading");
    try {
      const reply = await analyzeCry(
        blob,
        activeLocale,
        next,
        current.controller.signal,
      );
      if (current.id !== request.current.id) return;
      showResult(reply, current.id);
    } catch (error) {
      if (current.id !== request.current.id || isAbort(error)) return;
      fail(error instanceof ApiError ? error : new ApiError("generic"));
    }
  }
  // The result arrives when the backend answers; cross-fade into it when the browser can.
  function showResult(reply: Result, id: number) {
    const apply = () => {
      // The transition callback runs later; a cancel or newer analyze may have won meanwhile.
      if (id !== request.current.id) return;
      setResult(reply);
      setStep("result");
    };
    if (
      !document.startViewTransition ||
      document.hidden ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      apply();
      return;
    }
    const transition = document.startViewTransition(() => {
      flushSync(apply);
    });
    // A skipped transition (hidden page, superseded by another) rejects `ready`
    // with InvalidStateError; the state update already happened, so ignore it.
    for (const promise of [
      transition.ready,
      transition.updateCallbackDone,
      transition.finished,
    ])
      promise.catch(() => {});
  }
  function fail(error: ApiError) {
    setCanRetry(audio.current !== null && error.kind !== "too_big");
    setFailure(error);
    setStep("error");
  }
  function cancelAnalysis() {
    request.current.id++;
    request.current.controller.abort();
    audio.current = null;
    setStep("ready");
  }
  function reset() {
    audio.current = null;
    setStep("ready");
  }
  function confirmRecording(blob: Blob | null) {
    if (blob) void analyze(blob, savedContext());
    else fail(new ApiError("bad_audio"));
  }
  function chooseFile(file: File) {
    audio.current = null;
    if (file.size > MAX_UPLOAD_BYTES) fail(new ApiError("too_big"));
    else void analyze(file, savedContext());
  }
  function start() {
    audio.current = null;
    setPaused(false);
    setReady(false);
    recordedMs.current = 0;
    setElapsed(0);
    setStep("record");
  }
  // The clock starts when MediaRecorder has really started, not at the tap.
  const markReady = useCallback(() => {
    recordedMs.current = 0;
    setStarted(performance.now());
    setElapsed(0);
    setReady(true);
  }, []);
  const capture = step === "ready" || step === "record";
  return (
    <MobileShell>
      <p className="sr-only" aria-live="polite">
        {announcement(step, result, failure)}
      </p>
      {capture ? (
        <>
          <AnalysisCapture
            recording={step === "record"}
            elapsed={elapsed}
            paused={paused}
            onTogglePause={togglePause}
            onStart={start}
            onReady={markReady}
            onConfirm={confirmRecording}
            onMicError={() => fail(new ApiError("mic"))}
            onFile={chooseFile}
            onCancel={() => setConfirm(true)}
          />
          {confirm && (
            <ExitDialog
              onContinue={() => setConfirm(false)}
              onExit={() => {
                setConfirm(false);
                setStep("ready");
              }}
            />
          )}
        </>
      ) : step === "chat" && result ? (
        <ChatScreen result={result} onBack={() => setStep("result")} />
      ) : step === "loading" ? (
        <>
          <AnalysisLoading />
          <footer className="footer">
            <button onClick={cancelAnalysis}>{copy.cancelAnalysis}</button>
          </footer>
        </>
      ) : step === "error" && failure ? (
        <AnalysisError
          message={failure.message}
          canRetry={canRetry}
          onRetry={() =>
            audio.current && void analyze(audio.current, context.current)
          }
          onReset={reset}
        />
      ) : step === "result" && result ? (
        <AnalysisResult
          result={result}
          onChat={() => setStep("chat")}
          onRetry={start}
          onAnswer={(field, minutes) =>
            audio.current &&
            void analyze(audio.current, {
              ...context.current,
              [field]: minutes,
            })
          }
        />
      ) : null}
    </MobileShell>
  );
}

function announcement(
  step: Step,
  result: Result | null,
  failure: ApiError | null,
) {
  if (step === "loading") return copy.analyzing;
  if (step === "error") return failure?.message ?? "";
  if (step === "result" && result) return headline(result).title;
  return "";
}
