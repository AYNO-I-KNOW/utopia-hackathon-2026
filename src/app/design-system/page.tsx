import type { CSSProperties } from "react";
import { Button } from "@/components/button";
// Internal developer reference. This is not part of the product navigation.
const colors = [
  "brand",
  "brand-hover",
  "brand-pressed",
  "brand-soft",
  "text",
  "text-secondary",
  "text-muted",
  "background",
  "surface",
  "border",
  "success",
  "error",
];
export default function DesignSystem() {
  return (
    <main className="ds-page">
      <h1>Crybaby · Design System</h1>
      <p>Nunito · ภาษาไทยสำหรับเกลาคำก่อนแปลอังกฤษ</p>
      <section className="ds-section">
        <h2>สี</h2>
        <div className="ds-grid">
          {colors.map((color) => (
            <div className="ds-swatch" key={color}>
              <div
                className="ds-swatch-color"
                style={{ "--swatch": `var(--color-${color})` } as CSSProperties}
              />
              <p>{color}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="ds-section">
        <h2>ตัวอักษร</h2>
        <div className="ds-example">
          <h1>เข้าใจเสียงร้องของลูก</h1>
          <h2>Understand your baby</h2>
          <p>ข้อความหลัก · Body copy · 0123456789</p>
          <p className="note">ข้อความประกอบ · Caption</p>
        </div>
      </section>
      <section className="ds-section">
        <h2>ปุ่มและสถานะ</h2>
        <div className="ds-controls">
          <Button variant="primary">บันทึก</Button>
          <Button>วิเคราะห์อีกครั้ง</Button>
          <Button variant="ghost">ย้อนกลับ</Button>
          <Button variant="primary" disabled>
            บันทึกไม่ได้
          </Button>
        </div>
      </section>
      <section className="ds-section">
        <h2>ฟอร์มและการ์ด</h2>
        <div className="ds-example activity-form">
          <label>
            บันทึกเพิ่มเติม
            <input placeholder="เพิ่มรายละเอียด" />
          </label>
          <article className="card">
            <h2>ให้นม</h2>
            <p>14:30 น.</p>
          </article>
          <p role="alert">ตัวอย่างข้อความผิดพลาด</p>
        </div>
      </section>
    </main>
  );
}
