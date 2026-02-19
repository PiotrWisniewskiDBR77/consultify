# L4 “Test Deployment” contract (remote-only, external DB)

This document defines the **required** contract for running the L4 Playwright smoke suite (`tests/e2e/smoke/**`) against a **dedicated test deployment** that uses an **external DB** (Postgres).

It exists to prevent “metric gaming” (local SQLite / demo tenants / shared fixed identities) and to make the L4 gate deterministic and production-like.

## Non‑negotiables

- L4 runs **remote-only** in CI: `E2E_USE_WEB_SERVER=false`
- Backend in the test deployment must use an **external DB** (Postgres). Local file DB (SQLite) is **not** accepted for CI L4.
- Isolation model: **tenant-per-run**
- Cleanup: deterministic and scoped to the tenant created for that run
- **Test-support endpoints** are allowed, but must be:
  - enabled only when `NODE_ENV=test` **and** `ENABLE_TEST_SUPPORT=true`
  - protected by `x-test-support-key` matching `TEST_SUPPORT_KEY`
  - impossible to enable/call in production

## Required environment variables (CI runner)

These are used by Playwright (the CI runner) to point at the remote environment:

- `E2E_USE_WEB_SERVER=false`
- `E2E_BASE_URL` — frontend base URL for the test deployment (e.g. `https://test.example.com`)
- `E2E_API_URL` — backend API base URL for the test deployment (e.g. `https://test-api.example.com`)
- `TEST_SUPPORT_KEY` — secret key for calling test-support endpoints
- Optional: `E2E_RUN_ID` — if set, becomes the tenant/run identifier (otherwise derived from GitHub run metadata)

## Required server-side configuration (test deployment)

These must be set on the deployed backend (not on the CI runner):

- `NODE_ENV=test`
- `ENABLE_TEST_SUPPORT=true`
- `TEST_SUPPORT_KEY` (same secret as in CI)
- External DB configuration:
  - `DB_TYPE=postgres` and `DATABASE_URL=...` (required)

## Tenant-per-run bootstrap/cleanup protocol

The smoke suite uses the guarded endpoints in `server/src/routes/testSupport.routes.ts`:

- `POST /api/test-support/bootstrap` with `{ runId }`
  - Creates a unique organization + admin user for the run (if not already created)
  - Returns `{ organizationId, userId, token }`
- `POST /api/test-support/cleanup` with `{ runId }`
  - Purges data by `organization_id` and deletes the org + user

All test data created during L4 must be scoped to the returned `organizationId`.

## What “external DB” means here

- The backend must connect to Postgres via `DATABASE_URL`
- The DB must be persistent across requests and shared across backend instances (no local file / ephemeral per-instance state)

## Failure modes (expected)

- If the deployment is missing required config, L4 may fail fast:
  - Playwright will error in CI if `E2E_API_URL` / `E2E_BASE_URL` are not set for remote-only mode.
  - If test-support is disabled or mis-keyed, bootstrap/cleanup calls will return `404` to avoid leaking capabilities.

