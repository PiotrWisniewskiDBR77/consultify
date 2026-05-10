---
module_id: MODULE_MCP_MARKETPLACE
doc_kind: CODEMAP
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Codemap — MCP Marketplace

## Route / AppView / Sidebar (As-Is evidence)

- Sidebar entry: `MCP_MARKETPLACE` (badge `soon`)
- Launch AppView: `AppView.MCP_MARKETPLACE_COMING_SOON`
- Launch route: `/mcp/marketplace`
- Evidence files: `src/components/navigation/Sidebar/menuConfig.ts`, `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx`
- Canonical ownership note: As-Is UI entry exists as a coming-soon catalog surface.

## Routed Components

- `src/routes/AppRoutes.tsx` -> `ROUTES.MCP_MARKETPLACE` renders `V4ComingSoonView`
- No dedicated mounted marketplace runtime component on current route tree

## Relevant Services / Types

- `src/types/core.ts` (`AppView.MCP_MARKETPLACE_COMING_SOON`)
- `src/services/api.ts` (shared services only; no routed marketplace runtime confirmed)
- `src/types/core.ts` keeps enum identity for `AppView.MCP_MARKETPLACE_COMING_SOON`.

## Current Runtime Status

- Classification: `stub + planned`
- This codemap is As-Is only and reflects currently mounted route behavior.
