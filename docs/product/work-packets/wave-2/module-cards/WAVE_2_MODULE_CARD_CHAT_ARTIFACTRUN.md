# Wave 2 Module Card — ArtifactRun z czatu

> Cluster: `Outputs And Artifact Family`
> Scope: chat-native planning, execution, materialization, and rerun spine for artifacts

## 1. Module scope

This card covers:

- chat-first artifact request handling,
- visible planning before generation,
- governed execution and materialization,
- rerun/refresh behavior,
- and traceable link between chat context and durable artifact state.

## 2. Source of truth reviewed

- `docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`
- `docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_IMPLEMENTATION_PLAN.md`
- `docs/product/V8_1_FINAL_100_PERCENT_COMPLETION_PLAN.md`
- `docs/product/V8_1_WAVE2_IMPLEMENTATION_START_PACKET.md`
- `docs/product/EXECUTION_RUN_AND_PROPOSAL_SPINE_V8.md`

## 3. Intended product behavior

`ArtifactRun z czatu` should let the user:

- ask for an artifact in context,
- see a plan,
- approve governed generation,
- create a durable artifact,
- and later refresh or continue it without losing traceability.

## 4. Current repo and doc truth

Current truth is meaningful but still uneven:

- the artifact runtime substrate is real,
- chat-driven planning and materialization exist in bounded form,
- but the final completion plan still flags runtime gaps around validation, governance separation, and full multi-format closure.

## 5. Competitive standard

The benchmark is KIMI-style or artifact-native chat behavior where:

- chat is the front door,
- planning is visible,
- generation is governed,
- and durable artifacts are the default result.

## 6. Current-state assessment

- `User value`: good.
- `Flow completeness`: partial.
- `UX quality`: partial. Planning exists conceptually; full continuity still needs closure.
- `Data / logic quality`: strong.
- `Integration quality`: strong.
- `Trust / governance`: partial to good. Separation of execution approval and review still needs explicit closure.
- `Market standard fit`: partial to good.

## 7. Main gaps

- tri-format closure is still uneven,
- validation is not yet a first-class shared stage,
- governance separation between run approval and artifact review still needs hard closure,
- rerun/refresh semantics need clearer packaging.

## 8. Minimal acceptance state now

The first acceptable Wave 2 state is:

- visible plan before generation,
- governed approval,
- durable materialization,
- and one explicit rerun/refresh path with traceability.

## 9. Full 100% target state

`ArtifactRun z czatu` reaches 100% only when it supports:

- chat-first create for all artifact types in scope,
- visible planning,
- governed create/refresh lifecycle,
- run history,
- failure visibility,
- and traceability back to context, source, run, and version.

## 10. Top missing functions and flows

- ask -> plan -> approve -> materialize
- rerun/refresh and failure handling
- validation before artifact acceptance
- full type coverage
- run visibility in library/work/object surfaces

## 11. Proposed bounded delivery packets

1. `ArtifactRun lifecycle closure`
2. `Validation-first artifact run stage`
3. `Rerun and failure visibility`
4. `Cross-surface run traceability`

## 12. Risks and dependencies

- depends on `Documents`, `Presentations`, `Sheet`, and governance spine docs,
- risks collapsing run approval and artifact review into one hidden flow,
- risks looking complete for one format while remaining partial overall.
