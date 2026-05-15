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
- Runtime chain for `/excele`: `ProtectedRoute` -> `MainLayout` -> `V4ComingSoonView`.
- Teresa chat can redirect Excele intent to `/excele`, but table-builder intents currently execute via My Work table workspace flow, not inside `/excele`.

## Function Runtime Breakdown

- `TB_EXCELE_PLACEHOLDER`: active function on `/excele` showing blocked/coming-soon state.
- `TB_TABLE_RUNTIME_TARGET`: documented target function, currently not mounted.
- Cross-surface note: `TB_TABLE_RUNTIME_TARGET` has partial operational path through `UnifiedChatPanel` + `ChatToSchemaPanel` in My Work context.

## Must

- MUST keep route/appview/sidebar mapping aligned across `menuConfig.ts`, `routeConfig.ts`, and `AppRoutes.tsx`.
- MUST preserve module ownership boundaries defined in global operating docs.
- MUST expose blocked/placeholder state honestly when runtime is not yet mounted.
- MUST explicitly document the current split between `/excele` placeholder runtime and Teresa-driven table-builder execution path in My Work.
- MUST keep RAW influence from `docs/RAW/workbench/102...` and `docs/RAW/teresa-chat/104...` as impact-only (no direct claim that `/excele` runtime is mounted).

## Must Not

- MUST NOT treat target-state RAW assumptions as current behavior.
- MUST NOT move ownership from canonical module boundaries documented in As-Is global docs.
- MUST NOT hide route aliasing or legacy surfaces from module contract narrative.

## Acceptance Criteria (Behavior)

- [ ] Direct navigation to launch route resolves to documented current runtime.
- [ ] AppView-to-route mapping resolves to the same module owner.
- [ ] Cross-module ownership statements match global resolved decisions.
- [ ] Behavior docs identify whether a table operation runs on `/excele` or via My Work table workspace.
- [ ] Behavior claims are mapped to packet evidence or explicitly marked `NOT_DONE`.
