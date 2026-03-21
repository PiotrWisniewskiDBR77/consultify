# Agent execution v8 - SSOT

> Status: Draft v8
> Owner: Product + Engineering
> Cel: Kanoniczna definicja agenta wykonawczego, ktory startuje z komunikacji w czacie i realizuje kompletne, reviewable zadania w calej aplikacji.

---

## 0. Canonical anchors

Documents:
- `docs/product/AGENT_EXECUTION_DOMAIN_MAP_V8.md`
- `docs/product/AGENT_MULTI_AGENT_WORK_MANAGEMENT_V8.md`
- `docs/product/AGENT_EXECUTION_V8_AS_IS.md`
- `docs/product/AGENT_EXECUTION_V8_GAP_MATRIX.md`
- `docs/product/AGENT_EXECUTION_V8_IMPLEMENTATION_PLAN.md`
- `docs/product/CHAT_V8_SSOT.md`
- `docs/product/CHAT_V8_WORKFLOW_MODEL.md`
- `docs/product/CHAT_V8_ACTIONS_AND_APPROVALS.md`
- `docs/product/CHAT_V8_RUNTIME_TRUTH_MAP.md`
- `docs/product/modules/ai/AI_AGENT_ORCHESTRATION_V3.md`
- `docs/product/SYSTEM_ARCHITECTURE_BRIEF.md`
- `docs/00_foundation/WORKFLOW_CANON_MASTER.md`
- `docs/product/NOTATKA_V8_SSOT.md`
- `docs/product/PREZENTACJE_V8_SSOT.md`
- `docs/strategy/TABELE_V8_SSOT.md`

Code and runtime references:
- `server/src/services/reportAgentService.ts`
- `server/src/services/ai/AIPipeline.ts`
- `server/src/routes/ai.routes.ts`
- `server/src/services/aiActionExecutor.ts`
- `src/store/useAIActionsStore.ts`
- `src/hooks/useActionHandler.ts`

---

## 0.1 Cross-cutting parity architecture

`Agent Execution v8` pozostaje kanonicznym SSOT dla execution layer.

Przekrojowe warstwy, ktorych ten dokument nie powinien juz definiowac lokalnie, sa delegowane do:

- `docs/product/AI_WORKSPACE_PROJECT_RUNTIME_ARCHITECTURE_V8.md`
- `docs/product/AI_ARTIFACT_RUNTIME_ARCHITECTURE_V8.md`
- `docs/product/AI_BACKGROUND_AND_SCHEDULED_AGENT_RUNTIME_V8.md`
- `docs/product/AI_AGENT_SECURITY_AND_TOOL_GOVERNANCE_V8.md`
- `docs/product/AI_HUMAN_IN_THE_LOOP_GOVERNANCE_ARCHITECTURE_V8.md`
- `docs/product/AI_OUTPUT_TRUST_ARCHITECTURE_V8.md`

This document still owns:

- execution lifecycle,
- run semantics,
- proposal/preview/apply model,
- artifact mutation intent at the execution layer.

Current hardening expectation:

- `Execution Agent v8` is not leader-grade until background runtime, tool governance, workspace context and output trust are hardened together,
- execution gap status must stay aligned with parity package status,
- no new execution-adjacent feature should bypass the shared run, trust or governance model.

---

## 1. What `Agent Execution v8` means

`Agent Execution v8` to nowa warstwa produktu, w ktorej AI:
- odbiera cel w czacie,
- rozumie intencje i kontekst pracy,
- buduje plan krokow,
- proponuje konkretne zmiany w artefaktach,
- pokazuje preview i konsekwencje,
- po akceptacji wykonuje operacje,
- zostawia pelny audit trail.

To nie jest:
- kolejna persona chatowa,
- warstwa audit-agentow,
- zwykly "tool call",
- virtual worker z promptem i wiedza.

To jest:
- governed execution layer dla calej aplikacji.

---

## 2. Mission

Zbudowac w `consultify` agenta, ktory zamienia rozmowe w realna prace w systemie:
- bez cichych mutacji,
- bez utraty traceability,
- bez rozjechania z governance i permissions,
- bez redukowania calego execution do jednego promptu.

User powinien miec poczucie:
- "powiedzialem, co chce osiagnac",
- "system sam zaplanowal sensowne kroki",
- "widze, co zostanie zmienione",
- "zatwierdzam tylko to, co rozumiem",
- "agent wykonal prace i moge to przeauditowac".

---

## 3. Product promise

Execution Agent ma byc dla calej aplikacji tym, czym `Chat v8` jest dla rozmowy:
- jedna kanoniczna powierzchnia startu,
- jedna semantyka propose/approve/execute,
- jedna warstwa traceability,
- jedna polityka pracy na artefaktach.

Execution Agent ma byc mocniejszy od klasycznego chatu, bo:
- nie konczy na odpowiedzi,
- nie robi tylko researchu,
- nie ogranicza sie do pojedynczego modulu,
- potrafi przeprowadzic task end-to-end przez wiele powierzchni produktu.

---

## 4. Core principles

### 4.1 Chat starts the run, but chat is not the whole system

Agent startuje z czatu, ale wykonanie nie moze byc uwiezione w samej rozmowie.
Chat jest surface entry.
Execution jest osobna warstwa runtime i artifact operations.

### 4.2 Propose first, apply second

Zasada nadrzedna:

`understand -> plan -> propose -> preview -> approve -> apply -> audit`

Agent nie moze cicho modyfikowac canonical artifacts.

### 4.3 Typed actions over vague magic

Agent musi dzialac przez:
- action types,
- target references,
- proposal payloads,
- validation rules,
- previewable deltas.

Free-form prose moze towarzyszyc wykonaniu, ale nie moze byc jedynym kontraktem.

### 4.4 One execution contract across modules

Niezaleznie od tego, czy agent pracuje na:
- note,
- task,
- decision,
- report,
- deck,
- table,
- workspace,

user ma rozumiec ten sam lifecycle:
- proposal,
- review,
- approval,
- execution,
- audit result.

### 4.5 AI executes within governance, not above governance

Execution Agent nigdy:
- nie obchodzi gate permissions,
- nie wykonuje decyzji biznesowej za usera,
- nie tworzy "prawdy finalnej" bez review,
- nie podmienia ownership i accountability.

### 4.6 Artifact-native, not app-local

Agent nie jest narzedziem do "klikania po UI".
Jest systemem pracy na artefaktach i workflow.

To oznacza, ze kanonicznym targetem sa:
- domain objects,
- artifact mutations,
- workflow transitions,
- linked outputs,
- reviewable saves.

---

## 5. Scope

### 5.1 In scope for v8

- chat-started task intake,
- intent understanding and task decomposition,
- execution plans,
- typed action proposals,
- previews and diffs,
- approval-aware execution,
- artifact creation and modification,
- multi-step runs across more than one module,
- full audit trail,
- explicit failure and rollback-ready semantics,
- org/project/user-context-aware execution.

### 5.2 Out of scope for v8 baseline

- silent autonomous background execution without visible review,
- replacing formal governance roles,
- uncontrolled browser-robot style UI automation as canonical path,
- treating RAG management as part of execution-agent identity,
- conflating execution agent with audit agents or virtual workers,
- guaranteeing infinite autonomous loops without bounded plan and checkpoints.

---

## 6. What artifacts the agent works on

### 6.1 Core governance artifacts

Execution Agent may create or update, within permissions:
- `Initiative`
- `Task`
- `Decision`
- `Economic Analysis`
- `Benefits/Tracking records`

### 6.2 Supporting / work artifacts

Execution Agent may create or update:
- `NotebookPage`
- `Workspace`
- `Report`
- `PresentationDeck`
- `Table platform objects`
- other module-native work artifacts explicitly admitted by future adapters.

### 6.3 Source and target rule

Execution Agent must always know:
- what source context it used,
- what artifact(s) it is touching,
- whether it is creating new objects or updating existing ones,
- whether action is reversible, additive, destructive, or workflow-changing.

---

## 7. Canonical user workflow

### 7.1 Start

User writes in chat:
- a goal,
- a work request,
- a change request,
- or a broad business task.

Examples:
- "Przygotuj deck z tej notatki i dopisz brakujace slajdy."
- "Zamien to w plan inicjatywy i rozbij na taski."
- "Przeorganizuj raport i dodaj sekcje ryzyk."
- "Zbuduj baze do pipeline'u klientow i dodaj widoki."

### 7.2 Agent intake

Agent identifies:
- user intent,
- target artifacts,
- required context,
- blockers,
- approval sensitivity.

### 7.3 Plan

Agent builds an `ExecutionPlan` with:
- outcome goal,
- steps,
- required artifacts,
- proposals to create/update,
- dependencies,
- approval checkpoints.

### 7.4 Proposal

Agent turns plan into one or more `ActionProposal`s.
Each proposal must be understandable before execution.

### 7.5 Review and approval

User can:
- approve whole plan,
- approve selected steps,
- reject,
- modify scope,
- request regeneration of proposal.

### 7.6 Apply

After approval, agent executes validated actions through owning services.

### 7.7 Audit and follow-up

System shows:
- what was changed,
- what succeeded,
- what failed,
- what remains pending,
- which next steps are available.

---

## 8. Canonical execution lifecycle

Execution lifecycle for a run:

`draft_intake -> planning -> proposed -> pending_review -> approved_partial or approved_full or rejected -> executing -> completed_partial or completed_full or failed -> audited`

Rules:
- `approved` is not equal to `executed`,
- partial approval must be first-class,
- partial completion must be first-class,
- failures cannot erase the proposal trail,
- user must see whether the run is still open or closed.

---

## 9. Canonical domain model

### 9.1 `ExecutionAgentRun`

Represents one governed unit of work started from chat.

Must contain:
- `runId`
- `conversationId`
- `organizationId`
- `projectId?`
- `initiatedBy`
- `goal`
- `status`
- `plan`
- `artifactsInScope`
- `sourceContextRefs`
- `approvalState`
- `executionSummary`
- `createdAt`
- `updatedAt`
- `completedAt?`

### 9.2 `ExecutionPlan`

Represents the reviewable plan of work.

Must contain:
- `planId`
- `goalSummary`
- `steps[]`
- `assumptions[]`
- `risks[]`
- `approvalCheckpoints[]`
- `estimatedImpact`
- `estimatedCostOrEffort?`

### 9.3 `ExecutionStep`

Represents one step in the plan.

Must contain:
- `stepId`
- `type`
- `purpose`
- `targetArtifactRef?`
- `dependsOn[]`
- `proposalRefs[]`
- `status`
- `result?`

### 9.4 `ActionProposal`

Represents one reviewable intended mutation or creation.

Must contain:
- `proposalId`
- `actionType`
- `target`
- `summary`
- `reason`
- `riskLevel`
- `approvalRequired`
- `preview`
- `status`
- `createdAt`
- `resolvedAt?`

### 9.5 `ActionPreview`

Represents user-facing preview of a change.

Can include:
- `diff`
- `before/after`
- `createdObjects`
- `updatedFields`
- `destructiveImpact`
- `followupEffects`

### 9.6 `ExecutionResult`

Represents the actual outcome.

Must contain:
- `success`
- `appliedChanges[]`
- `failedChanges[]`
- `createdArtifactRefs[]`
- `updatedArtifactRefs[]`
- `auditRef`

---

## 10. Action taxonomy

### 10.1 Action families

Execution Agent actions belong to one of these families:

1. `CreateArtifact`
2. `UpdateArtifact`
3. `TransformArtifact`
4. `LinkArtifacts`
5. `WorkflowTransition`
6. `GenerateStructuredOutput`
7. `ReviewOrQualityPass`
8. `RequestHumanDecision`

### 10.2 Module examples

Examples by module:

- Notes:
  - create note
  - structure note
  - convert note to decision/task/initiative

- Reports:
  - reorder sections
  - add/remove sections
  - regenerate section draft

- Presentations:
  - create deck from context
  - refresh outline
  - rewrite slides
  - add slide block proposals

- Tables:
  - create base
  - propose schema
  - add field
  - create view
  - generate starter records

- Initiatives / execution:
  - create initiative draft
  - create tasks
  - create decision request
  - move workflow state where permissions allow

### 10.3 Destructive vs non-destructive actions

Every action must be classified as:
- `safe_additive`
- `safe_update`
- `sensitive_update`
- `destructive`
- `governance_transition`

Approval expectations derive partly from this class.

---

## 11. Approval model

### 11.1 Approval is mandatory for material mutations

Approval is required for:
- creating durable artifacts,
- modifying canonical artifacts,
- workflow transitions,
- destructive changes,
- multi-artifact plans,
- anything that changes accountability or governance state.

### 11.2 Auto-execution is limited

Auto-execution may be allowed only for low-risk actions such as:
- opening a surface,
- preparing a preview,
- generating a non-durable draft,
- local lightweight helper actions explicitly marked safe.

### 11.3 Partial approval

User must be able to:
- approve one proposal,
- reject another,
- ask for revised plan,
- keep run open.

### 11.4 Reject is a real state

Reject must:
- stop execution path for that proposal,
- remain auditable,
- not disappear as if nothing happened.

---

## 12. Module operating model

### 12.1 Chat is the universal intake surface

Canonical entry:
- `UnifiedChatPanel`

Execution Agent should integrate with canonical chat surface, not multiply legacy shells.

### 12.2 Artifact adapters own mutations

Execution Agent must not directly mutate arbitrary module data in ad-hoc ways.
It should execute through module-aware adapters / owning services.

Target pattern:
- one execution orchestrator,
- many module adapters.

Examples:
- notes adapter,
- reports adapter,
- presentations adapter,
- tables adapter,
- initiatives/tasks/decisions adapter.

### 12.3 Workspace continuity

If a run begins in one workspace context, the agent should preserve:
- project context,
- selected artifact context,
- source context,
- language and user preference context,
- approval and permission context.

---

## 13. Runtime architecture statement

The execution stack should be understood as:

`chat intake -> context assembly -> intent and plan builder -> proposal compiler -> preview builder -> approval gate -> module adapters -> audit logger`

### 13.1 Chat intake layer

Owns:
- message intake,
- conversation continuity,
- visible plan/proposal rendering.

### 13.2 Context layer

Owns:
- organization, project and artifact context,
- user memory where allowed,
- retrieval-backed context,
- screen/selection context.

### 13.3 Planning layer

Owns:
- intent decomposition,
- step ordering,
- dependency graph,
- plan shape.

### 13.4 Proposal layer

Owns:
- typed proposals,
- rationale,
- risk classification,
- preview objects.

### 13.5 Execution layer

Owns:
- adapter dispatch,
- approval validation,
- result collection,
- partial failure handling.

### 13.6 Audit layer

Owns:
- status trail,
- actor trail,
- timestamps,
- affected artifact refs,
- final run summary.

---

## 14. Governance and permissions

### 14.1 Project role supremacy

Execution Agent cannot bypass project-role and gate semantics.
Workflow gates remain governed by canonical roles and transitions.

### 14.2 AI is never the decider

Agent may:
- propose,
- prepare,
- structure,
- execute after approval.

Agent may not:
- approve business gates by itself,
- silently accept governance transitions,
- impersonate a project role.

### 14.3 Source honesty

If the agent used:
- note context,
- report context,
- retrieval context,
- table data,
- conversation context,

that should be attributable in run-level traceability.

### 14.4 Privacy and retention

Execution runs must inherit chat and platform privacy rules.
Private mode and restricted memory modes must be respected.

---

## 15. Failure model

Execution Agent must distinguish between:
- `planning failure`
- `validation failure`
- `approval missing`
- `adapter execution failure`
- `partial success`
- `policy/permission failure`

User should never receive one flat "something went wrong" when the system knows which layer failed.

---

## 16. Anti-patterns

- one giant prompt pretending to be an execution system,
- silent artifact mutation,
- approval button with unclear meaning,
- module-specific action semantics that contradict each other,
- treating audit agents as execution workers,
- treating virtual workers as execution engine,
- creating artifacts without clear target refs,
- chat output that says work was done when only a suggestion was produced,
- skipping audit trail because "it was just AI help".

---

## 17. Definition of done for the concept

The execution-agent concept is complete only when:

1. `agent` has one meaning in this package: governed work executor.
2. Chat is defined as intake surface, not the whole runtime.
3. The lifecycle `understand -> plan -> propose -> preview -> approve -> apply -> audit` is canonical.
4. Execution is typed through proposals and action taxonomy.
5. The agent can work across artifacts, not just inside one module.
6. Approval, permissions and audit are built into the concept, not added later.
7. The concept clearly separates shared infrastructure from module adapters.

---

## 18. Recommended next docs

This SSOT is part of the canonical execution-agent package:
- `AGENT_EXECUTION_V8_AS_IS.md`
- `AGENT_EXECUTION_V8_GAP_MATRIX.md`
- `AGENT_EXECUTION_V8_IMPLEMENTATION_PLAN.md`

Together, these documents answer:
- what runtime pieces already exist,
- what gaps block whole-app execution,
- in what order we build the execution spine.

Related references:
- `AGENT_EXECUTION_DOMAIN_MAP_V8.md`
- `CHAT_V8_ACTIONS_AND_APPROVALS.md`
- `CHAT_V8_RUNTIME_TRUTH_MAP.md`
- `AI_AGENT_ORCHESTRATION_V3.md`
- `NOTATKA_V8_SSOT.md`
- `PREZENTACJE_V8_SSOT.md`
- `TABELE_V8_SSOT.md`
