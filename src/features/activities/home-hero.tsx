import { growthCopy as text } from "@/content/development";

export function HomeHero() {
  return (
    <header className="home-hero">
      <div className="home-hero-greeting">
        <div>
          <h2>{text.greeting}</h2>
          <p>{text.greetingSubtitle}</p>
        </div>
      </div>
    </header>
  );
}
