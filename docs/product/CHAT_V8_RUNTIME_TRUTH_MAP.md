# Chat v8 - Runtime truth map

> Status: Draft v8
> Cel: Zamknac jedna wykonawcza prawde runtime dla chatu, tak aby zespol wiedzial, ktore surfaces, stores i API sa kanoniczne, a ktore sa partial, legacy albo transitional.

---

## 1. Po co istnieje ten dokument

Pakiet `CHAT_V8_*` ustawia model produktu.
Ten dokument ustawia model wykonawczy:
- ktory shell jest kanoniczny,
- ktore routes sa user-facing truth,
- ktore capabilities sa realne,
- ktore pozostaja partial albo legacy,
- jak unikac podwojnego rozwijania tych samych zachowan.

---

## 2. Zasada nadrzedna

Kanoniczny user flow `v8` jest jeden:

`entry -> conversation -> ask -> stream -> inspect -> act/save -> revisit`

Dla tego flow kanoniczny runtime spine to:
- `src/components/AIChat/UnifiedChatPanel.tsx`
- `src/components/AIChat/EnhancedChatInput.tsx`
- `src/components/AIChat/ChatHistorySidebar.tsx`
- `src/hooks/useAIStream.ts`
- `src/store/useConversationStore.ts`
- `src/store/useChatProjectStore.ts`
- `server/src/routes/ai.routes.ts`
- `server/src/routes/conversations.routes.ts`
- `server/src/routes/chat-projects.routes.ts`
- `server/src/routes/voice.routes.ts`

`src/views/AIChatWelcomeView.tsx` nie jest druga rownolegla historia produktu.
To legacy-but-live runtime, ktory musi byc explicite klasyfikowany, nie traktowany jako rownorzedny wzorzec.

---

## 3. Surface matrix

| Surface | User-facing role | Runtime today | Canonical owner for v8 | Decision |
|---|---|---|---|---|
| Full chat route | Main full chat experience | `/chat` route still renders `AIChatWelcomeView` | unified chat product | Legacy route target; not target shell |
| Unified split panel | Split co-working chat | `UnifiedChatPanel` in layout contexts | baseline | Canonical split shell |
| Full unified view helper | Alternative full chat wrapper | `AIChatView` | none | Transitional / not canonical |
| History panel | Conversation library | `ChatHistorySidebar` | baseline | Canonical history surface |
| Input surface | Send, tools, attachments, voice entry | `EnhancedChatInput` | baseline | Canonical input surface |
| Legacy welcome shell | Old full chat implementation | `AIChatWelcomeView` | none | Legacy / migration target |

---

## 4. Capability matrix

| Capability | Primary runtime today | Canonical owner for v8 | Decision |
|---|---|---|---|
| Conversation list and load | `/api/conversations`, `useConversationStore` | baseline | Canonical |
| New conversation | `useConversationStore.createConversation` | baseline | Canonical |
| Conversation route sync | `ConversationRouteSync` | baseline | Canonical |
| History search | `ChatHistorySidebar` client filter + server potential | baseline | Canonical, but current implementation partial |
| Folder CRUD | `useChatProjectStore` + `/api/chat-projects` | baseline | Canonical with vocabulary cleanup |
| Star/archive/delete/rename | `useConversationStore` + `ConversationActions` | baseline | Canonical |
| Move conversation to folder | `MoveToProjectModal` + DnD + store/API | baseline | Canonical |
| Stream response | `useAIStream` + `/api/ai/chat/stream` | baseline | Canonical |
| Retry/abort | `useAIStream` + panel handlers | baseline | Canonical |
| Local file ingest | `/api/ai/attachments/ingest` | baseline | Canonical |
| URL ingest | `/api/ai/attachments/ingest-url` | baseline | Canonical, but surface parity incomplete |
| Cloud browse/download | cloud APIs + `useCloudIntegrations` | partial | Partial only |
| Cloud connect | in-chat connect affordance | none complete | Partial/legacy promise; not canonical |
| Deep research confirm | `/api/ai/chat/confirm` + stream gate | baseline | Canonical advanced mode |
| Scope/focus | mixed state/UI/runtime | none fully canonical yet | Needs explicit v8 contract |
| Feedback unified path | `Api.aiFeedback` | baseline | Canonical |
| Feedback/report legacy path | placeholder-style methods in `api.ts` | none | Legacy only |
| Pending actions indicator | indicator + AI action APIs | baseline | Canonical but incomplete semantics |
| Reject action path | client-side stub area | none | Non-canonical until real |
| Voice dictation | browser + input | baseline | Canonical voice baseline |
| Voice conversation / STT | input + `/api/voice/stt` | partial | Partial until one user-facing contract exists |
| TTS / auto-read | `useUniversalVoice` + panel toggle | baseline | Canonical |

---

## 5. Canonical ownership by product stage

### 5.1 Entry and route

Canonical owner:
- route model in app routing and conversation sync,
- unified chat state via store.

Rule:
- docs must describe one full-chat route contract,
- docs must not treat `AIChatWelcomeView` as the desired long-term shell.

### 5.2 History and revisit

Canonical owner:
- `ChatHistorySidebar`
- `ConversationList`
- `ConversationItem`
- `ConversationActions`
- conversation and folder stores

Rule:
- history semantics belong to one library model, not scattered UI affordances.

### 5.3 Ask and stream

Canonical owner:
- `EnhancedChatInput`
- `useAIStream`
- `/api/ai/chat/stream`

Rule:
- send/stream/abort/retry belong to one runtime truth, independent of shell legacy.

### 5.4 Retrieval

Canonical owner:
- `/api/ai/attachments/ingest`
- `/api/ai/attachments/ingest-url`
- stream context contract in chat runtime

Rule:
- file and URL retrieval are baseline,
- cloud connect is not baseline until fully real.

### 5.5 Actions

Canonical owner:
- AI action routes and executor,
- `PendingActionsIndicator`,
- canonical chat action/save handlers in unified stack.

Rule:
- proposal, approval and execution semantics must be documented separately and explicitly.

### 5.6 Voice

Canonical owner:
- `EnhancedChatInput`
- `useUniversalVoice`
- `/api/voice/*`

Rule:
- voice docs must separate what is baseline vs partial,
- not every code path should be described as production-ready.

---

## 6. Runtime consolidation rules

### Rule 1

If a capability is required for the canonical user path, it must have one canonical owner in docs and runtime.

### Rule 2

Legacy-but-live surfaces may be referenced only as migration targets or compatibility notes.

### Rule 3

Partial features may not be documented as complete.

### Rule 4

If the same user-visible capability behaves differently in two shells, `v8` must classify one as canonical and the other as legacy or exception.

### Rule 5

A capability shown in UI must correspond to:
- a real browser capability,
- a real backend endpoint,
- or an explicit "not available here" rule.

---

## 7. What the team must not duplicate

Do not create second implementations or second product truths for:
- conversation list and lifecycle,
- stream and retry/abort semantics,
- file/URL ingest,
- pending action model,
- voice baseline contract,
- split workspace context flow.

Those already have live runtime owners, even if some of them need hardening.

---

## 8. Support-ready interpretation

When someone asks "does chat support X?", the support-ready answer should be:
- `yes, canonical` if it belongs to the v8 baseline owner and is real,
- `partial` if runtime exists but contract is incomplete,
- `legacy` if only older shell/runtime exposes it,
- `not supported` if UI or docs implied it but runtime does not back it.

This document exists so `Chat v8` can stop answering that question inconsistently.
