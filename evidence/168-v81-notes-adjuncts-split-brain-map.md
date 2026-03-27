# V8.1 Notes Adjuncts Split-Brain Map

Date: 2026-03-26
Lane: `Notes` adjuncts
Taxonomy: `T3`
Status: `active`

## Why this lane is promotable

`Notes` is no longer a red "missing V8 notebook runtime" area. The notebook core lane is already staging
proven on `/api/v8/my-work/notebook/pages`, but the live notebook surface still mixes that governed core
with legacy adjunct workflows.

## Current split-brain map

1. Governed notebook core lane
   - `server/src/routes/v8/my-work.routes.ts`
   - `src/services/api/v8/my-work.ts`
   - `src/services/api.ts`
   - list/detail/create/update/delete/pin/status now have a bounded V8-first path and staging proof in
     `evidence/97-v8-notes-runtime-core-lane-proof.md`

2. Live notebook surface continuity
   - `src/components/MyWork/NotebookContent.tsx`
   - the visible notebook surface already renders the governed core lane and also exposes an active AI
     proposal review strip driven by `refreshAIProposals()`, `submitNotebookAIProposal()`, and
     `resolveNotebookAIProposal()`

3. Legacy notebook AI proposal side-lane
   - `src/services/api.ts`
   - `server/src/routes/notebook.routes.ts`
   - notebook AI proposal create/list/resolve still route through legacy `/api/notebook/pages/:pageId/ai-proposals`
     and `/api/notebook/ai-proposals/:proposalId/resolve`

4. Adjunct breadth outside the first packet
   - `src/components/MyWork/notebook/NewPageModal.tsx`
   - `src/components/MyWork/notebook/ConvertChecklistModal.tsx`
   - upload / convert breadth remains broader than one bounded packet
   - classify is explicitly not the first packet because the V8 route already exists under
     `/api/v8/my-work/notebook/pages/:id/classify`

## Bounded first packet

Start with `notebook AI proposals governed seam`:

- add one governed V8-first AI proposal continuity slice on the active `NotebookContent` surface
- build on the existing governed notebook namespace instead of the legacy notebook proposal routes
- keep upload / convert breadth and broader notebook adjunct redesign outside this first packet
