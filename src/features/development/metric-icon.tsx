import { metrics, type MetricId } from "./data";
export function MetricIcon({ metric }: { metric: MetricId }) {
  const item = metrics[metric];
  return (
    <span className="growth-icon">
      <img
        className="growth-icon-bg"
        src={"/images/development/" + item.background}
        alt=""
      />
      <img
        className="growth-icon-image"
        src={"/images/development/" + item.icon}
        alt=""
      />
    </span>
  );
}
