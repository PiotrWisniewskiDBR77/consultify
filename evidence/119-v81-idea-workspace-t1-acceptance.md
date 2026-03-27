# V8.1 Idea Workspace T1 Acceptance

Date: 2026-03-26
Lane: `Idea workspace`
Taxonomy: `T1`
Tranche: `Tranche 1`
Decision: `accepted`

## Acceptance basis

The active `T1` split-brain packet for `Idea workspace` is accepted as complete.

Accepted closure points:

1. canonical `artifact=idea:*` deep links now open the My Work ideas lane through the
   shared intent bridge
2. notebook classify follows the V8-first notebook page contract with guarded fallback
3. idea list/table stage handling flows through shared V5 normalization before current UI
   bucketing
4. live notebook upload follows the shared capture seam
5. remaining live notebook consumers use shared notebook client seams
6. the deprecated standalone `IdeasMindMap` surface is neutralized into a canonical redirect
7. inbox fallback no longer silently mixes truth on transient V8 failures

## Evidence chain

- `evidence/111-v81-idea-workspace-split-brain-map.md`
- `evidence/112-v81-idea-workspace-artifact-deeplink-parity.md`
- `evidence/114-v81-idea-workspace-notebook-classify-v8-contract.md`
- `evidence/115-v81-idea-workspace-stage-normalization-boundary.md`
- `evidence/116-v81-idea-workspace-notebook-upload-capture-seam.md`
- `evidence/117-v81-idea-workspace-notebook-consumer-client-seams.md`
- `evidence/118-v81-idea-workspace-residual-authority-cleanup.md`

## Verification basis

Passed:

- `tests/components/MyWork/IdeasMindMap.redirect.test.tsx`
- `tests/components/MyWork/ideaEntryTypes.test.ts`
- `tests/unit/services/api-my-work-inbox-fallback.test.ts`
- `tests/unit/services/api-my-work-notebook-fallback.test.ts`
- `tests/unit/services/v8-my-work-api.test.ts`
- `server/src/routes/v8/__tests__/my-work-notebook.routes.test.ts`

## Residual note

Legacy routes and compatibility shims still exist in the repository, but they no longer
represent unresolved live split-brain authority for the bounded `T1` Idea workspace lane.
