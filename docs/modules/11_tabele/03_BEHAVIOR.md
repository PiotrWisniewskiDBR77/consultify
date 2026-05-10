---
module_id: MODULE_TABLES
doc_kind: BEHAVIOR
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Behavior — Tabele / Excele

## As-Is Runtime Behavior

- Sidebar and route mapping are live, but tabular generation workflow is not mounted under `/excele`.
- Current user experience is intentionally blocked by coming-soon placeholder.
- Route/AppView identity is defined in `routeConfig.ts` and `src/types/core.ts` via `AppView.EXCELE`.

## Must

- MUST keep route/appview/sidebar mapping aligned across `menuConfig.ts`, `routeConfig.ts`, and `AppRoutes.tsx`.
- MUST preserve module ownership boundaries defined in global operating docs.
- MUST expose blocked/placeholder state honestly when runtime is not yet mounted.

## Must Not

- MUST NOT treat target-state RAW assumptions as current behavior.
- MUST NOT move ownership from canonical module boundaries documented in As-Is global docs.
- MUST NOT hide route aliasing or legacy surfaces from module contract narrative.

## Acceptance Criteria (Behavior)

- [ ] Direct navigation to launch route resolves to documented current runtime.
- [ ] AppView-to-route mapping resolves to the same module owner.
- [ ] Cross-module ownership statements match global resolved decisions.
