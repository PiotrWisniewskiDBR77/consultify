# V8 Notes Runtime Core Lane Proof

Date: 2026-03-26
Owner: Manager Agent
Environment: `staging`
Service: `consultify`
Deployments:
- `95cabf93-9716-4b14-ad25-4afec591b701` - first notebook V8 bridge deploy
- `8a364cce-8230-4425-817d-1fd55885cd8c` - fallback-guard deploy

## Goal

Move the bounded `Notes` runtime packet off pure red by proving that the canonical notebook core lane on the live `My Work -> Notebook` surface now uses governed V8 runtime paths for list/read-write continuity, and that transient V8 throttling no longer falls back to the legacy notebook create path.

## Local implementation proof

- `server/src/routes/v8/my-work.routes.ts` now exposes bounded notebook core CRUD/state routes under `/api/v8/my-work/notebook/pages`.
- `src/services/api/v8/my-work.ts` now exposes the bounded notebook V8 client (`getNotebookPages`, `getNotebookPage`, `createNotebookPage`, `updateNotebookPage`, `deleteNotebookPage`, `pinNotebookPage`, `setNotebookPageStatus`).
- `src/services/api.ts` now prefers the notebook V8 client and only falls back for non-supported statuses (`400`, `404`, `405`, `501`) instead of falling back on every V8 error.
- Targeted unit proof passed locally:
  - `tests/unit/services/v8-my-work-api.test.ts`
  - `tests/unit/services/api-my-work-notebook-fallback.test.ts`

## Live staging proof

### Fresh read lane after first deploy

Fresh browser navigation to `https://stage.consultinity.ai/my-work/notebook?...` on the new notebook bundle showed:

- `GET /api/v8/my-work/notebook/pages?limit=50` -> `200`
- no legacy `GET /api/my-work/notebook/pages?limit=50` in the same fresh runtime window

This proved the notebook list/read lane had cut over to governed V8 runtime on staging.

### Live write lane before fallback guard

The first live create attempt from `New note -> Blank page` showed:

- `POST /api/v8/my-work/notebook/pages` -> `429`
- followed by legacy fallback `POST /api/my-work/notebook/pages` -> `429`

This proved the V8 lane existed, but the frontend still contained an over-broad fallback that could reopen the legacy path on transient throttling.

### Live write lane after fallback guard deploy

After deploying the notebook fallback guard, a fresh notebook session showed:

- `GET /api/v8/my-work/notebook/pages?limit=50` -> `200`
- `POST /api/v8/my-work/notebook/pages` -> `201`
- no matching legacy `POST /api/my-work/notebook/pages` in the same create window
- immediate refresh on `GET /api/v8/my-work/notebook/pages?limit=50` -> `200`

This proves the bounded notebook core create lane now completes on governed V8 runtime without reopening the legacy notebook create path.

## Remaining gap

`Notes` is not closure-ready yet:

- the live notebook surface still issues legacy adjunct requests such as `GET /api/notebook/pages/:id/ai-proposals` and `POST /api/my-work/notebook/pages/:id/classify`
- upload / convert / AI proposal side-lanes remain outside the bounded closure proof

## Closure impact

`C-02b notes/runtime packet` is no longer a pure `red` "no V8 runtime closure path proven" blocker.

It is now a bounded `yellow` packet:

- notebook core list/create/update continuity is staging-proven on governed V8 paths
- residual work is limited to notebook adjunct/AI side-lanes and broader canonicalization, not the absence of any V8 notebook runtime path
