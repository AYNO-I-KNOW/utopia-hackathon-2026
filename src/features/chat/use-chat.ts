import { copy } from "@/content";
import { ApiError, chat, isAbort } from "@/features/analysis/api";
import type { AnalysisResult, ChatMessage } from "@/features/analysis/parse";
import { useEffect, useRef, useState } from "react";
import { toChatResult } from "./chat-result";

export type Bubble = ChatMessage & { id: number; time: string };

const timestamp = () =>
  new Date().toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });

/** Chat state for one analysis result; the first bubble is the real summary. */
export function useChat(result: AnalysisResult) {
  const [bubbles, setBubbles] = useState<Bubble[]>(() => [
    { id: 0, role: "assistant", content: result.summary, time: timestamp() },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextId = useRef(1);
  const request = useRef({ id: 0, controller: new AbortController() });

  // Drop any in-flight request when leaving the screen; late replies are ignored.
  useEffect(
    () => () => {
      request.current.id++;
      request.current.controller.abort();
    },
    [],
  );

  async function ask(history: Bubble[]) {
    request.current.controller.abort();
    const current = {
      id: request.current.id + 1,
      controller: new AbortController(),
    };
    request.current = current;
    setError(null);
    setLoading(true);
    try {
      const reply = await chat(
        history.map(({ role, content }) => ({ role, content })),
        toChatResult(result),
        "th",
        current.controller.signal,
      );
      if (current.id !== request.current.id) return;
      setBubbles((prev) => [
        ...prev,
        {
          id: nextId.current++,
          role: "assistant",
          content: reply.reply,
          time: timestamp(),
        },
      ]);
    } catch (failure) {
      if (current.id !== request.current.id || isAbort(failure)) return;
      setError(
        failure instanceof ApiError && failure.kind !== "generic"
          ? failure.message
          : copy.chatError,
      );
    }
    setLoading(false);
  }

  function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    const next: Bubble[] = [
      ...bubbles,
      { id: nextId.current++, role: "user", content, time: timestamp() },
    ];
    setBubbles(next);
    void ask(next);
  }

  /** Re-asks with the same history; the failed user message is already in it. */
  function retry() {
    if (!loading) void ask(bubbles);
  }

  return { bubbles, loading, error, send, retry };
}
