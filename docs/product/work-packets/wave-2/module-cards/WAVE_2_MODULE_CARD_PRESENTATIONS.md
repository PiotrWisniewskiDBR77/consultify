# Wave 2 Module Card — Presentations

> Cluster: `Outputs And Artifact Family`
> Scope: governed durable presentation runtime

## 1. Module scope

This card covers:

- deck generation,
- artifact identity,
- review and delivery semantics,
- export,
- reopen and continued work,
- and presentation-specific runtime maturity inside the artifact family.

## 2. Source of truth reviewed

- `docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`
- `docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_IMPLEMENTATION_PLAN.md`
- `docs/product/REPORTS_AND_PRESENTATIONS_V8_MASTER_SUMMARY.md`
- `docs/product/PREZENTACJE_V8_SSOT.md`
- `docs/product/V8_1_FINAL_100_PERCENT_COMPLETION_PLAN.md`

## 3. Intended product behavior

`Presentations` should be first-class artifacts:

- generated from source context,
- stored durably,
- reviewed before delivery,
- reopened for further work,
- and exported with traceability.

## 4. Current repo and doc truth

Current truth is strong in docs and meaningful in runtime:

- the presentation package is broad and serious,
- artifact runtime closure already recognizes presentation as a first-class artifact type,
- but the final completion plan still treats presentation closure as a specific area where governed creation, reopenability, and review must remain explicit and not only registry-wrapped.

## 5. Competitive standard

The benchmark is:

- Gamma-like AI-first generation,
- Beautiful.ai-like structural quality,
- Pitch-like delivery and presenter maturity,

combined with stronger source traceability than those tools usually provide.

## 6. Current-state assessment

- `User value`: good.
- `Flow completeness`: partial to good.
- `UX quality`: partial. Builder and deck depth are strong; full artifact-family closure still needs work.
- `Data / logic quality`: strong.
- `Integration quality`: strong.
- `Trust / governance`: good.
- `Market standard fit`: partial to good.

## 7. Main gaps

- presentation-specific governance depth is still not perfectly mirrored to document depth,
- final artifact-family reopen and review semantics need stronger packaging,
- delivery/collaboration/presenter depth remains a later closure layer in the summary.

## 8. Minimal acceptance state now

The first acceptable Wave 2 state is:

- governed presentation creation,
- durable artifact identity,
- visible review/export state,
- and real reopenability from canonical surfaces.

## 9. Full 100% target state

`Presentations` reach 100% only when they support:

- governed generation and refresh,
- durable versions,
- review/send-back,
- delivery and presenter semantics,
- export visibility,
- and cross-surface reopen/continue behavior.

## 10. Top missing functions and flows

- create/refresh from context
- reopen and continue working
- review queue and export state
- presentation-specific delivery and presenter flow
- full artifact-family terminology and lifecycle consistency

## 11. Proposed bounded delivery packets

1. `Presentation artifact-family closure`
2. `Presentation reopen and continue`
3. `Presentation review/export/delivery semantics`
4. `Presentation-specific governance depth`

## 12. Risks and dependencies

- depends on `Outputs Library`, `ArtifactRun`, and `Report -> Presentation`,
- risks treating registry presence as equivalent to full durable presentation maturity,
- risks opening a full deck-builder rewrite too early.
