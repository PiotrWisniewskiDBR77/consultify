---
module_id: MODULE_CHAT
doc_kind: BEHAVIOR
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Behavior — Czat / Teresa Chat Engine

## Runtime Behavior (As-Is)

- `/chat` mounts `AIChatWelcomeView`, which initializes conversation state from `useConversationStore`, streams AI responses, and persists assistant output through store/API helpers.
- `/chat/:conversationId` mounts `UnifiedChatPanel` and keeps route-linked conversation context active.
- Chat runtime provides explicit response/action surfaces (citations, proposal/action cards, message actions) through dedicated AI Chat components imported in both chat surfaces.
- Conversation-scoped handoff exists from chat to other modules through explicit route targets and context openings (for example mapping to `initiatives`, `my-work`, `meeting`, `interview` in chat runtime code).

## State Handling (As-Is)

- Loading state is managed in chat views via store flags and stream lifecycle.
- Empty assistant response fallback text is generated explicitly (no silent blank response path).
- Error paths use guarded messages and warning fallbacks in chat runtime helpers.

## Security / Tenant / Governance (As-Is)

- Mutation paths run through shared API/store layer (`src/services/api.ts`, conversation store methods); no hidden write-only branch is documented in the chat view files.
- Role/tenant enforcement is inherited from global app auth/session context; chat module does not expose a separate ACL bypass in route definitions.
- High-impact action execution is represented as explicit action/proposal UI elements (not silent auto-commit in route code).
