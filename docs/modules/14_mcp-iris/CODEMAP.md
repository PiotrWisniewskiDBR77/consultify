---
module_id: MODULE_MCP_IRIS
doc_kind: CODEMAP
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Codemap — MCP IRIS

## Route / AppView / Sidebar (As-Is evidence)

- Sidebar entry: `MCP_IRIS` (badge `soon`)
- Launch AppView: `AppView.MCP_IRIS_COMING_SOON`
- Launch route: `/mcp/iris`
- Evidence files: `src/components/navigation/Sidebar/menuConfig.ts`, `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx`
- Canonical ownership note: As-Is UI entry exists as a coming-soon integration surface.

## Routed Components

- `src/routes/AppRoutes.tsx` -> `ROUTES.MCP_IRIS` renders `V4ComingSoonView`
- No dedicated mounted IRIS runtime component on current route tree

## Function Map (As-Is)

| Function | Runtime anchor | Notes |
| --- | --- | --- |
| `IRIS_PLACEHOLDER_SURFACE` | `V4ComingSoonView` on `/mcp/iris` | active placeholder integration surface. |
| `IRIS_RUNTIME_TARGET` | planned IRIS runtime panel | target runtime contract, not mounted. |

## Relevant Services / Types

- `src/types/core.ts` (`AppView.MCP_IRIS_COMING_SOON`)
- `src/services/api.ts` (shared app transport, no dedicated routed IRIS UI wiring confirmed)
- `src/types/core.ts` keeps enum identity for `AppView.MCP_IRIS_COMING_SOON`.

## Current Runtime Status

- Classification: `stub + planned`
- This codemap is As-Is only and reflects currently mounted route behavior.
