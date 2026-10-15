export function dateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function currentTime() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}
export function formatElapsed(total: number) {
  const seconds = String(total % 60).padStart(2, "0");
  const minutes = String(Math.floor(total / 60) % 60).padStart(2, "0");
  const hours = Math.floor(total / 3600);
  return hours
    ? `${String(hours).padStart(2, "0")}:${minutes}:${seconds}`
    : `${minutes}:${seconds}`;
}
/** Epoch ms of a Bangkok wall-clock date and HH:mm (UTC+7, no DST). */
export function bangkokInstant(date: string, time: string) {
  return Date.parse(`${date}T${time}:00+07:00`);
}
