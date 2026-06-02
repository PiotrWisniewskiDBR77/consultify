---
module_id: MODULE_INITIATIVES
doc_kind: CODEMAP
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Codemap — Inicjatywy

## Route / AppView / Sidebar (As-Is)

- Sidebar entry `MODULE_INITIATIVES` maps to `AppView.PORTFOLIO_ROADMAP` in `menuConfig.ts`.
- Canonical and related routes in `routeConfig.ts`: `/initiatives`, `/roadmap`, `/portfolio`, `/roi`.
- Route render map in `AppRoutes.tsx`:
  - `/initiatives` -> `InitiativesHub`
  - `/roadmap` -> `FullRoadmapView`
  - `/portfolio` -> `PortfolioView`
  - `/roi` -> `FullROIView`

## Main Component Paths (As-Is)

- `src/components/Initiatives/InitiativesHub.tsx` — core module runtime (kanban/list/timeline/grid, filters, open docs, bulk actions).
- `src/views/PortfolioView.tsx`, `src/views/FullRoadmapView.tsx`, `src/views/FullROIView.tsx` — related routes tied to initiatives lane.

## Function Map (As-Is)

| Function | Runtime anchor | Notes |
| --- | --- | --- |
| `IN_PORTFOLIO_HUB` | `InitiativesHub` tab `list` | primary portfolio execution surface. |
| `IN_ANALYSIS_WORKSPACE` | `InitiativesHub` tab `analysis` | analysis subview lane (resources/feasibility/logic/timeline/completeness). |
| `IN_ROADMAP_VIEW` | `FullRoadmapView` | roadmap lane route. |
| `IN_PORTFOLIO_VIEW` | `PortfolioView` | related portfolio route lane. |
| `IN_ROI_VIEW` | `FullROIView` | ROI lane route. |

## API / Services / Models (Confirmable)

- Shared API usage: `src/services/api.ts`.
- Planning contracts: `src/services/api/v8/planning.ts`.
- Lifecycle and write-governance helpers: `src/services/initiativeLifecycle.ts`, `src/services/initiativeWriteTruth.ts`.
- Initiative model contracts: `src/types/initiative.ts`, `src/types/index.ts`.

## Test / Evidence References (Confirmable)

- No dedicated `src/components/Initiatives/*test*` files found.

## Known Gaps (As-Is)

- Module runtime is feature-rich but has no module-local automated tests (`code_gap`).
- Sidebar AppView points to portfolio-roadmap identity while canonical module route is `/initiatives` (`partial` routing indirection, explicitly mapped).
