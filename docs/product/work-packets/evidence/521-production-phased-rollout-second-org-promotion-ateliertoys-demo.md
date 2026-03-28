# 521 - production phased rollout second org promotion: ateliertoys-demo

Date: 2026-03-28
Owner: Manager Agent
Scope: wider-production phased rollout execution
Status: complete

## What changed

- used the explicit per-org production control introduced in `evidence/520-production-phased-rollout-control-materialization.md`
- promoted `ateliertoys-demo` as the second explicit production org with all current V8 modules enabled
- kept `shadow_mode=0` for `ateliertoys-demo` so the org now runs in the same primary-V8 posture as `dbr77`
- left `system` explicitly disabled so rollout remains phased rather than broad-on
- made no code-path or env changes; this step was a bounded production control mutation only

## Verification

Production readback completed through both DB and authenticated app paths:

1. production DB readback before mutation showed `ateliertoys-demo` still had all current V8 modules disabled and `shadow_mode=0`
2. production DB readback after mutation showed `ateliertoys-demo` with:
   - all current V8 modules enabled
   - `shadow_mode=0`
3. authenticated user-path readback confirmed:
   - `admin@dbr77.com` -> `GET /api/v8/admin/flags` returned `200` with all V8 modules `true` and `shadow_mode=false`
   - `admin@dbr77.com` -> `GET /api/v8/planning/pending-decisions` returned `200`
   - `anna.zielinska@ateliertoys-demo.com` -> `GET /api/v8/admin/flags` returned `200` with all V8 modules `true` and `shadow_mode=false`
   - `anna.zielinska@ateliertoys-demo.com` -> `GET /api/v8/planning/pending-decisions` returned `200`
4. live rollout map after the promotion is now:
   - `dbr77` = explicit promoted org, V8 primary, `shadow_mode=0`
   - `ateliertoys-demo` = explicit promoted org, V8 primary, `shadow_mode=0`
   - `system` = explicit not-yet-promoted org, V8 disabled

## Result

The wider-production rollout remains under explicit per-org control, but it now covers two promoted orgs instead of one. This extends real production usage without reintroducing the earlier implicit broad-on risk.

## Follow-on rule

Keep the `48h` post-promotion monitoring rule from `CP-10`, and do not promote any additional org until the current promoted set remains healthy under that window.
