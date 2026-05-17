---
module_id: MODULE_INITIATIVES
doc_kind: STATUS
version: 2.0
owner: user
status: review
last_updated: 2026-05-10
---

# Status — Inicjatywy

## Status Tags (As-Is)

- `real`: `/initiatives` route mounts `InitiativesHub`.
- `real`: related route family (`/roadmap`, `/portfolio`, `/roi`) is active in `AppRoutes.tsx`.
- `partial`: sidebar maps initiatives entry to `AppView.PORTFOLIO_ROADMAP`, while lane route entry is `/initiatives` (explicit mapping present).
- `real`: lifecycle/governance helpers are wired (`initiativeLifecycle`, `initiativeWriteTruth`, `v8/planning`).
- `code_gap`: no dedicated automated tests in `src/components/Initiatives`.
- `doc_gap`: prior baseline did not specify route family and governance service files.
- `review`: Contract 2.0 documentation baseline prepared in `RAW_TARGET_STATE_2_0_PACKET.md`.
- `not_done`: no owner acceptance recorded and no dedicated initiative UI lifecycle/card regression evidence bound.

## Function Coverage Status

- Required functions documented: `5/5`.
- Covered: `IN_PORTFOLIO_HUB`, `IN_ANALYSIS_WORKSPACE`, `IN_ROADMAP_VIEW`, `IN_PORTFOLIO_VIEW`, `IN_ROI_VIEW`.

| Function | Route / entry | Route evidence | Component evidence | API evidence | Test evidence | Gate |
| --- | --- | --- | --- | --- | --- | --- |
| `IN_PORTFOLIO_HUB` | `/initiatives` | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `src/components/Initiatives/InitiativesHub.tsx` | `/api/initiatives`, `gate-readiness-check` | API smoke only; UI lifecycle/card regression missing | `NOT_DONE` |
| `IN_ANALYSIS_WORKSPACE` | `InitiativesHub` analysis tab | `/initiatives` | `InitiativesHub` analysis subviews | V8 planning/readiness APIs | dedicated analysis UI test missing | `NOT_DONE` |
| `IN_ROADMAP_VIEW` | `/roadmap` | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `src/views/FullRoadmapView.tsx` | initiative lifecycle/readiness APIs | lane smoke not bound | `NOT_DONE` |
| `IN_PORTFOLIO_VIEW` | `/portfolio` | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `src/views/PortfolioView.tsx` | initiative list/status APIs | lane smoke not bound | `NOT_DONE` |
| `IN_ROI_VIEW` | `/roi` | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `src/views/FullROIView.tsx` | finance/results ROI + initiative link APIs | lane smoke not bound | `NOT_DONE` |

## Decision Status

| Decision | Status | Reason |
| --- | --- | --- |
| Documentation Contract 2.0 baseline | `ACCEPTED_DOC` | Packet and 00-07/function contracts now align on function map, dependency map and evidence binding. |
| Docs contract rerun gate | `APPROVED_DOC` | `npm run docs:contract:rerun-gate` returned 19 modules, 77 function contracts, 0 errors, 0 warnings. |
| Runtime `DONE` | `BLOCKED_P1` | Required UI/card/lifecycle test evidence and owner acceptance are missing. |
| Cross-module handoff changes | `BLOCKED_SCOPE` | No new handoff edge was introduced; do not edit other module contracts in this cycle. |
| Source-envelope doctrine | `OPEN_QUESTION` | Current `SOURCE_TRACEABILITY_SPEC.md` is narrower than runtime/product direction. |

## Module Integration Status — 2026-05-10

| Integration gate | Status | Evidence |
| --- | --- | --- |
| Scope anchor | `PASS` | `05_inicjatywy/MODULE_INTEGRATION`, docs-only. |
| Function coverage | `PASS_DOC` | `5/5` function contracts present and referenced in `README.md`, `04_UI_UX.md`, `07_ACCEPTANCE_AND_TESTS.md`, `RAW_TARGET_STATE_2_0_PACKET.md`. |
| Module 00-07 consistency | `PASS_DOC_WITH_GAPS` | Contracts agree on function inventory, owner boundaries, capability governance and evidence gaps. |
| Role / CTA / AI consistency | `PASS_DOC` | Backend capability source is `GET /api/initiatives/:id/gate-readiness-check`; AI remains Menu 3/right-side and proposal-only. |
| Handoff impact | `PASS_NO_NEW_EDGE` | Existing graph and lineage already cover `05` -> `06`, `07`, `08`; no new edge added. |
| Traceability baseline | `PASS_LIMITED` | Route/component/API evidence is bound; missing UI regression tests remain `NOT_DONE_UI`. |
| Owner acceptance | `PENDING` | Owner has not yet accepted runtime `DONE`; next step is owner review of `INTEGRATION_REPORT.md`. |

Current integration verdict: `GO_FOR_NEXT_DOCS_WAVE`, `NO_GO_RUNTIME_DONE`.
