# M01 CZAT — FAZA 1: PRAWDA KODU

Audyt Harvard / Protokół V1. Faza KOD (READ-ONLY). Branch `feat/deliverables-light`. Data: 2026-06-11.
Zasada: prawda kodu, nie dokumentacji. Inwentarz źródłowy: `Harvard/podzial/inventory/INV_A_czat_canvas.md` (CZAT, poz. 1-59).

**Werdykt zbiorczy:** 49 REALNE · 0 MOCK · 1 ZEPSUTE/ROZJAZD (poz. 48 AI memory) · 8 UKRYTE/MARTWE · 1 częściowo (poz. 48 panel orphan).
Większość pozycji "[ZA FLAGĄ]" to REALNE-ale-wyłączone-flagą (kod istnieje, działa po włączeniu), nie mock.

---

## 1a. REALNE (z dowodem plik:linia)

### A. Zarządzanie rozmowami
- **1. Nowa rozmowa** — `POST /api/conversations/` `server/src/routes/conversations.routes.ts:403`; store `src/stores/useConversationStore.ts`. REALNE.
- **2. Historia rozmów (sidebar)** — `src/components/AIChat/ChatHistorySidebar.tsx`. REALNE.
- **3. Wyszukiwanie rozmów** — server-side `GET /api/conversations/search` `conversations.routes.ts:1635` (FTS, migracja `20260409_p35_conversation_fts.sql`). REALNE.
- **4. Rename / gwiazdka / archiwizacja / usunięcie** — `PATCH /:id` `:569`, `DELETE /:id` `:688` (soft-delete, migracja `20260331_p35b_conversation_soft_delete.sql`); `ConversationActions.tsx`. REALNE.
- **5. Auto-tytuł** — `POST /:id/title/generate` `conversations.routes.ts:1187`. REALNE.
- **6. Projekty (foldery) + członkowie** — `MoveToProjectModal.tsx`, `useChatProjectsRealtime.ts`; migracje `add_chat_projects.sql`, `773_chat_project_rbac.sql`, `775_chat_project_nesting.sql`, `515_team_chat_projects.sql`. REALNE.
- **7. Udostępnienie linkiem publicznym** — `share.routes.ts` montowany `Gateway.ts:480` (poza gateway guard dla `/share/:token`); migracja `283_conversation_sharing.sql`. REALNE.
- **8. Eksport rozmowy (json/md/text)** — `GET /:id/export` `conversations.routes.ts:2038`. REALNE.
- **9. Branch rozmowy** — `POST /:id/branch` `conversations.routes.ts:2220`; migracja `282_conversation_branches.sql`. REALNE.
- **10. Podsumowanie / bulk / auto-archive / migracja localStorage** — `POST /:id/summarize` `:1503`, `POST /bulk` `:1315`, `POST /auto-archive` `:2162`, `POST /migrate` `:1415`. REALNE.
- **11. Menu czatu (hamburger)** — `src/components/AIChat/ChatMenu.tsx`. REALNE.

### B. Kompozer
- **12. Pole wejściowe + streaming + stop/abort** — `EnhancedChatInput.tsx`, `src/hooks/useAIStream.ts`. REALNE.
- **13. Slash-commands (15)** — `src/components/AIChat/composer/slashCommands.ts`; `/image` = wyłącznie szablon tekstu (`:200-201` `textFallback: 'Generate an image of: '`), nie generuje obrazu — zgodne z inwentarzem. REALNE.
- **14. Wzmianki `@`** — `composer/useMentionSources.ts`. REALNE.
- **15. Załączniki plikowe (ingest + URL)** — `POST /api/ai/attachments/ingest` `ai.routes.ts:351`, `POST /attachments/ingest-url` `:540`. REALNE.
- **16. Pliki z chmury** — `CloudFilePicker.tsx`. REALNE.
- **17. ToolsMenu (deep research/reasoning/multi-agent/private/TTS + style)** — `ToolsMenu.tsx`. REALNE.
- **18. Co-Thinker (persony)** — `CoThinkerMenu.tsx`. REALNE.
- **19. Focus mode (zakres źródeł)** — wpięte w `chat/confirm`/`chat/stream` (`knowledgeSources`, `focusMode` w body `ai.routes.ts:1183+`). REALNE.
- **20. Selektor narzędzia wyjściowego** — `OutputToolSelector.tsx`. REALNE.

### C. Wiadomości i odpowiedzi
- **22. Streaming SSE** — `POST /api/ai/chat/stream` `ai.routes.ts:1424` + partial recovery `GET /stream/partial/:sessionId` `:5341`; idempotency migracja `20260602_chat_message_idempotency_ordering.sql`. REALNE.
- **23. Markdown + bloki kodu z kopiowaniem** — `ChatCodeBlock.tsx`, `MessageRenderer.tsx`. REALNE.
- **24. Edycja wiadomości + regeneracja** — `POST /:id/truncate` `conversations.routes.ts:1058`. REALNE.
- **25. Akcje odpowiedzi (kopiuj/pobierz/TTS/feedback)** — `ResponseActions.tsx`, `InlineResponseFeedback.tsx`, `TeresaTTSPlayer.tsx`. REALNE.
- **26. Zapis do Context OS (bookmark)** — `POST /:id/messages/:messageId/save-to-context` `conversations.routes.ts:974`. REALNE.
- **27. Cytowania i źródła** — `CitationList.tsx`; walidacja serwerowa w `ai.routes.ts`. REALNE.
- **29. Ślad rozumowania (thinking/reasoning)** — `ThinkingStatusLine.tsx`. REALNE.
- **30. Karty propozycji AI** — `MessageRenderer.tsx:483` `<ExecutionProposalMessage>`, `:672` `<TeresaProposalCard>`, `:692` `<ChatTableProposalCard>`; confirm `POST /api/ai/chat/confirm` `ai.routes.ts:1184`. REALNE (zob. 1g).
- **31. Strukturalne bloki wyjścia** — `StructuredOutputBlock.tsx`. REALNE.
- **32. Chipy artefaktów** — `ArtifactChip.tsx`. REALNE.
- **33. Inteligentne sugestie follow-up** — `src/components/Chat/ChatSmartSuggestions.tsx`. REALNE.
- **34. Wskaźnik jakości odpowiedzi** — `ResponseQualityIndicator.tsx`. REALNE.

### D. Deep research
- **35. Deep Thinking Orchestrator v2** — `server/.../deepThinkingOrchestrator.ts` (potwierdzony import w ai.routes). REALNE.
- **36. Pytania doprecyzowujące** — `POST /api/ai/deep-research/clarify` `ai.routes.ts:932`. REALNE.
- **37. Postęp badania w czacie** — `ResearchProgress.tsx`. REALNE.
- **38. Eksport raportu badawczego** — `POST /api/ai/deep-research/export` `ai.routes.ts:1027`. REALNE.

### E. Głos
- **40. Rozmowa głosowa live (Gemini Live)** — `src/contexts/TeresaVoiceContext.tsx`; config `GET /api/public/anna/voice-config` `public-anna.routes.ts:1204` (wymaga `GEMINI_LIVE_API_KEY`+`TERESA_VOICE_*`). REALNE-warunkowo.
- **41. Globalny overlay głosowy** — `VoiceConversationOverlay.tsx`. REALNE.
- **42. Dyktowanie (mic→tekst)** — w `EnhancedChatInput.tsx`. REALNE.
- **43. Auto-czytanie (TTS web)** — `TeresaTTSPlayer.tsx`. REALNE.

### F. Kontekst org/encji
- **45. Chat z kontekstem encji** — `src/hooks/useOpenChatWithContext.ts`; split-panel `MainLayout.tsx:356`. REALNE.
- **46. Badge kontekstu** — `ContextBadge.tsx`. REALNE.
- **47. OrgContext** — przełączanie org zasila body chatu. REALNE.
- **48a. AI memory CRUD (backend)** — `server/src/routes/ai/ai-memory.routes.ts`, montaż `/api/ai-memory` `Gateway.ts:488`. KOD REALNY, ALE bramkowany internal-tools → patrz 1c (rozjazd vs inwentarz).
- **49. Tryb prywatny** — `PrivateModeDetails.tsx` (popover ZA FLAGĄ `privateModeDetails`, default ON). REALNE.
- **50. Kickoff / quick prompts per moduł** — `MainLayout.tsx:356-373`. REALNE.

### G. Handoffy (szczegóły w 1g)
- **53-57.** Wszystkie intent-detektory wpięte w `UnifiedChatPanel.tsx` (importy `:95,104,107,110,111,120`; rozgałęzienia `:2189/2362/2389/2584/2590/2617/2773`). REALNE.

### Flagowane-ale-realne (kod obecny, default ON na FE — patrz 1f)
- **21. Char counter / hint / soft-limit / PII-toast** — `<InputCharCounter>` `EnhancedChatInput.tsx:1226`, flaga `inputCharCounterFlag.ts` default ON. REALNE (renderuje się domyślnie).
- **28. Trust badge / panel** — `<TrustBadge>` `MessageRenderer.tsx:1729`, `trustBadgeFlag.ts` default ON. REALNE.
- **44. Legenda trybów głosu** — `<VoiceModeLegend>` `EnhancedChatInput.tsx:1248`, `voiceModeLegendFlag.ts` default ON. REALNE.

---

## 1b. MOCK / STUB / fabrykowane klientem

Brak czystych mocków w module CZAT. Wszystkie audytowane przepływy uderzają w realne endpointy i tabele.
(Uwaga: poz. 17 sekcji CANVAS „sourceRefs [STUB]" należy do M02, poza zakresem.)

---

## 1c. ZEPSUTE / WIDOCZNE-ALE-ZEPSUTE / ROZJAZD KONTRAKTU

- **48b. AI memory CRUD — ROZJAZD z inwentarzem ([DZIAŁA] zawyżone).** Endpointy `/api/ai-memory` są bramkowane `internalToolsGuard` = `[gatewayVerifyToken, requireInternalToolsAccess]` (`Gateway.ts:385,488`). `requireInternalToolsAccess` (`server/src/middleware/internalTools.middleware.ts:48-78`) zwraca **404** gdy `INTERNAL_TOOLS_ENABLED !== 'true'` LUB domena/rola/org spoza allowlisty (default domena dbr77). Skutek: dla normalnej organizacji-klienta pamięć AI (user/projekt/org) **nie jest dostępna** — twardy 404, nie ciche degradowanie. Inwentarz oznacza to „[DZIAŁA]" bez zastrzeżenia internal-only.
  - Dowód: `Gateway.ts:385`, `internalTools.middleware.ts:48-51,75-77`.
  - **Severity: P2** (funkcja celowo internal, ale inwentarz/UX wprowadza w błąd; brak ścieżki klienckiej).
- **48c. OrganizationMemoryPanel — orphan (martwy FE).** `src/components/AIChat/OrganizationMemoryPanel.tsx` ma **0 zewnętrznych importów** i **0 wywołań API** (brak `fetch/api./axios` w pliku). Inwentarz już to oznacza „[UKRYTE — orphan]" — potwierdzone. Patrz 1d.

Innych „przycisków-zawsze-błąd" ani połkniętych `requireTables→503` w ścieżkach CZAT nie znaleziono w tej fazie.

---

## 1d. UKRYTE / MARTWY KOD

Weryfikacja: zliczenie zewnętrznych referencji (poza własnym plikiem i testami) w `src/`.

| Poz. | Komponent | Ref. zewn. | Werdykt | Rekomendacja |
|---|---|---|---|---|
| 58 | `WorkModeMenu.tsx` | 0 | MARTWE | **wytnij** |
| 58 | `ChatToggleButton.tsx` | 0 | MARTWE | **wytnij** (para z ChatOverlay) |
| 58 | `ChatOverlay.tsx` | 1 (tylko ChatToggleButton, sam martwy) | MARTWE | **wytnij** razem z ChatToggleButton |
| 58 | `CodeInterpreter/` | 0 | MARTWE | **wytnij** |
| 58 | `ActiveModeStrip.tsx` | 0 | MARTWE | **wytnij** |
| 48 | `OrganizationMemoryPanel.tsx` | 0 + 0 API | MARTWE (orphan) | **wytnij** lub wepnij do sidebaru jeśli AI-memory ma być klienckie |
| 59 | `AIOSHub`, `ActionCenter`, `Wave5…Panel`, `Wave9…Panel` (i Wave6-8) | tylko `AppRoutes.tsx` | UKRYTE (nie martwe) | **zostaw** — bramkowane `InternalToolsGate enabled={canUseInternalTools(currentUser)}` (`AppRoutes.tsx:778,1231,1250,1262,1296`), niewidoczne dla klientów |
| 39 | `ResearchSessionsDock.tsx` | `WorkCanvasShell.tsx:486`, `AppRoutes.tsx` | UKRYTE/REALNE | **zostaw** — używany w WorkCanvas internal shell |

Dowód martwości: `grep -rl "\bKomponent\b" src/` z wykluczeniem testów i pliku własnego → 0 trafień dla WorkModeMenu/ChatToggleButton/CodeInterpreter/ActiveModeStrip/OrganizationMemoryPanel.

---

## 1e. Wiring FE↔BE↔DB

| Funkcja | Endpoint | Tabela DB | Migracja | Status |
|---|---|---|---|---|
| Streaming | `POST /api/ai/chat/stream` (`ai.routes.ts:1424`) + partial `GET /stream/partial/:sessionId` (`:5341`) | conversations, conversation_messages | `073_conversations.sql`, `20260602_chat_message_idempotency_ordering.sql` | REALNE |
| CRUD rozmów | `POST/PATCH/DELETE /api/conversations` (`:403,569,688`) | conversations (soft-delete) | `073_conversations.sql`, `20260331_p35b_conversation_soft_delete.sql` | REALNE |
| Wyszukiwanie | `GET /api/conversations/search` (`:1635`) | conversations FTS | `20260409_p35_conversation_fts.sql` | REALNE |
| Załączniki | `POST /api/ai/attachments/ingest` (`:351`), `ingest-url` (`:540`) | (storage/attachments) | — | REALNE |
| Share | `share.routes.ts` `/api/.../share` + `/share/:token` (`Gateway.ts:480`) | share_links / conversation_shares | `283_conversation_sharing.sql`, `018/019_share_links*.sql` | REALNE |
| Branch | `POST /api/conversations/:id/branch` (`:2220`) | conversation_branches | `282_conversation_branches.sql` | REALNE |
| Export | `GET /api/conversations/:id/export` (`:2038`) | conversations/messages (read) | — | REALNE |
| Title-generate | `POST /api/conversations/:id/title/generate` (`:1187`) | conversations (update) | — | REALNE |
| Deep-research | `POST /api/ai/deep-research/clarify` (`:932`), `/export` (`:1027`) | research sessions (internal) | — | REALNE |
| Save-to-Context | `POST /api/conversations/:id/messages/:messageId/save-to-context` (`:974`) | conversation_messages (read) → context OS | — | REALNE |
| Confirm propozycji | `POST /api/ai/chat/confirm` (`:1184`) | (apply na encje) | `20260417_chat_message_types_execution_family.sql` | REALNE |
| AI memory | `/api/ai-memory` (`Gateway.ts:488`) | ai_memory | — | REALNE-kod, **internal-only 404 dla klienta** (1c) |

---

## 1f. Flagi

Mechanizm FE (chatV9): per-flag helper, kolejność `?ff_X` → `localStorage["ff.x"]` → `import.meta.env.VITE_X` → default. **Wszystkie zarejestrowane flagi chatV9 default = ON** (kod: `readEnvFlag()` zwraca `true` gdy env nieustawione, np. `inputCharCounterFlag.ts:34-41`, `trustBadgeFlag.ts`). To NIE wzorzec `!== 'false'` — to jawny default `true` przy braku env. Skutek: poz. 21/28/44/49 renderują się **domyślnie**.

Mechanizm BE (Feature flags): `server/src/config/FeatureFlags.ts` + odczyt runtime przez **strict `=== 'true'`** → default OFF.

| Flaga | Default BE (runtime) | Default FE | Kto włącza | Wpływ na CZAT |
|---|---|---|---|---|
| chatV9: `inputCharCounter`, `trustBadge`, `voiceModeLegend`, `privateModeDetails`, `inputHintStrip`, `inputSoftLimitToast`, `piiHeuristicToast` itd. | — | **ON** (helper default true) | URL `?ff_*`, localStorage, `VITE_*` | poz. 21,28,44,49 — widoczne domyślnie, additive UI, nie blokuje Send |
| `ENABLE_V8_GLOBAL` (poz. 52) | **OFF** — `process.env.ENABLE_V8_GLOBAL === 'true'` (`FeatureFlags.ts:113`, `v8FeatureGate.middleware.ts:15`, `featureFlagService.ts:75`) | gated | env serwera | V8 context indicator + run-control artefaktów — OFF → niewidoczne/503-gate |
| `ENABLE_DELIVERABLES_LIGHT` (BE) | **OFF** — `=== 'true'` (`FeatureFlags.ts:121`); router 404 gdy off (`deliverablesGenerations.routes.ts:40`) | — | env serwera | handoffy deck/doc/sheet in-place w Canvas |
| `VITE_ENABLE_DELIVERABLES_LIGHT` (FE) | **OFF** — `=== 'true'` (`src/services/deliverablesGeneration.ts:46`) | OFF | build env | gdy off → handoff nawiguje do legacy `/prezentacje`,`/wordy`,`/excele` (`UnifiedChatPanel.tsx:2584,2773`) |
| `ENABLE_TERESA_RETRIEVAL` | **OFF** — `=== 'true'` (`FeatureFlags.ts:127`, `persona.ts:328`, `ai.routes.ts:3116`) | — | env serwera | narzędzia READ org dla Teresy — off → brak retrieval |
| `myWorkSignalsV2` (poz. 51) | n/d (FE) | wg helpera | — | sygnały Important — ZA FLAGĄ |

**Kluczowe:** trzy serwerowe flagi (V8/DeliverablesLight/TeresaRetrieval) default **OFF** i używają strict `=== 'true'` — czyli w czystym deployu bez env handoffy light, V8 i retrieval są wyłączone (legacy redirecty). To zgodne z inwentarzem („część ZA FLAGĄ").

---

## 1g. Połączenia międzymodułowe

| Kierunek | Moduł po drugiej stronie | Mechanizm | Plik:linia | Status |
|---|---|---|---|---|
| WYJŚCIE→ | Prezentacje / Canvas deck | intent → `detectPresentationIntent` → light gen in-place LUB nav `/prezentacje` | `UnifiedChatPanel.tsx:104,2590,2617,2773` | REALNE (poz. 53) |
| WYJŚCIE→ | Wordy / Canvas doc | `detectDocumentIntent` → light LUB nav `/wordy` | `UnifiedChatPanel.tsx:104,2362,2389,2584` | REALNE (poz. 54) |
| WYJŚCIE→ | Excele / Tabele | `detectTableIntent`/`detectExceleIntent` → ChatToSchemaPanel / `/excele` | `UnifiedChatPanel.tsx:111` | REALNE (poz. 55) |
| WYJŚCIE→ | Ideas: Mind Map | `detectMindmapIntent` | `UnifiedChatPanel.tsx:107` | REALNE (poz. 56) |
| WYJŚCIE→ | Ideas: Process Flow | `detectProcessFlowIntent` | `UnifiedChatPanel.tsx:110` | REALNE (poz. 56) |
| WYJŚCIE→ | Ideas: Whiteboard | `detectWhiteboardIntent` | `UnifiedChatPanel.tsx:120` | REALNE (poz. 56) |
| WYJŚCIE→ | Otwarty Canvas (pisanie) | `detectCanvasWriteIntent` → stream do aktywnego dokumentu | `UnifiedChatPanel.tsx:95,2189` | REALNE (poz. 57) |
| WYJŚCIE→ | Context OS | bookmark wiadomości → save-to-context | `conversations.routes.ts:974` | REALNE (poz. 26) |
| WYJŚCIE→ | Encje domenowe (inicjatywa/decyzja/zadanie…) | karty propozycji → `POST /chat/confirm` apply | `MessageRenderer.tsx:483,672,692` + `ai.routes.ts:1184` | REALNE (poz. 30) |
| WEJŚCIE← | Wszystkie moduły (split-view) | `UnifiedChatPanel mode="split"` montowany w layoutcie | `MainLayout.tsx:356` | REALNE |
| WEJŚCIE← | Kontekst encji/org | `useOpenChatWithContext` + pmoContext/workspaceContext + OrgContext | `useOpenChatWithContext.ts`, `MainLayout.tsx:356-373` | REALNE (poz. 45-47,50) |
| WEJŚCIE← | Artefakty (reload) | `ArtifactChip` otwiera Canvas po reloadzie | `ArtifactChip.tsx` | REALNE (poz. 32) |

---

## Pozycje NIEZWERYFIKOWANE / odłożone
- **Treść SQL** poszczególnych handlerów (np. dokładne kolumny `conversation_messages`) — zweryfikowano istnienie tabel/migracji i ścieżek, nie pełen audyt każdego zapytania.
- **51. myWorkSignalsV2 / ChatSignalsPanel** — flaga istnieje; pełna ścieżka renderu niezweryfikowana w tej fazie (NIEZWERYFIKOWANE szczegóły).
- **Runtime smoke (montaż na żywo)** — to faza KOD (statyczna); brak dowodu wizualnego runtime.
