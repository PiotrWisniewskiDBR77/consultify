# Chat V10 / AGENT RUNTIME — development plan (2026-04-18)

> **Scope note:** this plan is **design-phase** only. It documents the 29
> tickets `V10-AGT-001..029` that implement the Agentic Chat + Agent Runtime
> block of Chat V10. **No ticket here is shipped yet.** The block defines the
> execution envelope (`ExecutionProposalV1`), the S0–S4 severity ladder, and
> the Run Ledger that persists long-running, scheduled, and multi-step work
> so it can resume, replay, and be audited.
>
> Authoritative input: [`DEEP_RESEARCH_AGENTIC_CHAT_RUNTIME_FULL_2026-04-18.md`](./DEEP_RESEARCH_AGENTIC_CHAT_RUNTIME_FULL_2026-04-18.md)
> (R-AGENT-1..29). Master plan: [`CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md`](./CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md).

> **Cross-refs**
> - Kill-switches & incident response → [`CHAT_V9_OPERATIONS_RUNBOOK_2026-04-18.md`](./CHAT_V9_OPERATIONS_RUNBOOK_2026-04-18.md)
> - Adding a new agent capability → [`CHAT_V9_CONTRIBUTOR_GUIDE_2026-04-18.md`](./CHAT_V9_CONTRIBUTOR_GUIDE_2026-04-18.md)
> - Telemetry payloads → [`CHAT_V9_TELEMETRY_CONTRACT_2026-04-18.md`](./CHAT_V9_TELEMETRY_CONTRACT_2026-04-18.md)

## Block summary

Agent Runtime is the **execution backbone** of Chat V10. It unifies every
mutation, tool call, long-running process, scheduled task, and multi-agent
swarm under a single enterprise-grade contract: an `ExecutionProposalV1`
envelope, a blast-radius severity classification (S0–S4), and a durable
Run Ledger that makes runs resumable, replayable, and SOX-defensibly
auditable.

**Three hard contracts** (from research doc):
1. **ExecutionProposalV1** — the only way AI-originated actions reach
   production systems. Every side effect is proposed, previewed, approved.
2. **Severity S0–S4** — blast-radius ladder governs approval mode, undo
   window, audit retention, and UI treatment.
3. **Run Ledger** — durable DB record of every run; enables resume,
   replay, time-travel, and operator forensics.

**Design inputs:**
- `ExecutionProposalV1` schema with `MessageType`, `Severity`, `OpType`, `ApprovalMode`, `ExpectedVersions`, `DiffPreview`, `NavigationIntent`, `BudgetBudget`.
- S0 (read-only) → S1 (reversible suggestion) → S2 (reversible write) → S3 (mutation with blast radius) → S4 (irreversible / external) severity ladder.
- Run Ledger components: QueueExecutor, CheckpointStore, ArtifactStore, ScheduleRegistry, TraceCollector, NotificationBroker.
- Multi-step execution modes: Atomic bundle, Sequential compensating sequence, Approval barrier sequence, Fan-out / fan-in.
- Scheduled agents via `ScheduleDefinitionV1` (cron / interval, overlap policy, budget policy).
- Swarm contract for fan-out/fan-in multi-agent work.
- 9 user interrupt verbs (pause, resume, cancel, skip, redo, retry, reset, rewind, abort).
- Long research session phase machine.

**MVP focus (Wave A):** ExecutionProposalV1 + S0–S2 severity + approval gate + Run Ledger skeleton + atomic bundle executor. S3–S4 severity + ScheduleDefinitionV1 + swarm land in Wave B. Time-travel / replay UX is Wave C.

## Backlog

| ID | Requirement | Priority | Effort | Risk | Wave | Status |
|---|---|---|---|---|---|---|
| [V10-AGT-001](#v10-agt-001) | R-AGENT-1: `ExecutionProposalV1` TypeScript schema + validator | P0 | 2 d | high | A | 📐 design |
| [V10-AGT-002](#v10-agt-002) | R-AGENT-2: `Severity` S0–S4 enum + default policies per level | P0 | 1.5 d | medium | A + B | 📐 design |
| [V10-AGT-003](#v10-agt-003) | R-AGENT-3: `OpType` enum (read, create, update, delete, external_call, …) | P0 | 0.75 d | low | A | 📐 design |
| [V10-AGT-004](#v10-agt-004) | R-AGENT-4: `ApprovalMode` (implicit, inline, explicit_form, multi_reviewer, admin_only) | P0 | 0.75 d | low | A | 📐 design |
| [V10-AGT-005](#v10-agt-005) | R-AGENT-5: `expectedVersions` optimistic concurrency check | P0 | 1 d | medium | A | 📐 design |
| [V10-AGT-006](#v10-agt-006) | R-AGENT-6: `NavigationIntent` (route the user after approval) | P0 | 0.5 d | low | A | 📐 design |
| [V10-AGT-007](#v10-agt-007) | R-AGENT-7: `BudgetBudgetV1` (time, cost, tool-call cap) | P0 | 1 d | medium | A | 📐 design |
| [V10-AGT-008](#v10-agt-008) | R-AGENT-8: `DiffPreviewV1` (human-readable preview across all op types) | P0 | 1.5 d | medium | A | 📐 design |
| [V10-AGT-009](#v10-agt-009) | R-AGENT-9: S0 severity — read-only, no approval | P0 | 0.5 d | low | A | 📐 design |
| [V10-AGT-010](#v10-agt-010) | R-AGENT-10: S1 severity — reversible suggestion, inline approval | P0 | 1 d | low | A | 📐 design |
| [V10-AGT-011](#v10-agt-011) | R-AGENT-11: S2 severity — reversible write, explicit approval, 24h undo window | P0 | 1.5 d | medium | A | 📐 design |
| [V10-AGT-012](#v10-agt-012) | R-AGENT-12: S3 severity — blast-radius mutation, multi-reviewer, 7d audit | P0 | 2 d | high | B | 📐 design |
| [V10-AGT-013](#v10-agt-013) | R-AGENT-13: S4 severity — irreversible / external, admin-only, 365d audit + signature | P0 | 2 d | high | B | 📐 design |
| [V10-AGT-014](#v10-agt-014) | R-AGENT-14: Run Ledger core schema (Run, Step, Checkpoint, Artifact, Trace) | P0 | 2.5 d | high | A | 📐 design |
| [V10-AGT-015](#v10-agt-015) | R-AGENT-15: QueueExecutor with retry + backoff + DLQ | P0 | 2 d | medium | A | 📐 design |
| [V10-AGT-016](#v10-agt-016) | R-AGENT-16: CheckpointStore + resume-from-checkpoint | P0 | 2 d | high | A | 📐 design |
| [V10-AGT-017](#v10-agt-017) | R-AGENT-17: Atomic bundle executor (all-or-nothing) | P0 | 1.5 d | medium | A | 📐 design |
| [V10-AGT-018](#v10-agt-018) | R-AGENT-18: Sequential compensating sequence executor | P0 | 2 d | high | B | 📐 design |
| [V10-AGT-019](#v10-agt-019) | R-AGENT-19: Approval barrier sequence executor | P0 | 1.5 d | medium | B | 📐 design |
| [V10-AGT-020](#v10-agt-020) | R-AGENT-20: Fan-out / fan-in executor | P1 | 2 d | high | C | 📐 design |
| [V10-AGT-021](#v10-agt-021) | R-AGENT-21: `ScheduleDefinitionV1` (cron / interval, overlap, budget) | P0 | 2 d | medium | B | 📐 design |
| [V10-AGT-022](#v10-agt-022) | R-AGENT-22: ScheduleRegistry + trigger engine | P0 | 1.5 d | medium | B | 📐 design |
| [V10-AGT-023](#v10-agt-023) | R-AGENT-23: Swarm contract (multi-agent fan-out/fan-in definition) | P1 | 2 d | high | C | 📐 design |
| [V10-AGT-024](#v10-agt-024) | R-AGENT-24: 9 user interrupt verbs (pause/resume/cancel/skip/redo/retry/reset/rewind/abort) | P0 | 2 d | medium | B | 📐 design |
| [V10-AGT-025](#v10-agt-025) | R-AGENT-25: Long research session phase machine | P1 | 1.5 d | medium | B | 📐 design |
| [V10-AGT-026](#v10-agt-026) | R-AGENT-26: TraceCollector + OpenTelemetry-compatible trace export | P0 | 1.5 d | medium | A | 📐 design |
| [V10-AGT-027](#v10-agt-027) | R-AGENT-27: NotificationBroker (email, in-app, webhook) | P1 | 1.5 d | low | B | 📐 design |
| [V10-AGT-028](#v10-agt-028) | R-AGENT-28: Time-travel + replay UX for operator forensics | P2 | 2.5 d | medium | C | 📐 design |
| [V10-AGT-029](#v10-agt-029) | R-AGENT-29: 12 anti-patterns as lint + runtime rules | P0 | 1 d | medium | A | 📐 design |

**Totals:** 29 tickets (22 × P0, 6 × P1, 1 × P2). Estimated effort ≈48 engineer-days (≈2 engineers × ~5 weeks for Wave A+B; Wave C adds ~3 weeks).

**Proposed flag namespace:** `ff.agent_*` (see master plan §4).

---

<a id="v10-agt-001"></a>

## V10-AGT-001 — ExecutionProposalV1 schema

**Requirement:** R-AGENT-1 (P0) — every AI-originated action that touches an enterprise system is an `ExecutionProposalV1`.

**Design.** The full TypeScript schema lives in `src/models/agent/ExecutionProposalV1.ts` (new). Top-level shape (condensed; the full JSDoc version is in the research doc):

```ts
export type ExecutionProposalV1 = {
  schemaVersion: "v1";
  id: ProposalId;
  tenantId: TenantId;
  correlationId: string;             // links back to chat turn / task
  messageType: MessageType;          // execution_proposal | agent_status | …
  severity: Severity;                // S0 | S1 | S2 | S3 | S4
  ops: Op[];                         // typed operation list
  sources: EvidenceRef[];            // sources for the decision
  rationale: string;                 // why this action
  expectedVersions: ExpectedVersionMap; // optimistic concurrency
  approvalMode: ApprovalMode;        // implicit | inline | explicit_form | multi_reviewer | admin_only
  approvalPolicyId: PolicyId;
  preview: DiffPreview;              // human-readable diff
  navigationIntent: NavigationIntent;
  budget: BudgetBudget;              // time, cost, tool-call cap
  blastRadius: BlastRadius;
  reversibilityHint: "reversible" | "compensating" | "irreversible";
  proposedBy: ActorId;
  proposedAt: Timestamp;
  expiresAt: Timestamp;              // proposal TTL
};
```

Validation runs at boundary (inbound from model / agent) and at apply time.

**Acceptance criteria.**
- Schema is the ONLY way AI-originated actions reach downstream systems.
- Invalid proposals are rejected at boundary with typed errors.
- Every field has a single source of truth (no duplication across envelope).
- TypeScript compile-time enforcement + runtime schema check (Zod or equivalent).

**Test strategy.**
- Unit: schema validator accepts 40 canonical shapes, rejects 40 malformed.
- Property-based: fuzz schema with randomized inputs.

**Cross-refs.** V10-AGT-002..008 (sub-schemas), V10-ART-007 (MutationProposal is a specialisation for content mutations).

---

<a id="v10-agt-002"></a>

## V10-AGT-002 — Severity S0–S4

**Requirement:** R-AGENT-2 (P0) — blast-radius severity ladder governs approval, undo, audit, UI.

**Design.** Five levels with canonical defaults:

| Level | Blast radius | Default approval | Undo window | Audit retention | UI treatment |
|---|---|---|---|---|---|
| **S0** | read-only, no side effects | implicit | N/A | 7 d | subtle action chip |
| **S1** | reversible suggestion (UI-only state) | inline | session | 30 d | inline approve button |
| **S2** | reversible write (tenant-owned store) | explicit_form | 24 h | 365 d | approval modal + diff preview |
| **S3** | blast-radius mutation (multi-entity, external-visible) | multi_reviewer | 7 d (compensating) | 730 d | multi-reviewer gate + mandatory rationale |
| **S4** | irreversible / external (send email, wire transfer, external API) | admin_only | none | 7 y | admin-only + cryptographic signature |

Each level has a canonical policy object (`src/services/agent/severityPolicies.ts`). CI invariant 36 (master plan §6) enforces exactly one policy per level.

**Acceptance criteria.**
- Every severity has exactly one default policy.
- Approval UI renders the correct affordance per severity.
- Audit log rows retain for the declared duration per severity.

**Test strategy.**
- Unit: policy table completeness.
- Integration: S3 proposal requires 2 reviewers; S4 requires admin + signature.

**Cross-refs.** V10-AGT-009..013 (per-severity tickets).

---

<a id="v10-agt-003"></a>

## V10-AGT-003 — OpType enum

**Requirement:** R-AGENT-3 (P0) — typed operation list.

**Design.** Union of operation kinds:

```ts
export type OpType =
  | "read"
  | "create_entity"
  | "update_entity"
  | "delete_entity"
  | "attach_artifact"
  | "detach_artifact"
  | "send_notification"
  | "external_api_call"
  | "schedule_trigger"
  | "ledger_write";

export type Op = {
  kind: OpType;
  target: EntityRef;
  payload: unknown;           // validated per-kind
  expectedVersion?: string;
  compensatingOp?: Op;        // for Saga pattern
};
```

**Acceptance criteria.**
- Every op kind has a handler registered in `opHandlers` map.
- CI invariant asserts handler completeness.

**Test strategy.**
- Unit: handler map coverage; unknown op rejected.

**Cross-refs.** V10-AGT-017..020 (executors consume ops).

---

<a id="v10-agt-004"></a>

## V10-AGT-004 — ApprovalMode

**Requirement:** R-AGENT-4 (P0) — approval semantics per mode.

**Design.** Five modes:

- `implicit` — auto-approved, logged only (S0 only).
- `inline` — one-click button in chat (S1 only).
- `explicit_form` — modal with rationale required (S2 default).
- `multi_reviewer` — ≥2 distinct users must approve (S3 default).
- `admin_only` — requires admin role + possibly cryptographic signature (S4 default).

Mode is set on the proposal; overrides allowed upward (e.g. tenant policy elevates all S2 to `multi_reviewer`).

**Acceptance criteria.**
- Mode ↔ UI surface mapping is deterministic.
- Override is one-way (tighter only).

**Test strategy.**
- Unit: mode → UI affordance table test.

**Cross-refs.** V10-AGT-002.

---

<a id="v10-agt-005"></a>

## V10-AGT-005 — expectedVersions concurrency

**Requirement:** R-AGENT-5 (P0) — optimistic concurrency check.

**Design.** Proposal carries `expectedVersions: Record<EntityId, string>` collected at generation time. At apply time, the runtime checks every entity's current version against expected; on mismatch, the proposal is rejected with `StaleProposalError` and user is shown a refreshed preview.

**Acceptance criteria.**
- Concurrent mutation by another actor fails cleanly.
- Stale proposal UI offers regenerate with fresh base.

**Test strategy.**
- Integration: concurrent-edit scenario — second proposal fails with version mismatch.

**Cross-refs.** V10-AGT-001, V10-ART-007.

---

<a id="v10-agt-006"></a>

## V10-AGT-006 — NavigationIntent

**Requirement:** R-AGENT-6 (P0) — proposal can express where to route the user next.

**Design.** Post-approval, the UI may navigate to a specific surface:

```ts
export type NavigationIntent =
  | { kind: "stay" }
  | { kind: "route"; path: string; focusNodeId?: string }
  | { kind: "open_artifact"; artifactId: ArtifactId; versionId?: ArtifactVersionId }
  | { kind: "schedule"; scheduleId: ScheduleId };
```

**Acceptance criteria.**
- Navigation is best-effort (never fatal if route missing).
- Focus-node targeting lands cursor precisely.

**Cross-refs.** V10-AGT-001.

---

<a id="v10-agt-007"></a>

## V10-AGT-007 — BudgetBudgetV1

**Requirement:** R-AGENT-7 (P0) — caps on time, cost, tool-call count.

**Design.** Every proposal declares its budget:

```ts
export type BudgetBudgetV1 = {
  wallClockMaxMs: number;
  costUsdCap: number;
  toolCallCap: number;
  tokenCap: number;
};
```

Runtime enforces caps; exceeding any → proposal cancelled with partial-result artifact. User sees explicit "budget exceeded" state (never silent truncation).

**Acceptance criteria.**
- Every proposal has a non-null budget.
- Exceeding any cap stops execution cleanly.
- Partial results preserved when budget exceeded.

**Test strategy.**
- Chaos: force tool-call overrun → execution stops, `agent.budget_exceeded` event fires.

**Cross-refs.** V10-AGT-014, V10-ONB-016 (research cost cap consumer).

---

<a id="v10-agt-008"></a>

## V10-AGT-008 — DiffPreviewV1

**Requirement:** R-AGENT-8 (P0) — human-readable preview across all op types.

**Design.** Renderer per OpType produces a typed preview block:

```ts
export type DiffPreview = {
  summary: string;                // "Update 3 rows in spreadsheet X"
  blocks: DiffBlock[];            // per-op visual block
};
```

Each block renders inline in the approval UI. Previews for S3/S4 severity include blast radius summary ("will affect 47 users across 3 tenants").

**Acceptance criteria.**
- Preview renders for every op kind.
- Blast radius summary is accurate (computed, not heuristic).

**Cross-refs.** V10-AGT-003.

---

<a id="v10-agt-009"></a>

## V10-AGT-009 — S0 severity

**Requirement:** R-AGENT-9 (P0) — S0 is read-only.

**Design.** S0 proposals have op kinds restricted to `read`. No approval UI; execution is immediate; only logged at 7 d retention. Used for search, retrieval, diagnostics.

**Acceptance criteria.**
- Non-read ops in S0 proposal → rejected at validation.
- No approval modal shown for S0.

**Cross-refs.** V10-AGT-002.

---

<a id="v10-agt-010"></a>

## V10-AGT-010 — S1 severity

**Requirement:** R-AGENT-10 (P0) — reversible suggestion.

**Design.** S1 proposals mutate UI-only state (e.g. "highlight these cells", "open this panel"). Session-scoped; expire on navigation. Inline approve button; no explicit form.

**Acceptance criteria.**
- S1 mutations do not persist beyond session.
- Inline approve is one-click.

**Cross-refs.** V10-AGT-002.

---

<a id="v10-agt-011"></a>

## V10-AGT-011 — S2 severity

**Requirement:** R-AGENT-11 (P0) — reversible write, 24h undo.

**Design.** S2 mutations write to tenant-owned stores (artifacts, tasks, RACIs). Explicit form approval with rationale required. 24h undo window via Run Ledger checkpoint. Audit retention 365d.

**Acceptance criteria.**
- S2 undo within 24h restores exact state.
- Rationale field non-empty on approval.

**Cross-refs.** V10-AGT-002, V10-ART-013.

---

<a id="v10-agt-012"></a>

## V10-AGT-012 — S3 severity

**Requirement:** R-AGENT-12 (P0) — blast-radius mutation.

**Design.** S3 mutations affect multiple entities or are externally visible (e.g. "close 12 tasks across 3 projects", "assign new KPIs to 50 team members"). Multi-reviewer gate (default 2 reviewers). Compensating sequence for undo (7d window). 730d audit.

**Acceptance criteria.**
- 2 distinct users approve before apply.
- Compensating sequence recorded at apply.

**Cross-refs.** V10-AGT-018 (saga executor).

---

<a id="v10-agt-013"></a>

## V10-AGT-013 — S4 severity

**Requirement:** R-AGENT-13 (P0) — irreversible / external.

**Design.** S4 mutations are irreversible or reach external systems (send invoice, commit wire transfer, publish to shared drive). Admin-only approval + cryptographic ECDSA signature. 7y audit retention. SOX-defensible.

**Acceptance criteria.**
- Admin role required to approve.
- Signature verifiable post-hoc.
- Audit log entry non-deletable for 7y.

**Cross-refs.** V10-AGT-002, V10-OUT-* (SOX-defensible reporting consumer).

---

<a id="v10-agt-014"></a>

## V10-AGT-014 — Run Ledger core schema

**Requirement:** R-AGENT-14 (P0) — durable record of every run.

**Design.** Postgres schema in `src/services/agent/ledger/schema.sql` (new):

```sql
runs(id, tenant_id, correlation_id, status, started_at, finished_at, severity, budget_used)
steps(id, run_id, ordinal, op_type, status, started_at, finished_at, input_ref, output_ref, error)
checkpoints(id, run_id, step_ordinal, state_blob, created_at)
artifacts(id, run_id, artifact_ref, created_at)
traces(id, run_id, otel_trace_id, span_tree_blob)
```

Queryable by: run ID, correlation ID, tenant, time range, status. Retention per severity (see V10-AGT-002).

**Acceptance criteria.**
- Every proposal execution writes rows.
- Ledger queries P90 ≤ 300ms.
- Row-level security per tenant.

**Test strategy.**
- Integration: execute 100 proposals → 100 runs + N steps + N checkpoints visible.
- Security: cross-tenant query returns empty.

**Cross-refs.** V10-AGT-015..020, V10-AGT-026.

---

<a id="v10-agt-015"></a>

## V10-AGT-015 — QueueExecutor + retry

**Requirement:** R-AGENT-15 (P0) — durable execution.

**Design.** Backed by Postgres LISTEN/NOTIFY + polling fallback (Master plan §10 D-6 defers Temporal to Wave C). Retry with exponential backoff (5 attempts: 1s, 5s, 30s, 2m, 10m). Dead-letter queue on terminal failure.

**Acceptance criteria.**
- Transient failures retried.
- Permanent failures land in DLQ with full context.
- Executor survives process restart.

**Test strategy.**
- Chaos: kill executor mid-run; restart; run resumes from last checkpoint.

**Cross-refs.** V10-AGT-016.

---

<a id="v10-agt-016"></a>

## V10-AGT-016 — CheckpointStore + resume

**Requirement:** R-AGENT-16 (P0) — resumable long-running work.

**Design.** Checkpoints write state snapshot between steps. Resume logic: find latest checkpoint for run, load state, continue from next step. Checkpoint frequency configurable (default every step, minimum every 60s).

**Acceptance criteria.**
- Resume produces identical final state vs uninterrupted run.
- Checkpoint storage deduplicated (same state_blob hash → single row).

**Test strategy.**
- Integration: 10-step run interrupted at step 6 → resume → completes correctly.
- Property: resume ≡ no-interrupt run for any interrupt point.

**Cross-refs.** V10-AGT-015, V10-ONB-022 (onboarding resume shares semantics).

---

<a id="v10-agt-017"></a>

## V10-AGT-017 — Atomic bundle executor

**Requirement:** R-AGENT-17 (P0) — all-or-nothing multi-op.

**Design.** Executes N ops in a single transaction; any failure rolls back all. Used for S2 proposals with multiple ops on the same artifact.

**Acceptance criteria.**
- Failure at op 3 of 5 → ops 1, 2 rolled back.
- No partial visibility to other readers during execution.

**Cross-refs.** V10-AGT-003.

---

<a id="v10-agt-018"></a>

## V10-AGT-018 — Sequential compensating sequence

**Requirement:** R-AGENT-18 (P0) — Saga pattern for cross-entity mutations.

**Design.** Executes ops sequentially; each op declares its `compensatingOp`; on failure at op K, ops 1..K-1 are compensated in reverse order. Used for S3 blast-radius mutations.

**Acceptance criteria.**
- Failure at op K triggers compensations for ops 1..K-1 in reverse.
- Compensation failure is escalated (does not retry indefinitely).

**Cross-refs.** V10-AGT-012.

---

<a id="v10-agt-019"></a>

## V10-AGT-019 — Approval barrier sequence

**Requirement:** R-AGENT-19 (P0) — pause-for-human between steps.

**Design.** Sequence declares approval barriers at specific step ordinals. On reaching a barrier, execution pauses; operator resumes manually. Used for "review after draft, before send" flows.

**Acceptance criteria.**
- Pause at barrier emits `agent.approval_required` event.
- Resume re-enters ledger at correct step.

**Cross-refs.** V10-AGT-024 (interrupt verbs).

---

<a id="v10-agt-020"></a>

## V10-AGT-020 — Fan-out / fan-in

**Requirement:** R-AGENT-20 (P1) — parallel execution.

**Design.** Fan-out to N parallel sub-runs; fan-in waits for all before continuing. Wave C scope — ship only after core executors proven.

**Cross-refs.** V10-AGT-023.

---

<a id="v10-agt-021"></a>

## V10-AGT-021 — ScheduleDefinitionV1

**Requirement:** R-AGENT-21 (P0) — scheduled agents.

**Design.** Schema:

```ts
export type ScheduleDefinitionV1 = {
  id: ScheduleId;
  tenantId: TenantId;
  cronOrInterval: string;            // cron expression or "every 1h"
  agentDefinitionRef: AgentDefRef;
  budget: BudgetBudgetV1;
  overlapPolicy: "skip" | "queue" | "parallel";
  retentionDays: number;
  nextRunAt: Timestamp;
  lastRunAt: Timestamp | null;
};
```

**Acceptance criteria.**
- Cron expressions validated at write time.
- Overlap policy enforced correctly.

**Cross-refs.** V10-AGT-022.

---

<a id="v10-agt-022"></a>

## V10-AGT-022 — ScheduleRegistry

**Requirement:** R-AGENT-22 (P0) — trigger engine.

**Design.** Scheduler polls due schedules; triggers new runs via Run Ledger. Observability: last-run, next-run, success rate, budget usage dashboards.

**Acceptance criteria.**
- Drift on schedule ≤ 60s P99.
- Missed runs (e.g. during downtime) handled per overlap policy.

**Cross-refs.** V10-AGT-021.

---

<a id="v10-agt-023"></a>

## V10-AGT-023 — Swarm contract

**Requirement:** R-AGENT-23 (P1) — multi-agent fan-out/fan-in.

**Design.** Defines `SwarmDefinitionV1` — N agents with distinct roles, coordinator agent, synthesis step. Wave C scope.

**Cross-refs.** V10-AGT-020.

---

<a id="v10-agt-024"></a>

## V10-AGT-024 — 9 interrupt verbs

**Requirement:** R-AGENT-24 (P0) — user control over running agents.

**Design.** Nine verbs: `pause`, `resume`, `cancel`, `skip` (current step), `redo` (current step), `retry` (from last failure), `reset` (back to start), `rewind` (to specific step), `abort` (terminal cancel). Exposed via UI + API.

**Acceptance criteria.**
- Every verb is idempotent.
- Side effects of partially-executed steps are compensated when verb implies it.

**Cross-refs.** V10-AGT-015, V10-AGT-016.

---

<a id="v10-agt-025"></a>

## V10-AGT-025 — Long research session phase machine

**Requirement:** R-AGENT-25 (P1) — research-specific state machine.

**Design.** Phases: `decomposing` → `retrieving` → `synthesising` → `drafting` → `self_checking` → `awaiting_approval` → `finalising`. Each phase persists intermediate artifacts to the ledger.

**Cross-refs.** V10-RSR-* (Deep Research block).

---

<a id="v10-agt-026"></a>

## V10-AGT-026 — TraceCollector

**Requirement:** R-AGENT-26 (P0) — OpenTelemetry-compatible traces.

**Design.** Every step emits OTel spans. Trace tree includes: LLM calls, tool calls, DB operations, side effects. Exportable to Jaeger / Honeycomb / etc.

**Acceptance criteria.**
- Every run has a complete trace tree.
- Traces expose budget usage per span.

**Cross-refs.** V10-AGT-014.

---

<a id="v10-agt-027"></a>

## V10-AGT-027 — NotificationBroker

**Requirement:** R-AGENT-27 (P1) — notify users on run events.

**Design.** Broker delivers notifications on: approval required, run completed, run failed, budget exceeded. Channels: email, in-app, webhook. Per-user preferences.

**Cross-refs.** V10-AGT-019.

---

<a id="v10-agt-028"></a>

## V10-AGT-028 — Time-travel + replay

**Requirement:** R-AGENT-28 (P2) — operator forensics.

**Design.** UI to re-execute a run against a past state ("what would agent X have done 2 weeks ago?"). Wave C scope.

**Cross-refs.** V10-AGT-014.

---

<a id="v10-agt-029"></a>

## V10-AGT-029 — 12 anti-patterns as lint + runtime rules

**Requirement:** R-AGENT-29 (P0) — codify the 12 anti-patterns from research doc.

**Design.** Each of the 12 (e.g. "LLM writes directly to tenant store", "approval happens after mutation", "budget cap absent", "no compensating op for S3+") becomes either a lint rule or a runtime assertion. CI invariant 42 (master plan §6) covers a subset.

**Acceptance criteria.**
- All 12 anti-patterns have automated enforcement.
- Violation names the anti-pattern explicitly.

**Test strategy.**
- Lint: synthetic violation triggers expected rule.
- Runtime: synthetic bad proposal → typed error.

**Cross-refs.** V10-AGT-001..028.

---

## Test strategy (aggregate)

**Layers.**
- 29 tickets × unit tests (≥80 unit tests overall).
- Per-severity E2E flow (S0 → S4, 5 canonical scenarios).
- Chaos: process restart, network partition, DB failover, clock skew.
- Property-based: resume ≡ non-resume for any interrupt.
- Security: tenant isolation on Run Ledger queries.
- Performance: ledger query P90 ≤ 300ms, executor throughput ≥ 100 runs/min.

**Pre-release gate.** Before AGENT block ships in Wave A, S0–S2 severities green in E2E, atomic bundle executor passes 1000 chaos runs with 0 inconsistent states, no-direct-write lint catches all synthetic violations.

## MVP exit criteria (Wave A slice)

1. `ExecutionProposalV1` schema finalised + validator active at all boundaries.
2. S0, S1, S2 severities fully implemented with canonical approval modes.
3. Run Ledger core schema + CheckpointStore + resume works across process restarts.
4. Atomic bundle executor passes 1000 chaos runs with 0 inconsistency.
5. No-silent-mutation lint enforced + runtime assertion active (CI invariant 42).
6. TraceCollector emits OTel spans for every step.
7. All Wave A flags registered and default-off.
8. Wave A tickets V10-AGT-001..011, 014..017, 026, 029 marked ✅.
9. S3, S4, swarm, schedule parked for Wave B/C as planned.

## Rollout order

1. **Core schema** (V10-AGT-001 → 002 → 003 → 004) — ExecutionProposalV1, Severity, OpType, ApprovalMode.
2. **Safety layer** (V10-AGT-005 → 007 → 008 → 029) — concurrency, budget, preview, anti-patterns.
3. **Low severities** (V10-AGT-009 → 010 → 011) — S0, S1, S2.
4. **Ledger** (V10-AGT-014 → 015 → 016) — schema, queue, checkpoint.
5. **Atomic executor** (V10-AGT-017) — Wave A exit target.
6. **Navigation + tracing** (V10-AGT-006 → 026).
7. **Wave B — severity up** (V10-AGT-012, 013, 018, 019, 024).
8. **Wave B — schedules** (V10-AGT-021, 022, 025, 027).
9. **Wave C — swarm + replay** (V10-AGT-020, 023, 028).

## Cross-refs to sibling dev plans

| Depends on | What's needed from the other block |
|---|---|
| `REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md` | TrustBundle hash on every proposal |
| `ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md` | MutationProposal is the specialisation for content mutations; shares severity taxonomy |
| `ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md` | Tool calls go through connector fabric; S4 external calls require connector trust mode verified |
| `DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md` | Long research sessions run on top of Run Ledger (V10-AGT-025) |
| `ROI_LIFECYCLE_DEVELOPMENT_PLAN_2026-04-18.md` | SOX-defensible reporting relies on S4 audit retention + signatures |
| `ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md` | V10-ONB-011 uses ExecutionProposalV1 / MutationProposal envelope |

Agent Runtime is the **execution backbone** — Reasoning and Artifact come first, but every other block depends on Agent Runtime once they start mutating enterprise data.

## Flags to register at implementation time

29 flags total (`ff.agent_*`). Key flags for Wave A MVP:

- `ff.agent_execution_proposal_v1` (V10-AGT-001)
- `ff.agent_severity_s0` … `ff.agent_severity_s4` (V10-AGT-009..013)
- `ff.agent_op_type_registry` (V10-AGT-003)
- `ff.agent_approval_modes` (V10-AGT-004)
- `ff.agent_optimistic_concurrency` (V10-AGT-005)
- `ff.agent_budget_caps` (V10-AGT-007) — **on-by-construction**
- `ff.agent_diff_preview` (V10-AGT-008)
- `ff.agent_run_ledger` (V10-AGT-014) — **on-by-construction**
- `ff.agent_queue_executor` (V10-AGT-015)
- `ff.agent_checkpoint_store` (V10-AGT-016)
- `ff.agent_atomic_bundle` (V10-AGT-017)
- `ff.agent_trace_collector` (V10-AGT-026)
- `ff.agent_anti_patterns` (V10-AGT-029) — **on-by-construction**

Wave B: `ff.agent_saga_executor`, `ff.agent_approval_barrier`, `ff.agent_schedule_registry`, `ff.agent_interrupt_verbs`, `ff.agent_research_phase_machine`, `ff.agent_notifications`.

Wave C: `ff.agent_fan_out`, `ff.agent_swarm`, `ff.agent_time_travel`.

All default-off except `ff.agent_budget_caps`, `ff.agent_run_ledger`, `ff.agent_anti_patterns` (on-by-construction for safety).
