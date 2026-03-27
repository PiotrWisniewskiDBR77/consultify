# T4 Charter - sheet ArtifactRun parity

Date: 2026-03-26
Lane: `sheet ArtifactRun parity`
Taxonomy: `T4`
Tranche: `Parking lot`
Status: `done`

## Why now

`sheet` chat-driven `ArtifactRun` materialization was previously an explicit `T4` deferral. After explicit unlock,
the smallest honest slice is to close the exact deferred gap instead of broadening into full spreadsheet-generation
product work.

## Goal

Promote one bounded sheet artifact-runtime slice that removes mixed truth across:

1. governed chat output planning for `sheet`
2. governed `ArtifactRun` materialization for `sheet`
3. the already-existing governed table-registration/export artifact substrate

## In scope

1. one bounded `sheet ArtifactRun` packet only
2. split-brain map for frontend surface, runtime contract, and prior evidence
3. end-to-end `plan -> accept -> materialize` continuity for `sheet`
4. tracker/program/ledger/evidence updates after closure

## Explicitly out of scope

1. new spreadsheet generation runtime beyond linking to an existing governed table target
2. broader table-platform authoring UX
3. cloud publishing parity
4. broader object-linked output propagation
5. `Mobile`, `Landing`, or standalone `Edukacja`

## Initial bounded packet

Packet 1:

- allow `V8ArtifactRunControl` to plan `sheet` outputs from chat
- let `materializeArtifactRun()` complete `sheet` runs against an existing governed table target via the canonical
  sheet artifact registration path
- add bounded regression for the new `sheet` plan/materialize continuity

Why this first:

- it closes the exact deferred gap already named in the closure docs
- it reuses the governed table artifact substrate already accepted for registry/open/export
- it does not pretend to solve full spreadsheet creation breadth

Recorded in:

- `evidence/190-v81-sheet-artifactrun-split-brain-map.md`

## Packet 1

Completed:

- add `sheet` as a first-class output option in `V8ArtifactRunControl`
- add bounded target input for existing governed table IDs on the active chat control
- extend `materializeArtifactRun()` so `sheet` runs can complete into the canonical artifact registry through
  `registerGovernedTableSheetArtifact()`
- align `sheet` planning visibility with the governed sheet artifact substrate
- add bounded component and integration regressions for the `sheet` materialize path

Recorded in:

- `evidence/191-v81-sheet-artifactrun-materialize-parity-seam.md`

## Acceptance decision

`sheet ArtifactRun parity` is accepted as a bounded `T4` lane.

Why:

- the exact deferred gap is now closed on the active chat planning surface
- `sheet` now has a governed `plan -> accept -> materialize -> completed artifact` path
- the closure reuses the canonical sheet registry substrate without reopening broader spreadsheet-runtime scope

Recorded in:

- `evidence/192-v81-sheet-artifactrun-t4-acceptance.md`

## Next bounded candidate

1. none inside the accepted bounded `sheet ArtifactRun parity` lane
2. keep broader spreadsheet-generation and publishing expansion out of scope unless explicitly rechartered
