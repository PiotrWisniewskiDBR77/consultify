# Chat Conversation Formula — Critical Bug Hunt & Audit

Date: 2026-06-04
Branch: feat/wave1-foundations
Scope: `src/components/AIChat/UnifiedChatPanel.tsx`, `src/store/useConversationStore.ts`, `src/hooks/useAIStream.ts`, `src/store/slices/chatSlice.ts`
Reporter: owner (Piotr) — 3 symptoms: (1) new chat did not isolate, old messages persisted; (2) user question bubble did not render; (3) no reasoning/thinking trace.

---

## 0. Architecture summary (the dual-store split that causes the bugs)

There are **two independent message stores**, and the chat panel reads/writes both inconsistently:

| Store | Field | Written by | Read for display? |
|---|---|---|---|
| `useConversationStore` | `activeMessages` (scoped to `activeConversationId`) | `addMessage` (aliased `addMessageToConversation`) | **YES** — `messages` memo at `UnifiedChatPanel.tsx:1454` maps `activeMessages` → display |
| `useAppStore` (chatSlice) | `activeChatMessages` (global, NOT conversation-scoped) | `addChatMessage` | **Only when** a parent passes `customMessages={activeChatMessages}` (e.g. `ReportBuilderWorkspace.tsx:638`, `ChatOverlay.tsx`). The main `/chat` view (`AIChatView.tsx:8`) does NOT pass it. |

`displayMessages` (`UnifiedChatPanel.tsx:1473`) = `customMessages || messages`. So in the main chat view the only source of truth for rendering is `activeMessages`. Every `addChatMessage(...)` call in `handleSendMessage` is **legacy/no-op for rendering** in the main view — it only feeds embedded views and the global useAppStore history.

`useAppStore.activeChatMessages` is **never cleared on new chat** — `handleNewChat` (`UnifiedChatPanel.tsx:3329`) only calls `clearActiveChat()` (conversation store), never `clearChat()` (`chatSlice.ts:167`).

---

## 1. BUG 1 — New chat does not isolate (old messages bleed)

### Root cause (two compounding defects)

**1a. `useAppStore.activeChatMessages` is never reset on new chat.**
`handleNewChat` — `UnifiedChatPanel.tsx:3329-3338`:
```ts
const handleNewChat = useCallback(async () => {
  clearActiveChat();                 // conversation store only
  const conv = await createConversation();
  setActiveConversation(conv.id);
}, [...]);
```
`clearActiveChat()` (`useConversationStore.ts:1299`) resets `activeConversationId`/`activeMessages`, but the **useAppStore** global `activeChatMessages` keeps growing forever (no `clearChat()`). In **any embedded context** that renders `customMessages={activeChatMessages}` (`ReportBuilderWorkspace.tsx:638`, `ChatOverlay.tsx:208`, etc.), a "new chat" shows the entire prior thread because `displayMessages = customMessages || messages` prefers the stale global list (`UnifiedChatPanel.tsx:1474`).

**1b. History/context for the new turn is built from the OLD render closure.**
`handleSendMessage` — `UnifiedChatPanel.tsx:2226-2232`:
```ts
const liveConversationMessages =
  useConversationStore.getState().activeConversationId === conversationId
    ? useConversationStore.getState().activeMessages
    : [];
const sourceMessages =
  customMessages ||
  (activeConversationId === conversationId ? messages : liveConversationMessages);
```
`messages` here is the **render-closure** value (line 1454 memo) captured when the callback was created. After a fast "new chat → type", `activeConversationId` (destructured prop, line 537) is still the OLD id for one render, while `conversationId` (line 2215, read from `getState()`) is the NEW id. The branch `activeConversationId === conversationId` is false, so it *should* fall to `liveConversationMessages`. But if the new id was already committed to the closure on the prior render (id equality true) while `messages` still holds the previous conversation's array, the **previous conversation's messages are sent to the model as history** — the new answer "continues" the old thread. This is the precise mechanism behind "the new answer appended to the old thread."

**1c. (latent) Title/streaming persistence falls back to a stale id.**
`onStreamDone` (`UnifiedChatPanel.tsx:1006`) uses `useConversationStore.getState().activeConversationId || activeConversationId`. The `|| activeConversationId` fallback is the **stale render-closure id**. If the live id is transiently null during a switch, the AI reply persists into the OLD conversation.

### Why it manifests
The dual-store split means "clear" only half-clears. The render-closure `messages`/`activeConversationId` are stale for one or more renders after `createConversation`, and the history builder trusts them.

---

## 2. BUG 2 — User question bubble does not render

### Root cause
In the normal send branch, the user message is added to `activeMessages` (the only thing the main view renders) **only inside `if (conversationId)`** — `UnifiedChatPanel.tsx:2488-2524`:
```ts
if (conversationId) {
  try {
    await addMessageToConversation({ conversationId, role: 'user', content, ... }); // 2518
  } catch (err) { ... }
}
// Also add to useAppStore for backward compatibility
addChatMessage(userMessage); // 2546 — NOT rendered by main view
```
`addMessageToConversation` → store `addMessage` (`useConversationStore.ts:1018`) appends the optimistic user bubble to `activeMessages` **only if** `state.activeConversationId === conversationId` (line 1040, `shouldAppend`).

Failure modes that drop the bubble:
1. **`conversationId` resolves null** (createConversation failed/aborted but code continued, or a tool/canvas branch returned a falsy id) → the `if (conversationId)` block is skipped → user message lives **only** in useAppStore (line 2546), which the main view never renders. Streaming still starts (line 2860) and `onStreamDone` persists the AI reply via the `liveActiveConversationId` fallback → **AI answers with no visible user bubble.**
2. **`state.activeConversationId !== conversationId`** at append time (mid-switch race after new chat) → `shouldAppend` is false (line 1040) → optimistic bubble silently dropped from `activeMessages`, even though the POST succeeds. After the next `fetchConversation` it *may* reappear, but during the turn it is invisible.

The `addChatMessage(userMessage)` at 2546 gives a false sense of safety — it does not render in the main `/chat` view.

---

## 3. BUG 3 — No visible reasoning / thinking trace

### Root cause
Reasoning is **off by default and only synthetic/ephemeral**:

1. **`showReasoning: false` by default** — `authSlice.ts:112`, `chatSlice.ts:101`. The model's `<thinking>…</thinking>` tags are **stripped silently** unless the user manually enables "Show reasoning" — `useAIStream.ts:659-681`:
```ts
if (aiConfig?.showReasoning) { /* render as blockquote */ }
else { processedChunk = chunk.replace(/<thinking>[\s\S]*?<\/thinking>/g, ''); }
```
2. **`thinkingSteps` are fake/cosmetic and ephemeral.** They are canned localized strings (`buildDefaultThinkingSteps`, `useAIStream.ts:59`), not real model reasoning, and are **cleared 1200ms after first content** for non-deep streams — `useAIStream.ts:709-715`. They are also not persisted on the AI message in a way that re-renders after refresh by default.
3. **Real reasoning only exists in Deep Thinking mode** (`deepThinkingState`, gated behind `aiConfig.deepResearch`). There is **no always-available, per-message "Show reasoning" disclosure** like Grok/o1/Gemini.
4. **Toggle bug (adjacent):** `ToolsMenu.tsx:261` does `if (modeId === 'showReasoning') setAIConfig({ maxMode: newValue })` — toggling "Show reasoning" writes `maxMode`, **not** `showReasoning`. So even when the user toggles it, `aiConfig.showReasoning` may stay `false` and `<thinking>` keeps being stripped.

---

## 4. Prioritized fix list

### P0 — the three reported bugs

**P0-1 (Bug 1a): clear the legacy store on new chat.**
`UnifiedChatPanel.tsx:3329` `handleNewChat` — after `clearActiveChat()`, also call `useAppStore.getState().clearChat()` (defined `chatSlice.ts:167`) so `activeChatMessages` is reset. Without this, every embedded `customMessages` view leaks the old thread.

**P0-2 (Bug 1b/1c): never trust render-closure ids/messages in the send + persist path.**
- `UnifiedChatPanel.tsx:2226-2232` — drop the `activeConversationId === conversationId ? messages : …` branch; always build history from `useConversationStore.getState().activeMessages` filtered to `conversationId` (use the freshly-resolved `conversationId`, not the closure prop).
- `UnifiedChatPanel.tsx:1006-1007` — remove the `|| activeConversationId` stale fallback in `onStreamDone`; if `getState().activeConversationId` is null, persist to the `conversationId` that was captured for *this specific send* (thread it through via a ref set in `handleSendMessage`), not the render closure.

**P0-3 (Bug 2): always render the user bubble, independent of conversation creation.**
`UnifiedChatPanel.tsx:2488-2546` — restructure so the user message is appended to `activeMessages` **unconditionally and first**:
- Ensure `conversationId` is non-null *before* this point (await `createConversation`, hard-return with a toast on failure — do not continue to streaming with a null id).
- Make the store append unconditional for the active turn: in `useConversationStore.ts:1040`, the `shouldAppend` guard should also append when the message's `conversationId` is the one being made active in the same tick (or set `activeConversationId = conversationId` synchronously before the append). Simplest: in `handleSendMessage`, call `setActiveConversation(conversationId)`/`set({activeConversationId})` synchronously right after creation, *then* append, so `shouldAppend` is always true.
- Remove reliance on `addChatMessage(userMessage)` (2546) for rendering — keep only as legacy mirror.

**P0-4 (Bug 3): make reasoning visible by default + fix the toggle.**
- `ToolsMenu.tsx:261` — change `setAIConfig({ maxMode: newValue })` → `setAIConfig({ showReasoning: newValue })` (the toggle currently writes the wrong key).
- Default `showReasoning: true` (`authSlice.ts:112`, `chatSlice.ts:101`) **or** add a per-message collapsible "Show reasoning" disclosure that renders `<thinking>` content and/or persisted `metadata.thinkingSteps` regardless of the global flag.
- Persist real reasoning on the AI message metadata (`buildPersistedAiResponseMetadata`, used at `UnifiedChatPanel.tsx:1018`) so it survives refresh and can be toggled open per message (Grok/o1 style), instead of being stripped at `useAIStream.ts:680` or cleared at `useAIStream.ts:711`.

### P1 — robustness

- **P1-1:** Add a single `conversationId` ref captured at send-start and thread it through `startStream` → `onStreamDone` so user msg, AI msg, and title all bind to the *same* id with zero closure staleness.
- **P1-2:** In `useConversationStore.addMessage`, when `shouldAppend` is false, still write to `_conversationMessagesCache[conversationId]` (it already does on ack) AND log a stability marker — silent drops are how bubbles vanish.
- **P1-3:** Consolidate to a single source of truth: deprecate `useAppStore.activeChatMessages` for the main view, or keep it strictly mirrored and cleared in lockstep with `clearActiveChat`.

---

## 5. Standards gap vs Grok / OpenAI / Gemini

| Capability | Consultify today | Gap |
|---|---|---|
| **New-chat isolation** | Half-clears (conversation store only); legacy store + render-closure leak | P0 — must fully isolate |
| **User message echo** | Conditional on `conversationId`; can be dropped on race/null | P0 — must be unconditional + immediate |
| **Reasoning visibility** | Off by default, synthetic steps, stripped `<thinking>`, broken toggle | P0 — needs always-available per-message reasoning disclosure |
| **Streaming UX** | Has streaming bubble + cosmetic thinking steps (`useAIStream.ts`) | OK, but steps are fake; real token-level reasoning not surfaced |
| **Stop / abort** | Present (`abortStream`, `useAIStream.ts:549`) | OK |
| **Regenerate** | Partial (deep-thinking retry, `retryLastStream`) | Missing a clean per-message "Regenerate" for normal answers |
| **Edit & resend** | Present via `truncateFromMessage` (`useConversationStore.ts:1205`) + editing state | OK but UX coupling to conversation refetch is heavy |
| **Conversation switching** | Works but littered with dedupe/race patches (`fetchConversation` 734-904) | Fragile; needs the single-id-ref refactor |
| **Persistence / rehydration** | Per-conversation persist (partialize `1752`), route-based rehydrate (`merge`/`onRehydrateStorage`) | OK but only last-50 persisted; reasoning not persisted |
| **Message threading integrity** | Dual-store split risks cross-thread bleed | P0 — unify source of truth |
| **Citations / artifacts** | Present (`mergeCitations`, artifacts store) | OK |

### Definition of done (to reach Grok/OpenAI/Gemini level)
1. One conversation id, captured per-send, used everywhere (history, user msg, AI msg, title).
2. User bubble appears instantly and unconditionally on send.
3. New chat fully isolates both stores.
4. Per-message collapsible reasoning trace, on by default, persisted across refresh.
5. Per-message Regenerate + Stop + Edit-resend on every assistant turn.
