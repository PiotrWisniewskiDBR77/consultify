# Agentic Chat + Agent Runtime Requirements — Consultify (SUPERSEDED)

> **Status: SUPERSEDED — 2026-04-18.**
> This document captured a **truncated** source and has been replaced by the
> full version at:
>
> `DEEP_RESEARCH_AGENTIC_CHAT_RUNTIME_FULL_2026-04-18.md`
>
> The full document contains the missing opening (executive framing), the
> complete `ExecutionProposalV1` schema (TypeScript), the full `S0–S4`
> severity ladder, the Run Ledger architecture, and `R-AGENT-1…29`
> requirements (previously `R-AGENT-1…20` here).
>
> **At plan-action time:** ignore this file. Use `_FULL` only. All `R-AGENT-*`
> IDs below are **superseded** by the same IDs in the full file (which also
> adds `R-AGENT-21…29`). Do not re-ticket any row from this document.
>
> Archived for reference only. Do not edit.

---

## Execution proposal schema (partial fragment)

The preview payload emitted to chat must conform to the execution proposal contract. Example (truncated source — one operation, severity `S2_REVERSIBLE_WRITE`):

```json
{
  "summary": "Create 1 task in Project Phoenix",
  "severity": "S2_REVERSIBLE_WRITE",
  "ops": [
    {
      "op": "create",
      "target_module": "tasks",
      "target_type": "task",
      "target_id": null,
      "before": null,
      "after": {
        "title": "Prepare board pack",
        "project_id": "proj_42",
        "assignee_id": "usr_7",
        "due_at": "2026-04-24T23:59:00+02:00",
        "status": "todo"
      },
      "side_effects": [],
      "reversible": true
    }
  ],
  "expected_versions": {
    "project": "v17",
    "org_directory": "v104"
  },
  "navigation_intent": {
    "route": "/tasks",
    "params": { "focus": "new_task" }
  }
}
```

The preview must always include:

- human-readable summary
- affected record count
- before/after values
- resolved entity labels and IDs
- expected versions / staleness boundary
- side effects
- navigation intent
- whether the operation is reversible

---

## Multi-step execution modes

| Mode | When to use | Behaviour |
| --- | --- | --- |
| **Atomic bundle** | Single module or single transactional boundary | All-or-nothing commit |
| **Sequential compensating sequence** | Cross-module writes or third-party writes | Step-by-step commit with compensation plan |
| **Approval barrier sequence** | High-risk side effect after low-risk prep | Pause before external send/publish/delete |
| **Fan-out / fan-in** | Parallel independent work units | Child runs per work unit, aggregated parent result |

Examples:

- Create one task with tags in `/tasks` → **atomic bundle**
- Save decision record, then create follow-up tasks, then update roadmap → **sequential compensating sequence**
- Draft board deck, then publish, then share to external recipients → **approval barrier sequence**
- Produce 20 company briefs in parallel → **fan-out/fan-in**

---

## Stale data and optimistic concurrency

Google IAM's `etag` pattern is the right benchmark for Consultify's write safety. You should never commit a mutation against a record version different from the version used to generate the preview. If versions drift, the action expires or reproposes.

Minimum rule:

- every preview binds to `expected_versions`
- commit re-checks versions
- mismatch returns `STALE_DATA`
- stale proposals cannot be silently refreshed and executed; they must regenerate a new preview hash

---

## Error contract

| Error code | Meaning | User-facing requirement | Operator requirement |
| --- | --- | --- | --- |
| `MODULE_UNAVAILABLE` | target module offline or degraded | keep proposal, explain no commit happened | raise module health event |
| `PERMISSION_DENIED` | user or agent out of scope | explain blocked operation and required permission | log policy rule fired |
| `STALE_DATA` | source version changed since preview | ask for refresh/reproposal | record version mismatch details |
| `VALIDATION_FAILED` | required field/business rule missing | point to exact invalid field or rule | retain validator output |
| `POLICY_BLOCKED` | approval policy prohibits change | say why approval path is impossible | create security/control event |
| `EXTERNAL_SYSTEM_ERROR` | sync/API/downstream failure | report no/partial side effects explicitly | capture third-party request ID |
| `COMPENSATION_FAILED` | revert failed after partial side effects | escalate visibly; never mark complete | page operator / incident |

---

## Navigation contract

After execution, the agent must return `NavigationIntentV1` instead of embedding navigation in prose.

Rules:

- **Single primary object created** → deep-link to that object and refresh current context.
- **Batch results** → stay in chat, show result drawer, and offer "View all".
- **Background run** → keep user in chat and link to `/runs/<id>` or inbox card.
- **Compliance/report artifacts** → land on the artifact first, not the raw task list.
- **User explicitly said "show/open"** → navigate by default.
- **User did not ask to navigate** → stay in chat and use soft navigation affordances.

---

## Long-running runtime

OpenAI now exposes background mode, resumable sessions, webhooks, structured approvals, and tracing. BullMQ gives retries, backoff, events, schedulers, parent-child flows, pausing, and cancellation. Temporal provides the clearest public semantics for durable execution, schedules, and out-of-band signals/updates. Kimi Claw adds a public benchmark for always-on scheduled agents. The architectural lesson is straightforward: a production agent runtime must be durable, interruptible, observable, and resumable; an HTTP stream is only the foreground UX, not the runtime itself.

### Runtime architecture requirement

Consultify should standardise on a **Run Ledger** that persists the truth for all long-running work:

| Component | Requirement |
| --- | --- |
| `RunLedger` | Durable DB record for every run, child run, checkpoint, approval wait, and interrupt |
| `QueueExecutor` | Existing BullMQ workers for dispatch and short-lived execution |
| `CheckpointStore` | Persisted step outputs, not just logs; enough to resume without recomputing everything |
| `ArtifactStore` | Immutable artifacts and intermediate drafts by run/version |
| `ScheduleRegistry` | Versioned recurring schedules with timezone, overlap policy, and budget policy |
| `TraceCollector` | Unified trace of model calls, tool calls, approvals, mutations, costs, and errors |
| `NotificationBroker` | Inbox, push, email, and in-chat notifications tied to run milestones |

A days-long run cannot depend on vendor-managed transient state alone. OpenAI's background mode is useful, but it stores response data temporarily and has compliance constraints such as no ZDR compatibility for background mode. Use vendor background facilities as **execution helpers**, not as the system of record.

### Queue, retry, resume, cancel

BullMQ already provides much of the mechanical substrate needed:

- retries with fixed/exponential backoff
- queue-wide events through `QueueEvents`
- parent-child flows with atomic submission
- job schedulers
- queue/worker pausing
- graceful cancellation via `AbortSignal`

Those are good enough to productise **now**, provided a run ledger is added above them.

Minimum runtime rules:

| Capability | Requirement |
| --- | --- |
| **Retry** | Every step declares idempotency and retry class. Non-idempotent steps require approval barrier or human intervention after first failure. |
| **Resume** | Every long run checkpoints after meaningful external boundaries: source batch fetched, draft section completed, proposal emitted, artifact staged. |
| **Cancel** | User cancel sets `run_state=cancelling`; active step receives cancellation token; new steps are blocked. |
| **Pause** | Pause stops future steps but lets current safe step finish or checkpoint. |
| **Dead-letter** | Failed terminal runs move to operator triage queue with full trace and replay options. |
| **Lease/heartbeat** | Worker must heartbeat; stale leases trigger safe requeue or operator alert. |

### Scheduled agents

BullMQ schedulers are useful, but their own docs note that new jobs are generated when the previous job begins processing, which means busy queues can make execution less frequent than specified. Temporal's schedule semantics are stronger because schedules are first-class, have identity independent of a run, and support pause-on-failure and overlap policies. Consultify therefore needs its own schedule contract even if BullMQ performs the underlying dispatch.

Recommended `ScheduleDefinitionV1` fields:

- `schedule_id`
- `agent_id`
- `owner_user_id`
- `timezone`
- `cron_or_interval`
- `scope_snapshot`
- `approval_scope_hash`
- `overlap_policy = enum['skip','queue','cancel_previous','parallel']`
- `pause_on_failure`
- `budget_policy`
- `notification_targets`
- `created_from_proposal_id`

**Key rule:** schedule creation or edit is itself a consequential mutation and must be approved. Once approved, individual read-only scheduled runs can execute inside that envelope. If scope broadens, a new proposal is mandatory.

### Swarm and parallel execution

Kimi's public "Agent Swarm Beta" signal and CrewAI's parallel flow start semantics both support a clear enterprise conclusion: **parallelism should be an execution technique, not a product abstraction leaking into the user model.** The user asks for one job; the runtime may decompose it into many child runs.

Required contract for swarm work:

| Requirement | Description |
| --- | --- |
| **Child-run identity** | Every shard gets its own `run_id`, trace, cost record, and scope |
| **Parent aggregation** | Parent run owns aggregation rules, partial failure policy, and final artifact |
| **Permission inheritance** | Child runs may never gain broader scope than the parent |
| **Budget partitioning** | Token, tool, and time budgets are assigned per child run |
| **Concurrency cap** | Tenant and agent-level caps prevent blast-radius cost spikes |
| **Partial failure policy** | `fail_fast`, `best_effort`, or `quorum_required` must be explicit |

Use-case example: "20 firms → 20 equal briefs in parallel" should create 20 child research runs plus one aggregator run that produces the final comparison pack.

### Long research sessions

A research session lasting hours or days should not be modelled as one gigantic monolithic prompt. It should be modelled as a long-lived run with explicit phases:

1. plan the research graph
2. fetch and normalise sources
3. cluster evidence
4. draft findings
5. identify gaps
6. revisit specific branches
7. compose artifact
8. emit proposal if persisting artifacts or follow-up actions

Each phase must checkpoint:

- source manifest
- source metadata and timestamps
- draft outline
- claim-to-source mapping
- unresolved questions
- token/cost totals
- last successful step

### Progress reporting

OpenAI tracing, CrewAI tracing, and ClickUp's AI Hub Activity all point to the same UX requirement: operators and users need current status, not just final output.

Consultify should provide all four:

| Surface | Requirement |
| --- | --- |
| **In-chat progress** | step feed: `planned`, `researching`, `drafting`, `awaiting approval`, `rendering`, `completed` |
| **Inbox** | durable card for each long run, with quick actions |
| **Notifications** | threshold-based push/email/in-app notices for completion, failure, or approval waits |
| **Run dashboard** | full run timeline, child runs, costs, artifacts, approvals, retries, and current blocker |

### User interrupt mid-run

Temporal's signal/update distinction is especially useful here. Signals are good for asynchronous changes such as pause/cancel. Updates are good for synchronous state modifications with validation and acknowledgement. Consultify should expose the same semantics even if implemented on your own stack.

Recommended user interrupts:

- `pause_run`
- `resume_run`
- `cancel_run`
- `narrow_scope`
- `broaden_scope`
- `change_output_format`
- `change_deadline`
- `add_source`
- `remove_source`

Rules:

- **narrowing scope** can usually resume from checkpoint
- **broadening scope** usually requires approval refresh
- **changing a target artifact** invalidates downstream draft stages
- **changing write targets** always regenerates proposal preview

---

## Operator observability

OpenAI offers trace items for model/tool/handoff execution. CrewAI tracing exposes agent decisions, task timelines, tool usage, LLM calls, performance metrics, errors, and costs. ClickUp AI Hub already exposes agent activity and credits used. Anthropic provides enterprise audit export with actor/event metadata. For Consultify, those are the floor, not the ceiling, because the enterprise buyer is explicitly asking for a defensible audit trail.

### Live view

Support and SOC operators need a landing surface that answers **"what is agent X doing right now?"** in one screen.

| Live field | Minimum requirement |
| --- | --- |
| **Identity** | tenant, workspace, agent, run id, parent run id |
| **Current state** | action state, run state, current step, last heartbeat |
| **Current work** | current tool call, current module target, current artifact phase |
| **Governance** | approval wait, reviewer, proposal hash, severity |
| **Reliability** | retries, queue age, worker lease holder, checkpoint count |
| **Economics** | token usage, tool cost, cumulative run cost, budget remaining |
| **Security** | data sources touched, blocked permissions, policy rule IDs |
| **UX** | user-facing message last emitted, pending navigation target |

### Historical log

Consultify should support retention classes at tenant level:

| Class | Default | Content |
| --- | --- | --- |
| **Hot** | 30 days | full traces, tool payload metadata, step-by-step lifecycle |
| **Warm** | 90 days | full audit summaries, costs, approvals, outcomes, incident links |
| **Cold** | 1 year | append-only audit events, proposal/approval hashes, artifact lineage, exportable summaries |

For regulated customers, add legal hold and custom retention overrides.

### Anomaly detection

An anomaly engine should baseline by **agent × tenant × workload class** and alert on deviations such as:

- unusual number of tool calls
- unusual object count mutated
- cost spike beyond historical band
- unexpected module touched
- unusually high permission denials
- repeated stale-data failures
- off-hours destructive requests
- schedule drift beyond SLA
- unexpected external integration access

Each alert should create an `AgentIncidentV1` with severity, blast radius estimate, and run links.

### Cost attribution

Cost needs to be attributable:

| Dimension | Required granularity |
| --- | --- |
| **Tenant** | per tenant, day, month |
| **Agent** | per agent surface |
| **Workload** | per request class, e.g. briefing, ROI, research, compliance |
| **Run** | per run and child run |
| **Resource type** | LLM tokens, web/tool usage, background compute, render cost |
| **Budget** | soft and hard limits, with breach events |

OpenAI project usage/cost APIs and CrewAI's observability guidance both reinforce that cost must be tracked as a first-class operational metric, not retrofitted from invoices.

### Permission violations

Any attempt outside scope must generate a security-grade event, not a UX-only error.

Minimum incident payload:

- who attempted it
- which agent attempted it
- requested capability
- target module/object
- policy rule that blocked it
- whether any side effect occurred
- whether retry was attempted
- whether an operator override exists

### Explainability

The right explainability model is **bounded rationale**, not chain-of-thought dump.

Expose:

- intent classification
- chosen agent and why
- chosen tools and why
- source set used
- assumptions list
- confidence by field
- policy checks executed
- approval requirements triggered
- alternatives rejected at label-level only

**Do not** expose raw hidden reasoning. Palantir's public "view underlying logic" and OpenAI/CrewAI tracing show the value of structured execution evidence; neither implies that raw inner monologue is the correct user-facing explainability primitive.

---

## Numbered requirements

| ID | Priority | Requirement | Acceptance | Test | Risk if omitted |
| --- | --- | --- | --- | --- | --- |
| `R-AGENT-1` | **P0** | Every production agent must exist in `AgentDefinitionV1` with tool scope, output schema, approval policy, modules, SLA, and eval suite. | Registry rejects incomplete agent definitions. | Contract tests on registry load. | Unbounded behaviour and unauditable drift. |
| `R-AGENT-2` | **P0** | Co-thinkers must be separate from agents and may not own write or schedule scopes. | Persona overlays cannot execute writes. | Permission regression test. | Hidden authority creep. |
| `R-AGENT-3` | **P0** | Introduce `execution_proposal` as a first-class `messageType`. | 100% of mutating actions render as proposal cards. | E2E task-create from chat. | Text-only approvals are non-defensible. |
| `R-AGENT-4` | **P0** | Replace `ChatActionProposal` and `ActionProposal` with one unified `ActionEnvelopeV1`. | Single proposal model in API, DB, UI, audit. | Migration/backfill test. | Dual truth and broken lineage. |
| `R-AGENT-5` | **P0** | Implement separate `action_state` and `run_state` machines. | UI/API expose both consistently. | Reducer/state transition tests. | Stuck or ambiguous execution. |
| `R-AGENT-6` | **P0** | No module may accept direct agent writes outside `ModuleMutationGatewayV1`. | All writes route through prepare/commit APIs. | Integration tests per module. | Silent bypass of approval and audit. |
| `R-AGENT-7` | **P0** | Every proposal preview must bind to `expected_versions`. | Stale preview cannot execute. | Version-drift scenario test. | Overwrite/race-condition failures. |
| `R-AGENT-8` | **P0** | Every mutation must carry `DiffPreviewV1` with before/after and side effects. | Human reviewer can inspect exact changes. | Snapshot-based preview test. | Approvals become blind consent. |
| `R-AGENT-9` | **P0** | Severity classes `S0–S4` must govern approval rules. | Policy evaluates every proposal into one severity. | Policy engine classification tests. | Inconsistent governance. |
| `R-AGENT-10` | **P0** | Append-only `AuditEventV1` must exist for proposal, approval, execution, failure, revert, and audit close. | Full lifecycle reconstructable from events. | Replay audit reconstruction test. | Non-defensible audit trail. |
| `R-AGENT-11` | **P0** | Long-running work must use `RunLedger` with checkpoints, child runs, heartbeats, and interrupts. | Runs can resume after process restart. | Kill-and-resume chaos test. | Long jobs fail irrecoverably. |
| `R-AGENT-12` | **P0** | Schedule creation/edit must be proposed and approved; later runs execute inside that approval envelope. | No recurring job exists without origin proposal. | Schedule CRUD audit test. | Silent automation creep. |
| `R-AGENT-13` | **P1** | Parallel workloads must use child runs with budgets, caps, and parent aggregation policy. | Fan-out/fan-in trace visible in dashboard. | 20-brief swarm load test. | Cost spikes and opaque failures. |
| `R-AGENT-14` | **P1** | Every run must emit user-visible progress to chat, inbox, and run dashboard. | Users see real-time state changes. | Progress feed simulation. | Users assume agent is hung or failed. |
| `R-AGENT-15` | **P1** | Operator console must support live run inspection, replay metadata, and incident pivoting. | Support can answer "what is it doing now?" from one view. | Support drill test. | High MTTR and poor SOC response. |
| `R-AGENT-16` | **P1** | Cost attribution must be recorded by tenant, agent, workload, and run. | Dashboard shows daily and per-run spend. | Usage reconciliation test. | No economic control. |
| `R-AGENT-17` | **P1** | Permission denials and policy blocks must create incident-grade events. | Security event exists for every out-of-scope attempt. | Policy violation simulation. | Hidden overreach attempts. |
| `R-AGENT-18` | **P1** | Explainability must expose bounded rationale, sources, policy checks, and confidence — not hidden reasoning. | Every completed run exposes an explainability card. | UX/API schema test. | Poor auditability or unsafe disclosure. |
| `R-AGENT-19` | **P2** | High-quality completed runs should draft reusable memory entries for org-memory approval. | Playbook draft suggestions appear automatically. | Post-run memory draft test. | Knowledge fails to compound. |
| `R-AGENT-20` | **P2** | Every agent must ship with scenario evals and acceptance thresholds before production activation. | No agent can go live without passing eval suite. | Eval CI gate. | Regressions enter production silently. |

---

## Anti-patterns

| Anti-pattern | Why it must be rejected |
| --- | --- |
| One omnipotent "consulting super-agent" | Tool scope, approval policy, output schema, and eval ownership all become impossible to reason about. |
| Personas acting as executors | Style overlays are not governance boundaries. |
| Storing proposals as chat text | No stable schema, no version binding, no machine-checkable approval. |
| Silent mutations after "obvious" user intent | Violates the non-negotiable and destroys audit defensibility. |
| Routing by persona or job title alone | Intent, scope, artifact type, and permissions matter more than "CEO" or "idea maker". |
| Direct module writes from tools | Bypasses preview, approval, and uniform audit. |
| Using chat history as system of record | Chat is UX state, not operational truth. |
| HTTP-stream-only long jobs | No resume, no checkpoints, no operator control. |
| No expected-version checks | Guarantees stale writes in collaborative workspaces. |
| Unlimited tool surfaces per agent | Raises blast radius and makes evals meaningless. |
| Explaining decisions by dumping hidden reasoning | Unsafe, noisy, and not what auditors actually need. |
| Schedule-first automation without proposal lineage | Creates silent recurring side effects that users did not explicitly authorise. |

---

## Benchmark matrix

The lesson is not "copy vendor X". The right lesson is: **copy the contract they made explicit**. Kimi is strongest on specialised surfaces; Claude on project memory and skill-like workflow packaging; OpenAI on typed agent definitions, approvals, and tracing; Palantir on action governance over operational data; CrewAI on stateful flow composition and observability; Temporal on durable execution semantics. Rovo, ClickUp, and Linear add corroborating evidence for scoped tool use, activity visibility, and chat-to-workflow mutation.

| Benchmark | Public signal | What Consultify should copy | What Consultify should not copy |
| --- | --- | --- | --- |
| **Kimi** | Distinct surfaces for Websites, Docs, Slides, Sheets, Deep Research, Agent Swarm Beta, and Claw; Claw adds scheduled tasks and persistent always-on behaviour. | Specialise surfaces by work product and long-running capability. | Generic office-artifact taxonomy; Consultify should specialise by consulting job instead. |
| **Claude** | Projects are self-contained workspaces with knowledge; Skills package instructions, scripts, and resources; connector actions require explicit approval and follow existing permissions. | Project-scoped memory, lazy-loaded playbooks, explicit approval for connector actions. | Treating the project workspace itself as the whole execution runtime. |
| **OpenAI** | Agents are defined by instructions, tools, handoffs, approvals, and output types; human review pauses runs; tracing, background mode, webhooks, and sessions are first-class; Responses is recommended for new projects and Assistants are in legacy APIs. | Schema-first agents, pause-for-approval, resumable state, modern tracing. | Building new execution architecture on old Assistants-era abstractions. |
| **Palantir** | Agents sit on an operational ontology; action primitives support validated changes; application state, tools, and human operator review are explicit. | Semantic action layer, validate/apply split, human review for uncertain operations. | Assuming Palantir's ontology product is required to get the benefit; the requirement is the contract, not the vendor. |
| **CrewAI** | Flows are recommended for production because they own state and execution order; observability exposes decisions, tool usage, timelines, token use, and costs. | Separation of flow state from agent work; built-in observability expectations. | Framework-specific abstractions as product requirements. |
| **Temporal** | Durable execution resumes after crashes or outages; schedules have identity; signals, updates, and queries model external control over running workflows. | Durable run semantics, schedule identity, pause/resume/update model. | Immediate wholesale migration if the first useful cut can ship on BullMQ plus a run ledger. |

Secondary signals: Rovo recommends keeping tool sets narrow and confirming every agent action. ClickUp AI Hub exposes activity, status, feedback, and credits. Linear explicitly keeps humans responsible even when agents act as app users. Those are all excellent product-governance cues for Consultify.

---

## Fourteen-day roadmap

| Day range | Deliverable | What "usable" means |
| --- | --- | --- |
| **Days 1–2** | **Contracts first**: `AgentDefinitionV1`, `ExecutionProposalV1`, `ActionEnvelopeV1`, expanded enums, `execution_proposal` message type | Typed proposals exist in API/DB/UI; no more text-only proposals |
| **Days 3–4** | **Mutation gateway** for `tasks` and `decisions`; `DiffPreviewV1`; expected-version checks | Chat can prepare task/decision mutations safely with previews |
| **Days 5–6** | **Ship three agents**: Task Orchestrator, Board Briefing, ROI Analyst | CEO, COO, CFO core scenarios work in a governed way |
| **Days 7–8** | **Run ledger** with checkpoints, child-run support, progress feed, cancel/pause | Long research or briefing jobs survive worker restart |
| **Days 9–10** | **Background and schedule layer**: BullMQ integration, schedule registry, notifications, KPI Sentinel | Daily/weekly scheduled runs are possible with approval lineage |
| **Days 11–12** | **Operator visibility**: live run view, historical run log, cost attribution, permission incidents | Support/SOC can inspect active and past runs |
| **Days 13–14** | **Agent evals and hardening**: scenario suite for CEO briefing, COO RACI/task flow, CFO ROI compare, CISO compliance review | Agent mode is ready for a controlled tenant pilot with defensible audit evidence |

> *Source truncated here ("four high-value gover…"). Final closing paragraph of the research output is missing and should be re-pasted when available.*

---

## Requirements inventory (flat list)

| ID | Priority | One-liner |
| --- | --- | --- |
| R-AGENT-1 | P0 | `AgentDefinitionV1` registry (scope/schema/approval/modules/SLA/evals) |
| R-AGENT-2 | P0 | Co-thinkers ≠ agents (personas have no write/schedule scopes) |
| R-AGENT-3 | P0 | `execution_proposal` as first-class messageType |
| R-AGENT-4 | P0 | Unified `ActionEnvelopeV1` (kill dual proposal models) |
| R-AGENT-5 | P0 | Separate `action_state` and `run_state` state machines |
| R-AGENT-6 | P0 | `ModuleMutationGatewayV1` — all writes via prepare/commit |
| R-AGENT-7 | P0 | `expected_versions` binding + STALE_DATA handling |
| R-AGENT-8 | P0 | `DiffPreviewV1` with before/after + side effects |
| R-AGENT-9 | P0 | Severity classes S0–S4 govern approval rules |
| R-AGENT-10 | P0 | Append-only `AuditEventV1` for full lifecycle |
| R-AGENT-11 | P0 | `RunLedger` with checkpoints/child runs/heartbeats/interrupts |
| R-AGENT-12 | P0 | Schedule creation/edit requires proposal + approval |
| R-AGENT-13 | P1 | Parallel/swarm execution with budgets + aggregation policy |
| R-AGENT-14 | P1 | User-visible progress in chat + inbox + run dashboard |
| R-AGENT-15 | P1 | Operator console (live inspection + replay + incident pivot) |
| R-AGENT-16 | P1 | Cost attribution per tenant/agent/workload/run |
| R-AGENT-17 | P1 | Incident-grade events for permission denials / policy blocks |
| R-AGENT-18 | P1 | Bounded rationale explainability (no raw CoT) |
| R-AGENT-19 | P2 | Post-run memory-draft suggestions for org-memory approval |
| R-AGENT-20 | P2 | Scenario evals + acceptance thresholds before production |

**Totals:** 20 requirements — 12 × P0, 6 × P1, 2 × P2.

---

## Cross-document linkage

The Agentic Chat / runtime layer is the **execution backbone** underneath every other research contract captured so far:

- **Reasoning (`DEEP_RESEARCH_REASONING_REQUIREMENTS_2026-04-18.md`):**
  - `AgentDefinitionV1` (R-AGENT-1) must declare allowed `WorkloadClass` from the Reasoning router (R-REASON-1).
  - `ExecutionProposalV1` inherits `TrustBundle` fields (R-REASON-16): trace_id, model_id, reasoning_mode, evidence, confidence, approvals.
  - `run_state` from R-AGENT-5 aligns with the `background_agent` workload class lifecycle (R-REASON-24).
  - Severity S0–S4 (R-AGENT-9) maps to `criticality` in R-REASON-6; critical proposals inherit fail-closed behaviour from R-REASON-14/15.
  - Bounded rationale explainability (R-AGENT-18) = the operator panel surface required by R-REASON-18.

- **Feedback / Learning (`DEEP_RESEARCH_FEEDBACK_SELF_LEARNING_2026-04-18.md`):**
  - Post-run memory drafts (R-AGENT-19) must pass through the learned-object contract (R-LEARN-4) and tenant admin review (R-LEARN-15).
  - Schedule creation as consequential mutation (R-AGENT-12) outranks any learned preference — sticky-guardrails rule (R-LEARN-10).
  - Agent evals gate (R-AGENT-20) is the same CI-gated eval flywheel as R-LEARN-8.
  - `AuditEventV1` (R-AGENT-10) feeds the same trace backbone as R-LEARN-1 feedback events.

- **Artifact (`DEEP_RESEARCH_ARTIFACT_CONNECTORS_ROI_ONBOARDING_2026-04-18.md` §Artifact):**
  - `MutationProposal` (R-ARTIFACT-3) is a specialisation of `ExecutionProposalV1` / `ActionEnvelopeV1` (R-AGENT-3/4) where `target_module = artifact_runtime`.
  - `ModuleMutationGatewayV1` (R-AGENT-6) is the execution spine for Artifact approvals (R-ARTIFACT-4).
  - Export integrity (R-ARTIFACT-4 hash/watermark) emits an `AuditEventV1` (R-AGENT-10) entry.

- **Connectors (same file §Enterprise integrations):**
  - Every third-party write connector must register as a tool in `AgentDefinitionV1` tool-scope (R-AGENT-1) and respect ACL propagation (R-CONNECT-5).
  - Disconnect = purge (R-CONNECT-6) cancels any live runs using that connector and flags their `RunLedger` (R-AGENT-11) as `aborted_by_connector_revocation`.
  - Permission-denied events (R-AGENT-17) are the runtime-side mirror of ACL enforcement from R-CONNECT-5.

- **ROI (same file §ROI):**
  - Schedule-based KPI Sentinel (R-OUTCOME-3 measurement cadence) runs on R-AGENT-11 + R-AGENT-12 infrastructure.
  - Cost attribution (R-AGENT-16) powers per-initiative AI/LLM cost bucketing in the ROI formula (R-OUTCOME-4).
  - Persistence monitoring (R-OUTCOME-6) uses scheduled agents with approval-envelope lineage (R-AGENT-12).

- **Onboarding (same file §Onboarding):**
  - "First execution approved" ritual (R-ONBOARD-7) requires an executed `ExecutionProposalV1` (R-AGENT-3).
  - CFO activation path relies on Board Briefing / ROI Analyst agent scenarios (roadmap days 5–6).

---

## What this document is NOT

- Not a ticket backlog (the next pass converts `R-AGENT-*` into tickets, flags, tests, CI invariants).
- Not a framework choice (BullMQ vs Temporal is an implementation decision, not a requirement; contracts stay the same either way).
- Not the RLHF / fine-tuning pipeline (this covers execution governance, not weight updates).
- Not a replacement for existing dev plans (`TRUST_*`, `ADMIN_*`, `VOICE_*`, `INPUT_*`, `NAVIGATION_*`) — it is the runtime those plans assume.

## Next step

Turn this document into the Agentic Chat / Agent Runtime implementation plan alongside Reasoning / Feedback / Artifact / Connectors / ROI / Onboarding:
1. Assign each `R-AGENT-*` a ticket ID and block (likely new block `agent_runtime` in `ChatV9Block` union, or a dedicated `ChatV10Block`).
2. Register feature flags per requirement (`ff.agent_registry`, `ff.execution_proposal_messagetype`, `ff.action_envelope_v1`, `ff.module_mutation_gateway`, `ff.run_ledger`, `ff.schedule_registry`, `ff.agent_operator_console`, `ff.agent_cost_attribution`, `ff.agent_explainability_card`, etc.).
3. Draft `AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md` with per-ticket acceptance + test strategy; split by sub-surfaces (Proposal, Gateway, RunLedger, Schedule, Operator Console).
4. Extend `CHAT_V9_TELEMETRY_CONTRACT` with `agent.*` event families (`agent.proposal_created`, `agent.proposal_approved`, `agent.run_started`, `agent.run_checkpointed`, `agent.run_paused`, `agent.run_resumed`, `agent.run_cancelled`, `agent.mutation_committed`, `agent.compensation_failed`, `agent.schedule_fired`, `agent.incident_raised`).
5. Add CI invariants in `chatV9FeatureFlags.test.ts`:
   - every `R-AGENT-*` → flag in registry,
   - every `agent.*` event → section in telemetry contract,
   - every severity enum (`S0`–`S4`) and `action_state` / `run_state` value used in code matches the documented taxonomy,
   - every `AgentDefinitionV1` referenced in code has a matching registry entry and eval-suite pointer.
