import { BottomNav } from "./bottom-nav";
export function MobileShell({
  children,
  active,
  title,
}: {
  children: React.ReactNode;
  active?: string;
  title?: string;
}) {
  return (
    <main className="phone">
      {title && (
        <header className="top">
          <b>{title}</b>
        </header>
      )}
      {children}
      {active && <BottomNav active={active} />}
    </main>
  );
}
