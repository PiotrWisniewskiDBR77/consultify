# 486 - V8 production pilot bootstrap and runtime readback

Date: 2026-03-28
Owner: Manager Agent
Scope: limited production pilot bootstrap for `consultify.ai`

## Problem

Production pilot rollout was blocked by a stack of runtime prerequisites:

- the production `v8` schema was still missing the latest `V8.1` artifact tables,
- the first local-source production deploy failed Railway healthcheck because `ENCRYPTION_SALT` was not present in the production environment,
- and the previously running production image still exposed stale runtime behavior (`V8_DISABLED` / UUID-only org flag parsing and legacy notification / provider-health seams).

## What changed

1. Applied the production `v8` schema migrations against the public Railway Postgres target:
   - `npx tsx server/scripts/v8-migrate.ts --apply`
   - `npx tsx server/scripts/v8-migrate.ts --verify`
2. Confirmed `v8` verification reached parity:
   - expected tables `122`
   - actual tables `122`
   - verification `PASS`
3. Set missing production runtime input:
   - `ENCRYPTION_SALT=f088944e441e489ca4258093b24dc737efd07c6194e2b291979ce85f4a1d04a8`
4. Deployed the current local source to Railway production with the V8 rollout fixes.
5. Verified production runtime readback after the successful deploy.

## Production readback

- `GET /api/v8/admin/flags` -> `200`
- `GET /api/v8/health` -> `200`
- `GET /api/notifications/unread-count` -> `200`
- `GET /api/notifications?limit=20` -> `200`
- `GET /api/llm/providers/health` -> `200`
- `GET /api/v8/admin/shadow/stats` -> `200`
- `GET /api/v8/admin/shadow/promotion-readiness` -> `200`

Notable payload facts:

- `admin/flags` returned V8 meta for `organizationId: "dbr77"` without the earlier UUID failure
- `v8/health` returned overall `healthy`
- `notifications` endpoints no longer returned the earlier `user_sessions.is_active` / `snoozed_until` production errors
- `llm/providers/health` returned `overall: "healthy"`

## Current pilot state

Production pilot bootstrap is now live, but promotion readiness is not yet satisfied:

- shadow comparisons: `0`
- match rate: `0.0%`
- V8 error rate: `0.0%`
- readiness verdict: `ready=false`
- failing criteria:
  - minimum `100` comparisons
  - match rate `>= 95%`

## Residual

The hard blocker is no longer deployment or schema bootstrap. The remaining work is operational observation:

- drive real internal pilot traffic through the production pilot org,
- accumulate shadow comparisons,
- re-check promotion readiness after the observation window,
- only then decide on wider production promotion.
