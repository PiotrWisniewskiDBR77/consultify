# 485 - V8 staging shadow observation and promotion readiness

Date: 2026-03-28
Scope: staging shadow-mode operator evidence
Status: landed

## Why this packet existed

After the core staging smoke and rollback gates landed, the rollout was still blocked on one operational claim:

- that staging shadow mode records real comparisons,
- that operator diagnostics stay readable after live traffic,
- and that promotion-readiness can pass on real staging evidence rather than only on code-level tests.

Without this packet, the rollout could still say "shadow mode exists" while lacking proof that the monitoring loop actually works on the deployed service.

## What changed

- pushed the remaining table-platform startup fixes until staging TP migrations completed cleanly through `737_virtual_workers.sql`
- hardened `730_beta_schema_fixes.sql` and `730_partner_users_uuid_columns.sql` so legacy staging schemas no longer block service startup
- refined V8 shadow comparison semantics so coarse legacy `/api/ai/health` and `/api/ai/context` probes are compared honestly against their V8 equivalents
- normalized operator stats so historical coarse-route envelope differences no longer poison readiness results
- excluded synthetic legacy `429` rate-limit samples from promotion-readiness aggregates while still preserving them in the raw comparison feed
- exercised live staging shadow traffic for `dbr77` until the operator gate reached:
  - `102` comparable comparisons
  - `100.0%` match rate
  - `0.0%` V8 error rate
  - `49ms` average V8 latency overhead
  - `0` recent mismatches
- confirmed `GET /api/v8/admin/shadow/promotion-readiness` returned `ready: true` on staging

## Verification

- Railway staging deploys from the current workspace until runtime logs showed:
  - `TP Migrations] Complete: 8 applied, 33 already up to date (41 total)`
  - later steady-state readback: `TP Migrations] Complete: 0 applied, 41 already up to date (41 total)`
- focused local regression:
  - `npx vitest run server/src/services/v8/__tests__/shadowModeService.test.ts server/src/services/v8/__tests__/v8-shadow-integration.test.ts`
- authenticated staging shadow diagnostics:
  - `GET /api/v8/admin/shadow/stats`
  - `GET /api/v8/admin/shadow/comparisons?limit=<n>`
  - `GET /api/v8/admin/shadow/promotion-readiness`
- authenticated staging legacy traffic against:
  - `GET /api/ai/health`
  - `GET /api/ai/context`

## Result

Staging shadow observation is now proven on real infrastructure, not just in local tests.

The staging operator gate for shadow-mode promotion-readiness is green.

## Remaining residual

- non-V8 confidence is still not green enough for a full user-ready GO: repo-wide lint / type confidence still shows unrelated existing failures outside this packet
- pilot / canary promotion beyond staging still needs a real observation window and final approval; this packet only proves the staging shadow gate
- synthetic stress probes can still trigger legacy `429` rate limits, but those samples are now preserved in raw comparisons while excluded from promotion-readiness math
