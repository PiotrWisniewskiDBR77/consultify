# Reports v8 AI Operations And Governance

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical AI operations model for `Reports`, including proposal classes, review model, mutation governance and audit expectations

---

## 1. Why this document exists

Reports already use AI for:

- outline proposals
- section generation
- summaries
- recommendations

But the runtime still lacks one explicit `v8` contract for how AI operations should behave end-to-end.

This document closes that gap.

---

## 2. Core rule

Every consequential AI action in a report must belong to one of three classes:

- `AI suggest`
- `AI draft`
- `AI apply after acceptance`

Canonical rule:

`AI may help produce or improve report content, but it may not silently mutate canonical report truth`

---

## 3. AI operation classes

### 3.1 `AI suggest`

Characteristics:

- advisory only
- no direct report mutation
- may be transient, but should be auditable when consequential

Examples:

- this section is too short
- evidence is weak here
- this recommendation is not grounded enough
- this report likely needs another section

### 3.2 `AI draft`

Characteristics:

- creates proposal content
- does not mutate approved report state
- must be reviewable before application

Examples:

- draft outline
- draft full report
- draft section rewrite
- draft executive summary
- draft recommendation refinement
- draft refresh proposal

### 3.3 `AI apply after acceptance`

Characteristics:

- mutates report content only after approval
- must reference the accepted proposal
- must preserve mutation trace

Examples:

- apply accepted section rewrite
- apply accepted executive summary
- apply accepted evidence-backed refresh

---

## 4. Scope levels

### 4.1 Report scope

Operations affecting the full artifact, for example:

- generate full draft
- tighten report density
- rewrite executive narrative
- convert to board-ready style

### 4.2 Section scope

Operations affecting one section, for example:

- regenerate section
- deepen section
- shorten section
- refresh section from sources

### 4.3 Block scope

Operations affecting one block, for example:

- rewrite paragraph
- restructure bullet list
- refresh one chart explanation
- rewrite one callout

---

## 5. Canonical AI operation kinds

The report system should support at least:

- `outline_proposal`
- `report_generation`
- `section_generation`
- `section_rewrite`
- `section_refresh_proposal`
- `summary_rewrite`
- `recommendation_rewrite`
- `compliance_rewrite`
- `quality_suggestion`
- `coverage_suggestion`

---

## 6. Proposal doctrine

Every `AI draft` must expose:

- what will change
- where it will change
- why AI proposes it
- what evidence it used
- what risk or uncertainty remains

This is especially important for:

- executive summaries
- recommendations
- financial or KPI claims
- escalations

---

## 7. Review and acceptance model

Canonical state flow:

`drafted -> pending_review -> accepted -> applied`

Alternative endings:

- `drafted -> pending_review -> rejected`
- `drafted -> failed`
- `accepted -> failed`

Rules:

- only accepted proposals may mutate canonical report content
- rejected proposals must leave the report unchanged
- failed proposals must still preserve audit context

---

## 8. Mutation bridge

Every applied report mutation must preserve:

- source operation ID
- report scope
- affected section or block where relevant
- before state reference
- after state reference
- mutation summary
- actor and timestamp

This keeps report editing explainable.

---

## 9. AI and source grounding

AI in reports must remain source-aware.

That means:

- it should cite section-level or block-level grounding where possible
- it should identify weak evidence
- it should distinguish between source fact and generated interpretation

Forbidden behavior:

- inventing missing facts
- promoting unsupported claims into executive recommendations
- hiding missing evidence behind polished prose

---

## 10. AI and refresh semantics

Refresh is a special class of report AI operation.

AI may:

- detect source changes
- propose refreshed section content
- summarize what changed
- explain whether prior approval is now stale

AI may not:

- silently overwrite reviewed sections after a source refresh

Canonical refresh flow:

`source change -> refresh proposal -> review -> accept/reject -> apply -> review state update`

---

## 11. AI and quality gates

AI should support quality gates by:

- suggesting fixes for weak sections
- improving traceability coverage
- proposing more compliant language
- flagging logic gaps before export

AI should not bypass quality gates.

The quality engine remains authoritative for readiness checks.

---

## 12. AI and delivery governance

AI may prepare:

- executive summaries
- board-ready narrative variants
- distribution-specific wording adjustments

AI may not:

- mark report as approved
- share the report externally
- remove review blockers

These remain governed user actions.

---

## 13. Shared doctrine with presentations

> V8 Decision W6-1 applied — 2026-03-23

This document is the **one shared output AI governance truth** for both reports and presentations. There is no separate parallel governance doc for presentations.

Reports and Presentations share:

- operation classes
- review-before-apply rule
- no-silent-edits rule
- source-grounding rule
- mutation bridge requirements
- refresh semantics

Presentation-specific extensions where needed:

- slide-level mutation scope (in addition to section/block scope)
- visual-hint proposals as an `AI suggest` operation
- speaker-note generation as an `AI draft` operation
- visual rhythm and pacing as quality gate inputs

But report-specific AI remains distinct in one important way:

`reports require deeper evidence continuity and stronger reasoning density than presentations`

Canonical rule:

`one shared output AI governance truth, with presentation-specific extensions where needed`

---

## 14. Completeness criteria

This AI model is strong when:

- every meaningful AI mutation is reviewable
- section refresh is governed and auditable
- executive narratives remain source-aware
- quality and compliance fixes do not bypass user control
- report AI feels powerful without becoming untrustworthy

---

## 15. Related canonical docs

- `REPORTS_V8_SSOT.md`
- `REPORTS_V8_RUNTIME_TRUTH_MAP.md`
- `REPORT_GENERATOR_V3.md`
- `REPORTS_AND_PRESENTATIONS_OUTPUT_OPERATING_MODEL_V8.md`
