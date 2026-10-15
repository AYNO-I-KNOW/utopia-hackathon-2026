import { copy } from "@/content";
import { th } from "@/content/th";
/** Activity artwork follows home frame 3:705, independent of metric artwork. */
export function ActivityIcon({ kind }: { kind: string }) {
  const icon = ["sleepy", "awake", "sleep", copy.sleep, th.sleep].includes(kind)
    ? "imgImage21"
    : ["hungry", "feeding", copy.feeding, th.feeding].includes(kind)
      ? "imgImage25"
      : "imgImage24";
  return (
    <span className="growth-icon">
      <img
        className="growth-icon-bg"
        src="/images/development/3-705-imgGroup1.svg"
        alt=""
      />
      <img
        className="growth-icon-image"
        src={
          ["uncomfortable", "wantsHolding", "diaper"].includes(kind)
            ? "/images/result/care.png"
            : "/images/development/3-705-" + icon + ".png"
        }
        alt=""
      />
    </span>
  );
}
