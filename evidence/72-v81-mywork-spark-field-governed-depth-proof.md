# V8.1 MyWork Home - Spark Field governed depth proof

- Date: 2026-03-25
- Environment: `staging`
- Deployment: `ec304ff7-71fa-4bca-93d3-ad8ca972efe5`
- Packet: `C-02i residual Home maturity hardening`
- Focus: promote `sparkField` from `partial_stitched` to `backed_by_real_service`

## What changed

`Spark Field` now exposes visible runtime summary derived from persisted Home truth instead of acting only as a stitched list of idea and note cards.

The block now surfaces:

- idea-to-task linkage counts from the Home V2 idea reads
- persisted notebook note count from `notebook_pages`
- governed recent outputs count from `artifactRegistryService.listMyWorkArtifacts(...)`
- organization-wide spark signal count from the org idea lane

This preserves the existing cards and AI nudge, but makes the block visibly grounded in persisted notebook/output/runtime truth.

## Local proof

- Targeted regressions passed:
  - `tests/integration/routes/v8.my-work.routes.test.ts`
  - `tests/components/MyWork/HomeView.outputs.test.tsx`
- Roof expectations now read `8 backed_by_real_service / 0 partial_stitched / 0 placeholder_non_canonical`
- The roof overall status now resolves to `coherent`

## Live staging proof

Authenticated browser proof was refreshed on:

- `https://stage.consultinity.ai/my-work?ts=1774478740`

Observed on the live Home surface:

- roof banner search matched exactly:
  - `Roof truth: Home V2 aggregated + outputs bridge · 8 real · 0 partial · 0 non-canonical`
- `Spark Field` visibly rendered the new runtime strip:
  - `Ideas with tasks`
  - `Recent notes`
  - `Recent outputs`
  - `Org signals`

Supporting browser evidence:

- `browser_search("Roof truth: Home V2 aggregated + outputs bridge · 8 real · 0 partial · 0 non-canonical")` -> `1 visible match`
- `browser_search("Ideas with tasks")` -> `1 visible match`
- `browser_search("Recent notes")` -> `1 visible match`
- `browser_search("Org signals")` -> `1 visible match`

Supporting network continuity from the same fresh load:

- `GET /api/v8/my-work/roof/summary` -> `200`
- `GET /api/my-work/home/v2` -> `200`

## Closure impact

`sparkField` is now staging-proven as a governed Home V2 block.

This closes the residual `C-02i` Home maturity hardening packet and moves the Home roof to:

- `8 real`
- `0 partial`
- `0 non-canonical`
