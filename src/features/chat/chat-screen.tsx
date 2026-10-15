"use client";
import { copy } from "@/content";
import { useEffect, useRef, useState } from "react";
type Message = { text: string; user: boolean };
export function ChatScreen({ onBack }: { onBack: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    { text: copy.chatGreeting, user: false },
  ]);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages]);
  return (
    <>
      <header className="top">
        <button aria-label={copy.back} onClick={onBack}>
          ‹
        </button>
        <b>{copy.chat}</b>
      </header>
      <section className="content chat-content">
        <div id="messages" role="log" aria-live="polite">
          {messages.map((m, i) => (
            <div key={i} className={"bubble" + (m.user ? " user" : "")}>
              {m.text}
            </div>
          ))}
          <div ref={bottom} />
        </div>
      </section>
      <footer className="footer">
        <form
          className="chat-form"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const text = String(new FormData(form).get("message")).trim();
            if (!text) return;
            setMessages((m) => [
              ...m,
              { text, user: true },
              {
                text: copy.chatMockReply,
                user: false,
              },
            ]);
            form.reset();
          }}
        >
          <input
            name="message"
            aria-label={copy.message}
            placeholder={copy.messagePlaceholder}
            required
          />
          <button className="primary">{copy.send}</button>
        </form>
      </footer>
    </>
  );
}
