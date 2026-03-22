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

---

## 5. Support incident surface

Should allow:

- incident reconstruction
- lookup by object or run
- see affected business objects
- add support note
- replay or escalate

---

## 6. User explanation surface

Should answer:

- why this connector is disconnected
- why sync is delayed
- what failed
- what the user can do next

The user-facing layer should be honest but not overloaded with operator detail.

---

## 7. Related canonical docs

- `CONNECTOR_EVENT_CATALOG_V8.md`
- `CONNECTOR_RUNTIME_JOBS_AND_STORAGE_MODEL_V8.md`
- `CONNECTOR_EDGE_RELIABILITY_AND_GATEWAY_POLICY_V8.md`
- `CURRENT_SYNC_CONNECTION_METHOD_AND_TARGET_FLOW_V8.md`
