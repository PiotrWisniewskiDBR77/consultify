# V8 Sync Conflict Resolve UI Proof

Date: 2026-03-25

Environment:
- Railway project `heartfelt-blessing`
- service `consultify`
- environment `staging`
- deployment `92669d97-ef78-478e-8c7e-588003f94646`

Authenticated browser session:
- `https://stage.consultinity.ai`
- authenticated `Admin DBR77` browser session
- surface: `Admin -> Integrations -> Sync Health`

## What was verified

UI continuity proof:
- the live `Integrations Hub` loads on staging after the deploy refresh and the `Sync Health` tab remains reachable from the authenticated admin surface
- the governed conflict list still resolves from the V8 namespace:
  - `GET /api/v8/sync/conflicts?limit=10` -> `200`
- because the staging tenant had no native unresolved V8 sync conflicts, a minimal test fixture conflict was inserted only into the V8 sync truth tables for tenant `dbr77`, then removed after verification
- after the fixture appeared on the live `Sync Health` tab, the new governed operator action resolved it directly from the browser surface:
  - `POST /api/v8/sync/conflicts/stage-proof-conflict-20260325/resolve` -> `200`
- the same click path triggered the expected governed refresh reads after mutation:
  - `GET /api/v8/sync/conflicts?limit=10` -> `200`
  - `GET /api/v8/sync/integrations` -> `200`
  - `GET /api/v8/sync/connectors/jira/health` -> `200`
- after a clean reload of the same `Sync Health` tab, the surface returned to the empty-state conflict card:
  - `No governed sync conflicts are open.`

Observed continuity note:
- the legacy sync-hub surface still shows only partial health on the same admin page:
  - `GET /api/sync-hub/health` -> `500`
- despite that legacy operator-health failure, the governed conflict recovery slice now resolves and mutates successfully through `/api/v8/sync/conflicts/*`

## Scope note

This proves a broader real V8-backed Sync mutation slice on staging, but not full provider workflow parity:
- the governed V8 slice now covers connected-app inventory roster, auth credential rollup, active auth escalations, per-connector governed health, unresolved sync conflicts, and bounded operator conflict resolution
- auth escalation mutation, provider connect/disconnect, run-now, pause/resume, OAuth round-trip, and broader connector workflow still rely on legacy sync-hub or provider-specific paths
- the inserted `stage-proof-*` conflict fixture was used only to exercise the governed mutation path on a tenant that otherwise had zero live unresolved V8 sync conflicts, and was cleaned up immediately after proof capture

Conclusion:
- Sync continuity now includes a live governed operator recovery write path for conflict dismissal from the `Sync Health` tab
- remaining gap is broader provider/auth mutation parity and OAuth round-trip, not absence of a staged governed conflict recovery path
