import type { CSSProperties } from "react";
import { Button } from "@/components/button";
// Internal developer reference. This is not part of the product navigation.
const colors = [
  "brand",
  "brand-hover",
  "brand-pressed",
  "brand-soft",
  "text",
  "text-secondary",
  "text-muted",
  "background",
  "surface",
  "border",
  "success",
  "error",
];
export default function DesignSystem() {
  return (
    <main className="ds-page">
      <h1>Crybaby · Design System</h1>
      <p>Nunito · English UI reference</p>
      <section className="ds-section">
        <h2>Colors</h2>
        <div className="ds-grid">
          {colors.map((color) => (
            <div className="ds-swatch" key={color}>
              <div
                className="ds-swatch-color"
                style={{ "--swatch": `var(--color-${color})` } as CSSProperties}
              />
              <p>{color}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="ds-section">
        <h2>Typography</h2>
        <div className="ds-example">
          <h1>Understand your baby’s cry</h1>
          <h2>Understand your baby</h2>
          <p>Main text · Body copy · 0123456789</p>
          <p className="note">Supporting text · Caption</p>
        </div>
      </section>
      <section className="ds-section">
        <h2>Buttons and states</h2>
        <div className="ds-controls">
          <Button variant="primary">Save</Button>
          <Button>Analyze again</Button>
          <Button variant="ghost">Back</Button>
          <Button variant="primary" disabled>
            Save unavailable
          </Button>
        </div>
      </section>
      <section className="ds-section">
        <h2>Forms and cards</h2>
        <div className="ds-example activity-form">
          <label>
            Notes
            <input placeholder="Add details" />
          </label>
          <article className="card">
            <h2>Feeding</h2>
            <p>14:30</p>
          </article>
          <p role="alert">Example error message</p>
        </div>
      </section>
    </main>
  );
}
