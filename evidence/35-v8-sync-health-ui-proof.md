# V8 Sync Health UI Proof

Date: 2026-03-25

Environment:
- Railway project `heartfelt-blessing`
- service `consultify`
- environment `staging`
- deployment `084a10c4-1b97-4209-a972-abee0e3360f3`

Authenticated browser session:
- `https://stage.consultinity.ai`
- authenticated `Admin DBR77` browser session
- surface: `Admin -> Integrations` via `/admin?tab=integrations`

## What was verified

UI continuity proof:
- the live `Admin -> Integrations` module loads on staging in the authenticated browser session after the new deployment
- opening `/admin?tab=integrations` loads the operator-facing integrations hub used for sync monitoring
- the same live Integrations surface now calls the governed V8 sync endpoint:
  - `GET /api/v8/sync/auth/health` -> `200`

Observed continuity note:
- the page still hydrates broader legacy sync reads in parallel, including:
  - `GET /api/sync-hub/connectors` -> `200`
  - `GET /api/sync-hub/audit-log` -> `200`
  - `GET /api/sync-hub/errors` -> `200`
  - `GET /api/sync-hub/integrations` -> `500`
  - `GET /api/sync-hub/health` -> `500`

Tenant state note:
- this staging tenant currently shows an empty integrations state (`No integrations connected`)
- that does not block proof of the bounded V8 read slice, because the live operator surface still hydrates the governed auth-health summary from `/api/v8/sync/auth/health`

## Scope note

This proves a real operator-facing V8 Sync read slice on staging, but not full sync migration:
- the governed V8 slice currently covers the persisted auth-health summary consumed by the live Admin Integrations surface
- connector catalog/listing, legacy health summaries, audit/errors panels, provider OAuth flows, reconnect actions, and broader sync mutations still use legacy endpoints
- this capture proves operator-facing sync continuity on the live Integrations hub, not provider round-trip parity

Conclusion:
- Sync no longer lacks dedicated staging UI proof entirely
- the live Admin Integrations surface now has browser-proven V8 continuity for the governed sync auth-health read
- remaining gap is provider/OAuth round-trip and broader connector workflow continuity, not absence of any live V8 Sync UI path
