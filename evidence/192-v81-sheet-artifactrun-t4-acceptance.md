# V8.1 Evidence - sheet ArtifactRun T4 Acceptance

Date: 2026-03-26
Lane: `sheet ArtifactRun parity`
Taxonomy: `T4`
Decision: `accepted bounded lane`

## Acceptance basis

`sheet ArtifactRun parity` is ready for bounded `T4` acceptance because the exact deferred gap is now closed on the
same governed chain already used by the other artifact output types:

1. active chat control can plan `sheet`
2. governed run can be accepted through the same execution path
3. materialization now completes into a canonical `sheet` artifact when an existing governed table target is provided

## Why this is enough

The lane goal was not broad spreadsheet-product completion. The goal was to remove the named split between:

- ArtifactRun planning/types that already knew about `sheet`
- the live chat surface that did not expose it
- and the materialization runtime that still rejected it

That split is now closed without reopening broader table-generation scope.

## Evidence chain

- `evidence/190-v81-sheet-artifactrun-split-brain-map.md`
- `evidence/191-v81-sheet-artifactrun-materialize-parity-seam.md`

## Verification

- `npx vitest run tests/components/AIChat/V8ArtifactRunControl.test.tsx`
- `npx vitest run tests/integration/routes/artifact-runs.routes.sqlite.integration.test.ts -t "sheet run"`
- `npx vitest run tests/integration/services/artifactRegistryService.sqlite.integration.test.ts -t "sheet run"`
