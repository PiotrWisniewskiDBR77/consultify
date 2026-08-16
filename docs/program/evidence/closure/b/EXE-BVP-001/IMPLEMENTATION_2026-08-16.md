# EXE-BVP-001 implementation evidence — 2026-08-16

## Result

The previously confirmed structural breaks are closed by an additive,
owner-neutral execution receipt spine:

- `execution_case_links` is the unique tenant-scoped Initiative -> Case link.
- `work_ref`, `resource_ref`, `control_ref`, and `report_ref` are required by
  the close command, so the chain cannot jump from intake directly to closure.
- `execution_delivery_evidence` accepts only an ACTIVE, non-stale Case
  artifact link with a pinned revision and relation `EVIDENCE` or
  `DELIVERABLE`. Approval is a separate CAS mutation and self-approval is
  rejected. It is independent of task status.
- `execution_results_signal_outbox` has unique constraints on both
  `(organization_id, case_id, signal_type)` and the idempotency key.
- `closeExecutionAndEmitResultsSignal` serializes equal intents with a
  transaction advisory lock, checks approved evidence and complete spine,
  closes the execution link and inserts exactly one pending Results signal in
  the same transaction. It does not invoke or modify the owner-gated Results
  consumer adapter.

## Owned implementation paths

- `server/migrations/20260908_execution_bvp_spine.sql`
- `server/src/services/executionBvpService.ts`
- `server/src/services/__tests__/executionBvpService.pg.test.ts`

## Fresh PostgreSQL proof

Database: `consultify_exe_bvp_20260816_2251`, created solely for this gate and
dropped with `DROP DATABASE ... WITH (FORCE)` after the successful run.

Command:

```text
DATABASE_URL=<fresh-db> RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
  npx vitest run src/services/__tests__/executionBvpService.pg.test.ts --reporter=dot
```

Result: exit 0; 1/1 file, 1/1 end-to-end realPG test.

The one test contains explicit assertions for:

1. cross-tenant Initiative denial;
2. stable intake replay;
3. complete work/resource/control/report receipt;
4. stale expected-version denial;
5. stale evidence denial;
6. pinned evidence submission;
7. self-approval denial;
8. independent approval;
9. two concurrent identical close attempts both resolving to one signal ID;
10. independent new PostgreSQL client cold-read of one CLOSED link and one
    PENDING Results outbox row.

## Rollback

No existing row or owner table is rewritten. Application rollback stops using
the service. The additive tables remain as immutable evidence; no destructive
down migration is required.

## Verdict

`PASS_LOCAL_REALPG`. Downstream Results consumption remains the separate,
owner-gated adapter task; this task proves the exactly-once producer/outbox
boundary and intentionally does not claim consumer delivery.

