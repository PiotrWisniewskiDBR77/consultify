---
module_id: MODULE_CHAT
doc_kind: STATUS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Status — Czat / Teresa Chat Engine

## Status Tags (As-Is)

- `real`: `/chat` and `/chat/:conversationId` are routed and mounted in `src/routes/AppRoutes.tsx`.
- `real`: sidebar -> `AppView.AI_CHAT` mapping exists in `src/components/navigation/Sidebar/menuConfig.ts`.
- `partial`: v10 runtime path `/internal/v10-runtime` is present but separate/internal compared to main user path.
- `code_gap`: no dedicated route-level test for `AIChatWelcomeView` + `UnifiedChatPanel` transition.
- `doc_gap`: prior baseline docs were generic and did not list concrete route/component/service evidence.

## Function Coverage Status

- `real`: `CZ_CHAT_ENGINE` documented and mapped to production chat routes/components.
- `partial`: `CZ_CANVAS_WORKSPACE` documented with explicit internal/bridge scope and current route exposure constraints.
- `pass`: function contract coverage in module docs is complete (`2/2` functions documented).

## Runtime Notes (As-Is)

- Chat runtime includes proposal/action/citation building blocks in mounted chat components.
- Security/tenant guarantees depend on shared API + auth layers (`Api` and protected app shell), not on a standalone chat-only gate.
- Canvas/workspace bridge behavior is present in runtime components, but route exposure remains intentionally constrained for some end-user lanes.
