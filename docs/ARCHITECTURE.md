# Developer handoff

## Routes and ownership

- `/`: activity calendar and timeline. `?add=1` opens activity entry after an analysis result. The plus button opens the same form directly.
- `/analysis`: client-side flow state scoped to recording/result/chat. Navigation away cleans up the recording timer and loading timeout.
- `/development`, `/doctor`: deliberately empty feature entry points.

`app` is the routing boundary. Feature components own interaction state; shared components own the mobile frame and navigation. React handles rendering; the old standalone HTML is an archived visual reference, not an iframe or runtime dependency.

## Persistence

`features/activities/storage.ts` owns the `Activity` contract, validation of browser data, and localStorage IO. Existing HTML entries are read with IDs normalized to strings. Read failures and write failures surface in the UI. A failed write does not close the form. Replace this adapter when the backend contract is agreed; do not put database calls in the calendar rendering loop.

Dates use Asia/Bangkok. Each activity currently has one date, a start time, and an end time; equal times represent a single event. Cross-midnight duration semantics remain a product decision before implementing duration reporting.

## Backend integration

`analysis/api.ts` calls the FastAPI backend at `NEXT_PUBLIC_API_BASE_URL` (see `.env.example`; unset shows an explicit error state, never a mock). `/analyze` receives the MediaRecorder blob (3–10 s, same mic stream as the waveform) or an uploaded file (≤ 5 MB) plus `context` from `activities/context.ts` (saved entries only). Results render by `case`; `close` offers tap-to-answer questions that re-POST the same blob. `/speak` plays the summary and hides when the backend returns 503. Chat embeds `https://u.bot/` and offers a copy-and-open handoff built from the result and the last 24 h of activities; it falls back to handoff-only if the iframe does not load. Audio is never persisted client-side.

## Suggested next work

1. Agree Activity and analysis API contracts with the backend team.
2. Add microphone permission, cancellation, recorder cleanup, and actual audio input behind a recording hook.
3. Replace analysis and chat mocks with service adapters and explicit loading/error states.
4. Design development and consultation flows before adding implementation.
5. Add browser interaction checks for activity persistence, date switching, recording cancellation, and chat sends.

## Validation

`npm run typecheck`, `npm test`, and `npm run build`. The date tests cover Bangkok midnight and timer minute/hour rollover. Browser QA should confirm the mobile layout and real navigation after UI changes; compilation alone does not establish UI acceptance.

## Development flow (Figma references)

Home hero: 3:705. Overview: 3:582. Details: weight 3:430, height 3:506, sleep 3:260, feeding 3:345. Existing home calendar is available under history; local activities are preserved. Navigation and device status decorations remain excluded per the approved web direction.

`features/development` owns metric definitions, shared icon/chart/form components, local `crybaby-growth` entries, and period selection. `content/development.ts` is the Thai copy source for this feature. Detail routes use `[metric]` with validated static parameters. Data has no backend.

When no saved metric exists, Figma example cards/charts are labeled as examples. As soon as that metric is recorded, its header and plot use the real local entries for the selected time range; no example points or comparison norms are mixed into recorded data. Recommendations remain prototype copy. No clinical normal-range or growth diagnosis is implemented. Source graph labels/units had inconsistencies; labels follow the selected metric rather than repeating sleep labels on weight/feeding screens.

Use `npm run check` and `npm run build`. The period-boundary test ensures that actual saved series exclude other metrics and demo values. Manual browser checks should include home entry, all metric routes, period tabs, form validation and back navigation. Preserve explicit sample labels for release until real data is available.
