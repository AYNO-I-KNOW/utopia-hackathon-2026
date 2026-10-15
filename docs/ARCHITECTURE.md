# Developer handoff

## Routes and ownership

- `/`: activity calendar and timeline. `?add=1` opens activity entry after an analysis result. The plus button opens the same form directly.
- `/analysis`: client-side flow state scoped to recording/result/chat. Navigation away cleans up the recording timer and loading timeout.
- `/development`, `/doctor`: deliberately empty feature entry points.

`app` is the routing boundary. Feature components own interaction state; shared components own the mobile frame and navigation. React handles rendering; the old standalone HTML is an archived visual reference, not an iframe or runtime dependency.

## Persistence

`features/activities/storage.ts` owns the `Activity` contract, validation of browser data, and localStorage IO. Existing HTML entries are read with IDs normalized to strings. Read failures and write failures surface in the UI. A failed write does not close the form. Replace this adapter when the backend contract is agreed; do not put database calls in the calendar rendering loop.

Dates use Asia/Bangkok. Each activity currently has one date, a start time, and an end time; equal times represent a single event. Cross-midnight duration semantics remain a product decision before implementing duration reporting.

## Mock boundaries

`analysis/mock.ts` provides the fixed example result. Recording currently measures elapsed wall time and renders an animated sample waveform; it does not request microphone permission or capture audio. Chat demonstrates left/right messages and local sends, not real AI. No invented medical backend, API endpoint, authentication, or scheduling service is included.

## Suggested next work

1. Agree Activity and analysis API contracts with the backend team.
2. Add microphone permission, cancellation, recorder cleanup, and actual audio input behind a recording hook.
3. Replace analysis and chat mocks with service adapters and explicit loading/error states.
4. Design development and consultation flows before adding implementation.
5. Add browser interaction checks for activity persistence, date switching, recording cancellation, and chat sends.

## Validation

`npm run typecheck`, `npm test`, and `npm run build`. The date tests cover Bangkok midnight and timer minute/hour rollover. Browser QA should confirm the mobile layout and real navigation after UI changes; compilation alone does not establish UI acceptance.
