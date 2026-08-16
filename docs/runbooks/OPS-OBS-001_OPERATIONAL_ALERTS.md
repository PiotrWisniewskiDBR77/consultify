# OPS-OBS-001 operational alerts runbook

Scope: internal-beta operational signals. This runbook does not authorize a production SLO claim.

For every active `consultify_operational_alert_active` series, capture its `kind`, correlation ID,
candidate SHA, UTC detection time and tenant-safe source identifier. Never paste request payloads,
tokens, credentials or user content into the incident record.

1. `WRITE_FAILURE_RATE`: stop retries that can duplicate effects, trace the correlation ID through
   the owner writer and outbox, verify tenant/actor/source/result fields, then replay one idempotent
   fixture. Recovery requires a fresh five-minute window below 1%.
2. `OUTBOX_OLDEST_AGE`: pause producers if backlog grows, inspect the oldest non-secret envelope,
   restore the consumer and prove oldest age below five minutes without orphaning a receipt.
3. `DB_SATURATION`: inspect pool usage and slow queries; reduce bounded concurrency. Recovery needs
   readings below 80%, followed by a normal read/write probe.
4. `REPEATED_AUTH_DENIALS`: preserve denial correlation IDs, check tenant/role boundaries and rate
   limiting, and escalate suspected abuse. Do not weaken authorization to recover service.

After the signal clears, call `acknowledgeRecovery(kind)` only after the relevant probe succeeds.
Record `recoveredAt` and `acknowledgedAt`. If the alert remains active or has no recovery timestamp,
acknowledgment must fail closed. The owner target remains 99.5% internal-beta availability.
