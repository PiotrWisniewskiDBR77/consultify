# Final Implementation Contract — Inicjatywy (Position 11/35)
Date: 2026-03-29 (updated 2026-04-11)  
Owner: Product + Engineering  
Status: verified(evidence) (P11 program complete 2026-03-31; contract expanded 2026-04-11 to cover full runtime)

## 1. Executive summary
- **Intent**: Initiative as a complete, trustworthy operating lane: full CRUD (40+ endpoints), governed lifecycle (9 canonical states), multi-view portfolio (table/kanban/timeline/grid), V8 planning continuity (WBS/critical path/decision chains), AI-assisted authoring (section generation, blueprint scaffolding, portfolio analysis), gate readiness engine, dynamic N-mode document (25+ sections), goal/OKR spine, KPI assignment runtime, and bounded handoffs to downstream modules.
- **Primary users**: PMO/manager/owner/sponsor/steering committee.
- **Success metric**: initiative jako „living object” z triage→plan→execute→change→report, z AI wpiętym w realny operating model. All views (list/detail/preview/counters) speak the same truth after every write. Operator can create, plan, govern, and hand off an initiative without leaving the module.

## 2. Scope
### 2.1 In-scope
- Initiative lifecycle (9 canonical states) + UX coherence + AI propose/fill (bez silent writes).
- Full CRUD with 40+ endpoints (§2.4): core entity, workflow actions, sub-entity management.
- V8 Planning Continuity Runtime (§2.5): WBS, critical path, cross-initiative deps, decision chains.
- Gate Readiness Engine + Access Resolver (§2.6): deterministic readiness, RBAC, capabilities envelope.
- Dynamic Document View with 25+ sections (§2.7): N-mode, template-driven.
- Initiative Templates / Levels (§2.8): quick_win, standard, strategic, transformation.
- Portfolio Analysis Workspace (§2.9): resources, feasibility, logic, timeline, completeness.
- Multi-View Portfolio (§2.10): table, kanban, timeline, grid, preview, bulk edit, duplicate detection.
- AI Generation Suite (§2.11): section gen, readiness analysis, portfolio AI.
- KPI Assignment Runtime (§2.12): realization / post-implementation phases.
- Write-Truth Service Pattern (§2.13): V8-first frontend + coherence helpers.
- Governance Service (§2.14): Goals/OKR, Blueprints, Governance Gates.
- Handoff do `Wdrożenia`, `KPI`, `Kalendarz` (§2.3.5).

### 2.2 Out-of-scope / non-goals
- Kopiowanie UI liderów; „projektowy everything tool” bez granic.
- Full monday.com or Asana PM suite parity.
- Absorbing execution control tower or results surfaces.

### 2.3 P11-A canon (write-truth + governance)
This section freezes the **single canon** for Initiatives. All downstream work must extend this canon (no parallel “initiative_v2”).

#### 2.3.1 Lifecycle states (canonical)
Lifecycle is **initiative-level**, not packet/program status.

- `intake`: captured from any entry point; not yet ready for planning.
- `triage`: being clarified (owner, goal/outcome, scope sketch).
- `planned`: has baseline plan (milestones / deliverables / constraints).
- `approved`: approved to execute (explicit start signal).
- `executing`: active delivery; changes are allowed but governed.
- `blocked`: execution cannot proceed; blockers must be explicit.
- `delivered`: work outcome delivered (handoffs to Results/KPI may continue).
- `closed`: operationally closed; only read + reporting (no further execution writes).
- `archived`: hidden from primary surfaces; retained for audit/history.

Notes:
- If the product needs finer granularity later, it must be introduced by extending this canon (no separate grammar elsewhere).

#### 2.3.2 Transitions (allowed + guarded)
Allowed transitions (non-exhaustive but binding):

- `intake` → `triage` (clarification started)
- `triage` → `planned` (baseline plan created)
- `planned` → `approved` (explicit approval event)
- `approved` → `executing` (execution started)
- `executing` → `blocked` (blocker declared)
- `blocked` → `executing` (blocker resolved)
- `executing` → `delivered` (outcome delivered)
- `delivered` → `closed` (closure decision)
- `closed` → `archived` (archive)

Hard guards:
- No “silent” transition: every lifecycle change must record **who/when/why** (audit).
- No backward transitions unless explicitly specified in a future packet (e.g. `delivered` → `executing` is forbidden in v8 unless a governed “reopen” is added).
- Any transition that would break read/write coherence must be denied (see 2.3.3 + 2.3.7).

#### 2.3.3 Read/write coherence rules (write-truth canon)
Principle: **po zapisie wszystkie widoki mówią tę samą prawdę**.

Canonical invariants:
- **Single canonical Initiative ID** (`initiativeId`) is the join key across all Initiative surfaces and downstream handoffs.
- A write is considered successful only when:
  - the **write model** is persisted, and
  - all declared **read models** (list/detail/preview/rollups) reflect the same lifecycle + key fields.

Coherence contract:
- After any create/update/transition, the following must agree:
  - list/table row (status + title + owner + dates),
  - initiative detail header (same fields),
  - preview pane summary (same fields),
  - counters/filters derived from status (no “phantom counts”).
- If any read-side cannot be updated reliably, the system must:
  - deny the write, or
  - save in a clearly marked degraded mode that does not lie (see 2.3.7).

No split truth:
- Initiative lifecycle grammar must not be redefined in `Wdrożenia`, `KPI`, `Kalendarz` or any other module. Those modules may mirror the current initiative lifecycle **read-only**, but cannot own it.

#### 2.3.4 AI scaffold governance envelope (no silent writes)
AI can propose changes, but **never** apply them silently.

Envelope states:
- `proposal`: AI produces a structured proposal payload (diff-like) with citations to the user prompt/context.
- `review`: user sees the proposal clearly (what will be created/changed) and can edit/trim it.
- `accept`: only after explicit acceptance the system performs writes.

Audit requirements (minimum):
- Record: `proposalId`, `initiativeId` (if existing), actor, timestamp, input context references (bounded), and the accepted diff.
- Store a machine-readable summary of changes (field-level).
- Provide a visible “AI proposed / user accepted” marker in the activity/audit surface.

Forbidden:
- background auto-save of AI-generated content without user accept,
- applying partial subsets without telling the user exactly what was persisted.

#### 2.3.5 Bounded handoff payloads (P03 / P04 / P02)
Handoff is **bounded**: consumers get enough to link and preserve context, not to redefine initiative truth.

Common payload (always include):
- `initiativeId` (canonical)
- `initiativeTitle` (snapshot)
- `initiativeLifecycleState` (snapshot)
- `initiativeOwnerId` (if present)
- `initiativeTimebox` (start/end or target quarter; snapshot if present)
- `contextPack` (bounded): up to 5 links/refs (e.g., decision, plan baseline, key risks) following playbook rule
- `handoffAt` timestamp and `handoffBy` actor

To `Wdrożenia` (P03):
- Add `executionIntent` (what will be executed now) and `initialWorkstreamIds` (if chosen).
- Consumer rule: Wdrożenia may create execution items linked to `initiativeId`, but cannot mutate initiative lifecycle except via explicit governed actions in Initiatives.

To `KPI` (P04):
- Add `kpiIntent` (which outcomes/metrics to track) and `measurementWindow` (if known).
- Consumer rule: KPI tracks measurement linked to `initiativeId`; KPI status cannot override initiative lifecycle.

To `Kalendarz` (P02):
- Add `calendarIntent` (milestones/events summary) and `milestoneRefs` (if present).
- Consumer rule: Calendar may render milestones/events; schedule edits do not silently back-write initiative lifecycle without a governed review/accept.

#### 2.3.6 Anti-duplicate gate (canon-first)
- No parallel entities: **do not** introduce `initiative_v2`, `initiativeStatusV2`, “new initiative grammar” in any other module or file set.
- Status/lifecycle grammar lives in exactly one place (this canon); other modules consume it.
- If a near-duplicate is discovered during implementation, it must be recorded as a risk and resolved by extending this canon, not by forking it.

#### 2.3.7 Degraded/error posture (truth-preserving)
When the system cannot uphold write-truth, it must fail safely.

- **Deny-on-incoherence** (default): reject the write and present an actionable error (“cannot persist safely; try again”) without mutating visible truth.
- **No partial save without disclosure**: if partial persistence is unavoidable, the UI must explicitly show what is saved vs not saved and keep the initiative in a consistent lifecycle state.
- **Schema drift guard**: if server schema differs from expected (missing fields/enums), the system must:
  - preserve `initiativeId` and last-known lifecycle state,
  - avoid writing unknown enum values,
  - route the user to a recovery path (read-only + export/log) rather than corrupting lifecycle truth.

### 2.4 Full CRUD + workflow actions runtime
Initiative is a **living object** with a complete operational surface — not just a status machine.

#### 2.4.1 Core entity operations
- **Create** (POST `/api/initiatives`): title, level, axis, summary; returns canonical `initiativeId`. Duplicate detection (Levenshtein similarity) runs client-side before submit.
- **Read** (GET `/api/initiatives/:id`): full detail with multilingual text support.
- **Update** (PUT `/api/initiatives/:id`): full field update with lifecycle-aware validation.
- **Quick-update** (PATCH `/api/initiatives/:id/quick-update`): partial fields (priority, owner, dates) without full form.
- **Move** (POST `/api/initiatives/:id/move`): move to another project while preserving lifecycle.
- **Archive** (POST `/api/initiatives/:id/archive`): terminal lifecycle transition.
- **Portfolio** (GET `/api/initiatives/portfolio`): list + stats with normalized status fields.
- **Portfolio rollups** (GET `/api/initiatives/portfolio/rollups`): program hierarchy aggregation.

#### 2.4.2 Workflow action endpoints
Each workflow action is a dedicated POST route that enforces the transition matrix (§2.3.2), gate permissions, and blocking readiness:

| Action | Route | Transition |
|--------|-------|------------|
| Submit for review | `/:id/submit-review` | DRAFT → PENDING_REVIEW |
| Approve | `/:id/approve` | PLANNING → APPROVED |
| Reject | `/:id/reject` | REVIEW → DRAFT |
| Start execution | `/:id/start-execution` | SCHEDULED → EXECUTING |
| Block | `/:id/block` | EXECUTING → BLOCKED (reason required) |
| Unblock | `/:id/unblock` | BLOCKED → EXECUTING |
| Complete | `/:id/complete` | EXECUTING → DONE |
| Generic status change | PATCH `/:id/status` | Any valid transition with gate check |

#### 2.4.3 Sub-entity CRUD
Each initiative aggregates sub-entities with full CRUD:

| Sub-entity | Routes | Purpose |
|------------|--------|---------|
| Milestones | `/:id/milestones` | Roadmap milestones with gate-decision links |
| KPIs | `/:id/kpis` | Benefits KPIs (see §2.12) |
| Resources | `/:id/resources` | Resource allocation lines + AI apply log |
| Budget items | `/:id/budget-items` | Capex/opex line items |
| Tools | `/:id/tools` | Tooling/license tracking |
| Intangible assets | `/:id/intangible-assets` | IP/knowledge assets |
| Stakeholders | `/:id/stakeholders` | People (RACI, influence/interest) |
| Watchers | `/:id/watchers` | Notification subscribers |
| RAID | `/:id/raid` | Risks, assumptions, issues, dependencies |
| Comments | `/:id/comments` | Discussion thread |
| Gate roles | `/:id/gate-roles` | Explicit gate role assignments |
| Schedule baselines | `/:id/schedule-baselines` | Baseline snapshots for variance tracking |
| Cross-initiative deps | `/portfolio/dependencies` | Create/delete cross-initiative dependencies |

Implementation: `server/src/controllers/InitiativeController.ts` (40+ static handlers), `server/src/routes/pmo/initiatives.routes.ts`.

### 2.5 V8 Planning Continuity Runtime
Read-only V8 planning surface that provides structured planning data for the operator-facing module.

#### 2.5.1 WBS decomposition
- 4-level hierarchy: `initiative` → `workstream_phase` → `task` → `subtask`.
- Stored in `v8_initiative_decompositions` (migration: `20260323_v8_planning_continuity.sql`).
- `recordDecomposition`, `getDecompositionTree`, `validateWBSCompleteness` (flags non-leaf without children).

#### 2.5.2 Critical path proxy
- Longest root-to-leaf chain in the decomposition tree.
- Documented as a **proxy** — not a full CPM engine; provides operator signal about deepest dependency chain.

#### 2.5.3 Cross-initiative dependencies
- `v8_cross_initiative_dependencies`: types `blocks`, `blocked_by`, `depends_on`, `enables`, `shares_resource`, `shares_milestone`.
- Status tracking: `active`, `resolved`, `broken`, `cancelled`.
- CRUD + status update.

#### 2.5.4 Decision chains
- `v8_decision_chains`: `sequential`, `parallel`, `delegated` chain types.
- JSON decision entries with per-decision status.
- Org-wide `getPendingDecisions` for governance dashboards.

#### 2.5.5 Material change detection
- `checkMaterialChange`: dimension thresholds for high-impact changes requiring re-approval.

#### 2.5.6 V8 read routes
All mounted under `/api/v8/planning/`:

| Route | Purpose |
|-------|---------|
| `GET /initiatives/portfolio` | Portfolio list with P11 normalized fields |
| `GET /initiatives/:id` | Detail read (multilingual) |
| `GET /initiatives/:id/snapshot` | Aggregated: decomposition + completeness + critical path + cross-deps + decision chains |
| `GET /initiatives/:id/handoff` | Bounded outbound envelope (§2.3.5) |
| `GET /initiatives/:id/task-dependencies` | Task-level deps |
| `GET /initiatives/:id/gate-readiness-check` | Full gate readiness (§2.6) |
| `GET /initiatives/:id/status-history` | Audit trail |
| `GET /initiatives/:id/history` | Activity log |
| `GET /initiatives/:id/comments` | Discussion |
| `GET /initiatives/:id/resources` | Resource lines |
| `GET /initiatives/:id/kpis` | KPI assignments |
| `GET /initiatives/:id/budget-items` | Budget |
| `GET /initiatives/:id/tools` | Tools |
| `GET /initiatives/:id/intangible-assets` | IP assets |
| `GET /initiatives/:id/raid` | RAID items |
| `GET /initiatives/:id/stakeholders` | Stakeholders |
| `GET /initiatives/:id/watchers` | Watchers |
| `GET /initiatives/:id/gate-roles` | Gate role assignments |
| `GET /pending-decisions` | Org-wide pending decision chains |

Contract id: `planning_continuity_read_v1`.

Implementation: `server/src/routes/v8/planning.routes.ts`, `server/src/services/v8/planningContinuityService.ts`, `server/src/services/v8/planningPortfolioReadService.ts`.

### 2.6 Gate Readiness Engine + Access Resolver
Deterministic readiness checks that govern lifecycle transitions.

#### 2.6.1 Blocking readiness items
`initiativeGateReadinessService.ts` → `getBlockingReadinessItems`: per-status checks (title, owners, timeline/milestones, scope, risks, tasks, benefits KPIs, sponsor, schedule baseline). Returns structured `{ section, field, requirement, key, label, suggestedAction }`.

#### 2.6.2 Gate readiness read surface
`getInitiativeGateReadinessRead` (1200+ lines) provides:
- `currentStatus` (normalized)
- `userRoles` (effective, resolved from project membership + steering board + explicit assignments)
- `availableTransitions` with `{ targetStatus, gate, requiredRoles, assignedApprovers, canCurrentUserExecute, hasAssignedApprover }`
- `capabilities` envelope: `topBar` (editPriority/owner/targetDate), `cards` (editCards), `ctaBar` (workflowActions, contextCreateActions, canUseAi), `reasonCodes`
- `readiness` checklist (key/label/pass/severity/suggestedAction/suggestedActor)
- `allBlocking` / `allWarnings` rollup flags

#### 2.6.3 Access resolver
`initiativeAccessResolver.ts` → `resolveInitiativeAccessContext`: resolves `effectiveRoles` and `roleAssignments` from:
- Initiative row (owner_business_id, owner_execution_id, sponsor_id)
- Project membership (`project_members` table, role mapping)
- Steering board membership (if enabled)
- Explicit gate role assignments (`initiative_gate_roles`)

Implementation: `server/src/services/initiative/initiativeGateReadinessService.ts`, `server/src/services/initiative/initiativeAccessResolver.ts`, `server/src/services/v8/planningPortfolioReadService.ts`.

### 2.7 Dynamic Document View (N-mode, 25+ sections)
Canonical initiative document surface replacing legacy detail views.

#### 2.7.1 Section registry
`src/components/Initiatives/sections/registry.ts` maps section keys to React components:
`overview`, `problemDefinition`, `targetState`, `scope`, `tasks`, `decisions`, `raid`, `gates`, `financialAnalysis`, `financialImpact`, `kpis`, `competencyRequirements`, `skillsGap`, `pilot`, `comments`, `history`, `control`, `team`, `initiativeTeam`, `raciEscalation`, `timeline`, `resources`, `stakeholders`, `dependencies`, `attachments`, `linkedItems`, `tags`, `reminders`.

#### 2.7.2 N-mode shell
`InitiativeDocumentView.tsx`: left nav (section IDs), canvas area, properties strip, compact panel. Template-driven section visibility and ordering.

#### 2.7.3 AI integration in document
- `AIFieldEnhancer` for section-level AI fill.
- `/initiatives/generate-section` API integration.
- Presentation mode for read-only viewing.

Implementation: `src/components/Initiatives/InitiativeDocumentView.tsx`, `src/components/Initiatives/sections/`.

### 2.8 Initiative Templates / Levels
Template-driven initiative structure based on complexity level.

- **Levels**: `quick_win`, `standard`, `strategic`, `transformation`.
- Each level defines `visible_sections` and section ordering.
- `InitiativeLevelSelector.tsx`: user picks level at create time.
- `initiativeLevelTemplates.ts`: template definitions.
- Backend: `/initiatives/section-types` API for template metadata.

Implementation: `src/components/Initiatives/templates/`.

### 2.9 Portfolio Analysis Workspace
Analytical views for portfolio-level decision making.

- **5 subviews**: `resources`, `feasibility`, `logic`, `timeline`, `completeness`.
- `PortfolioAnalysisView.tsx`: table/preview layout, dependency CRUD, workspace side panel.
- `DependencyGraphCanvas.tsx`: visual dependency graph.
- `usePortfolioAnalysisData.ts`: data aggregation hook.

Available as the "Analysis" tab in `InitiativesHub`.

Implementation: `src/components/Initiatives/Analysis/`.

### 2.10 Multi-View Portfolio
Operator-facing portfolio surface with multiple view modes.

#### 2.10.1 View modes
- **Table** (`PortfolioListView`): sortable, multi-select, row actions, inline status, `PortfolioAiPanel`.
- **Kanban** (`PortfolioKanbanView`): columns by status, scope toggle (active/all).
- **Timeline** (`InitiativesTimelineView`): Gantt-style with dependencies.
- **Grid** (`InitiativeGridCard`): card grid.

#### 2.10.2 Preview pane
`InitiativePreviewV3`: meta, details, relations, AI summarize, copy (markdown/Slack), chat link, finance link.

#### 2.10.3 Bulk operations
- Multi-select in list view → bulk edit modal (status, priority, business owner, execution owner).

#### 2.10.4 Duplicate detection
`initiativeDuplicateDetection.ts` → `checkDuplicateInitiative`: Levenshtein / substring similarity against existing titles. Runs at create time.

Implementation: `src/components/Initiatives/InitiativesHub.tsx`, `src/components/Portfolio/`.

### 2.11 AI Generation Suite
AI capabilities beyond the scaffold governance envelope (§2.3.4).

#### 2.11.1 Section-level AI
- `POST /initiatives/generate-section`: generates content for a specific section key.
- `POST /initiatives/readiness-analysis`: AI-driven readiness analysis.
- `POST /initiatives/suggest-sections`: suggests which sections to complete next.

#### 2.11.2 Portfolio-level AI
- `POST /ai/initiatives/conflicts`: conflict detection across portfolio.
- `POST /ai/initiatives/priorities`: AI priority suggestions.
- `POST /ai/initiatives/schedule`: scheduling assistance.
- `PortfolioAiPanel.tsx`: multi-select AI analysis surface in list view.

All AI writes follow the governance envelope: proposal → review → explicit accept.

### 2.12 KPI Assignment Runtime
Extended KPI lifecycle for initiative benefit tracking.

- **Phases**: `realization` (during execution) and `post-implementation` (after delivery).
- **Observation status**: `active`, `paused`, `completed`.
- **Definition source**: `library` or `initiative-custom`.
- **Per-phase expectations**: baseline value, target value, measurement frequency.
- Migration: `670_initiative_kpi_assignment_runtime.sql` adds columns to `initiative_kpi_mappings`.

Implementation: `server/src/services/initiative/initiativeKpiAssignmentService.ts`.

### 2.13 Write-Truth Service Pattern (frontend)
Frontend service layer that ensures read/write coherence across V8 and legacy APIs.

#### 2.13.1 Read path
- `getInitiativeReadTruth`: prefers V8 planning API, falls back to legacy `/api/initiatives`.
- `getInitiativeGateReadinessTruth`, `getInitiativeStatusHistoryTruth`, `getInitiativeHistoryTruth`: V8-first with fallback.
- `refreshInitiativeWriteTruth`: bundles initiative + gate readiness + both histories in one refresh.

#### 2.13.2 Write path
- `createInitiativeWriteTruth`: POST create → refresh → coherent state.
- `updateInitiativeStatusWriteTruth`: PATCH status → refresh.
- `quickUpdateInitiativeWriteTruth`: PATCH quick-update → refresh.
- `saveInitiativeWriteTruth`: PUT full update → refresh.

#### 2.13.3 Coherence helpers
- `getWorkflowStatusForInitiative`: prefers `displayStatus` over `status`.
- `hasInitiativeStatusReadDrift`: compares raw vs display / explicit drift flag.

Implementation: `src/services/initiativeWriteTruth.ts`, `src/utils/initiativeWorkflowStatus.ts`.

### 2.14 Governance Service (Goals/OKR + Blueprints + Gates)
Extended governance capabilities beyond lifecycle transitions.

#### 2.14.1 Goals / OKR spine
- Goals CRUD: create, read (by parent), update (title, description, status, progress, currentValue, owner).
- Goal-initiative links with `contribution_weight`.
- `getGoalRollup`: weighted progress from child goals + linked initiatives.

#### 2.14.2 AI Blueprint Generator
- `createBlueprint`: stores AI-generated WBS, milestones, dependencies, resources, citations.
- `applyBlueprint`: explicit user-gated mutating call (§2.3.4 governance envelope).
- `rejectBlueprint`: marks proposal as rejected.
- Audit: `ai_blueprint_applied` action in `initiative_history` with `proposalId`, `acceptedDiffSummary`, `citations`.

#### 2.14.3 Governance gates
- Gate CRUD: create gate with `requiredDecisions`, `requiredRaidStatus`, `requiredApprovers`.
- `evaluateGate`: checks all conditions (decisions published, RAID status met, approvers signed off) and records evaluation result.
- Decision-initiative links with link type.

Implementation: `server/src/services/initiativeGovernanceService.ts`, routes via `/api/initiatives-v4`.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_INICJATYWY_2026-03-29.md`
- Benchmark: `docs/product/PROJECT_MANAGEMENT_V8_BENCHMARK.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Plan modułu wskazuje `Softs/0 Projekty` jako primary benchmark family (`WAVE1_FINAL_IMPLEMENTATION_PLAN_INICJATYWY_2026-03-29.md`).

### 4.2 Local Softs evidence (concrete artifacts)
- **Linear (projects/initiatives posture + workflow/status grammar)**:
  - `Softs/0 Projekty/Linear.zip :: Linear/linear.appx/docs/projects.html` (Projects jako units of work: outcome/date, progress graph, notifications; integracja issue+docs).
  - `Softs/0 Projekty/Linear.zip :: Linear/linear.appx/docs/configuring-workflows.html` (status workflow: order/categories; status+automation jako governance powierzchnia).
- **ClickUp (dashboards + dependencies + templates posture)**:
  - `Softs/0 Projekty/Clickup help.zip :: Clickup help/help.clickup.com/hc/en-us/articles/6312197753239-Intro-to-Dashboards.html` (operator dashboards).
  - `Softs/0 Projekty/Clickup help.zip :: Clickup help/help.clickup.com/hc/en-us/articles/6309155073303-Intro-to-Dependency-Relationships.html` (dependency relationships: blocking/waiting semantics).
  - `Softs/0 Projekty/Clickup dev.zip :: Clickup dev/developer.clickup.com/reference/createtaskfromtemplate.html` (templates jako API surface; task-from-template).
  - `Softs/0 Projekty/Clickup dev.zip :: Clickup dev/developer.clickup.com/reference/adddependency.html` (dependency jako mutacja; “waiting on / blocking”).
- **monday.com (portfolio/timeline + dashboards/widgets as surfaces)**:
  - `Softs/0 Projekty/Monday dev.zip :: Monday dev/developer.monday.com/api-reference/changelog/new-connect_project_to_portfolio-mutation.html` (connect project→portfolio).
  - `Softs/0 Projekty/Monday dev.zip :: Monday dev/developer.monday.com/api-reference/changelog/new-timeline-items-query-and-mutations.html` (timeline items query + mutations).
  - `Softs/0 Projekty/Monday dev.zip :: Monday dev/developer.monday.com/api-reference/reference/dashboards-and-widgets.html` (dashboards/widgets jako first-class surface).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “initiative jako living object z uczciwą mutacją i spójnym lifecycle”, nie “pełna PM suite parity”.**

- **Project as a first-class object (Linear)**:
  - Inicjatywa ma wyraźny outcome, horyzont czasu, status, i progress readback.
  - Inicjatywa agreguje pracę (issues/tasks) + opcjonalne dokumenty/artefakty bez split-truth.
- **Status/workflow governance (Linear workflows)**:
  - Statusy i przejścia są spójne, stabilne pod write pressure; użytkownik rozumie “co się stało i dlaczego”.
  - Zmiany statusu mają audyt i nie rozjeżdżają widoków (read/write coherence).
- **Operator drill-down surfaces (ClickUp dashboards)**:
  - Widoki status/plan nie są dekoracyjne: prowadzą do akcji i pokazują “next action”.
- **Dependencies & constraints (ClickUp dependencies)**:
  - Zależności i ograniczenia są first-class (blocking/waiting) i wpływają na plan/wykonanie.
- **Templates + AI fill as a governed workflow (templates posture)**:
  - “Zrób inicjatywę” = template/scaffold + uzupełnienie fragmentów, ale bez silent writes; musi istnieć review/accept.
- **Portfolio/Timeline posture (monday)**:
  - Inicjatywy muszą wspierać co najmniej minimalny portfolio/timeline readback (bez przejęcia Wdrożeń).

### 4.4 Gap ledger vs Softs (what we are missing — derived from current plans)
Źródło prawdy “co mamy / czego brakuje” to: `WAVE1_FINAL_IMPLEMENTATION_PLAN_INICJATYWY_2026-03-29.md` + benchmark `PROJECT_MANAGEMENT_V8_BENCHMARK.md`.

| Capability cluster (Softs parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Write confidence (read/write coherence) | writes must be believable | “write-family truth trails read-side maturity” | Domknąć save + lifecycle transitions, żeby wszystkie widoki mówią tę samą prawdę | P0 |
| Schema resilience | stable under expected variation | “schema resilience remains a concern” | Zbudować fallback/guards na drift + zachować status truth | P0 |
| Downstream spine continuity | initiative context travels | “continuity into execution/results medium” | Wzmocnić bridges do `Wdrożenia`/`KPI`/`Finanse` na deklarowanej ścieżce | P1 |
| Operator polish | calmer workflows | “PM polish later” | Po write-truth: dopracować UX statusów i “why changed” cues | P1

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
Acceptance is **testable** and derived from §2.3–§2.14.

#### §2.3 Canon (original 11 criteria — all verified)
- [x] **AC-01** Lifecycle uses exactly the canonical states from §2.3.1 (no parallel grammar). — `P11_CANONICAL_LIFECYCLE_STATES` + DB map
- [x] **AC-02** Every lifecycle transition is explicit and audited (who/when/why). — `initiative_status_history` / `initiative_history` (existing controller)
- [x] **AC-03** Initiative can be created from at least 2 entry points and lands in the same canonical truth. — supertest E2E `p11-two-entry-points.test.ts` 4/4
- [x] **AC-04** After any write, list/table + detail + preview show identical lifecycle + key header fields (no split truth). — `getWorkflowStatusForInitiative` / `displayStatus`; portfolio + gate-readiness share backend normalizer
- [x] **AC-05** Counters/filters based on lifecycle state match the visible rows after save (no phantom counts). — portfolio stats use normalized row `status`
- [x] **AC-06** AI scaffold produces a structured `proposal` and never writes silently. — blueprint row + explicit `apply` route
- [x] **AC-07** User can review/edit the proposal and must explicitly accept before persistence. — apply is separate mutating call
- [x] **AC-08** The system records an audit trail for proposal→accept (proposalId, actor, timestamps, accepted diff). — `ai_blueprint_applied` + JSON summary
- [x] **AC-09** Handoff payloads to P03/P04/P02 include required IDs + bounded context and do not redefine initiative truth. — `GET .../handoff` + builder
- [x] **AC-10** Degraded mode is truth-preserving: incoherent writes are denied by default. — unknown target status 400; drift Callout on read
- [x] **AC-11** Schema drift does not corrupt lifecycle truth; system preserves last-known lifecycle and offers recovery/read-only posture. — `statusReadDrift` + normalized read surfaces

#### §2.4 Full CRUD + workflow actions
- [x] **AC-12** All core CRUD operations (create/read/update/delete/quick-update/move/archive) work for initiatives. — `InitiativeController.ts` 40+ handlers; integration tests
- [x] **AC-13** All workflow action endpoints enforce transition matrix and gate permissions. — `updateInitiativeStatus` uses `VALID_TRANSITIONS` + `GATE_PERMISSIONS` + `coerceInitiativeStatusForWrite`
- [x] **AC-14** Sub-entity CRUD (milestones, KPIs, resources, budget, tools, intangibles, stakeholders, watchers, RAID, comments, gate-roles, schedule-baselines) operates within initiative scope. — all routes under `/:id/` prefix

#### §2.5 V8 Planning Continuity
- [x] **AC-15** WBS decomposition supports 4-level hierarchy (initiative/workstream/task/subtask). — `v8_initiative_decompositions` + `planningContinuityService`
- [x] **AC-16** Cross-initiative dependencies are tracked with status lifecycle. — `v8_cross_initiative_dependencies`
- [x] **AC-17** Decision chains support sequential/parallel/delegated types with per-decision status. — `v8_decision_chains`
- [x] **AC-18** V8 snapshot endpoint aggregates decomposition + completeness + critical path + cross-deps + decisions in one call. — `GET /initiatives/:id/snapshot`

#### §2.6 Gate Readiness Engine
- [x] **AC-19** Gate readiness provides deterministic blocking/warning checks per lifecycle status with suggested actions and actors. — `getBlockingReadinessItems` + `getInitiativeGateReadinessRead`
- [x] **AC-20** Access resolver computes effective roles from initiative row, project membership, steering board, and explicit assignments. — `resolveInitiativeAccessContext`
- [x] **AC-21** Capabilities envelope (topBar, cards, ctaBar, reasonCodes) drives frontend CTA rendering. — `capabilities` object in gate readiness response

#### §2.7–§2.10 Document + Portfolio surfaces
- [x] **AC-22** Dynamic document view renders 25+ section types with template-driven visibility. — `InitiativeDocumentView.tsx` + `sections/registry.ts`
- [x] **AC-23** Initiative templates define level-based section visibility (quick_win/standard/strategic/transformation). — `initiativeLevelTemplates.ts`
- [x] **AC-24** Portfolio analysis workspace provides 5 subviews (resources, feasibility, logic, timeline, completeness). — `PortfolioAnalysisView.tsx`
- [x] **AC-25** Multi-view portfolio supports table, kanban, timeline, grid with consistent data. — `InitiativesHub.tsx` + `Portfolio/` components

#### §2.11–§2.14 AI + KPI + Write-Truth + Governance
- [x] **AC-26** AI generation endpoints (section gen, readiness analysis, suggest sections) operate within governance envelope. — `/initiatives/generate-section`, `/initiatives/readiness-analysis`, `/initiatives/suggest-sections`
- [x] **AC-27** KPI assignment runtime tracks realization and post-implementation phases with observation status. — `initiativeKpiAssignmentService.ts` + migration 670
- [x] **AC-28** Write-truth service ensures V8-first reads with legacy fallback and automatic refresh after writes. — `initiativeWriteTruth.ts`
- [x] **AC-29** Governance service provides Goals/OKR spine, blueprint lifecycle, and governance gate evaluation. — `initiativeGovernanceService.ts`

#### Negative / regression criteria
- [x] **AC-30** Backward transitions (e.g. delivered→executing, closed→planned) are rejected by the transition matrix. — verified: `forbiddenTransitions.test.ts` 22/22
- [x] **AC-31** Audit trail for AI blueprint apply records failure flag when audit INSERT fails (no silent swallow). — verified: `auditWritten` flag returned in `applyBlueprint` response

### 5.2 Tests
- Integracyjne: create → update → status transition → downstream handoff (`Wdrożenia`/`KPI`) bez utraty kontekstu.
- Regression: schema drift w spodziewanym zakresie → UI nie psuje status truth i nie gubi danych.
- Contract tests: AI propose payload → review/accept → audit/log.

### 5.3 Staging proof checklist
- Demo: “create initiative” (min. 2 entry points) → plan → status change → handoff do `Wdrożenia`.
- Demo: AI scaffold (“zrób inicjatywę”) → review → accept → widoki spójne po zapisie.

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (detailed plan/SSOT): see section 3.
- Softs parity + gaps: see section 4.
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P11-A — Initiative write-truth canon + scope approval
- **Goal**: jeden lifecycle + jedna prawda (read/write coherence), bez “Jira parity”.
- **Inputs required**: status grammar + audit/log baseline; handoff do `Wdrożenia`.
- **Acceptance**: scope zatwierdzony; non-goals jawne; “no silent writes” spisane.
- **Evidence**: scope approval + linkowane benchmarki.
- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze lifecycle states + transitions and the read/write coherence rules across views.
  - Freeze AI scaffold governance envelope (proposal→review→accept) + audit requirements.
  - Freeze handoff payload to `Wdrożenia`/`KPI` (bounded).
  - Implement canon section §2.3 (single source of truth for lifecycle + governance + handoffs).
- **DoD**:
  - Approved(scope): lifecycle and write-truth are explicit; no silent writes.

#### P11-B — Lifecycle transitions + downstream spine closure
- **Goal**: create→update→status transition→handoff z zachowaniem kontekstu.
- **Acceptance**: widoki po zapisie są spójne; schema drift ma guards (bounded).
- **Evidence**: integracyjne testy + staging demo (2 entry points).
- **Tasks**:
  - Implement create/update/status transitions and enforce coherent readback across views.
  - Implement schema drift guards (bounded) to preserve status truth.
  - Add integration tests + staging demo (5.3) (2 entry points).
- **Staging proof script (click-by-click)**:
  1. Create an initiative from entry point A (e.g., module link) and from entry point B (e.g., Radar/Notes) and confirm both land in the same truth.
  2. Add a plan/decomposition and change status; verify list + detail views agree after save.
  3. Trigger AI scaffold (“zrób inicjatywę”), review proposal, accept, and verify no silent writes beyond the proposal.
  4. Handoff to `Wdrożenia` and confirm context is preserved (correct initiative selected, correct lane).
  5. Make a bounded schema change and verify guards prevent status truth loss (or explicit degraded state).
- **DoD**:
  - After each write, all declared views agree; handoff preserves context.

#### P11-C — Verification + rollout
- **Goal**: regresje, staging proof, rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Capture staging proof and fill ledger rows P11-A/B/C.
  - Validate rollback: disable AI scaffold/automations; preserve CRUD+read.
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits.

### 8.2 Rollout strategy
- Najpierw write-truth i lifecycle, potem “PM polish” (P1) i rozszerzenia.

### 8.3 Rollback plan
- Wyłącz AI scaffold i automaty; zachowaj CRUD+read; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: write-truth nie dogania read → “system kłamie”.
- Ryzyko: schema drift psuje status truth.
- Decyzje: minimalny zestaw statusów i ich konsekwencje (handoff).

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P11-A | approved(scope) | 7965f5da18 | n/a (docs-only) | n/a | Canon §2.3 added; governance envelope + handoff payloads frozen |
| P11-B | `verified(evidence)` | ws/c-artifact-evidence | `initiativeLifecycleCanon.test.ts` 11/11 + `planning.handoff.p11.test.ts` 2/2 + `p11-two-entry-points.test.ts` 4/4 | see P11-C | Portfolio list: `displayStatus`+`p11LifecycleState`+`statusReadDrift` on rows (§2.3.3 full); transition matrix re-exported from canon (§2.3.2); drift Callout; controller coerce |
| P11-C | `verified(evidence)` | ws/c-artifact-evidence | + `initiativeWorkflowStatus.test.ts` 3/3 = **20 total** | `evidence/P11_VERIFIED_CLOSEOUT_2026-03-31.md` | AI apply audit; supertest E2E 2 entry points; all §5.1 criteria 11/11 checked; §8.4 staging proof complete |
| P11-D | `verified(evidence)` | 2026-04-11 contract expansion | + `forbiddenTransitions.test.ts` + audit flag fix = **22+ total** | code review + test run | Contract expanded §2.4–§2.14 (full runtime); AC-01–AC-31 (29 verified, 2 closed in this packet); audit trail best-effort fixed; deprecated views flagged for removal |

