# Chat v8 - SSOT

> Pakiet odbiorowy 2026-07-31 konsolidujący pełny Chat/Teresa:
> [`CHAT_TERESA_COMPLETE_PRODUCT_CONTRACT.md`](../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/CHAT_TERESA_COMPLETE_PRODUCT_CONTRACT.md),
> [`CHAT_HISTORY_THREADS_LIBRARY_AND_MEMORY_CONTRACT.md`](../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/CHAT_HISTORY_THREADS_LIBRARY_AND_MEMORY_CONTRACT.md),
> [`CHAT_COMPOSER_TOOLS_COMMANDS_AND_OUTPUTS_CATALOG.md`](../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/CHAT_COMPOSER_TOOLS_COMMANDS_AND_OUTPUTS_CATALOG.md),
> [`CHAT_TERESA_ORCHESTRATION_MODULE_COMMUNICATION_AND_GOVERNANCE.md`](../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/CHAT_TERESA_ORCHESTRATION_MODULE_COMMUNICATION_AND_GOVERNANCE.md)
> oraz
> [`CHAT_AS_IS_FUNCTION_INVENTORY_MVP_GAPS_AND_GOLDEN_FLOWS.md`](../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/CHAT_AS_IS_FUNCTION_INVENTORY_MVP_GAPS_AND_GOLDEN_FLOWS.md).

> Status: Draft v8
> Cel: Kanoniczna definicja celu, zakresu, modelu produktu i completeness criteria dla rozwoju czatu w serii `v8`.
> Zakres: chat jako centralny operating system AI w `consultify`, nie osobny produkt obok platformy.

---

## 1. Co oznacza `Chat v8`

`Chat v8` to seria zmian i dokumentow opartych o benchmark pracy liderow rynku, ale wdrazanych jako rozwoj istniejacego stacku:
- `UnifiedChatPanel`,
- `EnhancedChatInput`,
- `ChatHistorySidebar`,
- `useConversationStore`,
- backendowego streamingu, attachments i AI actions.

Znaczenie `v8`:
- wspolny prefix dla pakietu dokumentacji i pracy wdrozeniowej,
- nacisk na kompletny, leader-grade chat operating system,
- jedna prawda produktu i jedna prawda runtime,
- zero vendor UI copying,
- maksymalny reuse tego, co juz istnieje i dziala.

Kluczowa decyzja tej iteracji:
- `UnifiedChatPanel` staje sie jedynym kanonicznym shellem czatu,
- `AIChatWelcomeView` staje sie legacy / migration target,
- `consultify` zachowuje swoje przewagi: workspace context, split mode, actions with approval, artifact handoff i organizational memory.

---

## 1.1 Cross-cutting parity architecture

`Chat v8` pozostaje kanonicznym SSOT dla produktu chat.

Jednoczesnie `Chat v8` deleguje przekrojowe zasady do pakietu `AI Leader Parity Architecture v8`, przede wszystkim:

- `AI_WORKSPACE_PROJECT_RUNTIME_ARCHITECTURE_V8.md` for shared workspace/project runtime,
- `AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md` for connector and enterprise retrieval rules,
- `AI_HUMAN_IN_THE_LOOP_GOVERNANCE_ARCHITECTURE_V8.md` for shared approval doctrine,
- `AI_COLLABORATION_AND_PUBLISHING_ARCHITECTURE_V8.md` for cross-surface sharing and publishing,
- `AI_IDENTITY_ROLES_AND_SCOPE_ARCHITECTURE_V8.md` for AI scope resolution,
- `AI_OUTPUT_TRUST_ARCHITECTURE_V8.md` for trust, provenance and routing explainability.

This document still owns:

- chat shell,
- chat workflow,
- message/thread semantics,
- chat-specific controls and UX promises.

Current hardening expectation:

- `Chat v8` must no longer claim leader-grade parity only from local chat UX,
- leader-grade status now depends on shared progress in workspace runtime, enterprise search, collaboration, identity/scope and output trust,
- benchmark, gap matrix and parity package must stay synchronized when statuses change.

---

## 2. Mission

Zbudowac w `consultify` chat, ktory:
- odpowiada jak leader-grade assistant,
- pracuje na rozmowach, plikach, URL-ach i kontekscie workspace,
- jest czytelny w historii i revisit flow,
- ma jasne source and scope semantics,
- nie robi silent mutations,
- potrafi prowadzic usera od rozmowy do dzialania.

Docelowy user feeling ma byc bliski liderom:
- `ChatGPT`: prosty i szybki core chat flow,
- `Claude`: mocna historia, folders/projects semantics i file work,
- `Perplexity`: retrieval transparency i research discipline.

`Consultify` ma dodac do tego:
- workspace-aware split mode,
- AI actions z review i approval,
- save-to-artifact flows,
- business context i organizational memory.

---

## 3. Scope produktu

### 3.1 In scope

- full chat i split chat jako jeden produkt,
- conversation history i library,
- folders personal/team,
- conversation lifecycle: create, title, rename, pin, archive, delete, move, revisit,
- message and thread operations: edit, regenerate, fork/branch, compare variants,
- local files i URL attachments,
- cloud file usage tylko tam, gdzie runtime jest realny,
- scope/modes/tools/custom instructions,
- memory and personalization semantics,
- model/tier selection,
- response streaming, stop, retry, error states,
- AI actions i approvals,
- feedback i learning loops,
- voice and multimodal contract dla obecnego runtime,
- sharing and permissions contract dla rozmow i folderow,
- rich output and rendering contract inside chat,
- enterprise, retention and compliance boundaries dla chat content,
- source transparency i citation expectations,
- handoff do notes/tasks/decisions/ideas i innych artifact flows.

### 3.2 Out of scope for v8 baseline

- budowa osobnego komunikatora team-chat klasy Slack,
- vendor-style app marketplace,
- udawanie pelnej multimodal parity dla vision/images, jesli runtime tego nie wspiera,
- ukrywanie roznicy miedzy best-effort a guaranteed citations,
- pokazywanie w UI funkcji, ktore nie maja realnego runtime support,
- greenfield rewrite calego chat stacku bez reuse istniejacych komponentow.

---

## 4. Product principles

### 4.1 One canonical shell

Chat ma miec jedna glowna surface definition.
Canonical shell to `UnifiedChatPanel`.

### 4.2 One conversation system

Historia, foldery, archiwum, search i revisit nie sa dodatkiem.
To rownorzadna czesc produktu.

### 4.3 One scope model

User musi rozumiec, z czego AI korzysta:
- `workspace`,
- `conversation history`,
- `attachments`,
- `web`,
- `org memory`,
- `project/business context`.

Brak ukrytych lub implicit scope paths.

### 4.4 Retrieval must be honest

Jesli UI obiecuje plik, URL, cloud source albo citations, runtime musi to wspierac.
Jesli cos jest partial, dokumentacja i produkt maja to mowic wprost.

### 4.5 AI actions are governed

AI moze sugerowac i przygotowywac akcje, ale nie moze robic istotnych zmian silent.
Model kanoniczny:

`propose -> review -> approve/reject -> execute/audit`

### 4.6 Voice is one user-facing system

Voice nie moze byc zbiorem ukrytych eksperymentow.
User-visible contract musi jasno rozroznic:
- dictation,
- voice conversation,
- TTS / auto-read.

### 4.7 Split mode is a product advantage

Split chat nie jest mniejsza kopia full chat.
To tryb pracy z workspace context i jedna z glownych przewag `consultify`.

---

## 5. Canonical product path

Nadrzedna sciezka produktu ma byc:

`entry -> select or create conversation -> understand scope/modes -> ask -> stream -> inspect -> refine -> act/save -> revisit`

`understand scope/modes` nie znaczy, ze user zawsze musi wejsc w osobny setup step.
Znaczy, ze przed wyslaniem pytania produkt musi dawac userowi zrozumienie:
- jaki jest context,
- jakie source classes sa aktywne,
- jaki tryb pracy AI jest wlaczony.

Rozszerzenia tej sciezki:
- `entry -> attach -> ask grounded question -> inspect sources -> continue`,
- `entry -> deep research confirm -> stream -> review -> save or act`,
- `split workspace -> ask contextual question -> approve action -> continue working`.

> V8 Decision W2-1 applied — 2026-03-23
>
> Intent classification at the chat intake boundary uses a hybrid approach. The system uses LLM classification first. Borderline cases require user confirmation. Safe rule: clear conversational ask → stay in chat; clear governed work request → enter execution/proposal path; ambiguous ask → ask user whether this should become governed work.

---

## 6. Model domenowy

### 6.1 Encja `Conversation`

Kanonicznie rozmowa ma:
- `conversationId`
- `title`
- `titleSource`
- `language`
- `messageCount`
- `lastMessageAt`
- `starred`
- `archived`
- `chatFolderId?`
- `projectId?`
- `workspaceContextSnapshot?`
- `createdBy`
- `createdAt`
- `updatedAt`

### 6.2 Encja `ChatFolder`

Folder historii ma:
- `folderId`
- `name`
- `scope` as `personal | team`
- `color`
- `description?`
- `conversationCount`
- `createdBy`
- `organizationId`
- `createdAt`
- `updatedAt`

### 6.3 Encja `ConversationMessage`

Wiadomosc ma:
- `messageId`
- `conversationId`
- `role`
- `content`
- `messageType`
- `metadata`
- `artifacts?`
- `citations?`
- `actions?`
- `createdAt`

> V8 Decision W2-3 applied — 2026-03-23
>
> `messageType` must include a dedicated type for governed proposals (e.g. `execution_proposal`). Governed proposals render as first-class proposal messages in the conversation thread — they must NOT be hidden inside the generic `actions` field. The `actions` field may still carry lightweight conversational actions.

### 6.4 Encja `ChatActionProposal`

Akcja AI ma:
- `actionId`
- `conversationId`
- `targetType`
- `proposalType`
- `status`
- `approvalState`
- `auditRef`
- `createdAt`
- `resolvedAt?`

> V8 Decision W2-2 applied — 2026-03-23
>
> Wave 2 target: facade alignment — one user-visible proposal family. `ChatActionProposal` and `ActionProposal` (from Execution Agent) present as one proposal experience to the user. Full data-model unification into one canonical underlying proposal model is the Wave 3 merge target. Wave 2 must NOT be blocked on that full unification.

### 6.5 Encja `AttachmentContext`

Kontekst grounded conversation ma:
- `docIds`
- `sourceType`
- `sourceLabel`
- `ingestionState`
- `retrievalMode`
- `citationExpectation`

---

## 7. Canonical runtime sources

Glowne runtime zrodla prawdy dla `Chat v8`:
- `src/components/AIChat/UnifiedChatPanel.tsx`
- `src/components/AIChat/EnhancedChatInput.tsx`
- `src/components/AIChat/ChatHistorySidebar.tsx`
- `src/store/useConversationStore.ts`
- `src/store/useChatProjectStore.ts`
- `src/services/api.ts`
- `src/hooks/useAIStream.ts`
- `server/src/routes/ai.routes.ts`
- `server/src/routes/conversations.routes.ts`
- `server/src/routes/chat-projects.routes.ts`
- `server/src/routes/voice.routes.ts`

Legacy but live surface:
- `src/views/AIChatWelcomeView.tsx`

---

## 8. Package map

Main `v8` suite:
- `CHAT_V8_SSOT.md`
- `CHAT_V8_BENCHMARK.md`
- `CHAT_V8_WORKFLOW_MODEL.md`
- `CHAT_V8_AS_IS.md`
- `CHAT_V8_GAP_MATRIX.md`
- `CHAT_V8_IMPLEMENTATION_PLAN.md`
- `CHAT_V8_AI_GOVERNANCE.md`
- `CHAT_V8_RUNTIME_TRUTH_MAP.md`

Build-ready supporting specs:
- `CHAT_V8_CONTROL_SURFACE_SPEC.md`
- `CHAT_V8_HISTORY_AND_LIBRARY_MODEL.md`
- `CHAT_V8_ATTACHMENTS_AND_RETRIEVAL.md`
- `CHAT_V8_MODES_AND_SCOPE_MODEL.md`
- `CHAT_V8_ACTIONS_AND_APPROVALS.md`
- `CHAT_V8_VOICE_AND_MULTIMODAL.md`
- `CHAT_V8_RESPONSE_MODEL.md`
- `CHAT_V8_PROMPT_SYSTEM_AND_COMPOSITION.md`
- `CHAT_V8_PROMPT_CONTENT_AND_QUALITY.md`
- `CHAT_V8_PROMPT_MASTERY_GAP_MATRIX.md`
- `CHAT_V8_MEMORY_AND_PERSONALIZATION.md`
- `CHAT_V8_MESSAGE_AND_THREAD_OPERATIONS.md`
- `CHAT_V8_SHARING_AND_PERMISSIONS.md`
- `CHAT_V8_RICH_OUTPUT_AND_RENDERING.md`
- `CHAT_V8_ENTERPRISE_AND_COMPLIANCE.md`

Reading order:
- start with `SSOT`,
- then `BENCHMARK`, `WORKFLOW_MODEL`, `AS_IS`, `GAP_MATRIX`, `RUNTIME_TRUTH_MAP`,
- then `AI_GOVERNANCE` and `IMPLEMENTATION_PLAN`,
- then detailed specs.

Normative ownership by topic:
- product spine and package map: `CHAT_V8_SSOT.md`
- parity and deliberate non-goals: `CHAT_V8_BENCHMARK.md`
- runtime classification: `CHAT_V8_RUNTIME_TRUTH_MAP.md`
- controls and shell behavior: `CHAT_V8_CONTROL_SURFACE_SPEC.md`
- history and folders: `CHAT_V8_HISTORY_AND_LIBRARY_MODEL.md`
- retrieval and source classes: `CHAT_V8_ATTACHMENTS_AND_RETRIEVAL.md`
- modes, scope and personalization toggles: `CHAT_V8_MODES_AND_SCOPE_MODEL.md`
- action lifecycle and approvals: `CHAT_V8_ACTIONS_AND_APPROVALS.md`
- response classes and rich in-thread rendering: `CHAT_V8_RESPONSE_MODEL.md`, `CHAT_V8_RICH_OUTPUT_AND_RENDERING.md`
- prompt composition and precedence rules: `CHAT_V8_PROMPT_SYSTEM_AND_COMPOSITION.md`
- prompt text quality and anti-duplication rules: `CHAT_V8_PROMPT_CONTENT_AND_QUALITY.md`
- prompt mastery gaps, priorities and target hardening path: `CHAT_V8_PROMPT_MASTERY_GAP_MATRIX.md`
- memory and personalization: `CHAT_V8_MEMORY_AND_PERSONALIZATION.md`
- message/thread edits and branching: `CHAT_V8_MESSAGE_AND_THREAD_OPERATIONS.md`
- sharing, roles and visibility: `CHAT_V8_SHARING_AND_PERMISSIONS.md`
- enterprise retention and compliance: `CHAT_V8_ENTERPRISE_AND_COMPLIANCE.md`
- voice and multimodal boundaries: `CHAT_V8_VOICE_AND_MULTIMODAL.md`

Background-only references after `v8`:
- `docs/UNIFIED_AI_CHAT_SYSTEM.md`
- `docs/AI_CHAT_SYSTEM_DESIGN.md`
- `docs/AI_CHAT_DATA_MODEL.md`
- `docs/api/AI_CHAT_API.md`
- `docs/flows/core/AI_CHAT_ASSISTANCE_FLOW.md`
- `docs/product/modules/ai/AI_CHAT_CONTROL_AUDIT_2026-03-07.md`

Po utworzeniu pakietu `CHAT_V8_*` powyzsze dokumenty nie powinny byc juz traktowane jako rownorzedny SSOT.

---

## 9. Product advantages unique to Consultify

`Chat v8` nie ma byc tylko "jak liderzy plus polish".
Ma miec cztery przewagi:

1. `Workspace-native`
AI wie, nad czym user pracuje, i moze pomagac w split mode.

2. `Action-native`
Chat nie konczy sie na odpowiedzi. Moze przejsc do reviewable actions.

3. `Artifact-native`
Wyniki rozmowy moga byc zapisane do notatki, taska, decyzji, idei i dalszych modulow.

4. `Governed`
AI operations, retrieval i approvals sa jawne, reviewable i audytowalne.

5. `Prompt-governed`
Prompt system ma byc traceable, deduplikowany i oparty o jedna composition truth, a nie o konkurujace warstwy instrukcji.

---

## 10. Taxonomy index

### 10.1 Source classes

Normative source classes for `Chat v8`:
- `general model knowledge`
- `conversation history`
- `workspace context`
- `attachments`
- `web/research`
- `organizational memory`

Source-class details live in:
- `CHAT_V8_ATTACHMENTS_AND_RETRIEVAL.md`
- `CHAT_V8_MODES_AND_SCOPE_MODEL.md`
- `CHAT_V8_MEMORY_AND_PERSONALIZATION.md`
- `CHAT_V8_PROMPT_SYSTEM_AND_COMPOSITION.md`

### 10.2 Response classes

Normative response classes for `Chat v8`:
- `general answer`
- `workspace-grounded answer`
- `attachment-grounded answer`
- `research answer`
- `proposal response`
- `action-carrying response`
- `artifact-oriented response`

Response-class details live in:
- `CHAT_V8_RESPONSE_MODEL.md`
- `CHAT_V8_RICH_OUTPUT_AND_RENDERING.md`

### 10.3 Action lifecycle vocabulary

Normative lifecycle vocabulary for durable AI actions:

`proposed -> pending_review -> approved or rejected -> executed or closed -> audited`

Action lifecycle details live in:
- `CHAT_V8_ACTIONS_AND_APPROVALS.md`
- `CHAT_V8_AI_GOVERNANCE.md`

---

## 11. Non-negotiable rules for v8

- nie utrzymujemy dwoch rownoleglych definicji glownego chat produktu,
- nie dokumentujemy fikcyjnych lub placeholder flows jako "done",
- nie mieszamy `chat folder` z `PMO project`,
- nie pokazujemy cloud connect jako completed, jesli OAuth nie jest realny,
- nie traktujemy citations jako guaranteed, jesli runtime jest best-effort,
- nie dopuszczamy silent execution of meaningful AI actions,
- nie rozpraszamy source of truth po wielu niespojnych dokumentach.

---

## 12. Completeness criteria

`Chat v8` jest kompletne dopiero wtedy, gdy:
- istnieje jeden canonical shell i jeden canonical route model,
- historia jest pelnym systemem library, a nie tylko lista rozmow,
- wszystkie glowne control groups maja explicit contract,
- scope/modes i retrieval sa opisane bez luk i bez niespojnych obietnic,
- prompt system ma jedna composition order i jednego ownera dla base persona semantics,
- memory/personalization ma jawny trust contract,
- message and thread operations sa okreslone jak u liderow lub maja jawny non-goal,
- sharing/permissions i enterprise boundaries sa opisane bez zgadywania,
- rich output inside chat ma jasny rendering contract,
- AI actions maja twardy review and approval contract,
- voice ma jeden czytelny user-facing model,
- starsze dokumenty nie sa juz wymagane jako rownorzedne SSOT,
- pakiet `CHAT_V8_*` wystarcza do projektowania i wdrazania zmian bez zgadywania.
