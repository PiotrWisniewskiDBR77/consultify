# Agent And Knowledge v8 - Master plan

> Status: Draft v8
> Owner: Product + Engineering
> Cel: Spiac `Execution Agent v8` i `Knowledge RAG v8` w jeden kanoniczny plan wdrozenia, ktory pokazuje co budujemy najpierw, jakie sa zaleznosci i jaki runtime powinien byc wdrazany dzis.

---

## 1. Why this document exists

`Execution Agent v8` i `Knowledge RAG v8` nie sa dwoma osobnymi inicjatywami.

To sa dwie polowy jednego systemu:

- `Execution Agent v8` odpowiada za `work orchestration`,
- `Knowledge RAG v8` odpowiada za `governed knowledge and working context`.

Bez execution spine AI nie wykona realnej pracy.
Bez governed knowledge i working memory AI bedzie wykonywalo prace na slabym albo niebezpiecznym kontekscie.

Ten dokument jest master planem:

- co wdrazac,
- w jakiej kolejnosci,
- co jest blockerem dla czego,
- co jest definicja realnego readiness do budowy "agenta, ktory pracuje".

---

## 2. Executive decision

Canonical target for `consultify` is:

`chat-started governed execution agent powered by one policy-aware knowledge layer and one run-scoped working memory architecture`

To oznacza, ze system docelowy musi miec jednoczesnie:

- jeden `execution backbone`,
- jeden `retrieval policy gateway`,
- jedna `working memory orchestration`,
- jeden `proposal -> approve -> apply -> audit` lifecycle,
- jedna strukturalna logike tenant, privacy i governance.

Nie wolno budowac:

- execution agenta bez knowledge governance,
- knowledge layer bez execution consumer contract,
- osobnych lokalnych AI spine'ow per modul,
- "magic prompt agent" bez typed runtime model.

---

## 2.1 Leader parity package is now a required architecture input

`Execution Agent v8` i `Knowledge RAG v8` pozostaja rdzeniem programu build-now.

Od teraz musza byc jednak czytane razem z pakietem `AI Leader Parity Architecture v8`, ktory domyka przekrojowe warstwy niezbedne do zbudowania najlepszego `AI business environment`, a nie tylko dobrego agenta i dobrego RAG.

The parity package is mandatory especially for:

- `workspace/project runtime`,
- `connectors and enterprise search`,
- `background and scheduled runtime`,
- `tool governance`,
- `AI ops and release`,
- `output trust`.

Required docs:

- `AI_LEADER_PARITY_ARCHITECTURE_V8.md`
- `AI_WORKSPACE_PROJECT_RUNTIME_ARCHITECTURE_V8.md`
- `AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md`
- `AI_BACKGROUND_AND_SCHEDULED_AGENT_RUNTIME_V8.md`
- `AI_AGENT_SECURITY_AND_TOOL_GOVERNANCE_V8.md`
- `AI_OPERATIONS_AND_RELEASE_ARCHITECTURE_V8.md`
- `AI_OUTPUT_TRUST_ARCHITECTURE_V8.md`

These documents do not replace this master plan.
They define cross-cutting constraints that the execution + knowledge program must inherit.

---

## 2.2 Core AI hardening program

After creating the parity package, the next required step is not only implementation.
It is also documentation hardening of the core AI canon.

The hardening program must keep these packages synchronized:

- `Chat v8`
- `Execution Agent v8`
- `Knowledge RAG v8`
- `Multi-Agent v8`
- `AI_LLM_MODEL_MANAGEMENT_V8`
- `AI Leader Parity Architecture v8`

Definition of success for this hardening pass:

- benchmark docs reflect parity package ownership,
- gap matrices reflect which gaps are moved, partially closed or still open,
- parity docs are strong enough to act as shared source of truth for implementation,
- master plan and registry describe one coherent AI core, not parallel document families.

---

## 3. North star architecture

Docelowy przeplyw:

`chat intake -> execution run creation -> working memory orchestrator -> retrieval policy gateway -> working set assembly -> plan/proposal generation -> approval -> module adapters -> execution results -> compaction/handoff -> audit trail`

### 3.1 Execution side owns

- `ExecutionAgentRun`
- `ExecutionPlan`
- `ExecutionStep`
- `ActionProposal`
- `ActionPreview`
- `ExecutionResult`
- module adapter contract
- approval and audit semantics

### 3.2 Knowledge side owns

- `KnowledgeObjectRegistry`
- `KnowledgeChunkStore`
- `UserPrivateMemoryStore`
- `OrganizationKnowledgeStore`
- `RetrievalPolicyGateway`
- `WorkingMemoryOrchestrator`
- `RunStateLedger`
- `IssueSummaryStore`
- `KnowledgePromotionWorkflow`
- `KnowledgeUsageAudit`

### 3.3 Shared seam between them

Execution does not query raw corpora directly.

Knowledge does not decide product actions directly.

The seam is:

- task type,
- active artifact context,
- allowed scope budget,
- retrieval result set,
- working memory state,
- source ledger,
- approval-sensitive evidence.

---

## 4. Non-negotiable product decisions

### 4.1 Chat starts the run

Canonical entrypoint is chat, but execution must leave the chat surface and live in dedicated runtime objects.

### 4.2 Retrieval is policy-first

No semantic ranking before tenant, scope, visibility and sensitivity constraints.

### 4.3 Working memory is bounded

Short-term memory is `run-scoped working state`, not full transcript replay and not a second RAG corpus.

### 4.4 Propose first, apply second

Canonical lifecycle:

`understand -> retrieve -> assemble working state -> plan -> propose -> preview -> approve -> apply -> audit`

### 4.5 Shared knowledge is org-governed

No direct user-to-user retrieval.
Cross-user reuse inside one tenant must go through governed org scope.

### 4.6 Adapters own mutations

Execution spine never mutates artifacts directly from chat or prompt logic.

### 4.7 Audit is first-class

Every run must preserve:

- source traceability,
- proposal history,
- approval history,
- execution result trail,
- support-visible diagnostics.

---

## 5. Program structure

## 5.1 Foundation layer

Must be solved before scale:

- execution domain model,
- knowledge ownership model,
- storage truth map,
- retrieval policy gateway,
- run state ledger,
- universal proposal/approval semantics.

## 5.2 Intelligence layer

Built on top of the foundation:

- working memory orchestration,
- issue summaries,
- tool result compaction,
- active document set management,
- plan generation,
- bounded replan and retry.

## 5.3 Application layer

Where value becomes visible:

- task/decision/initiative adapters,
- report/notebook/table/deck adapters,
- chat rendering of runs,
- support/admin run inspection,
- knowledge promotion and curation UX.

---

## 6. Dependency truth

### 6.1 What execution depends on from knowledge

Execution Agent cannot be production-grade without:

- allowed scope resolution,
- governed retrieval,
- source ledger,
- working memory state,
- active evidence selection,
- handoff/resume packs.

### 6.2 What knowledge depends on from execution

Knowledge RAG cannot be complete without a primary consumer contract that defines:

- task types,
- artifact context,
- approval-sensitive retrieval rules,
- what facts become durable,
- what runtime state stays ephemeral.

### 6.3 Core insight

`Execution Agent v8` is the primary operating consumer.
`Knowledge RAG v8` is the primary governed context substrate.

They should be built as one program with two strongly typed halves.

---

## 7. Delivery order

## 7.1 Wave 0 - Freeze doctrine

Ship:

- canonical naming and package map,
- one master plan,
- one ownership map,
- one cross-doc dependency model,
- explicit `V8` implementation set,
- explicit `AI Leader Parity Architecture v8` package.

Definition of success:

- teams know exactly which docs are authoritative for build decisions today,
- cross-cutting AI architecture is no longer hidden inside local package assumptions.

## 7.1A Wave 0A - Freeze parity architecture

Ship:

- `AI_LEADER_PARITY_ARCHITECTURE_V8.md`
- the six critical parity documents for `workspace runtime`, `enterprise search`, `background runtime`, `tool governance`, `AI ops`, `output trust`
- the six operating-model parity documents for artifact runtime, HITL, collaboration, identity/scope, workload/SLA and memory lifecycle
- registry and cross-package delegation links

Definition of success:

- `Execution Agent v8`, `Knowledge RAG v8`, `Chat v8`, `Multi-Agent v8` and `LLM Model Management v8` all reference one shared cross-cutting parity package,
- engineering can build core runtime without re-inventing these layers locally.

## 7.2 Wave 1 - Freeze core schemas

Ship:

- `ExecutionAgentRun` family,
- universal proposal/approval types,
- knowledge object ownership schema,
- chunk metadata schema,
- run state ledger schema.

Definition of success:

- both execution and knowledge have typed storage truth.

## 7.3 Wave 2 - Govern retrieval and working memory

Ship:

- retrieval policy gateway,
- working memory orchestrator,
- issue summary model,
- tool digest model,
- active document working set,
- handoff pack format.

Definition of success:

- model context is assembled from governed active state, not from history dumping.

## 7.4 Wave 3 - Build execution backbone

Ship:

- run creation from chat,
- step planner,
- checkpoint logic,
- partial completion semantics,
- failure/retry/replan rules,
- run closeout summary.

Definition of success:

- one bounded multi-step run can execute through a canonical orchestration lifecycle.

## 7.5 Wave 4 - Connect first real adapters

Ship first adapters:

- `Task`
- `Decision`
- `Initiative`
- `Report`
- `Notebook`

Definition of success:

- agent can perform real governed work across core artifacts.

## 7.6 Wave 5 - Expand knowledge governance

Ship:

- user-private corpus UX,
- org corpus governance UX,
- promotion workflow,
- provenance-preserving org pattern extraction,
- consumer retrieval presets.

Definition of success:

- org sharing and private knowledge become explicit product surfaces, not hidden runtime behavior.

## 7.7 Wave 6 - Harden and scale

Ship:

- operator/admin tooling,
- run observability,
- support diagnostics,
- deep research and virtual worker alignment,
- deck/table adapter expansion,
- quality and safety eval loops.

Definition of success:

- system is supportable, governable and scalable across AI consumers.

---

## 8. What must be built first

P0 build-now items:

- `ExecutionAgentRun` model
- universal `ActionProposal` and approval semantics
- `KnowledgeObjectRegistry`
- `RetrievalPolicyGateway`
- `WorkingMemoryOrchestrator`
- `RunStateLedger`
- `IssueSummaryStore`
- `ToolDigestStore`
- adapter interface
- run audit ledger

If these are missing, the product will still behave like fragmented local AI features.

---

## 9. What must not happen during implementation

Do not:

- ship more module-local proposal systems,
- let chat own durable execution state,
- let consumers query knowledge tables directly,
- mix private user memory with org-shared corpus,
- store full tool payloads as normal prompt context,
- use giant transcript replay as a substitute for working memory,
- bypass approval semantics for "small" writes,
- treat workers, chat and execution as separate governance universes.

---

## 10. Operating model for implementation today

When engineering starts implementation, use this rule:

### Step 1

Build storage truth and runtime contracts first.

### Step 2

Build retrieval and working memory orchestration before ambitious autonomy.

### Step 3

Connect only a few high-value adapters and make them excellent.

### Step 4

Add governance, audit, supportability and promotion flows before broad rollout.

### Step 5

Expand only after one end-to-end run is trustworthy, inspectable and reusable.

---

## 11. Definition of done

This master program is complete when:

- `Execution Agent v8` and `Knowledge RAG v8` no longer behave like separate initiatives,
- one governed execution run can use one governed knowledge layer end-to-end,
- working memory is explicit, bounded and resumable,
- source selection is policy-aware before ranking,
- proposals, approvals and execution results are typed and auditable,
- cross-user and cross-tenant leakage are structurally blocked,
- at least the first core adapters can perform real work through one shared backbone,
- support and operators can inspect what happened and why.

---

## 12. Canonical document order for implementation

Read in this order:

1. `AGENT_AND_KNOWLEDGE_V8_MASTER_PLAN.md`
2. `AI_LEADER_PARITY_ARCHITECTURE_V8.md`
3. `AI_WORKSPACE_PROJECT_RUNTIME_ARCHITECTURE_V8.md`
4. `AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md`
5. `AI_BACKGROUND_AND_SCHEDULED_AGENT_RUNTIME_V8.md`
6. `AI_AGENT_SECURITY_AND_TOOL_GOVERNANCE_V8.md`
7. `AI_OUTPUT_TRUST_ARCHITECTURE_V8.md`
8. `AGENT_EXECUTION_DOMAIN_MAP_V8.md`
9. `AGENT_EXECUTION_V8_SSOT.md`
10. `AGENT_MULTI_AGENT_WORK_MANAGEMENT_V8.md`
11. `KNOWLEDGE_RAG_V8_SSOT.md`
12. `KNOWLEDGE_RAG_V8_WORKING_MEMORY_ARCHITECTURE.md`
13. `AGENT_EXECUTION_V8_IMPLEMENTATION_PLAN.md`
14. `KNOWLEDGE_RAG_V8_IMPLEMENTATION_PLAN.md`
15. `AGENT_EXECUTION_V8_GAP_MATRIX.md`
16. `KNOWLEDGE_RAG_V8_GAP_MATRIX.md`
17. `DOCUMENTATION_REGISTRY.md`

Related docs:

- `AI_LEADER_PARITY_ARCHITECTURE_V8.md`
- `AI_WORKSPACE_PROJECT_RUNTIME_ARCHITECTURE_V8.md`
- `AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md`
- `AI_BACKGROUND_AND_SCHEDULED_AGENT_RUNTIME_V8.md`
- `AI_AGENT_SECURITY_AND_TOOL_GOVERNANCE_V8.md`
- `AI_OPERATIONS_AND_RELEASE_ARCHITECTURE_V8.md`
- `AI_OUTPUT_TRUST_ARCHITECTURE_V8.md`
- `AGENT_EXECUTION_V8_SSOT.md`
- `AGENT_MULTI_AGENT_WORK_MANAGEMENT_V8.md`
- `AGENT_EXECUTION_V8_IMPLEMENTATION_PLAN.md`
- `KNOWLEDGE_RAG_V8_SSOT.md`
- `KNOWLEDGE_RAG_V8_IMPLEMENTATION_PLAN.md`
- `KNOWLEDGE_RAG_V8_WORKING_MEMORY_ARCHITECTURE.md`
- `DOCUMENTATION_REGISTRY.md`
