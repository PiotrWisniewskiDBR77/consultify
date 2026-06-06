# Teresa → Module Integration Map (code-verified)

_Audit date: 2026-06-04 · Scope: can Teresa actually **BUILD / CREATE / OPERATE** inside each of the ~19 modules, vs. only chat about them. Grounded in code, not claims. Files ending in ` 2`/` 3` (Drive sync dupes) ignored._

---

## 1. Executive summary

Teresa has **three distinct write/operate surfaces, and they are largely disconnected from the main chat**:

1. **Frontend slash bridge** (`/task`, `/decision`) → `POST /api/my-work/chat-actions`. This is the **only path that performs a real, immediate DB write from the chat UI** — and it covers exactly two entities (Tasks, Decisions) plus a status update. It is hard-coded in the composer, not LLM-driven.
2. **Teresa "handoff" proposals** (the main Teresa chat stream). The LLM produces a *proposal envelope* per `propose→approve→execute` lifecycle. On execute, `performHandoff` tries to dynamically import a target-module service and call a `create*` function. **For most modules that create-function does not exist or is not exported, so it silently falls back to a synthetic UUID ref (`real_entity: false`)** — i.e. an audited deeplink, not a real artifact. Only Notebook and Interview-Insights resolve to real create functions; Radar/Calendar/Initiatives/Excele effectively do not.
3. **Wave-8 Agent runtime** (`/api/ai-agents/launch` + `/tool`) is the surface that actually wires the OpenAI function-calling `AI_TOOLS` (`toolDefinitions.ts`) via `executeToolCall`. But those tools are overwhelmingly **read/advisory** (search, get, calculate, benchmark); the few "create" tools (`create_initiative_draft`, `create_notebook_entry`, `schedule_meeting`) only emit **proposals**, and the classic `TASK_CREATE` executor is an explicit **stub that throws**.

**Overall maturity read: ~ADVISORY-plus.** Teresa is genuinely strong at *reading/analysing* almost every module and at *proposing* artifacts, but real end-to-end "she built it" is true for only **Tasks + Decisions** (via the non-LLM slash bridge) and **Notebook** (via handoff). Everything else is proposal/deeplink/stub. The propose→approve→execute scaffolding is real and well-audited; what's missing is the **last mile: module-side create functions wired to the handoff/executor layer.**

---

## 2. Master table

Capability levels: `FULL_BUILD` (create/edit real artifacts end-to-end) · `PARTIAL` (some real writes, gaps) · `ADVISORY` (read/suggest only) · `NONE`.

| Module | Capability | Mechanism (path) | Code evidence (file:line) | Key gaps |
|---|---|---|---|---|
| 01 Czat / Teresa | n/a (host) | — | — | The chat surface itself doesn't run `AI_TOOLS`; only handoff proposals |
| 02a My Work — Tasks | **PARTIAL** | Slash `/task` → `chat-actions:create_task` (real INSERT). LLM path = stub | `UnifiedChatPanel.tsx:1711`; `my-work.routes.ts:6891`; stub `taskExecutor.ts:29` | LLM can't create tasks; no edit/assign/due-date from chat; not org-shared (task_type='personal') |
| 02b My Work — Decisions | **PARTIAL** | Slash `/decision` → `chat-actions:create_decision` (real INSERT) | `UnifiedChatPanel.tsx:1712`; `my-work.routes.ts:6929` | LLM can't create; no options/criteria/scoring; no edit/resolve |
| 02c My Work — Mind Map | **NONE** | — | (no tool, no handoff target) | No create/edit of nodes/edges |
| 02d My Work — Process Flow | **NONE** | — | (no tool, no handoff target) | No create/edit of flow nodes |
| 02e My Work — Table (Table Studio) | **ADVISORY** | `query_structured_data` (read-only text→SQL) | `toolDefinitions.ts:559`; `teresaToolOperatorService.ts:215`; `excele` handoff is deeplink only `teresaCopilotService.ts:1955` | No row/sheet/table creation; excele handoff writes nothing (`workbook_ref` = UUID) |
| 02f My Work — Whiteboard | **NONE** | — | — | No write path |
| 02g My Work — Ideas | **NONE** | — | — | No write path |
| 02h My Work — Notebook/Notes | **PARTIAL→FULL** | Handoff `notebook` → `notebookService.createNote` (real) | `teresaCopilotService.ts:1873-1885`; `notebookService.ts:1151`; tool `create_notebook_entry` `toolDefinitions.ts:541` | Resolves to real note **only** via handoff execute; tool path still proposal-only; new notebook-structure layer not addressed |
| 03 Wywiad / Interview Insights | **PARTIAL** | Handoff `interview` → `interviewInsightService.create`/`generateInsight` | `teresaCopilotService.ts:1916-1933`; re-export `interviewInsightService.ts:13` | Handoff looks for `generateInsight`/`createInsight`; only `create` is exported → name mismatch risk; falls back to synthetic ref |
| 04 Decyzje | **PARTIAL** | Same as 02b (Decisions live here) | `my-work.routes.ts:6929` | See 02b |
| 05 Assessment | **ADVISORY** | `get_assessment_data` (read), `compare_benchmarks` (read) | `toolDefinitions.ts:122,796`; `toolDefinitions.ts:242,943` | No assessment/score creation or editing; can't run an assessment |
| 06 Narzędzia (Tools/SWOT etc.) | **NONE** | — | — | No tool generation/operation |
| 07 Inicjatywy | **ADVISORY** (+proposal) | `get_initiative_status` (read); `create_initiative_draft` → **proposal only**; handoff `initiatives` falls back | `toolDefinitions.ts:216,310`; `teresaToolOperatorService.ts:80`; handoff `teresaCopilotService.ts:1786-1799` | `initiativeGenerationService` exposes a **class**, not `createInitiative` fn the handoff expects → `real_entity:false` |
| 08 Realizacja / Execution | **ADVISORY** | Reads via initiative/task tools; `update_status` exists in `actionProposalEngine` but unreached from chat | `actionProposalEngine.ts:144` | No chat path reaches `executeProposedAction`; execution status not editable from Teresa |
| 09 Rezultaty / Results | **ADVISORY** | `query_structured_data` (kpis domain), `calculate_financial` | `toolDefinitions.ts:432,146` | No KPI/ROI record creation or editing |
| 10 Finanse | **ADVISORY** | `calculate_financial`, `run_monte_carlo` (compute only, no persist) | `toolDefinitions.ts:146,182`; impl `toolDefinitions.ts:836,873` | Pure calculators; results not saved to any finance entity |
| 11 Spotkania / Meetings | **PARTIAL** | `schedule_meeting` tool = proposal; classic `MeetingExecutor.execute` → `createMeeting` (real) reachable only via `ActionExecutionAdapter` | tool `toolDefinitions.ts:369`; real `meetingExecutor.ts:36`; adapter `actionExecutionAdapter.ts:173`; handoff `calendar` falls back `teresaCopilotService.ts:1830` | Chat path only proposes; real `createMeeting` not wired to chat/handoff; calendar handoff looks for `createEvent` (not exported) → synthetic ref |
| 12 Outputs / Reports | **ADVISORY** (+content) | `generate_report_section` returns formatted content (no save) | `toolDefinitions.ts:333,515` | Generated section never persisted to a report entity |
| 13 Organizacja | **ADVISORY** | KB/structured reads only | `toolDefinitions.ts:559` (org-scoped queries) | No org/competency/profile create or edit |
| 14 Admin | **NONE** | persona emphasis only (`admin_dashboard`) | `persona.ts:381` | No admin actions; advisory tone only |
| 15 Ustawienia | **NONE** | — | — | No settings mutation |
| 16 Prezentacje / Presentation Studio | **NONE** | — | — | No deck/slide creation by Teresa |
| 17 Document Studio | **NONE** | — | — | No doc creation by Teresa |
| 18 Table Studio | **ADVISORY** | see 02e | `toolDefinitions.ts:559` | Read-only text→SQL; no table writes |
| 19 Partner | **NONE** | — | — | No partner-directory operations |
| (x) Radar | **PARTIAL** | Handoff `radar` → `radarTriageService.createSignal` | `teresaCopilotService.ts:1743-1755` | `radarTriageService` does not export `createSignal` → falls back to synthetic ref (`real_entity:false`) |
| (x) Enterprise Connectors (Wave 7) | **ADVISORY** | `list_enterprise_connectors`, `search_enterprise_connector` (read/search; writes need separate AIRun) | `toolDefinitions.ts:77,95`; impl `:734,761` | Write actions explicitly deferred to separate approval |

---

## 3. Per-module detail (trace + evidence)

### The three write surfaces (shared context)

**A. Slash bridge (only real, immediate, LLM-independent writes).** Composer intercepts text starting with `/task ` or `/decision ` and POSTs to `chat-actions` — bypassing the model entirely.
- `src/components/AIChat/UnifiedChatPanel.tsx:1711-1725`
- Handler `server/src/routes/my-work.routes.ts:6875-6960`: real `INSERT` into `tasks` (`:6891`) and `decisions` (`:6929`), plus `update_task_status` (`:6919`). Column-defensive (`getTableColumns`). Tasks created `task_type='personal'`, `assignee_id=userId`.

**B. Teresa handoff proposals (main chat).** The streaming chat (`ai.routes.ts`) calls `teresaModule.createChatProposal(...)` after the assistant text, emitting an SSE `teresa_proposal` (`ai.routes.ts:2564-2581`). Lifecycle is real: `createProposal` → `approveProposal` (`teresaCopilotService.ts:1278`) → `executeProposal` (`:1434`) → `performHandoff` (`:1694`). Handoff dispatch by `targetModule` (`:1706-1721`) into per-module handlers that **dynamically import a service via `tryImport` and fall back to a random UUID `result_ref` on any miss** (`tryImport` `:1726`; fallback pattern in every handler). Each handler returns `real_entity: Boolean(realRef)` — a built-in honesty flag.
- Targets supported: `radar | initiatives | calendar | notebook | interview | excele` (`:1706`).
- **Real-entity reality check:**
  - `notebook` → `notebookService.createNote` **exists & exported** (`notebookService.ts:1151`) → REAL.
  - `interview` → looks for `generateInsight`/`createInsight`; service re-exports only `create` (`interviewInsightService.ts:13`) → likely **name-mismatch → synthetic ref**.
  - `radar` → looks for `createSignal`; not exported by `radarTriageService.ts` → **synthetic ref**.
  - `initiatives` → looks for `createInitiative`/`create`; `initiativeGenerationService` exports a **class instance** (`initiativeGenerationService.ts:93,353`), not those fns → **synthetic ref**.
  - `calendar` → looks for `createEvent`; not exported → **synthetic ref**.
  - `excele` → **no service call at all**, pure deeplink `/excele` (`:1955-1976`).
- Guardrail: governed-mutation bypass requests are explicitly refused (`ai.routes.ts:2596+`, Polish refusal text) — Teresa will not silently mutate.

**C. Wave-8 Agent runtime (the function-calling tools).** `AI_TOOLS` (`toolDefinitions.ts:30`) + `executeToolCall` (`:460`) are consumed **only** by `agentPlannerService.ts:349` and `wave8AgentRuntimeService.ts:880`, exposed at `POST /api/ai-agents/launch` and `/api/ai-agents/tool` (`wave8-agents.routes.ts:54,79`; mounted `Gateway.ts:735`). This is a separate "AI agents" product surface, **not** the everyday Teresa chat. Within these tools:
  - Read/analyse: `search_web`, `search_knowledge_base`, `list/search_enterprise_connector`, `get_assessment_data`, `get_initiative_status`, `compare_benchmarks`, `find_similar_decisions`, `get_stakeholder_analysis`, `query_structured_data`, `calculate_financial`, `run_monte_carlo` — all read/compute.
  - "Create": `create_initiative_draft` (`:493`→ proposal envelope), `create_notebook_entry` (`:541`→ proposal), `schedule_meeting` (`:527`→ inline proposal JSON, `requiresApproval:true`), `generate_report_section` (`:515`→ unsaved content). **None directly persist.**
  - Classic executor layer (`ActionExecutionAdapter`) maps `TASK_CREATE→TaskExecutor` (**throws, stub** `taskExecutor.ts:29`), `MEETING_SCHEDULE→MeetingExecutor` (**real** `meetingExecutor.ts:36`), `PLAYBOOK_ASSIGN→PlaybookExecutor` (`create_entity` step just **logs** `playbookExecutor.ts:171-175`).

### Module notes (beyond the table)

- **Persona is advisory by design** (`persona.ts:302-440`): per-screen emphasis tells Teresa to *act as Consultant/PM/Analyst* and to *propose/challenge*, never "create the artifact." No build instructions anywhere.
- **`executeProposedAction`** in `actionProposalEngine.ts:102-217` actually implements real `create_task`/`update_status`/`assign_user`/`set_field` writes — but **no chat/handoff code path calls it**; it's reachable only by an action-proposal approval flow that the current Teresa chat does not drive. Latent capability.
- **`generate_report_section`, `calculate_financial`, `run_monte_carlo`** are valuable but ephemeral: outputs return to the conversation and are never written into Reports/Finance entities.

---

## 4. Prioritized gap backlog (impact ÷ effort)

| # | Module | Gap | One-line implementation hint |
|---|---|---|---|
| 1 | Initiatives | Handoff calls a non-existent `createInitiative` fn → never builds a real initiative | Export a thin `createInitiative({organizationId,title,description,source,proposalId})` wrapper around `InitiativeGenerationService` instance and import it in `handleInitiativesHandoff` |
| 2 | Radar | Handoff calls non-existent `createSignal` → synthetic ref | Add/export `createSignal` in `v8/radarTriageService.ts` matching the handoff's call shape |
| 3 | Interview | Name mismatch: handoff wants `generateInsight`/`createInsight`, service exports `create` | Either alias-export `createInsight = create` in `interviewInsightService.ts` or update the handoff to call `create` |
| 4 | Meetings/Calendar | Real `createMeeting` exists but unreachable from chat; calendar handoff wants `createEvent` | Wire `handleCalendarHandoff` to `meetingService.createMeeting` (already imported by `meetingExecutor.ts`) instead of the missing `createEvent` |
| 5 | Tasks | `TaskExecutor.execute` is a throwing stub; LLM cannot create tasks (only the hard-coded slash) | Replace stub body with the real INSERT already proven in `actionProposalEngine.executeProposedAction:115` (`create_task`), reuse column-defensive insert from `chat-actions` |
| 6 | Tasks/Decisions | Only `/task` `/decision` slash create; no LLM tool, no edit/assign/resolve | Add `create_task`/`create_decision`/`update_task` to `AI_TOOLS` routed to `chat-actions`-style writes; expose in main chat, not just agents surface |
| 7 | Reports/Outputs | `generate_report_section` output never persisted | Add a `save_report_section` handoff target that writes to the reports/outputs entity |
| 8 | Finance/Results | Calculators don't persist; no ROI/KPI record creation | Add an optional `persist:true` path on `calculate_financial`/`run_monte_carlo` to store a scenario row |
| 9 | Tables/Excele | excele handoff is deeplink-only; `query_structured_data` is read-only | Add a write lane: generate-and-persist a workbook/table via a real Table Studio create service |
| 10 | Main chat ↔ tools | `AI_TOOLS`/`executeToolCall` only reachable via `/api/ai-agents`, not Teresa chat | Wire `getAvailableTools`/`executeToolCall` into the Teresa chat stream (llmService) so reads/proposals are model-driven everywhere |
| 11 | Latent executor | `executeProposedAction` (real task writes) is dead-ended | Route approved Teresa task proposals through `executeProposedAction` to unlock create/assign/set_field/update_status |
| 12 | Playbooks | `create_entity`/`update_entity` steps only `logger.info` | Implement real entity writes in `playbookExecutor._executeStep` create/update branches |
| 13 | Mind Map / Process Flow / Whiteboard / Ideas / Presentations / Document Studio | No write path at all | Define handoff targets + module create services if Teresa-driven authoring is desired |

---

### Counts
- **FULL_BUILD:** 0 modules outright (Notebook reaches real-write via handoff but tool path is proposal-only → counted PARTIAL).
- **PARTIAL:** 6 (Tasks, Decisions, Notebook, Interview, Meetings, Radar).
- **ADVISORY:** 9 (Assessment, Initiatives, Execution, Results, Finanse, Outputs, Organizacja, Table/Table Studio, Enterprise Connectors).
- **NONE:** 8+ (Mind Map, Process Flow, Whiteboard, Ideas, Narzędzia, Admin, Ustawienia, Prezentacje, Document Studio, Partner).

---

## 5. Last-mile implementation status (2026-06-04, this session)

The backlog was implemented in priority order. Each "done" item closes the gap so the
handoff/executor/tool path that already *called* a create-function now reaches one that
**really writes** (graceful fallback retained → wrong shapes degrade, never crash).

| # | Item | Status | Where | Note |
|---|---|---|---|---|
| 1 | Initiatives `createInitiative` | ✅ DONE | `initiativeGenerationService.ts` (named export → canonical `InitiativeService`) | handoff now `real_entity:true` |
| 2 | Radar `createSignal` | ✅ DONE | `v8/radarTriageService.ts` (wraps `createTriageSignal`) | normalizes loose payload + valid enum defaults |
| 3 | Interview `createInsight`/`generateInsight` | ✅ DONE | `v8/interviewInsightService.ts` (alias over real `create`) | needs ≥1 eligible session else graceful deeplink |
| 4 | Calendar → real meeting | ✅ DONE | `v8/teresaCopilotService.ts` `handleCalendarHandoff` → `meetingService.createMeeting` (+userId threaded) | replaced missing `createEvent` |
| 5 | Tasks executor real INSERT | ✅ DONE | `ai/actionExecutors/taskExecutor.ts` | mirrors live-proven column-defensive chat-actions INSERT (PG-safe) |
| 6 | `create_task`/`update_task`/`create_decision` tools | ✅ DONE | `services/ai/toolDefinitions.ts` | real-write executors; exposed via `getAvailableTools` (agents surface now) |
| 12 | Playbook `create_entity`/`update_entity` | ✅ DONE | `ai/actionExecutors/playbookExecutor.ts` | delegates to the #6 tool writers (task/decision); others degrade gracefully |
| 11 | Route approved proposals → real writes | ✅ SUPERSEDED | — | the dead `executeProposedAction` (SQLite `datetime('now')`, PG-unsafe) is replaced by the #5/#6 write paths; not revived |
| 7 | Persist `generate_report_section` | ⏸ DEFERRED (product decision) | — | `reportService.createReport` is a *structured/scheduled* report (reportType/filters/columns), not a free-text section. Needs a decision: persist generated sections as Notebook note, Document, or a new `report_sections` entity. Recommended: Notebook note (proven write) as the v1 sink. |
| 8 | Persist finance/KPI scenarios | ⏸ DEFERRED (needs entity) | — | `calculate_financial`/`run_monte_carlo` compute only. Needs a `finance_scenarios`/results entity + `persist:true` arg. Low risk once the table exists. |
| 9 | Table Studio write lane | ⏸ DEFERRED (new service) | — | excele handoff is deeplink-only. Needs a real Table Studio create service (workbook/sheet/rows) before wiring. |
| 10 | Function-calling tool-loop in the **streaming** chat | ⏸ DEFERRED (risk-gated) | — | The live Teresa chat (`LLMController` stream) has **no** tool loop (only the non-streaming `llmService.generateText` does). Adding one to the stream is the single biggest lever but **must be user-tested** — deferred to avoid destabilizing the just-stabilized chat while the owner is away. Tools from #6 are ready to plug in. |
| 13 | Authoring for Mind Map / Process Flow / Whiteboard / Ideas / Presentations / Document Studio | ⏸ DEFERRED (large new surfaces) | — | These are net-new authoring features (create services + handoff targets + proposal emission), not "wiring." Scoped as a separate epic. |

### Post-implementation capability shift
- **Real end-to-end build (handoff/executor reaches a real write):** Tasks, Decisions, Initiatives, Radar, Interview, Meetings, Notebook, + playbook task/decision steps. (Was: Tasks/Decisions slash + Notebook only.)
- **Remaining ADVISORY/NONE** are gated on a product decision (#7/#8), a new service (#9/#13), or user-tested stream surgery (#10).

### #10 concrete plan (when the owner can test)
1. In the streaming path (`LLMController` / `ai.routes.ts` chat stream), before/after the text turn, run a bounded tool-call loop using `getAvailableTools()` + `executeToolCall(name,args,{userId,organizationId,conversationId})`.
2. Stream tool-call + tool-result events (reuse the existing `thought`/proposal SSE envelope) so the UI shows "Teresa created task X".
3. Keep write tools behind the existing governed-mutation guard (refuse silent mutations) and surface a confirmation chip for destructive ops.
4. Gate behind a flag; verify on `localhost:3000` with a real account before default-on.
