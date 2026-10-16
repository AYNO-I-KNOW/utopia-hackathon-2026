"use client";
// Chat layout adapted from the UI generated in U-bot's U-Code (ubot-export/).
// Answers come from our own backend (POST /chat); U-bot is only a handoff link.
import { ArrowUp, ArrowUpRight, ChevronLeft } from "lucide-react";
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
const FOLLOW_THRESHOLD_PX = 64;
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
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("");
  const following = useRef(true);
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const { title, chip } = headline(result);
  const last = bubbles[bubbles.length - 1];
  const announcement = last?.role === "assistant" ? last.content : "";

  useEffect(() => {
    if (!following.current) return;
    log.current?.scrollTo({
      top: log.current.scrollHeight,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }, [bubbles, loading, error]);

  function submit(text: string, fromQuickReply = false) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    following.current = true;
    send(trimmed);
    if (!fromQuickReply) {
      setDraft("");
      input.current?.focus();
    }
  }
  function handoff() {
    // Both calls stay synchronous in the click so the new tab is not popup-blocked.
    const copied = copyText(handoffPrompt(result));
    const tab = window.open(UBOT_URL, "_blank");
    if (tab) tab.opener = null;
    void copied.then((ok) =>
      setStatus(!tab ? copy.ubotBlocked : ok ? "" : copy.ubotCopyFailed),
    );
  }

  return (
    <div className="ubot-chat">
      <header className="ubot-header">
        <button className="ubot-back" aria-label={copy.back} onClick={onBack}>
          <ChevronLeft size={22} strokeWidth={1.75} />
        </button>
        <div className="ubot-profile">
          <img className="ubot-avatar" src="/images/chat/ubot.svg" alt="" />
          <div className="ubot-identity">
            <h1>{copy.botName}</h1>
            <span className="ubot-verified" aria-hidden="true" />
          </div>
        </div>
        <button
          type="button"
          className="ubot-handoff"
          aria-label={copy.ubotGo}
          onClick={handoff}
        >
          <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
          <span>{copy.ubotOpen}</span>
        </button>
      </header>
      <p role="status" aria-live="polite" className="ubot-note">
        {status}
      </p>
      <ResultCard title={title} chip={chip} />
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <div
        className="ubot-messages"
        role="log"
        aria-label={copy.chat}
        aria-live="off"
        ref={log}
        onScroll={(event) => {
          const element = event.currentTarget;
          following.current =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            FOLLOW_THRESHOLD_PX;
        }}
      >
        {bubbles.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {loading && <TypingBubble />}
        {error && <ErrorBubble text={error} onRetry={retry} />}
      </div>
      <footer className="ubot-composer">
        <div
          className="ubot-quick-prompts"
          role="group"
          aria-label={copy.chatQuickLabel}
        >
          {QUICK_REPLIES.map((text) => (
            <button
              key={text}
              type="button"
              disabled={loading}
              onClick={() => submit(text, true)}
            >
              {text}
            </button>
          ))}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit(draft);
          }}
        >
          <div className="ubot-input-wrap">
            <input
              ref={input}
              name="message"
              aria-label={copy.chatInputLabel}
              placeholder={copy.chatPlaceholder}
              value={draft}
              maxLength={MAX_INPUT_CHARS}
              onChange={(event) => setDraft(event.target.value)}
              autoComplete="off"
              enterKeyHint="send"
            />
            <button
              className="ubot-send"
              aria-label={copy.chatSend}
              disabled={!draft.trim() || loading}
            >
              <ArrowUp size={22} strokeWidth={1.75} />
            </button>
          </div>
        </form>
      </footer>
    </div>
  );
}
