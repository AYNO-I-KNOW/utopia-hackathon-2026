import { useState, useEffect, useRef } from "react";
import "./styles.css";

const RESULT = {
  label: "diaper",
  labelTh: "ลูกน่าจะต้องเปลี่ยนผ้าอ้อม",
  confidence: 82,
  summary:
    "จากเสียงร้องของลูก ระบบวิเคราะห์ว่าลูกน่าจะรู้สึกไม่สบายตัวเพราะผ้าอ้อมเปียกหรือเต็ม ลองตรวจสอบและเปลี่ยนผ้าอ้อมให้ลูกดูนะคะ 😊",
};

const API_BASE = "http://127.0.0.1:8000";

const QUICK_REPLIES = [
  "ควรทำอะไรต่อ?",
  "ถ้ายังร้องอยู่ล่ะ?",
  "เมื่อไหร่ควรพบหมอ?",
];

const EMOJI_MAP = {
  diaper: "🍼",
  hungry: "🍼",
  pain: "😣",
  tired: "😴",
  default: "👶",
};

function getEmoji(label) {
  return EMOJI_MAP[label] || EMOJI_MAP.default;
}

function timestamp() {
  return new Date().toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TypingIndicator() {
  return (
    <div className="bubble-row left">
      <div className="bubble assistant typing-bubble">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </div>
    </div>
  );
}

function ErrorBubble({ text, onRetry }) {
  return (
    <div className="bubble-row left">
      <div className="bubble error-bubble">
        <span>{text}</span>
        <button className="retry-btn" onClick={onRetry}>
          ลองอีกครั้ง
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: RESULT.summary, time: timestamp(), id: 0 },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [lastUserMsg, setLastUserMsg] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const idRef = useRef(1);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, errorMsg]);

  async function sendMessage(text) {
    if (!text.trim() || loading) return;
    setErrorMsg(null);

    const userMsg = { role: "user", content: text.trim(), time: timestamp(), id: idRef.current++ };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLastUserMsg(text.trim());
    setLoading(true);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    try {
      const payload = {
        lang: "th",
        result: RESULT,
        messages: nextMessages.map(({ role, content }) => ({ role, content })),
      };
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      const reply = data.reply ?? "(ไม่มีคำตอบจากเซิร์ฟเวอร์)";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply, time: timestamp(), id: idRef.current++ },
      ]);
    } catch (e) {
      clearTimeout(timer);
      const msg =
        e.name === "AbortError"
          ? "หมดเวลาเชื่อมต่อ (30 วินาที) กรุณาลองอีกครั้ง"
          : `เกิดข้อผิดพลาด: ${e.message}`;
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleRetry() {
    if (lastUserMsg) {
      setMessages((prev) => prev.filter((m) => m.content !== lastUserMsg || m.role !== "user"));
      setErrorMsg(null);
      sendMessage(lastUserMsg);
    }
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <div className="shell">
      <div className="phone">
        {/* Header */}
        <header className="header">
          <button className="back-btn" aria-label="ย้อนกลับ">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="header-text">
            <span className="header-title">ปรึกษาผู้ช่วย</span>
            <span className="header-sub">จากผลวิเคราะห์ล่าสุด</span>
          </div>
          <div className="header-avatar">👶</div>
        </header>

        {/* Pinned result card */}
        <div className="result-card">
          <span className="result-emoji">{getEmoji(RESULT.label)}</span>
          <div className="result-info">
            <span className="result-label">{RESULT.labelTh}</span>
            <span className="confidence-chip">ความมั่นใจ {RESULT.confidence}%</span>
          </div>
        </div>

        {/* Message list */}
        <div className="msg-list">
          {messages.map((m) => (
            <div key={m.id} className={`bubble-row ${m.role === "user" ? "right" : "left"}`}>
              <div className={`bubble ${m.role === "user" ? "user" : "assistant"}`}>
                <span className="bubble-text">{m.content}</span>
                <span className="bubble-time">{m.time}</span>
              </div>
            </div>
          ))}
          {loading && <TypingIndicator />}
          {errorMsg && <ErrorBubble text={errorMsg} onRetry={handleRetry} />}
          <div ref={bottomRef} />
        </div>

        {/* Quick replies */}
        <div className="quick-replies">
          {QUICK_REPLIES.map((q) => (
            <button
              key={q}
              className="quick-chip"
              onClick={() => sendMessage(q)}
              disabled={loading}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input bar */}
        <div className="input-bar">
          <input
            ref={inputRef}
            className="text-input"
            type="text"
            placeholder="พิมพ์คำถาม…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={loading}
            aria-label="พิมพ์คำถาม"
          />
          <button
            className="send-btn"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            aria-label="ส่ง"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
