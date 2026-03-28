# 522 - production post-promotion monitoring window open

Date: 2026-03-28
Owner: Manager Agent
Scope: wider-production phased rollout execution
Status: in progress

## Purpose

This evidence opens the mandatory `48h` post-promotion observation window after the second explicit production org promotion recorded in `evidence/521-production-phased-rollout-second-org-promotion-ateliertoys-demo.md`.

## Checkpoint at window start

Production runtime readback at the start of the monitoring window confirmed:

1. promoted-org end-user V8 path stayed green:
   - `admin@dbr77.com` -> `POST /api/auth/login` returned `200`
   - `admin@dbr77.com` -> `GET /api/v8/admin/flags` returned `200` with all current V8 modules `true` and `shadow_mode=false`
   - `admin@dbr77.com` -> `GET /api/v8/health` returned `200` with overall `healthy`
   - `admin@dbr77.com` -> `GET /api/v8/health/readiness` returned `200` with all reported domains ready
   - `admin@dbr77.com` -> `GET /api/v8/planning/pending-decisions` returned `200`
   - `anna.zielinska@ateliertoys-demo.com` -> `POST /api/auth/login` returned `200`
   - `anna.zielinska@ateliertoys-demo.com` -> `GET /api/v8/admin/flags` returned `200` with all current V8 modules `true` and `shadow_mode=false`
   - `anna.zielinska@ateliertoys-demo.com` -> `GET /api/v8/health` returned `200` with overall `healthy`
   - `anna.zielinska@ateliertoys-demo.com` -> `GET /api/v8/health/readiness` returned `200` with all reported domains ready
   - `anna.zielinska@ateliertoys-demo.com` -> `GET /api/v8/planning/pending-decisions` returned `200`
2. non-V8 seams remained healthy for both promoted orgs:
   - `GET /api/notifications/unread-count` returned `200`
   - `GET /api/notifications?limit=20` returned `200`
   - `GET /api/llm/providers/health` returned `200` with overall `healthy`
3. admin-level monitoring readback for the current production superadmin org context (`dbr77`) remained green:
   - `GET /api/v8/admin/health` returned `200` with overall `healthy`
   - `GET /api/v8/admin/metrics` returned `200` with `requests=9`, `errors=0`, `avgLatencyMs=34`
   - `GET /api/v8/admin/shadow/stats` returned `200` with `134` comparisons, `100%` match rate, `0.0%` V8 error rate, and `1ms` average latency overhead
   - `GET /api/v8/admin/shadow/promotion-readiness` returned `200` and remained fully green on all five criteria

## Current rollout state

- `dbr77` = explicit promoted org, V8 primary, `shadow_mode=0`
- `ateliertoys-demo` = explicit promoted org, V8 primary, `shadow_mode=0`
- `system` = explicit not-yet-promoted org, V8 disabled

## Operator note

The current V8 admin-monitoring endpoints are superadmin-gated and resolve org context from the authenticated user token. In the current production user map this provides direct admin-level readback for `dbr77`; `ateliertoys-demo` is currently covered by end-user/runtime path checks rather than a separate superadmin-scoped admin-health view.

## Rule in force

Do not promote any additional org during this open observation window unless the current promoted set is first shown to be degraded and the action is a rollback rather than a further rollout expansion.

## Repeatable operator path

The observation window can now be re-checked with:

`npm run rollout:v8:monitor -- --json`

The script uses the current promoted-user defaults, logs in through the existing macOS Keychain credential store, replays the same runtime/admin/non-V8 checkpoint sequence captured in this evidence, and auto-saves a machine-readable JSON artefact under `server/exports/` for each rerun.

Latest saved checkpoint artefact:

- `server/exports/v8-rollout-monitor-2026-03-28T09-14-27-513Z.json`

Manual-test operator support:

- `docs/product/work-packets/MANUAL_TEST_RUNBOOK_2026-03-28.md`
