import { copy } from "@/content";
import {
  parseAnalysis,
  parseChatReply,
  trimChatMessages,
  type AnalysisContext,
  type AnalysisResult,
  type ChatMessage,
  type ChatReply,
  type ChatResult,
} from "./parse";

const ANALYZE_TIMEOUT_MS = 60_000;
const SPEAK_TIMEOUT_MS = 15_000;
const CHAT_TIMEOUT_MS = 30_000;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
// Read at build time; Next inlines only the literal `process.env.NEXT_PUBLIC_*` form.
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(
  /\/+$/,
  "",
);

export type Lang = "th" | "en";

export type ApiErrorKind =
  | "mic"
  | "config"
  | "network"
  | "bad_audio"
  | "too_big"
  | "unsupported"
  | "busy"
  | "unavailable"
  | "generic";

const MESSAGES: Record<ApiErrorKind, string> = {
  mic: copy.microphoneError,
  config: copy.errConfig,
  network: copy.errNetwork,
  bad_audio: copy.errBadAudio,
  too_big: copy.errTooBig,
  unsupported: copy.errUnsupported,
  busy: copy.errBusy,
  unavailable: copy.errUnavailable,
  generic: copy.errGeneric,
};

/** Re-sending the same file can't fix these; the user must pick or record another. */
const PERMANENT_ERRORS: readonly ApiErrorKind[] = [
  "bad_audio",
  "too_big",
  "unsupported",
];

export function isPermanentError(kind: ApiErrorKind) {
  return PERMANENT_ERRORS.includes(kind);
}

/** Failure with a user-facing message chosen by `kind`. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  constructor(kind: ApiErrorKind) {
    super(MESSAGES[kind]);
    this.kind = kind;
  }
}

export function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function kindForStatus(status: number): ApiErrorKind {
  if (status === 400) return "bad_audio";
  if (status === 413) return "too_big";
  if (status === 429) return "busy";
  if (status === 503) return "unavailable";
  return "generic";
}

function kindForChatStatus(status: number): ApiErrorKind {
  if (status === 429) return "busy";
  if (status === 503) return "unavailable";
  return "generic";
}

/**
 * fetch + read the body under one timeout/abort scope: the timer and the outside
 * `signal` forwarder stay armed until `read` has finished, not just the headers.
 * An outside abort rethrows as AbortError.
 */
async function request<T>(
  path: string,
  init: RequestInit,
  timeoutMs: number,
  read: (response: Response) => Promise<T>,
  signal?: AbortSignal,
  kindOf: (status: number) => ApiErrorKind = kindForStatus,
): Promise<T> {
  if (!API_BASE) throw new ApiError("config");
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forward = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", forward);
  try {
    const response = await fetch(API_BASE + path, {
      ...init,
      signal: controller.signal,
    });
    if (!response.ok) throw new ApiError(kindOf(response.status));
    return await read(response);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (isAbort(error) && !timedOut) throw error;
    throw new ApiError("network");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", forward);
  }
}

function extension(type: string) {
  if (type.includes("mp4")) return "mp4";
  if (type.includes("wav")) return "wav";
  return type.includes("webm") ? "webm" : "bin";
}

export async function analyzeCry(
  audio: Blob,
  lang: Lang,
  context: AnalysisContext,
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  const body = new FormData();
  body.append("audio", audio, `cry.${extension(audio.type)}`);
  body.append("lang", lang);
  body.append("context", JSON.stringify(context));
  return request(
    "/analyze",
    { method: "POST", body },
    ANALYZE_TIMEOUT_MS,
    async (response) => {
      const parsed = parseAnalysis(await response.json().catch(() => null));
      if (!parsed) throw new ApiError("generic");
      return parsed;
    },
    signal,
  );
}

export function speak(
  text: string,
  lang: Lang,
  signal?: AbortSignal,
): Promise<Blob> {
  return request(
    "/speak",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, lang }),
    },
    SPEAK_TIMEOUT_MS,
    (response) => response.blob(),
    signal,
  );
}

/** `messages` must end with a user message; older ones are trimmed to the backend limits. */
export function chat(
  messages: ChatMessage[],
  result: ChatResult | null,
  lang: Lang,
  signal?: AbortSignal,
): Promise<ChatReply> {
  return request(
    "/chat",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lang,
        result,
        messages: trimChatMessages(messages),
      }),
    },
    CHAT_TIMEOUT_MS,
    async (response) => {
      const parsed = parseChatReply(await response.json().catch(() => null));
      if (!parsed) throw new ApiError("generic");
      return parsed;
    },
    signal,
    kindForChatStatus,
  );
}
