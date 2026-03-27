# V8.1 Idea Workspace Stage Normalization Boundary

Date: 2026-03-26
Lane: `Idea workspace`
Taxonomy: `T1`
Tranche: `Tranche 1`

## What changed

The ideas list boundary now normalizes raw stage values through the shared V5 stage model
before mapping them into the current list/table buckets.

Implemented through:

- `normalizeStageToV5()`
- `bucketIdeaStageForList()`

## Why this matters

Previously, the live ideas list carried a second local stage mapper that drifted from the
workspace V5 stage model.

This packet keeps the current UI buckets stable while removing the duplicated
normalization authority.

## Verification

Passed:

- `tests/components/MyWork/ideaEntryTypes.test.ts`
