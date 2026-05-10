---
module_id: MODULE_MEETING
doc_kind: BEHAVIOR
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Behavior — Meeting

## As-Is Runtime Behavior

- Users can navigate to meeting module via sidebar and direct URL.
- Current route returns placeholder UI rather than active meeting orchestration workspace.
- Potential runtime (`MeetingHub`) is present in codebase but not wired in current route tree.

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
