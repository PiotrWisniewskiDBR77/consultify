# V8 Sync Integrations Roster UI Proof

Date: 2026-03-25

Environment:
- Railway project `heartfelt-blessing`
- service `consultify`
- environment `staging`
- deployment `94b481d2-076a-440c-b083-da5d04d7bfeb`

Authenticated browser session:
- `https://stage.consultinity.ai`
- authenticated `Admin DBR77` browser session
- surface: `Admin -> Integrations -> Connected Apps`

## What was verified

UI continuity proof:
- the live `Integrations Hub` loads on staging after the deploy refresh and opens on the default `Connected Apps` tab without falling into the prior legacy inventory blocker
- the same operator-facing surface now hydrates the roster through the governed V8 inventory route:
  - `GET /api/v8/sync/integrations` -> `200`
- the staged browser path continues to resolve the broader governed Sync/Multiplayer reads in parallel:
  - `GET /api/v8/sync/auth/health` -> `200`
  - `GET /api/v8/sync/auth/escalations` -> `200`
  - `GET /api/v8/sync/conflicts?limit=10` -> `200`

Observed continuity note:
- the legacy sync-hub runtime is still only partially healthy on the same screen:
  - `GET /api/sync-hub/health` -> `500`
  - `GET /api/sync-hub/errors` -> `200`
  - `GET /api/sync-hub/audit-log` -> `200`
  - `GET /api/sync-hub/connectors` -> `200`
- unlike the earlier staging state, the live `Connected Apps` read slice no longer depends on `GET /api/sync-hub/integrations`; the roster request now resolves from `/api/v8/sync/integrations` on the staged browser path
- this tenant currently renders the empty-state connected-apps view after the governed roster load, which is still valid continuity proof for the bounded inventory slice because the request succeeds on the real admin surface

## Scope note

This proves a broader real V8-backed Sync read slice on staging, but not full provider workflow parity:
- the governed V8 slice now covers connected-app inventory roster, auth credential rollup, active auth escalations, unresolved sync conflicts, and per-connector governed health truth from the live `Integrations Hub`
- provider connect/disconnect, run-now, pause/resume, OAuth round-trip, and broader connector workflow still rely on legacy sync-hub mutations
- this capture proves browser continuity for governed inventory reads, not full sync workflow parity

Conclusion:
- Sync continuity now extends from operator health cards into the live `Connected Apps` inventory roster through `/api/v8/sync/integrations`
- remaining gap is legacy mutation/OAuth/provider workflow parity, not absence of a staged V8 inventory path on the operator-facing Sync surface
