---
module_id: MODULE_CHAT
doc_kind: TESTS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Acceptance & Tests — Czat / Teresa Chat Engine

## Acceptance Matrix (As-Is Runtime Paths)

| Path / flow | Current runtime evidence | Status |
| --- | --- | --- |
| Sidebar Chat -> `/chat` | `menuConfig.ts` maps `AI_CHAT`; `AppRoutes.tsx` mounts `AIChatWelcomeView` | pass |
| Deep link `/chat/:conversationId` | `routeConfig.ts` + `AppRoutes.tsx` mount `UnifiedChatPanel` | pass |
| Conversation sync in route | `ConversationRouteSync` mounted on chat routes | pass |
| Empty/failed AI response fallback | Fallback helpers imported/used in chat view/panel | pass |
| Dedicated route-level automated test | no direct test file for chat routes | gap (`code_gap`) |

## Confirmed Automated Evidence (As-Is)

- `src/components/AIChat/__tests__/EnhancedChatInput.teresaVoice.test.tsx`
- `src/hooks/v10/__tests__/runtimeCapabilities.test.ts`
- `src/utils/__tests__/chatV10Rollout.test.ts`

## Known Gaps / Blockers

- `doc_gap`: no module-local evidence links to UI recordings in this file yet.
- `code_gap`: no explicit route-level test covering `/chat` + `/chat/:conversationId` transition as one scenario.

## Gate Vocabulary (Used For Reporting)

- `PASS`, `PASS_WITH_P2`, `BLOCKED_P1`, `INCONCLUSIVE`.
