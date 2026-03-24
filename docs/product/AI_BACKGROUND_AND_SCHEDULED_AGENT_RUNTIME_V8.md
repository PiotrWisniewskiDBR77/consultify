# AI Background And Scheduled Agent Runtime v8

> Status: Draft v8
> Owner: Product + Engineering
> Cel: zdefiniowac kanoniczny runtime dla `background`, `async`, `scheduled` i `long-running` AI work.

---

## 1. Why this matters for Consultify

Najlepsze systemy AI nie probuja wykonywac wszystkiego w jednym request-response loop.

W biznesie wiele zadan wymaga:

- dluzszego researchu,
- kolejkowania,
- wznowienia po bledzie,
- zaplanowanego uruchomienia,
- pracy poza interaktywnym SLA.

Jesli ten typ pracy nie ma swojego runtime, system bedzie:

- niestabilny,
- kosztowny,
- trudny do supportu,
- i nieprzewidywalny dla usera.

---

## 2. Leader patterns

Imported patterns:

- `Replit`: workflow units and non-interactive work classes,
- `OpenAI` and agent references: sub-work moved off the main thread,
- `LangChain`: decomposition and parallel work need bounded orchestration,
- `Claude/LLM docs`: batch, cache and cost behavior depend on execution mode.

Key lesson:

`interactive`, `background` i `scheduled` to nie sa UI flags. To sa rozne klasy runtime.

---

## 3. Current V8 coverage

Current partial coverage exists in:

- `AGENT_EXECUTION_V8_SSOT.md`
- `AGENT_MULTI_AGENT_WORK_MANAGEMENT_V8.md`
- `AI_LLM_MODEL_MANAGEMENT_V8.md`

Current gap:

- brak osobnego SSOT dla queue lifecycle, schedules, retry policy, checkpointing, degraded mode i user-visible status model.

---

## 4. Canonical target architecture

Canonical runtime classes:

- `interactive`
- `background`
- `scheduled`
- `batch`

Canonical lifecycle:

`request -> classify -> create run/job -> queue -> start -> checkpoint -> continue/retry -> complete/fail/cancel -> summarize -> audit`

Required runtime objects:

- `BackgroundAgentJob`
- `JobSchedule`
- `JobCheckpoint`
- `RetryPolicy`
- `RunResumePack`
- `JobOutcomeSummary`

## 4.1 Leader-grade hardening requirements

To reach serious long-running AI runtime quality, this document must also define:

- delivery semantics per job class as `at-least-once`, `effectively-once` or `non-mutating best effort`,
- queue priority and backpressure policy by workload class,
- checkpoint granularity rules for research-only steps vs mutation-capable steps,
- scheduler identity and permission re-validation before every scheduled execution,
- timezone and daylight-saving handling for schedules,
- degraded-mode policy when cost, source freshness or model availability changes during a run.

Minimum job metadata should include:

- `job_id`
- `job_class`
- `initiated_by_ref`
- `scheduled_by_ref?`
- `approval_state`
- `priority_class`
- `retry_count`
- `last_checkpoint_ref`
- `resume_token_ref`
- `effective_scope_snapshot_ref`
- `failure_class`
- `status_changed_at`

---

## 5. Contracts and boundaries

`Execution Agent v8` owns:

- run semantics,
- plan/proposal/execution logic.

`Multi-Agent v8` owns:

- branch orchestration,
- subtask management.

`LLM Model Management v8` owns:

- execution profile choice per workload class.

This document owns:

- job lifecycle,
- scheduling rules,
- retry and timeout doctrine,
- user-visible status semantics for non-interactive AI work.

---

## 6. Risks and failure modes

Main risks:

- background work mutates artifacts without the right approval state,
- long runs have no resumable state,
- retries duplicate effects,
- scheduled jobs use stale context or revoked access,
- users do not know whether work is queued, running, blocked or failed.

---

## 7. Implementation implications

The platform should add:

- one job status model shared across AI consumers,
- explicit idempotency and replay-safe execution steps,
- checkpoint and resume packs for long-running work,
- schedule objects with policy validation,
- operator-visible timeout, retry and failure reasons,
- clear separation between `approved background apply` and `research-only background work`.

---

## 8. Acceptance criteria

- Every non-interactive AI run has a durable job object and status history.
- Long-running work can resume from checkpoints without duplicating approved mutations.
- Scheduled jobs validate context, permissions and source freshness before execution.
- Users and operators can distinguish queued, running, waiting, failed, cancelled and completed work.
- Background execution never bypasses the canonical approval model.

---

## 9. Related canonical docs

- `docs/product/AGENT_EXECUTION_V8_SSOT.md`
- `docs/product/AGENT_MULTI_AGENT_WORK_MANAGEMENT_V8.md`
- `docs/product/AI_LLM_MODEL_MANAGEMENT_V8.md`
- `docs/product/AGENT_AND_KNOWLEDGE_V8_MASTER_PLAN.md`
- `docs/product/AI_LEADER_PARITY_ARCHITECTURE_V8.md`
