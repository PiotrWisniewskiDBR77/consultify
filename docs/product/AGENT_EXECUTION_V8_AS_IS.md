# Agent execution v8 - As is

> Status: Draft v8
> Cel: Uczciwie opisac, co juz istnieje w runtime jako fundament pod `Execution Agent`, co jest tylko czesciowym wzorcem, a co nalezy traktowac jako legacy lub osobny system.

---

## 1. Po co istnieje ten dokument

`AGENT_EXECUTION_V8_SSOT.md` definiuje target product.

Ten dokument odpowiada na inne pytanie:

`co juz mamy w kodzie, co mozna reuse'owac, a czego nie wolno pomylic z gotowym execution spine?`

To jest dokument wykonawczy.
Ma chronic zespol przed dwoma bledami:
- projektowaniem od zera, mimo ze repo ma juz wartosciowe wzorce,
- zakladaniem, ze jeden z istniejacych systemow "juz jest execution agentem", mimo ze nim nie jest.

---

## 2. Executive verdict

`consultify` ma juz wiele potrzebnych elementow pod `Execution Agent`, ale sa one rozproszone.

Obecny stan najlepiej opisac tak:

- `chat intake exists`
- `approval patterns exist`
- `some executable actions exist`
- `artifact-specific proposal/review flows exist`
- `audit-friendly post-decision execution exists`
- `one cross-app execution spine does not exist yet`

Najblizszy prawdziwemu execution-agent pattern jest dzis:
- `server/src/services/reportAgentService.ts`

Najmocniejszy istniejacy governed action backbone jest dzis:
- `server/src/services/aiActionExecutor.ts`
- `server/src/routes/ai.routes.ts` action approval endpoints
- `server/src/ai/actionDecisionService.ts`
- `server/src/ai/actionExecutionAdapter.ts`

Najwiekszy problem:
- te warstwy nie sa jeszcze jednym systemem.

---

## 3. Runtime classification

### 3.1 Canonical or near-canonical foundations

These are the strongest reusable foundations for future execution work:

#### A. Chat as intake surface

What exists:
- canonical chat stack lives around `UnifiedChatPanel`, stream API and `Chat v8` runtime truth,
- chat already supports pending actions, action indicators and approval-oriented language.

Why it matters:
- execution agent can start from chat without inventing a new intake shell.

#### B. DB-backed AI action workflow

What exists:
- `server/src/services/aiActionExecutor.ts`
- `server/src/routes/ai.routes.ts` approve/reject/pending actions endpoints
- `src/store/useAIActionsStore.ts`

What it does:
- creates `ai_actions`,
- classifies actions into pending/approved/rejected/executed,
- supports approval and rejection,
- exposes pending actions to UI.

Why it matters:
- this is the clearest current backbone for durable actions in chat.

#### C. Post-approval execution with audit-style logging

What exists:
- `server/src/ai/actionDecisionService.ts`
- `server/src/ai/actionExecutionAdapter.ts`
- `server/src/routes/actionDecisions.routes.ts`

What it does:
- records decisions,
- snapshots proposal payloads,
- executes selected approved actions through executors,
- logs execution records and correlation metadata.

Why it matters:
- this is the strongest existing "decision -> execute -> audit" path.

#### D. Report mutation flow with preview

What exists:
- `server/src/services/reportAgentService.ts`
- report-builder route integration

What it does:
- parses intent,
- creates typed actions,
- produces diff previews,
- waits for apply,
- persists assistant proposal history.

Why it matters:
- this is the best concrete mutation pattern in the repo.

---

### 3.2 Partial but valuable module-local patterns

These are useful, but not yet a unified cross-app execution model.

#### A. Table schema proposals

What exists:
- `src/components/MyWork/table/SchemaProposalCard.tsx`
- `src/components/AIChat/ChatTableProposalCard.tsx`
- `src/components/MyWork/table/ExecutionProgress.tsx`

What it does:
- shows schema proposal operations,
- supports approve/reject/refine,
- shows execution progress and undo semantics.

Why it matters:
- table platform already has a strong proposal/review micro-pattern.

Current limitation:
- this pattern is table-specific, not cross-artifact.

#### B. Notebook AI proposals

What exists:
- `src/components/MyWork/notebook/AICommandPrompt.tsx`

What it does:
- takes natural-language command,
- generates AI output,
- creates notebook proposal for review.

Why it matters:
- notebook already follows visible proposal semantics.

Current limitation:
- this is append-style content help, not a full execution run model.

#### C. Lightweight action/navigation handling

What exists:
- `src/hooks/useActionHandler.ts`

What it does:
- handles navigation and lightweight action execution semantics,
- maps module targets to routes.

Why it matters:
- useful for ephemeral response actions.

Current limitation:
- not a governed cross-artifact executor.

#### D. MCP approval gate

What exists:
- `server/src/services/ai/mcpServer.ts`

What it does:
- distinguishes `READ` vs `MUTATION`,
- returns `REQUIRES_APPROVAL` for mutation tools.

Why it matters:
- confirms the platform already encodes approval semantics at tool layer.

Current limitation:
- approval return is generic and not yet unified with full execution-run model.

---

### 3.3 Legacy or non-canonical foundations

These should not be treated as the execution-agent spine.

#### A. Agent Audit system

Paths:
- `server/src/services/ai/agentAudit/*`
- `docs/modules/ai/AGENT_AUDIT_LAYER.md`

Reason:
- audit/review layer,
- not mutation/execution layer.

#### B. Virtual Workers

Paths:
- `server/src/routes/virtual-workers.routes.ts`
- `server/src/services/ai/virtualWorkerService.ts`
- `server/src/services/ai/virtualWorkerKnowledgeService.ts`

Reason:
- persona + surface + assigned knowledge framework,
- not full execution engine.

#### C. `ai/agents/*` wrappers and generic multi-agent routes

Paths:
- `server/src/services/aiOrchestrator.ts`
- `server/src/routes/agents.routes.ts`
- `server/src/services/ai/agents/*`

Reason:
- broad orchestration idea exists,
- current wrappers look like migration/compatibility layer,
- not enough to declare canonical execution runtime.

---

## 4. Current-state matrix

| Area | Current state | Interpretation |
|---|---|---|
| Chat intake | Real | Strong start point for execution intake |
| Durable actions in chat | Real but fragmented | Good base, but one truth is missing |
| Approve / reject semantics | Real | Backend endpoints exist, semantics still uneven across surfaces |
| Execute after approval | Real but limited | Exists for some action classes only |
| Proposal history | Real in some places | Reports and action systems persist state |
| Diff preview | Strong in reports, partial elsewhere | Best existing UX pattern, not universal |
| Multi-step run model | Partial | Pieces exist, one `ExecutionAgentRun` model does not |
| Cross-artifact adapter layer | Missing | Biggest structural gap |
| Audit trail | Strong in action-decision path | Not yet universal across all proposal systems |
| Table execution pattern | Strong but local | Reusable pattern, not global |
| Notebook execution pattern | Proposal-level only | Useful but narrow |
| Agent catalog | Not canonical for execution | Must stay separated from execution scope |

---

## 5. Detailed as-is by layer

### 5.1 Intake layer

As-is:
- chat can start actions,
- user already sees action-oriented responses,
- canonical intake should remain in chat, not in a separate agent app.

Constraint:
- `Chat v8` still has some split between canonical and legacy surfaces,
- execution concept must stay aligned to canonical chat surface.

### 5.2 Proposal layer

As-is:
- proposals exist in several independent forms:
  - `ai_actions`
  - report agent message proposals
  - table schema proposals
  - notebook AI proposals
  - action proposals / decisions

Constraint:
- proposal shape and lifecycle are inconsistent between modules.

### 5.3 Approval layer

As-is:
- approval exists in backend and UI,
- some actions require confirmation,
- some flows support reject,
- action-decision layer supports durable admin-grade decisions.

Constraint:
- approval semantics are not yet one universal contract across all execution surfaces.

### 5.4 Execution layer

As-is:
- executable operations exist for:
  - task creation and updates,
  - some post-decision executors,
  - report structure changes,
  - table schema execution.

Constraint:
- no shared adapter architecture exists for all artifact classes.

### 5.5 Audit layer

As-is:
- strongest in action decisions/executions,
- present in report agent messages,
- present in worker analytics and some module-local systems.

Constraint:
- one universal run-level audit trail does not yet exist.

---

## 6. Strongest runtime patterns we should reuse

### 6.1 `reportAgentService.ts` pattern

Reusable ideas:
- parse natural language into typed action,
- generate reviewable preview,
- persist assistant proposal,
- separate apply phase,
- keep execution close to artifact owner service.

### 6.2 `AIActionExecutor` pattern

Reusable ideas:
- policy checks,
- role/regulatory checks,
- approval-required logic,
- persisted action state,
- pending actions retrieval.

### 6.3 `actionDecisionService` + `actionExecutionAdapter` pattern

Reusable ideas:
- snapshot before execution,
- correlation IDs,
- idempotency checks,
- explicit execution logs,
- dry-run style thinking.

### 6.4 Table proposal UX pattern

Reusable ideas:
- operation list,
- confidence,
- warnings,
- refine step,
- execution progress and undo.

---

## 7. Biggest structural problems in the current state

### 7.1 Too many parallel proposal systems

The repo currently has multiple proposal/execution micro-systems.
This is useful as inspiration, but dangerous as architecture.

### 7.2 No single execution-run truth

There is no one canonical entity today that equals:
- one user goal,
- one plan,
- many steps,
- many proposals,
- approval checkpoints,
- one audit summary.

### 7.3 Approval semantics vary by surface

Some flows are:
- local-first,
- some server-backed,
- some admin-biased,
- some module-specific,
- some only tool-gated.

### 7.4 Mutations are still artifact-specific

This is good for safety, but bad for a cross-app execution concept unless we add adapters and one common orchestration layer.

---

## 8. Strategic conclusion

`consultify` already has enough real execution DNA to avoid greenfield design.

The correct reading of the current state is:
- not `we have no execution foundations`,
- but `we have several execution fragments and must unify them`.

The future `Execution Agent` should therefore:
- reuse the strongest patterns,
- reject legacy confusion,
- unify proposal and approval semantics,
- and introduce one cross-artifact execution spine above module adapters.

Related docs:
- `AGENT_EXECUTION_V8_SSOT.md`
- `AGENT_EXECUTION_DOMAIN_MAP_V8.md`
- `CHAT_V8_ACTIONS_AND_APPROVALS.md`
- `AI_AGENT_ORCHESTRATION_V3.md`
