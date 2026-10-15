import { Suspense } from "react";
import { ActivityScreen } from "@/features/activities/activity-screen";
export default function Home() {
  return (
    <Suspense fallback={<main className="phone" />}>
      <ActivityScreen />
    </Suspense>
  );
}
