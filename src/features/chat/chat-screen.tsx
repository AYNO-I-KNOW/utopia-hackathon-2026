"use client";
import { copy } from "@/content";
import { useEffect, useRef, useState } from "react";
import "./styles.css";

type Message = { text: string; user: boolean };

export function ChatScreen({ onBack }: { onBack: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    { text: copy.chatGreeting, user: false },
  ]);
  const [draft, setDraft] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => {
    log.current?.scrollTo({
      top: log.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);
  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages((previous) => [
      ...previous,
      { text: trimmed, user: true },
      { text: copy.chatMockReply, user: false },
    ]);
    setDraft("");
    setShowSuggestions(false);
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
      <div
        className="ubot-messages"
        role="log"
        aria-label={copy.chat}
        aria-live="polite"
        ref={log}
      >
        {messages.map((message, index) => (
          <div
            key={index}
            className={"ubot-bubble" + (message.user ? " ubot-user" : "")}
          >
            {message.text}
          </div>
        ))}
      </div>
      <footer className="ubot-composer">
        {showSuggestions && (
          <div className="ubot-suggestions" id="ubot-suggestions">
            {copy.chatSuggestedQuestions.map((question) => (
              <button key={question} onClick={() => send(question)}>
                {question}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            send(draft);
          }}
        >
          <button
            type="button"
            className="ubot-more"
            aria-label={copy.chatSuggestions}
            aria-expanded={showSuggestions}
            aria-controls="ubot-suggestions"
            onClick={() => setShowSuggestions(!showSuggestions)}
          >
            +
          </button>
          <div className="ubot-input-wrap">
            <input
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
              disabled={!draft.trim()}
            >
              <img src="/images/chat/send.svg" alt="" />
            </button>
          </div>
        </form>
      </footer>
    </div>
  );
}
