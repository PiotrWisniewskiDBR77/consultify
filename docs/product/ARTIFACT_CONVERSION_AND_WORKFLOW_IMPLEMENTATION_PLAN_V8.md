# Artifact Conversion And Workflow Implementation Plan v8

> Status: Draft implementation plan  
> Owner: Product + Engineering  
> Canon: `docs/product/ARTIFACT_CONVERSION_AND_WORKFLOW_CANON_V8.md`  
> Goal: implement a cross-application workflow where `Wnioski` become the shared synthesis and conversion surface, while `Inicjatywy` become the first governed execution stage for accepted action conclusions.

---

## 1. Executive summary

This change introduces one shared operating model for moving work across the application:

`source artifact -> wniosek -> readout -> conversion proposal -> target artifact`

The first user-visible outcome is:

- a top-level **Wnioski** module,
- a consistent **Convert to...** action across supported modules,
- traceable conversion from conclusions to **Inicjatywy**, **Ideas**, **Notes**, **Decisions**, **Reports**, **Presentations**, **Tables** and **Chat discussions**,
- initiative creation into the first lifecycle stage (`intake`) when a conclusion is accepted as action-worthy.

This plan should be treated as the delivery document for the next implementation wave.

---

## 2. Product outcome

### 2.1 New mental model

Users should understand the system as:

- **Source modules** collect or generate raw domain work.
- **Wnioski** decide what the work means.
- **Convert to...** decides what durable artifact should be created next.
- **Inicjatywy** own execution truth.
- **Outputs Library** owns generated documents.
- **Chat** discusses bounded context and proposes changes, but does not silently write durable truth.

### 2.2 Primary user stories

#### Project Leader

- As a Project Leader, I can open `Wnioski` and see conclusions requiring my review.
- As a Project Leader, I can convert a published conclusion into an initiative intake item.
- As a Project Leader, I can generate a sponsor readout from selected conclusions.
- As a Project Leader, I can see which initiatives and documents originated from a conclusion.

#### Sponsor

- As a Sponsor, I can review a readout without seeing every raw operational detail.
- As a Sponsor, I can approve or challenge a high-impact conversion.
- As a Sponsor, I can ask AI to explain the source evidence behind a conclusion.

#### Reviewer / Consultant

- As a Reviewer, I can triage candidate conclusions, add evidence and mark conclusions ready for readout.
- As a Reviewer, I can prepare report/presentation/table outputs from a readout.
- As a Reviewer, I can prevent weak or contradicted conclusions from becoming execution initiatives.

#### Viewer

- As a Viewer, I can see published conclusions and generated outputs within my scope.

---

## 3. Target navigation model

### 3.1 Top-level navigation

Add or promote two clear product destinations:

1. **Wnioski**
   - cross-module synthesis,
   - review queue,
   - readout creation,
   - artifact conversion,
   - source-to-target lineage.

2. **Inicjatywy**
   - execution intake,
   - triage,
   - planning,
   - approval,
   - execution.

### 3.2 Wnioski module sections

The initial module should contain five sections:

| Section | Purpose | Primary users |
| --- | --- | --- |
| `Inbox / Do przeglądu` | Queue of conclusions needing evidence, review, sponsor decision or conversion approval | Leader, Reviewer |
| `Biblioteka` | Searchable list of governed conclusions across supported source modules | Leader, Reviewer, Sponsor |
| `Readout` | Sponsor/team discussion view; research summary, strongest claims, risks, opportunities, gaps | Leader, Sponsor |
| `Konwersje` | Conversion proposals, completed conversions, failures and retries | Leader, Reviewer |
| `Dokumenty` | Reports, presentations and tables generated from conclusions/readouts | Leader, Sponsor, Viewer |

### 3.3 Supported entrypoints in phase 1

The first implementation should support:

- Interview finding,
- Interview readout/research report,
- Assessment recommendation/gap,
- Tool output.

The UI can initially show other source filters as disabled roadmap items.

---

## 4. Functional object model

### 4.1 `Conclusion` / `Wniosek`

Use `Conclusion` as the technical term and `Wniosek` as the product label.

Minimum fields:

```ts
type Conclusion = {
  id: string;
  organizationId: string;
  projectId?: string | null;
  title: string;
  statement: string;
  sourceModule: 'interview' | 'assessment' | 'tools' | 'idea' | 'note' | 'decision' | 'finance' | 'kpi' | 'chat' | 'manual';
  sourceArtifactRefs: ArtifactRef[];
  sourcePackRef?: string | null;
  confidenceLevel: 'high' | 'medium' | 'low' | 'insufficient' | 'contradicted';
  limits: string;
  evidenceRefs: ArtifactEvidenceRef[];
  recommendedNextAction?: string | null;
  status:
    | 'candidate'
    | 'needs_evidence'
    | 'needs_review'
    | 'ready_for_readout'
    | 'published'
    | 'converted'
    | 'rejected';
  ownerId?: string | null;
  reviewerId?: string | null;
  sponsorId?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};
```

### 4.2 `SourcePack`

The source pack is the bounded context bundle used by Wnioski, Convert to and Chat.

Minimum fields:

```ts
type SourcePack = {
  id: string;
  organizationId: string;
  projectId?: string | null;
  sourceModule: string;
  sourceArtifactRefs: ArtifactRef[];
  evidenceRefs: ArtifactEvidenceRef[];
  capturedExcerpts: Array<{
    ref: string;
    text: string;
    capturedAt: string;
    redacted?: boolean;
  }>;
  contextSummary: string;
  limitations: string[];
  freshness: {
    capturedAt: string;
    sourceUpdatedAt?: string | null;
    driftDetected?: boolean;
  };
};
```

### 4.3 `Conversion`

Conversion is the governed transition from source conclusion to target artifact.

Minimum fields:

```ts
type ArtifactConversion = {
  id: string;
  organizationId: string;
  projectId?: string | null;
  sourceConclusionId?: string | null;
  sourceArtifactType: string;
  sourceArtifactId: string;
  sourceArtifactTitle: string;
  sourceModule: string;
  targetArtifactType:
    | 'initiative'
    | 'idea'
    | 'note'
    | 'decision'
    | 'task'
    | 'report'
    | 'presentation'
    | 'table'
    | 'chat_discussion'
    | 'kpi'
    | 'finance_scenario';
  targetArtifactId?: string | null;
  conversionIntent: string;
  conversionStatus: 'draft' | 'proposed' | 'approved' | 'converted' | 'rejected' | 'failed' | 'cancelled';
  confidenceLevel?: string | null;
  limits?: string | null;
  evidenceRefs: ArtifactEvidenceRef[];
  sourcePack: SourcePack;
  payload: Record<string, unknown>;
  createdBy: string;
  approvedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  errorMessage?: string | null;
};
```

### 4.4 `Readout`

Readout is derived, not independent truth.

Minimum fields:

```ts
type ConclusionReadout = {
  id: string;
  organizationId: string;
  projectId?: string | null;
  title: string;
  sourceConclusionIds: string[];
  summary: string;
  sections: {
    researchSummary: string;
    strongestConclusions: string[];
    risks: string[];
    opportunities: string[];
    contradictions: string[];
    coverageGaps: string[];
    decisionsNeeded: string[];
    proposedConversions: string[];
  };
  visibilityScope: 'private' | 'project' | 'organization' | 'review_shared';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};
```

---

## 5. Backend implementation plan

### 5.1 New database tables

Add migrations for:

1. `conclusions`
2. `conclusion_source_packs`
3. `artifact_conversions`
4. `conclusion_readouts`
5. `artifact_conversion_events`

#### `conclusions`

Required columns:

- `id`
- `organization_id`
- `project_id`
- `title`
- `statement`
- `source_module`
- `source_artifact_refs_json`
- `source_pack_id`
- `confidence_level`
- `limits_text`
- `evidence_refs_json`
- `recommended_next_action`
- `status`
- `owner_id`
- `reviewer_id`
- `sponsor_id`
- `created_by`
- `created_at`
- `updated_at`

Indexes:

- `(organization_id, project_id)`
- `(organization_id, status)`
- `(organization_id, source_module)`
- `(organization_id, confidence_level)`

#### `artifact_conversions`

Required columns:

- `id`
- `organization_id`
- `project_id`
- `source_conclusion_id`
- `source_artifact_type`
- `source_artifact_id`
- `source_artifact_title`
- `source_module`
- `target_artifact_type`
- `target_artifact_id`
- `conversion_intent`
- `conversion_status`
- `confidence_level`
- `limits_text`
- `evidence_refs_json`
- `source_pack_json`
- `payload_json`
- `created_by`
- `approved_by`
- `error_message`
- `created_at`
- `updated_at`

Indexes:

- `(organization_id, source_artifact_type, source_artifact_id)`
- `(organization_id, target_artifact_type, target_artifact_id)`
- `(organization_id, conversion_status)`
- `(organization_id, project_id)`

### 5.2 Services

Add:

- `server/src/services/artifacts/ArtifactConversionService.ts`
- `server/src/services/conclusions/ConclusionService.ts`
- `server/src/services/conclusions/ConclusionReadoutService.ts`
- `server/src/services/conclusions/SourcePackService.ts`

#### `ConclusionService`

Responsibilities:

- create/update/list conclusions,
- map source-specific artifacts into conclusions,
- enforce status transitions,
- validate confidence/evidence/limits,
- expose project-scoped and org-scoped queries.

Core methods:

- `listConclusions(params)`
- `getConclusion(id)`
- `createConclusion(input, actor)`
- `updateConclusion(id, patch, actor)`
- `transitionConclusion(id, action, actor)`
- `publishConclusion(id, actor)`
- `rejectConclusion(id, actor)`

#### `SourcePackService`

Responsibilities:

- build bounded source packs from source modules,
- normalize evidence references,
- preserve source excerpts and limitations,
- detect missing evidence and source drift where supported.

Core methods:

- `buildForInterviewFinding(findingId, actor)`
- `buildForAssessmentRecommendation(recommendationId, actor)`
- `buildForToolOutput(toolSessionId, outputRef, actor)`
- `getSourcePack(id, actor)`

#### `ArtifactConversionService`

Responsibilities:

- propose conversions,
- infer allowed target types,
- validate source and target permissions,
- build target payloads,
- create target artifacts after explicit approval,
- record lineage and audit,
- handle downstream failure and retry.

Core methods:

- `getAllowedTargets(sourceRef, actor)`
- `proposeConversion(input, actor)`
- `approveConversion(conversionId, actor)`
- `executeConversion(conversionId, actor)`
- `retryConversion(conversionId, actor)`
- `listConversions(params, actor)`

#### `ConclusionReadoutService`

Responsibilities:

- build readout from selected conclusions,
- keep readout derived from source conclusions,
- generate document/presentation/table payloads from readout,
- open chat context from readout.

Core methods:

- `buildReadout(conclusionIds, actor)`
- `getReadout(id, actor)`
- `generateReport(readoutId, actor)`
- `generatePresentation(readoutId, actor)`
- `generateTable(readoutId, actor)`
- `buildChatContext(readoutId, actor)`

### 5.3 API routes

Add:

- `server/src/routes/conclusions.routes.ts`
- `server/src/routes/artifact-conversions.routes.ts`

Mount:

- `/api/conclusions`
- `/api/artifact-conversions`

Recommended routes:

```txt
GET    /api/conclusions
POST   /api/conclusions
GET    /api/conclusions/:id
PATCH  /api/conclusions/:id
POST   /api/conclusions/:id/transition
POST   /api/conclusions/:id/publish
POST   /api/conclusions/:id/reject
GET    /api/conclusions/:id/source-pack

POST   /api/conclusions/readouts
GET    /api/conclusions/readouts/:id
POST   /api/conclusions/readouts/:id/generate-report
POST   /api/conclusions/readouts/:id/generate-presentation
POST   /api/conclusions/readouts/:id/generate-table
POST   /api/conclusions/readouts/:id/open-chat

GET    /api/artifact-conversions
POST   /api/artifact-conversions/propose
GET    /api/artifact-conversions/:id
POST   /api/artifact-conversions/:id/approve
POST   /api/artifact-conversions/:id/convert
POST   /api/artifact-conversions/:id/retry
POST   /api/artifact-conversions/:id/reject
```

### 5.4 Integration with existing modules

#### Interview

Bridge existing P10 findings to conclusions.

Initial mapping:

- `interview_insight_findings.id` -> `conclusions.source_artifact_id`
- `finding_statement` -> `statement`
- `confidence_level` -> `confidence_level`
- `limits` -> `limits_text`
- `next_action` -> `recommended_next_action`
- `evidence_pointers` -> `evidence_refs_json`

Do not duplicate Interview answer storage.

#### Initiatives

Conversion to initiative should call canonical initiative creation logic.

Initial target lifecycle:

- create initiative in `intake`,
- attach source/conclusion refs,
- create activity log entry,
- show origin in initiative detail.

Do not create an alternative initiative table or lifecycle.

#### Outputs Library

Generated report/presentation/table should be registered as output artifacts using existing artifact registry/output runtime contracts.

Do not store generated documents only in Wnioski.

#### Chat

Chat should receive:

- selected conclusion ids,
- source pack summary,
- evidence refs,
- limits,
- readout id where relevant.

Chat can propose conversions, but must route writes through `ArtifactConversionService`.

---

## 6. Frontend implementation plan

### 6.1 New module

Add a top-level module:

- route: `/conclusions` or `/wnioski`
- product label: `Wnioski`
- component root: `src/components/Conclusions/ConclusionsHub.tsx`

Recommended component structure:

```txt
src/components/Conclusions/
  ConclusionsHub.tsx
  ConclusionsInbox.tsx
  ConclusionsLibrary.tsx
  ConclusionReadout.tsx
  ConclusionConversions.tsx
  ConclusionDocuments.tsx
  ConclusionPreview.tsx
  ConclusionDetail.tsx
  SourcePackPanel.tsx
```

### 6.2 Shared conversion UI

Add shared components:

```txt
src/components/shared/artifact-conversion/
  ConvertToButton.tsx
  ArtifactConversionModal.tsx
  ConversionTargetPicker.tsx
  ConversionSourceSummary.tsx
  ConversionPayloadPreview.tsx
  ConversionLineageCard.tsx
```

The modal should have four steps:

1. **Target**
   - choose Initiative, Idea, Note, Decision, Report, Presentation, Table, Chat.

2. **Context**
   - show source, evidence, limits, confidence.

3. **Draft**
   - show proposed title, summary, owner, project, payload.

4. **Confirm**
   - show what will be created and where it will appear.

### 6.3 Wnioski list UX

The main Wnioski list should follow the app table standard:

Columns:

- title,
- source,
- status,
- confidence,
- project,
- owner,
- sponsor,
- evidence count,
- last updated,
- conversion state.

Primary row actions:

- open,
- review,
- convert to,
- discuss with AI,
- create readout,
- view lineage.

### 6.4 Wnioski detail UX

The detail view should have:

- header with status, confidence and source,
- statement,
- limits,
- evidence/source pack,
- recommended next action,
- readout inclusion,
- conversions and created artifacts,
- AI discussion entry.

### 6.5 Readout UX

Readout should be sponsor-ready.

Sections:

- study/source summary,
- strongest conclusions,
- risks,
- opportunities,
- contradictions,
- coverage gaps,
- decisions needed,
- proposed conversions.

Actions:

- discuss with AI,
- generate report,
- generate presentation,
- generate table,
- convert selected conclusions to initiatives.

### 6.6 Initiative intake UX

After conversion:

- show success toast with link to created initiative,
- initiative opens in `intake`,
- origin panel shows source conclusion and source artifact,
- activity log shows conversion event.

---

## 7. Permissions and role model

### 7.1 Capabilities

Add capabilities:

- `conclusions.view`
- `conclusions.create`
- `conclusions.review`
- `conclusions.publish`
- `conclusions.convert`
- `conclusions.convert.initiative`
- `conclusions.convert.document`
- `conclusions.readout.create`
- `artifact_conversions.view`
- `artifact_conversions.approve`
- `artifact_conversions.execute`
- `artifact_conversions.retry`
- `initiatives.intake.create`
- `outputs.create_from_conclusion`
- `chat.discuss_artifact`

### 7.2 Role defaults

Recommended defaults:

| Role / project capability | View | Review | Publish | Convert to initiative | Generate documents | Approve high-impact |
| --- | --- | --- | --- | --- | --- | --- |
| Owner/Admin | yes | yes | yes | yes | yes | yes |
| Project Leader | yes | yes | yes | yes | yes | project scope |
| Sponsor | yes | comment/approve | approve readout | approve/request | yes | yes |
| Reviewer/Consultant | yes | yes | propose | propose | yes | no |
| Contributor | own/source scoped | no | no | no | no | no |
| Viewer | published only | no | no | no | no | no |

### 7.3 Permission rules

- Source visibility is required to create a conversion from that source.
- Target creation permission is required to execute conversion.
- Sponsor approval may be required for high-impact or cross-project conversions.
- Weak or contradicted conclusions require an investigation target or explicit override path.

---

## 8. Delivery packets

### Packet A — Canon closure and route skeleton

Scope:

- accept canon and implementation plan,
- add route placeholders,
- add feature flag,
- add capability names.

DoD:

- docs accepted,
- feature flag exists,
- no UI behavior changes outside navigation placeholders.

### Packet B — Data model and services

Scope:

- migrations for conclusions/source packs/conversions/readouts/events,
- service skeletons,
- unit tests for status transitions and conversion validation.

DoD:

- migrations run locally,
- services pass unit tests,
- conversion cannot execute without source and target validation.

### Packet C — Interview bridge

Scope:

- map Interview P10 findings into conclusions,
- expose Interview conclusions in Wnioski,
- support Convert to Initiative from Interview finding through shared service.

DoD:

- published Interview finding appears in Wnioski,
- conversion record is created,
- initiative appears in `intake`,
- lineage visible on both sides.

### Packet D — Wnioski module UI

Scope:

- add Wnioski navigation,
- implement Inbox, Library, Detail and Conversions,
- implement shared `Convert to...` modal for Initiative, Note and Chat discussion.

DoD:

- leader can review and convert a conclusion,
- sponsor can open readout/detail,
- viewer sees only published scoped conclusions.

### Packet E — Readout and documents

Scope:

- implement readout builder,
- generate report/presentation/table from readout,
- register outputs in Outputs Library.

DoD:

- selected conclusions create a readout,
- readout can generate report and presentation,
- generated artifacts have provenance/trust state.

### Packet F — Expand sources

Scope:

- add Assessment recommendations,
- add Tool outputs,
- add Ideas/Notes/Decisions,
- add Finance/KPI signals.

DoD:

- each source uses the same `Convert to...` modal,
- no module-specific conversion semantics are forked.

### Packet G — Hardening and staging proof

Scope:

- end-to-end tests,
- permission tests,
- degraded/failure states,
- staging proof scripts.

DoD:

- no source-less initiative can be created through conversion,
- failed downstream conversion can be retried,
- generated documents preserve lineage,
- chat cannot silently write target artifacts.

---

## 9. Acceptance test scenarios

### Scenario 1 — Interview finding to initiative

1. Create/choose a published Interview finding with evidence.
2. Open Wnioski.
3. Confirm the finding appears in Biblioteka.
4. Click `Convert to...`.
5. Choose `Initiative`.
6. Review payload and confirm.
7. Open Inicjatywy.
8. Verify new initiative exists in `intake`.
9. Verify initiative shows source conclusion and Interview evidence backlink.

### Scenario 2 — Weak conclusion blocked from execution initiative

1. Choose a conclusion with `insufficient` or `contradicted` confidence.
2. Click `Convert to...`.
3. Choose `Initiative`.
4. Verify system blocks execution initiative or limits target to investigation/idea/note.
5. Verify reason is visible and actionable.

### Scenario 3 — Readout to sponsor presentation

1. Select several published conclusions.
2. Create readout.
3. Generate presentation.
4. Verify presentation appears in Outputs Library.
5. Verify presentation links back to readout and source conclusions.

### Scenario 4 — Discuss with AI

1. Open conclusion detail.
2. Click `Discuss with AI`.
3. Verify chat opens with source pack, evidence summary and limits.
4. Ask AI to propose next action.
5. Verify proposed target artifact requires explicit user acceptance before write.

### Scenario 5 — Permission boundary

1. Use a Viewer account.
2. Open Wnioski.
3. Verify only published scoped conclusions are visible.
4. Verify Convert actions are hidden/disabled.
5. Use Project Leader account.
6. Verify Convert actions are available only inside project scope.

---

## 10. Risks and controls

| Risk | Control |
| --- | --- |
| Wnioski becomes another disconnected module | All source and target relations go through `ArtifactConversionService` and LinkGraph/provenance |
| Initiative source truth is lost | Conversion to initiative requires source pack and backlink |
| Weak AI claims become execution work | Confidence/limits/evidence gates block or downgrade target type |
| Users see too much complexity | Source materialization is invisible by default; lineage visible when needed |
| Duplicate initiatives | Conversion flow checks existing initiatives before create |
| Documents become temporary exports | Generated docs are registered in Outputs Library |
| Chat silently creates durable truth | Chat proposals must be accepted through conversion service |
| Permission mismatch | Source and target permissions are validated independently |

---

## 11. Implementation order recommendation

Build in this order:

1. Lock docs and naming.
2. Add database tables and backend services.
3. Implement shared conversion API.
4. Bridge Interview P10 findings into conclusions.
5. Add Wnioski module with Library and Detail.
6. Add Convert to Initiative.
7. Add Initiative origin panel.
8. Add Readout.
9. Add document generation from Readout.
10. Add Chat discussion.
11. Expand to Assessment and Tools.
12. Expand to Ideas, Notes, Decisions, Finance and KPI.

Do not start by building all source integrations.

The first vertical slice should be:

`Interview P10 finding -> Wnioski -> Convert to Initiative -> Initiative intake + lineage`

Then:

`Wnioski Readout -> Report/Presentation -> Outputs Library + lineage`

---

## 12. Definition of done

The comprehensive change is done when:

- Wnioski exists as a top-level module.
- Interview P10 findings appear as conclusions.
- Project Leader can convert a published conclusion to an initiative intake item.
- Initiative shows source conclusion and evidence backlink.
- Readout can generate report and presentation.
- Generated documents are in Outputs Library with provenance.
- Chat can discuss a conclusion/readout with bounded context.
- Permissions are project-aware and role-aware.
- Failed conversions are visible and retryable.
- Tests cover happy path, weak evidence, contradiction, permission denial and downstream failure.

---

## 13. Documentation updates required after implementation

After delivery, update:

- `docs/product/ARTIFACT_CONVERSION_AND_WORKFLOW_CANON_V8.md`
- `docs/product/INITIATIVE_ENTRYPOINTS_AND_SOURCE_GOVERNANCE_V8.md`
- `docs/product/ARTIFACT_LINKING_V5_SSOT.md`
- `docs/product/INTERVIEW_INSIGHT_ANALYTICS_AND_CLOSED_LOOP_ACTIONS_V8.md`
- `docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`
- role/capability source of truth documents
- manual staging test process and evidence ledger
