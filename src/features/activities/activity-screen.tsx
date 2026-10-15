"use client";
import { HomeHero } from "./home-hero";
import { ActivityIcon } from "./activity-icon";
import { growthCopy } from "@/content/development";
import { copy } from "@/content";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MobileShell } from "@/components/mobile-shell";
import { dateKey } from "@/lib/date";
import { activityLabel } from "./options";
import { ActivityForm } from "./activity-form";
import { loadActivities, saveActivities, type Activity } from "./storage";
export function ActivityScreen() {
  const router = useRouter(),
    params = useSearchParams();
  const [date, setDate] = useState(""),
    [items, setItems] = useState<Activity[]>([]),
    [editing, setEditing] = useState(false),
    [showHistory, setShowHistory] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    setDate(dateKey());
    try {
      setItems(loadActivities());
    } catch {
      setError(copy.storageReadError);
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
              setError(copy.storageWriteError);
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
    <MobileShell>
      <section className="content timeline-content home-timeline">
        <HomeHero />
        <div className="home-shortcuts">
          <Link href="/analysis" className="shortcut primary">
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" />
            </svg>
            <span>{copy.analyzeCry}</span>
          </Link>
          <Link href="/development" className="shortcut">
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 4v16h16M8 15l4-5 4 2 4-7" />
            </svg>
            <span>{copy.viewDevelopment}</span>
          </Link>
        </div>
        <div className="activities-heading">
          <h2>{growthCopy.daily}</h2>
          <button
            className="home-history-toggle"
            aria-expanded={showHistory}
            aria-controls="home-history"
            onClick={() => setShowHistory(!showHistory)}
          >
            {growthCopy.history}
          </button>
          <button
            aria-label={copy.addActivity}
            onClick={() => setEditing(true)}
          >
            +
          </button>
        </div>
        {showHistory && (
          <div id="home-history" className="home-history">
            <div className="calendar-top">
              {" "}
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
                        {
                          [
                            copy.sun,
                            copy.mon,
                            copy.tue,
                            copy.wed,
                            copy.thu,
                            copy.fri,
                            copy.sat,
                          ][d.getDay()]
                        }
                      </small>
                      <b>{d.getDate()}</b>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {error && <p role="alert">{error}</p>}
        <div className="activity-list">
          {items
            .filter((item) => item.date === date)
            .sort((a, b) => a.from.localeCompare(b.from))
            .map((item) => (
              <article key={item.id} className="card activity-card">
                <ActivityIcon kind={item.activity} />
                <div className="home-activity-body">
                  <h2>{activityLabel(item.activity)}</h2>
                  <p>
                    {item.from === item.to
                      ? item.from
                      : `${item.from} – ${item.to}`}{" "}
                    {copy.timeSuffix}
                  </p>
                  {item.note && <p>{item.note}</p>}
                </div>
              </article>
            ))}
          {!items.some((item) => item.date === date) && (
            <p className="center">{copy.noActivities}</p>
          )}
        </div>
      </section>
    </MobileShell>
  );
}
