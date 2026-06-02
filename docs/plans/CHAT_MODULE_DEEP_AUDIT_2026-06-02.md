# Chat Module — Deep Audit & GO/NO-GO Report

**Date:** 2026-06-02
**Branch:** `integration/staging-demo-unify-2026-05-28`
**Scope:** Composer buttons (functional realization, not just "opens"), individual + team chat history, building projects in chat (individual + team), security/tenancy, concurrency/idempotency.
**Method:** End-to-end code trace (UI → store/hook → API → route → DB) across `src/components/AIChat/`, `src/hooks/useAIStream.ts`, `src/store/useConversationStore.ts`, `server/src/routes/{conversations,chat-projects,ai}.routes.ts`, `server/src/services/chatPermissionService.ts`, migrations.

---

## Verdict: **NO-GO** (conditional)

Two hard blockers must be fixed before this ships. The feature surface is largely real and well-built — the composer, history persistence, and chat-projects core flows genuinely work end-to-end — but there is **one CRITICAL cross-tenant security hole** and **one BROKEN streaming-retry bug that corrupts message content**, plus a missing idempotency layer that lets duplicates accumulate.

| # | Blocker | Type | Location |
|---|---------|------|----------|
| B1 | IDOR on `/summarize` — read + mutate ANY conversation by UUID | Security (CRITICAL) | `conversations.routes.ts:1438-1525` |
| B2 | Auto-retry duplicates/garbles assistant text (`fullText` not reset) | Correctness (BROKEN) | `useAIStream.ts:1185-1212` |

After B1/B2 are fixed and the High items below are triaged, this can move to **GO**.

---

## 1. Composer buttons — VERDICT: FUNCTIONAL ✅

All three composer buttons are realized end-to-end. Attachments are uploaded and reach the stream context; tool toggles and personas flow into the backend request (not cosmetic).

| Feature | Verdict | Evidence |
|---|---|---|
| "+" Local file upload | FUNCTIONAL | `AddFilesMenu.tsx:230-256` → `EnhancedChatInput.tsx:670-672` → `handleSend:618` → upload `Api.uploadChatAttachment` (`api.ts:7003`) → `attachmentDocIds` into `fullContext` (`AIChatWelcomeView.tsx:977,1028`) |
| "+" URL attachment (normalize + http(s) guard) | FUNCTIONAL | `AddFilesMenu.tsx:272-300` (`https://` prefix; rejects non-http(s)) → `Api.ingestChatUrlAttachment` (`api.ts:7032`) |
| "+" Recent files (reattach) | NO-OP (placeholder, labeled) | `AddFilesMenu.tsx:430-437` toasts "cannot be reattached yet"; `onRecentSelect` never wired |
| "+" Cloud picker (download → attach) | FUNCTIONAL when connected | `EnhancedChatInput.tsx:704-715` → `Api.downloadCloudFile` (`api.ts:15455`) |
| "+" Cloud in-chat connect | Stub by design | redirects to `/settings/integrations` |
| Tools: AI mode toggles | FUNCTIONAL | `ToolsMenu.tsx:257-270` → `setAIConfig` → `useAIStream.ts:1143-1156` → body `aiModes` (`api.ts:2191`) |
| Tools: response style / custom instructions | FUNCTIONAL | `ToolsMenu.tsx:465`; persist `PUT /api/ai-memory/custom_instructions` |
| Tools: "Add to project" + guard toast | FUNCTIONAL | guard in `ToolsMenu.tsx:378-389` AND `EnhancedChatInput.tsx:722-741` → `MoveToProjectModal` |
| Co-Thinker persona → backend | FUNCTIONAL | `CoThinkerMenu.tsx:172-195` → `coThinkerMode`/`marketResearch` → `useAIStream.ts:1147-1148` |

**Minor gaps (low/trivial):**
- `onToolSelect` parent callback is never passed by `AIChatWelcomeView`/`UnifiedChatPanel`, so `EnhancedChatInput`'s `onToolSelect?.()` calls are dead (no functional impact — toggles persist via `aiConfig`, modal opens via internal state). `EnhancedChatInput.tsx:872-877`.
- `activeModeCount` omits `multiAgent` → badge undercounts. `ToolsMenu.tsx:207-209`.
- Dead components: `ImageAttachment.tsx`, `CoThinkerModeSelector.tsx` not imported anywhere.
- Selecting a response style overwrites the custom-instructions textarea without saving. `ToolsMenu.tsx:466-467`.

---

## 2. Individual chat history — VERDICT: PARTIAL ⚠️

Persistence by `conversationId`, refresh/restore, and the generic `metadata` JSONB round-trip all **work**. Three real gaps.

| Item | Verdict | Evidence |
|---|---|---|
| Persistence by conversationId | WORKS | `conversations.routes.ts:805-868`; schema `20260331_p35b_canonical_model_completion.sql:27,42` |
| Refresh + thread restore | WORKS | `ConversationRouteSync.tsx:40-77`; rehydrate `useConversationStore.ts:1789-1852`; `GET /:id ORDER BY created_at ASC` (`:495`) |
| `attachments` / `failedAttachments` / `canvasContext` round-trip | WORKS (via metadata) | stored in `metadata` JSONB (`UnifiedChatPanel.tsx:2498-2514`), parsed `useConversationStore.ts:1890-1901` |
| `attachmentDocIds` round-trip | **BROKEN / by design** | only added to AI `context` at send (`UnifiedChatPanel.tsx:2606`), never in `userMessageMetadata` (`:2495-2516`); no DB column → RAG scope lost on reload |

**Gaps:**
1. **`attachmentDocIds` never persisted** — after reload the conversation no longer knows which KB docs were attached; RAG scoping cannot be reconstructed. *(High — data fidelity)*
2. **`conversation_message_attachments` table is write-only for the chat UI** — `GET /:id` returns grouped attachments (`conversations.routes.ts:520-523`) but `mapApiMessage` (`useConversationStore.ts:1903-1924`) reads only `metadata`, not `api.attachments`. Attachments survive purely because they're duplicated in `metadata`. Any path writing only to the table would lose them on refresh. *(Medium)*
3. **No retry / durable queue on save failure** — `useConversationStore.ts:1145-1158` keeps a `localError` bubble but never retries; `UnifiedChatPanel.tsx:2524-2526` swallows the user-message save error and proceeds to the AI call → after refresh you can get an AI reply whose user prompt is missing. *(High)*
4. *(Latent)* possible `message_count` double-count if legacy trigger `trg_message_insert_update_conversation` (`073_conversations.sql:155`) coexists with the route `UPDATE` (`conversations.routes.ts:860`).
5. *(Low)* `ORDER BY created_at ASC` has no `id`/`seq` tiebreaker (see §5).
6. *(Cleanup)* `server/src/validators/conversations.validators.ts` is stale/unused — route uses richer inline Zod schemas; importing the stale file would reject valid payloads.

---

## 3. Team / shared history + tenancy — VERDICT: PARTIAL, with 1 CRITICAL 🔴

Most read/write routes are correctly isolated through `findAccessibleConversation` (scopes by `user_id` personal, or `chat_projects.scope='team' AND organization_id` team). **One route bypasses it entirely.**

### 🔴 B1 — CRITICAL IDOR: `POST /api/conversations/:id/summarize`
`conversations.routes.ts:1438-1525`. The handler validates only that `id` is a UUID, then:
```ts
const messages = await dbAll(
  `SELECT id, role, content, message_type, created_at
   FROM conversation_messages WHERE conversation_id = ?
   ORDER BY created_at ASC`, [id]);   // no findAccessibleConversation, no user_id, no org
```
No ownership/tenant check anywhere in the handler (verified 1438-1525).
- **Read leak:** any authenticated user (any tenant) POSTs `/api/conversations/<victim-uuid>/summarize`; the victim's full transcript is fed to the LLM and the substance returned in `res.json({ summary })` (`:1514`). The fallback path concatenates raw user-message content verbatim (`:1486-1490`).
- **Integrity/tamper:** it also writes a `summary` message (`:1495`) and flips the victim's messages to `message_type='condensed'` (`:1507-1511`).
- **Fix:** add `const conversation = await findAccessibleConversation(id, req.userId!, req.organizationId); if (!conversation) return res.status(404)…` at the top, plus a team `manage_thread`/`add_message` permission check before mutating — exactly like `/truncate`.

### 🟠 Medium — chat routes skip the house-standard tenant guard
`Gateway.ts:453-454` mounts `/api/conversations` and `/api/chat-projects` with only in-file `verifyToken`; they read `req.organizationId` directly, NOT through `orgContextMiddleware`/`validateOrgMembership` (the codebase standard that re-validates membership from DB, "no cache — fail-fast on revocation", `orgContext.middleware.ts:278-336`). `req.organizationId` comes from the JWT claim (re-validated only on the `x-org-context` header path, `auth.middleware.ts:619-638`). A removed-but-unexpired-token user keeps the old org. Practically mitigated for team reads because `checkChatPermission('read')` re-queries `organization_members status='ACTIVE'` (`:242,:1570`), so a revoked member is blocked there — but the deviation is exactly what made `/summarize` exploitable. **Mount `validateOrgMembership` on both routers.**

### 🟡 Low — `chat-projects.routes.ts GET /:id` team folder
`:146-175` returns the folder + its conversation list on org match without a `checkChatPermission('read')` call; relies on unvalidated `req.organizationId`. No cross-org leak unless token trust is broken; add the permission gate for defense-in-depth.

**Correctly guarded (no leak):** list `GET /` (`:216`), search `GET /search` (`:1541`), `GET /:id` (`:457`), `PATCH/DELETE /:id`, all `/:id/messages*`, `/truncate`, `/title/generate`, `/save-to-context`, `/:id/sessions`, `/:id/export`, `/bulk`, `/auto-archive`, `/migrate`. Share-links are modeled in `chatPermissionService` but **no route implements them** → no external-sharing leak vector today.

---

## 4. Building projects in chat — VERDICT: PARTIAL ✅ (core works; editing missing)

Create, add/move conversation, team scoping + enforcement, listing/grouping, and delete are all genuinely realized end-to-end for both individual and team projects.

| Item | Verdict | Evidence |
|---|---|---|
| Create project (personal) | WORKS | `ChatHistorySidebar.tsx:538` / `MoveToProjectModal.tsx:111` → `createProject` → `POST /chat-projects` (`chat-projects.routes.ts:194-222`) |
| Add / move conversation to project (+ guard toast) | WORKS | `MoveToProjectModal.tsx:97` → `POST /chat-projects/:p/conversations/:c` (`:407-466`); guard `EnhancedChatInput.tsx:717-735` |
| Team / shared projects (scope persisted + enforced) | WORKS | `scope` column `515_team_chat_projects.sql:74`; create gated by `create_project` (`chat-projects.routes.ts:209-220`); list scoped by org (`:88`); team convos unioned `conversations.routes.ts:264-267` |
| Listing & grouping (personal vs team) | WORKS | `ChatHistorySidebar.tsx:425-426,797-835` |
| Delete project / remove-from-project | WORKS | `DELETE /chat-projects/:id` (`:352-396`); remove via `Api.updateConversation(..., {chatProjectId:null})` |
| **Rename / edit / recolor project** | **BROKEN (orphaned)** | `PATCH /chat-projects/:id` (`:289`), `Api.updateChatProject` (`api.ts:11269`), store `updateProject` all exist but **no UI calls them** — no rename/edit control anywhere |

**Gaps:**
1. **Project rename/edit is dead-end UI-side** — full backend exists, zero UI wiring. Users cannot rename a folder, change color/icon/description, or change scope after creation. *(High — most-impactful functional gap)*
2. *(Cleanup)* `DELETE /chat-projects/:id/conversations/:conversationId` (`:475`) is never called — UI uses the conversation-update path instead; two divergent code paths for the same op (confirm the used path enforces team permissions equivalently).
3. *(Cleanup)* `chat-projects.validators.ts` is an empty stub; real schemas inline in the route.

---

## 5. Concurrency / ordering / idempotency — VERDICT: FRAGILE, with 1 BROKEN 🔴

Optimistic-by-id reconciliation (`useConversationStore.addMessage`) and `resume`-as-replace handling are solid. The rest is fragile, and auto-retry is broken.

### 🔴 B2 — BROKEN: auto-retry duplicates/garbles assistant content
`useAIStream.ts:1185-1212`. On a network/stream error the hook auto-retries up to 3× by re-calling `Api.chatWithAIStream` with the **same `handleChunk`**, but `fullText` (init `:552`, appended `:686`) is reset only at `startStream` entry (`:543`), **not before the retry**. So "The revenue is" + full re-stream → "The revenue isThe revenue is $4M…". The server does not resume (fresh POST), it regenerates from scratch. **Fix:** reset `fullText`/streamed content before the retry resend, or route the retry through `resumeFromPartial`.

| Item | Verdict | Evidence |
|---|---|---|
| Concurrent sends | FRAGILE | UI guards (`EnhancedChatInput.tsx:177-179,614-615`) but `handleSendMessage` checks only `isDisabled` (`UnifiedChatPanel.tsx:1709`); programmatic callers (`:624,2902,2920,4455,4519,4735`) can fire mid-stream → `startStream` aborts in-flight turn (`useAIStream.ts:549`), drops the first assistant reply while persisting both user msgs |
| Message ordering | FRAGILE | `ORDER BY created_at ASC` only, no seq tiebreaker (`conversations.routes.ts:495,802`); same-ms or concurrent user/assistant inserts can reorder on reload |
| Idempotency | BROKEN | no client message id / idempotency key sent (`useConversationStore.ts:1050` body; server always `uuidv4()` `conversations.routes.ts:801`) → any retried POST duplicates rows |
| Deduplication | FRAGILE | mid-stream disconnect saves partial only to `ai_partial_responses` (`ai.routes.ts:1973`), never into `conversation_messages` → assistant turn lost unless user manually resumes |
| Retry & reconnect | BROKEN | see B2; manual `retryLastStream` (`:1270`) is safe (re-enters `startStream`), only auto-retry duplicates |
| Optimistic UI vs server truth | ROBUST | reconcile-by-id `useConversationStore.ts:1014-1107`, failure keeps bubble + `localError` |

**Recommended fixes:** (B2) reset stream buffer before retry; add `clientMessageId` + unique `(conversation_id, client_message_id)` constraint + upsert; early-return in `handleSendMessage` when streaming; add monotonic `seq` column for ordering; persist partial assistant message idempotently on disconnect.

---

## Prioritized action list

**MUST FIX before GO (blockers):**
1. **B1** — Add access check to `POST /:id/summarize` (`conversations.routes.ts:1438`). *(CRITICAL security)*
2. **B2** — Reset `fullText`/streamed buffer before auto-retry (`useAIStream.ts:1185`). *(BROKEN correctness)*

**HIGH (fix before broad release):**
3. Persist `attachmentDocIds` in message metadata (add column or nest in `metadata`) — §2.1.
4. Stop swallowing user-message save errors + add retry/durable queue — §2.3.
5. Add message idempotency key + unique constraint — §5 (Idempotency).
6. Wire project rename/edit UI to the existing `PATCH /chat-projects/:id` — §4.1.
7. Mount `validateOrgMembership` on `/api/conversations` + `/api/chat-projects` — §3 (Medium).

**MEDIUM / cleanup:**
8. Guard `handleSendMessage` against mid-stream sends — §5.
9. Add monotonic `seq` ordering column — §5.
10. Persist mid-stream partial assistant message on disconnect — §5.
11. Rehydrate `conversation_message_attachments` into messages (or document metadata as SSOT) — §2.2.
12. `checkChatPermission('read')` on `chat-projects GET /:id` — §3 (Low).
13. Investigate `message_count` double-count trigger — §2.4.
14. Remove dead components / stale validator files — §1, §2.6, §4.3.

## Suggested regression tests (per finding)
- `summarize` IDOR: user A cannot summarize user B's / another org's conversation (expect 404).
- Stream auto-retry: simulate a mid-stream drop → assert no duplicated prefix in the persisted assistant message.
- Save failure: backend 500 on `POST /:id/messages` → assert message is retried/queued, not silently lost.
- `attachmentDocIds`: attach KB doc → reload → assert RAG scope reconstructable.
- Project rename: rename a folder via UI → reload → name persists.
- Concurrent send: programmatic send mid-stream → assert no orphaned user message / dropped assistant reply.

---

*Evidence gathered by end-to-end code trace (read-only). No files were modified during this audit.*
