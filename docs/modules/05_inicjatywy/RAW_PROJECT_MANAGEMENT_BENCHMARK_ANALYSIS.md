---
module_id: MODULE_INITIATIVES
contract_id: RAW_PROJECT_MANAGEMENT_BENCHMARK_ANALYSIS
doc_kind: RAW_BENCHMARK_ANALYSIS
version: 1.0
owner: user
status: canonical_draft
last_updated: 2026-05-10
---

# RAW Project Management Benchmark Analysis

## 1. Purpose

This document extracts project/program management patterns from RAW and benchmark material and translates them into requirements for Initiative as Consultify's transfer backbone.

It is a documentation-only benchmark analysis. It does not authorize runtime changes.

Primary inputs:

- `docs/product/PROJECT_MANAGEMENT_V8_BENCHMARK.md`
- `docs/product/PROJECT_MANAGEMENT_V8_MASTER_SUMMARY.md`
- `docs/RAW/implementation-pmo/107_RAW_IMPLEMENTATION_PMO_ENGINE_2026-05-09.md`
- `docs/RAW/execution-hub/103_RAW_EXECUTION_HUB_AI_EXECUTION_MANAGEMENT_ENGINE_2026-05-09.md`
- `docs/RAW/calendar/109_RAW_CALENDAR_AI_WORKDAY_PROJECT_ENGINE_2026-05-09.md`
- `docs/modules/05_inicjatywy/INITIATIVE_TRANSFER_BACKBONE_GAP_ANALYSIS.md`

## 2. Benchmark Reading

The RAW material is consistent with the benchmark product docs: modern project management has moved beyond static project records.

Market evolution:

`to-do list -> task management -> project management -> work management -> portfolio management -> AI-assisted work management`

Consultify target:

`AI-native consulting execution management`

The central distinction is important:

- classic tools manage work objects,
- PPM tools manage portfolios and resources,
- strategy tools manage outcomes and OKRs,
- Consultify must manage the consulting transfer loop from evidence to initiative, execution, decision, result and ROI.

## 3. What Project Tools Teach

### 3.1 Work Management Leaders

Asana, Monday, ClickUp, Wrike, Teamwork, Zoho Projects, Trello, Notion Projects and Basecamp contribute useful execution patterns:

- list, board, timeline, calendar and workload views over the same truth,
- easy intake and work creation,
- visible owners, dates, milestones and statuses,
- automations around due dates, state changes and assignments,
- lightweight collaboration and operational reporting.

Limit for Consultify:

These tools do not naturally close the consulting loop from initiative approval to Results, ROI, Finance and governance evidence.

### 3.2 Scheduling And PMO Tools

Microsoft Project, OpenProject and Smartsheet contribute:

- Gantt and timeline discipline,
- dependencies,
- critical path,
- plan vs actual,
- baseline and forecast separation,
- milestone-driven control.

Limit for Consultify:

Timeline cannot be only scheduling visualization. In Consultify, timeline is a risk and reaction tool: it must expose slip days, missing dates, overdue decisions, gates and impact on Results/ROI.

### 3.3 Enterprise PPM

Planview, ServiceNow SPM, Clarity PPM, Planisware, Workfront, Sciforma, Meisterplan and Kantata contribute:

- portfolio governance,
- resource capacity,
- stage gates,
- investment prioritization,
- executive dashboards,
- cross-program reporting.

Limit for Consultify:

These systems are often heavy and not AI-native. Consultify should take the governance strength, but keep a faster consulting UX focused on decision, evidence and next action.

### 3.4 Strategy And Outcome Tools

WorkBoard, Quantive, Cascade, Shibumi, ClearPoint and similar tools contribute:

- objectives,
- alignment,
- results tracking,
- executive narrative,
- benefits realization.

Limit for Consultify:

Strategy tools are often weaker in granular execution: task/decision flow, RAID, stage gates, timeline slippage and operational intervention.

## 4. Target Project Lifecycle

Consultify should use one canonical lifecycle across surfaces:

`entrypoint -> source materialization -> initiative draft -> initiative validation -> planning and approval -> execution project -> stages/gates -> tasks/decisions/RAID -> closure/handover -> results and benefits tracking -> ROI/finance reconciliation`

The RAW PMO material defines the execution conversion path as:

`initiative -> project charter -> execution plan -> stages -> gates -> timeline -> tasks -> decisions -> risks -> escalations -> PMO reports -> completion -> Results -> ROI`

This creates a hard module boundary:

| Layer | Main question | Owner responsibility |
| --- | --- | --- |
| Initiatives | What is worth doing and why? | source, rationale, business case, validation, priority, approval |
| Implementation / Realizacja | How do we deliver it? | charter, plan, gates, owners, slippage, decisions, risks, escalation |
| Tasks / My Work | What must be done by whom and when? | personal/team execution, assignment, focus, follow-up |
| Results | Did it create value? | KPI, benefit, ROI evidence |
| Finance | What is the financial effect? | cost, ROI, assumptions, budget, delay impact |

## 5. Stage And Gate Model

Project management excellence requires stages and gates to be first-class, not status labels.

Required stage types:

- Planning
- Approval
- Preparation
- Execution
- Validation
- Handover
- Results Tracking
- Closure

Required gate types:

- Approve for Execution
- Schedule for Execution
- Start Execution
- Complete Execution
- Move to Results
- Close Project
- Escalation Gate
- Steering Committee Gate

Required gate fields:

- gate type,
- current status,
- required approvers,
- entry criteria,
- exit criteria,
- required deliverables,
- required decisions,
- missing items,
- decision link,
- evidence status,
- gate recommendation,
- audit trail.

Critical rule:

Kanban movement must not bypass gate governance. A project moved to `Done` without final gate approval is either blocked or explicitly `Done - pending gate approval`.

## 6. Project Traction Model

"Traction" is the operating evidence that work is actually moving.

Consultify should track traction at five levels:

| Level | Meaning | Required signals |
| --- | --- | --- |
| Initiative traction | Initiative is moving from source to approved work. | source envelope, validation completion, sponsor/owner, approval gate |
| Planning traction | Approved initiative is being converted into an executable plan. | charter, stage plan, milestones, dependencies, baseline dates |
| Execution traction | Work is progressing in reality. | tasks completed, decisions resolved, evidence-backed progress, blockers resolved |
| Governance traction | Required controls are not stuck. | next gate, overdue decisions, approvals, PMO review, escalations |
| Value traction | Delivery is moving toward business effect. | linked KPI, Results handover, ROI assumptions, benefit risk, finance impact |

Traction cannot be a single progress percentage. It must distinguish:

- declared progress,
- evidence-backed progress,
- planned dates,
- forecast dates,
- actual dates,
- AI-inferred risk,
- approved gate status,
- pending decision,
- blocker,
- issue,
- assumption.

## 7. 2026-Level Functional Requirements

For project/program management, Consultify should include:

- one living initiative-to-project lifecycle,
- initiative-to-project conversion with audit trail,
- project charter generated from approved initiative,
- stage and gate engine,
- next gate engine,
- timeline with baseline, forecast, actual, slip days and critical path,
- milestone and dependency management,
- decision tracking as blocker/enabler, not comment thread,
- RAID log: risks, assumptions, issues, dependencies,
- escalation engine,
- resource and workload visibility,
- portfolio health dashboard,
- audience-specific reporting,
- internal/client reporting mode,
- AI PMO Analyst,
- source and trust-level distinction for AI summaries,
- handover to Results and ROI/Finance reconciliation.

## 8. Initiative Creation Analysis

The project benchmark confirms the prior transfer-backbone gap analysis: Initiative is not only a card. It is the source-backed business object that decides whether work deserves execution.

During creation, every initiative should be analyzed through:

| Analysis area | Required question |
| --- | --- |
| Source | What triggered the initiative and what evidence supports it? |
| Quality | Is this a real consulting-grade initiative or noise? |
| Duplication | Does this overlap with an existing initiative or candidate? |
| Business value | What KPI, financial, strategic or operational effect is expected? |
| Feasibility | Is there enough clarity to plan execution? |
| Ownership | Who is accountable, who sponsors it, who will decide gates? |
| Execution readiness | Can it be decomposed into tasks, decisions, RAID and milestones? |
| Timing | Does it have enough date/dependency logic to be scheduled? |
| Risk | What assumptions, blockers and dependencies are already visible? |
| Confidence | Which parts are facts, user statements, AI inference or assumptions? |

Smart generators for tools, assessments and interview must support:

- zero, one or many initiative candidates from one source,
- evidence map per candidate,
- quality scoring,
- duplicate/merge detection,
- rejection/defer reasons,
- human approval before canonical creation,
- source envelope creation.

Simple "Create Initiative" CTAs in chat, MyWork, finance or KPI/results contexts must still pass the same source envelope and review model, but do not need the full smart generator UX.

## 9. Target UX Pattern

Project/program management should use role-specific surfaces over one truth:

- Portfolio Overview: health, active/scheduled/executing/blocked/done, overdue, upcoming gates, PMO alerts.
- Execution List: status, health, owner, sponsor, PMO, progress, time, alerts, tasks, next gate.
- Kanban: flow state, but gated by governance.
- Timeline/Gantt: baseline, forecast, actual, slip days, critical path, dependencies.
- Project Detail: charter, linked initiative, timeline, milestones, next gate, decisions, RAID, tasks, Results, ROI, audit.
- Gate View: missing criteria, required decisions, approvers, recommendation.
- Management View: only decisions, blockers, red projects, ROI risk and recommended actions.
- Reporting View: weekly PMO report, steering brief, executive dashboard, recovery report.

## 10. AI Role

AI should act as PMO Analyst, not status decorator.

AI should:

- detect missing dates,
- detect overdue decisions,
- explain red/amber status,
- propose recovery plans,
- generate PMO reports,
- prepare steering committee briefs,
- predict slippage risk,
- propose tasks and escalations,
- connect delays to ROI/Finance,
- ask missing questions to owners.

Hard rule:

AI-inferred risk must never look like approved fact.

## 11. Implications For Initiative Backbone

Required changes to the Initiative target model:

1. Initiative validation sheet must become the formal pre-execution gate.
2. Initiative card must show source, readiness, next decision and execution risk, not only metadata.
3. Initiative-to-project conversion must produce or link a charter, stages, gates, milestones, tasks and decisions.
4. Tasks and decisions must be independently owned by assigned people, not implied from initiative owner.
5. Source envelope taxonomy from `INITIATIVE_TRANSFER_BACKBONE_GAP_ANALYSIS.md` remains required.
6. Project execution must not create a second initiative lifecycle truth.
7. Results/ROI handover must be planned before final execution closure.

## 12. Readiness Verdict

Benchmark verdict:

- `GO_DOCS`: the RAW material gives a clear target model.
- `NO_GO_RUNTIME`: current readiness remains blocked until source envelope, generator UX, initiative sheet readiness, task/decision backbone and capability extensions are defined and validated.

P1 blockers carried forward:

- source doctrine conflict,
- missing source envelope taxonomy in canonical source traceability,
- missing generator review UX for `0..N` candidates,
- missing shared Create Initiative CTA payload,
- missing formal initiative sheet readiness gate,
- missing task assignee/decision owner coverage,
- missing stage/gate conversion contract from approved initiative into execution project.
