# V8.1 Evidence - sheet ArtifactRun Split-Brain Map

Date: 2026-03-26
Lane: `sheet ArtifactRun parity`
Taxonomy: `T4`
Status: `active`

## Why this lane is promoted now

`sheet` chat-driven `ArtifactRun` materialization was explicitly deferred in the closure ledger and post-closure
program. After explicit unlock, the lane should close that named gap directly rather than expand into broader
spreadsheet-product work.

## Canonical product scope

Current artifact-runtime truth already includes:

- canonical registry identity for `sheet`
- governed table-platform registration/open/export continuity
- sheet visibility inside Outputs Library and My Work

The remaining gap was narrower:

- `sheet` exists in ArtifactRun planning/types
- but chat control did not offer `sheet`
- and `materializeArtifactRun()` rejected `sheet` even when the rest of the governed run chain existed

## Surface truth before promotion

The active chat surface already exposes governed artifact planning through:

- `src/components/AIChat/V8ArtifactRunControl.tsx`
- `src/components/AIChat/UnifiedChatPanel.tsx`

The canonical runtime already exposes:

- `src/services/api/artifactRuns.ts`
- `server/src/routes/artifact-runs.routes.ts`
- `server/src/services/v8/artifactRegistryService.ts`

but the live surface/runtime pair was split:

1. client types allowed `sheet`
2. server planning inferred `sheet`
3. chat UI only offered `document` and `presentation`
4. server materialization only completed `report` and `presentation`

## Bounded first packet

Packet 1 is narrowed to:

1. expose `sheet` planning on the live chat control
2. allow `sheet` runs to materialize against an existing governed table target
3. complete the run into the canonical artifact registry through the existing sheet artifact substrate
4. add bounded regression coverage

## Explicitly not this packet

- generating brand-new spreadsheets from chat without an existing governed table target
- broader table-platform authoring UX
- cloud publishing breadth
- broader object-linked output propagation
- unrelated `T4` backlog like `Mobile`, `Landing`, or `Edukacja`

## Why this is the right slice

This is the smallest real parity cut because it closes the exact deferred `ArtifactRun` gap while reusing the
already-accepted governed sheet substrate instead of inventing a second runtime.
