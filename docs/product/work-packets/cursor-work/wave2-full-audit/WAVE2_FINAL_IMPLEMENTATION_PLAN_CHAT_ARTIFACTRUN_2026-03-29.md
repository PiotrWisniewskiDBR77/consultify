# Wave 2 Final Implementation Plan - ArtifactRun z czatu

Date: 2026-03-29
Module: `ArtifactRun z czatu`
Scope: final implementation plan for the chat-first planning, approval, materialization, and rerun spine of the artifact family

## 1. Scope

This plan covers only `ArtifactRun z czatu` as the shared run lifecycle for declared artifact creation.

It does not widen scope into:

- every AI chat feature in the product
- artifact review itself as a second approval universe
- the full reports/presentations builder ambition

## 2. Canonical Source Stack

- `docs/product/work-packets/wave-2/WAVE_2_CANONICAL_SCOPE_MAP.md`
- `docs/product/work-packets/wave-2/briefs/WAVE_2_BRIEF_A_OUTPUTS_AND_ARTIFACT_FAMILY.md`
- `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_CHAT_ARTIFACTRUN.md`
- `docs/product/work-packets/wave-2/WAVE_2_MASTER_IMPLEMENTATION_ORDER.md`
- `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_SOURCE_MATRIX_2026-03-29.md`
- `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_MASTER_AUDIT_2026-03-29.md`
- `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_GAP_BACKLOG_2026-03-29.md`

## 3. Benchmark Family From `Softs`

Primary benchmark family:

- chat-native artifact planning systems with visible plan, governed approval, durable materialization, and rerun continuity

Benchmark interpretation:

- planning should be explicit before creation
- approval should be distinct from later artifact review
- durable materialization should be the default outcome
- rerun and failure truth should stay visible

## 4. Intended Final Product Behavior

`ArtifactRun z czatu` should behave like the spine of the artifact family:

- ask in chat
- inspect the run plan
- approve the bounded run
- materialize a durable artifact
- rerun or refresh with visible traceability

## 5. Current Repo Truth

What is already true:

- chat-native artifact control exists
- run and artifact family substrate are real
- the product already points toward one shared run lifecycle

What is still incomplete:

- validation and planning are not yet equally explicit across the family
- rerun and failure visibility still need stronger packaging
- approval and review boundaries need to stay cleaner in the product story

## 6. Gap Ledger

| Dimension | Current truth | Final requirement | Main gap |
| --- | --- | --- | --- |
| `User value` | chat can drive artifacts | one explicit run lifecycle | lifecycle clarity |
| `Flow completeness` | partial plan-to-create flow | ask-plan-approve-materialize-rerun sequence | rerun completeness |
| `UX quality` | controls exist | clearer staging and status visibility | run readability |
| `Data / logic quality` | run substrate exists | traceability and validation must be explicit | validation stage |
| `Integration quality` | family hooks exist | all declared artifact classes use one spine | family convergence |
| `Trust / governance / error handling` | approval exists | approval and review must stay distinct | governance clarity |
| `Market standard fit` | medium | artifact-native chat spine | packaging gap |

## 7. Final Delivery Packets

| Packet | Goal | Scope | What we deliver | What we do not touch | Acceptance proof |
| --- | --- | --- | --- | --- | --- |
| `ArtifactRun lifecycle closure packet` | make the shared lifecycle explicit | planning, approval, materialization, rerun status | one visible run contract for declared artifacts | artifact review semantics | the user can see the run lifecycle from request to durable artifact |
| `ArtifactRun validation-first packet` | clarify quality gates | validation, preflight, guardrails, stage language | one explicit validation stage before materialization where required | deep format-specific builder logic | the user can tell what must pass before a run becomes an artifact |
| `ArtifactRun rerun and failure packet` | preserve trust after first creation | rerun, refresh, failure visibility, retry semantics | believable post-create continuity | every downstream object-surface detail | the user can rerun or diagnose a failed run without losing truth |

## 8. Dependencies And Risks

Dependencies:

- `Documents`, `Presentations`, `Sheet`
- `Provenance / review / visibility`
- `Outputs Library`
- AI operating layers that initiate the run

Risks:

- collapsing approval and review into one ambiguous state
- making one artifact type stronger while calling the whole family complete
- leaving failure handling implicit because the happy path works

## 9. Final Acceptance Bar

`ArtifactRun z czatu` is finally implemented for its declared Wave 2 role only when:

- the run lifecycle is explicit from request through durable artifact creation
- approval, validation, materialization, and rerun states are visible
- failure and retry do not break traceability
- the run spine does not create a second review universe separate from artifact truth

## 10. Non-Goals And Unsafe Claims

Non-goals:

- full AI OS packaging across all assistant behavior
- final builder maturity for every format
- collapsing run approval and artifact review into one system

Unsafe claims until separately proven:

- `chat-to-artifact is fully complete across every format and edge case`
- `all validation and retry problems are solved`
- `ArtifactRun alone proves full artifact-family maturity`
