# DEEP MODULE 01 — Czat / Teresa (AI chat spine)

**Date:** 2026-06-03 · **Method:** end-to-end stack trace (UI handler → API client → server route → AIPipeline/provider/DB). No builds.

Entry: `src/views/AIChatView.tsx:3,8` mounts `UnifiedChatPanel` (4938 LOC, `src/components/AIChat/UnifiedChatPanel.tsx`). `/chat` is default post-login route.

---

## Per-feature verification table

| # | Feature | Verdict | Proof (file:line) | Notes |
|---|---------|---------|-------------------|-------|
| 1 | Message send → stream | **WORKS** | `useAIStream.ts:518,1132` → `api.ts:2267` `chatWithAIStream` → `ai.routes.ts:1423` `/chat/stream` (`verifyToken`,`validateBody`,`aiRateLimiter`) → `AIPipeline.processStream` (`AIPipeline.ts:507,2296`) → `llmService.callStream` (`llmService.ts:854`, real `@ai-sdk/anthropic`+`@ai-sdk/openai`+gemini) | SSE `text/event-stream`, heartbeat (`ai.routes.ts:1838,1867`), async-iterable chunks (`AIPipeline.ts:2316`). Genuinely real, not mock. |
| 2 | Auto-retry on stream error | **WORKS** | `useAIStream.ts:1159-1226` | Exponential backoff 1.5/3/6s, `fullText` reset before resend (dup-guard), skips retry on ACCESS_BLOCKED/Unauthorized/AI_BUDGET_EXHAUSTED/RATE_LIMIT. |
| 3 | Rate-limit handling | **WORKS** | global `aiRateLimiter` (`ai.routes.ts:260`); server maps Gemini 429 → `{code:'RATE_LIMIT'}` (`ai.routes.ts:4144-4150`); client skips retry on RATE_LIMIT (`useAIStream.ts:1168`) | Budget preflight at `ai.routes.ts:8724`. |
| 4 | Error / abort | **PARTIAL** | abort: `useAIStream.ts:1252` keeps partial content; error: `1235-1238` | **G3:** no `finally`; `setIsStreaming(false)` at 1235 is unreachable when abort+error coincide (early `return` at 1231) → narrow spinner-freeze. |
| 5 | History persistence | **WORKS** | client `addMessageToConversation` (`UnifiedChatPanel.tsx:1018,1238…`) → `POST /api/conversations/:id/messages` → `INSERT INTO conversation_messages` w/ seq (`conversations.routes.ts:765,833`); load via GET join (`:488`); resume-from-partial (`ai.routes.ts:2137`) | DB-backed (SQLite). Persistence is client-driven, not server-side post-stream. |
| 6 | Attachments | **WORKS** | `UnifiedChatPanel.tsx:2242-2263` uploads files to KB → conversation-scoped RAG via `ContextRetrievalService.retrieveContext` (`ai.routes.ts:3505,3513`), legacy `ragService` fallback (`:3552`); embeddings + `recordAttachmentExtraction` (`:496,506`) | Doc-filtered RAG so retrieval scoped to attached docs. |
| 7 | Split-view Canvas / TipTap editor | **WORKS** | `CanvasEditor/CanvasRichEditor.tsx` real `@tiptap` (`useEditor`/`EditorContent`); diff ops `acceptAiDiff/applyAiDiff/rejectAiDiff` (`:17`); intent `parseChatCanvasIntent` (`UnifiedChatPanel.tsx:330,1815`) + `detectCanvasWriteIntent` (`:83`); drafts persist `/api/work-canvas/drafts` (`WorkCanvasDocumentPanel.tsx:711,920`) | Full proposal lifecycle present. |
| 8 | AI floating menu (Canvas) | **WORKS** | `CanvasAIFloatingMenu` mounted `CanvasRichEditor.tsx:233`; `useCanvasAIStream.ts`; accept/reject bar `AIAcceptRejectBar` (`:16`) | Diff/apply/reject wired in editor (richer than audit's "P1 not implemented"). |
| 9 | Canvas → approve/reject → materialize | **WORKS** | client `approveCanvasOperation`/`rejectPendingOperation` (`WorkCanvasDocumentPanel.tsx:123,1539,1557`); server `MATERIALIZABLE_TARGETS` create (`work-canvas.routes.ts:3440-3464`) → real entity + readBack + auditEventId | idea/note/initiative/decision create real rows. |
| 10 | Canvas → Outputs handoff | **BROKEN** | `WorkCanvasDocumentPanel.tsx:1158` `window.location.assign('/presentations')` | **G1:** wrong route + full-page reload destroys React state. Should be SPA `navigate` to Outputs. |
| 11 | Slash `/task` `/decision` | **PARTIAL** | `UnifiedChatPanel.tsx:1716-1752` → `fetch('/api/my-work/chat-actions')` (`:1722`) | **G2:** bare fetch, **no AbortController/signal/timeout** → silent hang on stalled network. |
| 12 | Model selection | **WORKS** | `selectedModelId` threaded into every stream req (`UnifiedChatPanel.tsx:1193,2746,3129,3618`); server honors explicit model (`AIPipeline.ts:2053-2099`, `modelRouter.getProviderConfig`); `NextModelChip.tsx` UI | Tier (BUDGET/STANDARD/PREMIUM/REASONING) also wired. |
| 13 | Voice STT | **WORKS** | `POST /api/voice/stt` (`voice.routes.ts:47`), `/tts` (`:58`) | Whisper/Groq controller. |
| 14 | Voice TTS read-aloud | **WORKS (gated)** | `POST /api/v10/teresa/tts` (`teresa.routes.ts:128`); honest **503** `server_missing_gemini_live_key` when key absent | Real Gemini pipeline, graceful degradation. |
| 15 | Voice Gemini Live (bidirectional) | **WORKS (gated)** | `GET /api/v10/teresa/voice-config` (`teresa.routes.ts:45`) ephemeral token → `useTeresaVoice.ts` WebRTC | Operational only when `GEMINI_LIVE_SERVER_KEY` set; client-direct (Phase 2 proxy deferred). |
| 16 | Unsupported Canvas targets | **PARTIAL** | server **already returns 422** `target_not_yet_supported` (`work-canvas.routes.ts:3487-3494`) — audit listed this OPEN; it is FIXED server-side | Client `WorkCanvasDocumentPanel.tsx` has no explicit 422 handler/inline message → still a silent-ish UX gap. |
| 17 | Org Memory panel | **MOCK/DISABLED** | `UnifiedChatPanel.tsx:50,95,648` hook + panel commented out | Knowledge-lifecycle UI removed; memory still injected server-side (lens 4). |

---

## 4-Lens notes

**Lens 1 — Functionalities verified.** Core spine (send/stream/retry/rate-limit/persist/attachments/canvas/voice/model-select) is REAL through the full stack — verified to provider SDK and DB INSERT, not just render. Two BROKEN/PARTIAL runtime items (G1 route, G2 fetch hang) and one narrow error path (G3). Notably the audit *understated* completion on two points: Canvas diff/apply/reject IS wired in the editor (item 8), and the 422 honest-error for unsupported targets IS implemented server-side (item 16).

**Lens 2 — System integration (what the spine drives).** Teresa can materialize into: My Work ideas/notes (`saveMessageAsIdea/Note` `UnifiedChatPanel.tsx:801,906`), Tasks/Decisions (`/api/my-work/chat-actions`), Canvas drafts → workspace resources idea/note/initiative/decision (`work-canvas.routes.ts:3440`), multi-agent → Decision Room (`ai.routes.ts:3918`). All handoffs are **proposal-gated** (no silent writes) — matches governed-chain vision. Outputs handoff is the one broken edge (G1). project_brief/research_report/client_deliverable not yet materializable (honest 422).

**Lens 3 — Teresa pipeline real?** YES. `/chat/stream` → `chatPolicyGateway` (`ai.routes.ts:2623`) → `AIPipeline.processStream` → `ModelRouter` provider resolution → `llmService.callStream` against real Anthropic/OpenAI/Gemini SDKs with `stream:true`. RAG grounding via `ContextRetrievalService`/`ragService`. Voice via Gemini Live + TTS. This is a genuine pipeline, not a stub.

**Lens 4 — Contextual memory.** Real, privacy-gated (`ai.routes.ts:2803-2880`): (a) **ephemeral/short-term** = `conversationSummaryService.get(conversationId)` injected as "SHORT-TERM MEMORY"; (b) **long-term user/org** = `longTermMemoryService.getPromptAddendum({userId, organizationId})`; (c) **org context** = `OrganizationContextService` + attachment RAG. Gated off in privateMode/deepResearch and by `userPrivacyService` retention settings (`:2806-2816`). So chat DOES carry conversation memory, inject org context, and persist long-term — only the *user-facing* memory panel is disabled (item 17).

---

## Concrete fixes

**P0**
- **G1 — Canvas→Outputs broken route.** `WorkCanvasDocumentPanel.tsx:1158`: replace `window.location.assign('/presentations')` with SPA `navigate(ROUTES.OUTPUTS_HUB)` (Outputs, not Presentations). ~0.5h.
- **G2 — `/task` `/decision` silent hang.** `UnifiedChatPanel.tsx:1722`: wrap fetch in `AbortController` w/ 10s timeout + surface failure toast. ~0.25h.

**P1**
- **G3 — spinner-freeze on abort+error.** `useAIStream.ts:1228-1238`: move `setIsStreaming(false);setIsBotTyping(false)` into a `finally` wrapping the try/catch. ~0.25h.
- **G5-client — handle server 422.** Server already returns `target_not_yet_supported` (`work-canvas.routes.ts:3487`). Add inline "not available yet" render in `WorkCanvasDocumentPanel` approve handler for `code:CANVAS_TARGET_NOT_YET_SUPPORTED`. ~0.5h.
- **G4 — Wave5–9 dead panels in bundle.** `src/routes/AppRoutes.tsx:191-213` lazy-imports `Wave5ArtifactRuntimePanel`…`Wave9OutcomeAIOpsPanel`. Delete or gate behind `isSuperAdmin`. ~0.5h.

**P2**
- Re-enable `OrganizationMemoryPanel`/`useOrgMemory` (`UnifiedChatPanel.tsx:50,95,648`) — memory exists server-side, only UI removed.
- Canvas full e2e automated test (conversation→draft→approve→readBack); none in `tests/integration/ai/`.
- Server-proxied Gemini Live (Phase 2); current ephemeral-token TTL ~60s.
