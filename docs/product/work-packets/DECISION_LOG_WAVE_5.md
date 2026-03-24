# V8 Program — Wave 5 Decision Log

> Status: Closed
> Authority: Source-of-truth chat decisions
> Date: 2026-03-23
> Scope: binding decisions for Wave 5 escalation items from packets WP-W5-EXT-01, WP-W5-EXT-02, WP-W5-EXT-03

---

## PM sync auth baseline

### Decision W5-1 — Admin token re-binding

- Yes, but only through a governed admin recovery flow.
- Admin cannot silently swap identity semantics.
- Re-bind allowed when: original user is unavailable, connector ownership continuity is required.
- Audit captures: old binding, new binding, actor, reason, timestamp.
- Rule: `re-bind must be explicit, auditable and policy-checked; never invisible credential reassignment`.

### Decision W5-2 — Transient-failure discrimination

- Provider-family criteria under one shared doctrine.
- `retry later`: network timeout, rate limit, transient 5xx, temporary provider outage, short-lived webhook delivery issue.
- `reauth now`: expired/revoked token, missing scope, invalid refresh flow, account disconnected, user removed from source system.
- Rule: `temporary transport/provider instability → retry path; auth/scope/identity break → reauth path`.

### Decision W5-3 — Degraded-state escalation thresholds

- Defaults ratified: 4h → degraded, 24h → critical, 72h → disconnected candidate / forced intervention.
- Allow later tightening by connector family and tenant policy.
- Baseline is the default cross-platform ladder.

---

## Replay, dead-letter and edge reliability

### Decision W5-4 — `schema_drift_detected` event

- Add `connector.runtime.schema_drift_detected` to the canonical event catalog.
- Must be operator-visible and support-visible.

### Decision W5-5 — Retry threshold canonicalization

- Canonicalize the policy shape, not one hard numeric value for every connector.
- Shared canon defines: max attempt classes, backoff family, jitter support, escalation handoff.
- Exact numbers remain connector-family configuration.
- Rule: `common retry doctrine, family-specific tuning`.

### Decision W5-6 — Dead-letter retention baseline

- 90 days canonicalized as baseline.
- Baseline before stricter tenant policy overrides.
- Important incidents linked to audit/compliance may require longer lineage through adjacent systems.

### Decision W5-7 — Bulk replay semantics

- Add bulk replay to the replay doctrine.
- Safeguards: scoped selection, preview/impact visibility, rate/volume guardrails, operator confirmation.
- Rule: `bulk replay is allowed, never blind fire-and-forget`.

### Decision W5-8 — Structured provider health model

- Add structured provider health model.
- Minimum health dimensions: auth health, transport health, schema health, sync freshness, replay/dead-letter pressure.
- Rule: `provider health must be decomposed, not reduced to one vague status light`.

---

## Operator and admin surfaces

### Decision W5-9 — Connector packages as platform-managed assets

- Ratify connector packages as platform-managed assets with tenant-level installation.
- Platform owns package lifecycle; tenant admins own enablement/configuration within allowed scope.
- Rule: `connector package is a managed platform capability, not an ad hoc tenant plugin`.

### Decision W5-10 — Support notes durability

- Support notes on sync incidents must be durable and incident-scoped.
- Attached to connector incident / replay / dead-letter context.
- Visible to support and authorized operators; not part of end-user business object truth.
- Baseline: durable with incident history, not ephemeral chat-like comments.

### Decision W5-11 — Tenant-scoped emergency pause

- Tenant admins have tenant-scoped emergency pause in addition to per-connector pause.
- Scope: all connectors of a given type within their org.
- Guardrails: explicit confirmation, visible blast radius, audit event, resume path.
- Rule: `tenant-level emergency brake is in scope and justified`.

---

## Wave 5 closure

Wave 5 is formally closed as of 2026-03-23 with 3 completed packets and 11 binding decisions.

---

## Related packets

- `WP-W5-EXT-01_PM_SYNC_AUTH_BASELINE.md`
- `WP-W5-EXT-02_REPLAY_DEADLETTER_RELIABILITY.md`
- `WP-W5-EXT-03_OPERATOR_ADMIN_SURFACES.md`
