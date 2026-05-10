---
module_id: MODULE_CHAT
doc_kind: CODEMAP
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Codemap — Czat / Teresa Chat Engine

## Route / AppView / Sidebar (As-Is)

- Sidebar entry: `AI_CHAT` with `viewId: AppView.AI_CHAT` in `src/components/navigation/Sidebar/menuConfig.ts`.
- Canonical routes in `src/routes/routeConfig.ts`: `/chat`, `/chat/:conversationId`, `/internal/v10-runtime`.
- Route render map in `src/routes/AppRoutes.tsx`:
  - `/chat` -> `AIChatWelcomeView` (`src/views/AIChatWelcomeView.tsx`)
  - `/chat/:conversationId` -> `UnifiedChatPanel` (`src/components/AIChat/UnifiedChatPanel.tsx`)
  - `/internal/v10-runtime` -> `V10RuntimeWorkspaceView`

## Main Component Paths (As-Is)

- `src/views/AIChatWelcomeView.tsx` — full-screen chat runtime, conversation history, suggestions, proposal cards, citations.
- `src/components/AIChat/UnifiedChatPanel.tsx` — chat panel used in full/split modes with workspace context and chat actions.
- `src/components/AIChat/ConversationRouteSync.tsx` — route <-> conversation synchronization (mounted in chat routes).

## Function Map (As-Is)

| Function | Route scope | Core components | Notes |
| --- | --- | --- | --- |
| `CZ_CHAT_ENGINE` | `/chat`, `/chat/:conversationId` | `AIChatWelcomeView`, `UnifiedChatPanel`, `MessageRenderer`, `EnhancedChatInput`, `CitationList`, `TeresaProposalCard` | Primary production chat runtime. |
| `CZ_CANVAS_WORKSPACE` | `/internal/v10-runtime` + chat workspace bridge flows | `V10RuntimeWorkspaceView`, `ChatV10RuntimesPanel`, `V8ArtifactRunControl`, `KimiWorkspaceShell` | Partial exposure: runtime bridge exists, KIMI lane routes are still coming-soon in app routing. |

## API / Services / Models (Confirmable)

- API entry used by chat UI: `src/services/api.ts` (`Api` calls in chat views/panels).
- Runtime types used by chat surfaces: `src/types/index.ts` (exports `AppView`, chat/domain types) and `src/types/workspace.ts`.
- Additional chat runtime helpers used in panel/view: `useConversationStore`, `useAIStream`, Teresa runtime helpers under `src/components/AIChat`.

## Test / Evidence References (Confirmable)

- `src/components/AIChat/__tests__/EnhancedChatInput.teresaVoice.test.tsx`
- `src/hooks/v10/__tests__/runtimeCapabilities.test.ts`
- `src/utils/__tests__/chatV10Rollout.test.ts`

## Known Gaps (As-Is)

- No dedicated test file for `AIChatWelcomeView` route assembly in `src/views`.
- No dedicated module-level acceptance test file for `/chat/:conversationId` route behavior (doc gap, not inferred functionality gap).
