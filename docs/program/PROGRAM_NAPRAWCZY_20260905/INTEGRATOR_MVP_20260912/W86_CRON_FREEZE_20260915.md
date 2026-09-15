# W86 CRON — freeze 2026-09-15

Status: **READY FOR CTO REVIEW**. Product candidate before this receipt:
`4f6f69495ffefb42f4ba3f15b7fac874bc45ce53`, based on line
`9badae5335`.

## Closed defects

1. Decision auto-escalation now queries the canonical `decisions.deadline`.
   The production query no longer references the absent `due_date` column.
2. Demo sandbox TTL is default OFF (DEC-518), enabled only by
   `ENABLE_DEMO_SANDBOX_TTL=true`. Its allowlist contains organization IDs,
   never inherited brand names. A RealPG fixture named `Atelier Toys` with a
   `*-demo-session-*` ID is reclaimed after the TTL; canonical IDs remain
   protected.
3. Interview escalation is default OFF behind
   `ENABLE_INTERVIEW_ESCALATION=true`, runs once per assignment, admits only
   assignments created in the last 30 days, and processes at most 25 per run.
   Explicit targets are validated at creation. Runtime resolution is
   `escalate_to` in the same org, then assignment creator, then an org OWNER;
   fallback and absence are logged.
4. Backup failures now persist and log a non-empty normalized message including
   a nested cause. The scheduler observes the returned failure instead of
   treating a caught tick as success. The exact staging cause remains
   **NOT_PROVEN** until CTO observes the first tick of this candidate; the local
   mutation proves the previously empty `Error` shape becomes
   `Error; cause=storage refused write`.
5. The repository contains four historical creators of `integrations`
   (`256_integrations_system.sql`, `727_beta_missing_tables.sql`,
   `20260411_p01_workflow_policy.sql`, and
   `20261023_integrations_connector_runtime_shape.sql`). The local RealPG has
   the table but its canonical columns do not satisfy all legacy readers;
   staging reports the table absent. This is migration-history/schema drift,
   not proof that the table never existed. No fifth competing migration was
   added. Notification and calendar readers now inspect the available shape,
   skip incompatible legacy channels, retain environment/v8 fallbacks, and log
   the disable reason once per process.

## RealPG and focused evidence

- Decision canonical-shape test: 1/1 PASS; temp PostgreSQL table deliberately
  has `deadline` and no `due_date`.
- Demo cleanup acceptance config: 7/7 PASS on
  `127.0.0.1:6457/cx6_swieza`; default OFF, explicit ON, brand-name deletion,
  TTL, cap, safety re-check, rollback and 49 dependent-table audit.
- Interview recipient/idempotency RealPG: 1/1 PASS with a dead
  `escalate_to`; log shows fallback to the assignment creator, second pass
  escalates 0, inbox contains one row.
- Interview gate/recipient unit tests: 5/5 PASS. Backup coordinator tests: 8/8
  PASS. Existing notification unit test: included in the 5/5 set.
- Changed server entrypoints bundle with esbuild ESM: PASS.
- Candidate server type-check: 22 errors, RC 2; first three are the unchanged
  line signatures at `index.ts:1579`, `assessment-reports.routes.ts:3170`, and
  `benefits.routes.ts:941`. Line fingerprint from W87: 22.
- Candidate front type-check: TIMEOUT at the mandatory 120-second ceiling with
  zero emitted diagnostics, so the candidate count is **NOT_PROVEN**. Line
  fingerprint from W87: 193. No frontend product file changes in this packet.

No migration, fixture, staging write, deployment, Railway change, or test row
outside the local disposable RealPG fixtures is part of this package.

## Commented scheduler bodies for CTO decision

- Job 1, Daily Retention Cleanup (03:00): its intended body is to enforce the
  configured retention policy by removing expired application data and writing
  an auditable cleanup result. Today it emits only the start log; there is no
  service call. Implement only with explicit per-domain retention rules,
  bounded batches and a default-OFF destructive gate.
- Job 5, Metrics Snapshot Generation (02:45): its intended body is to aggregate
  the prior period into durable daily metric snapshots for later dashboards and
  trend reads. Today `metricsAggregator.buildDailySnapshots()` is commented and
  the job emits only the start log. Enabling it requires an idempotent snapshot
  key and a RealPG rerun test.

