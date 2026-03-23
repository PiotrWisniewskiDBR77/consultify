# CP-04 — V8 Auth Integration Layer

## Auth Contract

All V8 API routes (`/api/v8/*`) enforce a layered authentication and authorization chain. No V8 endpoint is accessible without passing every gate in sequence.

### Middleware Chain (order matters)

```
Request
  → v8FeatureGate          (Gateway.ts — checks ENABLE_V8_GLOBAL + per-org V8 enablement)
  → verifyToken            (v8 router — JWT verification, attaches req.user / req.organizationId)
  → requireV8OrgContext    (v8 router — rejects 403 if no organizationId)
  → attachV8Context        (v8 router — attaches V8RequestContext to req.v8Context)
  → [route-level guards]   (e.g. requireSuperAdmin on admin routes)
  → route handler
```

### Gate Details

| Gate | Source | Failure Code | HTTP Status |
|---|---|---|---|
| V8 global flag | `v8FeatureGate` | `V8_DISABLED` | 404 |
| V8 per-org flag | `v8FeatureGate` | `V8_ORG_DISABLED` | 404 |
| JWT verification | `verifyToken` | — | 401 |
| Org context | `requireV8OrgContext` | `V8_MISSING_ORG_CONTEXT` | 403 |
| Super admin | `requireSuperAdmin` | — | 403 |

### V8 Request Context

After the middleware chain, every V8 route handler can access `req.v8Context`:

```typescript
interface V8RequestContext {
  organizationId: string;   // from JWT
  userId: string;           // from JWT
  userRole: string;         // from JWT
  isSuperAdmin: boolean;    // from user record
}
```

Use `getV8Context(req)` helper from `v8Auth.middleware.ts` to extract it with runtime validation.

### Key Rules

1. **All V8 routes require JWT authentication** — `verifyToken` is applied at the V8 router level, not per-route.
2. **All V8 routes require organization context** — `requireV8OrgContext` rejects requests without `req.organizationId`.
3. **V8 context is always available** — `attachV8Context` runs on every V8 request; handlers can rely on `req.v8Context`.
4. **Admin routes require superadmin** — Routes under `/api/v8/admin/*` additionally use `requireSuperAdmin`.
5. **Feature gate is the first check** — `v8FeatureGate` runs before auth (in Gateway.ts), so disabled V8 returns 404 even for authenticated users.
6. **No double-auth** — Individual route files must NOT apply `verifyToken` themselves; it runs once at the router level.

### Files

| File | Role |
|---|---|
| `server/src/middleware/v8Auth.middleware.ts` | V8-specific auth utilities (requireV8OrgContext, attachV8Context, getV8Context) |
| `server/src/middleware/v8FeatureGate.middleware.ts` | Per-org V8 feature gate |
| `server/src/middleware/auth.middleware.ts` | Core auth (verifyToken, requireSuperAdmin) — NOT modified by CP-04 |
| `server/src/routes/v8/index.ts` | V8 router — applies auth chain to all sub-routes |
| `server/src/routes/v8/__tests__/v8-auth-integration.test.ts` | Integration tests for the auth flow |
