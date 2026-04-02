# V8‑PO1 — Public API + API Keys + User‑Level Sync Replatform
Date: 2026-04-02  
Owner: Product + Engineering  
Status: proposed (ready for implementation)  

## 1. Executive summary
V8‑PO1 rebuilds the integration/sync platform so that:

- **Settings (user)** is the only place where a user **connects** integrations and runs **user-owned sync**.
- **Admin** becomes **read/monitoring only** for integrations: “who is connected to what”, health, reauth state, errors, audit, and (optionally) revoke.
- The platform exposes a **professional API Keys system** and a **Public API** for external automation (starting with **Tasks** and **Calendar**).
- The user-facing integration catalog matches the breadth currently visible in the Admin catalog (with explicit “ready vs not-ready” truth; no fake connected states).

This document is a delivery-grade plan and DoD expansion that ties together the existing V8 connector doctrine and the current repo implementation seams.

## 2. Why we are doing this
Current implementation mixes three different truths:

- org-level “governed” integrations (`/api/v8/sync/*` and legacy `/api/sync-hub/*`)
- canonical org integrations (`/api/integrations/*`)
- user settings integrations (`/api/settings/integrations/*`) which sometimes initiate org-level writes

This leads to:

- unclear ownership: admin vs settings
- duplicated catalogs and partial UIs
- “connect” flows that can look complete while remaining operationally pending

V8‑PO1 makes ownership explicit and moves the product toward a single coherent integration platform story (benchmark-aligned).

## 3. Canonical doctrine references (SSOT)
- Integracja contract (P01): `docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_01_INTEGRACJA_2026-03-29.md`
  - Includes **P0 provider list** and explicitly includes **Generic Webhooks + API keys** as a core capability.
- Benchmark: `docs/product/SYNC_PLATFORM_BENCHMARK_V8.md`
- Control plane API contract: `docs/product/CONNECTOR_CONTROL_PLANE_AND_API_CONTRACT_V8.md`
- Enterprise connectors + retrieval governance: `docs/product/AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md`

**PO1 rule:** any new surface must preserve the object separation doctrine: catalog → connection → workflow → run.

## 4. Target ownership model (Admin vs Settings)

### 4.1 Settings (user) — connect + sync
Settings owns:

- catalog browse with “ready vs coming soon” truth
- connect/reauth/disconnect
- per-user configuration, scopes, mapping choices (where applicable)
- per-user sync runs and logs (or a bounded slice)

### 4.2 Admin — monitor who has what + operator posture
Admin owns:

- “who is connected to what” across the tenant (user ↔ connector)
- health summary, requires-reauth, errors
- audit visibility
- optional compliance action: revoke a user connection (no “connect” here)

Admin must **not** be the primary connect surface for users (no marketplace-style catalog as the main path).

## 5. Data model changes (SSOT for user-level integrations)

### 5.1 New tables (proposal)
Create a normalized, queryable user-level truth store.

#### `user_integrations` (SSOT)
- `id` (uuid)
- `organization_id`
- `user_id`
- `connector_id`
- `status` (`pending` | `active` | `requires_reauth` | `revoked` | `error` | `disconnected`)
- `scopes_granted` (jsonb/text)
- `external_account_ref` + `external_workspace_ref` (+ optional display names)
- `config` (jsonb)
- `last_sync_at`, `last_error`, `last_verified_at`
- `created_at`, `updated_at`

#### `user_integration_secrets` (or external secrets manager)
- `user_integration_id`
- encrypted provider secrets / refresh token material
- rotation metadata

### 5.2 Migration posture
- Existing JSON-in-preferences storage is a stopgap. PO1 migrates to normalized tables.
- Legacy org-level `integrations` table remains for governed org connectors only. User-level entries do **not** write there by default.

## 6. Integration catalog (breadth + truth)

### 6.1 Catalog source of truth
There must be **one canonical catalog** that both Settings and Admin consume.

Catalog items must include:
- `id`, `name`, `category`
- `authType`
- `capabilities`
- `configFields` (+ labels)
- `availability`:
  - `ready` (connectable + has runtime)
  - `comingSoon` (visible but not connectable)
  - `disabledByPolicy` (blocked)
- `branding`:
  - `icon` (logo asset or stable icon id)
  - optional color/token for UI

### 6.2 “Ready means real” rule (no fake UI)
- If a connector is not fully connectable end‑to‑end, it must not show a working “Connect” action.
- Completion proof doctrine: `setup → verify/test → enable`.

## 7. API Keys system (professional + productized)

### 7.1 Key types
PO1 supports **two key families** with explicit ownership:

1) **User API keys (Settings)**  
For personal automation and user-owned sync tooling.

2) **Organization API keys (Admin/Owner)** *(optional, gated)*  
For service-to-service integrations owned by the tenant (robot keys). If enabled, must be admin/owner managed with strict scopes and audit.

### 7.2 Capabilities required
- show full key **only once** at creation/rotation
- store only **hash + prefix**, never plaintext
- rotation (with grace period optional)
- expiration
- per-key rate limit
- permissions/scopes
- audit events for create/rotate/revoke
- usage visibility (bounded; at minimum last used time + error counts)

### 7.3 Scope vocabulary (PO1 baseline)
We standardize permission strings so they can be used consistently by middleware and UI.

**Tasks**
- `read:tasks`
- `write:tasks`

**Calendar**
- `read:calendar`
- `write:calendar`

**Integrations**
- `read:integrations`
- `write:integrations`

**Webhooks**
- `webhooks:manage` (or split read/write if needed)

**Note:** existing permission vocab in the repo includes `read:tasks`/`write:tasks` and related entries; PO1 extends calendar/integrations permissions.

## 8. Public API (PO1 baseline)

### 8.1 Goals
- Let external tools integrate with Consultify using API keys
- Start with **Tasks** and **Calendar**
- Preserve RBAC and org boundaries; keys must not escalate permissions beyond the actor

### 8.2 Versioning + base path
Introduce a stable public prefix:

- `GET/POST/PUT/DELETE /api/public/v1/*`

Auth:
- `Authorization: Bearer <ck_...>` (API key)
- optional secondary: cookie session for interactive clients (not required for public)

### 8.3 Public endpoints — Tasks (minimum viable)
Expose a bounded subset that maps onto existing task services/controllers:

- `GET /api/public/v1/tasks` (list + filters)
- `POST /api/public/v1/tasks` (create)
- `GET /api/public/v1/tasks/:id` (read)
- `PUT /api/public/v1/tasks/:id` (update)
- `DELETE /api/public/v1/tasks/:id` (soft delete if supported; otherwise hard delete with audit)

Optional but strongly recommended for “real integration”:
- `POST /api/public/v1/tasks/:id/assign`
- `GET /api/public/v1/tasks/:id/comments`
- `POST /api/public/v1/tasks/:id/comments`

### 8.4 Public endpoints — Calendar (minimum viable)
Calendar already has a V8 interop contract. Public API should expose a bounded user-focused slice:

- `GET /api/public/v1/calendar/sources` (list sources for the API-key actor)
- `POST /api/public/v1/calendar/sources` (create/attach a source)
- `GET /api/public/v1/calendar/items` (list items within allowed scope)
- `POST /api/public/v1/calendar/items` (create event/task-backed calendar item if supported)

Conflict and lifecycle semantics should follow the V8 calendar contract where applicable (etag + 409/412/422 posture).

### 8.5 Webhooks
PO1 links API keys and webhooks into one automation story:

- inbound webhooks: signature verification + dedupe + replay safety
- outbound subscriptions: per-tenant or per-user (explicit)

## 9. Delivery plan (epics → tasks)

### Epic A — Unify catalog + branding assets
- A1. One catalog SSOT consumed by Settings + Admin
- A2. Brand icons/logos for catalog items (SVG assets or stable icon map)
- A3. Availability truth: ready/comingSoon/blocked

### Epic B — User-level integrations SSOT
- B1. Implement `user_integrations` + secrets store
- B2. Migrate Settings connect/disconnect/config/test/logs onto user-level SSOT
- B3. Ensure completion proof (setup → verify/test → enable)

### Epic C — Admin monitoring only
- C1. Admin view: user ↔ connector matrix/list with filters
- C2. Health/audit aggregation
- C3. Optional: revoke user connection + audit

### Epic D — API Keys (User + optional Org)
- D1. User API keys: create/list/rotate/revoke + permissions + rate limit
- D2. Org API keys: owner/admin only + audit (gated)
- D3. Unified permission vocabulary (tasks/calendar/integrations/webhooks)

### Epic E — Public API v1 (Tasks + Calendar)
- E1. API key auth middleware + permission enforcement
- E2. Public Tasks endpoints mapped to existing task runtime
- E3. Public Calendar endpoints mapped to existing calendar interop runtime
- E4. Abuse protection: rate limit + audit + usage summary

## 10. Definition of Done (expanded for PO1)

### 10.1 Product DoD
- Settings is the **primary** connect surface; Admin does **not** own “connect marketplace”.
- Catalog shows **real** readiness; no fake “connected”.
- User can connect, see status, reauth, disconnect with stable messaging.
- Admin can see which users are connected to which connectors, with health + errors.
- API keys are secure (one-time display, hashed, rotation, expiration).
- Public API can create/read/update tasks and create/list calendar sources/items for the API-key actor.

### 10.2 Engineering DoD
- No duplicate truths: one SSOT for user integrations and one for governed org integrations.
- DB migrations are forward-only and safe; no destructive git operations.
- Tests cover:
  - API key creation/rotation/revocation
  - public API permission enforcement
  - user integration connect → verify/test → enabled state
  - admin monitoring reads (org scoped)
- Observability:
  - audit events for key events (connect/reauth/disconnect, key lifecycle, public API writes)
  - bounded error codes; no “unknown error” as the only class

## 11. Rollout + gating
- Feature flag: `po1_public_api_enabled` (org-scoped)
- Feature flag: `po1_user_integrations_ssot_enabled`
- Soft launch:
  - enable for one org → verify end-to-end
  - expand to broader tenants

## 12. Open decisions (must be resolved early)
- Which connectors from the broad catalog are **truly ready** in PO1 vs explicitly “coming soon”?
- Do we allow org-level service keys in PO1, or ship only user keys first?
- Which task fields and calendar item fields are considered “public contract” v1 (freeze shape + migration policy)?

