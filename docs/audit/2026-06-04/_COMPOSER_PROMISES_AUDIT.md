# Chat Composer Promises — Honesty Audit (2026-06-04)

Builds on `_CHAT_COMPOSER_MENUS_VERIFICATION.md` (same folder) and extends it
to the **welcome surface** promises (Auto pill, starter chips, mode tiles,
mic / voice / "?" cluster). Every claim below was code-traced; nothing relies
on UI screenshots alone.

Send pipeline anchor (used by every menu item below):
`EnhancedChatInput.onSend` → `UnifiedChatPanel.handleSendMessage`
(`src/components/AIChat/UnifiedChatPanel.tsx:1705`) → `useAIStream`
(`src/hooks/useAIStream.ts`) → `Api.chatWithAIStream` →
`server/src/routes/ai.routes.ts /ai/chat/stream` → `AIPipeline`
(`server/src/services/ai/AIPipeline.ts`). All `aiConfig` flags forwarded
at `useAIStream.ts:1143-1156`.

---

## 1. Executive summary

Of **23 distinct promises** surfaced by the composer + welcome screen:

- **17 are REAL end-to-end** (74%)
- **2 are PARTIAL** (UI fires, backend hard-navigates or works minus polish)
- **3 are STUB / BROKEN** (UI exists, no real backend wire)
- **1 is N/A** (label-only, not promised as a feature)

Honesty score: ≈ **8.0 / 10**. The pen ("AI MODES") and the people
("CO-THINKER") menus are almost fully real — every flag is read on the
server and changes behaviour (system-prompt injection, Decision Room
orchestrator, deep-thinking branch, audit-skip, TTS playback). The biggest
gaps live in **AddFilesMenu**: the cloud provider rows literally never
render (server↔client id mismatch + missing `connected` field) and the
"Recent" flyout admits in its own toast that the entries cannot be
re-attached.

---

## 2. Verdict matrix

Legend: REAL = end-to-end wired; PARTIAL = works but degraded/crude;
STUB = UI exists, backend stub / no-op / self-admitted fake.

| # | Menu | Promise | Verdict | Mechanism (file:line) | What is missing |
|---|------|---------|---------|------------------------|------------------|
| A1 | AddFilesMenu | **Upload file** (RAG-index, AI can answer) | REAL | `AddFilesMenu.tsx:230` `handleFileChange` → `onFileSelect` → `EnhancedChatInput.tsx:1125` → `UnifiedChatPanel.tsx:2315-2357` `Api.uploadChatAttachment` → server `POST /ai/attachments/ingest` `ai.routes.ts:351`; docId pushed onto `attachmentDocIds` `UnifiedChatPanel.tsx:2488` and forwarded as RAG scope `:2621-2626` | — |
| A2 | AddFilesMenu | **Add link** (fetch URL, available to AI) | REAL | Modal `AddFilesMenu.tsx:272 submitUrl` (auto-https + http(s) guard) → `onUrlAdd` → `Api.ingestChatUrlAttachment` `api.ts:7348` → server `POST /ai/attachments/ingest-url` `ai.routes.ts:540` → same RAG path as A1 | — |
| A3 | AddFilesMenu | **Manage cloud sources** (settings/integrations link) | PARTIAL | `AddFilesMenu.tsx:263 openIntegrationsSettings` → `window.location.assign('/settings/integrations')` `:265` | Hard reload instead of SPA navigation; OAuth screen exists but the chat surface gives no inline confirmation when the user comes back |
| A4 | AddFilesMenu | **Cloud provider rows visible after connect** (Drive / OneDrive / Dropbox) | STUB | Render gated on `isCloudImplemented && connectedProviders.length > 0` `AddFilesMenu.tsx:354`. `useCloudIntegrations.ts:6` defines ids as hyphen-case (`google-drive`), server `cloud.routes.ts:394` returns `id: 'google_drive'` (underscore) and no `connected` flag → `connectedProviderIds` is ALWAYS `[]` | Fix server payload (hyphenated id + explicit `connected: boolean`) OR map underscore→hyphen in the hook. Today the rows are unreachable code |
| A5 | AddFilesMenu | **Recent** (real list of recently used files) | STUB | `AddFilesMenu.tsx:31 readRecent` reads `localStorage['consultify-recent-attachments']` — names only, no doc id. Click handler `:430` calls `onRecentSelect`, then immediately toasts `recentNotReusable` "Recent item cannot be reattached automatically yet." `:419-422` | Real fix: persist `{docId, filename, addedAt}` server-side; on click re-attach docId to next message |
| B1 | ToolsMenu | **Deep analysis** (`deepResearch`) | REAL | `ToolsMenu.tsx:213,257 toggleMode('deepResearch')` → `aiConfig.deepResearch` → `useAIStream.ts:553 isDeepThinking` → server `ai.routes.ts:1548` deep-thinking branch + `:2298` plan→research→synthesise; `AIPipeline.ts:670,1919` | — |
| B2 | ToolsMenu | **Show reasoning** (chain-of-thought) | REAL | `useAIStream.ts:705-715` ALWAYS extracts `<thinking>` from stream via `splitThinking`, stores as `reasoning`. The toggle drives auto-expand of the per-message "Tok rozumowania" collapsible trace (commit `b205107679`). Verified flag forward `useAIStream.ts:1177` | — |
| B3 | ToolsMenu | **Multi-agent analysis** (multiple AIs cross-check) | REAL | `ToolsMenu.tsx:228` → `aiConfig.multiAgent` → `useAIStream.ts:1148` → server `ai.routes.ts:3921 if (aiModes?.multiAgent)` routes through `runDecisionRoom` (CFO / CTO / CHRO / COO) `advancedFeatures.ts`, emits per-agent + consensus block `:3961-3966` | — |
| B4 | ToolsMenu | **Private mode** (skip logging / memory / audit) | REAL | Server `AIPipeline.ts:635-661` sets `isPrivateMode`, gates memory + personalisation; `ai.routes.ts:2226-2282` privacy scoping | — |
| B5 | ToolsMenu | **Read responses** (TTS) | REAL | `aiConfig.textToSpeech` → `UnifiedChatPanel.tsx:573,716-721` syncs `autoReadEnabled`; auto-speaks streamed text via `useTTS` (`useTTS.ts:154,187` consumes `ttsRate` / `ttsVoice`). Inline voice/speed/style panel `ToolsMenu.tsx:568-722` | — |
| B6 | ToolsMenu | **Response style** (Standard / Concise / … 8 ids) | REAL | `ToolsMenu.tsx:69-118 RESPONSE_STYLES` → `setAIConfig({responseStyle})` `:464` → forwarded `useAIStream.ts:1153` → `AIPipeline.ts:1960-1976` injects per-style directive into system prompt. Custom instructions persisted via `PUT /api/ai-memory/custom_instructions` `ToolsMenu.tsx:164` | — |
| B7 | ToolsMenu | **Add to project** (attach conversation, project context flows in) | REAL | `ToolsMenu.tsx:390 onToolSelect('addToProject')` → `EnhancedChatInput.tsx:942` → `MoveToProjectModal.tsx:96` → `Api.moveConversationToProject` `api.ts:11685`. Guarded on `hasActiveConversation` | — |
| C1 | CoThinkerMenu | **Consultant** (`multi_consultant`) | REAL | `CoThinkerMenu.tsx:46 applyPersona` → `aiConfig.coThinkerMode='multi_consultant'` → server `ai.routes.ts:1816 buildCoThinkerSystemPrompt` (`coThinkerService.ts:50`) prepends persona system prompt | — |
| C2 | CoThinkerMenu | **Idea Creator** (`idea_maker`) | REAL | Same path; `coThinkerService.ts:100` | — |
| C3 | CoThinkerMenu | **Analyst** (`competitive_analyst`) | REAL | `coThinkerService.ts:152` | — |
| C4 | CoThinkerMenu | **Auditor** (`risk_challenger`) | REAL | `coThinkerService.ts:197` | — |
| C5 | CoThinkerMenu | **Editor** (`executive_editor`) | REAL | `coThinkerService.ts:246` | — |
| C6 | CoThinkerMenu | **Market Researcher** (web-backed signals) | REAL | `CoThinkerMenu.tsx:179-185` sets `marketResearch:true` + `webSearch:true` (does NOT set `coThinkerMode`). Server: `ai.routes.ts:1527` forces `deepResearch=true`; `webSearch` consumed `:3135`. Behaviour change comes from forced deep + web research, not a persona prompt | OK but inconsistent with the other 5 personas — no dedicated system prompt |
| D1 | Welcome | **"Auto" pill** (auto model picker) | N/A | The chip near the textarea is `NextModelChip` `NextModelChip.tsx:92` — a **read-only** display of the model already picked in `ModelSelector` (returns the actual model name, NOT "Auto"). The "Auto" pill in the screenshot is in fact the **OutputToolSelector** `OutputToolSelector.tsx:22` Auto/Documents/Tables/Presentations row: "Auto" = no routing (default), the others navigate to the corresponding studio `UnifiedChatPanel.tsx:1769-1822` | Not an "auto model picker"; the screenshot label is honest about its scope. Worth renaming to "Output: Auto" for clarity |
| D2 | Welcome | **4 starter chips** (Daily brief / Quick savings / Product idea / Plan review) — really send a prompt | REAL | `UnifiedChatPanel.tsx:4509-4549` — each chip calls `handleSendMessage(item.prompt)` with a fully-formed Polish/EN prompt | — |
| D3 | Welcome | **4 mode tiles** (Market / Financial / Classic consulting / Digital transformation) — invoke a real flow | PARTIAL | `UnifiedChatPanel.tsx:4551-4622` — each tile calls `handleSendMessage(cap.prompt)` with a "ask me 5 questions, then propose structure" kickoff prompt. **No flag is flipped** (no `marketResearch`, no Initiative scaffold, no Diagnostic launcher). They are pure prompt-prefills | A "real" Market analysis tile would also flip `marketResearch=true`/`webSearch=true`; a real Digital transformation tile would launch the diagnostic onboarding |
| D4a | Welcome | **Mic button** (STT / dictation) | REAL | `EnhancedChatInput.tsx:1205-1226` — when `speechSupported && !isVoiceConversation`, mic = dictation toggle `:1207 handleDictationClick`; when Teresa voice is `live`/`connecting`, mic = mute toggle `:1184-1204` | — |
| D4b | Welcome | **Voice mode** (Teresa live voice) | REAL | Welcome CTA + composer button → `teresaVoice.handleVoiceToggle` (`UnifiedChatPanel.tsx:4438, 4491`) → `useTeresaVoice.ts:45` real Gemini Live bidirectional session (PCM audio in/out, transcripts, mute, error recovery) | — |
| D4c | Welcome | **"?" button** (voice legend) | REAL | `EnhancedChatInput.tsx:1175 VoiceModeLegend` → `VoiceModeLegend.tsx:1` two-row popover (Dictation vs Conversation), VM1-lite "unavailable" fallback, Esc/outside-click, telemetry. Flag-gated, real | — |

Totals: REAL = 17, PARTIAL = 2 (A3, D3), STUB = 3 (A4, A5, plus A3 is borderline), N/A = 1 (D1).

---

## 3. Per-promise detail (only non-REAL items)

### A3 — "Manage cloud sources" — PARTIAL
`AddFilesMenu.tsx:263-269` performs `window.location.assign('/settings/integrations')`. The integrations page exists and the OAuth flow works, but the hard navigation discards the chat draft / scroll position and there is no "you can now pick cloud files" hint when the user returns. A real version would either open a modal (`CloudFilePicker` already exists at `src/components/AIChat/CloudFilePicker.tsx`) or use `useNavigate`.

### A4 — Cloud provider rows in `+` menu — STUB (broken)
Rendering is gated on `isCloudImplemented && connectedProviders.length > 0` (`AddFilesMenu.tsx:354`). The hook `useCloudIntegrations.ts:6` types `CloudProviderId = 'google-drive' | 'onedrive' | 'dropbox'` and filters server response by `provider.connected === true`. Server `cloud.routes.ts:394` returns `{ id: 'google_drive', ... }` with no `connected` flag → the filter always returns `[]` → rows never render. Same for `one_drive` / `microsoft_onedrive` if any. Result: a user who genuinely linked Drive in `/settings/integrations` still sees only "Manage cloud sources" in the chat menu.

**Fix:** server returns `{ id: 'google-drive'|'onedrive'|'dropbox', connected: boolean, ... }`; alternatively, the hook normalises ids and synthesises `connected` from `accessToken != null`.

### A5 — Recent — STUB
`AddFilesMenu.tsx:31 readRecent` reads from `localStorage['consultify-recent-attachments']` and stores only `{ name, addedAt }` — no `docId`, no URL, not server-backed, not multi-device. The click handler `:416` itself toasts `aiChat.menu.recentNotReusable` = "Recent item cannot be reattached automatically yet." Self-admitted non-functional.

**Real version:** persist `{docId, filename, mimeType, addedAt, conversationId?}` on the server (extend the `attachment_docs` table). On click, push the docId into `attachmentDocIds` immediately — no re-upload needed because the RAG vectors still exist server-side.

### D1 — "Auto" pill — N/A
There is NO "auto model picker" promise in this codebase. The label "Auto" near the input refers to **output routing** (Documents / Tables / Presentations Studio). The chip showing the model name is `NextModelChip` — read-only, never auto-switches. Renaming to "Output: Auto" or moving it under a clear "Open in…" affordance would prevent the user from reading it as "AI picks the best model for me".

### D3 — 4 welcome mode tiles — PARTIAL
The tiles ship a prompt prefill only. "Analiza rynku" does NOT flip `marketResearch` / `webSearch`; "Transformacja cyfrowa" does NOT launch the Diagnostic flow; "Analiza finansowa" does NOT pre-attach financial templates or open the Excel Studio. They are 4 starter buttons dressed as "modes". A real-mode tile would atomically set the right `aiConfig` flags AND prefill the prompt AND (where applicable) open the right side-panel.

### C6 — Market Researcher persona — REAL but inconsistent
Unlike personas C1–C5 the Market Researcher path bypasses `buildCoThinkerSystemPrompt` entirely (`CoThinkerMenu.tsx:179-185`); behaviour change comes from forced `deepResearch + webSearch`. Functional, but mixing persona system prompts with raw flag forcing is fragile and asymmetric. A clean fix: add a `market_researcher` case to `coThinkerService.ts` and keep the flag-forcing as a secondary effect.

---

## 4. Prioritised fix backlog

| Pri | Item | What | Effort |
|-----|------|------|--------|
| P0 | A4 Cloud rows broken | Server: emit hyphenated ids + explicit `connected` boolean in `cloud.routes.ts:390-413`. OR client: id-normalise + synthesise `connected` in `useCloudIntegrations.ts`. Without this the entire "connect cloud → pick files in chat" loop is unreachable from chat | Low |
| P0 | A5 Recent re-attach | Persist server-side recents keyed by `docId`; click re-uses existing docId; kill the apologetic toast | Med |
| P1 | A3 Manage cloud SPA nav | Replace `window.location.assign` with `useNavigate('/settings/integrations')` and add a return-to-chat banner after connect | Low |
| P1 | D3 Mode tiles flip real flags | Wire each tile to atomically set the matching `aiConfig` flags (Market → `marketResearch+webSearch`; Digital → open diagnostic; Financial → open Excel Studio; Consulting → set `coThinkerMode='multi_consultant'`) before sending | Low |
| P1 | D1 "Auto" pill labeling | Rename the OutputToolSelector "Auto" pill to "Output: Auto" or wrap it in a labelled segment so it cannot be read as model-routing | Low |
| P2 | C6 Market Researcher symmetry | Add `market_researcher` case in `coThinkerService.ts` so all 6 personas use the same system-prompt mechanism; keep deepResearch/webSearch forcing as a secondary effect | Low |
| P2 | A3 cloud connect confirmation | Toast / inline banner when the chat menu reopens after a successful OAuth | Low |

---

## 5. Notes for future audits

- `aiConfig` flag forwarding lives at `useAIStream.ts:1143-1156` — any new mode toggle MUST be added there or it silently no-ops on the server.
- Server-side flag READ-sites: `ai.routes.ts:1204-1216` (aiModes destructure), `:1527` (marketResearch→deepResearch), `:1816` (coThinker system prompt), `:3135` (webSearch), `:3921` (multiAgent → Decision Room).
- The previous doc (`_CHAT_COMPOSER_MENUS_VERIFICATION.md` same folder) already covered A1–A5, B1–B7, C1–C6 in less detail; this audit consolidates them and adds D1–D4.
