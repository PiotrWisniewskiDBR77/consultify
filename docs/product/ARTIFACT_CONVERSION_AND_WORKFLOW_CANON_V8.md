# Artifact Conversion And Workflow Canon v8

> Status: Draft v8  
> Owner: Product + Engineering  
> Scope: shared product and technical doctrine for turning conclusions, outputs and source artifacts into actions, documents and governed initiatives across Interview, Tools, Assessments, Ideas, Notes, Decisions, Finance, KPI and Chat.

---

## 1. Why this document exists

Consultify cannot scale as a set of isolated modules where every surface has its own "create initiative", "create note", "create report" or "send to chat" logic.

The product needs one shared work grammar:

`artifact -> conclusion -> conversion intent -> target artifact`

This document defines that grammar.

It also defines the functional role of two primary navigation surfaces:

- **Wnioski**: the cross-application place where conclusions are reviewed, summarized, discussed and converted into documents or actions.
- **Inicjatywy**: the first governed execution lane where accepted action-oriented conclusions become operational work.

---

## 2. Core product statement

The system should help users move from evidence to action without losing source truth.

Canonical rule:

`artifacts must become other artifacts through traceable conversion, not through disconnected module-specific shortcuts`

This means:

- a conclusion can be created from Interview, Tools, Assessments, Chat, Ideas, Notes, Finance, KPI or manual analysis,
- the conclusion is reviewed in a shared `Wnioski` surface when it has decision value,
- the user can convert it to a target artifact such as Initiative, Idea, Note, Decision, Report, Presentation, Table or Chat discussion,
- every conversion preserves source, confidence, limits, evidence, actor, timestamp and backlink lineage.

---

## 3. Functional doctrine

### 3.1 Badanie / source work remains the input

Source modules remain responsible for their own raw input and domain runtime:

- Interview owns sessions, assignments, answers and interview evidence.
- Tools owns tool sessions and tool-specific outputs.
- Assessment owns assessments, gaps, recommendations and assessment reports.
- Finance owns financial models, scenarios and assumptions.
- KPI owns measurements, deviations and metric context.
- Chat owns bounded conversation context and selected excerpts.
- Ideas, Notes and Decisions own their native user-authored work objects.

Rule:

`source modules own collection and domain work; Wnioski owns cross-module synthesis and conversion readiness`

### 3.2 Wnioski are the synthesis and decision-prep layer

`Wnioski` should not be only an Interview tab.

Long-term, `Wnioski` is a cross-application module that collects governed conclusions from many sources.

It answers:

- what do we know,
- where did it come from,
- how confident are we,
- what are the limits,
- what should we discuss,
- what should be created next.

### 3.3 Inicjatywy are the first execution stage

`Inicjatywy` should not absorb every early thought.

Only action-oriented conclusions that have enough shape should enter the Initiative lifecycle.

Rule:

`Wniosek can propose action; Inicjatywa owns execution truth`

The first stage for a converted initiative should be:

- `intake` when the action is captured but not yet clarified,
- then `triage` when leader/sponsor/reviewer clarifies owner, goal, scope and readiness.

### 3.4 Documents are output artifacts, not temporary exports

Reports, presentations and tables generated from conclusions should become first-class artifacts in the Outputs Library.

Rule:

`Wnioski may initiate document generation; Outputs Library remains the durable home for generated documents`

### 3.5 Chat is a discussion surface over bounded context

Chat may discuss a conclusion, research run, initiative candidate or generated report, but it should receive a bounded context pack.

Rule:

`Chat explores and refines; it does not silently create durable truth without explicit user acceptance`

---

## 4. Canonical artifact flow

### 4.1 End-to-end grammar

The shared flow is:

`Source Artifact -> Source Pack -> Wniosek -> Readout -> Conversion Intent -> Target Artifact -> Lineage`

Where:

- `Source Artifact` is the original object, e.g. interview finding, assessment gap, tool output, KPI signal.
- `Source Pack` is the bounded evidence/context bundle.
- `Wniosek` is the reviewed conclusion object.
- `Readout` is the human-readable synthesis for discussion.
- `Conversion Intent` is the user's explicit decision about what should be created.
- `Target Artifact` is the durable result, e.g. initiative, idea, note, decision, report, presentation, table.
- `Lineage` is the permanent trace between source and target.

### 4.2 Conversion examples

| Source | Wniosek type | Allowed target artifacts |
| --- | --- | --- |
| Interview finding | organizational finding / risk / opportunity | Initiative, Idea, Note, Decision, Report, Presentation, Chat |
| Interview research report | audit readout | Report, Presentation, Table, Chat, Initiative set |
| Assessment gap | gap / recommendation | Initiative, Decision, Report, KPI |
| Tool output | recommendation / analysis result | Initiative, Idea, Note, Report, Table |
| KPI signal | deviation / risk / improvement signal | Initiative, Decision, Note, Finance scenario |
| Finance analysis | risk / scenario / investment case | Decision, Initiative, Presentation, Table |
| Idea | concept / opportunity | Initiative, Note, Presentation |
| Note | observation / meeting output | Idea, Decision, Task, Initiative candidate |
| Decision | approved direction | Initiative, Task, KPI, Report |
| Chat insight | selected conclusion | Note, Idea, Decision draft, Report draft |

---

## 5. Wnioski module target behavior

### 5.1 Navigation

The application should expose a top-level `Wnioski` entry.

It should contain:

1. **Inbox / Do przeglądu**
   - conclusions requiring review,
   - weak evidence,
   - contradictions,
   - sponsor/leader approval needed,
   - AI-proposed conclusions waiting for human acceptance.

2. **Biblioteka wniosków**
   - all governed conclusions visible to the current role and scope,
   - filters by source, project, confidence, status, owner, evidence class, target conversion.

3. **Readout / Podsumowanie**
   - executive synthesis,
   - research/audit summary,
   - top risks, opportunities, contradictions and coverage gaps,
   - sponsor-ready discussion mode.

4. **Konwersje**
   - pending, failed and completed conversions,
   - source-to-target lineage,
   - retry or resolve when downstream creation failed.

5. **Dokumenty**
   - reports, presentations, sheets created from conclusions,
   - backed by Outputs Library, not separate storage.

### 5.2 Conclusion object

Minimum fields:

- `id`
- `organization_id`
- `project_id`
- `title`
- `statement`
- `source_artifact_refs[]`
- `source_pack_ref`
- `source_module`
- `confidence_level`
- `limits`
- `evidence_refs[]`
- `recommended_next_action`
- `status`
- `owner_id`
- `reviewer_id`
- `sponsor_id`
- `created_by`
- `created_at`
- `updated_at`

Recommended statuses:

- `candidate`
- `needs_evidence`
- `needs_review`
- `ready_for_readout`
- `published`
- `converted`
- `rejected`

### 5.3 Readout object

The readout is not a second truth object.

It is a derived presentation layer over conclusions.

Minimum sections:

- research / source work summary,
- strongest conclusions,
- risks,
- opportunities,
- contradictions,
- coverage gaps,
- decisions needed,
- proposed conversions.

Rule:

`Readout may summarize, but must not introduce claims without source conclusions`

---

## 6. Inicjatywy module target behavior

### 6.1 Initiative creation from Wnioski

When the user converts a conclusion to an initiative, the system should create:

- canonical initiative in `intake`,
- source materialization according to initiative source governance,
- source/context snapshot,
- backlink to conclusion and source artifacts,
- activity/audit record.

The user-facing flow should be simple:

1. User selects one or more conclusions.
2. Clicks `Convert to...`.
3. Chooses `Initiative`.
4. Reviews AI/user prefilled intake draft.
5. Confirms owner, sponsor, scope and project.
6. Initiative appears in `Inicjatywy` in the first stage.

### 6.2 Initiative intake payload

Minimum payload from Wnioski:

- `source_conclusion_id`
- `source_artifact_refs[]`
- `source_module`
- `title`
- `problem_or_opportunity`
- `why_now`
- `confidence_level`
- `limits`
- `evidence_refs[]`
- `recommended_next_action`
- `suggested_owner_id`
- `suggested_sponsor_id`
- `target_project_id`
- `context_pack`

### 6.3 Guards

Conversion to Initiative should require:

- allowed actor in target project scope,
- sufficient evidence for the proposed action type,
- explicit limits,
- no unresolved contradiction unless user chooses an investigation initiative,
- duplicate check against existing initiatives,
- explicit acceptance before write.

Weak conclusions may create:

- Idea,
- Note,
- follow-up interview,
- investigation task,

but should not silently become an execution initiative.

---

## 7. Shared conversion framework

### 7.1 Product surface

Every participating module should expose the same action:

`Convert to...`

The menu should support:

- Initiative,
- Idea,
- Note,
- Decision,
- Task,
- Report,
- Presentation,
- Table,
- Chat discussion,
- KPI,
- Finance scenario.

The modal should always show:

- source,
- target,
- what will be copied,
- evidence and limits,
- owner/project/scope,
- whether approval is required,
- created artifact preview.

### 7.2 Technical service

Introduce a shared service:

`ArtifactConversionService`

Responsibilities:

- validate source artifact and actor permissions,
- build bounded source pack,
- infer allowed target artifact types,
- prepare target payload,
- create conversion proposal,
- perform write only after acceptance,
- record lineage and audit,
- handle retry and downstream failure safely.

### 7.3 Data model

Introduce a shared table:

`artifact_conversions`

Minimum fields:

- `id`
- `organization_id`
- `project_id`
- `source_artifact_type`
- `source_artifact_id`
- `source_artifact_title`
- `source_module`
- `target_artifact_type`
- `target_artifact_id`
- `conversion_intent`
- `conversion_status`
- `confidence_level`
- `limits`
- `evidence_refs_json`
- `payload_json`
- `source_pack_json`
- `created_by`
- `approved_by`
- `created_at`
- `updated_at`
- `error_message`

Statuses:

- `draft`
- `proposed`
- `approved`
- `converted`
- `rejected`
- `failed`
- `cancelled`

### 7.4 API shape

Recommended routes:

- `POST /api/artifact-conversions/propose`
- `POST /api/artifact-conversions/:id/approve`
- `POST /api/artifact-conversions/:id/convert`
- `POST /api/artifact-conversions/:id/retry`
- `GET /api/artifact-conversions/:id`
- `GET /api/artifact-conversions?source=...`
- `GET /api/artifact-conversions?target=...`

### 7.5 Frontend components

Shared components:

- `ConvertToButton`
- `ArtifactConversionModal`
- `ConversionPreviewPanel`
- `SourcePackSummary`
- `ConversionLineageCard`

Rule:

`modules may configure conversion options, but must not fork conversion semantics`

---

## 8. Roles and permissions

The feature should be project-scope aware, not admin-only.

Recommended roles:

- **Project Leader**: reviews conclusions, creates initiatives/documents, assigns owners.
- **Sponsor**: approves readout direction, accepts high-impact conversions, comments.
- **Reviewer / Consultant**: triages conclusions, prepares readout, proposes conversions.
- **Contributor**: can contribute source input and see assigned outputs.
- **Viewer**: sees published conclusions and approved outputs.

Recommended capabilities:

- `conclusions.view`
- `conclusions.review`
- `conclusions.publish`
- `conclusions.convert`
- `conclusions.convert.initiative`
- `conclusions.convert.document`
- `artifact_conversions.view`
- `artifact_conversions.approve`
- `artifact_conversions.retry`
- `initiatives.intake.create`
- `outputs.create_from_conclusion`
- `chat.discuss_artifact`

Rule:

`permission to see a source artifact does not automatically mean permission to create every target artifact`

---

## 9. Implementation roadmap

### Phase 0 — Canon and naming lock

Goal:

- approve this doctrine,
- decide whether `Wnioski` is top-level module name,
- align wording with UI navigation.

Deliverables:

- this document accepted as source of truth,
- artifact type dictionary,
- conversion capability list,
- first UX wireframe for `Wnioski` and `Convert to...`.

### Phase 1 — Shared conversion foundation

Goal:

- create `artifact_conversions`,
- implement `ArtifactConversionService`,
- implement shared `Convert to...` modal,
- record lineage without forcing every module to migrate immediately.

First supported sources:

- Interview P10 finding,
- Interview research/readout,
- Assessment recommendation,
- Tool output.

First supported targets:

- Initiative,
- Idea,
- Note,
- Report,
- Presentation,
- Chat discussion.

### Phase 2 — Wnioski as module surface

Goal:

- add top-level `Wnioski`,
- show cross-module conclusion library,
- support Inbox, Library, Readout, Conversions and Documents views.

Initial implementation can reuse Interview Insights as the first populated source.

### Phase 3 — Initiative intake integration

Goal:

- convert conclusion to canonical initiative intake,
- create initiative in first stage,
- show source lineage inside Initiative,
- duplicate-check against existing initiatives.

Acceptance:

- a published Interview finding can become an initiative in `intake`,
- initiative shows origin from Wnioski,
- conversion record links both sides.

### Phase 4 — Outputs and chat integration

Goal:

- generate report/presentation/table from Wnioski readout,
- store generated documents in Outputs Library,
- open chat with bounded conclusion/readout context.

Acceptance:

- user can discuss a readout with AI,
- generate sponsor presentation,
- generate audit report,
- see both in Outputs Library with provenance.

### Phase 5 — Expand sources

Goal:

- add Tools, Assessments, Ideas, Notes, Decisions, Finance and KPI as first-class sources.

Acceptance:

- all participating modules use the same `Convert to...` pattern,
- conversions are visible in Wnioski and artifact lineage.

---

## 10. Acceptance criteria

This plan is implemented when:

- `Wnioski` is visible as the common synthesis surface,
- `Inicjatywy` receives accepted action conclusions as intake-stage initiatives,
- every conversion has source, target, actor, evidence, limits and backlink,
- generated documents land in Outputs Library,
- AI chat can discuss bounded source packs,
- weak or contradicted conclusions cannot silently become execution initiatives,
- project leader/sponsor/reviewer permissions drive the workflow,
- no module owns a private, incompatible conversion model.

---

## 11. Related canonical docs

- `docs/product/ARTIFACT_CONVERSION_AND_WORKFLOW_IMPLEMENTATION_PLAN_V8.md`
- `docs/product/ARTIFACT_LINKING_V5_SSOT.md`
- `docs/product/INITIATIVE_ENTRYPOINTS_AND_SOURCE_GOVERNANCE_V8.md`
- `docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_11_INICJATYWY_2026-03-29.md`
- `docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_18_PROVENANCE_REVIEW_VISIBILITY_2026-03-29.md`
- `docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`
- `docs/product/INTERVIEW_INSIGHT_ANALYTICS_AND_CLOSED_LOOP_ACTIONS_V8.md`
- `docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_10_WNIOSKI_W_INTERVIEW_2026-03-29.md`
