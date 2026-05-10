---
module_id: MODULE_PARTNER_PORTAL
doc_kind: BEHAVIOR
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Behavior — Portal Partnerski

## As-Is Runtime Behavior

- Protected partner portal route tree is active for authenticated users.
- Public recruitment/pricing routes coexist as acquisition layer and are outside secured portal shell.
- AppView mapping includes partner dashboard/resources/client-access routes under partner namespace.

## Function Runtime Breakdown

- `PART_PORTAL_WORKSPACE`: canonical protected portal runtime function.
- `PART_PUBLIC_ACQUISITION_BOUNDARY`: explicit boundary between public acquisition and protected portal contexts.

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
