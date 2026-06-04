# Chat Composer Menus — Deep Functional Verification (2026-06-04)

Scope: the 3 composer menus rendered in `src/components/AIChat/EnhancedChatInput.tsx:1113-1128`.
Method: code-only tracing UI handler → state/store → API route → effect. A flag counts as WORKS only if it is **READ** somewhere that changes behaviour, not merely set.

Send pipeline anchor: `EnhancedChatInput.onSend` → `UnifiedChatPanel.handleSendMessage` (`src/components/AIChat/UnifiedChatPanel.tsx:1705`) → `useAIStream` (`src/hooks/useAIStream.ts`) → `Api.chatWithAIStream` → `server/src/routes/ai.routes.ts` (`/ai/chat/stream`) → `AIPipeline` (`server/src/services/ai/AIPipeline.ts`). All `aiConfig` AI-mode flags are forwarded to the server at `useAIStream.ts:1143-1156`.

---

## 1. AddFilesMenu (`+`) — `src/components/AIChat/AddFilesMenu.tsx`

| Item | Status | Flow (file:line) | Notes |
|------|--------|------------------|-------|
| Upload file (PDF/TXT/MD/CSV/JSON) | **WORKS** | Handler `AddFilesMenu.tsx:230` → `onFileSelect` → `EnhancedChatInput.tsx:890` attaches to composer state → `onSend(value, attachments)` `:775` → `UnifiedChatPanel.tsx:2315-2357` uploads each via `Api.uploadChatAttachment` → `docId` → `attachmentDocIds` `:2488` → passed in context `:2621-2626` → server RAG filters to those docs. Ingest route `api.ts:7339`. | Full end-to-end: file is extracted, ingested, and scoped into the AI request. |
| Add link (paste URL to read & cite) | **WORKS** | `AddFilesMenu.tsx:272` submitUrl (auto-prepends https, http(s) guard) → `onUrlAdd` → `EnhancedChatInput.tsx:894` adds `{kind:'url'}` attachment → `UnifiedChatPanel.tsx:2394-2417` `Api.ingestChatUrlAttachment` → `docId` → same `attachmentDocIds` RAG path. Route `api.ts:7360`. | Page content is fetched server-side and cited via RAG. |
| Manage cloud sources | **PARTIAL** | `AddFilesMenu.tsx:263` `openIntegrationsSettings` → `window.location.assign('/settings/integrations')` `:265`. | Navigation works (hard reload, not SPA route). Lands on integrations page; functional but crude. |
| Cloud provider rows (Drive/OneDrive/Dropbox) | **BROKEN** | Render-gated on `isCloudImplemented && connectedProviders.length>0` `:358`. `useCloudIntegrations.ts:30` filters `providers.filter(p=>p.connected)`, but server `cloud.routes.ts:390-413` returns providers with **no `connected` field** and id `google_drive` (underscore) vs hook's `google-drive` (hyphen). → `connectedProviderIds` always `[]` → rows never render. | Provider list never shows in chat; only the "Manage cloud sources" hint renders. ID mismatch + missing `connected` flag. |
| Recent (cloud files) | **STUB** | `AddFilesMenu.tsx:31 readRecent` reads `localStorage['consultify-recent-attachments']` — NOT `useCloudIntegrations`. Click handler `:430` calls `onRecentSelect` then toasts `recentNotReusable` "cannot be reattached automatically yet" `:434`. | Lists local upload *names* only (not cloud files, not real files). Selecting does nothing actionable. Self-admitted stub. |

---

## 2. ToolsMenu (pen, "AI MODES") — `src/components/AIChat/ToolsMenu.tsx`

Toggle handler: `toggleMode` `ToolsMenu.tsx:257` → `setAIConfig({[modeId]: newValue})`. Flags forwarded `useAIStream.ts:1143-1155`.

| Item | Status | Read-site (file:line) | Notes |
|------|--------|------------------------|-------|
| Deep analysis (`deepResearch`) | **WORKS** | Client: `useAIStream.ts:553` `isDeepThinking`. Server: `ai.routes.ts:1548` deep-thinking branch, `:2298`, `AIPipeline.ts:670,1919`. | Full deep-thinking orchestrator path. |
| Show reasoning (`showReasoning`) | **WORKS** | Client: `useAIStream.ts:664` renders `<thinking>` as visible blockquote when on, strips otherwise. Also sets `maxMode` `ToolsMenu.tsx:261`. Sent to server `:1145`. | Visibly changes streamed output. |
| Multi-agent analysis (`multiAgent`) | **WORKS** | Server: `ai.routes.ts:3921` routes through `runDecisionRoom` (CFO/CTO/CHRO/COO) when on, emitting multi-perspective + consensus. | Distinct pipeline; clearly changes behaviour. |
| Private mode (`privateMode`) | **WORKS** | Server: `AIPipeline.ts:635-661` sets `isPrivateMode`, gates memory/personalisation; `ai.routes.ts:2226-2282` privacy scoping. | Disables long-term memory/personalisation as advertised. |
| Read responses / TTS (`textToSpeech`) | **WORKS** | `UnifiedChatPanel.tsx:573,716-721` syncs `autoReadEnabled` from `aiConfig.textToSpeech`; auto-speaks streamed text `:1110,1439` via `useTTS` (`ttsRate`/`ttsVoice` consumed `useTTS.ts:154,187`). | Client-side TTS; rate/voice/style sub-controls all live. |
| Response style (Standard/…) | **WORKS** | `setAIConfig({responseStyle})` `ToolsMenu.tsx:465` → sent `useAIStream.ts:1153` → `AIPipeline.ts:1960-1976` injects a per-style directive into the system prompt. All 8 ids mapped (`normal/concise/executive/analyst/formal/coach/professional/friendly`). | Custom instructions saved to `/api/ai-memory/custom_instructions` `ToolsMenu.tsx:164`. |
| Add to project | **WORKS** | `ToolsMenu.tsx:390` → `onToolSelect('addToProject')` → `EnhancedChatInput.tsx:942` → `UnifiedChatPanel`/`MoveToProjectModal.tsx:96` → `moveConversationToProject` → `Api.moveConversationToProject` (`api.ts:11685`). Guarded on active conversation. | Real persistence. |

---

## 3. CoThinkerMenu (people, "CO-THINKER") — `src/components/AIChat/CoThinkerMenu.tsx`

Selection: `applyPersona` `CoThinkerMenu.tsx:172` → sets `coThinkerMode` (mapped id) or `marketResearch`. Forwarded `useAIStream.ts:1148,1147`. Server injects persona prompt at `ai.routes.ts:1816` via `buildCoThinkerSystemPrompt` (`server/src/services/ai/coThinkerService.ts:301`).

| Persona | Status | Read-site (file:line) | Notes |
|---------|--------|------------------------|-------|
| Consultant (`multi_consultant`) | **WORKS** | `coThinkerService.ts:50` real persona prompt prepended `ai.routes.ts:1824`. | |
| Idea Creator (`idea_maker`) | **WORKS** | `coThinkerService.ts:100`. | |
| Analyst (`competitive_analyst`) | **WORKS** | `coThinkerService.ts:152`. | |
| Auditor (`risk_challenger`) | **WORKS** | `coThinkerService.ts:197`. | |
| Editor (`executive_editor`) | **WORKS** | `coThinkerService.ts:246`. | |
| Market Researcher | **WORKS** | Does NOT set `coThinkerMode`; sets `marketResearch:true` + `webSearch:true` `CoThinkerMenu.tsx:179-185`. Server: `ai.routes.ts:1527` forces `deepResearch=true` when `marketResearch` set → web-backed research path; `webSearch` consumed `ai.routes.ts:3135`. | Different mechanism than the other 5 (no persona prompt) — behaviour change comes from forced deep/web research, not a persona system prompt. Active pill resolves it correctly (`CoThinkerMenu.tsx:100`). |

---

## "Less is more" — verbose descriptions to trim (owner prefers minimal text)

- **AddFilesMenu**: "Upload file" supported-types subtext (`:340`), "Add link" hint "Paste a URL to read and cite" (`:354`), cloud setup paragraph (`:374-379`), URL modal description + privacy hint (`:465-468, :501-506`). The whole inline cloud paragraph could collapse to a single "Manage cloud sources" link.
- **ToolsMenu**: per-mode `descKey` subtitles are defined but the AI-MODES list rows render label only (no desc) — descriptions exist in i18n but are largely unused here; Response-Style modal cards each carry a `descKey` line (`:489`) that could be cut to label-only.
- **CoThinkerMenu**: every persona row renders a full description line (`:289-291`, e.g. "Broad strategy framing and decision-ready recommendations."). Six rows of secondary text — strongest candidate for trimming to icon+label.

---

## Summary of broken/weak items

1. **Cloud provider rows (AddFilesMenu) — BROKEN**: server `/cloud/providers` returns no `connected` flag and id `google_drive` ≠ hook's `google-drive`; rows can never render. Fix server payload (add `connected`, hyphenate ids) to light up in-chat cloud picking.
2. **Recent (AddFilesMenu) — STUB**: localStorage name-list, not cloud, not re-attachable (explicit toast).
3. **Manage cloud sources — PARTIAL**: works via hard `window.location.assign`, not SPA navigation.

Everything in ToolsMenu and CoThinkerMenu is fully wired and behaviour-changing.
