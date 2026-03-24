# Agent Multi-Agent Work Management v8

> Status: Draft v8
> Owner: Product + Engineering
> Cel: Zdefiniowac kanoniczny komponent zarzadzania praca wielu agentow w `consultify`, oparty bezposrednio na analizie referencji z `Softs/Agenci`, tak aby system mogl obslugiwac zlozone zadania organizacyjne na poziomie topowych runtimow agentowych, ale w modelu governance-first i artifact-native.

---

## 1. Why this document exists

`Execution Agent v8` definiuje jednego kanonicznego agenta wykonawczego.

To jednak nie wystarcza dla zadan, ktore:

- dotykaja wielu artefaktow,
- wymagaja wielu niezaleznych kierunkow analizy,
- przekraczaja jeden sensowny context window,
- potrzebuja rownoleglego researchu, walidacji i synthesis,
- musza byc wykonane bez utraty governance, traceability i kontroli kosztu.

W takich przypadkach nie potrzebujemy "jednego wiekszego agenta".
Potrzebujemy `komponentu zarzadzania praca wielu agentow`.

Ten dokument definiuje:

- kiedy multi-agent ma sens,
- jaki model orkiestracji jest kanoniczny,
- jak podzielic odpowiedzialnosci agentow,
- jak zarzadzac context isolation, budgets, approvals i audit,
- jak wdrozyc te metode w `consultify`.

---

## 1.0 Cross-cutting parity architecture

`AGENT_MULTI_AGENT_WORK_MANAGEMENT_V8.md` pozostaje kanonicznym SSOT dla orchestrator-worker model i typed delegation.

Przekrojowe zasady sa delegowane do:

- `docs/product/AI_BACKGROUND_AND_SCHEDULED_AGENT_RUNTIME_V8.md`
- `docs/product/AI_AGENT_SECURITY_AND_TOOL_GOVERNANCE_V8.md`
- `docs/product/AI_WORKLOAD_CLASSES_AND_SLA_ARCHITECTURE_V8.md`
- `docs/product/AI_OUTPUT_TRUST_ARCHITECTURE_V8.md`

This document still owns:

- decomposition logic,
- orchestration modes,
- branch isolation,
- merge and synthesis semantics.

---

## 1.1 Reference systems analyzed from `Softs`

Ten dokument zostal oparty bezposrednio na analizie materialow z `Softs/Agenci`, przede wszystkim:

- `crewai.zip`
- `Longchain dev.zip`
- `OpenAI.zip`
- `Replit.zip`

Najwazniejsze referencje wykorzystane do budowy tej architektury:

- `CrewAI`: `crews`, `tasks`, `processes`, `planning`
- `LangChain dev`: `multi-agent`, `subagents`, `handoffs`, `router-knowledge-base`
- `OpenAI`: `codex/concepts/subagents`, `parallel_agents`, `structured_outputs_multi_agent`
- `Replit`: `replit-workspace/workflows`

Najwazniejsze imported rules:

- multi-agent wymaga jawnej warstwy `tasks + process + planning`, a nie tylko promptu
- trzeba rozroznic `subagents`, `handoffs` i `router pattern`
- rownolegla praca powinna byc `fan-out / fan-in`, nie peer-to-peer chaos
- izolowany kontekst i typed outputs sa wazniejsze niz "wieksza autonomia"
- workflow/task graph musi byc first-class runtime object

---

## 2. Executive decision

Canonical model for `consultify` is NOT:

- swarm of equal agents talking to each other freely,
- uncontrolled peer-to-peer delegation,
- one giant shared memory for all agents,
- multi-agent for every task by default.

Canonical model for `consultify` IS:

`supervisor-led, bounded orchestrator-worker system with typed handoffs, isolated working contexts, shared governed knowledge access, and one run-level source of truth`

To oznacza:

- jeden `Lead Execution Agent` odpowiada za run,
- agenci podrzedni sa uruchamiani tylko dla jasno wydzielonych prac,
- subagenci pracuja w izolowanych contextach,
- wyniki wracaja jako `typed outputs`, a nie jako kolejny chaotyczny chat log,
- mutacje artefaktow nadal przechodza przez `proposal -> approve -> apply -> audit`.

---

## 3. What we learn from `Softs`

## 3.1 Najwazniejsza lekcja

Najlepsze systemy nie wygrywaja przez "wieksza autonomie".

Wygrywaja przez:

- `context isolation`,
- `delegation discipline`,
- `bounded effort`,
- `clean handoffs`,
- `fresh sub-contexts`,
- `parallel work only where it truly helps`.

## 3.2 `CrewAI` principles that matter

From `CrewAI` references in `Softs`:

- multi-agent needs explicit `crew`, `task`, `process` and `planning` layers,
- tasks should have owner, description and `expected_output`,
- task dependencies and task context should be modeled explicitly,
- process choice matters: `sequential` and `hierarchical` are different operating modes,
- hierarchical runs need a manager layer that plans, delegates and validates,
- retries and guardrails belong to tasks, not only to the whole run.

## 3.3 `LangChain dev` principles that matter

From `LangChain dev` references in `Softs`:

- `subagents` are best when centralized control is needed,
- `handoffs` are best when the active specialist should take over the conversation state,
- `router pattern` is best when one query spans several knowledge verticals,
- the main choice is not only "multi-agent or not", but `which orchestration pattern fits`,
- subagents are stateless by design and start fresh each time,
- router systems need structured shared state and result reducers for parallel branches.

## 3.4 `OpenAI` and `Replit` principles that matter

From `OpenAI` and `Replit` references in `Softs`:

- subagent workflows exist to prevent `context pollution` and `context rot`,
- read-heavy noisy work should move off the main thread,
- specialized agents should return summaries and structured outputs,
- parallel work should use `fan-out / fan-in`,
- a downstream meta-agent or synthesizer should merge branch outputs,
- workflow tasks should be first-class runtime units, not hidden prompt heuristics.

## 3.5 What this means for `consultify`

`consultify` nie potrzebuje tylko "subagentow do researchu".

Potrzebuje wieloagentowego komponentu dla:

- decomposition of complex business tasks,
- parallel evidence gathering,
- policy/governance checking,
- artifact drafting in multiple verticals,
- review and contradiction detection,
- bounded execution planning before mutation.

---

## 4. When multi-agent should be used

Use multi-agent only when at least one of these is true:

- task spans multiple artifact families,
- task requires parallel exploration of several independent directions,
- task exceeds one healthy working-memory budget,
- task needs separate specialist views before approval,
- task includes both research and action planning phases,
- task value is high enough to justify higher token and orchestration cost.

Do NOT use multi-agent when:

- one bounded agent with retrieval is enough,
- the task is linear and predictable,
- latency is more important than breadth/quality,
- sub-problems are too tightly coupled to parallelize,
- governance overhead would exceed the value of delegation.

Default rule:

`single-run single-agent first, multi-agent only when decomposition improves outcome quality or boundedness`

---

## 4.1 Canonical orchestration modes imported from `Softs`

`consultify` should support three explicit operating modes:

### Sequential mode

Use when one step feeds the next and branch parallelism adds no value.

Imported mainly from:

- `CrewAI` sequential process
- `Replit` workflow tasks

### Hierarchical mode

Use when a manager layer must plan, delegate and validate several specialist tasks.

Imported mainly from:

- `CrewAI` hierarchical process
- `OpenAI` meta-agent synthesis pattern

### Router-parallel mode

Use when one query spans several knowledge verticals that can run independently and merge later.

Imported mainly from:

- `LangChain` router pattern
- `OpenAI` parallel agents fan-out/fan-in

Rule:

The Work Manager must choose the lightest mode that fits the task.

---

## 5. Canonical architecture

### 5.1 Core runtime shape

`chat intake -> Lead Execution Agent -> Multi-Agent Work Manager -> Agent Task Graph -> isolated subagents -> typed outputs -> synthesis / review -> proposals -> approval -> module adapters -> audit`

### 5.2 Primary runtime components

#### A. Lead Execution Agent

Owns:

- user intent understanding,
- run goal,
- decomposition decision,
- delegation plan,
- synthesis,
- final proposal set.

It is the only agent that owns the whole run.

#### B. Multi-Agent Work Manager

New canonical component.

Owns:

- whether to spawn subagents,
- task graph creation,
- concurrency limits,
- per-agent budgets,
- retries / cancel / timeout,
- result collection,
- escalation back to lead agent.

### 5.3 Cross-cutting hardening inherited from parity package

`Multi-Agent v8` should now be read together with the parity package as a source of execution discipline, not only orchestration style.

Most important inherited requirements:

- `AI_BACKGROUND_AND_SCHEDULED_AGENT_RUNTIME_V8.md` defines job classes, checkpointing and resumable long-running branches,
- `AI_AGENT_SECURITY_AND_TOOL_GOVERNANCE_V8.md` defines least-privilege tool use and delegation limits,
- `AI_WORKLOAD_CLASSES_AND_SLA_ARCHITECTURE_V8.md` defines when the orchestrator should prefer interactive, background or batch execution,
- `AI_OUTPUT_TRUST_ARCHITECTURE_V8.md` defines how branch outputs, evidence and synthesis must remain explainable.

This means multi-agent quality is no longer judged only by decomposition quality.
It is also judged by:

- safe runtime class selection,
- safe tool boundaries,
- safe evidence merging,
- support-visible branch traceability.

#### C. Agent Task Graph

Structured graph of sub-work.

Nodes:

- `ResearchTask`
- `RetrievalTask`
- `ArtifactDraftTask`
- `ReviewTask`
- `GovernanceCheckTask`
- `ContradictionCheckTask`
- `PlanRefinementTask`

Edges:

- dependency,
- parallelizable,
- blocking,
- merge-required.

This should behave as a real workflow graph, not as hidden coordinator reasoning.
It combines:

- `CrewAI` task/dependency discipline,
- `LangChain` router branching,
- `Replit` workflow composition.

#### D. Subagent Runtime

Each subagent has:

- task contract,
- scoped tool access,
- scoped working memory budget,
- allowed knowledge scopes,
- expected output schema,
- stop conditions.

This follows the `Softs` rule:

`fresh isolated context in, distilled typed output out`

#### E. Result Synthesizer

Collects subagent outputs and converts them into:

- run-level facts,
- evidence ledger,
- open issues,
- candidate proposals,
- confidence/risk notes.

This is our `fan-in` layer, equivalent to the downstream meta-agent pattern in `OpenAI`.

#### F. Review and Governance Gate

Before any apply phase:

- validates contradictions,
- checks permissions and workflow rules,
- classifies risky proposals,
- forces approval path if needed.

---

## 6. Canonical agent roles

These are logical roles, not necessarily permanent always-on agents.

## 6.1 Lead Execution Agent

Mission:

- understand the user objective,
- decide if decomposition is needed,
- own the final run result.

## 6.2 Planner Agent

Mission:

- break the goal into bounded tasks,
- classify dependencies,
- assign budgets and required specialties.

This role is imported directly from the planning layer visible in `CrewAI` and from the explicit decomposition discipline shown in `OpenAI` and `LangChain`.

## 6.3 Knowledge Librarian Agent

Mission:

- decide which corpora/scopes are relevant,
- narrow retrieval verticals,
- avoid retrieval flood,
- preserve source quality and governance.

## 6.4 Specialist Research Agent

Mission:

- investigate one business/domain branch,
- gather evidence,
- return condensed findings with citations.

## 6.5 Artifact Specialist Agent

Mission:

- produce structured drafts for one artifact family:
  - report,
  - note,
  - table,
  - deck,
  - task/decision payload.

## 6.6 Reviewer Agent

Mission:

- challenge completeness, consistency and risk,
- detect unsupported claims,
- suggest refinement before proposals reach the user.

## 6.7 Governance Agent

Mission:

- verify permissions, policy, role and workflow constraints,
- flag actions requiring stronger review,
- classify destructive/high-risk intent.

## 6.8 Contradiction Resolver Agent

Mission:

- compare outputs from several branches,
- identify conflicts,
- request clarification or additional evidence.

Rule:

Not every run uses all roles.
The Work Manager activates only the minimum set needed.

---

## 7. Context and memory model

### 7.1 No shared giant context

Every subagent works in an isolated working context.

Shared context between agents should be limited to:

- run goal,
- current task contract,
- allowed artifact context,
- allowed knowledge scopes,
- required output schema,
- relevant handoff summary.

### 7.2 Shared truth lives outside the prompt

Agents should share through runtime objects, not through pasted transcript state.

Canonical shared layers:

- `RunStateLedger`
- `IssueSummaryStore`
- `KnowledgeObjectRegistry`
- `EvidenceLedger`
- `ProposalStore`

This follows the `Softs` lesson that shared state should move into runtime objects and artifacts, not into conversational replay.

### 7.3 Handoffs must be typed

Subagent outputs must be returned as:

- structured facts,
- evidence references,
- candidate artifact payloads,
- risk notes,
- unresolved questions.

Not as:

- sprawling prose dump,
- full tool logs,
- repeated raw retrieval chunks.

### 7.4 Context budget rules

Each subagent must have:

- explicit token/step/tool budget,
- allowed runtime duration,
- max retry count,
- stop conditions.

### 7.5 Resume and checkpoints

Long runs must checkpoint:

- plan state,
- completed tasks,
- failed tasks,
- evidence already gathered,
- pending approvals,
- open contradictions.

---

## 8. Delegation contract

Every delegated subagent task must include:

- `task_id`
- `role_type`
- `objective`
- `in_scope`
- `out_of_scope`
- `allowed_tools`
- `allowed_knowledge_scopes`
- `input_refs`
- `expected_output_schema`
- `budget`
- `deadline_or_timeout`
- `guardrail_max_retries`
- `completion_condition`

This is non-negotiable.

Without explicit delegation contracts, subagents duplicate work, drift or over-search.

---

## 9. Work graph semantics

### 9.1 Task states

Each sub-task should have:

- `queued`
- `running`
- `blocked`
- `succeeded`
- `failed`
- `canceled`
- `needs_review`

### 9.2 Dependency types

- `hard_dependency`
- `soft_dependency`
- `parallel_branch`
- `merge_required`
- `approval_gate`

### 9.3 Merge semantics

When several subagents finish, the system must choose one of:

- accept all outputs,
- merge complementary outputs,
- run contradiction check,
- trigger refinement loop,
- discard low-value branch.

### 9.4 Cancellation semantics

The Work Manager should cancel branches when:

- a branch became irrelevant,
- another branch already produced the needed answer,
- budget is exhausted,
- governance blocks the task class,
- merge no longer requires additional evidence.

---

## 10. Governance and safety

### 10.1 One approval semantics across many agents

Many agents may contribute to a proposal.
Only the run-level proposal set may cross into `approve/apply`.

Subagents never directly apply mutations.

### 10.2 Tool and scope isolation

Not every subagent should get the same tools.

Example:

- research agents get search/retrieval,
- artifact specialists get drafting and transformation tools,
- governance agents get policy and permission inspection,
- no subagent gets unrestricted destructive capability by default.

### 10.3 Tenant and privacy isolation

All subagents inherit:

- tenant boundary,
- user boundary,
- role boundary,
- knowledge scope rules.

Multi-agent does not relax any governance rule.

### 10.4 Risk-class-based escalation

If any subagent discovers:

- destructive action,
- workflow transition,
- sensitivity conflict,
- ambiguous ownership,
- conflicting evidence,

the run must escalate back to:

- lead agent,
- governance gate,
- or explicit user approval.

---

## 11. Observability and operator model

The system must log at three layers:

### 11.1 Run layer

- run goal,
- spawned subagent count,
- total budget used,
- final result state.

### 11.2 Task layer

- task contract,
- assigned role,
- start/end times,
- status transitions,
- retries,
- cancellation reason.

### 11.3 Output layer

- evidence refs,
- produced artifacts,
- proposal lineage,
- review findings,
- governance blockers.

Operators should be able to answer:

- why were 5 agents spawned,
- what each one was asked to do,
- which result was accepted,
- what was discarded,
- where cost and latency went,
- why the run stopped or escalated.

---

## 12. Evaluation model

### 12.1 Do not evaluate only by exact path

For multi-agent systems, exact path is too unstable.

Prefer:

- end-state correctness,
- checkpoint correctness,
- source quality,
- contradiction rate,
- wasted branch rate,
- budget efficiency,
- approval safety.

### 12.2 Core eval questions

- did decomposition improve result quality,
- did agents avoid duplicate work,
- did retrieval stay scoped,
- did the system use an appropriate number of agents,
- did synthesis preserve the best evidence,
- did governance catch risky outputs,
- did the final proposal improve the real artifact state.

### 12.3 Human review remains mandatory

Especially for:

- branch design,
- tool contracts,
- approval semantics,
- governance escalation,
- high-value customer workflows.

---

## 13. How to implement this in `consultify`

## 13.1 What we already have

Reusable foundations already present:

- `AI_AGENT_ORCHESTRATION_V3.md` gives role/routing/parallelism baseline,
- `AGENT_EXECUTION_V8_SSOT.md` gives governed run semantics,
- `KNOWLEDGE_RAG_V8_WORKING_MEMORY_ARCHITECTURE.md` gives working-memory model,
- `aiActionExecutor.ts` gives approval-oriented action workflow,
- `reportAgentService.ts` gives parse -> preview -> apply pattern,
- `deepThinkingOrchestrator.ts` gives long-running orchestration flavor,
- `agentAudit/orchestratorService.ts` gives multi-role review patterns,
- `virtualWorkerKnowledgeService.ts` gives scoped knowledge assignment foundations.

## 13.2 What is missing

Critical missing component:

`MultiAgentWorkManager`

This component should be introduced as the canonical owner of:

- subagent spawning,
- task graph lifecycle,
- delegation contracts,
- per-branch budgets,
- merge / cancel / retry semantics,
- subagent observability.

## 13.3 Proposed runtime additions

New canonical runtime objects:

- `MultiAgentRunPlan`
- `AgentTaskGraph`
- `DelegatedAgentTask`
- `AgentTaskResult`
- `EvidenceLedger`
- `BranchMergeDecision`
- `GovernanceEscalation`

New canonical services:

- `multiAgentWorkManager.ts`
- `agentTaskPlanner.ts`
- `agentDelegationService.ts`
- `agentResultSynthesizer.ts`
- `agentContradictionService.ts`
- `agentBudgetPolicy.ts`
- `agentRunCheckpointService.ts`

## 13.4 Proposed execution sequence

1. `Lead Execution Agent` receives goal from chat.
2. System classifies complexity and decides `single-agent` vs `multi-agent`.
3. If multi-agent is needed, `Planner Agent` creates task graph.
4. `Knowledge Librarian Agent` narrows corpora and retrieval routes.
5. Work Manager spawns only the required specialized branches.
6. Branch outputs return as typed results plus evidence refs.
7. Synthesizer merges results and calls contradiction/review if needed.
8. Lead agent converts merged state into run-level proposals.
9. User reviews one canonical proposal set.
10. After approval, module adapters execute changes.

## 13.5 First implementation slice

The first real production slice should be:

- one lead agent,
- max 2-3 parallel subagents,
- read-heavy tasks first,
- write proposals only at the end,
- no peer-to-peer subagent communication,
- one final synthesis step,
- one final approval surface.

This directly follows the safest pattern repeated across `Softs`:

- `OpenAI`: small fan-out, then one synthesis layer,
- `LangChain`: centralized subagent control before handoff-heavy complexity,
- `CrewAI`: manager/planning first, broader hierarchy later,
- `Replit`: explicit workflow tasks before deeper automation.

This is the safest way to reach production maturity.

## 13.6 Recommended first roles to ship

- `Planner Agent`
- `Knowledge Librarian Agent`
- `Specialist Research Agent`
- `Reviewer Agent`

Only after that:

- `Artifact Specialist Agent`
- `Governance Agent`
- `Contradiction Resolver Agent`

## 13.7 Recommended first use cases

Best first fits in `consultify`:

- cross-document initiative preparation,
- evidence gathering before creating reports/decisions,
- large org knowledge synthesis,
- multi-source policy/process analysis,
- artifact proposal generation where several knowledge branches matter.

Avoid first:

- high-frequency low-value chat tasks,
- fully autonomous write-heavy mutation loops,
- broad UI automation as main path,
- dozens of subagents for one run.

---

## 14. Anti-patterns

Do not:

- spawn many agents because the task "feels complex",
- let several agents mutate artifacts independently,
- give every agent full corpus access,
- let subagents exchange unbounded chat history,
- merge outputs manually in free-form prose only,
- confuse virtual workers with execution subagents,
- confuse audit/reviewer agents with mutation-capable agents,
- optimize for maximum autonomy before observability and governance exist.

---

## 15. Definition of done

`consultify` has a real multi-agent work-management component when:

- the system can decide when decomposition is worth it,
- subagents are spawned through a typed delegation contract,
- each subagent works in isolated bounded context,
- task graph, budgets, retries and merges are runtime-visible,
- all outputs return as typed results with evidence lineage,
- one run-level proposal/approval semantics remains intact,
- audit and operator tooling explain the full multi-agent run,
- multi-agent improves complex-task quality without breaking governance or exploding cost.

Related docs:

- `AGENT_AND_KNOWLEDGE_V8_MASTER_PLAN.md`
- `AGENT_EXECUTION_V8_SSOT.md`
- `AGENT_EXECUTION_V8_IMPLEMENTATION_PLAN.md`
- `AGENT_EXECUTION_V8_GAP_MATRIX.md`
- `KNOWLEDGE_RAG_V8_SSOT.md`
- `KNOWLEDGE_RAG_V8_IMPLEMENTATION_PLAN.md`
- `KNOWLEDGE_RAG_V8_WORKING_MEMORY_ARCHITECTURE.md`
- `docs/product/modules/ai/AI_AGENT_ORCHESTRATION_V3.md`
