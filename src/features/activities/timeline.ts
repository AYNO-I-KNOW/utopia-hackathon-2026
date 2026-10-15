import type { Activity } from "./storage";

type TimelineInput = {
  demo: readonly Activity[];
  user: readonly Activity[];
  date: string;
  today: string;
  now: string;
};

/** Newest first; demo entries later than `now` are hidden on today's date. */
export function timelineForDate({
  demo,
  user,
  date,
  today,
  now,
}: TimelineInput): Activity[] {
  const hideFutureDemo = date === today;
  const demoItems = demo.filter(
    (item) => item.date === date && !(hideFutureDemo && item.from > now),
  );
  const userItems = user.filter((item) => item.date === date).reverse();
  // Stable sort keeps newest-saved user entries ahead of demo on equal times.
  return [...userItems, ...demoItems].sort((a, b) =>
    b.from.localeCompare(a.from),
  );
}
