---
module_id: MODULE_INITIATIVES
contract_id: RAW_TASK_MANAGEMENT_BENCHMARK_ANALYSIS
doc_kind: RAW_BENCHMARK_ANALYSIS
version: 1.0
owner: user
status: canonical_draft
last_updated: 2026-05-10
---

# RAW Task Management Benchmark Analysis

## 1. Purpose

This document extracts task/workflow management patterns from RAW and benchmark material and translates them into Initiative execution requirements.

It is intentionally separate from project management. Project management answers how initiatives become governed delivery programs. Task management answers how real work moves through people, decisions, time and follow-up.

Primary inputs:

- `docs/product/PROJECT_TASKS_AND_WORKFLOW_SOFTS_BENCHMARK_V8.md`
- `docs/product/TASK_AND_DECISION_BENCHMARK_V8.md`
- `docs/product/TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md`
- `docs/RAW/execution-hub/103_RAW_EXECUTION_HUB_AI_EXECUTION_MANAGEMENT_ENGINE_2026-05-09.md`
- `docs/RAW/calendar/109_RAW_CALENDAR_AI_WORKDAY_PROJECT_ENGINE_2026-05-09.md`
- `docs/RAW/teresa-chat/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md`
- `docs/modules/02_moja-praca/RAW_TARGET_STATE_2_0_PACKET.md`
- `docs/modules/05_inicjatywy/INITIATIVE_TRANSFER_BACKBONE_GAP_ANALYSIS.md`

## 2. Benchmark Reading

Modern task management is no longer a checklist.

The strongest benchmark pattern is:

`capture -> normalize -> triage -> assign -> schedule -> execute -> decide -> evidence -> report -> re-enter`

For Consultify this becomes:

`source signal -> initiative candidate -> initiative validation -> task/decision decomposition -> inbox/focus routing -> calendar/time execution -> decision resolution -> evidence-backed completion -> initiative/project reporting`

Task management is therefore the execution muscle of Initiative, but not the owner of initiative truth.

## 3. What Task Tools Teach

### 3.1 Notes And Capture Systems

Notion, Evernote and adjacent note systems teach:

- frictionless capture,
- "capture now, organize later",
- source-aware creation,
- search-first recovery,
- conversion from raw material into structured work.

Consultify implication:

Raw conversation, meeting notes, interview findings, finance notes or KPI signals may become work, but only after source-aware normalization. They should not immediately become canonical tasks or initiatives without review.

### 3.2 Task And Work Management Systems

ClickUp, Monday, Asana and similar tools teach:

- tasks as configurable work objects,
- statuses and many operational views,
- ownership and due dates,
- dependencies and subtasks,
- workload and capacity views,
- automations around state and dates.

Consultify implication:

Tasks under initiatives need assignee, due date, status, dependency, acceptance criteria and evidence. A task without assignee or due date is not executable work.

### 3.3 Linear-Style Discipline

Linear contributes:

- triage before execution,
- clean hierarchy,
- fast issue/project/initiative coupling,
- speed-first execution surfaces,
- AI support attached to planning/execution context.

Consultify implication:

Not every signal should become a task. The system needs intake, triage, route, defer, reject, merge and schedule actions.

### 3.4 Agent And Async Work Systems

Agent systems contribute:

- background execution with visible completion,
- typed outputs,
- fan-out/fan-in,
- governed re-entry,
- approval before high-impact writes.

Consultify implication:

AI can propose tasks, decisions, risks, blockers or initiative candidates, but they should land as reviewable candidates or inbox items before mutation.

### 3.5 Calendar And Workday Systems

Reclaim, Motion, SkedPal, Clockwise, Todoist, Sunsama and Notion Calendar contribute:

- time blocking,
- daily/weekly planning rituals,
- focus protection,
- workload and overload detection,
- meeting preparation,
- meeting outcome extraction,
- task scheduling before deadlines.

Consultify implication:

Task management must connect to time. A high-priority initiative task that has no execution slot is an intention, not a delivery plan.

## 4. Canonical Task Flow

Consultify task flow should be:

1. Capture signal or derive work from initiative/project context.
2. Normalize into a typed candidate: task, decision, approval, risk, blocker, note or initiative candidate.
3. Triage: route, assign, schedule, delegate, reject, merge, snooze or save.
4. Validate minimum executable fields.
5. Assign to a person or role.
6. Schedule or expose as unscheduled priority work.
7. Execute with status, dependency and blocker tracking.
8. Attach evidence or completion rationale.
9. Update initiative/project traction.
10. Re-enter via inbox/calendar/report if blocked, overdue or decision-dependent.

## 5. Task Object Requirements

Task should be a structured execution object, not a note.

Required fields for initiative-linked tasks:

| Field | Required | Why |
| --- | --- | --- |
| `task_id` | yes | Stable task identity. |
| `initiative_id` | conditional | Required when task belongs to initiative execution. |
| `project_id` | conditional | Required after initiative converts to execution project. |
| `title` | yes | Human-readable task. |
| `description` | recommended | Enough context to execute. |
| `assignee_id` | yes for executable task | Person responsible for doing the work. |
| `owner_id` | conditional | Responsible for task outcome if different from assignee. |
| `due_date` | yes for executable task | Without date, work is not schedulable. |
| `status` | yes | Execution state. |
| `priority` | yes | Triage and workload. |
| `acceptance_criteria` | yes for delivery tasks | Defines done. |
| `evidence_required` | conditional | Needed for governance/reports. |
| `evidence_refs[]` | conditional | Proof of completion. |
| `dependency_ids[]` | recommended | Needed for blocker graph. |
| `blocked_by_decision_ids[]` | conditional | Makes decision blockers explicit. |
| `source_envelope_refs[]` | yes when generated/derived | Preserves why task exists. |
| `created_from` | yes | `initiative`, `chat`, `meeting`, `AI`, `manual`, etc. |
| `ai_origin` | conditional | Separates proposal from approved work. |

Hard rule:

Initiative owner is not the default assignee for every task. The sheet may suggest assignees, but execution responsibility must be explicit per task.

## 6. Decision Object Requirements

Decisions are first-class blockers and enablers.

Required fields for initiative/project decisions:

- title,
- decision owner/decider,
- required-by date,
- decision type,
- options,
- recommendation,
- impact,
- linked initiative/project/task/gate,
- status,
- escalation state,
- chosen option,
- decision history,
- source/evidence refs.

Critical rule:

An overdue decision is not a note. It is a project/initiative risk and should affect health, gate readiness and management views.

## 7. Inbox And Triage Requirements

The benchmark material is clear: inbox is not a notification graveyard.

Consultify Inbox should act as:

- action queue,
- triage surface,
- governance enforcement layer,
- AI-assisted intake mechanism.

Required item types:

- task,
- decision,
- gate approval,
- review request,
- escalation,
- AI result,
- radar/idea suggestion,
- meeting follow-up,
- source signal,
- overdue/breach item.

Every inbox item should explain:

- source object,
- source actor/system,
- why this user sees it,
- expected next action,
- SLA or urgency,
- allowed triage actions.

Required triage actions:

- route to focus,
- schedule,
- delegate,
- assign,
- save,
- snooze,
- dismiss,
- done,
- reject where governance allows,
- merge/dedupe when duplicate.

## 8. Task Traction Model

Task traction means real movement through an execution state machine.

Minimum states:

- candidate,
- ready,
- scheduled,
- in_progress,
- waiting_for_decision,
- blocked,
- in_review,
- done_pending_evidence,
- done,
- cancelled,
- archived.

Traction signals:

| Signal | Meaning |
| --- | --- |
| assignment coverage | work has a responsible assignee |
| schedule coverage | work has due date or time block |
| dependency readiness | prerequisites are done or tracked |
| decision readiness | required decisions have owner/date |
| evidence readiness | completion can be proven |
| blocker age | blocked work is not ignored |
| workload fit | assignee has capacity |
| overdue state | late work is visible and escalatable |
| completion quality | done state has evidence or rationale |

## 9. Calendar And Workday Integration

Task management needs time realism.

Calendar should not become task truth, but it should expose:

- tasks on today,
- overdue tasks,
- tasks with deadlines,
- scheduled work blocks,
- unscheduled priority tasks,
- task conflicts with meetings,
- decision review slots,
- initiative reviews,
- gates and milestones,
- overload warnings.

Required rules:

- deadline is not a work block,
- task is not a calendar event,
- scheduled task is a relation between task and time block,
- AI scheduling requires user approval,
- private calendar events are masked,
- no important external meeting is moved without approval.

## 10. AI Role In Task Management

AI should assist tasking, not silently mutate work truth.

AI can:

- extract task candidates from chat, documents and meetings,
- propose task decomposition from initiative,
- identify missing assignee/date/acceptance criteria,
- suggest schedule slots,
- detect blockers,
- propose recovery actions,
- summarize status,
- prepare decision rationale,
- generate follow-up tasks after meetings.

AI must:

- show confidence,
- show source refs,
- separate fact, assumption and recommendation,
- request approval before writes,
- support accept/edit/reject,
- write audit trail for tool calls.

## 11. Initiative Creation Analysis Implications

Task-management benchmark changes how initiative creation should work.

When a new initiative is proposed, creation analysis should include an execution decomposition preview:

| Preview section | Purpose |
| --- | --- |
| Candidate tasks | Shows the work implied by the initiative. |
| Candidate decisions | Shows decisions needed before or during delivery. |
| Missing owners | Shows gaps before execution starts. |
| Estimated workload | Shows if the initiative is realistically executable. |
| Scheduling risk | Shows whether deadlines fit available time/capacity. |
| Blockers/dependencies | Shows critical prerequisites. |
| Evidence plan | Shows how completion will be proven. |

This preview should not create all tasks automatically. It should help users decide whether the initiative is mature enough to approve, split, merge, defer or reject.

## 12. Target UX Pattern

For task/workflow management attached to initiatives, the target UX should include:

- Initiative Sheet section: task/decision readiness summary.
- Task Coverage Panel: assigned/unassigned, overdue, blocked, missing acceptance criteria.
- Decision Blockers Panel: pending/overdue decisions, decider, required date, linked tasks/gates.
- Work Graph View: initiative -> project/stage -> milestones -> tasks -> decisions.
- Inbox Review Queue: AI/task/decision candidates requiring accept/edit/reject.
- Calendar Readiness: unscheduled high-priority tasks and decision slots.
- Manager/PMO View: overloaded assignees, owner bottlenecks, stale blockers.
- Evidence View: completion proof and source refs.

## 13. Functional Requirements For 2026-Level App

Consultify should include:

- source-aware intake for work,
- canonical inbox item model,
- triage actions with durable consequences,
- task assignee independent from initiative owner,
- task hierarchy and decomposition,
- dependencies and blocker graph,
- decision log as first-class object,
- task/decision links to gates and milestones,
- acceptance criteria and evidence,
- workload and capacity coupling,
- calendar scheduling and focus-time fit,
- SLA-backed urgency,
- duplicate detection,
- AI proposal review,
- audit log for AI/tool actions,
- reporting rollups to initiative/project/portfolio/results.

## 14. Anti-Patterns

Avoid:

- initiative tasks as disconnected checkboxes,
- decisions hidden in comments,
- task owner inherited silently from initiative owner,
- task board detached from KPI/ROI/business case,
- AI-generated task spam,
- calendar as second task database,
- inbox as notification feed,
- visual-rich boards without execution semantics,
- completed work without evidence when evidence is required.

## 15. Readiness Verdict

Benchmark verdict:

- `GO_DOCS`: the RAW material gives a clear task/workflow target.
- `NO_GO_RUNTIME`: current readiness remains blocked until initiative sheet readiness, task assignment, decision blocker coverage, source envelopes and AI approval flows are enforced.

P1 blockers carried forward:

- Initiative sheet does not yet formally require task assignee coverage.
- Decision blockers are not yet a mandatory readiness/gate section.
- AI task/decomposition proposals need one accept/edit/reject contract.
- Calendar/task distinction must be explicit before scheduling intelligence.
- Inbox must be treated as action queue, not notifications.
- Task and decision evidence must roll back to initiative traction and reporting.
