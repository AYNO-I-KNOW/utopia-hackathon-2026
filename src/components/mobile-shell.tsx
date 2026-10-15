export function MobileShell({
  children,
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
    </main>
  );
}
