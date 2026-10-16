import "./app-splash.css";

// Pure CSS so it paints with the server HTML, before hydration, and removes itself.
export function AppSplash() {
  return (
    <div className="app-splash" aria-hidden="true">
      <img
        className="app-splash-bottle"
        src="/images/splash/bottle.png"
        alt=""
        width={160}
        height={160}
        fetchPriority="high"
      />
    </div>
  );
}
