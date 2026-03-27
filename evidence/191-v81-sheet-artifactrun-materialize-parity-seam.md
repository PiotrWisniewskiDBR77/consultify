# V8.1 Evidence - sheet ArtifactRun Materialize Parity Seam

Date: 2026-03-26
Lane: `sheet ArtifactRun parity`
Taxonomy: `T4`
Packet: `Packet 1`

## Goal

Close the named `sheet ArtifactRun` deferral by letting the active chat control plan `sheet` outputs and by letting
the governed ArtifactRun runtime complete those runs into the canonical sheet artifact substrate.

## What changed

1. `src/components/AIChat/V8ArtifactRunControl.tsx`
   - adds `sheet` to the governed output selector
   - adds a bounded `Governed table ID` input for the existing-table target path
   - forwards `config.tableId` when materializing `sheet`
2. `server/src/services/v8/artifactRegistryService.ts`
   - aligns `sheet` planning visibility to `organization`
   - allows `materializeArtifactRun()` to complete `sheet` runs
   - registers the completed sheet via `registerGovernedTableSheetArtifact()`
3. regression coverage
   - `tests/components/AIChat/V8ArtifactRunControl.test.tsx`
   - `tests/integration/routes/artifact-runs.routes.sqlite.integration.test.ts`
   - `tests/integration/services/artifactRegistryService.sqlite.integration.test.ts`

## Why it matters

Before this packet, `sheet` existed in type/planning truth but not in active-surface truth or materialization truth.
After this packet, the bounded governed chain is coherent:

`chat plan -> accept plan -> materialize(sheet, tableId) -> completed canonical artifact`

## Verification

- `npx vitest run tests/components/AIChat/V8ArtifactRunControl.test.tsx`
- `npx vitest run tests/integration/routes/artifact-runs.routes.sqlite.integration.test.ts -t "sheet run"`
- `npx vitest run tests/integration/services/artifactRegistryService.sqlite.integration.test.ts -t "sheet run"`
