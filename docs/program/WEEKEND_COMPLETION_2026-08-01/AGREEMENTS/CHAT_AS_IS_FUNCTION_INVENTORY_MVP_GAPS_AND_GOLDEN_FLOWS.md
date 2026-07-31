---
document_id: CHAT-AS-IS-FUNCTION-INVENTORY-MVP-GAPS
module: Chat
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Chat — remanent funkcji, luki MVP i golden flows

## 1. Werdykt

Stan: **REAL / BROAD / PARTIAL / MULTIPLE SHELL RISK**. Chat ma dojrzały rdzeń
i wyjątkowo szeroki zakres, lecz część zachowań jest skupiona w bardzo dużym
`UnifiedChatPanel`, a pełna trasa `/chat` nadal ma legacy shell. Najważniejszym
zadaniem nie jest dodawanie przycisków, tylko konsolidacja jednego runtime,
uczciwość capabilities i potwierdzenie cross-module handoffów.

## 2. Kanoniczny runtime

- `src/components/AIChat/UnifiedChatPanel.tsx` — docelowy shell;
- `EnhancedChatInput.tsx` — composer, attachments, commands i voice;
- `ChatHistorySidebar.tsx` — historia, foldery, search i bulk;
- `useConversationStore.ts` — conversation/message lifecycle;
- `useChatProjectStore.ts` — foldery osobiste/zespołowe;
- `useAIStream.ts` i `/api/ai/chat/stream` — streaming;
- `conversations.routes.ts`, `ai.routes.ts`, `chat-projects.routes.ts`,
  `voice.routes.ts` — backend spine.

`AIChatWelcomeView` jest legacy/migration target, nie drugim wzorcem.

## 3. Inwentaryzacja

| Funkcja | Stan | Uwaga |
| --- | --- | --- |
| conversation CRUD/load | real | store + API |
| streaming/abort/retry | real | recovery do testu E2E |
| history groups/list | real | duże listy wymagają pagination/virtualization |
| server search | real/partial | coverage i ACL do odbioru |
| rename/star/archive/delete | real | retencja do decyzji |
| folders/subfolders/DnD | real | vocabulary project/folder do oczyszczenia |
| personal/team folders | real/partial | final role matrix potrzebna |
| bulk actions | real | partial-result UX do testu |
| local file ingest | real | format/size matrix potrzebna |
| URL ingest | real/partial | surface parity |
| cloud sources/connect | partial | nie deklarować jako gotowe |
| slash commands | real/partial | katalog i governance do ujednolicenia |
| mentions | real/partial | stable resolution/ACL do odbioru |
| scope/modes/model | partial | kilka źródeł stanu |
| dictation | real zależnie od browsera | fallback potrzebny |
| voice conversation/STT | partial | jeden kontrakt UX |
| TTS/auto-read | real | interruption/language test |
| deep research confirm | real/partial | evidence quality gate |
| deep thinking/agent audit | real/partial | user-facing semantics do uproszczenia |
| citations/sources | partial | coverage i fragment anchors |
| save as Note/Idea | real | read-back i idempotencja do odbioru |
| `/task`/`/decision` | real/partial | jeden proposal family |
| Canvas commands | real | spójność z nowym Host blueprint |
| doc/sheet/deck generation | real/partial | nie mieszać orchestration w shellu |
| tool calls Ideas | real/partial | confirmation path istnieje |
| pending actions | partial | reject path/semantyka wymaga hardeningu |
| edit/regenerate/branch variants | partial | pełna widoczność branchy do domknięcia |
| sharing chat/folders | partial | ACL, attachments, source inheritance |
| memory/personalization | partial | consent i management UI |

## 4. P0 MVP

1. Jedna trasa i jeden shell — `/chat` na canonical Unified Chat.
2. Stabilne create/send/stream/stop/retry/revisit bez utraty wiadomości.
3. Historia, server search, rename, archive i folder personal.
4. Plik i URL pokazują realny ingest status i działające citations.
5. Widoczny scope, aktywne źródła, language i privacy state.
6. Note, Idea, Task, Decision, Initiative Candidate i Canvas handoff przez
   proposal/confirm/read-back.
7. Jeden model proposal i spójne approve/reject/error states.
8. Capability honesty dla cloud, voice, research, agents i eksportów.
9. Permission enforcement w UI, API, search, attachments i tool calls.
10. Draft recovery oraz idempotencja retry/tool execution.

## 5. P1

- pełne edit/fork/branch/variant compare;
- team folders i sharing;
- pamięć z panelem „co Teresa pamięta”;
- zunifikowany voice conversation;
- pełne cloud connectory MCP-like;
- source fragment preview i citation diagnostics;
- resumable long-running research/agent runs;
- przeniesienie orchestration z wielkiego UI componentu do command routera;
- pełny artifact switcher Chat × Canvas.

## 6. Golden flows

### GF-CHAT-01 — rozmowa i powrót

Użytkownik tworzy rozmowę, wysyła pytanie, zatrzymuje streaming, ponawia,
otrzymuje wynik, zmienia tytuł, zamyka aplikację i wraca dokładnie do rozmowy bez
duplikatów.

### GF-CHAT-02 — grounded answer

Użytkownik dołącza plik i URL. Oba przechodzą ingest, Teresa odpowiada wyłącznie
po dozwolonych źródłach, citations otwierają fragment, a niedostępne źródło jest
oznaczone.

### GF-CHAT-03 — rozmowa do Canvasu

Teresa uzgadnia założenia dużego dokumentu, otwiera właściwy Canvas, przekazuje
conversation context i zachowuje artifact card. Kolejne polecenie modyfikuje
jawnie aktywny artefakt.

### GF-CHAT-04 — rozmowa do działania

Użytkownik prosi o task/decyzję/inicjatywę. Teresa przygotowuje proposal z
targetem i diffem, użytkownik zatwierdza, moduł właściciela zapisuje, Chat
pokazuje read-back i deep link.

### GF-CHAT-05 — historia i folder

Użytkownik znajduje starą rozmowę po treści, przenosi ją do personal folder,
archiwizuje i przywraca. ACL źródeł nie zmienia się przez sam move.

### GF-CHAT-06 — voice

Użytkownik dyktuje, poprawia transcript i wysyła. Następnie używa voice
conversation i przerywa TTS. Audio/transcript respektują język i retencję.

### GF-CHAT-07 — awaria narzędzia

Tool timeout nie generuje fałszywego sukcesu. Użytkownik widzi częściowy wynik,
retry nie duplikuje poprzednich zapisów, a audit zachowuje oba podejścia.

### GF-CHAT-08 — brak uprawnień

Prompt i załącznik próbują skłonić Teresę do odczytu niedostępnego projektu.
Retrieval/tool gateway blokuje operację bez ujawnienia tytułu ani fragmentu.

## 7. Definition of Done

Chat jest gotowy dopiero, gdy canonical shell przechodzi wszystkie P0 golden
flows na stagingu. Istnienie endpointu lub widocznego przycisku nie wystarcza.
Każdy write ma target read-back, każdy source claim ma realny fragment, a każda
funkcja partial jest wyraźnie oznaczona albo wyłączona.
