---
module_id: MODULE_PRESENTATIONS
doc_kind: CODEMAP
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Codemap — Prezentacje / Generator Lane

## Route / AppView / Sidebar (As-Is evidence)

- Sidebar entry: `MODULE_PREZENTACJE_GEN` (label `Presentations`, badge `soon`)
- Launch AppView: `AppView.PREZENTACJE_GEN`
- Launch route: `/prezentacje`
- Evidence files: `src/components/navigation/Sidebar/menuConfig.ts`, `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx`
- Canonical ownership note: Standalone generator lane is `/prezentacje` (placeholder). Canonical `/presentations` ownership belongs to `09_outputs`.

## Routed Components

- `src/routes/AppRoutes.tsx` -> `ROUTES.PREZENTACJE_GEN` renders `V4ComingSoonView`
- `/presentations` routes render `ReportsAndPresentationsHub`, `PresentationWizard`, `DeckBuilder`, `SharedPresentationView` under Outputs flow
- `src/components/AIChat/KimiWorkspace/PrezentacjeView.tsx` is imported but not mounted on `/prezentacje`

## Function Map (As-Is)

| Function | Runtime anchor | Notes |
| --- | --- | --- |
| `PR_GEN_PLACEHOLDER` | `V4ComingSoonView` on `/prezentacje` | active standalone-lane placeholder. |
| `PR_GEN_RUNTIME_TARGET` | `PrezentacjeView` (imported only) | target generator runtime, not mounted. |
| `PR_OUTPUTS_OWNERSHIP_BOUNDARY` | route ownership boundary | production `/presentations` ownership belongs to module 09. |

## Relevant Services / Types

- `src/services/funnelAnalytics.ts` (redirect/route tracking in outputs-related redirects)
- `src/types/core.ts` (`AppView.PREZENTACJE_GEN`, `AppView.PRESENTATIONS`)
- `src/types/core.ts` keeps enum identity for `AppView.PREZENTACJE_GEN`.

## Current Runtime Status

- Classification: `partial + duplicate_boundary_resolved`
- This codemap is As-Is only and reflects currently mounted route behavior.
