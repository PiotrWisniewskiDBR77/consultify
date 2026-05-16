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

### 2.1 Product decisions for Insight generation

These decisions are canonical for the next build iteration:

- Insights are generated only from approved/completed interview material. Incomplete or unapproved answers are not valid input for insight generation.
- The user selects source scope through filters: who answered, which approved sessions/templates, topic/theme focus, and timeframe.
- The user does not select individual questions, answer snippets, or arbitrary sections as the primary runtime model. The insight generator works from approved sessions filtered by people, topic, and time.
- If no topic/focus is selected, the generator produces a general consulting insight and identifies the highest-value observations itself.
- A leading question is optional. The tool must support general insight generation without forcing a question.
- `Material Quality` is generated after insight creation as a visible card, not as a blocking pre-generation gate. If answers are weak, the insight still exists and must honestly state the limitations.
- The generator must support an explicit context mode:
  - `selected_interview_material_only`
  - `selected_material_plus_approved_org_knowledge`
- Initiative creation from an insight may use all approved and confirmed organizational knowledge available to the workspace, while preserving source lineage.
- AI may propose draft candidate findings and draft P10 findings, but publishable findings still require operator review.

---

## 2A. Insight Scope Builder

`Insight Scope Builder` is the consulting brief before generation. It defines what the consultant is asking the system to analyze.

It must capture:

- `title`
- `analysis_mode`
- `topic_focus[]`
- `source_session_ids[]`
- `respondent_filters[]`
- `role_filters[]`
- `department_filters[]`
- `template_filters[]`
- `date_range`
- `context_mode`
- optional `consultant_note`
- optional `leading_question`

### 2A.1 Approved-only source rule

The source basket may include only sessions and answers that passed the approved/completed interview workflow.

Rationale:

- Insight is a consulting artifact, not a raw capture tool.
- Weak answers can still exist inside approved material, but they are surfaced as quality limitations after generation.
- Approval quality checks for answers remain upstream. Insight does not fix broken capture by silently including unapproved material.

### 2A.2 Source basket selection

The source basket supports:

- all approved sessions,
- selected approved sessions,
- filters by respondent,
- filters by role,
- filters by department,
- filters by template/assessment sheet,
- date range,
- topic/focus selection.

It does not support primary selection by:

- individual answer snippets,
- individual question IDs,
- arbitrary manual transcript fragments.

Those lower-level units remain evidence pointers and audit material inside the generated artifact.

### 2A.3 Analysis modes

The UI may show these modes in simpler language during testing, but the canonical semantics are:

| Mode | Purpose | Output emphasis |
|---|---|---|
| `general_consulting_synthesis` | General insight from selected material | best observations, themes, risks, opportunities, contradictions |
| `focused_topic_synthesis` | Analyze selected topics only | depth on one or more topics, with limits |
| `contradiction_scan` | Look for disagreement, evasions and narrative tension | contradiction cases, unresolved gaps, next clarification |
| `initiative_opportunity_scan` | Look for action potential | candidate opportunities, readiness, constraints, draft initiative inputs |
| `material_quality_scan` | Evaluate the material itself | answer quality, coverage, missing voices, evidence sufficiency |
| `hypothesis_validation` | Check selected assumptions/hypotheses | supported, contradicted, unresolved, evidence needed |
| `between_the_lines` | Consultant-style interpretation beyond direct statements | hidden signals, evasions, power/ownership tensions, confidence warnings |

Rules:

- `general_consulting_synthesis` is the default.
- Topic focus is optional.
- Modes are not separate truth systems; every claim still resolves to source evidence and P10 where publishable.
- `between_the_lines` must be clearly labeled as interpretive and must expose confidence and limits.

### 2A.4 Topic focus taxonomy

The generator should offer a curated topic list instead of forcing the user to write prompts from scratch.

Canonical focus groups:

- strategy and goals,
- process and operations,
- technology and systems,
- data and reporting,
- people and roles,
- ownership and decision rights,
- risks and blockers,
- opportunities and improvements,
- customer / user impact,
- compliance / governance,
- change readiness,
- hidden signals and contradictions.

The user may select none, one, many, or all.

When none are selected, AI chooses the highest-value consulting observations from the selected material.

### 2A.5 Context mode

`selected_interview_material_only` means:

- use only the selected approved Interview material;
- use organization context only for labels, names and permissions;
- do not import claims from other modules.

`selected_material_plus_approved_org_knowledge` means:

- use selected approved Interview material as the anchor;
- enrich interpretation with approved/confirmed organizational knowledge;
- include relevant prior insights, approved knowledge, documentation, initiatives and decisions where policy allows;
- every external context contribution must be attributable.

Rule:

`Interview material is the anchor; organizational knowledge enriches the interpretation, but cannot erase source limits or contradictions.`

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
- source basket filters
- selected topic focus
- context mode
- optional consultant note
- optional leading question

Minimum fields:

- `source_session_ids[]`
- `source_scope_status`: `approved_only`
- `respondent_filters[]`
- `role_filters[]`
- `department_filters[]`
- `template_filters[]`
- `date_range`
- `topic_focus[]`
- `analysis_mode`
- `context_mode`
- `consultant_note`
- `leading_question`

### 5.1A `InsightMaterialQuality`

Defines the quality of the selected material after generation.

Minimum fields:

- `overall_material_score`
- `answer_quality_posture`: `strong | usable | thin | poor`
- `coverage_posture`: `single_perspective | partial_coverage | good_coverage | strong_cross_function_coverage`
- `approved_session_count`
- `respondent_count`
- `role_coverage[]`
- `department_coverage[]`
- `thin_answer_count`
- `missing_voices[]`
- `evidence_gap_count`
- `contradiction_count`
- `limitations[]`
- `recommended_followups[]`

Rule:

`Material Quality is not a gate. It is the honest consulting note that tells the user how far the generated insight can safely be trusted.`

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

- report,
- presentation,
- table/workbook,
- idea,
- note,
- initiative draft,
- clarification follow-up,
- targeted re-interview.

But the route is governed:

`finding -> topic synthesis -> operator decision -> bounded downstream action`

Not:

`transcript -> automatic action truth`

Important findings should not die as passive transcript content, but they also must not bypass review.

### 9.1 Six primary actions

The `Interview Insight` action model exposes six primary downstream actions:

Documents:

1. `report`
2. `presentation`
3. `table`

Application actions:

1. `idea`
2. `note`
3. `initiative`

Rules:

- Document actions open the proper generator/builder for that artifact type.
- The generator receives the insight context and lets the user choose a template or start without a template.
- If no template is selected, AI creates a new structure from the insight context.
- If a template is selected, AI fills the selected template with the insight context.
- Application actions create governed application objects with lineage.
- An initiative from insight starts as a draft in `Interview > Initiatives`.
- Initiative drafting may use the full approved organizational knowledge base, not only the selected interview material, but must preserve provenance and confidence.
- Every action records source artifact lineage.

### 9.2 Action Composer

Before a downstream object is created, the user should understand what will be sent.

`Action Composer` shows:

- source insight,
- selected finding/candidate if applicable,
- context pack,
- confidence and limits,
- evidence count,
- selected template, if applicable,
- target object type,
- what AI is allowed to draft.

For documents, `Action Composer` lives inside or immediately before the target generator.

For initiative drafts, `Action Composer` should prepare:

- problem/opportunity statement,
- evidence-backed rationale,
- suggested scope,
- expected value hypothesis,
- risks/limits,
- owner suggestion,
- source links,
- related approved org knowledge.

---

## 10. UI doctrine

The canonical analyst workflow should expose four read modes:

1. **Executive**
- best-supported summary
- top patterns
- contradictions
- coverage gaps
- material quality posture

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

### 10.1 Material Quality card doctrine

The `Material Quality` card is a required card in the insight detail view.

It should answer:

- did we receive enough approved material to reason from?
- were answers specific or vague?
- which roles/departments are missing?
- is this a local signal or cross-perspective pattern?
- what evidence gaps remain?
- what contradictions reduce confidence?
- what follow-up would a senior consultant request?

Suggested layout:

1. `Material Fitness Score` - compact score and posture.
2. `Coverage` - sessions, respondents, roles, departments, missing voices.
3. `Answer Quality` - strong/usable/thin/poor answers, with examples.
4. `Evidence Sufficiency` - active evidence, missing evidence, weak claims.
5. `Consultant Caution` - limits and next follow-ups.

Rule:

`The card must be useful even when the material is weak. It should not block work; it should make weak foundations impossible to miss.`

---

## 11. Implementation posture

The practical v1 implementation should:

- reuse existing P10 findings as the only publishable truth
- introduce `candidate findings` as a persisted working layer for operator triage, not as a second truth object
- derive person/topic/matrix analytics from persisted findings plus source sessions
- support both respondent and stakeholder-lens groupings
- add `Insight Scope Builder` before generation
- persist analysis scope and context mode with the insight
- add `Material Quality` as a generated post-analysis card
- support AI-drafted candidate/P10 finding proposals with operator review
- route six downstream actions through an action composer/generator handoff
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

- [ ] Insight generation uses approved/completed interview material only.
- [ ] Scope Builder captures source basket filters, topic focus, analysis mode and context mode.
- [ ] The user can create a general insight without a leading question.
- [ ] The user can select none, one, many or all topic focus groups.
- [ ] Context mode distinguishes selected interview material only vs approved organizational knowledge enrichment.
- [ ] Material Quality exists as a post-generation card, not a blocking gate.
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
- [ ] Six actions exist: report, presentation, table, idea, note, initiative.
- [ ] Report/presentation/table actions open generators with insight context and optional templates.
- [ ] Initiative draft uses full approved organizational knowledge where allowed and preserves lineage.

---

## 14. Recommended build sequence

Build in this order:

1. `Insight Scope Builder 2.0`
   - approved-only source basket,
   - filters by person/role/department/template/date,
   - topic focus taxonomy,
   - analysis mode,
   - context mode,
   - optional consultant note and leading question.

2. `Scope persistence and prompt contract`
   - persist scope fields with the insight,
   - pass scope into the AI prompt,
   - make `selected_interview_material_only` vs `selected_material_plus_approved_org_knowledge` explicit in generation metadata.

3. `Material Quality card`
   - generate material fitness score,
   - show coverage posture,
   - show answer quality posture,
   - show missing voices and evidence gaps,
   - connect limits to P10 confidence and candidate triage.

4. `AI candidate/P10 finding draft flow`
   - AI seeds candidate findings,
   - operator promotes to P10,
   - AI may draft P10 wording but cannot publish without review.

5. `Action Composer`
   - report/presentation/table open target generators with context and template selection,
   - idea/note create app objects with lineage,
   - initiative draft opens in `Interview > Initiatives` and uses approved org knowledge where allowed.

6. `Review and readback hardening`
   - challenged/partial readback reduces handoff readiness,
   - contradiction scan produces explicit follow-up,
   - activity log records all mutations.

This sequence keeps the product consulting-safe: scope first, quality second, truth third, actions last.

---

## 15. Related canonical docs

- `INTERVIEW_DISCOVERY_AND_HYPOTHESIS_OPERATING_MODEL_V8.md`
- `INTERVIEW_REPORTING_AND_DASHBOARDS_V8.md`
- `INTERVIEW_INTEGRATION_AND_EXPORT_CONTRACT_V8.md`
- `INTERVIEW_EVIDENCE_CONFIDENCE_AND_TRIANGULATION_V8.md`
- `INTERVIEW_CONTRADICTION_AND_CLIENT_READBACK_RUNTIME_V8.md`
- `INBOX_AND_WORKFLOW_RUNTIME_CONTRACT_V8.md`
- `docs/product/work-packets/cursor-work/final_master/final-v8-contracts/MDI_INTERVIEW_INSIGHT_SCOPE_BUILDER_FULL_IMPLEMENTATION_PLAN_2026-05-02.md`
- `docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_10_WNIOSKI_W_INTERVIEW_2026-03-29.md`
