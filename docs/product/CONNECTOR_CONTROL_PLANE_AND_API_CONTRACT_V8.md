# Connector Control Plane And API Contract v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: implementation-grade control-plane, webhook-ingress, operator-runtime and support-read API contract for the sync backend

---

## 1. Why this document exists

The sync package needs one API surface for:

- provider catalog
- installations
- mappings
- sync actions
- operator inspection

---

## 2. Control plane responsibilities

The control plane should own:

- list providers
- install connector
- connect auth
- reauth
- enable and disable
- map objects
- run test
- run sync now

---

## 3. Runtime and support responsibilities

The runtime or support APIs should expose:

- run history
- failed runs
- retries
- dead-letter items
- conflict cases
- support incident reads

---

## 4. Webhook ingress responsibilities

Webhook endpoints should define:

- provider binding
- signature validation
- event persistence
- dedupe
- replay safety

---

## 5. Canonical API groups

- `/providers`
- `/installations`
- `/connections`
- `/mappings`
- `/sync-runs`
- `/conflicts`
- `/webhooks`
- `/support`

---

## 6. Related canonical docs

- `CONNECTOR_BACKEND_DOMAIN_MODEL_V8.md`
- `CONNECTOR_RUNTIME_JOBS_AND_STORAGE_MODEL_V8.md`
- `CONNECTOR_EVENT_CONTRACTS_AND_SCHEMA_EVOLUTION_V8.md`
- `MCP_AND_REMOTE_TOOL_TRUST_MODEL_V8.md`
