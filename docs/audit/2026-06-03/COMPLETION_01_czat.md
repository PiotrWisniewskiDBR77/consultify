# COMPLETION DOSSIER — Module 01: Czat / Teresa Chat Engine

**Audit date:** 2026-06-03  
**Score trajectory:** 68 (2026-06-02 audit) → 84 (2026-06-03 re-audit) → **current: ~87/100**  
**Gap to 100%:** 13 points across 7 concrete items  

---

## 1. Purpose / Goal / Vision

Teresa is the **hero entry point and primary door** of Consultify. Vision (from `01_PURPOSE.md`, `RAW_TARGET_STATE_2_0_PACKET.md`, `RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md`):

- "Conversational Work OS" — not a chatbot but a consulting partner that conducts work sessions and executes consulting work through the right module/runtime.
- Every conversation leads to **context → artifact → decision → task → execution → report**, never just a text reply.
- Mandatory governed handoff chain: `conversation → clarify → draft → proposal → review_required → accept/reject → owner-lane materialization → read-back/audit`.
- Harvey-for-consulting parity: project instructions, source provenance, artifact versioning, diff/apply/rollback, meeting recap pipeline, knowledge lifecycle, consulting playbooks, multi-agent orchestration, voice-first interaction.
- Calm power UX: advanced capabilities through chips, dropdowns, side panels and Menu 3 — no heavy persistent toolbars.

At 100% Teresa is **indistinguishable from a senior consultant who talks, thinks on screen, drafts documents, and routes work** without leaving the conversation.

---

## 2. Readiness to 100% — Score and Gap

**Current honest score: 87/100**

What moved the score since the June 02 audit (+19 points):
- `AIChatWelcomeView.tsx` (2400 LOC dead code) deleted — confirmed absent
- Canvas P0 startup path wired: `parseChatCanvasIntent` → `WorkCanvasDocumentPanel` split, full approve/reject lifecycle present (`WorkCanvasDocumentPanel.tsx:1518-1553`)
- Server TTS endpoint `POST /api/v10/teresa/tts` created (`teresa.routes.ts:129`) and `TeresaTTSPlayer` replaces browser `speechSynthesis` polling — now real Gemini PCM/WAV pipeline
- Voice CTA on welcome screen wired and gated on `voiceAvailable` (`UnifiedChatPanel.tsx:4405-4428`)
- PL i18n for all 9 composer slash commands and voice strings added (`public/locales/pl/translation.json:6523-6569`)
- `AppRoutes.ai-chat-routing.test.tsx` now exists (`tests/components/AppRoutes.ai-chat-routing.test.tsx` — confirmed in directory)
- `EnhancedChatInput.teresaVoice.test.tsx` now exists (`src/components/AIChat/__tests__/EnhancedChatInput.teresaVoice.test.tsx`)
- `vite.config.ts` warmup list cleaned — `AIChatWelcomeView` entry is gone (confirmed `vite.config.ts:43-50`)

**Remaining gap (13 points):**

| # | Issue | File:Line | Severity |
|---|---|---|---|
| G1 | Canvas → Outputs hard-navigates to `/presentations` (wrong route, full-page reload destroys React state) | `WorkCanvasDocumentPanel.tsx:1158` | P0 |
| G2 | Raw `fetch('/api/my-work/chat-actions', …)` has no `AbortController` or timeout — `/task` and `/decision` slash commands silently hang | `UnifiedChatPanel.tsx:1722` | P0 |
| G3 | `useAIStream` error handler: if abort and error arrive in same tick, `setIsStreaming(false)` is unreachable (no `finally` block) — narrow but real spinner-freeze path | `useAIStream.ts:1229-1238` | P1 |
| G4 | `Wave5–Wave9` panel files exist as dead code (`Wave5ArtifactRuntimePanel.tsx` through `Wave9OutcomeAIOpsPanel.tsx`) — lazy-imported in `AppRoutes.tsx:192-213` and routed to internal-only paths (`AppRoutes.tsx:1242-1276`) but never cleaned | `AppRoutes.tsx:191-213` | P1 |
| G5 | `WorkCanvas` materializable targets still only cover 4 types (`idea`, `note`, `initiative`, `decision`) — `project_brief`, `research_report`, `client_deliverable` silently fail without a real error message to the user | `work-canvas.routes.ts:41-46` | P1 |
| G6 | `runtimeCapabilities.test.ts` and `chatV10Rollout.test.ts` still do not exist; CODEMAP claims them | `docs/modules/01_czat/CODEMAP.md` | P2 |
| G7 | Canvas e2e smoke test confirming the full `conversation → canvas draft → review_required → accept/reject → owner-lane read-back` path has no automated test coverage; only manual smoke tested | `tests/integration/ai/` (gap) | P2 |

---

## 3. Teresa Integration — Depth and Missing

**Shipped and wired:**
- SSE streaming: `useAIStream.ts:549` → `POST /api/ai/chat/stream` (`ai.routes.ts:1422`) — production quality with AbortController, retry, `chatPolicyGateway`
- Org-context grounding: `OrganizationContextService` present, `privacyMode` flag wired through `useAIStream.ts:1210`, `isPrivateMode` (`UnifiedChatPanel.tsx:794`)
- Voice STT (Whisper/Groq): `useUniversalVoice` → `POST /api/voice/stt` (`voice.routes.ts:48`)
- Voice TTS read-aloud: `TeresaTTSPlayer` → `useTTSPlayer` → `POST /api/v10/teresa/tts` (`teresa.routes.ts:129`) — Gemini PCM→WAV pipeline, honest 503 when key absent
- Voice bidirectional Gemini Live: `useTeresaVoice.ts` → `GET /api/v10/teresa/voice-config` ephemeral token → WebRTC/AudioContext session — fully wired, operational when `GEMINI_LIVE_SERVER_KEY` set
- `VoiceConversationOverlay.tsx` UI shell present; `TeresaVoiceContext.tsx` mints ephemeral token
- Canvas intent detection: `parseChatCanvasIntent` + `canvasStreamIntentDetector.ts` at `UnifiedChatPanel.tsx:330`
- Canvas proposal lifecycle: `WorkCanvasDocumentPanel.tsx` has `approveCanvasOperation` (line 123) and `rejectPendingOperation` (line 1523)
- Multi-agent mode UI: `WorkModeMenu.tsx` exposes `multi_agent` option; backend branches to Decision Room orchestration at `ai.routes.ts:3918-3965`
- Memory candidate detection: `memoryCandidate` surfaced and guarded (`UnifiedChatPanel.tsx:1523`)
- `chatPolicyGateway.ts`, `ragService.ts`, `chatPermissionService.ts` all present and tested

**Missing for full vision:**
- **Canvas e2e path unverified by automated test** — backend routes exist, client UI present, but no integration test proves the full round-trip
- **Diff/apply/reject/rollback**: documented as P1 target, no implementation (`work-canvas.routes.ts` has versions endpoint but client diff-view absent)
- **Agent run plan**: multi-agent UI toggle exists but no pre-flight plan/approval card shown before multi-step work
- **Source health/freshness badges**: `CitationList.tsx` exists but no staleness/trust-level display
- **Project instructions / workspace rules**: no persistent per-project Teresa personality/source policy UI
- **Meeting recap pipeline**: `fireflies` MCP available in environment but no chat→transcript→summary→artifact path wired
- **Knowledge lifecycle**: `OrganizationMemoryPanel` disabled (`UnifiedChatPanel.tsx:50, 95`) — panel removed, hook commented out
- **Consulting playbooks / skills selector**: `WorkModeMenu` personas present (`CoThinkerModeSelector`) but no domain-specific playbook (business case, PMO review, risk register)
- **Cross-conversation intelligence**: scoped to current conversation; no project-level recap
- **Server-proxied Gemini Live** (Phase 2): currently client-direct with ephemeral token — acceptable for Wave 1 but token TTL is 60s; Phase 2 proxying through Socket.IO deferred

---

## 4. System Integration

**Working:**
- `/chat` is the default post-login route (`AppRoutes.tsx:648`) — Teresa is literally door #1
- `ConversationRouteSync.tsx` auto-selects most recent conversation on load (`AppRoutes.tsx:1382`)
- My Work handoff: `parseChatSaveIntent` → `/api/my-work/*` for ideas/notes — wired
- Canvas → My Work, Initiatives, Execution all preserved as proposal-only handoffs (no silent writes)
- `WorkCanvasRedirect.tsx` handles legacy `/ai/work-canvas?conversationId=<uuid>` → `/chat/<uuid>?workPanel=1`
- `KimiWorkspace` (PrezentacjeView, TabeleView) now mounted with `ProtectedRoute + MainLayout` (`AppRoutes.tsx:1333-1358`)

**Broken:**
- **Canvas → Outputs wrong route**: `WorkCanvasDocumentPanel.tsx:1158` calls `window.location.assign('/presentations')` — navigates to Presentations module not Outputs Library, full-page reload destroys React state. Should be `navigate(ROUTES.OUTPUTS_HUB)` or equivalent SPA route.

**Target / deferred (not broken but incomplete):**
- Canvas → `09_outputs` full pipeline: export creates a markdown blob but the Outputs Library (`/outputs`) does not display it as a card yet — the Canvas→Outputs link is one-way and unverified end-to-end
- `WordyView` and `ExceleView` are deprecated to redirects (`AppRoutes.tsx:1304-1325`) — correct posture but Wordy/Excele/EE lanes remain gated
- No `ARTIFACT_LINEAGE_MATRIX` row for Canvas-created artifacts yet

---

## 5. Completion Plan to 100%

### P0 — Runtime correctness blockers (est. 1.5h total)

**P0-A: Fix Canvas → Outputs route** (`WorkCanvasDocumentPanel.tsx:1158`)
- Replace `window.location.assign('/presentations')` with `navigate(ROUTES.OUTPUTS_HUB ?? '/outputs')` using the `useNavigate` hook already imported in the file.
- Verify Outputs Library receives and displays the exported markdown card.
- Effort: 0.5h. Owner: Piotr.

**P0-B: Add timeout to `/api/my-work/chat-actions` fetch** (`UnifiedChatPanel.tsx:1722`)
- Wrap the bare `fetch` in a 10-second `AbortController`: `const ac = new AbortController(); setTimeout(() => ac.abort(), 10_000); fetch(…, { signal: ac.signal })`.
- Effort: 0.25h.

### P1 — Quality and completeness (est. 5h total)

**P1-A: Add `finally` block to `useAIStream` error handler** (`useAIStream.ts:1228-1238`)
- Move `setIsStreaming(false); setIsBotTyping(false)` to a `finally {}` block that wraps the try/catch; keep early return inside the abort check. Eliminates the narrow spinner-freeze on concurrent abort+error.
- Effort: 0.25h.

**P1-B: Delete or gate Wave5–9 dead panels** (`AppRoutes.tsx:192-213`, five files in `src/components/AIChat/`)
- `Wave5ArtifactRuntimePanel.tsx`, `Wave6ContextLearningPanel.tsx`, `Wave7ConnectorAdminPanel.tsx`, `Wave8AgentCatalogPanel.tsx`, `Wave9OutcomeAIOpsPanel.tsx` — none visible to end users; they are internal-only admin routes. Either delete the files and their `AppRoutes` entries, or keep them strictly as `INTERNAL_TOOLS` routes behind an `isSuperAdmin` guard. Current status: lazy-imported, always in the bundle.
- Effort: 0.5h.

**P1-C: Real error response for unsupported Canvas targets** (`work-canvas.routes.ts:41-46`)
- Return `HTTP 422 { error: "target_not_yet_supported", message: "project_brief / research_report / client_deliverable are not yet available" }` for targets outside `MATERIALIZABLE_TARGETS`.
- Client (`WorkCanvasDocumentPanel.tsx`) must render a visible inline "Not available yet" message rather than a silent failure.
- Effort: 0.5h (server) + 0.5h (client toast/inline).

**P1-D: Canvas e2e automated test** (`tests/integration/ai/`)
- Add one integration test in `tests/integration/ai/ai-chat.routes.test.ts` (or a new `work-canvas.e2e.test.ts`) that proves: SSE stream returns `canvasDraftId` field → client stores in `requestedCanvasDraftId` → `PATCH /api/work-canvas/proposals/:id/approve` succeeds → response includes `readBack`.
- Effort: 2h.

**P1-E: CODEMAP cleanup** (`docs/modules/01_czat/CODEMAP.md`)
- Remove claims for `runtimeCapabilities.test.ts` and `chatV10Rollout.test.ts` (files do not exist) or create minimal stub tests for the utility functions they should cover.
- Effort: 0.5h.

### P2 — Vision-completeness (Week 2+, est. 20h)

| Item | File / location | Effort |
|---|---|---|
| Diff/apply/reject/rollback for Canvas AI edits | `CanvasEditor/canvasDiffOps.ts` exists; wire into `WorkCanvasDocumentPanel` | 6h |
| Agent run plan card before multi-step work | New `AgentRunPlanCard` in `AgentAudit/`; shown when `multiAgent === true` | 3h |
| Source health/freshness badges on Canvas | `CitationList.tsx` + `SourcesStrip.tsx` + backend source metadata | 3h |
| Project instructions / workspace rules | New per-project settings UI + `projectInstructions` field in AI request body | 4h |
| Knowledge lifecycle (re-enable `OrganizationMemoryPanel`) | Un-comment `UnifiedChatPanel.tsx:50,95`; fix `useOrgMemory` hook | 2h |
| Server-proxied Gemini Live Phase 2 | Socket.IO namespace `/teresa-voice`; proxy PCM through server | 6h |
| Canvas full e2e smoke test automated | Playwright or Vitest browser test for full user journey | 4h |

**Owner note:** Voice Phase 1B (bidirectional Gemini Live) requires `GEMINI_LIVE_SERVER_KEY` set in Railway. TTS Phase 1A requires `GEMINI_API_KEY`. Diff/rollback requires `CanvasEditor` TipTap extensions already present (`canvasDiffOps.ts`, `canvasAIDiffExtensions.ts`) — only wiring is missing.

---

## 6. Definition of 100% for This Module

Teresa Chat Engine is 100% when:

1. Every new user lands at `/chat`, says something, and immediately gets a streaming consultant-grade response with source attribution.
2. The full `conversation → canvas draft → review_required → accept/reject → owner-lane read-back` path works end-to-end with no silent failures — automated test proves it.
3. Canvas-accepted artifacts navigate to Outputs Library via SPA route (no full-page reload).
4. Voice conversation starts in two taps (Gemini Live when key present, graceful degradation when absent).
5. TTS reads Teresa's response aloud via server-routed Gemini TTS (no browser speechSynthesis).
6. Every slash command works in PL and EN; no silent timeouts on `/task` or `/decision`.
7. All Canvas materializable targets either work or return a human-readable "not yet available" message.
8. Diff/apply/reject/rollback exists for Canvas AI edits (P2).
9. Zero dead-code panels in production bundle.
10. Automated test suite covers routing, streaming, voice gate, Canvas lifecycle, and Canvas→Outputs handoff.
