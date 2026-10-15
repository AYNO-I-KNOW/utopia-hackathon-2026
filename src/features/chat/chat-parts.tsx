import { Button } from "@/components/button";
import { copy } from "@/content";
import type { Bubble } from "./use-chat";

export function MessageBubble({ message }: { message: Bubble }) {
  return (
    <div
      className={"ubot-bubble" + (message.role === "user" ? " ubot-user" : "")}
    >
      {message.content}
    </div>
  );
}

export function TypingBubble() {
  return (
    <div
      className="ubot-bubble ubot-typing"
      role="status"
      aria-label={copy.chatTyping}
    >
      <span aria-hidden="true" />
      <span aria-hidden="true" />
      <span aria-hidden="true" />
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
    <div className="ubot-bubble ubot-error" role="alert">
      <span>{text}</span>
      <Button variant="secondary" className="ubot-retry" onClick={onRetry}>
        {copy.chatRetry}
      </Button>
    </div>
  );
}

export function ResultCard({ title, chip }: { title: string; chip: string }) {
  return (
    <section className="ubot-result" aria-label={copy.chatLatestResult}>
      <p className="ubot-result-kicker">{copy.chatLatestResult}</p>
      <p className="ubot-result-title">{title}</p>
      {chip && <span className="ubot-result-chip">{chip}</span>}
    </section>
  );
}
