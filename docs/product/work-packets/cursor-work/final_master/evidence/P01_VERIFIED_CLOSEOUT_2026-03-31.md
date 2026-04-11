# P01 Verified Closeout — Integracja

**Date**: 2026-03-31
**Packets**: P01-A/B/C
**Status**: verified(evidence) — all packets complete

## Technical closure

### P01-A: Scope approval
- Canon frozen: P0 providers, object model, lifecycle grammar, operator surfaces, recovery doctrine

### P01-B: Core runtime
- Provider dispatch: jiraSyncAdapter (REST v3), slackSyncAdapter (conversations.list), teamsSyncAdapter (Graph joinedTeams), googleSyncAdapter (Calendar API)
- Cloud storage sync: Google Drive (list/download/upload/export), OneDrive/SharePoint (list/download/upload via Graph), Dropbox (list/download/upload via API v2)
- Reauth: token refresh → auth state update → fallback to manual OAuth
- Slack: listChannels, postMessage, updateMessage, testConnection
- Teams: listJoinedTeams, listChannels, postChannelMessage, sendChatMessage, createSubscription, testConnection
- Tests: 72 core + 28 cloud = 100 total — all pass

### P01-C: Verification + rollout
- §10 Evidence ledger: all rows filled
- EXECUTION_INDEX: verified(evidence) 100%
- Full P01-A 12-point acceptance checklist verified + all deep audit gaps closed

## Known limits (recorded per DoD §8.1 P01-C)

| Area | Limit | Impact | Status |
| --- | --- | --- | --- |
| Generic Webhooks | Full bidirectional: outbound HMAC delivery + inbound receiver `POST /api/v8/sync/webhooks/inbound/:registrationId` with HMAC verification, idempotency (payload-hash dedup), event-type filtering | Full webhook lifecycle | **RESOLVED 2026-04-11** |
| Provider catalog lifecycle | Runtime `v8_provider_catalog_states` table + 6-state FSM + API endpoints | Fully surfaced via `/api/v8/sync/providers/states` | **RESOLVED 2026-04-11** |
| Mapping UI | `GET/POST /api/v8/sync/integrations/:id/mappings` + `MappingDriftPanel` component (Field Mappings, Entity Maps, Schema Drift, Sync States sub-tabs) mounted as "Mappings" tab in UnifiedSyncHub (admin overview) and per-integration detail in ConnectedAppsSettings (user path) | Full preview/validate/drift UI | **RESOLVED 2026-04-11** |
| Secrets rotation | `GET /api/v8/sync/secrets/status` (90-day threshold) + `POST /api/v8/sync/secrets/:id/rotate` with `secret_rotated` audit event | Rotation schedule + audit operational | **RESOLVED 2026-04-11** |
| Telemetry gaps | All events emitted: `connection_recovered`, `drift_detected`, `run_retry_scheduled`, `run_replayed`, `provider_outage_detected`, `webhook_delivery_failure`, `org_policy_blocked`, `mapping_changed`, `secret_rotated`, `webhook_received` | Full telemetry coverage | **RESOLVED 2026-04-11** |
| Frontend surfaces | User path: `ConnectedAppsSettings` (catalog, OAuth, per-integration MappingDriftPanel); Admin path: `UnifiedSyncHub` (health tab with IntegrationHealthDashboard, mappings tab with MappingDriftPanel overview, runs, workflows, audit, policies); `CloudDataSettings` at Settings → Cloud Storage; `IntegrationsModule` deprecated stub | All surfaces active via dedicated routes | **RESOLVED 2026-04-11** |
| Run history | `GET /api/v8/sync/runs` endpoint + "Run History" tab in UnifiedSyncHub with lifecycle state + replay | Full drilldown with filters | **RESOLVED 2026-04-11** |
| Dual API surface | Legacy `/api/sync-hub/*` deprecated with `X-Deprecated` + `Sunset` headers | Migration to `/api/v8/sync` advised; legacy still works | **MITIGATED 2026-04-11** |
| Workflow policy granularity | Per-integration `workflow_policy` column (active/paused/blocked/safety_gate) + `GET/POST /api/v8/sync/integrations/:id/workflow-policy` + audit trail | Per-workflow block/pause with policy distinction | **RESOLVED 2026-04-11** |

## Implementation completion — 2026-04-11

### Faza 1: Contract amendments
- Contract updated with all 12 acceptance checklist items marked complete
- Gap ledger updated with resolved items
- Known limits documented in §10.1
- Cross-module alignment documented in §11
- Dual API consolidation roadmap documented in §12
- Wave1 plan marked as SUPERSEDED

### Faza 2: Critical code fixes
- Runtime provider catalog state: `v8_provider_catalog_states` table + API endpoints + lifecycle grammar with 6-state FSM
- Generic Webhooks adapter: full outbound delivery, HMAC signing, `v8_webhook_registrations` + `v8_webhook_deliveries` tables
- `connection_recovered` audit event on degraded→healthy transition
- `drift_detected` audit event on conflict recording (schema/mapping drift)
- `run_retry_scheduled` audit event in syncGuardrailsService

### Faza 3: API consolidation
- Legacy `syncHub.routes.ts` wrapped with `X-Deprecated` + `Sunset: 2026-07-11` headers
- `GET /api/v8/sync/error-posture` documentation endpoint for 9 error scenarios

### Faza 4: Frontend wiring
- `IntegrationHealthDashboard` mounted inside UnifiedSyncHub health tab (admin path)
- `CloudDataSettings` mounted at Settings → Cloud Storage (user path)
- `MappingDriftPanel` mounted as "Mappings" tab in UnifiedSyncHub (admin overview) and as per-integration detail action in ConnectedAppsSettings (user path)
- "Run History" tab added to `UnifiedSyncHub` with filters, table, error drilldown
- `GET /api/v8/sync/runs` backend endpoint for paginated run history
- `IntegrationsModule` deprecated — replaced by ConnectedAppsSettings (user) and UnifiedSyncHub (admin)

### Faza 5: Tests & evidence
- Added `getRuns` mock to UnifiedSyncHub health test suite
- Added `V8SyncApi.getRuns` test to v8-sync-api unit tests
- Added provider catalog lifecycle grammar unit tests
- Added generic webhook adapter unit tests
- Evidence ledger updated with resolved/mitigated items

### Faza 6: 100% contract compliance closure (2026-04-11)
- **BUG FIX**: `drift_detected` audit condition — was checking non-existent conflict classes (`schema_drift`/`mapping_drift`); fixed to use actual Zod-validated classes (`schema_mismatch_conflict`/`custom_field_conflict`/`stale_snapshot_conflict`)
- **Legacy connect onboarding**: `/api/sync-hub/connect` now sets `pending` status instead of `connected`, enforcing §2.3.5 onboarding doctrine
- **Workflow/sync logical object**: `GET /api/v8/sync/workflows` endpoint + `V8SyncWorkflowRecord` type — projects workflow-relevant data from integrations with canonical lifecycle state mapping
- **Health endpoint enriched**: `GET /api/v8/sync/health` now returns per-integration rows with provider family, lifecycle state, reason, next action, owner, last run — plus filter support (`?filter=requires_action|degraded|blocked`)
- **Errors enriched**: `GET /api/v8/sync/errors` now returns `integrationName`, `owner`, `nextAction`, `firstSeen`
- **Run lifecycle grammar**: Runs now include `lifecycleState` (connected/degraded/requires_action) and `canReplay` flag
- **Replay API**: `POST /api/v8/sync/runs/:runId/replay` — replays failed runs with audit trail (`run_replayed` event)
- **Run drill-down enhanced**: Lifecycle state column, Replay button, trace ID in error rows
- **Error posture runtime (§2.3.8 scenarios 7-9)**: `classifyError` now returns `ErrorPostureScenario` with specific classification for 403/permission, provider outage (503), webhook delivery failure, org policy block; audit events emitted for all three
- **P02 credential alignment**: `calendarSyncRuntime.buildConnectionRef` now falls back to `v8_connection_credentials` when `integrations` table lacks token
- Contract §7.4 telemetry updated — all events now emitted
- Contract §10.1 Known limits updated with resolution status

### Faza 7: Remaining open items closure (2026-04-11)
- **Mapping UI**: `GET /api/v8/sync/integrations/:id/mappings` returns field mappings, entity mappings, drift events, sync states; `POST` saves field mappings with `mapping_changed` audit event; `MappingDriftPanel` frontend component with 4 sub-tabs (Fields editor, Entity Maps table, Schema Drift review, Sync States overview) mounted as "Mappings" tab in UnifiedSyncHub (admin overview) and per-integration detail in ConnectedAppsSettings (user path)
- **Secrets rotation**: `GET /api/v8/sync/secrets/status` returns rotation status with 90-day threshold; `POST /api/v8/sync/secrets/:id/rotate` performs rotation with `secret_rotated` audit event
- **Telemetry complete**: `mapping_changed` emitted on mapping save; `secret_rotated` emitted on secret rotation; `webhook_received` emitted on inbound webhook delivery — all telemetry events now operational
- **Per-workflow policy gate**: Migration `20260411_p01_workflow_policy.sql` adds `workflow_policy` (active/paused/blocked/safety_gate), `workflow_policy_reason`, `workflow_policy_set_by`, `workflow_policy_set_at` columns; `GET/POST /api/v8/sync/integrations/:id/workflow-policy` endpoints with synced `is_paused`; audit events `workflow_policy_*`
- **Inbound webhook receiver**: `POST /api/v8/sync/webhooks/inbound/:registrationId` — HMAC SHA256 signature verification, event-type filtering against registration, payload-hash idempotency (dedup), delivery tracking in `v8_webhook_deliveries`, `webhook_received` audit event
- **Frontend API layer**: `V8SyncApi` extended with `getMappings`, `saveMappings`, `getSecretsStatus`, `rotateSecret`, `getWorkflowPolicy`, `setWorkflowPolicy`
- **Tests**: 6 new unit tests added to `v8-sync-api.test.ts` (32 total, all pass); types `V8SyncMappingData`, `V8SyncSecretsStatusData`, `V8SyncWorkflowPolicyData` added
- **Contract + evidence**: All Known limits §10.1 marked **Resolved**; no open items remain

### Faza 8: Final audit, bug fixes, and UI/UX alignment (2026-04-11)
- **Backend bugs fixed**: `pmSyncTruthService` recovery audit now uses correct `ConnectorAuthStateValues` (`degraded_scope_limited` instead of non-existent `degraded_scope_reduced`/`degraded_token_expiring`); provider catalog first-insert now validates transition from `draft`; `GET /mappings/overview` excludes deleted/disconnected integrations; `org_policy_block` classification corrected from `VALIDATION` to `AUTH` in `syncGuardrailsService`
- **Frontend mounting**: `MappingDriftPanel` mounted as "Mappings" tab in `UnifiedSyncHub` (admin overview mode) and as per-integration "View Mappings" action in `ConnectedAppsSettings` (user detail mode); `IntegrationHealthDashboard` mounted inside UnifiedSyncHub health tab; `IntegrationsModule` confirmed as deprecated stub
- **UI/UX alignment**: `emerald-*` color tokens replaced with `brand`/`primary-*` in `IntegrationHealthDashboard` and `UnifiedSyncHub`; `primary-*` replaced with `brand` in `CloudDataSettings`; raw hex chart colors replaced with CSS variable references in `APIAccessSettings`; dead form fields (quotaLimit, expiresAt, ipWhitelist) removed from `APIAccessSettings` settings panel; unused imports removed from `APIAccessSettings`, `WebhooksSettings`; `currentUser` prop removed from `APIAccessSettings` and `WebhooksSettings`; `CloudDataSettings` migrated from raw `fetch`+`localStorage` to `Api.*` helper; hardcoded English strings wrapped with `t()` in `IntegrationHealthDashboard`; `lastSync` default changed from `new Date().toISOString()` to empty string (prevents misleading display)
- **Inbound webhook auth**: Public HMAC-only route added at `/api/webhooks/v8-sync/inbound/:registrationId` outside V8 auth middleware (via `v8-sync-inbound.routes.ts` mounted in Gateway)
- **Documentation**: Contract §10.1 Frontend row updated to reflect actual mount points; this evidence closeout updated with Faza 8

## Rollback plan
- Disable sync adapters; preserve connection configs read-only
- No data destruction
