"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { MobileShell } from "@/components/mobile-shell";
import { formatElapsed } from "@/lib/date";
import { ChatScreen } from "@/features/chat/chat-screen";
import { MOCK_RESULT as result } from "./mock";
type Step = "ready" | "record" | "loading" | "result" | "chat";
export function AnalysisScreen() {
  const [step, setStep] = useState<Step>("ready"),
    [elapsed, setElapsed] = useState(0),
    [started, setStarted] = useState(0),
    [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (step !== "record") return;
    const update = () =>
      setElapsed(Math.floor((performance.now() - started) / 1000));
    update();
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [step, started]);
  useEffect(() => {
    if (step !== "loading") return;
    const timer = setTimeout(() => setStep("result"), 2200);
    return () => clearTimeout(timer);
  }, [step]);
  function start() {
    setStarted(performance.now());
    setElapsed(0);
    setStep("record");
  }
  return (
    <MobileShell active={step === "ready" ? "/analysis" : undefined}>
      {step === "chat" ? (
        <ChatScreen onBack={() => setStep("result")} />
      ) : step === "loading" ? (
        <section className="content loading-content">
          <div className="center" role="status">
            <div className="spinner" />
            <h1>กำลังวิเคราะห์…</h1>
          </div>
        </section>
      ) : step === "result" ? (
        <>
          <section className="content">
            <div className="center">
              <div
                className="baby-image"
                aria-label="พื้นที่สำหรับภาพเด็ก"
                role="img"
              />
              <h1>{result.reason}</h1>
              <div className="tag">ความมั่นใจ {result.confidence}%</div>
              <p>ลองสังเกตอาการหิวร่วมด้วย</p>
            </div>
            <div className="card">
              <h2>คำแนะนำ</h2>
              <p>{result.advice}</p>
            </div>
            <div className="card">
              <h2>เช็กเพิ่มเติม</h2>
              <p>{result.extra}</p>
            </div>
            <button className="full" onClick={start}>
              วิเคราะห์อีกครั้ง
            </button>
          </section>
          <footer className="footer">
            <button onClick={() => setStep("chat")}>พูดคุยกับ AI</button>
            <Link className="button primary" href="/?add=1">
              บันทึก
            </Link>
          </footer>
        </>
      ) : (
        <>
          {step === "record" && (
            <header className="top">
              <button
                aria-label="ยกเลิกการบันทึก"
                onClick={() => setConfirm(true)}
              >
                ‹
              </button>
              <b>วิเคราะห์เสียงร้อง</b>
            </header>
          )}
          <section className="content home-content">
            <div className="center">
              <h1>
                {step === "ready"
                  ? "ลูกกำลังร้องเพราะอะไร?"
                  : "กำลังฟังเสียงร้อง"}
              </h1>
              <p>
                {step === "ready"
                  ? "ฟังเสียงร้อง เพื่อเข้าใจลูก"
                  : "วางโทรศัพท์ใกล้ลูก ในที่เงียบ"}
              </p>
              {step === "record" && (
                <>
                  <div className="wave" aria-hidden="true">
                    {Array.from({ length: 40 }, (_, i) => (
                      <i
                        key={i}
                        style={{
                          height: 18 + ((i * 37) % 75),
                          animationDelay: `${i * -0.09}s`,
                        }}
                      />
                    ))}
                  </div>
                  <div className="timer">{formatElapsed(elapsed)}</div>
                  <p>กำลังบันทึก…</p>
                </>
              )}
              <div className="home-action">
                <button
                  className="mic"
                  aria-label={
                    step === "ready"
                      ? "เริ่มวิเคราะห์เสียง"
                      : "ยืนยันเสียงและวิเคราะห์"
                  }
                  onClick={step === "ready" ? start : () => setStep("loading")}
                >
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {step === "ready" ? (
                      <>
                        <rect x="9" y="2" width="6" height="12" rx="3" />
                        <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" />
                      </>
                    ) : (
                      <path d="m5 12 4 4L19 6" />
                    )}
                  </svg>
                </button>
                {step === "ready" && <p>แตะเพื่อเริ่มวิเคราะห์</p>}
              </div>
            </div>
          </section>
        </>
      )}
      {confirm && (
        <div className="overlay">
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="exit-title"
          >
            <h2 id="exit-title">ออกจากการบันทึก?</h2>
            <p>เสียงนี้จะไม่ถูกบันทึก</p>
            <div className="actions">
              <button autoFocus onClick={() => setConfirm(false)}>
                บันทึกต่อ
              </button>
              <button
                className="primary"
                onClick={() => {
                  setConfirm(false);
                  setStep("ready");
                }}
              >
                ออกจากการบันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </MobileShell>
  );
}
