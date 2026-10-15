export type Activity = {
  id: string;
  activity: string;
  date: string;
  from: string;
  to: string;
  note: string;
};
const KEY = "baby-activities";
export function loadActivities(): Activity[] {
  const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is Activity =>
        item &&
        ["activity", "date", "from", "to", "note"].every(
          (key) => typeof item[key] === "string",
        ),
    )
    .map((item) => ({ ...item, id: String(item.id) }));
}
export function saveActivities(items: Activity[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}
