# 490 - production auth guard deploy and readiness residual

Date: 2026-03-28
Owner: Manager Agent
Scope: production deploy readback after auth-surface hardening

Superseded status note:

This evidence remains historically accurate for the moment it was captured, but its blocker conclusion was later superseded by:

- `evidence/518-production-credential-hygiene-closure.md`
- `evidence/519-wider-production-go-no-go-decision.md`

## What changed

- removed production availability of the hidden `AuthView` quick-access login backdoor while preserving local / staging availability
- added focused regression coverage for the host guard in `tests/components/AuthView.quick-access-guard.test.tsx`
- deployed the current local source to Railway production for service `consultify`
- verified Railway production deployment `091e7bd5-657e-4bd5-9421-b96d5c10ebe4` reached `SUCCESS`
- verified public production runtime readback with `GET https://consultify.ai/ping -> 200`

## Verification

- `npm exec vitest run tests/components/AuthView.quick-access-guard.test.tsx server/src/routes/__tests__/settings.routes.test.ts`
- `railway up --service consultify --environment production --ci`
- `railway service status --service consultify --environment production --json`
- `curl -i https://consultify.ai/ping`

## Result

The production deployment is healthy and now includes:

- governed settings `config` continuity,
- governed settings `refresh` / reauth continuity,
- and the production host guard that disables the hidden quick-access backdoor on the live auth surface.

## Remaining readiness residual

Production readiness is still not honest `100% ready` yet.

During live production authentication checking, a weak known credential was still accepted for a production superadmin account. The quick-access UI backdoor is now removed from production, but credential hygiene on the live account set still requires operational cleanup and rotation before wider promotion can be treated as fully ready.

At the time of this deploy readback, this was a real go-live blocker alongside the still-open shadow observation window.

## Later same-day status note

The shadow observation blocker referenced above was later closed in `evidence/491-v8-production-pilot-shadow-readiness-green.md`.

Current truth after that later production observation update:

- rollout telemetry is no longer the blocker,
- credential hygiene remains the remaining blocker for an honest wider production go decision.

This later same-day status note is itself no longer the final state:

- credential hygiene was later closed in `evidence/518-production-credential-hygiene-closure.md`
- the final wider-production authority is `evidence/519-wider-production-go-no-go-decision.md`
