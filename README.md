# Crybaby

Mobile-first low-fidelity prototype for AYNO · Utopia Hackathon 2026.

## Start

Node.js 24 LTS (`nvm use`), npm, then:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:4175. Refresh always opens the activity home screen at `/`.

```sh
npm run typecheck
npm test
npm run build
npm start
```

## Structure

```text
src/
  app/                  Next.js App Router, layouts, routes, global wireframe CSS
    page.tsx            / — activity home
    analysis/           /analysis — recording, result, chat
    development/        /development — placeholder
    doctor/             /doctor — placeholder
  components/           Shared mobile shell and bottom navigation
  features/
    activities/         Timeline, entry form, Activity type and storage adapter
    analysis/           Analysis flow and isolated mock result
    chat/               Chat UI with simulated replies
  lib/                  Shared Bangkok date/time helpers and boundary tests
docs/
  ARCHITECTURE.md        Implementation boundaries and next steps
  wireframe/index.html  Preserved HTML reference before React migration
```

## Current scope

Next.js + React + strict TypeScript. No UI framework or external font dependency. Home → activity entry and analysis → recording → loading → result → chat / activity entry are interactive. Bottom navigation uses real routes. Existing `baby-activities` browser data is reused.

Audio waveform, analysis, and chat replies are simulated. Microphone capture, backend, authentication, doctor consultation, and development tracking are not implemented. Activity entries live only in this browser's localStorage. Do not describe this prototype as a health assessment.

## Working conventions

Keep route files thin; put feature logic under `features/<feature>`. Reuse `components` only for genuinely shared UI. Put external-service calls behind feature adapters. Use Bangkok dates for activity defaults. Keep UI copy concise and layouts mobile only. Never commit credentials or `.env` files. Run the commands above before handing changes to the team.
