---
module_id: MODULE_CHAT
doc_kind: META
version: 2.0
owner: user
status: canonical
last_updated: 2026-05-10
---

# META — Czat / Teresa Chat Engine

## Identity

- Module id: `MODULE_CHAT`
- Sidebar label: `Czat`
- Folder: `01_czat`
- Route: `/chat`
- AppView: `AppView.AI_CHAT`
- Owner: user

## Canonical Routes (As-Is)

- `/chat` (chat start)
- `/chat/:conversationId` (chat continuation)
- `/internal/v10-runtime` (internal/runtime bridge surface)

## Evidence Bundle (Contract 2.0 baseline)

- route evidence: `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx`
- component evidence: `src/views/AIChatWelcomeView.tsx`, `src/components/AIChat/UnifiedChatPanel.tsx`, `src/views/V10RuntimeWorkspaceView.tsx`
- API evidence: `server/src/routes/ai.routes.ts`, `server/src/routes/conversations.routes.ts`
- test evidence: `tests/components/AppRoutes.ai-chat-routing.test.tsx`, `tests/integration/ai/ai-chat.routes.test.ts`, `tests/components/AIChat/AIChatWelcomeView.v8-controls.test.tsx`

## Function Inventory (Canonical For This Module)

- `CZ_CHAT_ENGINE` — real
- `CZ_CANVAS_WORKSPACE` — startup_incomplete / NO_GO for user-facing Canvas launch

## Canonicality

This folder is the author-level module contract. Other product, engineering and implementation docs can provide detail, but they must not contradict this contract without an explicit contract update.

## Scope Freeze (this wave)

- in scope: contract hardening and traceability for `01_czat`, including target/deferred market-parity capability documentation from RAW addendum
- out of scope: runtime implementation changes, new route/APIs, ownership migration of downstream canonical objects

## Source Package

- `DRD/consultify/docs/product/CHAT_V8_SSOT.md`
- `DRD/consultify/docs/product/CHAT_V8_CONTROL_SURFACE_SPEC.md`
- `DRD/consultify/docs/product/CHAT_V8_AI_GOVERNANCE.md`
- `DRD/consultify/docs/product/CHAT_V8_SHARING_AND_PERMISSIONS.md`
- `DRD/consultify/docs/product/CHAT_V8_ENTERPRISE_AND_COMPLIANCE.md`
- `DRD/consultify/docs/product/CHAT_AND_AGENT_FUNCTIONAL_COMPLETENESS_AUDIT_V8.md`
- `DRD/consultify/docs/UI_UX/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md`

## Open Questions

1. Which P0 user-facing entry will start Canvas: selected chat output, explicit Menu 2 function entry, or shared `/ai/work-canvas?kind=*` route?
2. What exact runtime write guard will separate conversation-only/personal/project/team/organization/no-retention knowledge destinations for chat-added sources?
3. What owner-lane read-back object proves Canvas materialization for document, table and presentation drafts?
