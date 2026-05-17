---
module_id: MODULE_INITIATIVES
contract_id: INITIATIVE_TRANSFER_BACKBONE
doc_kind: GAP_ANALYSIS
version: 1.0
owner: user
status: canonical_draft
last_updated: 2026-05-10
---

# Initiative Transfer Backbone Gap Analysis

## 1. Purpose

This document defines what is missing for Consultify to treat Initiative as the main transfer backbone from discovery and diagnosis into planning, execution and results.

It is intentionally broader than the Initiative Card contract. The card is the visible UI artefact; the transfer backbone is the system contract behind it:

`source evidence -> initiative candidates -> initiative validation sheet -> approved initiative -> tasks/decisions/RAID/milestones -> execution -> KPI/ROI/results evidence`

This document is docs-only. It does not authorize runtime changes.

## 2. Scope

In scope:

- Source families that can create, propose, link or justify initiatives.
- Smart generators for tools, assessments and interview.
- Simple create/link CTAs from chat, MyWork, finance and KPI/results contexts.
- Source/provenance/audit requirements.
- Initiative sheet readiness.
- Task and decision decomposition.
- Person-level task assignment independent of initiative ownership.
- Gaps in documentation, runtime, tests and UX.

Out of scope:

- Runtime implementation.
- Schema migration design.
- Benchmarking against RAW competitor/app material. That comes next.
- Changing source-of-truth hierarchy without explicit approval.

## 3. Current Canon Conflict

The largest blocker is a source doctrine conflict.

`docs/product/SOURCE_TRACEABILITY_SPEC.md` currently says initiatives can be created only from:

- `ToolSession`
- `AssessmentReport`

Runtime and product intent are broader. Initiatives may also originate from:

- interview findings,
- simple conversations / Teresa chat,
- MyWork ideas, notes, tables or maps,
- finance analysis,
- KPI/results evidence,
- imported reports or related diagnostic artefacts.

Resolution required:

The system should move from "only two source artefacts" to "every initiative has an auditable source envelope". `ToolSession` and `AssessmentReport` remain valid source envelopes, but not the only valid ones.

## 4. Target Backbone Model

### 4.1 Source To Initiative

An initiative can be created only when the system can answer:

- What source triggered it?
- What evidence was used?
- Was it generated, manually created, linked, promoted or imported?
- Who accepted it?
- Why is it a meaningful initiative rather than noise?
- Can one source produce multiple initiatives?
- Can the generator return zero initiatives when evidence is weak?

### 4.2 Initiative Validation Sheet

Before execution, the initiative sheet must validate:

- source envelope and provenance,
- problem/opportunity statement,
- recommended solution direction,
- owner/accountability,
- sponsor,
- priority,
- target date or scheduling readiness,
- scope in/out,
- KPI/benefit hypothesis,
- financial/ROI assumptions when relevant,
- risks/RAID,
- required decisions,
- task decomposition readiness,
- assignee coverage for tasks,
- gate readiness and explicit approval status.

### 4.3 Execution Backbone

Execution is not "the initiative owner does everything".

After initiative validation:

- Tasks carry delivery responsibility.
- Decisions carry governance responsibility.
- RAID carries risk/issue/dependency action.
- Milestones carry planning and reporting structure.
- Initiative owner remains accountable, but task assignees and decision owners can be different people.

## 5. Source Family Gap Matrix

| Source family | Current runtime evidence | Target behavior | Gap | Priority |
| --- | --- | --- | --- | --- |
| Tools | `Api.generateToolInitiatives`, `Api.getToolGeneratedInitiatives`, `DiscoveryToolsHub`, `GenerateInitiativesModal`, `ToolController` source fields | Smart generator; one finalized tool output can produce zero, one or many consulting-grade initiatives. | Need end-to-end source envelope validation and quality gate for forced/low-value initiatives. | P1 |
| Assessment | `Api.generateAssessmentInitiatives`, `assessment-workflow-v2/*/generate-initiatives`, `InitiativesManagementPanel`, `InitiativeGeneratorWizard` | Smart generator from approved assessment/report/gaps; one assessment can produce many candidates. | Need canonical mapping from assessment gap/report section to each generated initiative; verify approval/read-back UX. | P1 |
| Interview | `InsightViewer`, `V8InterviewApi.handoffFinding`, `Api.interviewPromoteFinding`, `interviewInsightFindingsService`, `interviewEnterpriseService.promoteFindingToInitiative` | Smart generator from interview session/findings plus create/link from individual finding. | Create/link exists; full multi-initiative generator is not confirmed. Need generator contract and quality gate. | P1 |
| Conversation / Teresa | `teresaCopilotService`, `teresaCopilotCanon`, `UnifiedChatPanel` initiative handoff/export suggestions | Simple create/link from selected conversation context, never hidden write. | Need source envelope for conversation excerpt, message IDs, accepted proposal and user confirmation. | P1 |
| MyWork / ideas / notebook / table / map | `my-work.routes.ts` outcome conversion, `IdeaMapWorkspace`, `IdeaTableTool`, `IdeaRecommendationMap` | Convert selected idea/work artefact to initiative with source envelope and dedupe. | Conversion exists; canonical source wrapper and dedupe policy are incomplete. | P1 |
| Finance analysis | `V8FinanceApi.getInitiativeProposals`, `V8FinanceApi.createInitiativesFromAnalysis`, finance routes for `initiative-proposals` and `initiatives` | Finance analysis proposes initiatives from accepted proposals and assumptions. | Need finance source envelope, assumptions provenance and connection to ROI/KPI readiness. | P1 |
| KPI / Results | `ResultsInitiativesView`, `ResultsKpisTableV3`, `resultsGetROIEvidence`, ROI evidence services | KPI/result evidence can recommend or create an initiative after approval. | Runtime mostly tracks/links existing initiatives; generation path and approval policy are not confirmed. | P2 |
| Imported reports | Import APIs and assessment/report flows indicate report-to-assessment/initiative paths | Imported report can become assessment/report source envelope and optionally initiatives. | Need explicit source taxonomy and duplicate detection. | P2 |

## 6. Required Source Envelope Contract

Every initiative must have at least one source envelope.

Minimum fields:

| Field | Required | Description |
| --- | --- | --- |
| `sourceEnvelopeId` | yes | Stable ID for source envelope. |
| `sourceFamily` | yes | `TOOL`, `ASSESSMENT`, `INTERVIEW`, `CONVERSATION`, `MYWORK`, `FINANCE`, `KPI_RESULTS`, `IMPORT`, `MANUAL_EXCEPTION`. |
| `sourceArtifactType` | yes | Concrete artefact type, e.g. `tool_session`, `assessment_report`, `interview_finding`, `chat_message`, `finance_analysis`. |
| `sourceArtifactId` | yes | Source record ID. |
| `sourceVersion` | conditional | Required when source can change over time. |
| `sourceSnapshotRef` | conditional | Immutable snapshot pointer or redacted payload reference. |
| `evidenceRefs[]` | yes | Links to findings, messages, assumptions, KPI signals, report sections or tool outputs. |
| `createdBy` | yes | Actor creating/promoting source envelope. |
| `createdAt` | yes | Timestamp. |
| `generationMode` | yes | `smart_generator`, `simple_create`, `link_existing`, `import`, `manual_exception`. |
| `acceptedBy` | conditional | User who accepted candidate into canonical initiative. |
| `acceptedAt` | conditional | Acceptance timestamp. |
| `qualityDecision` | yes | `accepted`, `rejected`, `merged`, `deferred`, `no_initiative`. |
| `rationale` | yes | Why this initiative exists. |
| `tenantId` / `organizationId` | yes | Tenant boundary. |
| `projectId` | conditional | Required when project-scoped. |

Manual exception rule:

Manual initiative creation may exist, but it still needs a source envelope with `sourceFamily = MANUAL_EXCEPTION`, reason, author and missing-evidence warning. This should be visible in UI and reportable.

## 7. Generator Contract Gaps

Smart generators are required for:

- tools,
- assessments,
- interview.

Each smart generator needs a shared contract:

| Requirement | Why | Current state |
| --- | --- | --- |
| Can generate 0..N initiatives | Prevents forced initiatives. | Not uniformly documented. |
| Candidate quality scoring | Avoids weak consulting artefacts. | Not canonical. |
| Candidate dedupe / merge check | Prevents duplicate initiatives from overlapping sources. | Not canonical. |
| Source evidence map per candidate | Ensures explainability. | Partial in tools/assessment; unclear elsewhere. |
| Human acceptance before canonical creation | Prevents hidden writes. | Present in some flows, not canonical. |
| Batch/run audit | Allows replay and inspection. | Assessment has run concepts; not universal. |
| Rejection reasons | Teaches quality without hidden learning. | Not canonical. |
| Multi-source merge | One initiative can have multiple source envelopes. | SourceLink supports 1..N in old doctrine, but source families are too narrow. |

## 8. Create Initiative CTA Gaps

There will be many "Create Initiative" buttons. They need one CTA contract.

Every CTA must pass:

- source family,
- source artefact ID,
- selected evidence refs,
- proposed initiative seed,
- generation mode,
- user intent,
- permission context,
- tenant/project scope.

The CTA must show:

- what will be created,
- what source will be attached,
- whether this is a generated proposal or manual create,
- duplicate/merge warnings,
- required review/approval,
- success read-back link.

Missing today:

- One shared CTA payload contract.
- One duplicate detection rule.
- One "no initiative should be created" state.
- One source provenance UI pattern.
- One permission/capability extension for source-specific create.

## 9. Initiative Sheet Readiness Gaps

The initiative sheet/card must become the validation surface before execution.

Required readiness sections:

| Section | Required evidence | Gap |
| --- | --- | --- |
| Source and provenance | Source envelope list, evidence refs, source snapshots. | Current card docs require this; runtime validation still needed. |
| Problem and solution | Problem statement, expected outcome, assumptions. | Partially covered by readiness checks. |
| Ownership | Initiative owner, sponsor, business owner when relevant. | Present but role semantics need UI clarity. |
| Scope | Scope in/out, deliverables, non-goals. | Needs explicit card/sheet readiness. |
| Financial hypothesis | ROI, cost, finance assumptions where relevant. | Finance linkage exists; source-to-initiative doctrine incomplete. |
| KPI/benefits | KPI hypothesis and tracking owner. | `DONE -> TRACKING` gate exists; earlier readiness not fully explicit. |
| Tasks | Task decomposition, assignees, due dates, acceptance criteria. | Task links and assignee exist; initiative-sheet readiness needs stricter checks. |
| Decisions | Required decisions, decider, status, blockers. | Decision links exist; UI/readiness needs more emphasis. |
| RAID | Risks/issues/assumptions/dependencies. | Create actions exist; completeness criteria need definition. |

## 10. Task And Decision Backbone Gaps

Current runtime supports many pieces:

- `tasks.initiative_id`
- `tasks.assignee_id`
- `decisions.initiative_id`
- governance decision links
- initiative template application that can create tasks/decisions
- task assignment services and workload heuristics

Missing or incomplete:

| Gap | Required action | Priority |
| --- | --- | --- |
| Task assignee readiness | Initiative sheet must warn when tasks are unassigned or owner is overloaded. | P1 |
| Task creation from initiative | Ensure task create UI always supports assignee, due date and acceptance evidence. | P1 |
| AI-suggested tasks | Require proposal review/acceptance before creation. | P1 |
| Decision blockers | Show decisions that block task flow and gate readiness. | P1 |
| Decision owner/decider | Surface decider separately from initiative owner and task assignee. | P1 |
| Work graph view | Show initiative -> milestones -> tasks -> decisions without duplicating truth. | P2 |
| Assignment vs accountability | Document and enforce owner/sponsor/assignee distinction. | P1 |

## 11. Capability And Permissions Gaps

Current backend capabilities cover:

- top-bar editability,
- card editability,
- workflow actions,
- context create actions,
- AI availability.

Missing capability dimensions:

| Capability | Needed for |
| --- | --- |
| `canCreateInitiativeFromSource` | Source-specific "Create Initiative" buttons. |
| `canGenerateInitiativesFromSource` | Smart generators in tools/assessment/interview. |
| `canAcceptGeneratedInitiative` | Human acceptance before canonical creation. |
| `canLinkSourceToInitiative` | Linking findings/KPI/finance evidence to existing initiatives. |
| `canMergeInitiativeCandidates` | Dedupe/merge flows. |
| `canAssignInitiativeTasks` | Assigning task assignees from initiative sheet. |
| `canLinkDecisionToInitiative` | Decision backbone management. |
| `canViewSourceEvidence` | Tenant-safe provenance display. |

These should come from backend, not local UI matrices.

## 12. UI/UX Gaps

Required UI patterns:

- Source envelope badge on every initiative card/sheet.
- "Why this initiative exists" provenance panel.
- Generator results review screen with accept/reject/merge/defer.
- Zero-output generator state: "No meaningful initiatives found".
- Duplicate candidate warning.
- Task assignee coverage panel.
- Decision blockers panel.
- Finance/KPI evidence panel when applicable.
- Safe degraded state when source evidence is unavailable.

Risks if missing:

- Users see initiatives as random cards.
- AI appears to invent work.
- Managers think initiative owner owns every task.
- KPI/finance initiatives lose evidence trail.
- Duplicate initiatives proliferate across modules.

## 13. Testing And Evidence Gaps

Minimum validation matrix needed before runtime can be considered ready:

| Test area | Required evidence |
| --- | --- |
| Tools generator | One tool source -> 0, 1 and many candidates; source envelope preserved. |
| Assessment generator | Approved assessment -> candidates; gap/report refs preserved. |
| Interview generator/handoff | Finding/session -> create/link; multi-candidate generator if implemented. |
| Conversation create | Chat excerpt -> initiative with source envelope and explicit confirmation. |
| MyWork convert | Idea/note/table/map -> initiative with source envelope. |
| Finance create | Finance analysis proposal -> initiative with assumptions provenance. |
| KPI/results create or recommend | KPI signal -> recommendation/create proposal with approval. |
| Duplicate detection | Similar candidates from two sources warn/merge. |
| Initiative sheet readiness | Missing source/owner/sponsor/tasks/assignees/decisions/KPIs shown. |
| Task assignment | Task under initiative can be assigned to user other than initiative owner. |
| Decision blocker | Decision linked to initiative blocks/flags relevant task or gate. |
| Permissions | Unauthorized source create/generate/link denied by backend capabilities. |
| Tenant safety | Source evidence from another tenant/project is never exposed. |

## 14. Required Work Packages

### WP1 — Source Envelope Doctrine

Update documentation and define source taxonomy:

- Replace `SOURCE_TRACEABILITY_SPEC.md` "only two sources" rule.
- Define `InitiativeSourceEnvelope`.
- Define source family enum and required fields.
- Define manual exception policy.
- Define source visibility/security rules.

Exit criteria:

- No conflict between source traceability docs and runtime/product intent.

### WP2 — Create Initiative CTA Contract

Define one payload and UI contract for every "Create Initiative" CTA.

Exit criteria:

- Every source-context CTA can pass source evidence, permissions, proposal seed and read-back behavior consistently.

### WP3 — Smart Generator Contract

Define generator behavior for tools, assessments and interview.

Exit criteria:

- Generators support `0..N` candidates, quality scoring, evidence map, dedupe and human acceptance.

### WP4 — Initiative Sheet Readiness

Define the validation sheet as the gateway before execution.

Exit criteria:

- Sheet can show missing source, owner, sponsor, tasks, task assignees, decisions, KPIs, finance assumptions and RAID.

### WP5 — Task And Decision Backbone

Align initiative execution with task/decision runtime.

Exit criteria:

- Initiative owners are accountable; task assignees and decision deciders are explicitly separate and visible.

### WP6 — Capability Extension

Extend backend capability contract for source create/generate/link/accept/merge and task assignment.

Exit criteria:

- Frontend never infers these permissions locally.

### WP7 — Test And Evidence Program

Create automated and manual evidence for every source path and execution backbone.

Exit criteria:

- Runtime readiness can be assessed with route, component, API and test evidence.

## 15. Readiness Verdict

Current state:

- `GO_DOCS` for continuing documentation and RAW comparison.
- `NO_GO_RUNTIME` for implementing the full transfer backbone until source envelope doctrine and capability extensions are defined.

Blocking P1 gaps:

1. Source traceability doctrine conflict.
2. Missing source envelope taxonomy.
3. Missing shared create initiative CTA contract.
4. Interview smart generator not confirmed.
5. KPI/results generation policy not defined.
6. Source-specific capabilities missing.
7. Initiative sheet readiness does not yet formally require task assignee and decision blocker coverage.

## 16. Next Analysis With RAW Material

The next step is to compare this target/gap model against RAW material from other applications.

Comparison questions:

- How do other apps represent source/provenance for generated work?
- Do they allow one source to generate many initiatives/actions?
- How do they prevent low-quality generated initiatives?
- How do they show task assignees vs initiative owners?
- How do they expose decisions/blockers inside initiative/work management?
- How do they handle finance/KPI-to-initiative flows?
- What UI pattern should Consultify adopt for generator review, dedupe and acceptance?

Output of the RAW comparison should be:

- recommended target UX pattern,
- confirmed source envelope taxonomy,
- generator UX decision,
- create CTA standard,
- task/decision sheet layout,
- final `GO_RUNTIME` / `NO_GO_RUNTIME` verdict.
