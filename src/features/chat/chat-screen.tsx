"use client";
import { ChevronLeft, ArrowUp } from "lucide-react";
import { copy } from "@/content";
import { useEffect, useRef, useState } from "react";
import "./styles.css";

function getDemoReply(text: string) {
  if (/wrong|not right|incorrect/i.test(text))
    return "Thanks for letting me know. The result is only an estimate. What are you noticing that seems different?";
  if (/still crying|won.t stop/i.test(text))
    return "How long has your baby been crying, and what have you tried so far?";
  if (/look for|symptom|notice/i.test(text))
    return "What is your baby doing while crying? Have you noticed anything different from usual?";
  if (/soothe|hold|comfort/i.test(text))
    return "What have you tried to soothe your baby, and how did they respond?";
  if (/thank/i.test(text))
    return "You’re welcome. If anything changes, you can tell me here.";
  if (text.trim().length < 4)
    return "What would you like help with? Tell me a little more, or choose a question below.";
  return "When did this start, and how is your baby doing right now?";
}

type Message = { text: string; user: boolean };

export function ChatScreen({ onBack }: { onBack: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    { text: copy.chatGreeting, user: false },
  ]);
  const [draft, setDraft] = useState("");
  const [replying, setReplying] = useState(false);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const following = useRef(true);
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!following.current) return;
    log.current?.scrollTo({
      top: log.current.scrollHeight,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }, [messages, replying]);
  useEffect(
    () => () => {
      if (replyTimer.current) clearTimeout(replyTimer.current);
    },
    [],
  );
  function send(text: string, fromSuggestion = false) {
    const trimmed = text.trim();
    if (!trimmed || replyTimer.current) return;
    following.current = true;
    setMessages((previous) => [...previous, { text: trimmed, user: true }]);
    setReplying(true);
    replyTimer.current = setTimeout(() => {
      setMessages((previous) => [
        ...previous,
        { text: getDemoReply(trimmed), user: false },
      ]);
      setReplying(false);
      replyTimer.current = null;
    }, 1200);
    if (!fromSuggestion) {
      setDraft("");
      input.current?.focus();
    }
  }
  return (
    <div className="ubot-chat">
      <header className="ubot-header">
        <button className="ubot-back" aria-label={copy.back} onClick={onBack}>
          <ChevronLeft size={22} strokeWidth={1.75} />
        </button>
        <div className="ubot-profile">
          <img
            className="ubot-avatar"
            src="/images/chat/assistant.svg"
            alt=""
          />
          <div className="ubot-identity">
            <h1>{copy.botName}</h1>
            <span className="ubot-verified" aria-hidden="true" />
          </div>
        </div>
      </header>
      <div
        className="ubot-messages"
        role="log"
        aria-label={copy.chat}
        aria-live="polite"
        ref={log}
        onScroll={(event) => {
          const element = event.currentTarget;
          following.current =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            64;
        }}
      >
        {messages.map((message, index) => (
          <div
            key={index}
            className={"ubot-bubble" + (message.user ? " ubot-user" : "")}
          >
            {message.text}
          </div>
        ))}
        {replying && (
          <div
            className="ubot-bubble ubot-typing"
            role="status"
            aria-label={copy.botTyping}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </div>
        )}
      </div>
      <footer className="ubot-composer">
        <div
          className="ubot-quick-prompts"
          role="group"
          aria-label={copy.chatSuggestions}
        >
          {copy.chatSuggestedQuestions.map((question) => (
            <button
              key={question}
              type="button"
              disabled={replying}
              onClick={() => send(question, true)}
            >
              {question}
            </button>
          ))}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            send(draft);
          }}
        >
          <div className="ubot-input-wrap">
            <input
              ref={input}
              name="message"
              aria-label={copy.message}
              placeholder={copy.messagePlaceholder}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              autoComplete="off"
            />
            <button
              className="ubot-send"
              aria-label={copy.send}
              disabled={!draft.trim() || replying}
            >
              <ArrowUp size={22} strokeWidth={1.75} />
            </button>
          </div>
        </form>
      </footer>
    </div>
  );
}
