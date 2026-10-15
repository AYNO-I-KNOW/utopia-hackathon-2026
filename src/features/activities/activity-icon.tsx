import { copy } from "@/content";
/** Activity artwork follows home frame 3:705, independent of metric artwork. */
export function ActivityIcon({ kind }: { kind: string }) {
  const icon =
    kind === "sleep" || kind === copy.sleep
      ? "imgImage21"
      : kind === "feeding" || kind === copy.feeding
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
        src={"/images/development/3-705-" + icon + ".png"}
        alt=""
      />
    </span>
  );
}
