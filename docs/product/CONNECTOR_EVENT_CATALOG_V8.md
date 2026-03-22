# Connector Event Catalog v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical connector event taxonomy, event envelope, idempotency doctrine, runtime recovery and replay semantics for sync, reconciliation and publish flows

---

## 1. Why this document exists

If connector runtime is event-driven, event names and payload classes cannot be improvised per provider.

This document defines the shared vocabulary for:

- webhook ingress
- sync jobs
- publish flows
- reconciliation
- conflict handling
- support and replay

---

## 2. Canonical event families

The sync package should use these top-level event families:

- `connector.installation.*`
- `connector.auth.*`
- `connector.sync.*`
- `connector.publish.*`
- `connector.webhook.*`
- `connector.conflict.*`
- `connector.runtime.*`
- `connector.support.*`

Rule:

`event names must describe business meaning, not only transport mechanics`

---

## 3. Canonical event envelope

Every persisted connector event should contain:

- `event_id`
- `event_name`
- `event_version`
- `connector_id`
- `installation_id`
- `org_id`
- `provider_key`
- `object_type`
- `object_ref`
- `occurred_at`
- `received_at`
- `correlation_id`
- `idempotency_key`
- `payload_ref`
- `status`

Optional:

- `user_ref`
- `run_id`
- `retry_count`
- `error_class`

---

## 4. Required canonical events

### 4.1 Installation and auth

- `connector.installation.created`
- `connector.installation.updated`
- `connector.auth.connected`
- `connector.auth.reauth_required`
- `connector.auth.revoked`

### 4.2 Sync lifecycle

- `connector.sync.requested`
- `connector.sync.started`
- `connector.sync.succeeded`
- `connector.sync.failed`
- `connector.sync.partial`

### 4.3 Publish lifecycle

- `connector.publish.requested`
- `connector.publish.succeeded`
- `connector.publish.failed`

### 4.4 Webhook lifecycle

- `connector.webhook.received`
- `connector.webhook.validated`
- `connector.webhook.rejected`
- `connector.webhook.replayed`

### 4.5 Conflict lifecycle

- `connector.conflict.detected`
- `connector.conflict.resolved`
- `connector.conflict.dismissed`

### 4.6 Runtime and support

- `connector.runtime.retry_scheduled`
- `connector.runtime.dead_lettered`
- `connector.support.note_added`

---

## 5. Idempotency doctrine

Every event-capable connector must define:

- idempotency source
- replay behavior
- duplicate suppression rule

Default rule:

`webhook and sync-triggered writes must be safe to process more than once`

---

## 6. Replay doctrine

Replay must preserve:

- original event name
- original source timestamps
- replay reason
- replay operator
- replay time

Replay must never silently erase the original event trail.

---

## 7. Event catalog uses

This catalog is used by:

- operator dashboards
- support diagnostics
- runtime jobs
- conflict handling
- external object lineage

---

## 8. Related canonical docs

- `CONNECTOR_EVENT_CONTRACTS_AND_SCHEMA_EVOLUTION_V8.md`
- `CONNECTOR_RUNTIME_JOBS_AND_STORAGE_MODEL_V8.md`
- `CONNECTOR_EDGE_RELIABILITY_AND_GATEWAY_POLICY_V8.md`
- `CONNECTOR_OPERATOR_AND_SUPPORT_SURFACES_V8.md`
