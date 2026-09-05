# Day 367 — R3 regression measurement

Date: 2026-09-05

- Selected component suites: 13/13 passed, 0 failed, 0 pending (`RUN_DB_TESTS=0 MOCK_DB=true`, `--retry=0`).
- Full-name delta: 7 tests added, 0 disappeared. The complete lists are in `/private/tmp/cx-day367-kanwa-ai-artefakty/{przed,po}-nazwy.txt`.
- Manual panel regression: `Canvas kebab AI — day 367 keeps the manual selection preview literal and does not call AI` passed.
- Dictionaries: before `pl 35200 / en 33067`; after `pl 35203 / en 33070`.
- Canon gates before and after: focus/list/artefakt `0/0/0`.
- Reachability before and after: exit `1`, unchanged full list: `src/components/Initiatives/__tests__/initiativeKartaRealnyRekord.test.ts`. New day-367 tests live under `tests/**`, so they add no `src/**` test-only entry.
- Per-file esbuild succeeded for `WorkCanvasDocumentPanel.tsx`, `CanvasRichEditor.tsx`, and `CanvasAIFloatingMenu.tsx` with `--bundle --format=esm --outfile=/dev/null`.

The tests are jsdom component tests with a mocked `fetch`. They do not touch a database, authentication middleware, feature gates, SMTP, or a real AI provider. They prove client routing, fallback/error visibility, the 8000-character client guard, and preservation of the manual path; they do not prove provider availability or production HTTP behavior.
