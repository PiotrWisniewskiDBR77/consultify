# V8.1 Idea Workspace Artifact Deep-Link Parity

Date: 2026-03-26
Lane: `Idea workspace`
Taxonomy: `T1`
Tranche: `Tranche 1`

## What changed

`RouterSync` now treats `artifact=idea:<id>` the same way it already treated
`task` and `decision` artifacts:

- sets canonical My Work intent
- routes to `/my-work?ideaId=<id>`
- opens the `ideas` tab through the existing intent bridge

## Why this matters

Before this packet, the artifact identity contract already recognized `idea`, but the
deep-link bridge ignored it. That meant the canonical artifact link grammar and the
live My Work navigation behavior were out of sync.

This packet removes that asymmetry without widening scope into notebook or collaboration
runtime work.

## Verification

Passed:

- `tests/components/RouterSync.idea-artifact.test.tsx`
