# AI Chat Control Audit

Date: `2026-03-07`

## Goal
This audit maps the visible chat controls to their real handlers and backend effects. The purpose is to verify whether the conversation module behaves as designed, especially around:

- chat input and streaming
- plus menu and attachments
- tools
- co-thinkers and persona behavior
- model selection
- export, feedback, and escalation actions

## Canonical Chat Surface
The modern chat surface is:

- `src/components/AIChat/UnifiedChatPanel.tsx`
- `src/components/AIChat/EnhancedChatInput.tsx`

The older surface still exists in:

- `src/views/AIChatWelcomeView.tsx`

This creates a product risk: users can encounter controls implemented to different standards depending on which chat shell is active.

## Control Matrix
| Surface | Control | Handler path | Backend/API | Status | Audit note |
| --- | --- | --- | --- | --- | --- |
| Main chat | Send message | `EnhancedChatInput` -> `UnifiedChatPanel.handleSendMessage` | conversation APIs + `/api/ai/chat/stream` | Real | Core send and stream behavior is properly wired. |
| Main chat | Stop response | stream abort path via `useAIStream` | front-side stream cancellation | Real | Production-grade behavior exists. |
| Main chat | New chat | conversation store create flow | conversation APIs | Real | Properly connected. |
| Main chat | History/sidebar | `ChatSlidingPanel` and conversation store | conversation APIs | Real | Works as canonical history surface. |
| Main chat | Pending actions | `PendingActionsIndicator` | AI actions APIs | Real | Connected to approval/reject flows. |
| Main chat | Save as idea | chat action handlers | idea creation API | Real | Useful downstream action exists. |
| Main chat | Save as note | chat action handlers | notebook page creation API | Real | Useful downstream action exists. |
| Main chat | Feedback | `UnifiedChatPanel.handleFeedback` | `Api.aiFeedback` | Real | Modern flow has real analytics path. |
| Main chat | Business Actions | `onNavigateToActions?.()` | none found as default wiring | Partial | Visible capability exists, but callback wiring is optional and not consistently provided. |
| Main chat | Co-thinker selection | `CoThinkerMenu` -> `setAIConfig` | request payload into chat runtime | Real | Persona selection affects outgoing request configuration. |
| Main chat | Tools toggles | `ToolsMenu` -> `setAIConfig` | request payload and AI memory APIs | Real | Configuration has real impact on runtime payload. |
| Main chat | Model/tier selection | `LLMSelector` + app store config | health/recommendation APIs + runtime payload | Real | Selection is wired into chat settings and runtime requests. |
| Plus menu | Local file upload | `AddFilesMenu` -> attachment upload loop | `/api/ai/attachments/ingest` | Real | Strongest attachment path in current chat. |
| Plus menu | Cloud browse existing source | `useCloudIntegrations.openFilePicker` + picker | cloud source list/file download APIs | Partial | Works only after a source already exists and server path is implemented. |
| Plus menu | Connect cloud provider | `useCloudIntegrations.connectProvider` | no real OAuth start | Partial/Fake | Hook only refreshes providers and shows informational toast. |
| Plus menu | Recent attachments | local menu memory | no durable re-attach flow | Partial | UX suggests reuse, but behavior is limited. |
| Chat input | Dictation | speech input in `EnhancedChatInput` | browser speech stack | Real | Basic dictation exists. |
| Chat input | Continuous voice conversation | `startVoiceConversation` / `stopVoiceConversation` in `EnhancedChatInput` | front-side speech flow | Partial | Logic exists, but end-user trigger and production readiness are weaker than the core chat path. |
| Legacy chat | Feedback | `AIChatWelcomeView.handleFeedback` | `Api.reportMessageFeedback` | Fake | Current API implementation returns static success. |
| Legacy chat | Report problem | `AIChatWelcomeView.handleReport` | `Api.reportMessage` | Fake | Current API implementation returns static success. |
| Legacy chat | Export conversation to PDF | `handleExportFormat` | `exportConversationToPDF` | Partial | Real export utility exists, but tied to legacy surface rather than canonical chat shell. |

## Evidence For Partial Or Fake Controls

### Business Actions
`UnifiedChatPanel` exposes an optional callback for navigating to actions:

- `src/components/AIChat/UnifiedChatPanel.tsx`

The surface supports it, but current wiring is optional, so the button cannot be treated as universally functional until all relevant parents pass `onNavigateToActions`.

### Cloud Provider Connect
The current hook does not initiate a real OAuth flow:

- `src/hooks/useCloudIntegrations.ts`
- `src/services/api.ts`

Observed behavior:
- `connectProvider` refreshes provider state and shows an informational toast.
- `Api.completeCloudOAuth` throws an explicit `not configured` error.

This means cloud attachments are only partially real today:
- browsing a connected source can work
- first-time connection is not production-ready

### Legacy Feedback And Report
The legacy chat surface uses placeholder success responses:

- `src/views/AIChatWelcomeView.tsx`
- `src/services/api.ts`

The API methods currently return static success objects and do not represent a verified backend write path.

## Co-Thinker And Tooling Assessment
### Co-thinkers
Current behavior is `configuration-first`, not a separately orchestrated specialist agent system.

What is real:
- the UI allows choosing a persona/co-thinker
- that choice is propagated through app state into the request configuration

What is still incomplete:
- the product promise of named co-thinkers such as an “analyst” is stronger than the currently observable behavioral contract
- there is not yet one single artifact proving that every named co-thinker has a dedicated prompt contract, runtime guarantee, and acceptance test

Operational conclusion:
- co-thinker selection is real
- co-thinker behavioral assurance is still only partially formalized

### Tools
The tools menu is materially wired and affects runtime state. However, not every visible tool-adjacent affordance is equally mature:

- configuration toggles: real
- save/move/action flows: mostly real
- some higher-level action buttons in legacy chat: mixed

## Attachment And Document Support Reality Check
Current product truth:

- local upload for `PDF`, text-like files, `JSON`, `CSV`, and `MD` is the most reliable path
- grounded AI over attachments is real through the attachment ingestion and retrieval path
- cloud file use is only partially complete because provider connection is not production-ready
- multimodal promises should not be treated as fully complete until voice/media ingestion and declared file support are aligned with runtime support

## Risks
- `Two chat shells` create inconsistent user trust and inconsistent QA scope.
- `Visible but optional callbacks` make some buttons appear complete before they are guaranteed to do anything.
- `Placeholder success APIs` in the legacy surface can produce false confidence.
- `Cloud integration UX` implies a fuller connection story than the runtime currently delivers.

## Product Decision Recommended
The product should treat:

- `UnifiedChatPanel` as the only canonical chat surface
- `AIChatWelcomeView` as legacy and a migration target

Definition of done for chat completion:
- every visible button has a mandatory handler or is hidden
- every visible handler calls a real backend or a real browser capability
- every named co-thinker has a documented runtime contract
- every attachment option shown in UI is actually supported in runtime
