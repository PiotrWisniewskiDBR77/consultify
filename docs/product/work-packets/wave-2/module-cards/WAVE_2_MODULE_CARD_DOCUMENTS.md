# Wave 2 Module Card — Documents

> Cluster: `Outputs And Artifact Family`
> Scope: governed durable document runtime

## 1. Module scope

This card covers:

- document artifact creation,
- opening and continuation,
- versioning,
- review,
- export,
- and traceable document lifecycle on the shared artifact substrate.

## 2. Source of truth reviewed

- `docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`
- `docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_IMPLEMENTATION_PLAN.md`
- `docs/product/REPORTS_AND_PRESENTATIONS_V8_MASTER_SUMMARY.md`
- `docs/product/REPORT_GENERATOR_V3.md`
- `docs/product/V8_1_FINAL_100_PERCENT_COMPLETION_PLAN.md`

## 3. Intended product behavior

`Documents` should behave as first-class durable artifacts:

- created from context,
- landed in Outputs Library,
- reviewable,
- reopenable,
- traceable to sources and runs,
- and exportable without losing lineage.

## 4. Current repo and doc truth

Current truth is relatively strong:

- documents are one of the strongest format runtimes,
- the artifact program already uses document/report runtime as a mature foundation,
- but Wave 2 still needs to package documents as one fully explicit artifact-family member, not only as legacy report strength.

## 5. Competitive standard

The benchmark is AI-first document generation plus serious document lifecycle:

- strong first draft,
- traceability,
- reviewability,
- and durable reopen/edit behavior.

## 6. Current-state assessment

- `User value`: good.
- `Flow completeness`: partial to good.
- `UX quality`: partial. Runtime is stronger than final family framing.
- `Data / logic quality`: strong.
- `Integration quality`: strong.
- `Trust / governance`: strong.
- `Market standard fit`: partial to good.

## 7. Main gaps

- document runtime still inherits report-language and historical assumptions,
- family-wide reopen/review/export semantics need clearer final closure,
- document behavior must be clearly artifact-native, not export-first.

## 8. Minimal acceptance state now

The first acceptable Wave 2 state is:

- governed document creation from context,
- durable artifact identity,
- Library and My Work visibility,
- and real reopen/review/export behavior.

## 9. Full 100% target state

`Documents` reach 100% only when they support:

- full governed create and refresh,
- durable versions,
- review and send-back loop,
- export traceability,
- source inspection,
- and continued work from library, My Work, and linked objects.

## 10. Top missing functions and flows

- create from context and chat
- reopen and continue
- version/review/export visibility
- source/run traceability
- family-level semantics instead of report-only assumptions

## 11. Proposed bounded delivery packets

1. `Document artifact-family closure`
2. `Document reopen and continue`
3. `Document review and export semantics`
4. `Document family-copy and terminology cleanup`

## 12. Risks and dependencies

- depends on `Outputs Library`, `ArtifactRun`, and `Provenance / review / visibility`,
- risks assuming report maturity already equals full document-product maturity,
- risks overusing legacy report language in the new artifact family.
