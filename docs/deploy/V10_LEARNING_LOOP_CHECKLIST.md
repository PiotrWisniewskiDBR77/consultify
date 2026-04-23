## V10 Learning Loop (2) — deployment checklist

This checklist covers the Learning Loop subsystem: feedback submission, retention preview,
stewardship queue, adaptive coverage, quality dashboard, and drift/incidents.

### Database migrations (server)

- Apply: `server/migrations/755_v10_learning_loop_tables.sql`
  - Creates:
    - `v10_learning_feedback`
    - `v10_learning_retention_previews`
    - `v10_learning_stewardship_queue`
    - `v10_learning_incidents`
  - Adds org-scoped indexes for dashboard/queue queries.

### Feature flags (frontend)

Admin UI is currently exposed via the same enablement used for Learning pipelines:

- **Learning pipelines (Admin panel visibility)**: `VITE_PIPELINES_LEARNING_FEEDBACK_PIPELINE=1`

### Telemetry flags (frontend)

Learning Loop events are gated behind the existing learning telemetry flag:

- **Learning telemetry**: `VITE_LEARNING_TELEMETRY=1`
  - Includes `learning_runtime_*` and `learning_loop_*` events.

### Routing / API

Endpoints live under `/api/v10/learning-loop/*` (server).

- **Auth**: requires authenticated user + org context.
- **RBAC**: **admin-only** (server-side `requireRole('admin')`).

Key endpoints:

- `POST /api/v10/learning-loop/feedback/submit`
- `POST /api/v10/learning-loop/retention/preview`
- `GET /api/v10/learning-loop/stewardship/queue`
- `POST /api/v10/learning-loop/stewardship/:itemId/resolve`
- `GET /api/v10/learning-loop/quality/dashboard`
- `GET /api/v10/learning-loop/coverage/summary`
- `POST /api/v10/learning-loop/incidents/report`
- `GET /api/v10/learning-loop/incidents`

### Smoke tests (local → staging/prod)

- **Admin UI**
  - Open Admin → AI Module → Chat V10 → Learning Loop.
  - Submit feedback with rating 5 (should succeed, no stewardship item).
  - Submit feedback with rating 1 (should succeed and enqueue stewardship item).
  - Retention preview with text containing email (e.g. `test@example.com`) should return `retain=false` and enqueue stewardship item.
  - Load stewardship queue and resolve one open item.
  - Load dashboard and confirm metrics reflect the actions above.
  - Report a drift/incident and confirm it appears under incidents and produces a stewardship item.

- **Telemetry invariants**
  - `npx vitest run src/utils/__tests__/chatV10FeatureFlags.test.ts`

- **Learning loop tests**
  - `npx vitest run server/src/services/v10/learning/__tests__/learningLoopService.test.ts`
  - `npx vitest run server/src/routes/v10/__tests__/learning-loop.routes.test.ts`

### Rollback plan

- Flip telemetry off: unset `VITE_LEARNING_TELEMETRY` (or set to `0`).
- Hide admin UI: unset `VITE_PIPELINES_LEARNING_FEEDBACK_PIPELINE`.
- Data remains in DB tables (no destructive rollback required).

