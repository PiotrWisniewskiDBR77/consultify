# V8.1 Notes Adjuncts T3 Acceptance

Date: 2026-03-26
Lane: `Notes` adjuncts
Taxonomy: `T3`
Tranche: `Tranche 3`
Decision: `accepted`

## Acceptance basis

The bounded active `T3` packet for `Notes` adjuncts is accepted as complete.

Accepted closure points:

1. the governed notebook core lane was already established on `/api/v8/my-work/notebook/pages` and remains
   the runtime base for the live notebook surface
2. the visible AI proposal review strip now uses the governed V8-first notebook seam for list/create/resolve
   continuity
3. the visible notebook convert workflow now uses the governed V8-first notebook seam for
   `POST /api/v8/my-work/notebook/pages/:id/convert`
4. frontend fallback behavior for both adjunct slices is now bounded to non-supported statuses instead of
   silently downgrading on transient V8 failures
5. residual upload/attachment breadth was explicitly kept outside this bounded lane and is no longer treated
   as a blocker for `T3` acceptance

## Evidence chain

- `docs/product/work-packets/T3_NOTES_ADJUNCTS_CHARTER.md`
- `evidence/168-v81-notes-adjuncts-split-brain-map.md`
- `evidence/169-v81-notes-ai-proposals-v8-seam.md`
- `evidence/170-v81-notes-convert-v8-seam.md`

## Verification basis

Passed:

- `server/src/routes/v8/__tests__/my-work-notebook.routes.test.ts`
- `tests/unit/services/v8-my-work-api.test.ts`
- `tests/unit/services/api-my-work-notebook-fallback.test.ts`

Verification command:

`npx vitest run server/src/routes/v8/__tests__/my-work-notebook.routes.test.ts tests/unit/services/v8-my-work-api.test.ts tests/unit/services/api-my-work-notebook-fallback.test.ts`

Result: `32` tests passing.

## Residual note

Residual upload/attachment adjunct breadth and any broader notebook lifecycle expansion still remain in the
repository, but they are broader parity work, not absence of a working bounded V8-first notes-adjunct lane
in the current closure program.
