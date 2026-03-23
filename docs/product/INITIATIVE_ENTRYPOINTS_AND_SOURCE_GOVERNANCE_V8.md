# Initiative Entrypoints And Source Governance v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical reconciliation of initiative entrypoints across Idea, Tools, Assessment, Interview, Chat and manual flows with one shared source-traceability rule

---

## 1. Why this document exists

`consultify` already documents many valid ways in which initiative work begins.

That is good for product flexibility.

But there is still a consistency risk:

- some docs describe many initiative entrypoints
- some docs enforce strict source-traceability rules

This document reconciles those two truths.

---

## 2. Core statement

The product may expose many entry surfaces, but initiative source truth must remain canonical.

Rule:

`many entrypoints are allowed; one traceable source model is allowed`

---

## 3. User-facing entrypoints

The following entrypoints are valid:

- `Idea`
- `Tools`
- `Assessment`
- `Interview`
- `Chat`
- manual initiative creation

These are entrypoints for user flow.

They are not automatically equivalent to canonical source types.

---

## 4. Canonical source rule

The canonical source model should remain:

- `ToolSession`
- `AssessmentReport`

This keeps the source model deterministic for:

- audit
- AI context
- reporting
- initiative origin explanation

---

## 5. Reconciliation doctrine

To reconcile flexible entrypoints with strict source governance, the system should use this rule:

### 5.1 Tools

`Tools` entry creates:

- canonical `ToolSession`

### 5.2 Assessment

`Assessment` entry creates:

- canonical `AssessmentReport`

### 5.3 Idea

`Idea` entry may start initiative creation, but before initiative commit the system should:

- materialize a canonical `ToolSession(MYWORK or IDEA_PROMOTION)`
- attach idea artefacts as context and source snapshot

### 5.4 Interview

`Interview` may propose initiative candidates, but before initiative commit the system should:

- materialize a canonical `ToolSession(INTERVIEW_SYNTHESIS)` or equivalent governed source session
- attach interview findings, evidence and context snapshot

### 5.5 Chat

`Chat` may propose initiative candidates, but before initiative commit the system should:

- materialize a canonical `ToolSession(CHAT_SYNTHESIS)` or equivalent governed source session
- preserve selected chat context and referenced artefacts

### 5.6 Manual creation

Manual initiative creation is allowed only if the system first creates:

- canonical `ToolSession(MANUAL_INITIATIVE_DRAFT)` or equivalent governed source shell

This prevents source-less initiatives.

---

## 6. What this solves

This doctrine preserves both product truths:

- users may begin work from many modules
- the system still preserves one auditable source model

So:

- `Idea`, `Interview`, `Chat` and manual creation are valid entrypoints
- `ToolSession` and `AssessmentReport` remain the canonical source types

---

## 7. Integration with the initiative lifecycle

This doctrine should apply before initiative enters the governed lifecycle:

`entrypoint -> source materialization -> draft initiative -> review -> planning -> approval -> execution`

Important:

`no initiative should cross into the canonical lifecycle without a traceable source artifact`

---

## 8. Functional implications

The system should support:

- source-shell creation for non-Tool and non-Assessment entrypoints
- snapshot preservation of upstream context
- visible “initiative originates from” section
- AI-safe source references
- reporting and audit based on canonical source objects

### 8.1 Source materialization UX

> V8 Decision W3-1 applied — 2026-03-23

Source materialization is invisible by default at the UX level. The user does not see a "creating source record" step in the normal flow.

Source materialization is explicit in lineage, audit, and source-trace views.

Explicit confirmation is required only when:

- source merge is ambiguous
- promotion crosses scope or ownership boundaries
- evidence is weak or mixed
- the action creates durable initiative truth from loosely structured input

Rule: `frictionless by default, explicit when truth risk increases`

### 8.2 Interview promotion permission model

> V8 Decision W3-2 applied — 2026-03-23

Interview-to-initiative promotion requires both a permission model and an evidence class/confidence model. Permission alone is not enough; evidence alone is not enough.

Promotion requires:

- allowed actor (user with initiative-creation permission in the target scope)
- sufficient evidence class/confidence for the target use
- review/confirmation when finding is weak, contradictory, or high-impact

### 8.3 Synced source references in initiative governance

> V8 Decision W3-3 applied — 2026-03-23

`synced_source_refs` are part of the initiative source governance model, not only the Idea workspace level.

Initiative-level governance needs the synced lineage when work enters the PM/execution lifecycle. The Idea workspace may still hold local/source-prep refs, but synced external source references must carry through to the initiative's source record with freshness and provenance metadata.

---

## 9. Acceptance criteria

The package is strong when:

- all user-facing initiative entrypoints are allowed
- no initiative exists without traceable source
- source rules are consistent across docs
- Idea, Interview, Chat and manual flows no longer conflict with source-traceability doctrine

---

## 10. Related canonical docs

- `SOURCE_TRACEABILITY_SPEC.md`
- `SYSTEM_ARCHITECTURE_BRIEF.md`
- `INITIATIVE_CHANGE_MANAGEMENT_SYSTEM_V8.md`
- `PROJECT_MANAGEMENT_SYSTEM_COMPLETENESS_AND_STANDARDS_GAP_MATRIX_V8.md`
