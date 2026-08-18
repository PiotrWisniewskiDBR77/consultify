# Tenant IAM operations runbook

Scope: `ADM-MVP-OPS-001`. This queue is tenant-scoped; SuperAdmin is outside
the MVP owner boundary.

## Normal posture

- Monitor `getAdminIamJobMetrics(organizationId)` for queued, running, failed
  and succeeded counts.
- Workers claim with a short lease. Completion and failure require the exact
  lease token, so a stale worker cannot overwrite a newer attempt.
- Enqueue callers must reuse one stable idempotency key for one business
  command. Replays return the original job and never overwrite its payload.
- Every accepted transition writes an `admin_iam_job_events` row. A transition
  without durable audit is an error, never success.

## Retry and incident handling

1. Inspect the tenant-scoped job and ordered event history.
2. Confirm the last error contains no secret before sharing it with support.
3. A retry is automatic only while `attempt_count < max_attempts`; an exhausted
   job remains `failed` for explicit diagnosis.
4. Never change a job to `succeeded` manually. Re-enqueue a corrected command
   with a new idempotency key after the underlying cause is fixed.
5. A growing `running` count past the lease interval or any `failed` count is an
   alert condition. Preserve rows and event history for diagnosis.

## Queue alert conditions

This alert is INTERNAL: it is evaluated on demand against the current
`admin_iam_jobs` state. It is not wired to any deployed scheduler or to
external paging. Wiring an external pager is a separate, later release gate.

Two alert kinds, by exact code name:

1. `ADMIN_IAM_JOB_STALE` — detection predicate: `admin_iam_jobs` rows with
   `status = 'running' AND lease_expires_at < now()`. Threshold: greater than
   zero matching rows. No existing code path reclaims an expired `running`
   lease — the claim query only reclaims rows still in `queued`. A stale job
   therefore needs explicit operator attention; it will not self-heal.
2. `ADMIN_IAM_JOB_FAILED` — detection predicate: `admin_iam_jobs` rows with
   `status = 'failed'`. Threshold: greater than zero matching rows. Per the
   rule above, never flip a `failed` job to `succeeded` manually. The remedy
   is to re-enqueue a corrected command under a NEW idempotency key.

Recovery: the alert clears when the matching count returns to zero on a
subsequent evaluator run. The durable transition sequence for each alert
instance is DETECTED, then RECOVERED.

Secrets: the alert payload deliberately carries only counts, identifiers and
the runbook id above. It never carries the job payload, the last error text,
or a lease token.

## Rollback

Disable callers/workers at the previous code SHA. The schema is additive and
old readers ignore both IAM operations tables. Do not drop tables or delete job
history during rollback.
