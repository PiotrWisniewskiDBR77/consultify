# Agent execution v8 - Implementation plan

> Status: Draft v8
> Owner: Product + Engineering
> Cel: Build-ready plan przebudowy `consultify` w kierunku kanonicznego execution agent, ktory startuje z chatu i realizuje reviewable prace na artefaktach calej aplikacji.

---

## 1. Strategic intent

Nie budujemy "kolejnego AI feature".

Budujemy nowa warstwe systemu:
- `chat-started`
- `artifact-native`
- `proposal-and-approval governed`
- `cross-module`
- `audit-ready`

Execution Agent ma stac sie wspolnym execution spine dla pracy AI w aplikacji.

---

## 2. Planning inputs

Canonical inputs for this plan:
- `AGENT_EXECUTION_DOMAIN_MAP_V8.md`
- `AGENT_EXECUTION_V8_SSOT.md`
- `AGENT_EXECUTION_V8_AS_IS.md`
- `AGENT_EXECUTION_V8_GAP_MATRIX.md`
- `CHAT_V8_ACTIONS_AND_APPROVALS.md`
- `SYSTEM_ARCHITECTURE_BRIEF.md`
- `WORKFLOW_CANON_MASTER.md`

Runtime anchors:
- `server/src/services/reportAgentService.ts`
- `server/src/services/aiActionExecutor.ts`
- `server/src/ai/actionExecutionAdapter.ts`
- `server/src/routes/ai.routes.ts`
- `src/store/useAIActionsStore.ts`

---

## 3. Program objective

Deliver one governed execution layer in which:
- chat starts a run,
- system creates a plan,
- proposals are reviewable,
- approvals are explicit,
- execution goes through module adapters,
- results are auditable,
- modules reuse one contract instead of inventing local AI execution patterns.

---

## 4. Build principles

### 4.1 Reuse the strongest patterns, do not fork more local systems

Prefer:
- report diff/apply pattern,
- durable action state,
- decision snapshots,
- module-owned mutation services.

Avoid:
- more isolated AI proposal subsystems,
- UI-automation as canonical execution path,
- prompt-only "agent magic" with no typed contract.

### 4.2 One backbone, many adapters

The architecture target is:

`chat intake -> execution orchestrator -> execution run -> step planner -> action proposals -> approvals -> module adapters -> audit summary`

### 4.3 Safety before autonomy

No broad autonomy until:
- run model exists,
- approval model exists,
- audit exists,
- permissions and gates are unified.

---

## 5. Workstreams

## 5.1 Workstream A - Canonical execution domain

Goal:
- establish one shared runtime model.

Scope:
- `ExecutionAgentRun`
- `ExecutionPlan`
- `ExecutionStep`
- `ActionProposal`
- `ActionPreview`
- `ExecutionResult`
- run lifecycle and statuses

Deliverables:
- types/interfaces
- persistence model
- run-status semantics
- plan/proposal/result schema

Acceptance criteria:
- every execution request can be represented as one run,
- multi-step work no longer depends on module-local ad hoc state,
- proposal/approval/execution phases are distinct in data model.

## 5.2 Workstream B - Proposal and approval spine

Goal:
- make proposal and approval semantics universal.

Scope:
- normalize proposal payloads,
- normalize approval states,
- define partial approval,
- define refine/edit/reject flows,
- align chat UX and backend truth.

Deliverables:
- universal proposal schema
- approval service contract
- chat rendering contract for pending work
- migration path from `ai_actions` and module-local proposal records

Acceptance criteria:
- same core approval meaning across chat, reports, tables, notebooks and future modules,
- approve does not silently imply execute unless policy explicitly allows it,
- refine/edit is first-class.

## 5.3 Workstream C - Execution orchestrator

Goal:
- execute bounded multi-step plans.

Scope:
- run creation from chat,
- step scheduling,
- dependency handling,
- checkpoint evaluation,
- partial success/failure semantics,
- replan and retry rules.

Deliverables:
- orchestration service
- step state machine
- retry rules
- run closeout summary

Acceptance criteria:
- agent can execute more than one step in one governed run,
- partial completion is visible,
- failures do not erase trail or plan.

## 5.4 Workstream D - Module adapter layer

Goal:
- connect execution spine to real artifacts through owned services.

Initial adapters:
- `Task`
- `Decision`
- `Initiative`
- `Report`
- `Notebook`
- `PresentationDeck`
- `Table platform`

Deliverables:
- adapter interface
- per-module adapter implementations
- preview/diff capabilities where possible
- destructive-action classification

Acceptance criteria:
- execution never mutates artifacts directly from chat component logic,
- adapters call owning services,
- adapter output is normalized for audit and UI.

## 5.5 Workstream E - Governance, permissions, workflow canon

Goal:
- make execution agent fully governance-aware.

Scope:
- permission checks,
- workflow gates,
- role enforcement,
- destructive-action policies,
- high-risk action rules.

Deliverables:
- execution policy layer
- action risk taxonomy
- gate-check integration with workflow canon
- mandatory-approval rules

Acceptance criteria:
- execution agent cannot bypass ownership, role or gate rules,
- high-risk changes always surface proper review,
- user-facing errors clearly explain governance blockers.

## 5.6 Workstream F - Run audit, observability, operator tooling

Goal:
- make runs inspectable and supportable.

Scope:
- run log,
- correlation IDs,
- per-step result log,
- support/admin views,
- replay-safe diagnostics.

Deliverables:
- run audit schema
- execution timeline UI
- support diagnostics fields
- structured telemetry

Acceptance criteria:
- support can reconstruct what happened in a run,
- users can see what changed and what failed,
- audit survives partial failures.

## 5.7 Workstream G - Product UX normalization

Goal:
- make execution feel like one product, not several AI subfeatures.

Scope:
- chat run cards,
- plan review UI,
- proposal review UI,
- execution progress UI,
- result summary UI,
- follow-up actions.

Deliverables:
- common execution surfaces
- shared states and labels
- module integration patterns

Acceptance criteria:
- user sees one lifecycle across artifacts,
- proposal/review/apply/result states are visually consistent,
- module-local execution UI becomes an adapter of the common contract.

---

## 6. Delivery waves

### Wave 1 - Foundation

Focus:
- domain model
- run lifecycle
- proposal/approval contract
- execution orchestrator shell

Must ship:
- one execution run schema
- one proposal schema
- one approval state model
- one run status model

### Wave 2 - First real adapters

Focus:
- reports
- tasks
- notebooks
- tables

Why:
- repo already has strongest foundations here,
- fastest path to real cross-artifact proof.

Must ship:
- adapter interface
- normalized previews/results
- cross-module execution from one run

### Wave 3 - Governance hardening

Focus:
- permissions
- gates
- destructive actions
- partial approvals
- retries and failure semantics

Must ship:
- risk model
- governance blocker messages
- admin/operator visibility

### Wave 4 - Product unification and scale

Focus:
- replace fragmented local patterns with common execution runtime,
- extend to initiatives, decisions, presentations and more artifacts,
- add evals and operational telemetry.

Must ship:
- common execution UI
- standardized module integration
- execution-agent evaluation pack

---

## 7. Suggested implementation order

1. Freeze terminology and runtime model.
2. Create persistent execution-run layer.
3. Normalize proposal and approval contracts.
4. Build orchestrator service.
5. Implement first adapter set: reports, tasks, tables, notebooks.
6. Expose unified execution UI in chat.
7. Add audit and operator tooling.
8. Expand artifact coverage.
9. Run evaluation and adoption hardening.

---

## 8. Engineering design rules

### 8.1 No direct UI-originated canonical mutations

UI may trigger actions, but canonical mutations must flow through:
- execution orchestrator,
- adapter,
- owning service.

### 8.2 No silent apply for material mutations

Material changes to canonical artifacts require:
- reviewable proposal,
- explicit approval or clearly defined policy,
- durable execution record.

### 8.3 No new module-local proposal systems unless they implement the shared contract

Every new AI execution feature must plug into:
- shared run model,
- shared proposal model,
- shared approval model,
- shared audit model.

### 8.4 Keep module intelligence local, keep lifecycle global

Meaning:
- module-specific transformation logic stays in adapters,
- execution lifecycle stays common.

---

## 9. Definition of done for execution-agent v8

`Execution Agent v8` is done when all of the following are true:

- user can start a real work request from chat,
- system creates a bounded execution run with visible plan,
- proposals are typed and reviewable,
- approvals are explicit and durable,
- execution can span more than one module,
- artifact mutations flow through adapters and owning services,
- full audit exists for run, steps and outputs,
- failures, partial success and follow-up actions are visible,
- module-local AI execution patterns are converging toward one contract.

---

## 10. Anti-patterns during implementation

Do not:
- ship "agent" as a prompt wrapper with no runtime model,
- create a parallel execution system only for one module,
- treat tool-calling approval as full execution governance,
- let approval and execution collapse into one hidden operation,
- rely on browser-like automation as canonical mutation path,
- bypass workflow canon for convenience.

---

## 11. Strategic outcome

If this plan is implemented correctly, `consultify` will gain:
- one true AI execution layer,
- one coherent proposal/approval language,
- one reusable cross-artifact execution backbone,
- and a real foundation for a Cursor/Replit-style working agent inside the application.

Related docs:
- `AGENT_AND_KNOWLEDGE_V8_MASTER_PLAN.md`
- `AGENT_EXECUTION_V8_SSOT.md`
- `AGENT_EXECUTION_V8_AS_IS.md`
- `AGENT_EXECUTION_V8_GAP_MATRIX.md`
