---
module_id: MODULE_PRESENTATIONS
doc_kind: CODEMAP
version: 1.1
owner: user
status: canonical
last_updated: 2026-06-03
---

# Codemap — Prezentacje / Generator Lane

## Route / AppView / Sidebar (As-Is evidence)

- Sidebar entry: `MODULE_PREZENTACJE_GEN` (label `Presentations`, no badge — self-serve)
- Launch AppView: `AppView.PREZENTACJE_GEN`
- Launch route: `/prezentacje`
- Evidence files: `src/components/navigation/Sidebar/menuConfig.ts`, `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx`
- Canonical ownership note: Standalone generator lane is `/prezentacje` (now self-serve, mounted). Canonical `/presentations` ownership belongs to `09_outputs`.

## Routed Components

- `src/routes/AppRoutes.tsx` -> `ROUTES.PREZENTACJE_GEN` renders `PrezentacjeView`
  directly (the contact-required `KimiModuleGate` / `V4ComingSoonView` fallback
  was removed — Module 12 audit gap #1). Every authenticated user reaches the
  real Gamma-style generator lane.
- `/presentations` routes render `ReportsAndPresentationsHub`, `PresentationWizard`, `DeckBuilder`, `SharedPresentationView` under Outputs flow
- `src/components/AIChat/KimiWorkspace/PrezentacjeView.tsx` is the mounted runtime on `/prezentacje` (split chat ↔ deck preview, wired to the real artifact pipeline)

## Function Map (As-Is)

| Function | Runtime anchor | Notes |
| --- | --- | --- |
| `PR_GEN_RUNTIME_TARGET` | `PrezentacjeView` (mounted on `/prezentacje`) | live generator runtime; self-serve, no contact gate. |
| `PR_OUTPUTS_OWNERSHIP_BOUNDARY` | route ownership boundary | production `/presentations` ownership belongs to module 09. |

## DeckBuilder surface (`/presentations/builder/:deckId`)

- `DeckBuilder` renders the unified `ExecutiveModuleShell` adapter
  (`DeckBuilderMelsView`) by **default** — `isMelsDeckBuilderEnabled()` is now
  default-ON (`src/utils/melsDeckBuilderFlag.ts`, audit gap #4). The legacy
  3-panel layout remains reachable via `?ff_melsDeckBuilder=0` / localStorage.
- Version history is **server-persisted**: `useVersionHistory` hydrates from
  `GET /presentations/decks/:deckId/versions` on mount and restores via
  `POST /presentations/decks/:deckId/versions/:versionId/restore`, so history
  survives refresh (audit gap #3).
- Real-time collaboration UI is **removed** (single-user-first decision, audit
  gap #2). There is no `/ws/presentations` server handler; the always-disconnected
  presence chips, `useCollaboration`, and `PresenceIndicators` were stripped.
  Multiplayer is a documented fast-follow.

## Relevant Services / Types

- `src/services/funnelAnalytics.ts` (redirect/route tracking in outputs-related redirects)
- `server/src/services/report/pptx/PptxPipelineService.ts` (real PPTX generation)
- `server/src/routes/presentations.routes.ts` (decks, autosave, agent-edit, versions, PNG/PDF/PPTX export)
- `src/types/core.ts` (`AppView.PREZENTACJE_GEN`, `AppView.PRESENTATIONS`)

## Current Runtime Status

- Classification: `mounted + self-serve + duplicate_boundary_resolved`
- This codemap reflects currently mounted route behavior.
