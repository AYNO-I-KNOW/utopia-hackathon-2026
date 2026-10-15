"use client";
import { useState } from "react";
import { currentTime, dateKey } from "@/lib/date";
import type { Activity } from "./storage";
export function ActivityForm({
  onSave,
  onCancel,
  date,
}: {
  onSave: (item: Activity) => void;
  onCancel: () => void;
  date: string;
}) {
  const [time] = useState(currentTime);
  return (
    <>
      <header className="top">
        <button onClick={onCancel} aria-label="ย้อนกลับ">
          ‹
        </button>
        <b>บันทึกกิจกรรม</b>
      </header>
      <section className="content">
        <form
          id="activity-form"
          className="activity-form"
          onSubmit={(event) => {
            event.preventDefault();
            const f = new FormData(event.currentTarget);
            onSave({
              id: crypto.randomUUID(),
              activity: String(f.get("activity")),
              date: String(f.get("date")),
              from: String(f.get("from")),
              to: String(f.get("to")),
              note: String(f.get("note")).trim(),
            });
          }}
        >
          <label>
            กิจกรรม
            <select name="activity">
              {[
                "ให้นม",
                "เปลี่ยนผ้าอ้อม",
                "นอน",
                "เล่น",
                "อุ้มปลอบ",
                "อื่น ๆ",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            วันที่
            <input
              type="date"
              name="date"
              defaultValue={date || dateKey()}
              required
            />
          </label>
          <div className="time-fields">
            <label>
              เริ่ม
              <input name="from" type="time" defaultValue={time} required />
            </label>
            <label>
              สิ้นสุด
              <input name="to" type="time" defaultValue={time} required />
            </label>
          </div>
          <label>
            บันทึกเพิ่มเติม
            <textarea name="note" rows={3} placeholder="เพิ่มรายละเอียด" />
          </label>
        </form>
      </section>
      <footer className="footer">
        <button className="primary" type="submit" form="activity-form">
          บันทึก
        </button>
      </footer>
    </>
  );
}
