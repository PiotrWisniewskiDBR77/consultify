# Wave 2 Module Card — Report -> Presentation

> Cluster: `Outputs And Artifact Family`
> Scope: cross-format promotion from report/document truth into presentation artifacts

## 1. Module scope

This card covers:

- promotion from report/document artifacts into presentation artifacts,
- shared provenance,
- deterministic handoff,
- and reuse of existing source structure in deck creation.

## 2. Source of truth reviewed

- `docs/product/REPORT_TO_PRESENTATION_PROMOTION_AND_CONVERSION_RUNTIME_V8.md`
- `docs/product/REPORTS_AND_PRESENTATIONS_V8_MASTER_SUMMARY.md`
- `docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`
- `docs/product/V8_1_FINAL_100_PERCENT_COMPLETION_PLAN.md`

## 3. Intended product behavior

The user should be able to:

- take a report/document insight artifact,
- promote it into a presentation path,
- preserve traceability and review context,
- and continue deck work without losing the source relationship.

## 4. Current repo and doc truth

Current truth is conceptually strong:

- the output family docs already define promotion and conversion,
- but the broad product list still treats this as its own open area,
- so it needs an explicit execution-grade module card instead of staying an implicit bridge.

## 5. Competitive standard

The benchmark is cross-format AI output systems where:

- source artifacts seed communication artifacts,
- and the handoff is intentional, traceable, and user-visible.

## 6. Current-state assessment

- `User value`: partial to good.
- `Flow completeness`: partial.
- `UX quality`: partial.
- `Data / logic quality`: good.
- `Integration quality`: strong.
- `Trust / governance`: good.
- `Market standard fit`: partial.

## 7. Main gaps

- the handoff still risks living only in docs and hidden runtime paths,
- promotion semantics need stronger visible identity,
- review and provenance across the conversion path need explicit product packaging.

## 8. Minimal acceptance state now

The first acceptable Wave 2 state is:

- one visible promotion flow,
- shared provenance between source report and target presentation,
- and one predictable continue-working path after promotion.

## 9. Full 100% target state

`Report -> Presentation` reaches 100% only when it supports:

- deterministic promotion,
- source-aware deck seeding,
- traceable relationship between report versions and deck versions,
- and review-aware continuation on both sides.

## 10. Top missing functions and flows

- report -> presentation promotion CTA and flow
- shared provenance display
- version relationship tracking
- continue/edit flow after promotion
- clear source/target lifecycle semantics

## 11. Proposed bounded delivery packets

1. `Promotion flow visibility`
2. `Source-target provenance closure`
3. `Version relationship model`
4. `Cross-format continuation UX`

## 12. Risks and dependencies

- depends on `Documents`, `Presentations`, and `Provenance / review / visibility`,
- risks staying a hidden feature rather than a productized workflow,
- risks overscoping into full presentation-authoring redesign.
