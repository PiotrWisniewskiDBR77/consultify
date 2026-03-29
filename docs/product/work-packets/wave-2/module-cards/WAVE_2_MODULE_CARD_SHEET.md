# Wave 2 Module Card — Sheet

> Cluster: `Outputs And Artifact Family`
> Scope: third governed artifact class and minimal workbook path

## 1. Module scope

This card covers:

- `sheet` as a first-class artifact type,
- planning and generation,
- canonical persistence,
- listing and opening,
- export,
- and honest reopen/continue behavior.

## 2. Source of truth reviewed

- `docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`
- `docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_IMPLEMENTATION_PLAN.md`
- `docs/product/V8_1_WAVE2_IMPLEMENTATION_START_PACKET.md`
- `docs/product/V8_1_FINAL_100_PERCENT_COMPLETION_PLAN.md`
- `docs/product/REPORTS_AND_PRESENTATIONS_V8_MASTER_SUMMARY.md`

## 3. Intended product behavior

`Sheet` should become the third artifact class:

- created from context,
- stored with canonical identity,
- visible in Outputs Library and My Work,
- reopenable honestly,
- and exportable without being a dead placeholder.

## 4. Current repo and doc truth

Current truth is explicitly incomplete:

- planning already allows `sheet`,
- bounded sheet substrate closure was accepted,
- but the Wave 2 packet and final closure plan both say `sheet` is not yet a full governed end-to-end path,
- and the scope explicitly avoids pretending this is already a spreadsheet suite.

## 5. Competitive standard

The benchmark is not full Excel parity.
The benchmark is:

- real artifact identity,
- durable workbook path,
- honest reopenability,
- and minimal governed usefulness.

## 6. Current-state assessment

- `User value`: partial.
- `Flow completeness`: low to partial.
- `UX quality`: low to partial.
- `Data / logic quality`: partial. Foundations exist.
- `Integration quality`: partial. Visibility exists more than full runtime.
- `Trust / governance`: partial. Honesty is explicitly required.
- `Market standard fit`: low. This is the thinnest artifact type today.

## 7. Main gaps

- full governed generation/materialization path,
- canonical persistence and listing semantics,
- honest reopen behavior,
- no dead placeholder `sheet` type,
- no accidental overclaim of spreadsheet-grade maturity.

## 8. Minimal acceptance state now

The first acceptable Wave 2 state is:

- one real governed sheet path,
- canonical registry listing,
- one open/export path,
- and honest empty or limited states where authoring is not yet deep.

## 9. Full 100% target state

`Sheet` reaches 100% only when it supports:

- governed planning and create/refresh,
- canonical storage and identity,
- listing in library and My Work,
- reopen or continue behavior,
- export traceability,
- and enough live workbook semantics to avoid the export-only trap.

## 10. Top missing functions and flows

- chat/context to planned sheet
- sheet materialization
- registry/list/open/export path
- honest reopen and continue
- clarity of what is workbook-native vs export-only

## 11. Proposed bounded delivery packets

1. `Sheet contract alignment`
2. `Sheet governed runtime`
3. `Sheet library and My Work closure`
4. `Sheet reopen and honesty closure`

## 12. Risks and dependencies

- depends on `ArtifactRun`, `Outputs Library`, and existing table/export foundations,
- risks calling export-only behavior a completed sheet runtime,
- risks opening a hidden spreadsheet platform program too early.
