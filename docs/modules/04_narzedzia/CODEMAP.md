---
module_id: MODULE_TOOLS
doc_kind: CODEMAP
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Codemap — Narzędzia / Tools

## Route / AppView / Sidebar (As-Is)

- Sidebar entry `TOOLS` maps to `AppView.DISCOVERY_TOOLS`; sub-item `TOOLS_ASSESSMENT` maps to `AppView.ASSESSMENT_OVERVIEW`.
- Canonical routes in `src/routes/routeConfig.ts`:
  - `/discovery-tools` with category subroutes (`strategic`, `operational`, `digital`, `process-automation`, `strategic/megatrends`)
  - `/assessment/*` plus legacy alias `/licensed-tools/*`
- Route render map in `src/routes/AppRoutes.tsx` mounts:
  - `DiscoveryToolsHub` for tools routes
  - `AssessmentHub` / `AssessmentSessionEditorView` for assessment routes
  - `MegatrendsWorkspace` for canonical megatrends path

## Main Component Paths (As-Is)

- `src/components/Discovery/DiscoveryToolsHub.tsx`
- `src/components/assessment/AssessmentHub.tsx`
- `src/components/Megatrend/MegatrendsWorkspace.tsx`

## API / Services / Models (Confirmable)

- Shared API usage in tool and assessment hubs: `src/services/api.ts`.
- Discovery/domain types: `src/types/discovery.ts`.
- Initiative lifecycle bridge used by tools/assessment handoffs: `src/services/initiativeLifecycle.ts`, `src/services/initiativeWriteTruth.ts`.

## Test / Evidence References (Confirmable)

- No dedicated `src/components/Discovery/*test*` or `src/components/assessment/*test*` files found.

## Known Gaps (As-Is)

- Route-level breadth is high, but module-local automated tests for hub UI paths are missing (`code_gap`).
- Assessment/tool alias behavior (`/licensed-tools/*`) has no dedicated explicit regression file in module directory (`doc_gap`/`code_gap`).
