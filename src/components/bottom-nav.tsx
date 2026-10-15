import { copy } from "@/content";
import Link from "next/link";
const links = [
  ["/", copy.home, "⌂"],
  ["/development", copy.development, "↗"],
  ["/analysis", copy.analysisMenu, "≋"],
  ["/doctor", copy.doctor, "＋"],
];
export function BottomNav({ active }: { active: string }) {
  return (
    <nav className="bottom-nav" aria-label={copy.navigation}>
      {links.map(([href, label, icon]) => (
        <Link
          key={href}
          href={href}
          aria-current={active === href ? "page" : undefined}
        >
          <span aria-hidden="true">{icon}</span>
          {label}
        </Link>
      ))}
    </nav>
  );
}
