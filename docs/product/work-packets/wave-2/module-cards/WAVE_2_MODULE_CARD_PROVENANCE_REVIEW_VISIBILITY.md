# Wave 2 Module Card — Provenance / review / visibility

> Cluster: `Outputs And Artifact Family`
> Scope: cross-cutting trust layer for artifact traceability, review, and access semantics

## 1. Module scope

This card covers:

- source traceability,
- run traceability,
- review state,
- visibility and access,
- export traceability,
- and trust signals across the artifact family.

## 2. Source of truth reviewed

- `docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`
- `docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_IMPLEMENTATION_PLAN.md`
- `docs/product/V8_1_FINAL_100_PERCENT_COMPLETION_PLAN.md`
- `docs/product/ARTIFACT_LINKING_V5_SSOT.md`
- `docs/product/AI_ARTIFACT_RUNTIME_ARCHITECTURE_V8.md`

## 3. Intended product behavior

This layer should make every artifact answer:

- where it came from,
- who owns it,
- what run and version produced it,
- who must review it,
- what can be exported,
- and who can see it.

## 4. Current repo and doc truth

Current truth is strong in doctrine and partial in full closure:

- provenance and review semantics are central to the functional spec,
- closure docs say many semantics are now fulfilled,
- but final completion docs still call out validation, review separation, and consistent surface exposure as open areas.

## 5. Competitive standard

The benchmark is not only file metadata.
It is enterprise-grade trust where artifacts are auditable, reviewable, and safely visible.

## 6. Current-state assessment

- `User value`: good.
- `Flow completeness`: partial.
- `UX quality`: partial. Signals exist, full consistency is still open.
- `Data / logic quality`: strong.
- `Integration quality`: strong.
- `Trust / governance`: strong.
- `Market standard fit`: partial to good.

## 7. Main gaps

- validation is not yet a clearly elevated first-class stage,
- review visibility is not yet equally surfaced everywhere,
- export trace and access semantics still need full consistency,
- review and execution approval separation must stay explicit.

## 8. Minimal acceptance state now

The first acceptable Wave 2 state is:

- visible source/run/review/export state,
- conservative access control,
- and one clear distinction between execution approval and artifact review.

## 9. Full 100% target state

This layer reaches 100% only when every artifact family member preserves:

- source lineage,
- run lineage,
- version lineage,
- review state,
- export state,
- visibility state,
- and clear cross-surface trust signals.

## 10. Top missing functions and flows

- visible trust state in library and workspace
- validation stage in artifact lifecycle
- review queue and reviewer assignment semantics
- export trace and status visibility
- consistent ACL/visibility display

## 11. Proposed bounded delivery packets

1. `Artifact trust-state baseline`
2. `Validation stage closure`
3. `Review and visibility surface consistency`
4. `Export and ACL traceability closure`

## 12. Risks and dependencies

- depends on every other artifact-family module,
- risks remaining a doctrine-only layer,
- risks accidental second approval universe if review and execution governance blur.
