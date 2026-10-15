"use client";
import { HomeHero } from "./home-hero";
import { ActivityIcon } from "./activity-icon";
import { ActivitySheet } from "./activity-sheet";
import { copy } from "@/content";
import { useEffect, useState } from "react";
import { SceneLink } from "@/components/scene-navigation";
import { useRouter, useSearchParams } from "next/navigation";
import { MobileShell } from "@/components/mobile-shell";
import { DEMO_CURRENT_DATE, demoActivities } from "./demo";
import { activityLabel } from "./options";
import { ActivityForm } from "./activity-form";
import { loadActivities, saveActivities, type Activity } from "./storage";
export function ActivityScreen() {
  const router = useRouter(),
    params = useSearchParams();
  const [date, setDate] = useState(DEMO_CURRENT_DATE),
    [items, setItems] = useState<Activity[]>([]),
    [editing, setEditing] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    setDate((current) => current || DEMO_CURRENT_DATE);
    try {
      setItems(loadActivities());
    } catch {
      setError(copy.storageReadError);
    }
    setEditing(params.get("add") === "1");
  }, [params]);
  const visibleItems = [...demoActivities, ...items];
  return (
    <MobileShell>
      {editing && (
        <ActivityForm
          date={date}
          initialActivity={params.get("state") ?? "sleepy"}
          initialNote={params.get("note") ?? ""}
          error={error}
          onCancel={() => {
            setEditing(false);
            router.replace("/");
          }}
          onSave={(item) => {
            setError("");
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
      )}
      <section className="home-dashboard home-timeline">
        <HomeHero />
        <ActivitySheet
          date={date}
          onDate={setDate}
          onAdd={() => setEditing(true)}
        >
          {error && !editing && <p role="alert">{error}</p>}
          <div className="activity-list">
            {visibleItems
              .filter((item) => item.date === date)
              .sort((a, b) => a.from.localeCompare(b.from))
              .map((item) => (
                <article key={item.id} className="card activity-card">
                  <ActivityIcon kind={item.activity} />
                  <div className="home-activity-body">
                    <h2>{activityLabel(item.activity)}</h2>
                    {item.note && <p>{item.note}</p>}
                    <span className="activity-time-chip">
                      {item.from === item.to
                        ? item.from
                        : `${item.from} – ${item.to}`}{" "}
                      {copy.timeSuffix}
                    </span>
                  </div>
                </article>
              ))}
            {!visibleItems.some((item) => item.date === date) && (
              <p className="center">{copy.noActivities}</p>
            )}
          </div>
        </ActivitySheet>
      </section>
      <SceneLink
        href="/analysis"
        className="home-record-fab"
        aria-label={copy.startAnalysis}
      >
        <img src="/images/analysis/microphone.svg" alt="" />
      </SceneLink>
    </MobileShell>
  );
}
