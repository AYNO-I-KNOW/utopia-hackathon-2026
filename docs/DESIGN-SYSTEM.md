# Crybaby Design System

## Source of truth

- `src/design-system/tokens.css`: semantic color, typography, space, radius, interaction and viewport tokens.
- `src/design-system/components.css`: shared component contracts.
- `src/components/button.tsx`: primary, secondary and ghost button variants; native disabled and focus behavior.
- `/design-system`: internal reference page with live swatches, font specimens, controls and states. No entry in product navigation.
- `src/app/globals.css`: screen layout and application of tokens. Feature geometry from Figma remains local; do not turn illustration coordinates into general spacing tokens.

## Typography

Nunito Variable is mandatory for Latin text and digits across the entire app. Noto Sans Thai Variable supplies Thai glyphs while Thai copy is being reviewed; Nunito itself does not contain Thai glyphs. Both fonts are bundled through Fontsource, served locally, and carry their OFL license files in the installed packages. There are no Google Fonts runtime requests. Do not introduce Arial, LINE Seed or per-screen font families.

Type scale: 12 / 14 / 16 / 18 / 20 / 24 / 28px. Weights: 400 / 600 / 700. Body line height: 1.6; headings: 1.4. Figma analysis typography scales with the mobile container via dedicated typography tokens.

## Color and controls

Primary: `--color-brand` (#776dfd), with dedicated hover/pressed tokens. Background: #eaf0fd. Surface: white. Text: #1c1d21; secondary: #4f5170. Use semantic roles rather than new literal hex values. Status colors are reserved for real success/error states; confidence is not a medical certainty signal.

Minimum control height is 48px. Keyboard focus is visible. Disabled controls cannot submit. Motion respects reduced-motion preferences. The microphone is a specialized action and keeps its Figma asset, geometry and visual treatment.

## Thai first, English release

All product UI strings, including aria labels, placeholder text, weekdays and mock replies, live in `src/content/th.ts`. Refine Thai there first; do not embed copy in JSX. `src/content/index.ts` exports the active dictionary and `activeLocale` used by the root HTML language.

After Thai approval, add `src/content/en.ts` using `satisfies CopyDictionary`, translate every key, and switch `copy` plus `activeLocale` centrally to English. Do not add an in-product language selector for an English-only release. The internal design-system reference is developer documentation, not release copy.

Activities are stored using stable identifiers (feeding, diaper, sleep, play, comfort, other), independent of translated labels. Existing Thai-label entries remain readable through the legacy label mapping. User-written notes are user content and must not be automatically translated. Keep ISO dates and HH:mm storage separate from localized display formatting.

## Scope

These foundations apply to every implemented screen. Development and consultation remain placeholders; analysis and chat remain mocks. This is a code design system, not a generated Figma component library. Native-looking status-bar and home-indicator decorations from Figma are intentionally excluded from the website.

## Layout rhythm and accessibility targets

Use an 8px base grid (8, 16, 24, 32, 40, 48). 4px is a fine adjustment, not the main section spacing. Page gutters are 24px, reduced to 16px below 360px viewport width. Analysis screen top inset is 16px, bottom inset is 24px; both honor device safe-area insets. Section gaps are 24px; related elements use 8–16px. Back controls have a 48×48px hit area; primary microphone is 160×160px. The page uses normal document/flex flow and vertical scrolling rather than percentage-positioned text, to avoid overlap when text grows or English copy wraps.

WCAG does not prescribe these margin values or an 8px grid. These are Crybaby's layout choices. WCAG 2.2 AA targets include 4.5:1 contrast for normal text, 24×24px minimum targets (with specified exceptions), 200% text resizing and reflow at 320 CSS px. Our control baseline is the larger 48px. Text buttons use the darker action-purple token; the Figma purple remains on the image microphone. Do not claim full WCAG conformance from this focused layout review.

Reference: https://www.w3.org/TR/WCAG22/
