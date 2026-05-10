---
module_id: MODULE_PRESENTATIONS
doc_kind: BEHAVIOR
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Behavior — Prezentacje / Generator Lane

## As-Is Runtime Behavior

- Route `/prezentacje` exists as standalone generator lane but currently shows placeholder state.
- Route family `/presentations` is active and owned by Outputs (`09_outputs`) as canonical presentations library/runtime.
- Legacy/related report routes redirect into `/presentations?tab=documents`, reinforcing Outputs ownership.

## Function Runtime Breakdown

- `PR_GEN_PLACEHOLDER`: active standalone lane function on `/prezentacje`.
- `PR_GEN_RUNTIME_TARGET`: target generator runtime function, currently not mounted.
- `PR_OUTPUTS_OWNERSHIP_BOUNDARY`: explicit boundary function preserving ownership split with module 09.

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
