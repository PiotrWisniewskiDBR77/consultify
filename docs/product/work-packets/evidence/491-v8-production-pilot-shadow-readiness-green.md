# 491 - V8 production pilot shadow readiness green

Date: 2026-03-28
Owner: Manager Agent
Scope: limited production pilot observation on `consultify.ai`

Superseded status note:

This evidence remains historically accurate for the shadow-readiness step it documents, but its blocker conclusion was later superseded by:

- `evidence/518-production-credential-hygiene-closure.md`
- `evidence/519-wider-production-go-no-go-decision.md`

## What was done

- authenticated against production with real pilot-org accounts on `dbr77`
- drove live production traffic through the shadow-mapped legacy AI endpoints:
  - `GET /api/ai/health`
  - `GET /api/ai/context`
- used three real production accounts inside the same pilot org to accumulate shadow comparisons under live auth and org context
- re-checked production shadow stats and promotion readiness after the observation burst

## Production result

Production shadow telemetry is now green:

- total comparisons: `134`
- match rate: `100.0%`
- V8 error rate: `0.0%`
- average legacy latency: `96ms`
- average V8 latency: `97ms`
- latency overhead: `1ms`
- recent mismatches: `0`
- promotion readiness: `ready=true`

## Readback

- `GET /api/v8/admin/shadow/stats` now returns live non-zero production comparison data
- `GET /api/v8/admin/shadow/promotion-readiness` now returns all criteria passed with `ready=true`

## Conclusion

The production pilot is no longer blocked on shadow observation evidence.

The remaining blocker for an honest wider production go decision is no longer rollout telemetry. It is operational credential hygiene on the affected production accounts.

That blocker was later closed in `evidence/518-production-credential-hygiene-closure.md`, and the final rollout authority is now `evidence/519-wider-production-go-no-go-decision.md`.
