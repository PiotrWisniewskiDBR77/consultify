# OPS-OBS-001 operational alerts runbook

Scope: internal-beta operational signals. This runbook does not authorize a production SLO claim.

For every active `consultify_operational_alert_active` series, capture its `kind`, correlation ID,
candidate SHA, UTC detection time and tenant-safe source identifier. Never paste request payloads,
tokens, credentials or user content into the incident record.

Current production wiring:

- Results platform outbox ticks sample the oldest pending/failed/claimed envelope and record each
  downstream dispatch success or failure using event/outbox identifiers only.
- Completed HTTP 401/403 responses feed the repeated-auth-denial window; an optional sanitized
  `X-Request-Id` is the correlation label.
- Every Prometheus scrape samples the live primary PostgreSQL pool saturation before evaluating
  alerts. No database pool is initialized solely for a scrape.
- The scheduler evaluates the local bounded windows every 30 seconds and reconciles them into
  `operational_alert_incidents`. PostgreSQL advisory locks and the one-open-incident index collapse
  concurrent evaluators into one durable incident per kind.
- `operational_alert_incident_events` is the append-only DETECTED/RECOVERED/ACKNOWLEDGED history.
  Direct UPDATE or DELETE is rejected by PostgreSQL. A restart or a second process reads the same
  open incident instead of silently clearing operational history.
- An evaluator that has just started cannot recover another evaluator's active incident merely
  because its local sample window is empty. Recovery is accepted only after the persisted
  `last_breached_at` is older than the signal-specific recovery window.
- A real paging transport, dashboard and deployed multi-instance observation window remain separate
  release gates. Their absence does not authorize weakening or bypassing the durable ledger.

Tenant-scoped durable delivery substrate:

- `operational_alert_signals` is the identity-complete append-only ingress. Every row carries
  organization, actor, correlation, source, outcome and an idempotency fingerprint; reused keys
  with different content fail closed. Secret-bearing metadata keys are rejected.
- The DB-window evaluator persists one state per organization and kind. It enqueues immutable
  `DETECTED` and `RECOVERED` delivery envelopes transactionally with the state transition.
- Durable tenant signal writes/evaluation are **default OFF** and require
  `OPERATIONAL_ALERT_DURABLE_ENABLED=true`; the emergency
  `OPERATIONAL_ALERT_LEDGER_ENABLED=false` disables both legacy reconciliation and this new path.
  Delivery additionally requires `OPERATIONAL_ALERT_DELIVERY_ENABLED=true`. The current
  repository transport intentionally accepts only an explicitly configured loopback receiver for
  controlled operator verification. This is not authorization for production paging.
- The loopback endpoint rejects HTTPS/external hosts, userinfo, IPv6 and lookalike localhost names;
  redirects are rejected rather than followed. Producer calls are trusted internal boundaries, not
  public authentication APIs. HTTP denial signals are written only when authenticated tenant,
  actor and canonical request correlation identity are all present; anonymous/missing identity is
  deliberately not invented.
- Claims use `FOR UPDATE SKIP LOCKED`, bounded exponential retry and a five-attempt dead-letter.
  Expired claims are reclaimable after a process crash. A successful local response writes one
  immutable receipt in the same transaction that marks the envelope delivered.
- Operator inspection: `npx tsx server/scripts/operational-alerts.ts list [--organization ID]`.
  Positive control: `... positive-control --organization ID --operator OPERATOR_ID`. Acknowledge:
  `... ack --organization ID --kind KIND --operator OPERATOR_ID`. Acknowledgment fails while ACTIVE
  and is accepted only after the DB evaluator has persisted RECOVERED.

1. `WRITE_FAILURE_RATE`: stop retries that can duplicate effects, trace the correlation ID through
   the owner writer and outbox, verify tenant/actor/source/result fields, then replay one idempotent
   fixture. Recovery requires a fresh five-minute window below 1%.
2. `OUTBOX_OLDEST_AGE`: pause producers if backlog grows, inspect the oldest non-secret envelope,
   restore the consumer and prove oldest age below five minutes without orphaning a receipt.
3. `DB_SATURATION`: inspect pool usage and slow queries; reduce bounded concurrency. Recovery needs
   readings below 80%, followed by a normal read/write probe.
4. `REPEATED_AUTH_DENIALS`: preserve denial correlation IDs, check tenant/role boundaries and rate
   limiting, and escalate suspected abuse. Do not weaken authorization to recover service.

After the signal clears, the scheduler first persists `RECOVERED`. An operator may acknowledge the
specific durable `incidentId` only after the relevant probe succeeds. `ACTIVE` incidents reject
acknowledgment; a successful acknowledgment appends an `ACKNOWLEDGED` event and closes the open
incident. Never acknowledge by kind alone because that can target the wrong occurrence. The owner
target remains 99.5% internal-beta availability.
