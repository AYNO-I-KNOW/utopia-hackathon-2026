import type { Activity } from "./storage";

/** Fixed prototype calendar; replace with server time when real data is connected. */
export const DEMO_CURRENT_DATE = "2026-10-16";
const dailySchedule = [
  ["06:30", "awake", "ตื่นแล้ว ขยับตัวและเริ่มส่งเสียง"],
  ["07:00", "hungry", "ดูดมือและหันหาเต้านม"],
  ["09:15", "sleepy", "หาวและขยี้ตา พาเข้ามุมนอนเงียบๆ"],
  ["11:40", "uncomfortable", "ผ้าอ้อมเปียก เปลี่ยนแล้วสบายตัวขึ้น"],
  ["13:10", "hungry", "ร้องเป็นช่วงๆ ก่อนมื้อนม"],
  ["15:20", "wantsHolding", "สงบลงเมื่ออุ้มและโยกเบาๆ"],
  ["17:00", "awake", "ตื่นจากงีบช่วงบ่าย อารมณ์แจ่มใส"],
  ["19:30", "sleepy", "เริ่มง่วง ลดแสงและเตรียมเข้านอน"],
] as const;

export const demoActivities: Activity[] = Array.from(
  { length: 7 },
  (_, index) => {
    const date = `2026-10-${String(10 + index).padStart(2, "0")}`;
    return dailySchedule.map(([time, activity, note], position) => {
      const [hours, minutes] = time.split(":").map(Number);
      const shifted = minutes + (index % 3) * 5;
      const from = `${String(hours + Math.floor(shifted / 60)).padStart(2, "0")}:${String(shifted % 60).padStart(2, "0")}`;
      return {
        id: `demo-${date}-${position}`,
        date,
        activity,
        from,
        to: from,
        note,
      };
    });
  },
).flat();
