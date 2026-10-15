import { notFound } from "next/navigation";
import { DevelopmentScreen } from "@/features/development/development-screen";
import { isMetric, metricIds } from "@/features/development/data";
export function generateStaticParams() {
  return metricIds.map((metric) => ({ metric }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ metric: string }>;
}) {
  const { metric } = await params;
  if (!isMetric(metric)) notFound();
  return <DevelopmentScreen metric={metric} />;
}
