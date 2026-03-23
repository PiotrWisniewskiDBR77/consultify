# Connector Operator And Support Surfaces v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical admin, operator, support and user-explanation surfaces for connector health, failures, incident reconstruction and degraded-state explainability

---

## 1. Why this document exists

Easy sync requires strong operator and support surfaces behind the scenes.

Without them:

- failures stay hidden
- support costs rise
- trust falls

---

## 2. Required surfaces

The sync package should expose:

- `Admin setup surface`
- `Operator runtime surface`
- `Support incident surface`
- `User-facing explanation surface`

---

## 3. Admin setup surface

Should show:

- provider
- connection state
- scopes
- mapping status
- last verification
- reauth state
- provider depth if the connector is a PM system

### 3.1 Connector package management model

> V8 Decision W5-9 applied — 2026-03-23

Connector packages are platform-managed assets with tenant-level installation.

- Platform owns the package lifecycle (design, review, promote, deprecate, retire).
- Tenant admins own enablement and configuration within allowed scope (mapping, sync direction, retry policy bounds).
- Tenant admins do not manage the connector package lifecycle itself.

Rule: `connector package is a managed platform capability, not an ad hoc tenant plugin`

### 3.2 Tenant-scoped emergency pause

> V8 Decision W5-11 applied — 2026-03-23

Tenant admins have tenant-scoped emergency pause in addition to per-connector pause.

Scope: all connectors of a given type within their org.

Required guardrails:

- explicit confirmation before activation
- visible blast radius — operator and admin must see which connectors and objects are affected
- audit event emitted on pause and resume
- resume path — clear action to lift the pause

Rule: `tenant-level emergency brake is in scope and justified`

---

## 4. Operator runtime surface

Should show:

- active runs
- queued runs
- failed runs
- retries
- dead-lettered items
- conflict cases
- provider health
- object-level replay actions
- whether failed external work should materialize into `InboxItem`

---

## 5. Support incident surface

Should allow:

- incident reconstruction
- lookup by object or run
- see affected business objects
- add support note
- replay or escalate
- classify auth vs mapping vs provider vs business conflict

### 5.1 Support notes durability

> V8 Decision W5-10 applied — 2026-03-23

Support notes on sync incidents must be durable and incident-scoped.

- Attachable to: connector incidents, replay requests, dead-letter items.
- Visible to support and authorized operators.
- Not part of end-user business object truth.
- Baseline: durable with incident history, not ephemeral chat-like comments.
- Not subject to the standard 30-day trace retention baseline; retained as long as the incident context exists.

---

## 6. User explanation surface

Should answer:

- why this connector is disconnected
- why sync is delayed
- what failed
- what the user can do next
- whether reauth is needed
- whether a work signal was routed into `InboxItem`

The user-facing layer should be honest but not overloaded with operator detail.

---

## 7. Related canonical docs

- `CONNECTOR_EVENT_CATALOG_V8.md`
- `CONNECTOR_RUNTIME_JOBS_AND_STORAGE_MODEL_V8.md`
- `CONNECTOR_EDGE_RELIABILITY_AND_GATEWAY_POLICY_V8.md`
- `CURRENT_SYNC_CONNECTION_METHOD_AND_TARGET_FLOW_V8.md`
- `CONNECTOR_OAUTH_AND_REAUTH_LIFECYCLE_V8.md`
- `TASK_SYNC_AND_EXTERNAL_WORK_INTEROPERABILITY_RUNTIME_V8.md`
