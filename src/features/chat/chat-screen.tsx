"use client";
// Chat layout adapted from the UI generated in U-bot's U-Code (ubot-export/).
// Answers come from our own backend (POST /chat); U-bot is only a handoff link.
import { Button } from "@/components/button";
import { copy } from "@/content";
import { summarizeRecent } from "@/features/activities/context";
import { loadActivities } from "@/features/activities/storage";
import { headline } from "@/features/analysis/analysis-result";
import type { AnalysisResult } from "@/features/analysis/parse";
import { useEffect, useRef, useState } from "react";
import {
  ErrorBubble,
  MessageBubble,
  ResultCard,
  TypingBubble,
} from "./chat-parts";
import { copyText } from "./clipboard";
import { buildPrompt } from "./ubot-prompt";
import { useChat } from "./use-chat";
import "./styles.css";

const UBOT_URL = "https://u.bot/";
const MAX_INPUT_CHARS = 1000;
const QUICK_REPLIES = [
  copy.chatQuickNext,
  copy.chatQuickStill,
  copy.chatQuickDoctor,
];

function handoffPrompt(result: AnalysisResult) {
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
  const { bubbles, loading, error, send, retry } = useChat(result);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("");
  const [blocked, setBlocked] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const { title, chip } = headline(result);
  const last = bubbles[bubbles.length - 1];
  const announcement = last?.role === "assistant" ? last.content : "";

  useEffect(() => {
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    bottom.current?.scrollIntoView({
      behavior: calm ? "auto" : "smooth",
      block: "end",
    });
  }, [bubbles, loading, error]);

  function submit(text: string) {
    if (!text.trim() || loading) return;
    send(text);
    setInput("");
  }
  function handoff() {
    // Both calls stay synchronous in the click so the new tab is not popup-blocked.
    const copied = copyText(handoffPrompt(result));
    const tab = window.open(UBOT_URL, "_blank");
    if (tab) tab.opener = null;
    setBlocked(!tab);
    void copied.then((ok) =>
      setStatus(!tab ? copy.ubotBlocked : ok ? "" : copy.ubotCopyFailed),
    );
  }

  return (
    <div className="chat">
      <header className="chat-header">
        <button className="chat-back" aria-label={copy.back} onClick={onBack}>
          <img src="/images/chat/back.svg" alt="" />
        </button>
        <div className="chat-identity">
          <h1>{copy.botName}</h1>
          <p>{copy.botStatus}</p>
        </div>
        <div className="chat-avatar" aria-hidden="true">
          👶
        </div>
      </header>
      <ResultCard title={title} chip={chip} />
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <div className="chat-list">
        {bubbles.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {loading && <TypingBubble />}
        {error && <ErrorBubble text={error} onRetry={retry} />}
        <div ref={bottom} />
      </div>
      <div className="chat-quick" role="group" aria-label={copy.chatQuickLabel}>
        {QUICK_REPLIES.map((text) => (
          <button
            key={text}
            className="chat-chip"
            disabled={loading}
            onClick={() => submit(text)}
          >
            {text}
          </button>
        ))}
      </div>
      <footer className="chat-composer">
        <form
          className="chat-form"
          onSubmit={(event) => {
            event.preventDefault();
            submit(input);
          }}
        >
          <input
            className="chat-input"
            type="text"
            value={input}
            maxLength={MAX_INPUT_CHARS}
            placeholder={copy.chatPlaceholder}
            aria-label={copy.chatInputLabel}
            autoComplete="off"
            enterKeyHint="send"
            onChange={(event) => setInput(event.target.value)}
          />
          <button
            className="chat-send"
            type="submit"
            aria-label={copy.chatSend}
            disabled={!input.trim() || loading}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"
              />
            </svg>
          </button>
        </form>
        <Button variant="ghost" className="chat-handoff" onClick={handoff}>
          {copy.ubotGo}
        </Button>
        <p role="status" className="chat-note">
          {status}
          {blocked && " "}
          {blocked && (
            <a href={UBOT_URL} target="_blank" rel="noreferrer">
              {copy.ubotOpen}
            </a>
          )}
        </p>
      </footer>
    </div>
  );
}
