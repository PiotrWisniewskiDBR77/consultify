---
module_id: MODULE_DOCUMENTS
doc_kind: BEHAVIOR
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Behavior — Dokumenty / Wordy

## As-Is Runtime Behavior

- Module entry is reachable from sidebar and direct route, but user lands on `V4ComingSoonView`.
- No Document Studio transactional workflow is mounted under `/wordy` in current `AppRoutes`.
- Navigation identity is stabilized by `AppView.WORDY` in `src/types/core.ts` and `APP_VIEW_TO_ROUTE` mapping in `routeConfig.ts`.

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
