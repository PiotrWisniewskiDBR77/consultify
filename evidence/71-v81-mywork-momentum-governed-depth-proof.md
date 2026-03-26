# V8.1 MyWork Home - Momentum governed depth proof

- Date: 2026-03-25
- Environment: `staging`
- Deployment: `5b275183-f030-4de0-ae10-7b9687e6926c`
- Packet: `C-02i residual Home maturity hardening`
- Focus: promote `momentum` from `partial_stitched` to `backed_by_real_service`

## What changed

`Momentum` no longer derives its visible Home truth primarily from stitched `ideas/tasks/decisions` narrative.

The block now surfaces governed runtime truth from existing V8 services already wired into `GET /api/my-work/home/v2`:

- `executionVisibilityService.rollupSignals(orgId, from, to)` -> execution movement / dominant signal pattern
- `planningContinuityService.getPendingDecisions(orgId)` -> governed pending decision chains and step counts
- `inboxService.getInboxStats(userId, orgId)` -> pending inbox load and SLA pressure

This keeps the same Home V2 surface and chat CTA contract, but replaces the stitched momentum framing with governed execution / planning / follow-through rails.

## Local proof

- Targeted regressions passed:
  - `tests/integration/routes/v8.my-work.routes.test.ts`
  - `tests/components/MyWork/HomeView.outputs.test.tsx`
- Roof expectations now read `7 backed_by_real_service / 1 partial_stitched / 0 placeholder_non_canonical`.
- `momentum` is now classified as `backed_by_real_service` in the governed roof summary defaults.

## Live staging proof

Authenticated browser proof was refreshed on:

- `https://stage.consultinity.ai/my-work?ts=1774478090`

Observed on the live Home surface:

- roof banner search matched exactly:
  - `Roof truth: Home V2 aggregated + outputs bridge · 7 real · 1 partial · 0 non-canonical`
- `Momentum` heading and governed copy were visible in the live DOM:
  - `Follow-through is waiting in the inbox.`
  - `265 pending inbox items and 0 at-risk SLA items show where follow-through can weaken momentum even without new decisions.`
  - `Decision throughput is currently clean`
  - `The planning spine is not currently reporting governed pending chains, which creates space to convert movement into commitment.`
  - `The execution lane is currently quiet`

Supporting browser evidence:

- `browser_search("Roof truth: Home V2 aggregated + outputs bridge · 7 real · 1 partial · 0 non-canonical")` -> `1 visible match`
- `browser_search("Follow-through is waiting in the inbox.")` -> `1 visible match`
- `browser_search("Decision throughput is currently clean")` -> `1 visible match`

Supporting network continuity from the same fresh load:

- `GET /api/v8/my-work/roof/summary` -> `200`
- `GET /api/my-work/home/v2` -> `200`

## Closure impact

`momentum` is now staging-proven as a governed Home V2 block.

Residual `C-02i` Home maturity gap narrows to:

- `sparkField`
