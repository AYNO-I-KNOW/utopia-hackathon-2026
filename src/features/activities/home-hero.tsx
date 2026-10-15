import { CryingBaby } from "@/components/crying-baby";
import { SceneLink } from "@/components/scene-navigation";
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
      <SceneLink
        href="/development"
        className="home-hero-scene"
        aria-label={copy.viewDevelopment}
      >
        <span className="home-hero-ground" aria-hidden="true" />
        <CryingBaby className="home-hero-baby" alt={copy.cryingBabyAlt} />
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
      </SceneLink>
    </div>
  );
}
