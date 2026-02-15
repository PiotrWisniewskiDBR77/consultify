# L4 (E2E / Playwright) readiness – audit

## Scope

This project has two Playwright test trees:

- `tests/e2e/` (Playwright `testDir`)
- `e2e/` (additional Playwright specs not picked up by default config)

## Hard numbers (static scan)

- Playwright spec files (under `tests/e2e/` + `e2e/`): **117**
- Skip calls (`test.skip(...)`): **6**
- Low-signal marker `expect(true).toBe(true)`: **0**

## Execution model (why this matters)

`playwright.config.ts` will **not** start web servers by default. Server startup is behind:

- `E2E_USE_WEB_SERVER=true`

If it is not enabled, the tests assume an already-running environment:

- Frontend: `E2E_BASE_URL` (default: `http://localhost:3000`)
- Backend: `E2E_API_URL` (default: `http://127.0.0.1:3001`)

## Current risks / honesty gaps

- Some tests are conditionally skipped when the environment is missing seed data (e.g. no projects). These are now skipped with an explicit reason so the report is honest.
- Running `E2E_USE_WEB_SERVER=true` starts the backend via `tsx` (`npx tsx src/index.ts`). In constrained sandboxes this can fail because `tsx` creates an IPC server (requires `listen()` on a pipe).

## Recommendations

- CI: run L4 with a deterministic environment:
  - Either `E2E_USE_WEB_SERVER=true` in an environment that allows `listen()`, or
  - Point `E2E_BASE_URL` + `E2E_API_URL` at a known test deployment.
- Keep `test.skip(...)` only for truly external dependencies (Stripe etc.), always with a reason.
