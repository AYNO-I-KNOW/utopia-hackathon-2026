import { Button } from "@/components/button";
import { copy } from "@/content";
import type { Bubble } from "./use-chat";

export function MessageBubble({ message }: { message: Bubble }) {
  const mine = message.role === "user";
  return (
    <div className={`chat-row ${mine ? "chat-row--user" : ""}`}>
      <div className={`chat-bubble ${mine ? "chat-bubble--user" : ""}`}>
        <span className="chat-text">{message.content}</span>
        <time className="chat-time">{message.time}</time>
      </div>
    </div>
  );
}

export function TypingBubble() {
  return (
    <div className="chat-row">
      <div
        className="chat-bubble chat-typing"
        role="status"
        aria-label={copy.chatTyping}
      >
        <span className="chat-dot" />
        <span className="chat-dot" />
        <span className="chat-dot" />
      </div>
    </div>
  );
}

export function ErrorBubble({
  text,
  onRetry,
}: {
  text: string;
  onRetry: () => void;
}) {
  return (
    <div className="chat-row">
      <div className="chat-bubble chat-bubble--error" role="alert">
        <span className="chat-text">{text}</span>
        <Button variant="secondary" className="chat-retry" onClick={onRetry}>
          {copy.chatRetry}
        </Button>
      </div>
    </div>
  );
}

export function ResultCard({ title, chip }: { title: string; chip: string }) {
  return (
    <section className="chat-result" aria-label={copy.chatLatestResult}>
      <p className="chat-result-kicker">{copy.chatLatestResult}</p>
      <p className="chat-result-title">{title}</p>
      {chip && <span className="chat-result-chip">{chip}</span>}
    </section>
  );
}
