import Link from "next/link";
const links = [
  ["/", "หน้าแรก", "⌂"],
  ["/development", "พัฒนาการลูก", "↗"],
  ["/analysis", "วิเคราะห์แพทเทิร์นเสียง", "≋"],
  ["/doctor", "ปรึกษาคุณหมอ", "＋"],
];
export function BottomNav({ active }: { active: string }) {
  return (
    <nav className="bottom-nav" aria-label="เมนูหลัก">
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
