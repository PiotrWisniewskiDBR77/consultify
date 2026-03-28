# 484 - V8 staging live gates and rollback proof

Date: 2026-03-27
Scope: staging-only rollout readiness evidence
Status: landed

## Why this packet existed

The rollout docs were still missing authoritative staging proof for the core live gates:

- authenticated V8 health and smoke on the deployed staging server,
- frontend proof that the staging UI really calls `/api/v8/*`,
- real-db V8 harness execution against the staging-compatible Postgres target,
- rollback / flag-off behavior exercised on staging rather than just documented.

Without this evidence, the rollout narrative could still claim readiness based on code wiring instead of live infrastructure behavior.

## What changed

- redeployed staging from the current workspace and fixed the Railway runtime image so table-platform SQL migrations are copied into the container from `Dockerfile.api`
- executed authenticated staging V8 probes with the seeded `admin@dbr77.com` superadmin
- re-ran the full V8 smoke harness after the deployment stabilized and confirmed `29 / 29` staging checks passed
- executed the real-db V8 compatibility harness against the public staging Postgres target and confirmed `14 / 14` tests passed
- captured frontend proof with headless Playwright against `https://stage.consultinity.ai`, observing real browser requests to:
  - `/api/v8/admin/flags` → `200`
  - `/api/v8/finance/dashboard` → `200`
  - `/api/v8/finance/statement-packs` → `200`
- exercised a live per-org rollback drill by setting all `dbr77` V8 flags to `false`, confirming `/api/v8/planning/pending-decisions` returned `404 V8_ORG_DISABLED`, then restoring flags and confirming the same endpoint returned `200`

## Verification

- `cd server && DATABASE_PUBLIC_URL=<staging-public-postgres> ENABLE_V8_GLOBAL=true ENABLE_V8_SHADOW_MODE=true npx tsx scripts/v8-deploy.ts --check`
- `cd server && DATABASE_PUBLIC_URL=<staging-public-postgres> npm run test:v8-db`
- authenticated curl checks on:
  - `/api/v8/health`
  - `/api/v8/health/readiness`
  - `/api/v8/admin/flags`
  - `/api/v8/admin/health`
- `cd server && npx tsx scripts/v8-smoke-test.ts --url https://stage.consultinity.ai --token <staging-superadmin-jwt> --json`
- headless Playwright browser proof against `https://stage.consultinity.ai`
- staging per-org flag-off / restore drill against `dbr77`

## Result

The rollout no longer lacks live staging proof for authenticated health, readiness, admin, smoke, frontend V8 traffic, or per-org flag-off rollback behavior.

Staging evidence is now materially stronger than the older "code is wired but unproven" state.

## Remaining residual

- non-V8 confidence is still not fully green: `npm run verify:quick` aborted during `npm run lint` with `Abort trap: 6`, so the quick confidence gate still needs separate stabilization
- pilot / production are still blocked on real shadow observation and promotion monitoring, not on raw staging smoke anymore
- a table-platform migration idempotency issue around `710_interfaces.sql` was detected during staging startup and patched locally; the follow-up deploy confirmation should be read back separately
