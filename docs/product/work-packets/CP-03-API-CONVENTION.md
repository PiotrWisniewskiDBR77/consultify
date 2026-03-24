# CP-03 — V8 API Convention

## URL Pattern

```
/api/v8/<domain>/<resource>
```

All V8 endpoints live under the `/api/v8/` namespace, mounted via the V8 aggregator router in `Gateway.ts`.

## Authentication

All routes use `verifyToken` (JWT verification middleware). The authenticated user is available on `req.user` and the organization context on `req.organizationId`.

## Organization Context

Organization ID is extracted from the JWT payload (`req.organizationId`). Routes that require org context must validate its presence and return `400 MISSING_ORG` if absent.

## Feature Gate

All `/api/v8/*` routes are behind the `v8FeatureGate` middleware. Currently checks `ENABLE_V8_GLOBAL=true` env var. CP-05 will upgrade this to per-org/per-module gating.

## Response Envelope

### Success

```json
{
  "data": { ... },
  "meta": { "version": "v8", ... }
}
```

### Error

```json
{
  "error": "Human-readable message",
  "code": "MACHINE_READABLE_CODE",
  "details": {}
}
```

## Standard Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `V8_DISABLED` | 404 | V8 feature gate is off |
| `MISSING_ORG` | 400 | No organization context in JWT |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions |

## Adding a New V8 Domain Route

1. Create `server/src/routes/v8/<domain>.routes.ts` following the `health.routes.ts` pattern.
2. Register it in `server/src/routes/v8/index.ts` via `v8Router.use('/<domain>', domainRoutes)`.
3. No changes needed in `Gateway.ts` — the aggregator handles sub-routing.

## File Structure

```
server/src/
├── middleware/
│   └── v8FeatureGate.middleware.ts   # Global V8 gate
├── routes/v8/
│   ├── index.ts                      # V8 router aggregator
│   └── health.routes.ts              # Health & readiness endpoints
└── services/v8/
    └── platformHealthService.ts      # Health service (pre-existing)
```
