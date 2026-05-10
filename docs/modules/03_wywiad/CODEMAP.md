---
module_id: MODULE_INTERVIEW
doc_kind: CODEMAP
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Codemap — Wywiad / Interview

## Route / AppView / Sidebar (As-Is)

- Sidebar entry: `INTERVIEW` with `viewId: AppView.DISCOVERY_CONSULTANT` in `src/components/navigation/Sidebar/menuConfig.ts`.
- Canonical routes in `src/routes/routeConfig.ts`: `/interview`, `/discovery` (legacy alias), `/project-intelligence` mapping.
- Route render map in `src/routes/AppRoutes.tsx`: interview/discovery/project-intelligence paths mount `InterviewHub` (`src/components/Interview/InterviewHub.tsx`).

## Main Component Paths (As-Is)

- `src/components/Interview/InterviewHub.tsx` — module hub with sessions/insights/templates flows, assignment and preview panes.
- `src/components/Interview/InterviewWorkspace.tsx` and related preview/modals — detailed session/template interactions.
- `src/components/Discovery/InterviewHub.tsx` — additional discovery-side interview component path present in codebase.

## Function Map (As-Is)

| Function | Runtime anchor | Notes |
| --- | --- | --- |
| `WY_MY_ASSIGNMENTS` | `InterviewHub` tab `my_assignments` | default assignment queue. |
| `WY_MANAGED_ASSIGNMENTS` | `InterviewHub` tab `managed` | manager oversight assignment surface. |
| `WY_SESSIONS` | `InterviewHub` tab `sessions` | session lifecycle and deep-link open flows. |
| `WY_TEMPLATES` | `InterviewHub` tab `templates` | template catalog and questions preview. |
| `WY_INSIGHTS` | `InterviewHub` tab `insights` | insight review/report mode surface. |
| `WY_PENDING_REVIEW` | `InterviewHub` tab `pending_review` | review-gated queue for pending insight actions. |

## API / Services / Models (Confirmable)

- Interview API client: `src/services/api/v8/interview.ts` (session, assignment, insight contracts).
- Shared API usage in UI runtime: `src/services/api.ts`.
- Discovery/interview-related types: `src/types/discovery.ts`, `src/types/index.ts`.

## Test / Evidence References (Confirmable)

- No dedicated `src/components/Interview/*test*` files found via path scan (recorded as gap).

## Known Gaps (As-Is)

- Interview runtime has rich UI and API contracts but lacks module-local frontend automated tests in component directory.
- Alias routes are active; no separate route-specific regression file for alias-to-hub consistency was found.
