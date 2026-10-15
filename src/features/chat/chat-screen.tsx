"use client";
import { copy } from "@/content";
import { useEffect, useRef, useState } from "react";
import "./styles.css";

function getDemoReply(text: string) {
  if (/ไม่ตรง|ไม่ใช่|ผิด/.test(text))
    return "ขอบคุณที่บอกค่ะ ผลวิเคราะห์เป็นเพียงการคาดการณ์ ตอนนี้ลูกมีท่าทางหรือเสียงร้องต่างจากที่ผลบอกอย่างไรบ้างคะ?";
  if (/ยังร้อง|ร้องไม่หยุด/.test(text))
    return "ลูกยังร้องอยู่ใช่ไหมคะ ร้องมานานแค่ไหนแล้ว และก่อนหน้านี้ลองทำอะไรไปบ้างคะ?";
  if (/สังเกต|อาการ/.test(text))
    return "เล่าได้เลยค่ะ ตอนร้องลูกมีท่าทางอย่างไร และมีอะไรเปลี่ยนไปจากปกติบ้างคะ?";
  if (/ปลอบ|อุ้ม/.test(text))
    return "ก่อนหน้านี้ลองปลอบลูกด้วยวิธีไหนบ้างคะ แล้วลูกตอบสนองอย่างไร เล่าให้ฟังทีละอย่างได้เลยค่ะ";
  if (/ขอบคุณ/.test(text))
    return "ยินดีค่ะ ถ้ามีอะไรเปลี่ยนไป หรืออยากเล่าเพิ่มเติม พิมพ์ต่อได้เลยนะคะ";
  if (text.trim().length < 4)
    return "อยากถามเรื่องไหนเกี่ยวกับลูกคะ พิมพ์เล่าเพิ่มอีกนิด หรือเลือกคำถามด้านล่างได้เลยค่ะ";
  return "รับทราบค่ะ เรื่องนี้เริ่มตั้งแต่เมื่อไหร่ และตอนนี้ลูกเป็นอย่างไรบ้างคะ?";
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
          <img src="/images/analysis/back.svg" alt="" />
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
              <img src="/images/chat/send.svg" alt="" />
            </button>
          </div>
        </form>
      </footer>
    </div>
  );
}
