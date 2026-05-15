# Work Canvas P1 Persistence Closeout - 2026-05-15

## Verdict

`FIX_READY_DEPLOY_PENDING`

The Work Canvas A2 persistence P1 is fixed locally and validated against the staging API. Staging still needs the commit deployed, followed by the manual A2 retest before this can become `DONE_PASS`.

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

## Known Validation Limits

- Full repo `tsc --noEmit` still fails on pre-existing unrelated issues in Kimi, Notebook/TipTap, Reports Premium editor extensions, and `ModuleHub`. No failure was reported in the edited Work Canvas files.
- Remote `demo.consultify.ai` UI still fails until this local fix is committed, pushed, and deployed.

## Next Gate

1. Commit and push the fix to the staging branch.
2. Verify Railway deployment reaches `SUCCESS`.
3. Run remote Work Canvas smoke against `https://demo.consultify.ai`.
4. Run manual AnyGravity A2 retest.
5. Update this verdict to `DONE_PASS` only after staging read-back passes.
