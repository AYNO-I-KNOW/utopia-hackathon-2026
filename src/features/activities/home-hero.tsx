import Link from "next/link";
import { copy } from "@/content";
import { growthCopy as text } from "@/content/development";
export function HomeHero() {
  return (
    <div className="home-hero">
      <img
        className="home-hero-background"
        src="/images/analysis/background.png"
        alt=""
      />
      <div className="home-hero-greeting">
        <img src="/images/development/3-705-imgEllipse6.svg" alt="" />
        <div>
          <h2>{text.greeting}</h2>
          <p>{text.greetingSubtitle}</p>
        </div>
      </div>
      <Link
        href="/development"
        className="home-hero-scene"
        aria-label={copy.viewDevelopment}
      >
        <img
          className="home-hero-baby"
          src="/images/analysis/baby.png"
          alt={copy.cryingBabyAlt}
        />
      </Link>
    </div>
  );
}
