"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MobileShell } from "@/components/mobile-shell";
import { dateKey } from "@/lib/date";
import { ActivityForm } from "./activity-form";
import { loadActivities, saveActivities, type Activity } from "./storage";
export function ActivityScreen() {
  const router = useRouter(),
    params = useSearchParams();
  const [date, setDate] = useState(""),
    [items, setItems] = useState<Activity[]>([]),
    [editing, setEditing] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    setDate(dateKey());
    try {
      setItems(loadActivities());
    } catch {
      setError("อ่านข้อมูลในเครื่องไม่ได้");
    }
    setEditing(params.get("add") === "1");
  }, [params]);
  if (editing)
    return (
      <MobileShell>
        <ActivityForm
          date={date}
          onCancel={() => {
            setEditing(false);
            router.replace("/");
          }}
          onSave={(item) => {
            try {
              const next = [...items, item];
              saveActivities(next);
              setItems(next);
              setDate(item.date);
              setEditing(false);
              router.replace("/");
            } catch {
              setError("บันทึกไม่ได้ ลองอีกครั้ง");
            }
          }}
        />
        {error && <p role="alert">{error}</p>}
      </MobileShell>
    );
  const selected = new Date((date || dateKey()) + "T12:00:00+07:00");
  const start = new Date(selected);
  start.setDate(start.getDate() - start.getDay());
  return (
    <MobileShell active="/">
      <section className="content timeline-content">
        <div className="calendar-top">
          <div className="greeting">
            <div className="profile-circle" />
            <div>
              <h2>สวัสดี,</h2>
              <p>วันนี้เป็นอย่างไรบ้าง?</p>
            </div>
          </div>
          <div className="week">
            {Array.from({ length: 7 }, (_, i) => {
              const d = new Date(start);
              d.setDate(d.getDate() + i);
              const key = dateKey(d);
              return (
                <button
                  key={key}
                  className={key === date ? "primary" : ""}
                  onClick={() => setDate(key)}
                >
                  <small>
                    {["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."][d.getDay()]}
                  </small>
                  <b>{d.getDate()}</b>
                </button>
              );
            })}
          </div>
          <div className="calendar-handle" />
        </div>
        <div className="activities-heading">
          <h2>กิจกรรม</h2>
          <button aria-label="เพิ่มกิจกรรม" onClick={() => setEditing(true)}>
            +
          </button>
        </div>
        {error && <p role="alert">{error}</p>}
        <div className="activity-list">
          {items
            .filter((item) => item.date === date)
            .sort((a, b) => a.from.localeCompare(b.from))
            .map((item) => (
              <article key={item.id} className="card activity-card">
                <h2>{item.activity}</h2>
                <p>
                  {item.from === item.to
                    ? item.from
                    : `${item.from} – ${item.to}`}{" "}
                  น.
                </p>
                {item.note && <p>{item.note}</p>}
              </article>
            ))}
          {!items.some((item) => item.date === date) && (
            <p className="center">ยังไม่มีกิจกรรม</p>
          )}
        </div>
      </section>
    </MobileShell>
  );
}
