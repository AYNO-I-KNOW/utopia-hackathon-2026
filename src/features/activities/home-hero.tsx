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
        <Link href="/analysis" aria-label={copy.startAnalysis}>
          <img src="/images/development/3-705-imgGroup.svg" alt="" />
        </Link>
      </div>
      <div className="home-hero-scene">
        <img
          className="home-hero-baby"
          src="/images/analysis/baby.png"
          alt={copy.cryingBabyAlt}
        />
        <img
          className="home-hero-sun"
          src="/images/development/3-705-imgImage29.png"
          alt=""
        />
        <img
          className="home-hero-moon"
          src="/images/development/3-705-imgImage28.png"
          alt=""
        />
        <img
          className="home-hero-bottle"
          src="/images/development/3-705-imgImage27.png"
          alt=""
        />
      </div>
    </div>
  );
}
