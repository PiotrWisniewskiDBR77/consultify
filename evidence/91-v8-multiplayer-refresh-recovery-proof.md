Date: 2026-03-26

Environment:
- staging (`https://stage.consultinity.ai`)
- service `consultify`
- active route `Admin -> Integrations -> Sync Health`

## Scope

Follow up `B-14e` after the earlier staging rate-limit blocker to determine whether the live governed multiplayer slice is still hard-blocked on staging or whether the same operator surface can recover enough to prove the persisted V8 read bridge again.

## Live staging proof

Authenticated browser session:
- route: `https://stage.consultinity.ai/admin?tab=integrations`
- authenticated admin DBR77 session

Initial unstable pass on the live `Sync Health` surface:
- the browser could switch to `Sync Health`
- the page still showed only the top-level hub shell plus generic `No integrations connected`
- the first request wave returned widespread transient `429` responses, including:
  - `GET /api/v8/multiplayer/resource-mappings/workspace`
  - `GET /api/v8/multiplayer/room-binding?resourceType=workspace&resourceId=dbr77`
  - `GET /api/v8/sync/integrations`
  - `GET /api/v8/sync/auth/health`
  - `GET /api/v8/sync/auth/escalations`
  - `GET /api/v8/sync/conflicts?limit=10`
  - legacy `GET /api/sync-hub/health`

Manual recovery step from the same live operator surface:
- clicking the in-surface `Refresh` action re-ran the governed and legacy health fetches
- after the refresh, the governed V8 multiplayer reads recovered to `200` on the same staging session:
  - `GET /api/v8/multiplayer/resource-mappings/workspace` -> `200`
  - `GET /api/v8/multiplayer/room-binding?resourceType=workspace&resourceId=dbr77` -> `200`
  - `GET /api/v8/multiplayer/rooms/dbr77/presence` -> `200`
  - `GET /api/v8/multiplayer/rooms/dbr77/locks` -> `200`
- the broader governed sync slice in the same refresh wave also recovered to `200`, including:
  - `GET /api/v8/sync/integrations`
  - `GET /api/v8/sync/conflicts?limit=10`
  - `GET /api/v8/sync/auth/health`
  - `GET /api/v8/sync/auth/escalations`
- legacy `GET /api/sync-hub/health` remained unhealthy at `503` even in the recovered wave

## Honest closure read

This is not websocket/live-collaboration closure.

It does prove that the staged governed multiplayer read bridge is not permanently blocked by the earlier `429` storm: the same `Admin -> Integrations -> Sync Health` operator path can recover and serve room mapping, room binding, presence, and active lock reads from `/api/v8/multiplayer/*`.

What remains unclosed:
- actual websocket transport / heartbeat behavior
- collaborative editing semantics
- broader user-facing collaboration continuity outside the admin read slice
- stable operator-visible rendering of the collaboration subsection during volatile staging refresh conditions, since this run still visually settled on the generic top-of-hub shell rather than a durable collaboration card readout
