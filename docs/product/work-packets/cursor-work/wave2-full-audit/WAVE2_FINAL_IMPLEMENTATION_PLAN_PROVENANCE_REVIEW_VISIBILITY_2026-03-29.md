# Wave 2 Final Implementation Plan - Provenance / review / visibility

Date: 2026-03-29
Module: `Provenance / review / visibility`
Scope: final implementation plan for the cross-cutting trust layer of the Wave 2 artifact family

## 1. Scope

This plan covers only `Provenance / review / visibility` as the shared trust grammar across declared artifacts.

It does not widen scope into:

- a standalone app separate from artifact runtimes
- collapsing run approval and artifact review into one state machine
- full permissions redesign for the whole product

## 2. Canonical Source Stack

- `docs/product/work-packets/wave-2/WAVE_2_CANONICAL_SCOPE_MAP.md`
- `docs/product/work-packets/wave-2/briefs/WAVE_2_BRIEF_A_OUTPUTS_AND_ARTIFACT_FAMILY.md`
- `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_PROVENANCE_REVIEW_VISIBILITY.md`
- `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_SOURCE_MATRIX_2026-03-29.md`
- `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_MASTER_AUDIT_2026-03-29.md`
- `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_GAP_BACKLOG_2026-03-29.md`

## 3. Benchmark Family From `Softs`

Primary benchmark family:

- enterprise lineage, review, and visibility systems that make artifact truth auditable and understandable

Benchmark interpretation:

- where did this artifact come from
- what stage is it in
- who owns or reviews it
- what can be exported or shared

## 4. Intended Final Product Behavior

`Provenance / review / visibility` should make every declared artifact answer the same trust questions:

- what source and run created this artifact
- what version or review state it is in
- who should trust or act on it next
- what is visible, exportable, or restricted

## 5. Current Repo Truth

What is already true:

- trust doctrine is one of the strongest parts of the artifact family
- lineage and registry substrate are already real

What is still incomplete:

- exposure of trust semantics is still uneven across surfaces
- validation and review stages are not always packaged clearly enough
- the user-facing grammar still risks lagging the internal doctrine

## 6. Gap Ledger

| Dimension | Current truth | Final requirement | Main gap |
| --- | --- | --- | --- |
| `User value` | trust substrate is real | one visible trust grammar | exposure consistency |
| `Flow completeness` | partial trust states exist | source-run-review-export sequence is explicit | state coherence |
| `UX quality` | badges and metadata exist | trust language must be easy to read | grammar clarity |
| `Data / logic quality` | lineage substrate is strong | review and visibility states must stay correct | state modeling |
| `Integration quality` | cross-family layer exists | same trust semantics across formats and shells | family consistency |
| `Trust / governance / error handling` | strong | no ambiguity between approval, review, visibility, export | governance separation |
| `Market standard fit` | medium | audit-ready artifact trust layer | productization gap |

## 7. Final Delivery Packets

| Packet | Goal | Scope | What we deliver | What we do not touch | Acceptance proof |
| --- | --- | --- | --- | --- | --- |
| `Artifact trust-state baseline packet` | define the shared trust grammar | source, run, review, export, visibility language | one baseline trust model across the family | full ACL redesign | the user can answer core trust questions about an artifact |
| `Validation and review packet` | clarify stages | validation, review, readiness cues, ownership language | cleaner stage separation | all workflow approvals everywhere | users can distinguish creation approval, validation, and later review states |
| `Visibility consistency packet` | align surfaces | library, artifact preview, notebook/object readback, export cues | more consistent trust exposure | every future module in one pass | major family surfaces no longer contradict each other on artifact status |

## 8. Dependencies And Risks

Dependencies:

- `ArtifactRun z czatu`
- `Outputs Library`
- `Documents`, `Presentations`, `Sheet`
- `Notebook outputs` and `Object-linked outputs`

Risks:

- keeping trust doctrine strong but user-facing signals weak
- mixing run approval with artifact review
- widening scope into a general authorization program

## 9. Final Acceptance Bar

`Provenance / review / visibility` is finally implemented for its declared Wave 2 role only when:

- declared artifacts share one understandable trust grammar
- source, run, review, export, and visibility cues are explicit
- major artifact surfaces do not contradict each other
- the family preserves governance clarity instead of hiding it in internals

## 10. Non-Goals And Unsafe Claims

Non-goals:

- a universal permissions redesign for the entire platform
- solving all approval logic outside artifact trust
- replacing artifact runtimes with a standalone trust console

Unsafe claims until separately proven:

- `artifact governance is fully complete across every surface`
- `all review and visibility problems are solved everywhere`
- `trust doctrine now guarantees full enterprise parity by itself`
