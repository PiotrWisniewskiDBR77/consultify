# Wave 2 Final Implementation Plan - Documents

Date: 2026-03-29
Module: `Documents`
Scope: final implementation plan for the governed Wave 2 durable document runtime

## 1. Scope

This plan covers only `Documents` as a first-class artifact type in the Wave 2 family.

It does not widen scope into:

- full presentation or sheet behavior
- broad office-style builder rewrite
- a report-only legacy framing of the module

## 2. Canonical Source Stack

- `docs/product/work-packets/wave-2/WAVE_2_CANONICAL_SCOPE_MAP.md`
- `docs/product/work-packets/wave-2/briefs/WAVE_2_BRIEF_A_OUTPUTS_AND_ARTIFACT_FAMILY.md`
- `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_DOCUMENTS.md`
- `docs/product/work-packets/wave-2/WAVE_2_MASTER_IMPLEMENTATION_ORDER.md`
- `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_SOURCE_MATRIX_2026-03-29.md`
- `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_MASTER_AUDIT_2026-03-29.md`
- `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_GAP_BACKLOG_2026-03-29.md`

## 3. Benchmark Family From `Softs`

Primary benchmark family:

- AI-first durable documents with governed lifecycle, review, and reopen continuity

Benchmark interpretation:

- create from context
- durable identity after creation
- explicit review and version truth
- reopen and continue behavior that feels native

## 4. Intended Final Product Behavior

`Documents` should behave like a fully governed artifact class:

- create and refresh from declared context
- remain durable in the library and linked surfaces
- support reopen, continue, review, and export with traceability
- feel like a document product, not only a report legacy lane

## 5. Current Repo Truth

What is already true:

- document runtime substrate is strong
- report/document behavior is already materially real
- library and artifact family doctrine can already attach to this class

What is still incomplete:

- document packaging still leans too much on earlier report framing
- review and continuation semantics need stronger family-level clarity
- the final product contract is not yet explicit enough for the broader Wave 2 ambition

## 6. Gap Ledger

| Dimension | Current truth | Final implementation requirement | Main gap |
| --- | --- | --- | --- |
| `User value` | durable documents already exist | full governed document product | product packaging |
| `Flow completeness` | create/open basics are strong | create-review-reopen-export continuity | continuation depth |
| `UX quality` | core runtime is believable | clearer family-level semantics | product clarity |
| `Data / logic quality` | artifact identity is strong | lineage and version signals must stay visible | lifecycle exposure |
| `Integration quality` | family integration is possible | clean library and source-surface continuity | convergence depth |
| `Trust / governance / error handling` | trust substrate exists | review and export truth must be explicit | trust packaging |
| `Market standard fit` | medium-strong | governed document runtime | final contract gap |

## 7. Final Delivery Packets

| Packet | Goal | Scope | What we deliver | What we do not touch | Acceptance proof |
| --- | --- | --- | --- | --- | --- |
| `Document artifact-family closure packet` | package documents as a full artifact type | family semantics, identity, library participation | one explicit document product contract | full builder rewrite | the user sees documents as a first-class artifact, not a leftover report lane |
| `Document reopen and continue packet` | strengthen working continuity | reopen, continue, version/readback cues, source continuity | clearer continuation model for active documents | every adjacent source module at once | a user can reopen and continue a document without losing artifact truth |
| `Document review and export packet` | strengthen delivery trust | review state, export visibility, lineage language | explicit review and export semantics for documents | presentation or sheet parity | the user can understand what is reviewed, exportable, and traceable |

## 8. Dependencies And Risks

Dependencies:

- `Outputs Library`
- `ArtifactRun z czatu`
- `Provenance / review / visibility`
- `Report -> Presentation`

Risks:

- preserving strong runtime while leaving the product contract vague
- treating report heritage as equivalent to final document packaging
- reopening broad builder scope too early

## 9. Final Acceptance Bar

`Documents` is finally implemented for its declared Wave 2 role only when:

- documents are visibly first-class artifacts in the family
- create, review, reopen, continue, and export behavior are explicit
- the document product no longer depends on implicit report-language inheritance
- the user can understand the current state and next action without guessing

## 10. Non-Goals And Unsafe Claims

Non-goals:

- complete office-suite document authoring parity
- solving every rich composition edge case
- unifying all artifact classes into one editor

Unsafe claims until separately proven:

- `Documents now match the strongest commercial authoring platforms`
- `report and document maturity are fully identical across all lanes`
- `the broader reports-and-builder ambition is already complete`
