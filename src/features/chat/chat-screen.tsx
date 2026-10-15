"use client";
import { Button } from "@/components/button";
import { copy } from "@/content";
import { summarizeRecent } from "@/features/activities/context";
import { loadActivities } from "@/features/activities/storage";
import type { AnalysisResult } from "@/features/analysis/parse";
import { useEffect, useState } from "react";
import { copyText } from "./clipboard";
import { buildPrompt } from "./ubot-prompt";
import "./styles.css";

const UBOT_URL = "https://u.bot/";
const FRAME_TIMEOUT_MS = 8000;
const FRAME_ALLOW = "clipboard-write";

function initialPrompt(result: AnalysisResult) {
  let items: ReturnType<typeof loadActivities> = [];
  try {
    items = loadActivities();
  } catch {
    // Unreadable storage only drops the activity line from the prompt.
  }
  return buildPrompt(result, summarizeRecent(items, new Date()));
}

export function ChatScreen({
  result,
  onBack,
}: {
  result: AnalysisResult;
  onBack: () => void;
}) {
  const [prompt, setPrompt] = useState(() => initialPrompt(result));
  const [loaded, setLoaded] = useState(false);
  const [frameFailed, setFrameFailed] = useState(
    () => navigator.onLine === false,
  );
  const [status, setStatus] = useState("");
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    if (loaded || frameFailed) return;
    const timer = setTimeout(() => setFrameFailed(true), FRAME_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [loaded, frameFailed]);
  function handoff() {
    // Both calls stay synchronous in the click so the new tab is not popup-blocked.
    const copied = copyText(prompt);
    const tab = window.open(UBOT_URL, "_blank");
    if (tab) tab.opener = null;
    setBlocked(!tab);
    void copied.then((ok) =>
      setStatus(
        !tab ? copy.ubotBlocked : ok ? copy.ubotCopied : copy.ubotCopyFailed,
      ),
    );
  }
  return (
    <div className="ubot-chat">
      <header className="ubot-header">
        <button className="ubot-back" aria-label={copy.back} onClick={onBack}>
          <img src="/images/chat/back.svg" alt="" />
        </button>
        <div className="ubot-avatar" aria-hidden="true">
          U
        </div>
        <div className="ubot-identity">
          <h1>{copy.botName}</h1>
          <p>{copy.botStatus}</p>
        </div>
      </header>
      <div className="ubot-body">
        <details className="ubot-context" open={frameFailed}>
          <summary>{copy.ubotContext}</summary>
          <textarea
            rows={8}
            aria-label={copy.ubotPromptLabel}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
        </details>
        {frameFailed ? (
          <p className="ubot-note">{copy.ubotFallback}</p>
        ) : (
          <>
            <p className="ubot-note">{copy.ubotHint}</p>
            <iframe
              className="ubot-frame"
              src={UBOT_URL}
              title={copy.ubotFrameTitle}
              allow={FRAME_ALLOW}
              onLoad={() => setLoaded(true)}
            />
          </>
        )}
      </div>
      <footer className="ubot-composer">
        <p role="status" className="ubot-note ubot-status">
          {status}
          {blocked && " "}
          {blocked && (
            <a href={UBOT_URL} target="_blank" rel="noreferrer">
              {copy.ubotOpen}
            </a>
          )}
        </p>
        <Button variant="primary" onClick={handoff}>
          {copy.ubotGo}
        </Button>
      </footer>
    </div>
  );
}
