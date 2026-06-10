# Module 01 — Czat — Re-Audit (2026-06-03)

**Readiness: 84/100 — Tier: RC (Release Candidate) (baseline 68 → +16)**
**One-line verdict:** Dead-code cleaned, Canvas startup wired end-to-end, TTS/voice fully backend-wired, all 4 previously missing tests now exist — but a stale `vite.config.ts` warmup entry for the deleted file will cause a pre-transform error in dev, Canvas→Outputs still hard-navigates to the wrong route, and one raw fetch has no timeout.

---

## Functionality (real / mock / broken)

**Real and backend-wired:**
- `/chat` and `/chat/:conversationId` mount `UnifiedChatPanel mode="full"` inside `MainLayout` — `AppRoutes.tsx:1194-1206`.
- `useAIStream` → `POST /api/ai/chat/stream` (SSE, AbortController wired) — `useAIStream.ts:549`, `api.ts:2257`.
- `/api/ai/chat/confirm` route is REAL: `ai.routes.ts:1183` (Zod-validated, `verifyToken`, paraphrase card for Deep Thinking gate). Previously unverified — now confirmed.
- Voice (TTS read-aloud): `POST /api/v10/teresa/tts` → `teresaTtsService.ts` → Gemini 2.5 Flash TTS; real PCM→WAV pipeline. Honest 503 when `GEMINI_API_KEY` absent. `useTTSPlayer.ts:82`, `teresaTtsService.ts:107`.
- Voice (Gemini Live real-time): `GET /api/v10/teresa/voice-config` → ephemeral token; `useTeresaVoice.ts` uses it to open a WebRTC/AudioContext session. `voiceAvailable` correctly starts `false` and is gated on `enabled && hasAudioContext && hasGetUserMedia && effectiveKey` — `useTeresaVoice.ts:88`. No false-positive.
- Voice (STT dictation): `useUniversalVoice` → `POST /api/voice/stt` → OpenAI Whisper-1 / Groq fallback — `voice.routes.ts:48`.
- Canvas: `parseChatCanvasIntent` at `UnifiedChatPanel.tsx:330` detects intent and opens `WorkCanvasDocumentPanel` split view. Proposal/approve/reject lifecycle fully implemented — `WorkCanvasDocumentPanel.tsx:1518-1553`.
- `work-canvas.routes.ts` has all Canvas CRUD routes (drafts, proposals, versions, export, save-to-workspace, create-output, workflow runs) — all mounted via `Gateway.ts:371`.
- Composer slash/@ command palette: `slashCommands.ts`, `composerMentions.ts`, `CommandPalette.tsx` — all present and wired.

**Mock / hardcoded:**
- `WorkCanvas` materializable targets cover only `idea`, `note`, `initiative`, `decision` — `work-canvas.routes.ts:41-46`. `project_brief`, `research_report`, `client_deliverable` remain honest stubs.

**Broken / Regression risks:**
- Canvas → Outputs handoff calls `window.location.assign('/presentations')` — `WorkCanvasDocumentPanel.tsx:1158` — routes to Presentations module, not Outputs Library. Full-page reload destroys React state.
- Raw `fetch('/api/my-work/chat-actions', …)` at `UnifiedChatPanel.tsx:1722`: no `AbortController`, no timeout — `/task` and `/decision` slash commands silently hang if server is slow.

---

## Intra-module flow & states

- Empty state: `isWelcomeEmptyState` → `showFullWelcomeEmptyState` / `showWorkPanelEmptyState` / `showCompactEmptyState` correctly computed — `UnifiedChatPanel.tsx:4036-4100`.
- Loading spinner: rendered at `4369-4377` for `isRehydratingConversation` — no infinite path found in happy flow.
- Error state: `options.onStreamError` appended as visible error message — `useAIStream.ts:1238`, `UnifiedChatPanel.tsx:1306-1310`.
- Abort race: if stream is aborted after an error-path branch enters, `setIsStreaming` is not called because `abortRef.current.aborted` causes early return at `useAIStream.ts:1231`. `abortStream()` at line 1256 resets it correctly — only the error-then-abort ordering in the same tick is a theoretical miss. Low probability, but no `finally` block to guarantee cleanup.
- Canvas `WorkCanvasRedirect.tsx` correctly redirects legacy `/ai/work-canvas?conversationId=<uuid>` to `/chat/<uuid>?workPanel=1` via SPA `<Navigate replace>`.

---

## UI/UX adherence

- Shell: `MainLayout` on both chat routes — consistent with all other modules.
- Tokens: `crimson-600` / `crimson-700` on voice CTA — `UnifiedChatPanel.tsx:4410`; `navy-950` / `navy-800` throughout split layout — `4173`, `4195`. No raw hex literals found.
- Rounded style: `rounded-full`, `rounded-2xl`, `rounded-xl` throughout — consistent.
- Dead UI removed: `src/views/AIChatWelcomeView.tsx` deleted — confirmed absent. `WordyView` and `ExceleView` deprecated to redirects — `AppRoutes.tsx:1304-1325`. `PrezentacjeView` and `TabeleView` now mounted with `ProtectedRoute` + `MainLayout` — `AppRoutes.tsx:1333-1358`.

---

## Cross-module handoffs

- **Entry**: Default post-login route → `/chat` — `AppRoutes.tsx:648`.
- **Canvas**: `parseChatCanvasIntent` detects `/canvas` slash or natural-language cue → opens `WorkCanvasDocumentPanel` split — wired.
- **Outputs (risk)**: `saveToOutputs` calls `Api.workCanvasExportDraft` then `window.location.assign('/presentations')` — `WorkCanvasDocumentPanel.tsx:1153-1158`. Wrong destination + SPA break.
- **My Work**: `parseChatSaveIntent` → `/api/my-work/*` for ideas/notes — wired.

---

## Risks / regressions / runtime

1. **Stale `vite.config.ts:48`** — `'./src/views/AIChatWelcomeView.tsx'` in dev warmup list; file was deleted. This will throw a Vite pre-transform `ENOENT` error on `npm run dev`. Remove the entry.
2. **Canvas→Outputs wrong route** (`WorkCanvasDocumentPanel.tsx:1158`): replace `window.location.assign('/presentations')` with `navigate(ROUTES.OUTPUTS_HUB)` or equivalent SPA route.
3. **Raw fetch without timeout** (`UnifiedChatPanel.tsx:1722`): use `fetchWithRetry` or add a 10-second `AbortController` to the `/api/my-work/chat-actions` call.
4. **Abort-race spinner** (`useAIStream.ts:1229-1231`): wrap error handler in `finally { setIsStreaming(false); setIsBotTyping(false); }` to close the narrow path where abort + error arrive in the same tick.
5. **`runtimeCapabilities.test.ts` and `chatV10Rollout.test.ts`** — still do not exist anywhere in the repo; the utility files they should cover remain untested.

---

## Top remaining gaps to reach 98

1. **Remove `AIChatWelcomeView.tsx` from `vite.config.ts:48` warmup list** — runtime blocker for dev server.
2. **Fix Canvas→Outputs handoff** — SPA navigate to correct Outputs route, remove full-page reload.
3. **Add timeout/abort to chat-actions fetch** — `UnifiedChatPanel.tsx:1722`.
4. **Add `finally` block in `useAIStream.ts`** streaming error handler.
5. **Expand WorkCanvas materializable targets** beyond 4 types.
6. **Add missing unit tests** — `runtimeCapabilities.test.ts`, `chatV10Rollout.test.ts`.
