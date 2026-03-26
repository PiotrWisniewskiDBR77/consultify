# 68 - V8.1 MyWork roof WP-W7 depth proof

Date: 2026-03-25
Deployment: `430a65f1-c74a-4cfc-b341-d035978fc26c`
Surface: `https://stage.consultinity.ai/my-work`

## What changed

This proof captures the next bounded `MyWork roof` hardening step after the aggregated Home V2 cutover:

- `executionCurrent` is now derived as `backed_by_real_service` in the roof summary because `GET /api/my-work/home/v2` reads governed execution depth from `executionVisibilityService.rollupSignals(...)` alongside the existing outputs bridge.
- `teamSignal` is now derived as `backed_by_real_service` in the roof summary because `GET /api/my-work/home/v2` reads governed collaboration depth from `collaborationRoomService.getActiveRoomsByOrg(...)` and `getRoomHealth(...)`.

## Live staging proof

1. Deployment health
   - `GET https://stage.consultinity.ai/ping` -> `200` (`pong`)
   - `GET https://stage.consultinity.ai/api/health` -> `200`

2. Authenticated My Work runtime
   - Fresh authenticated browser load of `/my-work` requested:
     - `GET /api/v8/my-work/roof/summary` -> `200`
     - `GET /api/my-work/home/v2` -> `200`
   - Live bundle after cutover was the new `index-CQ_djmmG.js` / `HomeView-urg-OuXG.js` asset set on staging.

3. Visible roof truth
   - The live Home roof banner now reads:
     - `Roof truth: Home V2 aggregated + outputs bridge · 4 real · 4 partial · 0 non-canonical`
   - This is the staging-visible confirmation that the derived roof truth moved from `2 real / 6 partial` to `4 real / 4 partial`.

4. Visible collaboration depth
   - The live `Team Signal` block now surfaces the new collaboration readout card:
     - `Collaboration substrate is quiet right now`
     - `No active collaboration rooms are currently bound to this organization, so alignment still depends mostly on narrative and decision rhythm.`
   - This proves the block is now reading collaboration substrate truth instead of remaining purely narrative scaffolding.

## Current residual

- The roof is still `yellow`, but no longer for placeholder/non-canonical reasons.
- Remaining `partial_stitched` blocks are the non-Radar narrative blocks that still do not have equivalent dedicated governed depth:
  - `momentum`
  - `sparkField`
  - `decisionTemperature`
  - `commandDock`
- On this tenant snapshot, `Execution Current` did not render a dedicated execution-signal line item on the surface, which is consistent with an empty/light recent governed signal window rather than a failed deploy; the roof banner reclassification and live route reads are the governing proof for this packet.
