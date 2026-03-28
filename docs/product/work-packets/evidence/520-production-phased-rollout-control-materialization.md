# 520 - production phased rollout control materialization

Date: 2026-03-28
Owner: Manager Agent
Scope: wider-production phased rollout execution
Status: complete

## What changed

- inspected the live production `v8.v8_feature_flags` table and confirmed it had no per-org rows materialized
- confirmed that production env still had `ENABLE_V8_GLOBAL=true` and `ENABLE_V8_SHADOW_MODE=true`
- identified the resulting rollout-control gap: with no org rows, the backend gate and shadow-mode logic defaulted to implicit allow behavior
- materialized explicit production org rows in `v8.v8_feature_flags`
- promoted `dbr77` as the first explicit production org with all current V8 modules enabled
- set `shadow_mode=0` for `dbr77` so the org now runs as the first explicit primary-V8 org instead of remaining on implicit shadow-on defaults
- explicitly disabled all current V8 modules plus `shadow_mode` for `ateliertoys-demo` and `system`
- hardened the code path so production no longer treats `no rows` as implicit V8/shadow allow for future tenants
- deployed the code hardening to Railway production deployment `3e1f726b-ebcd-44fc-90d6-f7144d5480b4`

## Verification

Production readback completed through both DB and authenticated app paths:

1. production env readback confirmed:
   - `ENABLE_V8_GLOBAL=true`
   - `ENABLE_V8_SHADOW_MODE=true`
2. production DB readback before mutation showed `v8.v8_feature_flags` was empty
3. production DB readback after mutation showed:
   - `dbr77`: all V8 modules enabled, `shadow_mode=0`
   - `ateliertoys-demo`: all V8 modules disabled, `shadow_mode=0`
   - `system`: all V8 modules disabled, `shadow_mode=0`
4. authenticated user-path readback confirmed:
   - `admin@dbr77.com` -> `GET /api/v8/admin/flags` returned `200` with all V8 modules `true` and `shadow_mode=false`
   - `admin@dbr77.com` -> `GET /api/v8/planning/pending-decisions` returned `200`
   - `anna.zielinska@ateliertoys-demo.com` -> `GET /api/v8/admin/flags` returned `200` with all V8 modules `false`
   - `anna.zielinska@ateliertoys-demo.com` -> `GET /api/v8/planning/pending-decisions` returned `404 V8_ORG_DISABLED`
5. local regression for the code hardening passed:
   - `npx vitest run "server/src/services/v8/__tests__/featureFlagService.test.ts"`
6. production deploy readback confirmed:
   - Railway service `consultify` in `production` reached `SUCCESS` on deployment `3e1f726b-ebcd-44fc-90d6-f7144d5480b4`
   - `GET https://consultify.ai/ping` returned `200`
7. post-deploy authenticated user-path readback remained green:
   - `admin@dbr77.com` still received `200` on `GET /api/v8/admin/flags`
   - `admin@dbr77.com` still received `200` on `GET /api/v8/planning/pending-decisions`
   - `anna.zielinska@ateliertoys-demo.com` still received `404 V8_ORG_DISABLED` on `GET /api/v8/planning/pending-decisions`

Additional note:

- `npx vitest run "server/src/routes/v8/__tests__/v8-auth-integration.test.ts"` failed on an unrelated jsdom/import issue in `KnowledgeIndexer`, not on the rollout-control changes

## Result

The phased rollout posture recorded in `evidence/519-wider-production-go-no-go-decision.md` is now materially enforced on production instead of relying on implicit empty-row behavior.

Current live rollout map:

- `dbr77` = explicit first promoted org, V8 primary, shadow disabled
- `ateliertoys-demo` = explicit not-yet-promoted org, V8 disabled
- `system` = explicit not-yet-promoted org, V8 disabled

## Follow-on rule

Any future org promotion must now materialize explicit production rows before that org is treated as V8-enabled.
