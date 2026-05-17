---
module_id: MODULE_MCP_MARKETPLACE
doc_kind: BEHAVIOR
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Behavior — MCP Marketplace

## As-Is Runtime Behavior

- Sidebar + route + AppView mapping are present for discovery/navigation.
- Route renders placeholder and does not expose active marketplace interaction runtime.
- Ownership boundary remains: Marketplace lists capabilities; IRIS is execution lane.

## Function Runtime Breakdown

- `MCPM_PLACEHOLDER_SURFACE`: active placeholder function on `/mcp/marketplace`.
- `MCPM_RUNTIME_TARGET`: documented target marketplace runtime function, currently not mounted.

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
