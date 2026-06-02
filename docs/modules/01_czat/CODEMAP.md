---
module_id: MODULE_CHAT
doc_kind: CODEMAP
version: 2.0
owner: user
status: canonical
last_updated: 2026-05-10
---

# Codemap — Czat / Teresa Chat Engine

## Route / AppView / Sidebar (As-Is)

- Sidebar entry: `AI_CHAT` with `viewId: AppView.AI_CHAT` in `src/components/navigation/Sidebar/menuConfig.ts`.
- Canonical routes in `src/routes/routeConfig.ts`: `/chat`, `/chat/:conversationId`, `/internal/v10-runtime`.
- Route render map in `src/routes/AppRoutes.tsx`:
  - `/chat` -> `UnifiedChatPanel mode="full"` (`src/components/AIChat/UnifiedChatPanel.tsx`)
  - `/chat/:conversationId` -> `UnifiedChatPanel mode="full"` (`src/components/AIChat/UnifiedChatPanel.tsx`)
  - `/internal/v10-runtime` -> `V10RuntimeWorkspaceView`
  - NOTE: `AIChatWelcomeView` was deleted (Wave 1) — it was dead code never routed; `UnifiedChatPanel` is the sole canonical chat surface.

## Main Component Paths (As-Is)

- `src/components/AIChat/UnifiedChatPanel.tsx` — canonical chat surface; full/split modes with workspace context, welcome/empty state, Teresa voice CTA, and chat actions.
- `src/components/AIChat/TeresaTTSPlayer.tsx` — server-routed "talking Teresa" read-aloud (replaces the removed `TTSIndicator` browser polling component).
- `src/components/AIChat/VoiceConversationOverlay.tsx` — globally-mounted floating overlay for the shared Teresa live-voice session.
- `src/components/AIChat/ConversationRouteSync.tsx` — route <-> conversation synchronization (mounted in chat routes).
- `src/components/AIChat/EnhancedChatInput.tsx` — primary input shell and action bar.
- `src/components/AIChat/WorkModeMenu.tsx` — pre-send work mode preset selector.
- `src/components/AIChat/ToolsMenu.tsx` — explicit AI mode controls including web/deep/private/multi-agent.
- `src/components/AIChat/ActiveModeStrip.tsx` — visible pre-send runtime posture chips.
- `src/layouts/MainLayout.tsx` — split side-panel host for context-aware Teresa.
- `src/components/AIChat/chatAttachmentSupport.ts` — supported chat attachment type guard and accept label.
- `src/components/AIChat/AddFilesMenu.tsx` — add-file/add-source entry point for attachment and source UI.

## Function Map (As-Is)

| Function | Route scope | Core components | Notes |
| --- | --- | --- | --- |
| `CZ_CHAT_ENGINE` | `/chat`, `/chat/:conversationId` | `UnifiedChatPanel`, `MessageRenderer`, `EnhancedChatInput`, `TeresaTTSPlayer`, `VoiceConversationOverlay`, `WorkModeMenu`, `ToolsMenu`, `ActiveModeStrip`, `CitationList`, `TeresaProposalCard` | Primary production chat runtime and input control layer. |
| `CZ_CANVAS_WORKSPACE` | `/internal/v10-runtime` + chat workspace bridge flows | `V10RuntimeWorkspaceView`, `ChatV10RuntimesPanel`, `V8ArtifactRunControl`, `KimiWorkspaceShell`, `UnifiedChatPanel`, `MainLayout` | Startup incomplete / `NO_GO`: runtime bridge exists, but user-facing Canvas startup path is not proven end-to-end; KIMI lane routes are still coming-soon/gated. |

## API / Services / Models (Confirmable)

- API entry used by chat UI: `src/services/api.ts` (`Api` calls in chat views/panels).
- Runtime types used by chat surfaces: `src/types/index.ts` (exports `AppView`, chat/domain types) and `src/types/workspace.ts`.
- Additional chat runtime helpers used in panel/view: `useConversationStore`, `useAIStream`, Teresa runtime helpers under `src/components/AIChat`.
- Backend route evidence: `server/src/routes/ai.routes.ts`, `server/src/routes/conversations.routes.ts`.
- Backend policy/permission evidence: `server/src/services/ai/chatPolicyGateway.ts`, `server/src/services/chatPermissionService.ts`.
- Attachment/source evidence: `server/src/routes/ai.routes.ts` (`/attachments/ingest`, `/attachments/ingest-url`), `server/src/services/ragService.ts`, `server/src/services/organizationContext/OrganizationContextService.ts`.

## Target / Deferred Capability Map

| Capability | Current evidence status | Target owner lane / notes |
| --- | --- | --- |
| Project instructions / workspace rules | documentation target only | chat/project settings; must not clutter main input |
| Shared project chat / team collaboration | partial chat project/team scope evidence in backend routes | chat/project ACL; requires explicit visibility UI |
| Agent run plan | proposal/approval primitives exist, full run-plan UX deferred | chat owns plan candidate; owner modules execute approved actions |
| Artifact diff/versioning | governed artifact controls exist, full diff/apply/rollback deferred | canvas/workspace bridge + owner artifact lanes |
| Enterprise connector catalog | target only | source/integration owner lanes; chat displays status |
| Source health/freshness | target only | source cards/citation UI; requires indexing/parser metadata |
| Meeting/workshop recap | target only | chat extracts candidates; tasks/decisions remain owner-lane |
| Knowledge lifecycle | partial organization context evidence; lifecycle review deferred | organization/project knowledge owner lanes |
| Cross-conversation intelligence | target only | chat/history/search; must enforce ACL |
| Consulting playbooks / skills | work-mode pattern exists, full playbook library deferred | Work Mode menu + future playbook registry |

## Test / Evidence References (Confirmable)

- `tests/components/AppRoutes.ai-chat-routing.test.tsx` — chat routing contract (added Wave 1)
- `tests/unit/routes/appRoutes.chat-shell.test.ts` — canonical chat shell wiring
- `tests/components/AIChat/UnifiedChatPanel.test.tsx`
- `tests/integration/ai/ai-chat.routes.test.ts`
- `src/components/AIChat/__tests__/EnhancedChatInput.teresaVoice.test.tsx` — voice CTA (added Wave 1)
- `src/components/AIChat/__tests__/TeresaTTSPlayer.test.tsx` — server TTS read-aloud (added Wave 1)
- `server/src/routes/v10/__tests__/teresa.voice-config.test.ts` — voice-config / ephemeral token
- `server/src/services/ai/__tests__/chatPolicyGateway.contract.test.ts`

## Known Gaps (As-Is)

- No dedicated test suite covering end-to-end chat-canvas bridge through blocked lane exposure (`/wordy`, `/excele`, `/prezentacje`).
- No proven Canvas P0 startup path for `conversation -> canvas draft -> review_required -> accept/reject -> owner-lane read-back`.
- Market-parity target capabilities are intentionally documented as target/deferred until route/component/API/test evidence exists.
