# Interview Insight Analytics And Closed Loop Actions v8

> Status: Draft v8  
> Owner: Product + Engineering  
> Scope: canonical analysis frame above Interview findings, including `person x topic` synthesis, contradiction handling, and governed handoff from Interview findings into downstream work

---

## 1. Why this document exists

Interview should not stop at answer capture or a flat list of themes.

In consulting work we need two things at once:

- **narrow perspective**: what exactly did a given person say, with nuance
- **wide perspective**: what pattern exists across people, roles, and the whole organization

This document defines the canonical analysis system so the product can support both without creating multiple competing truths.

Rule:

`P10 findings remain the auditable truth object; analytics is a governed synthesis layer above those findings and their evidence`

---

## 2. Core statement

Interview insight analytics must operate as a layered matrix:

`evidence fragment -> person slice -> topic synthesis -> person x topic matrix -> organization synthesis -> downstream action`

This means:

- the system starts from source-linked evidence
- preserves the perspective of each respondent or stakeholder slice
- groups meaning by topic
- then compares topics across people and roles
- only then produces executive synthesis or downstream action suggestions

We do **not** jump straight from transcript text to an org-wide conclusion.

---

## 3. Canonical analysis dimensions

### 3.1 Topic dimension

Topic answers:

- `what is being discussed`
- `what pattern/problem/opportunity is emerging`

Canonical topic group types:

- `theme`
- `issue`
- `opportunity`
- `contradiction`
- `gap`
- `signal`

Topic groups may be system-generated, but publishable claims still resolve to P10 findings.

### 3.2 Person dimension

Person answers:

- `who is saying this`
- `from what role, department, or decision position`
- `how local or representative is this perspective`

Canonical person lenses:

- respondent
- role / job title
- department / business area
- stakeholder class
- decision proximity
- process proximity

### 3.3 Scope dimension

Scope answers:

- `in what context is this analysis valid`
- `how broad is the claim allowed to be`

Canonical scope fields:

- source sessions / interview run
- timeframe
- segment / function / geography
- stakeholder coverage posture
- analysis depth (`local_signal | repeated_pattern | organization_synthesis`)

Rule:

`every published synthesis claim must carry explicit scope, not only topic label`

---

## 4. Analytics layers (frozen)

### 4.1 Evidence fragment layer

Smallest analysis unit:

- answer excerpt
- transcript excerpt
- operator note
- attachment/export pointer

This layer is not yet an insight. It is raw supported material.

### 4.2 Person slice layer

`PersonSlice` is the consultant-facing summary of one respondent or one governed stakeholder slice.

It should preserve:

- respondent identity reference
- role / department / stakeholder class
- local observations
- local tensions or contradictions
- supported topic refs
- evidence links

Rule:

`person slice may summarize, but must not overclaim beyond that slice`

### 4.3 Topic synthesis layer

`TopicSynthesis` groups what multiple people said about the same topic.

It should preserve:

- topic label and type
- linked person slices
- linked findings
- support spread across roles/departments
- contradiction or minority-view flags
- coverage warnings

Rule:

`topic synthesis is where recurring pattern detection happens; it is not yet the final org-wide claim`

### 4.4 Matrix layer

The canonical comparison surface is a `topic x person-lens` matrix.

Rows:

- topic syntheses

Columns:

- respondent lens or aggregated stakeholder lens

Cells show:

- supported
- contradicted
- absent / not observed
- weak local signal

Each cell may include:

- evidence count
- linked excerpts
- confidence note

Rule:

`matrix cells are comparative metadata, not independent findings`

### 4.5 Organization synthesis layer

`OrganizationSynthesis` is the widest perspective.

It may only claim:

- consensus patterns
- role-dependent divergences
- isolated local issues
- unresolved contradictions
- coverage gaps that block stronger conclusions

Forbidden:

- flattening minority views into false consensus
- treating 1 respondent as organization truth
- hiding missing stakeholder coverage

---

## 5. Canonical runtime objects

The product should expose the following governed objects:

### 5.1 `InsightAnalysisScope`

Defines:

- source sessions
- stakeholder coverage
- active lenses
- scope validity
- synthesis posture

### 5.2 `InsightPersonSlice`

Defines one respondent/stakeholder perspective.

Minimum fields:

- `id`
- `session_ref`
- `respondent_label`
- `role`
- `department`
- `stakeholder_label`
- `supported_topic_refs[]`
- `finding_refs[]`
- `local_summary`

### 5.3 `InsightTopicSynthesis`

Defines one grouped analytical topic.

Minimum fields:

- `id`
- `topic_type`
- `label`
- `finding_ref`
- `source_key`
- `supporting_session_refs[]`
- `supporting_stakeholder_refs[]`
- `confidence_level`
- `limits`
- `next_action`
- `coverage_posture`

### 5.4 `InsightMatrixCell`

Minimum fields:

- `topic_ref`
- `lens_ref`
- `state`
- `evidence_count`
- `excerpt_refs[]`

States:

- `supported`
- `contradicted`
- `local_only`
- `not_observed`

### 5.5 `InsightOrganizationSynthesis`

Minimum fields:

- `consensus_topic_refs[]`
- `divergent_topic_refs[]`
- `local_only_topic_refs[]`
- `coverage_gaps[]`
- `operator_summary`

---

## 6. Rules of interpretation

### 6.1 People-first before org-first

The system should analyze in this order:

1. evidence fragments
2. person slices
3. topic synthesis
4. matrix comparison
5. organization synthesis

Not in reverse.

### 6.2 Topics are not enough without perspective

A topic without stakeholder spread can exist, but it must be marked as:

- local
- narrow
- or under-covered

### 6.3 People are not enough without grouping

Per-person summaries alone are not consulting insight. The system must still show:

- recurring themes
- contradictions
- cross-role differences

### 6.4 Executive summary must be derived, not authored independently

Executive synthesis should summarize what already exists in:

- findings
- topic syntheses
- matrix spread

It must not introduce net-new claims with no backing rows.

---

## 7. Contradiction doctrine

Contradictions are first-class analytical output.

The system should distinguish:

- direct contradiction: two sources claim opposing things on the same topic
- role divergence: disagreement explained by role or process position
- scope mismatch: both claims may be true in different contexts
- unresolved conflict: not enough evidence to reconcile

Rule:

`contradiction is valuable discovery output, not a failure to summarize`

When contradiction exists:

- UI must show it explicitly
- organization synthesis cannot present false consensus
- automatic initiative handoff remains blocked for contradicted findings

---

## 8. Coverage doctrine

Wide perspective is not equal to high respondent count only.

Coverage must consider:

- stakeholder class coverage
- decision proximity
- process proximity
- department spread
- missing critical voices

The system should surface:

- missing executive voice
- missing frontline/operator voice
- missing systems owner / IT voice
- missing blocker / skeptic perspective

Rule:

`coverage posture affects claim width and confidence semantics`

---

## 9. Closed-loop action doctrine

Interview findings should be able to produce:

- initiative input
- task
- decision candidate
- risk note
- knowledge object
- clarification follow-up
- targeted re-interview

But the route is governed:

`finding -> topic synthesis -> operator decision -> bounded downstream action`

Not:

`transcript -> automatic action truth`

Important findings should not die as passive transcript content, but they also must not bypass review.

---

## 10. UI doctrine

The canonical analyst workflow should expose four read modes:

1. **Executive**
- best-supported summary
- top patterns
- contradictions
- coverage gaps

2. **Topics**
- grouped synthesis by theme/issue/opportunity
- finding status, confidence, limits, next action

3. **People**
- one card per respondent / stakeholder slice
- role and department context
- what this perspective supports or challenges

4. **Matrix**
- comparative grid `topic x person-lens`
- quickly reveals consensus, divergence, and local-only patterns

Rule:

`the UI may switch lenses, but must still resolve back to the same findings and evidence pointers`

---

## 11. Implementation posture

The practical v1 implementation should:

- reuse existing P10 findings as the only publishable truth
- introduce `candidate findings` as a persisted working layer for operator triage, not as a second truth object
- derive person/topic/matrix analytics from persisted findings plus source sessions
- support both respondent and stakeholder-lens groupings
- remain lightweight enough for Interview, not become a full research repository

Non-goal:

- full Dovetail-class workspace with arbitrary coding ontology

---

## 12. Candidate finding doctrine

The system should separate:

- `candidate finding`: a working claim that still needs operator shaping
- `P10 finding`: the publishable, auditable artifact used for review, publish, and handoff

Canonical rule:

`candidate -> triage -> finding -> review -> publish -> downstream handoff`

Candidate findings may be seeded from topic synthesis, but they must stay explicitly pre-truth.

Each candidate should carry:

- candidate statement
- rationale / preserved perspective note
- confidence hint
- triage state
- recommended next step
- back-link to the source topic / finding lineage

Allowed triage states:

- `candidate`
- `needs_evidence`
- `needs_split`
- `ready_for_review`
- `rejected`
- `promoted`

Semantics:

- `needs_evidence`: the claim is too thin or too locally supported for review
- `needs_split`: the claim contains mixed or contradictory perspectives and must be narrowed
- `ready_for_review`: the claim is shaped well enough to enter governed finding review
- `rejected`: the operator decided this should not progress
- `promoted`: the candidate has been resolved into the linked P10 finding workflow

Follow-up doctrine:

- local-only patterns should produce validation recommendations
- contradicted patterns should produce split / contradiction-seeking recommendations
- missing coverage should produce explicit re-interview or evidence collection recommendations

Important:

- candidates can help the operator work
- only findings can be published or handed off

---

## 13. Acceptance checklist

- [ ] Analytics has explicit `topic`, `person`, and `scope` dimensions.
- [ ] The system can show per-person slices without losing the wider topic pattern.
- [ ] The system can show topic syntheses without hiding minority or local-only views.
- [ ] The matrix view resolves to the same underlying findings and evidence.
- [ ] Contradictions are first-class and explicitly surfaced.
- [ ] Coverage gaps are visible and influence interpretation width.
- [ ] Candidate findings exist as a persisted operator layer before publishable findings.
- [ ] Candidate triage can mark `needs_evidence`, `needs_split`, `ready_for_review`, `rejected`, and `promoted`.
- [ ] Follow-up recommendations derive from contradiction, local-only, and coverage-gap posture.
- [ ] Executive synthesis introduces no unsupported net-new claims.
- [ ] Downstream actions still originate from governed findings, not freeform summaries.

---

## 14. Related canonical docs

- `INTERVIEW_DISCOVERY_AND_HYPOTHESIS_OPERATING_MODEL_V8.md`
- `INTERVIEW_REPORTING_AND_DASHBOARDS_V8.md`
- `INTERVIEW_INTEGRATION_AND_EXPORT_CONTRACT_V8.md`
- `INTERVIEW_EVIDENCE_CONFIDENCE_AND_TRIANGULATION_V8.md`
- `INTERVIEW_CONTRADICTION_AND_CLIENT_READBACK_RUNTIME_V8.md`
- `INBOX_AND_WORKFLOW_RUNTIME_CONTRACT_V8.md`
- `docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_10_WNIOSKI_W_INTERVIEW_2026-03-29.md`
