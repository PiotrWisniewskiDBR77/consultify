# V8.1 Idea Workspace Residual Authority Cleanup

Date: 2026-03-26
Lane: `Idea workspace`
Taxonomy: `T1`
Tranche: `Tranche 1`

## What changed

Two final residual split-brain points were cleaned up:

1. `IdeasMindMap.tsx` was turned into a deprecated redirect shim to the canonical
   `/my-work/ideas` lane instead of remaining as a parallel standalone ideas surface.
2. Inbox V8 fallback policy was bounded so transient V8 failures no longer silently
   downgrade to legacy inbox reads/materialization.

## Why this matters

This packet removes the remaining ambiguity around:

- whether a second ideas surface still exists in practice
- whether live inbox reads can silently mix truth on transient failures

After this packet, the remaining legacy inbox and ideas residues are compatibility
artifacts, not competing live authorities.

## Verification

Passed:

- `tests/components/MyWork/IdeasMindMap.redirect.test.tsx`
- `tests/unit/services/api-my-work-inbox-fallback.test.ts`
