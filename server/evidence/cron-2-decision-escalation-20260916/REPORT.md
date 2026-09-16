# CRON-2 — decision escalation

## Verdict

The failing 15-minute job was a second, incompatible escalation writer. It was removed from the scheduler. The canonical daily sweep at 00:10 UTC remains the only scheduled decision-escalation authority. No migration was added.

## Measurement

- Base: `9981c41c2d5a14d87418066d340d77b39e2c5df4`.
- Failing scheduler path: `server/src/cron/Scheduler.ts`, former job 7b, `*/15 * * * *`, calling `DecisionEscalationChainService.checkAndEscalateOverdue({ limit: 100 })`.
- Failing query: `server/src/services/decisionEscalationChainService.ts:74-86` reads `decisions.escalated_at`, `decider_id`, `backup_decider_id`, and `last_reminder_sent_at`; its write path at lines 331-354 also expects `escalated_by` and `escalation_reason`.
- The only producer for those columns is legacy SQLite migration `server/migrations/303_decision_escalation_delegation.sql:13-28`.
- The active PostgreSQL runner explicitly skips numbered migrations below 500, apart from the canonical core baseline (`server/scripts/migrate.postgres.ts:265-269`). Migration 303 therefore cannot prove the staging schema.
- The active schema defines `decisions.escalation_level` as text (`server/migrations/730_beta_schema_fixes.sql:9`), while the 15-minute service types and compares it as a number (`decisionEscalationChainService.ts:66,262,268-270`). Adding only `escalated_at` would reveal the next missing column and still leave incompatible state semantics.
- The canonical daily job documents and implements the intended split: text severity stays in `decisions.escalation_level`; the numeric escalation step and daily idempotency live in `decision_escalation_log` (`server/src/jobs/decisionEscalationJob.ts:17-30,126-145,181-205`). It writes audit history and does not replace `decision_maker_id` (`decisionEscalationJob.ts:211-250`).

## History

- `b0b7d1cd5f` (2026-01-27): introduced the legacy decision escalation/delegation service and its 15-minute schedule.
- `579de50e6d` (2026-09-07): introduced the canonical daily sweep, audit-log step counter, daily idempotency, and dry-run path.
- `e0f22f0663` (2026-09-15): changed the legacy query from nonexistent `due_date` to canonical `deadline`, but did not reconcile the remaining legacy columns or the duplicate scheduler authority.
- `9981c41c2d` (2026-09-15): both automations were still scheduled; staging exposed the next schema mismatch at `escalated_at`.

## Change

- Removed the eager import and registration of the legacy 15-minute `DecisionEscalationChainService` job.
- Kept job 46: `cron.schedule('10 0 * * *', runDecisionEscalationSchedulerTick, { timezone: 'UTC' })`.
- Added a regression test that requires exactly one canonical daily registration and rejects the legacy service/message in `Scheduler.ts`.

Recommendation: keep one automation, the daily sweep. It already owns dry-run, daily idempotency, a bounded 0→1→2→3 counter, status filtering, `decision_escalation_log`, and `decision_history`. Do not add columns solely to revive the second writer. If sub-day urgency is later required, change the cadence of the canonical job after an owner decision; do not re-enable the legacy service.

## Before / after

- Before: the staging receipt and an isolated PostgreSQL reproduction both returned SQLSTATE `42703`, `column "escalated_at" does not exist`; see `BEFORE.log`.
- After: the canonical RealPG job produced `escalated=2`, `errors=0`; dry-run wrote zero, a same-day second run wrote zero, resolved/future decisions stayed unchanged, and cleanup readback was `0/0/0`; see `AFTER.log`.
- Unit rule test: 5 passed.
- Scheduler uniqueness test: 1 passed.
- RealPG behavior subset: 4 passed, 3 unrelated decision-finalization tests intentionally excluded by the test-name filter.
- `git diff --check`: pass.

## Runtime constraint

An own Docker container was attempted twice (named volume and tmpfs). Docker failed before container creation with `failed to create temp dir: mkdir /tmp/containerd-mount…: input/output error`. To preserve the required isolation and avoid touching another agent's container, the proof used a private PostgreSQL 16 cluster stored under this worktree on the allowed dedicated port 5291. This proves PostgreSQL behavior, but the container-specific gate is `NOT_PROVEN` because of the host Docker failure.
