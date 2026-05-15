# Work Canvas P1 Persistence Closeout - 2026-05-15

## Verdict

`DONE_PASS`

The Work Canvas A2 persistence P1 is fixed, deployed to staging, and validated with remote Playwright smoke plus manual retest evidence.

## Root Cause

The UI could issue two saves with the same `baseUpdatedAt`:

1. autosave after title edit, with the old markdown body,
2. manual `Save Canvas document`, with the edited markdown body.

The first request succeeded and advanced `updatedAt`. The second request carried the stale `baseUpdatedAt`, received `409 CANVAS_DRAFT_CONFLICT`, and the visible markdown edit was not persisted. This matched the manual A2 symptom: title could survive, but body reverted to the starter template after refresh.

## Fix

- Persist the last opened draft id in `localStorage` and hydrate by draft id before falling back to conversation list.
- On explicit save, read the visible title and markdown textarea values directly, avoiding React state/render races.
- On `409 CANVAS_DRAFT_CONFLICT`, fetch the latest draft metadata and retry the same visible content with the current `updatedAt`.
- Extend Playwright Work Canvas smoke to edit title and markdown body, click save, refresh, and assert read-back.

## Validation

- `ReadLints` on edited Work Canvas files: `PASS`.
- Direct staging API save/read-back for title and content: `PASS`.
- Diagnostic local frontend against staging API:
  - initial autosave `PUT`: `200` with old content,
  - manual save `PUT`: `409`,
  - retry `GET`: `200`,
  - retry `PUT`: `200` with edited content,
  - final API read-back contains marker: `PASS`.
- Playwright local frontend against staging API:
  - `tests/e2e/smoke/work-canvas-core-flow.spec.ts`
  - Result: `2/2 PASS`
  - Covered owner edit title/content -> save -> refresh -> read-back, and member restricted actions disabled.
- Production build:
  - `NODE_OPTIONS=--max-old-space-size=8192 npm run build`
  - Result: `PASS`.
- Staging deployment:
  - Commit: `d0dde8fe6beafb8b7d16a2814c326d1bcb777816`
  - Railway deployment: `eea16c6c-748a-4007-8139-98fc33f0ff60`
  - Result: `SUCCESS`
  - `/api/health.gitSha`: `d0dde8fe6beafb8b7d16a2814c326d1bcb777816`
- Remote Playwright staging smoke:
  - `E2E_API_URL=https://demo.consultify.ai E2E_BASE_URL=https://demo.consultify.ai ... npm run test:e2e -- tests/e2e/smoke/work-canvas-core-flow.spec.ts --project=chromium --workers=1`
  - Result: `2/2 PASS`
- Manual A2 retest:
  - `docs/testing/reports/WORK_CANVAS_A2_PERSISTENCE_RETEST_2026-05-15.md`
  - Result: `PASS`

## Known Validation Limits

- Full repo `tsc --noEmit` still fails on pre-existing unrelated issues in Kimi, Notebook/TipTap, Reports Premium editor extensions, and `ModuleHub`. No failure was reported in the edited Work Canvas files.

## Next Gate

Sprint 1 is closed. Continue to Sprint 2: My Work / Radar / Tasks / Calendar / Notebook.
