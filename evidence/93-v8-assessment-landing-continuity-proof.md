## V8 Assessment Landing Continuity Proof

Date: 2026-03-26
Surface: `https://stage.consultinity.ai/assessment?ts=1774602300`
Deployment: `0f71289e-41ca-4117-b0a4-4efb7029714b` (`SUCCESS`)

### What changed

The assessment landing no longer hard-fails into the dead-end `Retry` screen when staging request pressure is present.

The bounded fix deployed in this wave:

- keeps the landing usable under transient assessment-list pressure
- uses the shared V8-preferring assessment list client in the table surface
- makes the landing `New Assessment` path prefer the bounded V8 create route before any legacy fallback

### Live browser proof

Fresh reload of `/assessment` on staging rendered the normal hub shell instead of the prior dead-end error state.

Visible live elements after reload:

- `Assessment`
- `Reports`
- `Initiatives`
- `All 7`
- `Table`
- `Grid`
- `New Assessment`

The prior dead-end elements were no longer present in the refreshed live snapshot:

- no `Retry` button
- no `Too many requests, please try again later.`

### Live network proof

The same fresh reload produced successful reads:

- `GET /api/v8/assessment?limit=200&offset=0` -> `200`
- `GET /api/assessment-reports` -> `200`
- `GET /api/initiatives?source=assessment` -> `200`
- `GET /api/report-import` -> `200`

Additional app-shell requests that had previously contributed noise also settled green in the same capture:

- `GET /api/v8/admin/flags` -> `200`
- `GET /api/organization/policy-snapshot` -> `200`
- `GET /api/projects/project-dbr77-demo-all-modules/ai-role` -> `200`
- `GET /api/tasks?...` -> `200`
- `GET /api/notifications?limit=20` -> `200`

### Operational conclusion

The assessment landing continuity blocker under staging limiter pressure is closed.

`C-04` is still not closure-ready because opening the full assessment session/editor continues to rely on legacy `assessment-workflow-v2` session reads and writes outside the bounded V8 landing bridge.
