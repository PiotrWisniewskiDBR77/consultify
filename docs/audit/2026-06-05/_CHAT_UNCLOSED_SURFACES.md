# Chat Module — Unclosed Surfaces Audit

**Date:** 2026-06-05
**Branch:** `feat/wave1-foundations` (clean working tree)
**Target GA:** ~2026-06-08
**Method:** End-to-end code trace of `src/components/AIChat/**`, `src/hooks/useAIStream.ts`,
`src/store/useConversationStore.ts`, `server/src/routes/{conversations,chat-projects,share,voice}.routes.ts`,
`server/src/realtime/{chatProjects,orgContext}Realtime.ts`. Tooling pass:
`npx eslint` on chat dirs (933 warnings, 0 errors), `npx tsc --noEmit` (no chat-related errors).

---

## Overall closure score: **72 / 100**

Up from 51/100 at the 2026-06-02 deep audit. The Phase 0 security/reliability blockers
(IDOR on `/summarize`, auto-retry duplication, idempotency, ordering, attachmentDocIds
persistence, `validateOrgMembership` mount) and Phase 1 (composer command palette,
shortcuts) **are both committed and verified** in current branch — see §"Phase 0
status" below. F1-F4 history & projects, branch-from-message, edit-and-regenerate,
voice STT, share-links + public viewer all work end-to-end.

What still drags the score down: **two new security holes opened by F4b sockets and
share-links** (both shippable but exploitable today), the **scroll-jacking auto-scroll
loop**, the **invisible-on-bubble file attachment regression**, **no rich code/Mermaid/LaTeX
rendering** despite Canvas having it, **no paste / no drag-drop / no IME composition guard**
in the composer, **mid-stream conversation switch does not abort the stream**, and a
handful of dead components/stale files that should have been swept after Canvas C* /
History F* shipped. None alone is a GA blocker; together they're the "wstydliwie nie
działa" surface area.

---

## Phase 0 uncommitted work status: **LANDED**

The MEMORY.md note "Phase 0 (implemented 2026-06-02, uncommitted)" is **stale**.
Phase 0 is committed at `597f18d321` (`fix(chat): Phase 0 — security & reliability
hardening of the chat module`). Verified items in tree:

| Item | Status |
|---|---|
| `findAccessibleConversation` on `POST /conversations/:id/summarize` | Live (`conversations.routes.ts:1475`) |
| `fullText`/`rawBuffer` reset before auto-retry | Live (`useAIStream.ts:1221-1227`) |
| `clientMessageId` + unique index | Live (`useConversationStore.ts:1107`, migration `20260602_chat_message_idempotency_ordering.sql`) |
| Bounded retry + non-blocking toast on save errors | Live (`useConversationStore.ts:1110-1116`) |
| Per-conversation monotonic `seq` column | Live (migration) |
| `attachmentDocIds` persisted via `message.metadata.attachments` | Live (`UnifiedChatPanel.tsx:2271`) |
| `validateOrgMembership` mounted on `/api/conversations` + `/api/chat-projects` | Live (`Gateway.ts:459-460`) |

Phase 1 (command palette) landed at `986d18bc1`. Working tree is clean — nothing
chat-related is sitting uncommitted.

**Action needed:** update the `project_chat_world_class` memory file to reflect
that Phase 0 + Phase 1 both shipped; rewrite the "uncommitted" sentence. (Not
done in this audit — read-only.)

---

## P0 — GA blockers / visibly broken

### P0-1. `/chat-projects` and `/org-context` Socket.IO namespaces accept **anonymous** connections from any origin and let the client join any `org:<id>` room.
- `server/src/realtime/chatProjectsRealtime.ts:28-42`
- `server/src/realtime/orgContextRealtime.ts:33-55`
- The namespace handler does *no* JWT verification, no membership check, no
  rate-limit. Anyone hitting the WS endpoint can:
  - emit `join:org` with **any** organizationId,
  - receive every `chat:projects:changed` / `org:context:rebuilt` event for
    that org — a real-time activity sidechannel (when an org has chats in
    flight, when admins are rebuilding context).
- Client side (`useChatProjectsRealtime.ts:25-28`) doesn't even send the auth
  token; only an unauthenticated `auth: { userId }` field which the server
  ignores. So even legitimate clients are anonymous on the wire.
- **Fix:** add an `io.of('/chat-projects').use(authMiddleware)` that verifies
  the JWT from `socket.handshake.auth.token` and rejects on failure, then
  validate `organization_members` membership before joining `org:<id>`. Same
  pattern that `validateOrgMembership` uses for HTTP. ~30 lines.

### P0-2. Public share viewer password protection is broken-by-design.
`server/src/routes/share.routes.ts`:
- `GET /share/:token?password=<x>` (line 238) — **password in the URL query
  string**. Logged to web-server access logs, browser history, referer headers
  on any out-link the public viewer renders. (`SharedConversationView.tsx`
  calls `Api.getPublicShare(token, pw)` which likely encodes it into the query.)
- `hashPasscode = sha256(plaintext)` (line 105) — **no salt, no PBKDF2/argon2,
  no iterations**. Rainbow-table trivial. Worse, the same hash is stored
  verbatim in `conversation_shares.settings` JSON which means a DB leak ≈
  password leak for every active share.
- **No rate limit** on the password endpoint → unlimited online brute force.
- File starts with `// @ts-nocheck` — code is unchecked.
- **Fix (≤1 day):** move password to POST body or `Authorization: Bearer
  share-pass:<x>`; replace SHA-256 with bcrypt/argon2id (cost 10+); add
  per-token rate-limit on `/share/:token` (existing `express-rate-limit` is
  fine, key by token+IP). Remove `@ts-nocheck`.

### P0-3. Conversation switching mid-stream leaves the stream running on the wrong target.
- `ChatHistorySidebar.tsx:797-804` (`handleSelectConversation`) calls
  `navigate(...)` + `setActiveConversation(id)` but **never `abortStream()`**.
- The old conversation's SSE keeps streaming; `useAIStream`'s `handleChunk`
  pushes content into `setStreamedContent`, which `UnifiedChatPanel` then
  displays on the *new* active conversation (because `activeMessages` no
  longer contains the original AI placeholder, but the streamed content
  buffer is hook-state, not conversation-scoped). Visible bug for anyone
  who clicks another conversation while Teresa is replying.
- Same shape as B2 from the deep audit (which Phase 0 fixed for retry, not
  for switch).
- **Fix:** call `abortStream()` at the top of `handleSelectConversation`
  AND inside `setActiveConversation` in the store before swapping
  `activeConversationId`. ~3 lines.

### P0-4. Attached files vanish from the user bubble on send.
- `EnhancedChatInput.tsx:996-1027` renders attachment chips while composing.
- `UnifiedChatPanel.tsx:2271` stores them on `message.metadata.attachments`.
- **`MessageRenderer.tsx` never reads `metadata.attachments` on user
  messages** — grep confirms zero references. So after pressing Send, the
  files become invisible — user sees only their text. They look back at
  yesterday's chat and can't tell whether they actually attached the doc.
- For a v1 demo (Atelier Toys, HBS brand) this is the #1 "wstydliwie nie
  działa" candidate — promised, half-shipped, silently lost.
- **Fix:** add a chip row in the user bubble before the markdown body,
  reading `metadata.attachments` with the same File/Link/Doc badging the
  composer uses. ~40 lines.

---

## P1 — works mostly, edge cases / rough surfaces

### P1-1. Auto-scroll fights the user.
- `UnifiedChatPanel.tsx:1696-1698`:
  `useEffect(() => { messagesEndRef.current?.scrollIntoView({behavior:'smooth'}); }, [displayMessages, isStreaming]);`
- Fires on **every** message-list mutation and every stream-start/end. No
  "user scrolled up → pause auto-scroll" guard. User trying to re-read an
  earlier section while Teresa is streaming gets yanked to the bottom every
  token. ChatGPT/Claude both gate this on `scrollTop + clientHeight >=
  scrollHeight - threshold`.
- **Fix:** track `isAtBottom` from an `onScroll` handler; only auto-scroll
  when `isAtBottom`. ~20 lines.

### P1-2. Code blocks have no syntax highlight, no copy button, no language label, no Mermaid, no LaTeX.
- `MessageRenderer.tsx:951-993` renders fenced code with bare
  `<pre><code className={codeClassName}>` — no highlight.js / shiki /
  prism. No copy button. No filename/language chip.
- `CanvasMarkdownRenderer.tsx:5-99` *does* have Mermaid (lazy). The chat
  renderer doesn't import it.
- No `remark-math` / `rehype-katex` — `$\sum_i$` renders as literal text.
- This is the single biggest visible gap vs ChatGPT/Claude/Grok/Gemini in
  the message-content area. Users pasting in code answers will notice.
- **Fix:** reuse `CanvasMarkdownRenderer`'s code/Mermaid plugins for the
  chat message body. Add a small CopyButton overlay on `<pre>`. Add a
  remark-math + rehype-katex pair with lazy import. ~150 lines.

### P1-3. No paste handler — text-only is the only OK path.
- `EnhancedChatInput.tsx`: zero `onPaste` handler. Paste an image → nothing.
  Paste a screenshot → nothing. Paste a URL with `multipart/clipboard` →
  nothing. This is one of the most common ways people attach to ChatGPT.
- **Fix:** add `onPaste` to the textarea — if `clipboardData.files` has any
  entry, hand them to `handleFileSelect`; if there's plain-text URL, route
  to `handleUrlAdd`. ~25 lines.

### P1-4. No drag-drop onto the chat panel.
- `ImageAttachment.tsx` has drag handlers but the component is dead (zero
  imports). The actual chat panel (`UnifiedChatPanel.tsx`) has no
  `onDragOver`/`onDrop` on the body. Sidebar drag is for moving conversations
  to folders only.
- **Fix:** wrap the chat-content column in an `onDragOver`+`onDrop` HOC
  that calls the same `handleFileSelect` pipe. ~30 lines. Optionally
  resurrect `ImageAttachment.tsx`.

### P1-5. No IME composition guard on Enter.
- `EnhancedChatInput.tsx:861-865`: plain Enter sends. No `e.nativeEvent.isComposing`
  check. For Japanese/Chinese/Korean users (and Polish users who use IME for
  diacritics on some keyboard layouts), pressing Enter to accept an IME
  candidate **submits the half-finished message**. Common chat regression.
- **Fix:** `if (e.key === 'Enter' && !e.nativeEvent.isComposing && !e.shiftKey)`. ~1 line.

### P1-6. Composer accessibility is essentially nil.
- Zero `aria-label` / `aria-live` / `sr-only` in `EnhancedChatInput.tsx`,
  `UnifiedChatPanel.tsx`, `MessageRenderer.tsx`. Buttons rely on `title`
  (tooltips) which screen readers DON'T announce on hover; assistive tech
  can't tell Send from Stop from Voice.
- Streaming AI messages don't sit in an `aria-live="polite"` region so
  screen-reader users get nothing while Teresa types.
- **Fix:** `aria-label` on the 4 toolbar buttons; wrap the messages
  scroll-area in `<div role="log" aria-live="polite" aria-atomic="false">`.
  ~10 lines.

### P1-7. Mobile / iPad layout is desktop-only.
- `UnifiedChatPanel.tsx`: a single `md:`/`lg:`/`sm:` reference and
  `max-w-5xl/4xl` columns. No iPad-portrait breakpoint, no `lg:hidden`
  toggle for the right Canvas panel, no touch targets >44px on the
  composer (current `p-2` ≈ 36px).
- Mobile composer keyboard pushes the textarea behind the iOS keyboard
  bar — no `viewport-fit=cover` or `env(safe-area-inset-bottom)` handling
  found.
- **Fix:** below MD, hide the sidebar by default, expand `max-w-` to
  `100%`, raise composer buttons to 44px, add `safe-area` padding on the
  composer footer. ~30 lines. (Probably out of scope for GA-8 but worth
  flagging.)

### P1-8. `share.routes.ts` is `@ts-nocheck` and skips F2 team RBAC.
- File header `// @ts-nocheck`.
- `POST /conversations/:id/share` only verifies the user is an org member
  of the conversation's org (`share.routes.ts:124-128`). The F2 team RBAC
  defines a dedicated `create_share_link` permission and per-action
  message ("Only admins can create share links",
  `chatPermissionService.ts:113`). It is **not enforced** by share routes,
  so any contributor or viewer can publish a team conversation publicly,
  bypassing the team policy.
- **Fix:** import `checkChatPermission` and call it with
  `action: 'create_share_link'` at the top of `POST /conversations/:id/share`.
  Remove `@ts-nocheck`. ~20 lines.

### P1-9. `EnhancedChatInput.startVoiceConversation` captures stale `chatLanguage`/`uiLang`.
- eslint: `react-hooks/exhaustive-deps` warning at `EnhancedChatInput.tsx:740`
  (deps array missing `chatLanguage`, `uiLang`). Same for `startVAD` at line 616.
- Practical effect: switch language mid-conversation, voice STT still posts
  the previous language to `/api/voice/stt` → Polish transcription of
  English audio (gibberish).
- **Fix:** add the deps or pull the language via ref inside the callback. ~3 lines.

### P1-10. `displayMessages` autoscroll thrashes on every metadata update.
- Same effect as P1-1 but specifically: thumb-up/down, save-to-context,
  citation-marker rehydration, hover state — anything that triggers a
  re-render and changes the array identity will fire the scroll. Even a
  pure-state click on a feedback chip pushes the view to the bottom.
- Counts as P1 because it's annoying, not blocking.

### P1-11. `BranchSelector` component exists but is never mounted; branches are invisible.
- `BranchSelector.tsx` — zero imports.
- `handleBranchFromMessage` (UnifiedChatPanel.tsx:3632) creates a new
  conversation and navigates to it; the **parent** conversation has no
  indicator that branches exist, and the new conversation has no link back.
  Once you branch, the relationship is invisible.
- **Fix:** show a small "branched from →" chip on the new conversation's
  header, and a "N branches" pill on the parent's last assistant message
  when `Api.listConversationBranches` returns anything. Mount `BranchSelector`.
  ~50 lines.

### P1-12. STT 10 MB cap is silent.
- `voice.routes.ts:40` `limits: { fileSize: 10*1024*1024 }`.
- A long voice-conversation recording crosses 10 MB after ~10 minutes
  at 16kHz Opus. multer returns 413 → fetch surfaces a generic error
  → `console.error('[Voice] Transcription error', ...)` and silently
  fails. The user just gets nothing back.
- **Fix:** chunk the audio (Whisper supports it) or show a "Recording
  too long, split it" toast.

### P1-13. New-conversation creation race on demo time-expired flow.
- `UnifiedChatPanel.tsx:2233-2242` creates the conversation first, then
  the demo guard sits *above* it at line 2202. If `demoTimeRemainingMs`
  drops to 0 *between* `handleSendMessage` being typed and Send being
  clicked, the demo modal fires AND the conversation creation completes
  → an empty conversation is left in the sidebar. Cosmetic but visible.

---

## P2 — polish

- **P2-1.** Dead components clogging the folder (7 files, all unimported):
  `ImageAttachment.tsx`, `CoThinkerModeSelector.tsx`, `ChatExportModal.tsx`,
  `ChatLanguageSelector.tsx`, `ResearchClarification.tsx`, `BranchSelector.tsx`,
  `DiagramArtifact.tsx`. Should either be wired or deleted.
- **P2-2.** `TrustBadge.tsx:8` comment claims `TrustPanel` and `SourcesStrip`
  are "currently stubbed to `null`" — both are now real (`TrustPanel.tsx:28+`,
  `SourcesStrip.tsx:21+`). Stale doc.
- **P2-3.** `KimiWorkspace/useKimiArtifactPipeline.ts:1107` is the only
  remaining `TODO(...)` in the chat folder — "Wire to (Sprint 4 / EPIC-4
  US-4.4)". If KimiWorkspace is dead, delete the comment too.
- **P2-4.** 88 `no-restricted-syntax` warnings (inline `style={{}}`, hex
  colors) in chat dirs — the platform palette standard. Mostly in newer
  Wave5-9 panels and the composer command palette. Doesn't block GA.
- **P2-5.** 100 `no-console` warnings — useful in dev, noisy in prod.
  Wrap in `logger.warn` or strip via build.
- **P2-6.** 20 `no-non-null-assertion` warnings — most are genuinely safe
  but every one masks a possible runtime crash; e.g. `useConversationStore.ts:1375`
  in the persistence layer.
- **P2-7.** `useConversationStore.ts:24` imports `WorkspaceType` unused.
  19 more unused-vars in the same file.
- **P2-8.** Welcome empty-state CTA still references `AIChatWelcomeView`
  in docs/evidence but that file was deleted from `src/views/`. Dead docs.
- **P2-9.** `ConversationActions.tsx:289` builds the share URL on the
  client (`${window.location.origin}/share/${token}`) — the server
  already returns `shareUrl`. Two sources of truth.
- **P2-10.** `MessageRenderer.tsx:982-988` adds inline citation rewriting
  only to `<p>`, `<li>`, `<td>`, `<th>`, `<strong>`, `<em>` — `<h1..h6>`
  and `<blockquote>` text falls through unrewired. Edge case: a headline
  with `[2]` won't be clickable.

---

## "Wstydliwie nie działa" candidates — visible but broken

Ranked by user-facing visibility:

1. **Attached files vanish from the user bubble** (P0-4). Promise broken on
   every chat that uses attachments. Confidence: certain. Effort: 1 hour.
2. **Mid-stream conv switch leaves orphan stream** (P0-3). Confidence: certain.
   Effort: 30 min.
3. **No syntax-highlighted code / no Mermaid in chat** (P1-2). Visible to
   every dev / consultant who asks for SQL/Python/Mermaid. Confidence: certain.
4. **Auto-scroll yanks the user** (P1-1). Anyone scrolling up during a stream
   notices instantly. Effort: 30 min.
5. **Branches exist but are invisible** (P1-11). User clicks "Branch from here",
   gets dropped into a new chat with no breadcrumb back. Confidence: certain.
6. **Paste image / paste file does nothing** (P1-3). Modern users expect this.
7. **Press-Enter-on-IME-candidate sends the message** (P1-5). Affects JP/CN/KR
   demo audiences. Effort: 1 line.
8. **Public share password leaks via URL query / unsalted SHA-256** (P0-2).
   Invisible to users until you tell them; visible to anyone reviewing the
   product before purchase.
9. **Org-wide chat-projects/org-context sockets are anonymous** (P0-1). Invisible
   to users; visible to security review.
10. **F2 RBAC `create_share_link` is silently bypassed** (P1-8). A "viewer"
    in a team folder can still publish the team chat publicly.

---

## Phase 2-4 of the world-class roadmap — status from this branch's POV

(Pulled from `project_chat_world_class` memory note, code-verified.)

| Phase 2 item | In code? |
|---|---|
| Regenerate in live `MessageRenderer` | Yes — `RefreshCw` + handler exists for AI messages |
| Per-message follow-ups | Partial — `SmartSuggestions.tsx` exists & used, not per-message |
| Edited-pill on user message after edit | NOT FOUND — no visual indicator on edited messages |
| Branching end-to-end | Backend + button exist; UI tree visualization not mounted (P1-11) |
| Project rename UI | Yes — `handleUpdateProject` wired (F1 closed) |
| Message share | NOT FOUND — sharing is whole-conversation only, no per-message share |
| Cleanup (dead components etc.) | Not done — see P2-1 |

So Phase 2-4 are ~50% there. The big remaining items: edited-pill, per-message
share, branch tree visualization, dead-code sweep.

---

## Top 10 pre-existing eslint/tsc warnings worth fixing

(All in chat-related files; full lint pass: 933 warnings, 0 errors. TSC clean.)

1. **`useAIStream.ts:740`** — `react-hooks/exhaustive-deps`: voice callback
   missing `chatLanguage`/`uiLang` → stale STT language (P1-9). **Real bug.**
2. **`UnifiedChatPanel.tsx:2919`** — exhaustive-deps missing 7 callbacks
   (`canUseWorkPanel`, `deleteChatMessage`, `navigateToRoute`, etc.) — likely
   stale-closure bugs after route changes. **Investigate.**
3. **`UnifiedChatPanel.tsx:3787`** — edit & regenerate callback missing
   `routeInfo` — could send stale context after navigation. **Real bug.**
4. **`UnifiedChatPanel.tsx:3585`** — useCallback missing `focusMode` —
   stale focus mode after settings change. **Real bug.**
5. **`useConversationStore.ts:1375`** — non-null assertion on store state
   in the persist merge path; a corrupted localStorage entry crashes
   rehydration. **Defensive fix.**
6. **`composerCommands.test.ts:24`** — non-null assertion in test setup;
   masks future `null` regressions. Cosmetic.
7. **`SmartSuggestions.tsx:311`** — useEffect missing `fetchSuggestions` →
   suggestions don't refresh when prop changes. **Real bug.**
8. **`useConversationStore.ts:24`** — unused `WorkspaceType` import; tiny
   bundle bloat. Cosmetic.
9. **`useAIStream.ts:1348`** — caught `error` declared but unused; should
   be `_error`. Cosmetic.
10. **`composer/CommandPalette.tsx:84`** — inline `style={{}}` outside
    `components/ui/`. Platform standard violation but no runtime impact.

The remaining 920+ are mostly `any` typing in the store/stream layers —
worth addressing in a typing pass after GA but not blocking.

---

## What's solid (credit where due)

- **Phase 0 security/reliability** — every audit item closed, migrations
  written, both shells point to the same store, idempotency via
  `clientMessageId` is correctly threaded through optimistic IDs.
- **Phase 1 command palette** — slash/@-mentions, Esc-stop-stream,
  Cmd/Ctrl+Enter, Up-arrow recalls last user message, 14/14 tests. Genuinely
  productivity-grade.
- **Streaming hook** (`useAIStream.ts`) — auto-retry backoff with surfaced
  `retryInfo` to UI; abortStream preserves partial content; `resumeFromPartial`
  exists for dropped-stream recovery; clean separation of thinking-steps,
  citations, reasoning, source-ledger, trust-bundle, policy decisions.
- **Optimistic message reconciliation** — `addMessage` reconciles by id +
  carries metadata + handles re-render race; the `pendingLocal` 3-branch fix
  from earlier sessions is holding.
- **Branch / fork** (Composer #4) — backend `POST /:id/branch` exists,
  client `branchConversation` API call works, button is in the message
  hover actions.
- **Edit & regenerate** — full pipeline, including DT-confirm path,
  language detection, and a clean store-truncate before resend. Honest
  ChatGPT-parity feature.
- **Per-project custom instructions** — fully threaded from project
  metadata into Teresa's system prompt (composer benchmark #5 committed).
- **History F1-F4** — folder rename/recolor/bulk-select, team-project
  RBAC, project knowledge in Teresa, share-links + public viewer, nested
  folders, real-time refresh — all genuine.
- **Reasoning trace** — `ReasoningTrace.tsx` per-message collapsible
  "Tok rozumowania", persisted via metadata, expands while streaming.
  This is parity with Grok/o1.
- **Language-detection-on-message** — reply matches the language the user
  typed in, not the UI language. Per-conversation memory of detected
  language. Non-trivial UX win.
- **Citation marker rewriting** — verbose `Source N; rag_N; [N]` collapses
  to clickable `[N]` pills. The prose-prose mismatches Quick Savings showed
  are cleaned up consistently.
- **Conversation isolation fix** — the 3-branch carry of `pendingLocal`
  through `fetchConversation` is holding; no observed bubble-disappearance
  in fresh sends.

---

## Recommended day-plan (ranked by impact-for-effort, GA-8 in mind)

### Half-day pass (3-4 hours, all P0 + the 1-line P1s)

1. **(30 min) P0-3** — abort stream in `handleSelectConversation` and at
   the top of `setActiveConversation`.
2. **(45 min) P0-4** — render `metadata.attachments` chips on the user
   bubble in `MessageRenderer.tsx`.
3. **(30 min) P0-1 socket auth** — middleware on both realtime namespaces
   to verify JWT + DB membership before `join:org`.
4. **(45 min) P0-2 share password** — bcrypt + body-only password +
   rate-limit. Remove `@ts-nocheck` while there.
5. **(1 min) P1-5** — add `!e.nativeEvent.isComposing` to Enter handler.
6. **(15 min) P1-1** — `isAtBottom` scroll guard.
7. **(15 min) P1-8** — wire `checkChatPermission('create_share_link')` on
   the share creation route.
8. **(3 min) P1-9** — fix exhaustive-deps on voice callback.

That sequence puts the score from **72 → ~88** in half a working day and
closes every visible-but-broken item flagged in the deep-audit follow-ups.

### Bonus half-day (4 hours, P1 polish for the v1 demo)

9. **(2 hr) P1-2** — port `CanvasMarkdownRenderer`'s code + Mermaid +
   add `remark-math`/`rehype-katex`. Single biggest visible-quality jump.
10. **(45 min) P1-3** — paste handler.
11. **(30 min) P1-4** — drag-drop on chat body.
12. **(45 min) P1-11** — mount `BranchSelector`; show "branched from →" header
   chip + "N branches" pill on parent.
13. **(15 min) P2-1** — delete the 7 dead files; resolves a chunk of
   future grep noise too.

That brings the module to **~93/100** which is genuinely GA-quality for the
2026-06-08 target.

### Defer past GA

- Mobile/iPad responsive overhaul (P1-7) — needs a real device pass,
  not a one-shot CSS edit.
- The 920+ `any`-typing warnings (P2-4 through P2-7) — risk of regression
  outweighs benefit in the 3-day window; do it in the post-GA hardening
  sprint.

---

## File map (paths exactly as inspected)

Client:
- `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/src/components/AIChat/UnifiedChatPanel.tsx`
- `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/src/components/AIChat/EnhancedChatInput.tsx`
- `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/src/components/AIChat/MessageRenderer.tsx`
- `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/src/components/AIChat/ChatHistorySidebar.tsx`
- `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/src/components/AIChat/useChatProjectsRealtime.ts`
- `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/src/components/AIChat/Messages/InlineThinkingStream.tsx`
- `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/src/components/AIChat/composer/{CommandPalette,composerMentions,slashCommands,useComposerCommands,useMentionSources}.{tsx,ts}`
- `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/src/hooks/useAIStream.ts`
- `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/src/store/useConversationStore.ts`
- `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/src/views/SharedConversationView.tsx`

Server:
- `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/server/src/Gateway.ts`
- `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/server/src/routes/conversations.routes.ts`
- `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/server/src/routes/chat-projects.routes.ts`
- `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/server/src/routes/share.routes.ts`
- `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/server/src/routes/voice.routes.ts`
- `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/server/src/realtime/chatProjectsRealtime.ts`
- `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/server/src/realtime/orgContextRealtime.ts`
- `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/server/src/services/chatPermissionService.ts`

Migrations:
- `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/server/migrations/20260602_chat_message_idempotency_ordering.sql`

Dead (orphan, zero non-self imports):
- `src/components/AIChat/ImageAttachment.tsx`
- `src/components/AIChat/CoThinkerModeSelector.tsx`
- `src/components/AIChat/ChatExportModal.tsx`
- `src/components/AIChat/ChatLanguageSelector.tsx`
- `src/components/AIChat/ResearchClarification.tsx`
- `src/components/AIChat/BranchSelector.tsx`
- `src/components/AIChat/DiagramArtifact.tsx`

---

*Read-only audit. No code modified, no commits, no migrations run.*
