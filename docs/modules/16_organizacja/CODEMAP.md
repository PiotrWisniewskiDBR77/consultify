---
module_id: MODULE_ORGANIZATION
doc_kind: CODEMAP
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Codemap — Organizacja

## Route / AppView / Sidebar (As-Is evidence)

- Sidebar entry: `ORGANIZATION` global menu item
- Launch AppView: `AppView.ORGANIZATION_PROFILE`
- Launch route: `/organization/*`
- Evidence files: `src/components/navigation/Sidebar/menuConfig.ts`, `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx`
- Canonical ownership note: Canonical ownership is `/organization` and org context. `/context/*` remains transitional/legacy context-builder surface.

## Routed Components

- `src/routes/AppRoutes.tsx` -> `ROUTES.ORGANIZATION.ROOT` renders `OrganizationView` under `ProtectedRoute`
- `src/views/OrganizationView.tsx` is active surface owner
- `/context/*` routes render `ContextBuilderView` and remain transitional compatibility surface

## Function Map (As-Is)

| Function | Runtime anchor | Notes |
| --- | --- | --- |
| `ORG_CONTEXT_WORKSPACE` | `OrganizationView` on `/organization/*` | canonical organization ownership surface. |
| `ORG_LEGACY_CONTEXT_BUILDER` | `ContextBuilderView` on `/context/*` | transitional compatibility surface (`partial`). |

## Relevant Services / Types

- `src/components/ProtectedRoute.tsx` (auth boundary)
- `src/types/core.ts` (`AppView.ORGANIZATION_PROFILE`, context-builder AppViews)
- `src/types/core.ts` keeps enum identity for `AppView.ORGANIZATION_PROFILE`.

## Current Runtime Status

- Classification: `real + partial`
- This codemap is As-Is only and reflects currently mounted route behavior.
