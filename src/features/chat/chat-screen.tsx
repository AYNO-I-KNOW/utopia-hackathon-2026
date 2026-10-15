"use client";
import { useEffect, useRef, useState } from "react";
type Message = { text: string; user: boolean };
export function ChatScreen({ onBack }: { onBack: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    { text: "อยากถามเรื่องอะไรเพิ่มเติม?", user: false },
  ]);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages]);
  return (
    <>
      <header className="top">
        <button aria-label="ย้อนกลับ" onClick={onBack}>
          ‹
        </button>
        <b>พูดคุยกับ AI</b>
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
                text: "ลูกมีอาการอะไรเพิ่มเติมบ้าง เล่าให้ฟังได้เลยค่ะ",
                user: false,
              },
            ]);
            form.reset();
          }}
        >
          <input
            name="message"
            aria-label="ข้อความ"
            placeholder="พิมพ์ข้อความ…"
            required
          />
          <button className="primary">ส่ง</button>
        </form>
      </footer>
    </>
  );
}
