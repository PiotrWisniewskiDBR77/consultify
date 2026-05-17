---
module_id: MODULE_INITIATIVES
contract_id: INITIATIVE_CARD_SYSTEM
doc_kind: SYSTEM_CONTRACT
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-10
---

# Initiative Card System Contract

## 1. Purpose And Boundaries

The Initiative Card is the shared system artefact for displaying, selecting, opening, reviewing and acting on an initiative across portfolio, governance, execution and results contexts.

Immutable scope anchor: `05_inicjatywy/INITIATIVE_CARD_SYSTEM`.

This contract defines UI/UX, behavior, data, permissions, AI, provenance and evidence rules for the card as one system contract with contextual render variants. It does not authorize runtime changes by itself.

Out of scope:

- Creating a new runtime component.
- Changing `src/**`, `server/**` or `tests/**`.
- Replacing backend capability or role resolution logic.
- Introducing a new user-facing artefact beyond Initiative, Decision, Task, RAID, KPI, SourceLink and existing linked objects.

Evidence pointers:

| Evidence type | Pointer |
| --- | --- |
| Route evidence | `/initiatives` is the primary surface for `InitiativesHub`; companion initiative lanes are `/roadmap`, `/portfolio`, `/roi`. See `docs/modules/05_inicjatywy/04_UI_UX.md` and `src/components/Initiatives/InitiativesHub.tsx`. |
| Component evidence | `src/components/Initiatives/InitiativesHub.tsx`, `src/components/Initiatives/InitiativePreviewV3.tsx`, `src/components/Portfolio/PortfolioListView.tsx`, `src/components/Portfolio/PortfolioKanbanView.tsx`, `src/components/Portfolio/InitiativeGridCard.tsx`, `src/components/Initiatives/InitiativesTimelineView.tsx`. |
| API/capabilities evidence | Backend SoT is `GET /api/initiatives/:id/gate-readiness-check`, routed in `server/src/routes/pmo/initiatives.routes.ts` and implemented in `server/src/controllers/InitiativeController.ts`. |
| Test evidence | Current as-is evidence is API smoke coverage for initiatives in `tests/e2e/smoke/deploy-gate-api.spec.ts`; module-local initiative UI transition tests are a known gap in `07_ACCEPTANCE_AND_TESTS.md`. |

RAW visual cue note: requested file `assets/Screenshot_2026-05-10_at_17.01.22-9fef8da3-12b1-4236-8ae0-3458d893b878.png` was not found in the active workspace. Current screenshots attached in chat show list/table and initiative detail behavior and are treated only as non-canonical visual context.

## 2. Canonical Card Identity

An Initiative Card is any bounded UI representation of one Initiative that lets a user understand identity, status, ownership, source/provenance, readiness and allowed next actions without opening unrelated modules.

It is an Initiative Card when it:

- Represents exactly one initiative ID.
- Carries the initiative lifecycle status.
- Can expose or link to the same backend capability truth.
- Preserves source/evidence/provenance context or shows that it is missing.
- Opens the initiative detail, preview, modal, drawer or lane with the same canonical initiative identity.

It is not an Initiative Card when it:

- Represents a source artefact before initiative creation, such as ToolSession or AssessmentReport.
- Represents a Task, Decision, RAID, KPI, Report or ROI object without a single initiative identity.
- Is a dashboard aggregate without row/card-level identity.
- Is an AI suggestion that has not yet created or linked an initiative.

Conflict resolution note:

- `INITIATIVE_GOVERNANCE_MODEL.md` contains older/simplified language including `EDITING`; `INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`, `GATE_DEFINITION_OF_DONE.md`, `INITIATIVE_CAPABILITIES_SYSTEM.md` and runtime constants include `PENDING_REVIEW` and `ARCHIVED`.
- For card UI state, CTA, permissions and AI availability, the more specific SoT is `INITIATIVE_STATUS_ROLE_CTA_MATRIX.md` plus `INITIATIVE_CAPABILITIES_SYSTEM.md`.
- `INITIATIVE_GOVERNANCE_MODEL.md` remains the business ownership and lifecycle-intent source, but not the final UI permission matrix.
- `SOURCE_TRACEABILITY_SPEC.md` says initiatives can be created only from `ToolSession` or `AssessmentReport`. Runtime and product direction are broader: initiatives may originate from interview findings, tools, assessments, conversation/MyWork/chat, finance analysis and KPI/results contexts. Until `SOURCE_TRACEABILITY_SPEC.md` is revised, the card contract treats that source doctrine as incomplete and requires every source to be represented through an auditable source wrapper rather than dropped.

## 3. Canonical Data Model

The card model is a read model assembled from Initiative plus linked capability, source and evidence data. The UI must not infer permissions locally when backend capabilities are available.

| Field | Required | Editable From Card | Read-only/System | Rule | Evidence pointer |
| --- | --- | --- | --- | --- | --- |
| `id` | yes | no | yes | Stable initiative identity and deep-link target. | `InitiativesHub` deep-link handling; `Api.getInitiativeById`; `server/src/controllers/InitiativeController.ts`. |
| `title` / `name` | yes | section-dependent | no | Human-readable initiative name. Missing title is blocking readiness. | `gate-readiness-check` readiness key `title`. |
| `status` | yes | no direct field edit | yes | System-controlled lifecycle state; transitions use workflow gates/actions. | `INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`; `server/src/constants/initiativeStatuses.ts`. |
| `phase` / lifecycle bucket | optional | no | yes | Derived display grouping, never separate truth. | `server/src/services/initiative/initiativeLifecycleCanon.ts`. |
| `nextGate` / `availableTransitions` | optional | no | yes | Comes from backend gate readiness and effective roles. | `INITIATIVE_CAPABILITIES_SYSTEM.md`; `availableTransitions` in `InitiativeController.getGateReadinessCheck`. |
| `priority` | optional | yes if allowed | conditional | Editable only through `capabilities.topBar.canEditPriority`. | `INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`; capabilities payload. |
| `owner` | optional | yes if allowed | conditional | Editable only through `capabilities.topBar.canEditOwner`; absent owner is readiness issue. | `INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`; readiness key `owner`. |
| `targetDate` | optional | yes if allowed | conditional | Editable only through `capabilities.topBar.canEditTargetDate`. | `INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`; capabilities payload. |
| `projectId` | optional but expected when project-scoped | no | yes | Drives tenant/project role resolution and route scoping. | `PROJECT_AND_INITIATIVE_ROLE_RESOLUTION_V8.md`; `initiativeAccessResolver`. |
| `sourceLinks[]` | yes by doctrine | no | yes | Initiative must show linked ToolSession/AssessmentReport or missing-evidence status. | `SOURCE_TRACEABILITY_SPEC.md`. |
| `sourceType` / `sourceId` | required when source is available | no | yes | Minimal card provenance indicator; never expose raw sensitive payloads. | `SOURCE_TRACEABILITY_SPEC.md`; `InitiativesHub` preview model maps `sourceType`/`sourceId`. |
| `summary` / `problemStatement` | required for review gates | section-dependent | no | Needed before review/promotion readiness. | `GATE_DEFINITION_OF_DONE.md`; readiness key `summary`. |
| `sponsorId` | gate-dependent | yes if capability permits in detail | no | Required for review/promotion/planning readiness. | `GATE_DEFINITION_OF_DONE.md`; readiness key `sponsor`. |
| `plannedStartDate` / `plannedEndDate` | required from scheduling onward | yes if capability permits | no | Not required for `APPROVED`; blocking from `SCHEDULED` and later. | `INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`; `GATE_DEFINITION_OF_DONE.md`. |
| `baselineVersion` / baseline ref | required after schedule baseline | no | yes | Indicates committed schedule baseline; missing may be degraded/warning for legacy rows. | `InitiativeController.getGateReadinessCheck`; `initiativeLifecycleCanon`. |
| `readiness` / `missing[]` | optional but required for transition UI | no | yes | Used to explain blocked gates and next actions. | `gate-readiness-check` response. |
| `capabilities` | yes for actionable card | no | yes | Backend-owned editability, CTA, AI and section lock truth. | `INITIATIVE_CAPABILITIES_SYSTEM.md`. |
| `tasksCount` / linked task state | optional | no | yes | Summary only; task truth remains in task/execution modules. | `InitiativesHub` preview footer; `Api.getInitiativeTasks`. |
| `kpiReadiness` / KPI refs | required for `DONE -> TRACKING` | no | yes | Benefits tracking gate requires Business Owner and KPI targets/units. | `INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`; `GATE_DEFINITION_OF_DONE.md`. |
| `riskRaidSummary` | optional before planning, expected from planning | create action only if allowed | no | Card may surface existence/count/status; RAID truth remains linked. | `capabilities.ctaBar.contextCreateActions`; readiness key `risks`. |
| `lastUpdatedAt` / freshness | optional | no | yes | If stale/partial, card must show degraded freshness. | `04_UI_UX.md` runtime state policy. |

Hard stop rule: if a runtime implementation lacks enough data to populate required card identity, status or source/provenance, the UI must show a degraded or missing-evidence state and must not invent values.

## 4. Status Machine Mapping

The card must use the canonical status set from `INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`:

`DRAFT`, `PENDING_REVIEW`, `REVIEW`, `PROMOTED`, `PLANNING`, `APPROVED`, `SCHEDULED`, `EXECUTING`, `BLOCKED`, `DONE`, `TRACKING`, `CANCELLED`, `ARCHIVED`.

| Status | Card state | Primary card message | Actions policy | Evidence pointer |
| --- | --- | --- | --- | --- |
| `DRAFT` | Intake/draft | Draft exists from source; not yet accepted into initiative pipeline. | Context create may include `decision`, `raid` only when edit role exists; workflow actions from backend only. | `INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`; `GATE_DEFINITION_OF_DONE.md`. |
| `PENDING_REVIEW` | Intake review | Awaiting PM/PMO triage. | Show executable `SEND_BACK` or `APPROVE_TO_INITIATIVE` only if backend returns it. | `GATE_DEFINITION_OF_DONE.md`; `availableTransitions`. |
| `REVIEW` | Governance review | Ready for accept/reject gate. | Gate CTA only when `canCurrentUserExecute = true`; missing source/owner/sponsor shown as blockers/warnings. | `GATE_DEFINITION_OF_DONE.md`. |
| `PROMOTED` | Accepted for planning | Initiative should move into planning. | Planning start is backend-gated; card can expose next-step guidance. | `server/src/constants/initiativeStatuses.ts`. |
| `PLANNING` | Design/planning | Scope, KPI, dependencies, risks and economics are prepared. | Create actions can include `task`, `decision`, `raid` when edit role exists. | `INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`. |
| `APPROVED` | Approved backlog | Investment approved, not necessarily scheduled. | Timeline baseline is not blocking until schedule. | `INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`; `GATE_DEFINITION_OF_DONE.md`. |
| `SCHEDULED` | Roadmap committed | Baseline timeline exists and execution routing can start. | Execution handoff visible, not hidden. | `initiativeLifecycleCanon`; `GATE_DEFINITION_OF_DONE.md`. |
| `EXECUTING` | Execution active | Delivery work is underway. | Card can link to execution/task context; initiative truth remains stable. | `INITIATIVE_GOVERNANCE_MODEL.md`; `initiativeLifecycleCanon`. |
| `BLOCKED` | Blocked | Execution is stopped by explicit blocker. | Show blocker reason/decision context when available; unblock only via backend. | `GATE_DEFINITION_OF_DONE.md`. |
| `DONE` | Delivery complete | Delivery is closed, benefits may not yet be tracking. | `START_TRACKING` requires Business Owner and KPI readiness. | `INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`. |
| `TRACKING` | Benefits tracking | Outcomes and KPI measurement are active. | Read-focused unless backend capability enables benefit edits. | `GATE_DEFINITION_OF_DONE.md`; results/benefits lane evidence. |
| `CANCELLED` | Terminal | Initiative was formally stopped. | No context create actions; AI disabled with explanation. | `INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`. |
| `ARCHIVED` | Terminal/archive | Initiative is retained for history. | No context create actions; AI disabled with explanation. | `INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`. |

## 5. Role, Permission And CTA Matrix

Backend capabilities are the source of truth. The card must render from the capability payload and must not recreate role matrices in the frontend.

Backend-owned fields:

- `currentStatus`
- `userRoles[]`
- `availableTransitions[]`
- `capabilities.topBar.*`
- `capabilities.cards.canEditCards`
- `capabilities.ctaBar.workflowActions`
- `capabilities.ctaBar.contextCreateActions`
- `capabilities.ctaBar.canUseAi`
- `capabilities.ctaBar.aiAllowedSectionKeys`
- `reasonCodes`

Card rendering rules:

| Card zone | Rule | Evidence pointer |
| --- | --- | --- |
| Properties strip | `Status`, `Phase`, `Next Gate` are read-only. `Priority`, `Owner`, `Target date` are editable only through `capabilities.topBar.*`. | `INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`; `INITIATIVE_CAPABILITIES_SYSTEM.md`. |
| Workflow CTA | Show only executable workflow actions from `capabilities.ctaBar.workflowActions`; do not show disabled workflow ghosts. | `INITIATIVE_CAPABILITIES_SYSTEM.md`. |
| Context create CTA | Render `task`, `decision`, `raid` only from `capabilities.ctaBar.contextCreateActions`. | `INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`. |
| Card editability | If `capabilities.cards.canEditCards = false`, the card/detail sections are read-only and explain why. | `INITIATIVE_CAPABILITIES_SYSTEM.md`. |
| Unauthorized state | Deny by default, show safe explanation, do not leak project/tenant internals. | `06_PERMISSIONS_AND_SECURITY.md`; `40-security-tenancy.mdc`. |

Role resolution order: organization role -> project membership role -> steering-board authority -> initiative-specific assignments -> consultant overlay -> effective roles for workflow and capabilities.

Evidence pointers:

- Business/product: `PROJECT_AND_INITIATIVE_ROLE_RESOLUTION_V8.md`, `ROLES_MODEL.md`.
- API/capabilities: `server/src/services/initiative/initiativeAccessResolver.ts`, `server/src/controllers/InitiativeController.ts`.

## 6. AI Actions Policy

AI actions attached to an Initiative Card are contextual assistance, never decision authority.

Rules:

- AI availability is governed by `capabilities.ctaBar.canUseAi`.
- AI section scope is governed by `capabilities.ctaBar.aiAllowedSectionKeys`.
- When AI is unavailable, the card may keep an AI CTA visible only if it is disabled with an explanatory reason from backend capabilities.
- AI actions must live in Menu 3 / command-row right side, `DynamicTabs.rightContent`, `commandRowRightContent` or equivalent local right-side command space.
- The same AI action must not be duplicated in Menu 3 and the card canvas.
- AI can summarize, explain blockers, propose next actions, open contextual chat, or draft content for review.
- AI must never approve gates, bypass readiness, mutate sources, create hidden writes or hide provenance.

Evidence pointers:

- Placement rule: `.cursor/rules/21-ai-actions-menu3-placement.mdc`, `.cursor/rules/ai-actions-menu3.mdc`.
- Runtime footprint: `InitiativesHub` analysis actions are lifted into command row space; preview can open initiative-context chat.
- Capability rule: `INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`, `INITIATIVE_CAPABILITIES_SYSTEM.md`.

## 7. Source, Evidence And Provenance Contract

Every Initiative Card must expose why the initiative exists, or explicitly show that evidence is missing.

Canonical transfer-source rule:

- Initiatives are the main transfer artefact from discovery/diagnosis into planning, execution and results.
- One source can produce zero, one or many initiatives.
- The system has two source modes:
  - Smart generator mode: assessment, tools and interview contexts where the system should propose several consulting-grade initiatives and avoid forced/low-quality initiatives.
  - Simple create/link mode: chat, MyWork, finance analysis, KPI/results or other contexts where the user can create/link a bounded initiative from a selected finding, analysis, goal or evidence item.
- Every source, including conversation, finance and KPI contexts, must be represented through an auditable source wrapper/source link before the initiative becomes canonical.
- Source links are read-only from the card.
- AI receives source snapshots but never mutates sources.

Card provenance minimum:

| Provenance item | Display obligation | Evidence pointer |
| --- | --- | --- |
| Source type | Show ToolSession, AssessmentReport or missing evidence state. | `SOURCE_TRACEABILITY_SPEC.md`. |
| Source ID/link | Provide a safe deep link or reference label when authorized. | `SOURCE_TRACEABILITY_SPEC.md`. |
| Source version | Required for audit when available. | `SOURCE_TRACEABILITY_SPEC.md`. |
| Created/finalized by/at | Show in detail/preview when available, never raw sensitive payload. | `SOURCE_TRACEABILITY_SPEC.md`; security rule. |
| AI summary/recommendation basis | Cite source links, assumptions or missing-evidence warning. | `04_UI_UX.md`. |
| Gate readiness evidence | Show missing items and suggested action from backend readiness. | `gate-readiness-check`. |

Runtime completeness findings:

| Source area | Runtime evidence | Current mode | Completeness |
| --- | --- | --- | --- |
| Tools | `Api.generateToolInitiatives`, `Api.getToolGeneratedInitiatives`, `DiscoveryToolsHub`, `GenerateInitiativesModal` | Smart generator / one source to many initiatives | partial-pass: generator exists; provenance quality must be validated end-to-end. |
| Assessment | `Api.generateAssessmentInitiatives`, `AssessmentManagePanel`, `InitiativesManagementPanel`, `InitiativeGeneratorWizard` | Smart generator / one assessment to many initiatives | pass-partial: generator/wizard surfaces exist; only approved-assessment gating appears documented in UI. |
| Interview | `InsightViewer.handleHandoffSubmit`, `V8InterviewApi.handoffFinding`, `Api.interviewPromoteFinding` | Create/link finding to initiative | gap: handoff exists, but this is not yet clearly a multi-initiative smart generator comparable to assessment/tools. |
| Conversation / Teresa / chat | `teresaCopilotService`, `teresaCopilotCanon`, `UnifiedChatPanel` export/open initiative suggestion | Proposal/create/link from conversation context | partial-pass: route exists, but canonical source wrapper needs explicit doctrine. |
| MyWork / ideas / notebook | `my-work.routes.ts` outcome conversion, `IdeaMapWorkspace`, `IdeaTableTool`, `IdeaRecommendationMap` | Simple convert/promote to initiative | partial-pass: conversion exists; must not bypass source/provenance wrapper. |
| Finance analysis | `V8FinanceApi.getInitiativeProposals`, `V8FinanceApi.createInitiativesFromAnalysis` | Finance proposal -> accepted initiatives | partial-pass: proposal/create API exists; card/source doctrine must recognize finance as source family. |
| KPI / Results | `ResultsInitiativesView`, `ResultsKpisTableV3`, `resultsGetROIEvidence`, KPI initiative mappings | KPI tracking/linking, not full generator | gap: KPI can drive initiative need, but runtime evidence shows linking/tracking more than initiative generation. |

Product gap finding: the current source doctrine is too narrow for the intended program. The correct target is not "only ToolSession or AssessmentReport"; it is "every initiative has an auditable source envelope", where the envelope may wrap a tool run, assessment, interview finding, conversation excerpt, MyWork idea, finance analysis, KPI signal or results evidence.

## 8. Variant Matrix By Context

| Place | Variant | Owner | What differs | Required evidence |
| --- | --- | --- | --- | --- |
| `/initiatives` portfolio list/table | List row card | `IN_PORTFOLIO_HUB` | Dense identity, status, owner, priority, target date, selection, preview open. | Route: `/initiatives`; component: `PortfolioListView` inside `InitiativesHub`; API: initiatives list + capabilities on action; tests: API smoke, UI gap. |
| `/initiatives` kanban | Kanban card | `IN_PORTFOLIO_HUB` | Status-column placement, drag/status action constraints, quick state comprehension. | Component: `PortfolioKanbanView`; status source: `INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`. |
| `/initiatives` timeline | Timeline card | `IN_PORTFOLIO_HUB` | Emphasizes planned dates, baseline/freshness and schedule readiness. | Component: `InitiativesTimelineView`; API readiness: `gate-readiness-check`. |
| `/initiatives` grid | Grid card | `IN_PORTFOLIO_HUB` | More visual summary and compact KPI/provenance/owner hints. | Component: `InitiativeGridCard`; preview wrapper in `InitiativesHub`. |
| `/initiatives?open=<id>&mode=drawer|doc` | Preview/detail card | `IN_PORTFOLIO_HUB` | Full context preview, AI chat opener, copy link, ROI/economics handoff. | Component: `InitiativePreviewV3`; deep-link handling in `InitiativesHub`. |
| New/edit modal | Modal card/form | `IN_PORTFOLIO_HUB` | Create/edit content with explicit save/cancel and validation. | Component evidence: `InitiativesHub` modal state; API: create/update initiative endpoints. |
| Analysis workspace inside initiatives | Analysis card/section | `IN_ANALYSIS_WORKSPACE` | Resources, feasibility, logic, timeline and completeness subviews; actions in Menu 3. | Component: analysis subviews in `InitiativesHub`; Menu 3 command row. |
| `/roadmap` | Roadmap lane card | `IN_ROADMAP_VIEW` | Schedule and dependency emphasis; no new initiative truth. | Component: `FullRoadmapView`; lifecycle handoff: `initiativeLifecycleCanon`. |
| `/portfolio` | Portfolio lane card | `IN_PORTFOLIO_VIEW` | Portfolio health, prioritization and rollup context. | Component: `PortfolioView`; related cards under `src/components/Portfolio/**`. |
| `/roi` / results/benefits | ROI/results card reference | `IN_ROI_VIEW` and Benefits/Results | KPI, value and tracking emphasis; benefits truth remains in results/benefits objects. | Components: `FullROIView`, `ResultsInitiativesView`, KPI/ROI tests. |
| Execution module | Execution lane reference | Execution owner module | Shows execution status and handoff context, not duplicate initiative truth. | Lifecycle: `initiativeLifecycleCanon`; governance: `INITIATIVE_GOVERNANCE_MODEL.md`. |
| My Work / chat handoff | Linked artefact reference | My Work / Teresa context | Can link or seed initiative through canonical source path. | `SOURCE_TRACEABILITY_SPEC.md`; `teresaCopilotService` initiative handoff evidence. |

## 9. Interaction Contract

| Interaction | Contract | Evidence pointer |
| --- | --- | --- |
| Open | Opening a card must preserve initiative ID and route/deep-link identity. | `InitiativesHub` deep-link support for `open` and `mode`. |
| Select | Selection must be explicit and reversible; bulk actions require selected IDs. | `InitiativesHub` selected IDs and bulk modal state. |
| Preview | Preview uses the same initiative identity and must not create a shadow copy. | `TableWithPreviewLayout`, `InitiativePreviewV3`. |
| Edit | Editable fields follow `capabilities.topBar.*` and card section capability. | `INITIATIVE_CAPABILITIES_SYSTEM.md`. |
| Transition | Workflow transition must preflight against backend readiness and then be enforced by backend write path. | `getInitiativeStatusPreflightTruth`; `gate-readiness-check`; `PATCH /initiatives/:id/status`. |
| Handoff | Execution, KPI, calendar, ROI and roadmap handoffs carry bounded context and do not mutate consumer truth silently. | `initiativeLifecycleCanon.buildInitiativeOutboundHandoffPayload`. |
| Confirm | High-impact gates show explicit action, missing readiness and success/failure feedback. | `GATE_DEFINITION_OF_DONE.md`; `04_UI_UX.md`. |
| Error | Error must be visible through toast/banner or inline state; stale data must not appear current. | `04_UI_UX.md`; `InitiativesHub` load error and status update error handling. |

Explicit approval policy:

- Gate transitions are business decisions.
- AI can recommend but cannot approve.
- Backend role resolution decides executability.
- Card UI must not perform hidden writes or background transitions without visible user action and result feedback.

## 10. Error, Degraded, Empty, Loading And Success Policy

| State | Required behavior | Evidence pointer |
| --- | --- | --- |
| Loading | Show loading/refresh state before initiative data is trusted. | `03_BEHAVIOR.md`; `04_UI_UX.md`; `InitiativesHub` `isLoading`, `isRefreshing`. |
| Empty | Explain whether no initiatives exist, filters hide them, or scope is wrong; provide next action. | `04_UI_UX.md`. |
| Error | Use visible toast/banner/inline error; never treat stale data as successful. | `04_UI_UX.md`; `InitiativesHub` `loadError`. |
| Degraded | Show pilot restrictions, partial data, missing source/evidence, missing capabilities or unavailable linked lanes. | `04_UI_UX.md`; `06_PERMISSIONS_AND_SECURITY.md`. |
| Success | Confirm creation, update, status transition, open or handoff and identify next action. | `04_UI_UX.md`; `InitiativesHub` success toasts. |

Missing capability payload policy:

- For read-only card display, show non-actionable summary and degraded capability state.
- For any edit/transition/AI action, deny by default until backend capabilities are available.

## 11. Accessibility And Clarity Rules

- Status must not be communicated by color alone; include text labels and accessible names.
- Card click targets must not conflict with inline CTA controls.
- Disabled AI CTA must include an explanation, not only visual opacity.
- Selection, active filters, active status and scope toggles must be keyboard/focus-visible compatible.
- Dense variants must preserve minimum identity: title, status, owner/assignment or missing owner, source/provenance or missing-evidence state.
- Status color must follow the shared semantic map, not local ad-hoc colors.
- Long summaries must truncate predictably and preserve access to full detail in preview/detail.

## 12. Anti-Patterns

The Initiative Card system must not:

- Duplicate the same AI action in Menu 3 and canvas.
- Infer role permissions locally when backend capabilities exist.
- Show disabled workflow actions as if they were selectable.
- Hide missing source/provenance behind AI-generated summaries.
- Convert MyWork/Notebook content into initiatives without the canonical `ToolSession(MYWORK)` source path.
- Treat ROI, tasks, decisions or execution records as independent initiative truth.
- Mutate status, owner, priority, target date or source links through hidden writes.
- Show raw stack traces, internal IDs beyond safe references, secrets or sensitive payloads.
- Let terminal `CANCELLED` or `ARCHIVED` cards expose create actions or active AI writes.
- Use `EDITING` as a card status unless the status/CTA SoT is explicitly updated.

## 13. Cross-Module Impact Map

| Flow stage | Card role | Owner module | Boundary |
| --- | --- | --- | --- |
| Assessment/tool output -> initiative | Shows source and intake status once initiative exists. | Tools / Assessment -> Initiatives | Source remains ToolSession/AssessmentReport. |
| Initiative intake/review | Drives triage, promotion, planning readiness and source validation. | Initiatives | Backend gates and capabilities govern actions. |
| Planning -> approved backlog | Shows scope/KPI/risk/readiness and explicit approval status. | Initiatives | `APPROVED` does not require timeline baseline. |
| Approved -> roadmap scheduling | Shows schedule readiness, dates and baseline commitment. | Initiatives / Roadmap | Roadmap lane does not become separate initiative truth. |
| Scheduled/executing/blocking | Shows execution handoff and status without duplicating tasks. | Execution | Task/decision truth stays in execution/work modules. |
| Done -> benefits tracking | Shows Business Owner/KPI readiness and tracking transition. | Benefits / Results | KPI/result truth stays in benefits/results. |
| Reporting/portfolio rollups | Shows aggregate references and drill-through to canonical card. | Reporting / Portfolio | Reports do not create new initiative artefacts. |

### 13.1 Initiative Transfer Backbone

The initiative is the transfer backbone for the first half of the program:

1. Signal/source is captured in interview, tools, assessment, conversation, MyWork, finance or KPI/results.
2. Smart generator or simple create/link turns selected evidence into one or more initiative candidates.
3. Initiative sheet validates the candidate: source, problem, owner, sponsor, scope, KPI/benefit hypothesis, risks and gate readiness.
4. Approved/scheduled initiative hands off execution as tasks, decisions, RAID and milestones.
5. Execution management happens primarily through tasks and decisions, not by overloading the initiative owner with all work.
6. Results/KPI/ROI tracking closes the loop back to benefits and evidence.

Hard requirement: tasks created under an initiative must support individual assignees independent of initiative owner, sponsor or manager. Initiative ownership is accountability; task assignment is delivery responsibility.

Runtime evidence:

| Backbone element | Evidence | Finding |
| --- | --- | --- |
| Initiative -> tasks | `Api.getInitiativeTasks`, `TasksMilestonesSection`, `TaskDetailView`, `/api/tasks?initiativeId=` | Present; task model has `assigneeId`, `ownerId`, `initiativeId`. |
| Task assignee independence | `TaskDetailView` persists `assigneeId`; `my-work.routes.ts` uses `tasks.assignee_id`; `TasksMilestonesSection` has `newTaskAssigneeId`. | Present in task runtime; must be elevated as initiative contract requirement. |
| Initiative -> decisions | `Api.governanceLinkDecision`, `Api.governanceGetDecisions`, `DecisionDetailView` has `initiativeId`; `my-work.routes.ts` reads `decisions.initiative_id`. | Present but less visible in Initiative Card/Sheet contract than tasks. |
| AI task suggestions | `Api.suggestInitiativeTasks`, `TasksMilestonesSection` AI proposal flow | Present; must preserve acceptance/review before creating tasks. |
| Staffing/capacity | `Api.getStaffingPlans`, staffing plan role APIs | Present as supporting planning layer, not replacement for per-task assignee. |

## 14. Acceptance Checklist And Test Evidence Map

Acceptance checklist:

- [ ] One Initiative Card identity is documented and linked from module entrypoint.
- [ ] All card variants use the same canonical data model and lifecycle status set.
- [ ] Card CTA, editability and AI availability are backend capability-driven.
- [ ] AI actions follow Menu 3/right-side placement and are not duplicated.
- [ ] Source/provenance or missing-evidence state is visible.
- [ ] Gate transitions require explicit user action and backend readiness/enforcement.
- [ ] Error, loading, empty, degraded and success states are documented.
- [ ] Cross-module usage map identifies owner and evidence.
- [ ] Conflicts between governance/status docs are documented.
- [ ] Known test gaps are explicitly listed.

Evidence map:

| Evidence layer | Current evidence | Status |
| --- | --- | --- |
| Route | `/initiatives`, `/roadmap`, `/portfolio`, `/roi` documented in module UI and function contracts. | pass-doc |
| Component | `InitiativesHub` plus list/kanban/timeline/grid/preview components identified. | pass-doc |
| API/capabilities | `GET /api/initiatives/:id/gate-readiness-check` documented as backend SoT. | pass-doc |
| Role resolver | `resolveInitiativeAccessContext` identified as backend effective-role resolver. | pass-doc |
| Source/provenance | `SOURCE_TRACEABILITY_SPEC.md` defines source contract; card display requires runtime validation. | pass-with-gap |
| Automated API | `deploy-gate-api.spec.ts` covers basic initiative CRUD. | pass-limited |
| Automated UI | Dedicated initiative card/lifecycle UI tests are not found in current module docs scan. | gap |
| Visual evidence | Requested RAW visual cue was not found in workspace; chat-attached screenshots are non-canonical reference only. | gap |
| Source breadth | Runtime paths exist for tools, assessment, interview, chat/MyWork and finance; KPI/results mostly link/track. | pass-with-P1-source-doctrine-gap |
| Task/decision execution backbone | Tasks and decisions can link to initiatives; tasks support assignees. | pass-doc, UI/test evidence still needed |

## 15. Open Questions

1. What is the canonical source-envelope taxonomy that replaces the too-narrow ToolSession/AssessmentReport-only rule?
2. Should interview receive a true multi-initiative smart generator, or is finding-level create/link enough for v1?
3. Should KPI/results be allowed to generate new initiatives directly, or only recommend/create proposals for user approval?
