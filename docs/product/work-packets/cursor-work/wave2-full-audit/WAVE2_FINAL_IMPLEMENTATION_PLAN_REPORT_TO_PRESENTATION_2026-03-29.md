# Wave 2 Final Implementation Plan - Report -> Presentation

Date: 2026-03-29
Module: `Report -> Presentation`
Scope: final implementation plan for deterministic cross-format promotion from document/report truth into presentation truth

## 1. Scope

This plan covers only `Report -> Presentation` as a declared workflow between artifact classes.

It does not widen scope into:

- the whole reports builder
- the whole presentations builder
- vague cross-format idea generation without deterministic source truth

## 2. Canonical Source Stack

- `docs/product/work-packets/wave-2/WAVE_2_CANONICAL_SCOPE_MAP.md`
- `docs/product/work-packets/wave-2/briefs/WAVE_2_BRIEF_A_OUTPUTS_AND_ARTIFACT_FAMILY.md`
- `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_REPORT_TO_PRESENTATION.md`
- `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_SOURCE_MATRIX_2026-03-29.md`
- `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_MASTER_AUDIT_2026-03-29.md`
- `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_GAP_BACKLOG_2026-03-29.md`

## 3. Benchmark Family From `Softs`

Primary benchmark family:

- deterministic cross-format promotion workflows that preserve source identity, review context, and continuation semantics

Benchmark interpretation:

- promotion is visible and intentional
- the target artifact remembers its source
- users can continue work after promotion without losing context

## 4. Intended Final Product Behavior

`Report -> Presentation` should behave like one explicit promotion workflow:

- choose a report or document source
- generate a presentation target with preserved lineage
- understand the relationship between source and target
- continue work on the deck without losing origin truth

## 5. Current Repo Truth

What is already true:

- cross-format promotion exists conceptually and partially in runtime
- the product already has strong artifact-family doctrine around lineage

What is still incomplete:

- promotion still risks feeling hidden rather than productized
- source-target relationship semantics are not yet one fully explicit user-facing contract
- version and review interplay remain thinner than the broad workflow ambition

## 6. Gap Ledger

| Dimension | Current truth | Final requirement | Main gap |
| --- | --- | --- | --- |
| `User value` | concept is real | visible source-to-deck workflow | workflow visibility |
| `Flow completeness` | partial promotion exists | choose-promote-open-continue sequence | end-to-end clarity |
| `UX quality` | hidden bridge feel | explicit promotion grammar | user-facing identity |
| `Data / logic quality` | linkage possible | source-target lineage and version relationship | relationship model |
| `Integration quality` | family doctrine supports it | aligns with docs, decks, and library | cross-format convergence |
| `Trust / governance / error handling` | moderate | preserve review/export/source truth | trust carryover |
| `Market standard fit` | medium-low | deterministic promotion | packaging gap |

## 7. Final Delivery Packets

| Packet | Goal | Scope | What we deliver | What we do not touch | Acceptance proof |
| --- | --- | --- | --- | --- | --- |
| `Promotion flow visibility packet` | make the workflow visible | promotion entry, source cues, target cues, open path | one explicit report-to-deck flow | whole builder redesign | the user can intentionally promote a source artifact into a deck |
| `Source-target provenance packet` | preserve lineage and trust | source references, relationship language, traceability basics | stronger source-target continuity | every advanced collaboration feature | the target deck clearly points back to its source truth |
| `Version relationship packet` | strengthen ongoing continuity | promoted target updates, version cues, continue-after-promotion semantics | a believable continuing workflow | fully automatic bidirectional sync | the user understands how the promoted deck relates to the current source version |

## 8. Dependencies And Risks

Dependencies:

- `Documents`
- `Presentations`
- `Provenance / review / visibility`
- `Outputs Library`

Risks:

- leaving the feature hidden behind strong technical wiring
- overstating promotion maturity without a visible product contract
- drifting into full authoring or sync scope instead of bounded workflow closure

## 9. Final Acceptance Bar

`Report -> Presentation` is finally implemented for its declared Wave 2 role only when:

- promotion is a visible and deterministic workflow
- source and target relationships remain explicit after creation
- continuation after promotion is understandable
- the workflow stays narrow and truthful instead of pretending to solve the whole builder problem

## 10. Non-Goals And Unsafe Claims

Non-goals:

- full two-way live synchronization
- complete reports and presentations builder parity
- every cross-format workflow in the product

Unsafe claims until separately proven:

- `all report-to-deck workflows are fully complete`
- `promotion now covers the full authoring lifecycle`
- `cross-format parity with commercial suites is achieved`
