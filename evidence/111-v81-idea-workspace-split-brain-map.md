# V8.1 Idea Workspace Split-Brain Map

Date: 2026-03-26
Lane: `Idea workspace`
Taxonomy: `T1`
Tranche: `Tranche 1`
Status: `active`

## Current live surface

The live idea workspace is centered on:

- `src/components/MyWork/MyWorkHub.tsx`
- `src/components/MyWork/MyIdeasListContent.tsx`
- `src/components/MyWork/IdeaMapWorkspace.tsx`

This is the active user-facing route family behind `/my-work/*`.

## Split-brain findings

1. Idea deep-link routing was asymmetric:
   - `RouterSync` bridged `artifact=task:*` and `artifact=decision:*`
   - `artifact=idea:*` existed in the shared artifact type contract but was not routed into
     the canonical My Work intent flow

2. Notebook runtime remains mixed:
   - legacy `/api/my-work/notebook/*`
   - V8 `/api/v8/my-work/notebook/*`
   - rich notebook features under `/api/notebook/*`

3. Inbox runtime remains mixed:
   - `V8MyWorkApi` canonical calls
   - explicit fallback into legacy `Api` paths in `InboxContent`

4. Idea stage vocabulary is split between:
   - legacy `IdeaStage` in ideas list/table
   - V5 normalization in `ideaEntryTypes.ts`

5. Historical parallel ideas surface exists:
   - `src/components/MyWork/IdeasMindMap.tsx` is not part of the live route authority

## Smallest clean starting packet

Chosen packet:

- canonicalize `artifact=idea:*` deep links into the same My Work intent bridge already
  used by task/decision artifacts

Why this packet:

- smallest user-visible split-brain cut
- no scope growth into notebook/runtime rewiring
- aligns artifact identity contract with actual navigation behavior

## Follow-up candidates after this packet

- notebook single-client closure for page/classify happy path
- idea stage normalization at list boundary
- explicit review of residual unused idea surfaces
