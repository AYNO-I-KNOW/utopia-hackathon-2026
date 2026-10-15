# Change review routine

Before each change: check the active branch and working tree; preserve existing changes. Read the feature and its shared tokens before editing. Keep copy in `src/content/th.ts`; preserve the approved 24px/600 heading and 16px/400 body with normal line height on the analysis capture screen.

Use shared components for repeated layouts and controls. Remove obsolete code instead of stacking overrides. Keep generated files, dependencies and secrets out of Git. Keep service mocks and real device behavior explicit in documentation.

Run `npm run check` after meaningful code changes. Run `npm run build` for route, dependency or structural changes. Review the diff before committing. For UI changes, check the running screen and relevant interaction; report any untested microphone/device behavior rather than treating compilation as acceptance. Never claim production readiness from focused checks.

Current limits: analysis and chat use mock results, doctor/development screens are placeholders, and data is browser-local. Live microphone volume is supported; no audio file is recorded/uploaded. Manual microphone response must be checked on the actual target browser/device. The project has focused unit tests, not full end-to-end or WCAG certification.
