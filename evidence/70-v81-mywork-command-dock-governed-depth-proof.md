# V8.1 MyWork Home - Command Dock governed depth proof

- Date: 2026-03-25
- Environment: `staging`
- Deployment: `f852999d-4108-4157-a2d0-256070973467`
- Packet: `C-02i residual Home maturity hardening`
- Focus: promote `commandDock` from `partial_stitched` to `backed_by_real_service`

## What changed

`Command Dock` now surfaces a governed runtime strip derived from the same Home V2 aggregation call that already powers the Home roof:

- `inboxService.getInboxStats(userId, orgId)` -> `Inbox pending`, `SLA at risk`
- `artifactRegistryService.listMyWorkArtifacts(...)` -> `Recent outputs`, `Needs review`

The block still preserves the bounded launcher bridge (`+ Idea`, `+ Note`, `+ Task`, `+ Decision`, `Calendar`, `Ask AI`), but it is no longer just a static action tray.

## Local proof

- Targeted regressions passed:
  - `tests/integration/routes/v8.my-work.routes.test.ts`
  - `tests/components/MyWork/HomeView.outputs.test.tsx`
- Updated roof expectations now read `6 backed_by_real_service / 2 partial_stitched / 0 placeholder_non_canonical`.
- The component regression now also guards that `Command Dock` receives runtime summary data instead of acting as a pure launcher stub.

## Live staging proof

Authenticated browser proof was refreshed on `https://stage.consultinity.ai/my-work?ts=1774477450`.

Observed directly on the live surface:

- roof banner search matched exactly:
  - `Roof truth: Home V2 aggregated + outputs bridge · 6 real · 2 partial · 0 non-canonical`
- `Command Dock` visibly rendered the new governed runtime strip under the tutorial overlay:
  - `Inbox pending`
  - `SLA at risk`
  - `Recent outputs`
  - `Needs review`

Supporting browser evidence:

- `browser_search("Roof truth: Home V2 aggregated + outputs bridge · 6 real · 2 partial · 0 non-canonical")` -> `1 visible match`
- `browser_search("Inbox pending")` -> `1 visible match`
- `browser_search("SLA at risk")` -> `1 visible match`
- `browser_search("Recent outputs")` -> `1 visible match`
- `browser_search("Needs review")` -> `1 visible match`

Supporting network continuity from the same fresh load:

- `GET /api/v8/my-work/roof/summary` -> `200`
- `GET /api/my-work/home/v2` -> `200`

## Closure impact

`commandDock` is now staging-proven as a governed Home V2 block rather than a stitched launcher-only block.

Residual `C-02i` Home maturity gap narrows to:

- `momentum`
- `sparkField`
