# Wave 2 Module Card — Outputs Library

> Cluster: `Outputs And Artifact Family`
> Scope: canonical discovery and operations surface for durable artifacts

## 1. Module scope

This card covers:

- the canonical outputs home,
- visible taxonomy and queues,
- preview and reopen behavior,
- filters and ownership/review slices,
- and compatibility with the historical reports/documents surface.

## 2. Source of truth reviewed

- `docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`
- `docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_IMPLEMENTATION_PLAN.md`
- `docs/product/V8_1_WAVE2_IMPLEMENTATION_START_PACKET.md`
- `docs/product/V8_1_FINAL_100_PERCENT_COMPLETION_PLAN.md`
- `docs/product/work-packets/cursor-work/V8_V81_CLOSURE_LEDGER.md`
- `docs/product/work-packets/cursor-work/V81_FINAL_CLOSURE_MATRIX.md`

## 3. Intended product behavior

`Outputs Library` should be the one stable home for all generated artifacts:

- all durable outputs land there,
- users can discover, reopen, review, export, and reuse them,
- and the library exposes one truthful cross-format model.

## 4. Current repo and doc truth

Current truth is strong but still transitional:

- the artifact runtime lane is green in the closure ledger,
- the functional spec treats Outputs Library as canonical home,
- but the Wave 2 packet and final closure plan both say the surface still needs closure as a real product-grade operating surface.

## 5. Competitive standard

The benchmark is artifact and document hubs where:

- discovery is obvious,
- status and ownership are visible,
- and reopening work is frictionless.

## 6. Current-state assessment

- `User value`: good. The direction is clear and already partially real.
- `Flow completeness`: partial. Registry truth is stronger than final surface breadth.
- `UX quality`: partial. The shell is better than before, still not the full doctrine.
- `Data / logic quality`: strong. Canonical registry rule is explicit.
- `Integration quality`: strong. Library is meant to serve documents, presentations, sheets, and My Work.
- `Trust / governance`: good. Review and visibility semantics are defined.
- `Market standard fit`: partial to good. Strong structure, still needs final product closure.

## 7. Main gaps

- final taxonomy and queue semantics need clearer closure,
- visible aggregate semantics are thinner than full doctrine,
- preview/open/review/export behavior still needs consistent final polish,
- some historical compatibility behavior may still leak old RAP shell assumptions.

## 8. Minimal acceptance state now

The first acceptable Wave 2 state is:

- one visible cross-format outputs hub,
- clear `All`, `Mine`, `Needs review`, and type-based slices,
- and accurate open/reopen behavior from one canonical identity.

## 9. Full 100% target state

`Outputs Library` reaches 100% only when it includes:

- complete taxonomy,
- review and ownership queues,
- source and export signals,
- cross-format preview/open behavior,
- templates where appropriate,
- and zero ambiguity about where durable artifacts live.

## 10. Top missing functions and flows

- library taxonomy and queue model
- preview/open/reopen flow
- review queue visibility
- source/export/placement semantics
- compatibility path from old surfaces

## 11. Proposed bounded delivery packets

1. `Library taxonomy closure`
2. `Aggregate row and preview semantics`
3. `Review and ownership queues`
4. `Legacy alias and deep-link cleanup`

## 12. Risks and dependencies

- depends on `Documents`, `Presentations`, `Sheet`, `ArtifactRun`, and `My Work`,
- risks becoming a thin list over strong backend truth,
- risks creating a second outputs shell by accident.
