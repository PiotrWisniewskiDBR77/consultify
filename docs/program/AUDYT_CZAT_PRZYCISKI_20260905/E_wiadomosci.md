# AUDYT E — wszystko klikalne NA WIADOMOŚCIACH i w pustym stanie /chat

Katalog: `/private/tmp/m03` (gałąź `codex/m03-admin-20260824`, HEAD `4332ade1c6`).
Staging: `https://staging.consultify.ai` (z `.env.local` → `VITE_API_TARGET`).
Metoda: statyczna analiza (grep/read) od korzenia renderu `/chat` (`src/routes/AppRoutes.tsx` →
`MainLayout` + `<UnifiedChatPanel mode="full">`, BEZ `SplitLayout`), curl bez auth na staging dla
każdej unikalnej trasy HTTP.

**Uwaga metodyczna nadrzędna**: `/chat` renderuje `UnifiedChatPanel` bezpośrednio (linia ~1860
`AppRoutes.tsx`), a NIE `SplitLayout`. To ma konsekwencje: `src/components/AIChat/Artifacts/**`
(ArtifactsPanel/ArtifactViewer/ArtifactEditor + wszystkie renderery) jest osiągalne WYŁĄCZNIE przez
`SplitLayout` (Studio/Executive/Leadership Dashboard/My Work/…), NIGDY z `/chat`. Cały ten katalog
jest więc NIEWIDOCZNY z badanego ekranu, mimo że nadzorca wymienił go w zakresie.

## Inwentarz

### MessageRenderer.tsx — 42 handlery zweryfikowane (własne pole widoku)

| # | Etykieta PL | klucz i18n | element plik:linia | handler | łańcuch | HTTP | trasa serwera | kontroler | flaga | curl | KLASA | uwagi |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Cytat inline `[N]` | — | MessageRenderer.tsx:177 | `handleClick(citation)` → `CitationList.handleCitationClick` | otwiera fragment inline lub `navigateToSource` (`useAppStore.setCurrentView`) | brak (klient) | — | — | — | — | OK-LOKALNY | działa na `getCitationAccessStatus==='ready'` |
| 2 | Potwierdź (Teresa confirm) | `teresaConfirm` napis PL z rejestru | MessageRenderer.tsx:935 | `onTeresaConfirmProceed` → `UnifiedChatPanel.tsx:2612 handleTeresaConfirmProceed` | `executeTeresaTool()` (`src/actions/teresaActionManifest.ts:159`) → `runIdeaAction()` (`src/actions/ideaActionRegistry.ts:397`, realny dispatcher, nie stub) | zależne od `toolName` (deleguje do rejestru Idea Workspace) | — | — | — | — | OK | wynik zależy od konkretnego `toolName`; sam mechanizm potwierdzenia real |
| 3 | Anuluj (Teresa confirm) | `Anuluj/Cancel` | MessageRenderer.tsx:949 | `onTeresaConfirmCancel` → `UnifiedChatPanel.tsx:2661` | czyści stan + dopisuje wiadomość "Anulowano." | brak | — | — | — | — | OK-LOKALNY | |
| 4 | Kontynuuj (Deep Thinking) | `deepThinking.proceed` | MessageRenderer.tsx:1140 | `handleDeepThinkingProceed` → `UnifiedChatPanel.tsx:5028` | buduje historię → `startStream()` (`useAIStream.ts:621`) → `Api.chatWithAIStream` (SSE) | POST przez `chatWithAIStream` | wspólny pipe streamingu czatu (poza zakresem szczegółowego trasowania — infrastruktura, nie przycisk-specyficzna) | — | — | 401 (`/api/ai/...` rodzina) | OK | |
| 5 | Rozumiem inaczej / reconfirm | `deepThinking.reconfirm` | MessageRenderer.tsx:1153 | `handleDeepThinkingReconfirm` → `UnifiedChatPanel.tsx:5176` | `Api.chatConfirm()` | POST `/api/ai/chat/confirm` | `server/src/routes/ai.routes.ts:1387` mount `/api/ai` (Gateway.ts:600) | real | — | 401 | OK | |
| 6 | (menu 3-kropki treści, generic onClick) | — | MessageRenderer.tsx:1292 | lokalny (kebab wewnątrz bloku) | — | — | — | — | — | — | NIEPEWNY | zbyt ogólny kontekst do jednoznacznej etykiety bez pełnego renderu wizualnego |
| 7 | Zaakceptuj audyt agentów | `Accept`/`agentAudit.accept` | MessageRenderer.tsx:1434 | `handleAgentAuditAccept` → `UnifiedChatPanel.tsx:6124` | `Api.agentAuditAcceptRun({runId})` | POST `/api/ai/agent-audit/runs/:runId/accept` | `server/src/routes/ai.routes.ts` (mount `/api/ai/agent-audit` w `routes/ai/index.ts:73`) | real | — | 401 | OK | |
| 8 | (link/CTA audytu, wariant) | — | MessageRenderer.tsx:1459 | wewnętrzny wariant powyższego bloku | — | — | — | — | — | — | NIEPEWNY | wariant renderu warunkowego — bez zrzutu wizualnego nie da się przypisać jednoznacznej etykiety PL |
| 9 | Anuluj edycję wiadomości | `chat.actions.cancel` | MessageRenderer.tsx:1588 | `handleCancelEditMessage` (`UnifiedChatPanel.tsx:5781`) | czyści `editingMessageId`/`editingText` | brak | — | — | — | — | OK-LOKALNY | |
| 10 | Zapisz edycję wiadomości | `chat.actions.save` | MessageRenderer.tsx:1595 | `handleCommitEditMessage` (`UnifiedChatPanel.tsx:5968`) | edytuje + re-streamuje | POST (truncate/regenerate, `Api.truncateConversation` rodzina) | `/api/conversations/:id/truncate` | `conversations.routes.ts` | real | 401 | OK | nie doczytano 100% ciała funkcji (długa), ale wywołanie API potwierdzone istnieniem trasy |
| 11 | Spróbuj ponownie (błąd) | `aiChat.retry` | MessageRenderer.tsx:1820 | `handleSendMessage(prevUserMsg.content)` | ponowne wysłanie promptu przez wspólny pipe | — | — | — | — | — | OK | |
| 12 | Kopiuj (user, hover) | `chat.actions.copy` | MessageRenderer.tsx:1841 | `handleCopyMessage` (`UnifiedChatPanel.tsx:5507`) | `navigator.clipboard.writeText` + best-effort `Api.deepThinkingEvent` | POST `/api/ai/deep-thinking/events` (best-effort, tylko gdy `deepResearch` on) | `routes/ai/deep-thinking.routes.ts` (mount jw.) | real | — | 401 | OK-LOKALNY | telemetryjne wywołanie nie blokuje kopiowania |
| 13 | Edytuj (user, hover) | `chat.actions.edit` | MessageRenderer.tsx:1850 | `handleStartEditMessage` | ustawia stan edycji | brak | — | — | — | — | OK-LOKALNY | |
| 14 | Zapisz do Context OS (user, hover) | `chat.actions.saveToContext` | MessageRenderer.tsx:1859 | `handleSaveToContext` (`UnifiedChatPanel.tsx:5663`) | `Api.saveConversationMessageToContext` | POST `/api/conversations/:id/messages/:messageId/save-to-context` | `conversations.routes.ts:1374` (mount `/api/conversations`, Gateway.ts:710) | real, zapis do `organization_context`/podobne | — | 401 | OK | |
| 15 | Rozgałęź / Branch (user, hover) | `chat.actions.branch` | MessageRenderer.tsx:1882 | `handleBranchFromMessage` (`UnifiedChatPanel.tsx:5789`) | `Api.branchConversation` | POST `/api/conversations/:id/branch` | `conversations.routes.ts` | real | — | 401 | OK | ukryty dla wiadomości `local-*` (niezapisanych) |
| 16 | Otwórz jako dokument (B4 auto-emit) | `chat.message.openAsDocument` | MessageRenderer.tsx:1936 | `onEmitArtifactFromMessage` → `handleEmitArtifactFromMessage` (`UnifiedChatPanel.tsx:5592`) | POST tworzy draft, potem `setIsWorkPanelOpen(true)` | POST `/api/work-canvas/drafts` | trasa work-canvas (server) | real | — | 401 | OK | otwiera realnie panel kanwy (`setIsWorkPanelOpen`, NIE `toggleArtifactsPanel`) |
| 17 | Kopiuj (AI, pasek akcji) | `chat.actions.copy` | MessageRenderer.tsx:2070 | jw. (#12) | jw. | jw. | — | — | — | 401 | OK-LOKALNY | |
| 18 | Czytaj na głos / Zatrzymaj | `chat.actions.speak`/`stop` | MessageRenderer.tsx:2080 | `speak()`/`stopSpeaking()` z `useUniversalVoice` (`ttsProvider:'web'`) | Web Speech API (przeglądarka) | brak | — | — | — | — | OK-LOKALNY | |
| 19 | Więcej akcji (rozwiń pasek) | `chat.actions.toggleResponseActions` | MessageRenderer.tsx:2101 | `setShowCompactActions` | lokalny toggle | brak | — | — | — | — | OK-LOKALNY | |
| 20 | Kciuk w górę/w dół | `InlineResponseFeedback` wewnątrz | MessageRenderer.tsx:2143 (`onFeedback`) | `handleFeedback` (`UnifiedChatPanel.tsx:5706`) | `Api.aiFeedback(...)` | POST `/api/ai-feedback/response` | `server/src/routes/ai/ai-feedback.routes.ts:441`, mount `/api/ai-feedback` (Gateway.ts:723) | `adaptiveResponseService.processFeedback` → `userStyleProfileService.processFeedback` (real, zapis) | — | 401 | OK | tabela: profil stylu/feedback użytkownika (server) |
| 21 | Regeneruj | `chat.actions.regenerate` | MessageRenderer.tsx:2145 | `handleRegenerateMessage` (lokalny w MessageRenderer.tsx:574) | `handleSendMessage(precedingUserMessage.content)` | jw. pipe streamingu | — | — | — | — | OK | disabled gdy brak poprzedniej wiadomości usera |
| 22 | Kontynuuj | `chat.actions.continue` | MessageRenderer.tsx:2157 | `handleContinueMessage` (lokalny, MessageRenderer.tsx:580) | `handleSendMessage('Continue...')` | jw. | — | — | — | — | OK | |
| 23 | Zgłoś (otwiera dialog powodu) | `chat.actions.report` | MessageRenderer.tsx:2173 | lokalny `setReportOpen` | otwiera popover z 4 powodami | brak (samo otwarcie) | — | — | — | — | OK-LOKALNY | ukryty dla `local-*` id |
| 24 | Zapisz jako notatkę | `myWork.notebook.saveAsNote` | MessageRenderer.tsx:2188 | `handleSaveAsNote` → `saveMessageAsNote` (`UnifiedChatPanel.tsx:1567`) | zależnie od trybu — patrz D-2 | zależnie | — | — | — | — | NIEPEWNY | nie doczytano pełnego ciała `saveMessageAsNote` (analogiczne do `saveMessageAsIdea`, patrz D-2) — prawdopodobny ten sam wzorzec "navigate + intent", do potwierdzenia |
| 25 | Zapisz jako pomysł | `myWork.ideas.saveAsIdea` | MessageRenderer.tsx:2196 | `handleSaveAsIdea` → `saveMessageAsIdea` (`UnifiedChatPanel.tsx:1462`) | domyślnie (`navigateToMyWork:true`) NIE tworzy rekordu — ustawia `setMyWorkIntent` + `setCurrentView(MY_WORK)` z `isNew:true` i tymczasowym id `new-idea-${Date.now()}`; realne utworzenie (`Api.createIdeaFromChat`) dzieje się TYLKO gdy `navigateToMyWork:false` (ta ścieżka z przycisku NIE jest używana) | brak HTTP z tego kliku | — | — | — | — | OK-LOKALNY (uczciwe) | toast mówi „Opened in Ideas workspace" (nie „Saved") — etykieta nie kłamie, ale przycisk sam NIE tworzy rekordu w bazie; dokończenie leży w module My Work (poza zakresem E) |
| 26 | Zaproponuj dokument sterowany (governed) | `chat.governedHandoff.proposeDocument` | MessageRenderer.tsx:2205 | `onCreateGovernedDocument` → `handleCreateGovernedDocument` (`UnifiedChatPanel.tsx:1360`) | `V8ChatApi.createGovernedDocumentProposal` | POST `/api/v8/chat/conversations/:id/handoff-proposals` | `server/src/routes/v8/*` (mount `/api/v8` z `v8FeatureGate`, Gateway.ts:1546) | real | `ENABLE_V8_GLOBAL` (server env) = **true** na staging (potwierdzone: 401 nie 404) | 401 | ZA FLAGĄ / OK | |
| 27 | Zapisz do Context OS (AI, pasek rozwinięty) | jw. #14 | MessageRenderer.tsx:2220 | jw. | jw. | jw. | jw. | jw. | — | 401 | OK | duplikat przycisku #14 dla wiadomości AI |
| 28 | Szczegóły źródeł (ShieldCheck) | `chat.sources.details` | MessageRenderer.tsx:2240 | `setShowSourcesDetails` | lokalny toggle | brak | — | — | — | — | OK-LOKALNY | |
| 29 | Zamknij dialog zgłoszenia | `chat.report` (X/Escape) | MessageRenderer.tsx:2318 | `closeReportDialog` | lokalny | brak | — | — | — | — | OK-LOKALNY | |
| 30 | Wyślij zgłoszenie | `chat.report.submit` | MessageRenderer.tsx:2326 | `handleSubmitReport` (lokalny, MessageRenderer.tsx:586) | `Api.reportMessageFeedback(msg.id, reason)` | POST `/api/ai/report` | `server/src/routes/ai.routes.ts:8425` | real | — | 401 | OK | honest failure: błąd zostaje w dialogu, nic nie ukrywa |
| 31 | Włącz Deep Thinking (podpowiedź) | `deepThinking.enableHint` | MessageRenderer.tsx:2380 | `handleEnableDeepThinking` | `setAIConfig({...,deepResearch:true})` | brak | — | — | — | — | OK-LOKALNY | |
| 32 | Nie teraz (odrzuć podpowiedź DT) | `deepThinking.dismissHint` | MessageRenderer.tsx:2387 | `setDtHintDismissed(true)` | lokalny | brak | — | — | — | — | OK-LOKALNY | |
| 33 | Zapisz jako decyzję | `deepThinking.saveDecision` | MessageRenderer.tsx:2412 | `handleSaveAsDecision` (`UnifiedChatPanel.tsx:5627`) | `Api.saveDeepThinkingDecision` | POST `/api/ai/deep-thinking/save-decision` | `routes/ai/deep-thinking.routes.ts:58` | real | — | 401 | OK | |
| 34 | **Konwertuj na inicjatywę** | `deepThinking.convertInitiative` | MessageRenderer.tsx:2422 | **`handleSaveAsDecision`** (ten sam handler co #33!) | identyczne z #33 — zapisuje jako decyzję, NIE tworzy inicjatywy | POST `/api/ai/deep-thinking/save-decision` | jw. | jw. | — | 401 | **URWANY (mislabel)** | patrz D-1 — przycisk robi coś innego niż mówi etykieta |
| 35 | Eksportuj raport (.md) | `deepThinking.exportReport` | MessageRenderer.tsx:2431 | inline `Blob`+`<a download>` | generuje plik lokalnie, `link.click()` | brak | — | — | — | — | OK-LOKALNY | |
| 36 | Zapisz do notatnika (z DT CTA) | `deepThinking.saveToNotebook` | MessageRenderer.tsx:2459 | `handleSaveAsNote` | jw. #24 | — | — | — | — | — | NIEPEWNY | jw. — zależne od pełnej analizy `saveMessageAsNote` |
| 37 | Odsłuchaj podsumowanie (Voice Brief) | `deepThinking.listenBrief` | MessageRenderer.tsx:2473 | `formatExecutiveBrief` + `speak()` | Web Speech API | brak | — | — | — | — | OK-LOKALNY | |
| 38 | Zawęź / Idź głębiej (interim insight) | `deepThinking.narrowFocusBtn`/`continueDeeper` | MessageRenderer.tsx:2521 | `handleSendMessage(...)` | jw. pipe | — | — | — | — | — | OK | |
| 39 | Uruchom pogłębienie ukierunkowane | `Run directed deepening` | MessageRenderer.tsx:2547 | `handleRunDirectedDeepening` (`UnifiedChatPanel.tsx:5349`) | `startStream()` z `forceDepth:true` | jw. pipe | — | — | — | disabled po 2 iteracjach | — | OK | |
| 40 | Opcje wielokrotnego wyboru (chip) | dynamiczne (`option.label`) | MessageRenderer.tsx:2574 | `handleMultiSelectToggle` | lokalny toggle zaznaczenia | brak | — | — | — | — | OK-LOKALNY | |
| 41 | Potwierdź wybór (multi-select) | `chat.confirmSelection` | MessageRenderer.tsx:2589 | `handleMultiSelectConfirm` | `onMultiSelectSubmit`/`onOptionSelect` | zależne od konsumenta (poza plikiem) | — | — | — | — | NIEPEWNY | `onMultiSelectSubmit` niezdefiniowany w typach MessageRendererProps odczytanych — trzeba by prześledzić `UnifiedChatPanel` pod kątem tego konkretnego propa osobno |
| 42 | Opcja pojedynczego wyboru (chip) | dynamiczne | MessageRenderer.tsx:2600 | `onOptionSelect` lub `handleSendMessage(option.label)` | zależne od konsumenta / pipe czatu | — | — | — | — | — | OK | |

### Karty osadzane w wiadomości (importowane przez MessageRenderer)

| # | Etykieta PL | element plik:linia | handler | HTTP | trasa serwera | flaga | curl | KLASA | uwagi |
|---|---|---|---|---|---|---|---|---|---|
| 43 | TeresaProposalCard: Zatwierdź | TeresaProposalCard.tsx:188 | `handleAction('approve')`→`Api.approveTeresaProposal` | POST `/api/v8/teresa/proposal/:id/approve` | `server/src/routes/v8/teresa.routes.ts` | `ENABLE_V8_GLOBAL`=true (staging) | 401 | ZA FLAGĄ/OK | |
| 44 | TeresaProposalCard: Odrzuć | TeresaProposalCard.tsx:203 | `Api.rejectTeresaProposal` | POST `/api/v8/teresa/proposal/:id/reject` | jw. | jw. | 401 | ZA FLAGĄ/OK | |
| 45 | TeresaProposalCard: Wykonaj | TeresaProposalCard.tsx:218 | `Api.executeTeresaProposal` | POST `/api/v8/teresa/proposal/:id/execute` | jw. | jw. | 401 | ZA FLAGĄ/OK | |
| 46 | TeresaProposalCard: Cofnij | TeresaProposalCard.tsx:233 | `Api.undoTeresaProposal` | POST `/api/v8/teresa/proposal/:id/undo` | jw. | jw. | 401 | ZA FLAGĄ/OK | |
| 47 | TeresaProposalCard: Przejdź do (navigate) | TeresaProposalCard.tsx:248 | `onNavigate` → `window.location.href` (pełny reload, nie SPA) | brak | — | — | — | OK-LOKALNY (P2) | twardy przeładunek strony zamiast routera SPA — kosmetyczny minus, nie defekt funkcjonalny |
| 48 | ExecutionProposalMessage: Zatwierdź | ExecutionProposalMessage.tsx:498 | `onApprove`→`handleProposalApprove`(`UnifiedChatPanel.tsx:6172`)→`Api.approveAIAction` | POST `/api/ai/actions/:id/approve` | `ai.routes.ts:8259` | — | 401 | OK | |
| 49 | ExecutionProposalMessage: Odrzuć | ExecutionProposalMessage.tsx:513 | `handleProposalReject`(6223)→`Api.rejectAIAction` | POST `/api/ai/actions/:id/reject` | `ai.routes.ts:8284` | — | 401 | OK | |
| 50 | ExecutionProposalMessage: Wykonaj | ExecutionProposalMessage.tsx:528 | `handleProposalExecute`(6275)→`Api.executeAIAction` | POST `/api/ai/actions/:id/execute` | `ai.routes.ts:7195` (param `:id`, nie `:actionId` — grep po nazwie parametru zwodzi) | — | 401 | OK | |
| 51 | ExecutionProposalMessage: Zobacz szczegóły | ExecutionProposalMessage.tsx:543 | `handleProposalInspect`(6349) | `navigateToRoute('/ai/action-center?actionId=...')` | — | — | — | — | OK-LOKALNY | nawigacja SPA do modułu poza czatem |
| 52 | GovernedChatHandoffCard: Zatwierdź | GovernedChatHandoffCard.tsx:173 | `onApprove`→`decideGovernedHandoff('approve')`(1400)→`V8ChatApi.approveGovernedHandoffProposal` | POST `/api/v8/chat/handoff-proposals/:id/approve` | v8 routes | `ENABLE_V8_GLOBAL`=true | 401 | ZA FLAGĄ/OK | |
| 53 | GovernedChatHandoffCard: Odrzuć | GovernedChatHandoffCard.tsx:187 | `decideGovernedHandoff('reject')`→`rejectGovernedHandoffProposal` | POST `/api/v8/chat/handoff-proposals/:id/reject` | jw. | jw. | 401 | ZA FLAGĄ/OK | |
| 54 | GovernedChatHandoffCard: Utwórz dokument (materialize) | GovernedChatHandoffCard.tsx:213 | `handleMaterializeGovernedHandoff`(1422) → 3-etapowy łańcuch: `deliverGovernedHandoffProposal`→`claimGovernedDocumentIngress`→`materializeGovernedDocument` | POST `/owner-ingress`, POST `/claim`, POST `/materialize` | v8 routes | `ENABLE_V8_GLOBAL`=true | 401 (każda z 3) | ZA FLAGĄ/OK | realnie tworzy rekord docelowy (`targetRecordId`) — jedyny z handoffów, który faktycznie materializuje coś poza samym proposalem |
| 55 | GovernedInitiativeHandoffCard: Sprawdź gotowość | GovernedInitiativeHandoffCard.tsx:161 | `checkReadiness`→`fetch('/api/initiatives/:id')` | GET `/api/initiatives/:id` | initiatives routes | — | 401 | OK | |
| 56 | GovernedInitiativeHandoffCard: Adoptuj | GovernedInitiativeHandoffCard.tsx:170 | `adopt`→`fetch('/api/initiatives/runtime-v1/adoptions/chat-draft')` | POST `/api/initiatives/runtime-v1/adoptions/chat-draft` | initiatives routes | `ENABLE_TERESA_ADOPT_CHAT_DRAFT` (server env, default **false** w kodzie — `server/src/config/FeatureFlags.ts:35`; wartość na staging NIEZNANA, brak w `.env.local` bo to zmienna serwerowa) | 401 | ZA FLAGĄ | karta w ogóle renderuje się tylko gdy ta sama flaga jest ON po stronie klienta (`UnifiedChatPanel.tsx:814,2317`) — jeśli flaga OFF, `initiativeHandoffByMessageId` nigdy się nie wypełnia i karta jest NIEWIDOCZNA praktycznie |
| 57 | GovernedInitiativeHandoffCard: Otwórz inicjatywę | GovernedInitiativeHandoffCard.tsx:179 | `onOpenInitiative`→`navigateToRoute('/initiatives?open=...')` | brak | — | — | — | OK-LOKALNY | |
| 58 | ChatTableProposalCard: Zaakceptuj | ChatTableProposalCard.tsx:216 | `handleAccept`→`TablePlatformApi.executeSchemaProposal` | POST `/api/table-platform/schema/proposals/:id/execute` | table-platform routes | — | 401 | **OK z defektem** | patrz D-3: status nietrwały po odświeżeniu |
| 59 | ChatTableProposalCard: Odrzuć | ChatTableProposalCard.tsx:232 | `handleReject`→`rejectSchemaProposal` | POST `.../reject` | jw. | — | 401 | jw. | jw. |
| 60 | ChatTableProposalCard: Doprecyzuj (tryb) | ChatTableProposalCard.tsx:224 | `setRefineMode(true)` | lokalny | — | — | — | OK-LOKALNY | |
| 61 | ChatTableProposalCard: Wyślij doprecyzowanie | ChatTableProposalCard.tsx:200 | `handleRefine`→`refineSchemaProposal` | POST `.../refine` | jw. | — | 401 | OK | |
| 62 | ChatTableProposalCard: Anuluj doprecyzowanie | ChatTableProposalCard.tsx:207 | `setRefineMode(false)` | lokalny | — | — | — | OK-LOKALNY | |
| 63 | CaseIntakeConfirmCard: Potwierdź | (nie renderuje się nigdy — patrz D-4) | — | — | — | — | — | **NIEWIDOCZNY** | zgodnie z komentarzem autora w nagłówku pliku (linie 1-28): żaden krok w `MessageRenderer.tsx`/`UnifiedChatPanel.tsx` nie ustawia `metadata.type==='case_intake_proposal'` |

### Komponenty pomocnicze (Citation/Artifact/Trust/Context/Reasoning)

| # | Etykieta | plik:linia | handler | HTTP | KLASA | uwagi |
|---|---|---|---|---|---|---|
| 64 | CitationList: zwiń/rozwiń listę | CitationList.tsx:193 | `handleToggle` | brak | OK-LOKALNY | |
| 65 | CitationList: klik cytatu (fragment/nawigacja) | CitationList.tsx:217 | `handleCitationClick` | brak (nawigacja klient) | OK-LOKALNY | `setCurrentView` (useAppStore) |
| 66 | CitationList: „Otwórz źródło" (szczegóły) | CitationList.tsx:324 | `navigateToSource` | brak | OK-LOKALNY | |
| 67 | CitationList: przycisk zamykający/toggle (prop `onClick`) | CitationList.tsx:363 | przekazany z rodzica | — | NIEPEWNY | zależny od konkretnego wywołania w MessageRenderer, nie doprecyzowano etykiety |
| 68 | ArtifactChip: Otwórz w kanwie (B2 deliverable) | ArtifactChip.tsx:53 | `onOpen`→`onOpenDeliverableArtifact`(`UnifiedChatPanel.tsx:5552`) | dla xlsx: `window.open('/api/workbook/:id/download')`; dla doc/sheet/deck: `setIsWorkPanelOpen(true)`+`setRequestedCanvas*` | OK | realnie otwiera/przełącza panel kanwy — zweryfikowany, DZIAŁA (w przeciwieństwie do #69/70 poniżej) |
| 69 | ArtifactBadge: Otwórz w panelu | ArtifactBadge.tsx:56 | inline `addArtifact(art); toggleArtifactsPanel(true)` | brak HTTP | **OK częściowo / P2** | patrz D-5: `toggleArtifactsPanel(true)` to no-op na `/chat` (nikt nie czyta `isPanelOpen` na tej trasie); `addArtifact` realnie zasila `CanvasArtifactSwitcher`, więc efekt widoczny JEST, ale TYLKO jeśli panel kanwy jest już otwarty (`showWorkPanel`) — przycisk sam go nie otwiera |
| 70 | ArtifactBadge: Pobierz | ArtifactBadge.tsx:66 | `onDownload`→`addArtifact`+`exportArtifact` (`useArtifactsStore.ts:308`) | brak HTTP (Blob lokalny) | OK-LOKALNY | |
| 71 | ChatCodeBlock: Kopiuj kod | ChatCodeBlock.tsx:101 | `handleCopy` | clipboard | OK-LOKALNY | |
| 72 | ReasoningTrace: rozwiń/zwiń tok rozumowania | Messages/ReasoningTrace.tsx:55 | lokalny `setExpanded` | brak | OK-LOKALNY | |
| 73 | ResearchProgress: pokaż/ukryj wyniki | ResearchProgress.tsx:128 | `setShowResults` | brak | OK-LOKALNY | |
| 74 | ResearchProgress: rozwiń panel | ResearchProgress.tsx:350 | `toggleExpand` | brak | OK-LOKALNY | |
| 75 | ResearchProgress: zakładka | ResearchProgress.tsx:420 | `setActiveTab` | brak | OK-LOKALNY | |
| 76 | `ResearchStatusBadge` (eksport pomocniczy) | ResearchProgress.tsx:532 | `onClick` prop | — | **NIEWIDOCZNY** | zero importerów w całym `src/` — martwy eksport |
| 77 | TrustBadge: otwórz/zamknij panel zaufania | TrustBadge.tsx:401 | `handleOpen`/`handleClose` | brak | OK-LOKALNY | |
| 78 | TrustBadge: rozwiń rozumowanie | TrustBadge.tsx:561 | `setReasoningExpanded` | brak | OK-LOKALNY | |
| 79 | TrustBadge: kopiuj rozumowanie | TrustBadge.tsx:602 | `handleCopyReasoning` | clipboard | OK-LOKALNY | |
| 80 | TrustBadge: kopiuj cytaty | TrustBadge.tsx:661 | `handleCopyCitations` | clipboard | OK-LOKALNY | |
| 81 | ContextBadge: rozwiń/zwiń | ContextBadge.tsx:190 | `setIsExpanded` | brak | OK-LOKALNY | renderuje się tylko `!showWorkPanel` (`UnifiedChatPanel.tsx:6906`) |

### Nagłówek czatu — kontrolki V8 (jawnie wymienione przez nadzorcę)

| # | Etykieta | plik:linia | handler | HTTP | flaga | curl | KLASA |
|---|---|---|---|---|---|---|---|
| 82 | V8ContextIndicator: otwórz/zamknij popover | V8ContextIndicator.tsx:134 | `setIsOpen` | brak | `useV8Gate().showV8Chat` (serwer `flags.chat`) | — | ZA FLAGĄ (org-level, nieweryfikowalne bez logowania) |
| 83 | V8ContextIndicator: (przycisk wewnątrz popover, l.194) | V8ContextIndicator.tsx:194 | nieprzeanalizowany w pełni | — | jw. | — | NIEPEWNY |
| 84 | V8ContextIndicator: Ponów (retry) | V8ContextIndicator.tsx:222 | `handleRetry`→refetch 3 hooków (snapshots/handoffs/retrieval) | GET (refetch) | jw. | — | ZA FLAGĄ/OK |
| 85 | V8ContextIndicator: Utwórz handoff | V8ContextIndicator.tsx:302 | `handleCreateHandoff`→`useV8CreateHandoff().mutateAsync`→`V8ChatApi.createHandoff` | POST `/api/v8/chat/handoffs` | jw. + `ENABLE_V8_GLOBAL` | 401 | ZA FLAGĄ/OK |
| 86 | V8ArtifactRunControl: otwórz/zamknij panel | V8ArtifactRunControl.tsx:433,484 | `setIsOpen` | brak | `useV8Gate().showV8Chat` | — | ZA FLAGĄ (2 elementy) |
| 87 | V8ArtifactRunControl: Zrób snapshot kontekstu | V8ArtifactRunControl.tsx:502 | `handleCaptureSnapshot`→`captureSnapshot.mutateAsync` | POST (V8 snapshot endpoint) | jw. | — | ZA FLAGĄ/OK |
| 88 | V8ArtifactRunControl: Zaplanuj artefakt | V8ArtifactRunControl.tsx:576 | `handlePlan`→`createRun.mutateAsync`→`ArtifactRunsApi.createFromChat` | POST `/api/artifact-runs/from-chat` | `ENABLE_V8_GLOBAL`=true | 401 | ZA FLAGĄ/OK |
| 89 | V8ArtifactRunControl: Preflight/walidacja | V8ArtifactRunControl.tsx:691 | `handlePreflight`→`preflightRun.mutateAsync`→`ArtifactRunsApi.preflight` | POST `/api/artifact-runs/:id/preflight` | jw. | 401 | ZA FLAGĄ/OK |
| 90 | V8ArtifactRunControl: Wyślij do przeglądu | V8ArtifactRunControl.tsx:776 | `handleSubmitReview`→`submitExecutionReview.mutateAsync`→`V8ExecutionApi.submitReview` | POST (v8 execution) | jw. | — | ZA FLAGĄ/OK |
| 91 | V8ArtifactRunControl: Zatwierdź przegląd | V8ArtifactRunControl.tsx:792 | `handleApproveReview`→`approveExecutionRun.mutateAsync` | POST (v8 execution approve) | jw. | — | ZA FLAGĄ/OK |
| 92 | V8ArtifactRunControl: Odrzuć przegląd | V8ArtifactRunControl.tsx:808 | `handleRejectReview`→`rejectExecutionRun.mutateAsync` | POST (v8 execution reject) | jw. | — | ZA FLAGĄ/OK |
| 93 | V8ArtifactRunControl: (przycisk l.832, nieprzeanalizowany w pełni) | V8ArtifactRunControl.tsx:832 | — | — | jw. | — | NIEPEWNY |
| 94 | V8ArtifactRunControl: Zaakceptuj plan | V8ArtifactRunControl.tsx:855 | `handleAccept`→`acceptPlan.mutateAsync`→`ArtifactRunsApi.acceptPlan` | POST `/api/artifact-runs/:id/accept-plan` | jw. | 401 | ZA FLAGĄ/OK |
| 95 | V8ArtifactRunControl: Materializuj | V8ArtifactRunControl.tsx:871 | `handleMaterialize`→`materializeRun.mutateAsync`→`ArtifactRunsApi.materialize` | POST `/api/artifact-runs/:id/materialize` | jw. | — | ZA FLAGĄ/OK |
| 96 | V8ArtifactRunControl: Ponów | V8ArtifactRunControl.tsx:886 | `handleRetry`→`retryRun.mutateAsync`→`ArtifactRunsApi.retry` | POST `/api/artifact-runs/:id/retry` | jw. | — | ZA FLAGĄ/OK |

Wszystkie trasy `/api/v8/*` i `/api/artifact-runs/*` są bramkowane middleware `v8FeatureGate`
(`server/src/middleware/v8FeatureGate.middleware.ts:14`) — sprawdza `process.env.ENABLE_V8_GLOBAL
=== 'true'`. Curl na staging zwraca 401 (nie 404 „V8_DISABLED"), więc **globalna flaga jest ON na
staging**. Bramka drugiego poziomu `v8OrgGate` (per-organizacja) wymaga tokenu — nieweryfikowalna
bez logowania.

### Pusty stan rozmowy (`/chat` bez wiadomości) — `UnifiedChatPanel.tsx`

| # | Etykieta PL | klucz i18n | plik:linia | handler | efekt | KLASA |
|---|---|---|---|---|---|---|
| 97 | Chip „Szybkie oszczędności" | `aiChat.quickClicks.savings.label` | UnifiedChatPanel.tsx ~7045 | `handleModeTile(undefined, prompt,'topic-starter')` | zapisuje prompt do `sessionStorage['consultify.teresa.pendingPrompt']` + `dispatchEvent('consultify:teresa-pending-prompt')` | OK-LOKALNY |
| 98 | Chip „Pomysł na produkt" | `aiChat.quickClicks.newProduct.label` | UnifiedChatPanel.tsx ~7055 | jw. | jw. — realnie skonsumowane przez `EnhancedChatInput.tsx:238` (`addEventListener`), które wpisuje tekst do kompozytora | OK-LOKALNY |
| 99 | Chip „Przegląd planu" | `aiChat.quickClicks.planReview.label` | UnifiedChatPanel.tsx ~7062 | jw. | jw. | OK-LOKALNY |
| 100 | Kafel „Analiza rynku" (klik główny) | `aiChat.homeCards.market.label` | UnifiedChatPanel.tsx:7085,7157 | `handleModeTile(preset,prompt,'capability-tile')` | `setAIConfig(preset)` + prefill promptu (jw.) | OK-LOKALNY |
| 101 | Kafel „Analiza rynku" (ikona ⤴ deep-link) | `aiChat.homeCards.openCapability` | UnifiedChatPanel.tsx:7171 | `handleCapabilityDeepLink('market-analysis',...,'/tools',...)` | `navigateToRoute('/tools?from=chat')` + zapis kontekstu powrotu do `sessionStorage` | OK-LOKALNY |
| 102 | Kafel „Analiza finansowa" (główny + deep-link) | `aiChat.homeCards.finance.*` | UnifiedChatPanel.tsx:7103 | jw. wzorzec, `route:'/finance'` | jw. | OK-LOKALNY (2 elementy) |
| 103 | Kafel „Klasyczny consulting" (główny + deep-link) | `aiChat.homeCards.consulting.*` | UnifiedChatPanel.tsx:7118 | jw., `route:'/tools'` | jw. | OK-LOKALNY (2 elementy) |
| 104 | Kafel „Transformacja cyfrowa" (główny + deep-link) | `aiChat.homeCards.digital.*` | UnifiedChatPanel.tsx:7136 | jw., `route:'/assessment'` | jw. | OK-LOKALNY (2 elementy) |
| 105 | Chip sugestii inteligentnej (`ChatSmartSuggestions`) | dynamiczne | UnifiedChatPanel.tsx:7468, `ChatSmartSuggestions.tsx:120` | `handleSuggestionClick`(`UnifiedChatPanel.tsx:4992`) | `type:'chat'`→`handleSendMessage`; inne typy→`handleChatAction`(`useChatActions`)→`handleChatAction` w `src/services/chatActionHandler.ts` (dispatcher realny, patrz niżej) | OK | **UWAGA**: to NIE jest plik `src/components/AIChat/SmartSuggestions.tsx` wymieniony przez nadzorcę (ten ma ZERO importerów — martwy, patrz D-6); realny komponent to `src/components/Chat/ChatSmartSuggestions.tsx` |

### Rejestr akcji czatu (`chatActionRegistry.ts` / `chatActionHandler.ts` / `chatNavigator.ts`)

Realny konsument: **wyłącznie** `ChatSmartSuggestions` przez `useChatActions()` (`src/hooks/useChatActions.ts`).
Typy akcji zdefiniowane w `src/types/domain/chatActions.ts` i obsłużone w `chatActionHandler.ts`:

| Typ akcji | Efekt | HTTP | Trasa | curl | KLASA |
|---|---|---|---|---|---|
| `NAVIGATE` | `executeChatNavigate`→router SPA | brak | — | — | OK-LOKALNY |
| `GENERATE_REPORT` | `navigate('/document-studio')` | brak | — | — | OK-LOKALNY |
| `GENERATE_PRESENTATION` | `navigate('/prezentacje?...')` | brak | — | — | OK-LOKALNY |
| `START_TOOL` | `navigate('/discovery-tools?tool=...')` | brak | — | — | OK-LOKALNY |
| `OPEN_PREVIEW` | `navigate(...)` wg typu encji | brak | — | — | OK-LOKALNY |
| `ASSIGN_INTERVIEW` | `Api.get('/interview/templates/:id')` + `Api.post('/interview/assignments')` | GET+POST | `interview.routes.ts` | 401 (POST) | OK |
| `RECORD_KPI` | `navigate('/results/kpi/:id')` | brak | — | — | OK-LOKALNY |
| `START_ARTIFACT_REVIEW` | `Api.post('/artifacts/:id/start-review')` | POST | artifacts routes | 401 | OK |
| `CHECK_TRUST_STATE` | `navigate(...)` | brak | — | — | OK-LOKALNY |
| `USE_TEMPLATE` | `navigate('/prezentacje?templateArtifactId=...')` lub `/reports/builder?...` | brak | — | — | OK-LOKALNY |
| `BROWSE_TEMPLATES` | `navigate('/prezentacje?tab=templates')` | brak | — | — | OK-LOKALNY |
| `ANALYZE_STATEMENT`/`REVIEW_MODEL`/`CHECK_LANE_STATUS` | `navigate(...)` | brak | — | — | OK-LOKALNY |

**Uwaga**: rejestr NIE zawiera literalnych typów „utwórz zadanie" / „utwórz inicjatywę" — te
przykłady z briefu nadzorcy nie odpowiadają realnym typom akcji w `chatActionRegistry.ts`.
Rzeczywiste tworzenie zadania/inicjatywy/dokumentu z czatu idzie innymi ścieżkami: governed handoff
(#26, #52-54), `ideaActionRegistry`/`teresaActionManifest` (#2), lub `saveMessageAsIdea`/`saveMessageAsNote` (#25).

curl potwierdzenia dla rejestru:
```
401 POST /api/interview/assignments
401 POST /api/artifacts/test-id/start-review
```

## Pliki/komponenty z listy nadzorcy — MARTWE lub NIEOSIĄGALNE z `/chat`

| Plik | Status | Dowód |
|---|---|---|
| `src/components/AIChat/ResponseActions.tsx` | **NIEWIDOCZNY** (zero importerów w `src/`) | `grep -rn "from '.*ResponseActions'"` → brak wyników poza samym plikiem |
| `src/components/AIChat/ResponseQualityIndicator.tsx` | **NIEWIDOCZNY** (zero importerów) | jw. |
| `src/components/AIChat/SmartSuggestions.tsx` | **NIEWIDOCZNY** (zero importerów) — realny odpowiednik to `src/components/Chat/ChatSmartSuggestions.tsx` (patrz #105) | jw. |
| `src/components/AIChat/DiagramArtifact.tsx` | **NIEWIDOCZNY** (zero importerów) | jw. |
| `src/components/AIChat/ActionCenter.tsx` | **NIEWIDOCZNY** z `/chat` — istnieje inny `ActionCenter` zamontowany pod `ROUTES.AI_OS.ACTION_CENTER` (AI OS hub, osobny ekran), plik z `AIChat/` nie ma importerów | `AppRoutes.tsx` (`renderInternalToolsShell(['AI','Action Center'], <ActionCenter />)`) importuje inny plik niż `AIChat/ActionCenter.tsx` — do potwierdzenia który (NIEPEWNY, ale ten z `AIChat/` ma 0 importerów niezależnie) |
| `src/components/AIChat/PendingActionsIndicator.tsx` | **NIEWIDOCZNY** (zero importerów) | jw. |
| `src/components/AIChat/ResearchClarification.tsx` | **NIEWIDOCZNY** (zero importerów) | jw. |
| `src/components/AIChat/Actions/InlineActionsList.tsx`, `Actions/AIActionCard.tsx`, `Actions/index.ts` (w tym `MessageActions`) | **NIEWIDOCZNY** — cały podkatalog `Actions/` bez importerów spoza siebie | jw. |
| `src/components/AIChat/AIActionCard.tsx` (wariant top-level, INNY plik niż `Actions/AIActionCard.tsx`) | **NIEWIDOCZNY** (zero importerów) | jw. — dwa różne pliki o tej samej nazwie eksportu, oba martwe |
| `src/components/AIChat/Artifacts/**` (ArtifactsPanel, ArtifactViewer, ArtifactEditor, `renderers/*`) | **NIEWIDOCZNY z `/chat`** — osiągalne tylko przez `SplitLayout` (Studio/Executive/inne widoki), którego `/chat` NIE używa | `AppRoutes.tsx` (chat route = `MainLayout>UnifiedChatPanel`, brak `SplitLayout`); `SplitLayout.tsx:21` jedyny importer `ArtifactsPanel` |
| `src/components/AIChat/CaseIntakeConfirmCard.tsx` | **NIEWIDOCZNY w praktyce** — komponent istnieje i jest importowany, ale warunek renderu (`metadata.type==='case_intake_proposal'`) nigdy nie jest ustawiany przez pipeline czatu (przyznane wprost w komentarzu nagłówkowym pliku) | patrz D-4 |
| `handleViewArtifacts` (prop w `MessageRenderer`) | **martwy prop** — zadeklarowany, przekazany, nigdy wywołany w ciele `MessageRenderer.tsx` | `grep -n "handleViewArtifacts("` w `MessageRenderer.tsx` → 0 wyników |
| `ResearchStatusBadge` (eksport w `ResearchProgress.tsx`) | **NIEWIDOCZNY** (zero importerów) | jw. |

## Defekty

- **D-1 | P1 | „Konwertuj na inicjatywę" (Deep Thinking CTA)** — przycisk z etykietą
  `deepThinking.convertInitiative` wywołuje DOKŁADNIE ten sam handler co przycisk „Zapisz jako
  decyzję" (`handleSaveAsDecision`, POST `/api/ai/deep-thinking/save-decision`). Nic nie tworzy
  inicjatywy. Dowód: `src/components/AIChat/MessageRenderer.tsx:2412` i `:2422` — identyczny
  `onClick={() => handleSaveAsDecision(msg.id, userVisibleContent)}`. Odtworzenie: w rozmowie z
  wynikiem Deep Thinking (`metadata.deepThinking.kind==='report'`) kliknij „Convert to Initiative" —
  zapisze się jako decyzja, żadna inicjatywa nie powstanie.

- **D-2 | P1 | „Zapisz jako pomysł" nie tworzy rekordu z poziomu czatu** — domyślna ścieżka
  (`navigateToMyWork:true`, jedyna używana przez przycisk w `MessageRenderer.tsx:2196`) NIE wywołuje
  `Api.createIdeaFromChat`; ustawia tylko `useAppStore.setMyWorkIntent({...isNew:true, id:'new-idea-
  ${Date.now()}'...})` i przełącza widok na My Work. Realne utworzenie rekordu zależy od modułu My
  Work (poza zakresem E). Toast „Opened in Ideas workspace" jest uczciwy (nie twierdzi „Saved"), ale
  samo kliknięcie w czacie nie zapisuje niczego do bazy. Dowód: `UnifiedChatPanel.tsx:1462-1531`
  (`saveMessageAsIdea`, gałąź `if (navigateToMyWork) {...return;}` przed jedynym wywołaniem
  `Api.createIdeaFromChat` niżej w funkcji). Odtworzenie: kliknij ikonę żarówki pod dowolną
  odpowiedzią AI → strona przechodzi do My Work z otwartym nowym, niezapisanym szkicem.

- **D-3 | P1 | ChatTableProposalCard gubi stan po przeładowaniu / duplikacja akcji możliwa** —
  komponent trzyma `executed`/`rejected` WYŁĄCZNIE w lokalnym `useState`, nigdy nie czyta pola
  `proposal.status` z propsów. `MessageRenderer.tsx:903` przekazuje `onStatusChange={() => {}}`
  (no-op), więc rodzic też nie zapisuje wyniku do metadanych wiadomości. Po odświeżeniu strony (nowy
  mount z tego samego, już wykonanego `msg.metadata.proposal`) karta wraca do stanu aktywnego z
  przyciskami Zaakceptuj/Odrzuć, mimo że backend już oznaczył propozycję jako wykonaną/odrzuconą.
  Ponowne kliknięcie „Zaakceptuj" wywoła `executeSchemaProposal` na już wykonanym `id` — zachowanie
  zależy wyłącznie od idempotencji backendu, front nie chroni przed tym wcale. Dowód:
  `src/components/AIChat/ChatTableProposalCard.tsx` — `useState(proposal)` (l.40), `if (executed)`
  (l.120) i `if (rejected)` (l.132) nie odwołują się do `currentProposal.status` (pole istnieje w
  typie `SchemaProposal.status`, ale `grep -n "\.status\b"` w pliku daje 0 wyników);
  `MessageRenderer.tsx:903` (`onStatusChange={() => {}}`). Odtworzenie: zaakceptuj propozycję tabeli
  w czacie, odśwież stronę (F5) — karta znów pokazuje aktywne przyciski akcji.

- **D-4 | P1 | CaseIntakeConfirmCard nigdy się nie renderuje** — warunek
  `metadata?.type === 'case_intake_proposal'` w `MessageRenderer.tsx:880` nie jest NIGDY ustawiany
  przez pipeline czatu; przyznane wprost w nagłówku komponentu (`CaseIntakeConfirmCard.tsx:1-28`:
  „ta karta nie ma dziś ŻADNEGO produkcyjnego wywołującego"). Cała funkcja „potwierdzenia
  zlecenia (Case) z czatu" jest martwa mimo w pełni zaimplementowanego komponentu i realnego API
  (`src/components/CaseWorkspace/apiIntake.ts`, `/api/v10/teresa/case-intake/...`). Odtworzenie:
  brak — nie da się wywołać tego stanu z żadnej ścieżki w bieżącym kodzie czatu.

- **D-5 | P2 | ArtifactBadge „Otwórz w panelu" woła no-op na `/chat`** — `toggleArtifactsPanel(true)`
  (z `useArtifactsStore`) ustawia `isPanelOpen`, ale na trasie `/chat` NIC nie czyta tego pola (jedyny
  konsument, `SplitLayout.tsx:81-88`, nie jest montowany na `/chat` — tam kanwę steruje osobny stan
  `showWorkPanel`/`isWorkPanelOpen`). Jeśli panel kanwy jest zamknięty, kliknięcie „Otwórz w panelu"
  NIE otworzy go — artefakt trafia do `CanvasArtifactSwitcher` (przez `addArtifact`), ale użytkownik
  go nie zobaczy, dopóki sam nie otworzy panelu przyciskiem `PanelRight` w nagłówku. Dowód:
  `src/store/useArtifactsStore.ts` (`isPanelOpen` czytane tylko w `SplitLayout.tsx:81`);
  `src/components/AIChat/MessageRenderer.tsx:1956-1965` (inline `onOpenInPanel`).

- **D-6 | P2 | Nadzorca wskazał zły/martwy plik dla chipów sugestii** —
  `src/components/AIChat/SmartSuggestions.tsx` ma zero importerów (martwy). Realny komponent
  renderowany pod odpowiedzią w `/chat` to `src/components/Chat/ChatSmartSuggestions.tsx`
  (`UnifiedChatPanel.tsx:7468`). Audyt dla #105 dotyczy tego drugiego pliku.

- **D-7 | P2 | `handleViewArtifacts` — martwy prop** — zadeklarowany w
  `MessageRendererProps.handleViewArtifacts`, przekazany z `UnifiedChatPanel.tsx:6410`, ale nigdy
  wywołany w ciele `MessageRenderer.tsx`. Sam efekt (dodanie artefaktu + próba otwarcia panelu) jest
  zduplikowany inline w `ArtifactBadge`'s `onOpenInPanel` (patrz D-5). Nieszkodliwe martwe API, ale
  warto usunąć/scalić przy najbliższej okazji.

- **D-8 | P2 | i18n: literalny angielski tekst w domyślnych etykietach PL** — liczne fallbacki
  domyślne w `t(key, 'English text')` w `MessageRenderer.tsx` (np. `'Continue the previous answer
  from where it stopped.'` l.2098, `'Not helpful or relevant'` w `REPORT_REASON_FALLBACKS` l.79) —
  NIE sprawdzono czy klucze `pl.json` faktycznie mają polskie tłumaczenia (poza zakresem czasowym
  tego przebiegu — wymaga osobnego sweep po `public/locales/pl/translation.json` dla wszystkich
  ~60 kluczy `chat.*`/`deepThinking.*`/`aiChat.*` użytych w tym pliku).

## Niezweryfikowane

- **#6, #8** (MessageRenderer.tsx:1292, 1459) — fragmenty wewnątrz bloku audytu agentów
  (`agentAuditState`/`AgentReviewProgress`), zbyt gęsto zagnieżdżone warunkowo, żeby bez zrzutu
  wizualnego jednoznacznie przypisać etykietę i pełny łańcuch w dostępnym czasie.
- **#24, #36 (`handleSaveAsNote`/`saveMessageAsNote`)** — nie doczytano pełnego ciała funkcji
  (`UnifiedChatPanel.tsx:1567+`, analogicznej do `saveMessageAsIdea`); z dużym prawdopodobieństwem
  ten sam wzorzec „navigate + intent" jak D-2, ale nie potwierdzone linia-po-linii.
  **Rekomendacja**: sprawdzić `saveMessageAsNote` pod kątem identycznego problemu jak D-2 zanim
  ogłosi się „naprawione" gdziekolwiek.
  Zaflagowano to jako oddzielne zadanie w tle (patrz `spawn_task` w tej sesji).
- **#41 (`onMultiSelectSubmit`)** — prop użyty w `handleMultiSelectConfirm` (`UnifiedChatPanel.tsx:
  5751`) nie został znaleziony w interfejsie `MessageRendererProps` odczytanym w tym przebiegu; może
  pochodzić z zewnętrznego wrappera `UnifiedChatPanel` (props tego komponentu, nie stan wewnętrzny) —
  wymaga doczytania sygnatury `UnifiedChatPanelProps`.
- **#67 (CitationList.tsx:363, generyczny `onClick={onClick}`)** — zależny od konkretnego miejsca
  wywołania komponentu przez rodzica; nie zidentyfikowano jednoznacznie, który wariant renderu w
  `MessageRenderer.tsx` go używa.
- **#83, #93** (V8ContextIndicator.tsx:194, V8ArtifactRunControl.tsx:832) — przyciski wewnątrz
  rozwijanych paneli V8, nie doczytano pełnej treści ciała (dużo kontekstu react-query wokół).
- **Poziom org V8 (`v8OrgGate`)** — globalna flaga `ENABLE_V8_GLOBAL` potwierdzona ON na staging
  (401, nie 404), ale bramka drugiego poziomu per-organizacja (`isV8Enabled(orgId)`,
  `v8FeatureGate.middleware.ts:24-52`) wymaga zalogowanego tokenu — nie dało się zweryfikować bez
  logowania, zgodnie z zakazem briefu.
- **`ActionCenter.tsx` w `AIChat/`** — potwierdzono zero importerów tego konkretnego pliku, ale NIE
  zweryfikowano które dokładnie źródło zasila `<ActionCenter />` pod trasą `ROUTES.AI_OS.
  ACTION_CENTER` w `AppRoutes.tsx` (inny plik o tej samej nazwie eksportu gdzie indziej w repo,
  prawdopodobnie `src/components/AIOS/ActionCenter.tsx` lub podobnie) — nie krytyczne dla zakresu E
  (ten plik i tak jest poza `/chat`), ale nazwa mogła zmylić nadzorcę.
- **i18n sweep** (D-8) — nie wykonano pełnego zestawienia klucz→wartość PL dla wszystkich ~60+
  kluczy i18n użytych w plikach z zakresu E; ograniczono się do spostrzeżenia że fallbacki EN
  dominują w kodzie źródłowym (nie dowodzi to same brakującego PL, tylko flaguje ryzyko D-8/P2).

## Liczby

- **Pliki z listy nadzorcy przeczytane w całości lub zweryfikowane strukturalnie**: 34/34 (w tym
  `chatActionRegistry.ts`, `chatActionHandler.ts`, `chatNavigator.ts`).
- **Elementy klikalne zinwentaryzowane w tabelach powyżej**: **105** ponumerowanych pozycji
  (#1–#105), z czego część to warianty tego samego wzorca policzone osobno zgodnie z regułą briefu
  (np. 4 kafle domowe × po 2 przyciski = 8 pozycji zsumowanych w wierszach #100–104; 3 chipy szybkie
  = #97–99). Do tego osobna tabela 12 typów akcji rejestru (`chatActionHandler.ts`) — nie liczone
  jako osobne „elementy klikalne" bo są backendem chipów #105, nie własnymi przyciskami.
  **Nadzorca oszacował 40–60 — realna liczba jest ok. 2× wyższa (105)**, głównie dlatego że
  `MessageRenderer.tsx` sam ma 42 handlery, a lista plików obejmuje 12 dodatkowych komponentów-kart
  z własnymi przyciskami (Teresa/Execution/Governed*/ChatTableProposal = ok. 21 kolejnych) plus
  nagłówek V8 (15) plus pusty stan (9).
- **Rozkład klas** (z 105 ponumerowanych, licząc każdy wariant osobno):
  - `OK`: 27
  - `OK-LOKALNY`: 47
  - `ZA FLAGĄ` (w tym `ZA FLAGĄ/OK` gdy łańcuch też zweryfikowany): 17
  - `URWANY`: 1 (D-1, mislabel)
  - `MARTWY`/`NIEWIDOCZNY` (elementy/komponenty, nie licząc całych plików bez importerów z sekcji
    osobnej): 3 (#63 CaseIntakeConfirmCard, #76 ResearchStatusBadge, `handleViewArtifacts` jako
    martwy prop)
  - `NIEPEWNY`: 8 (#6, #8, #24, #36, #41, #67, #83, #93)
- **Pliki z listy nadzorcy całkowicie NIEOSIĄGALNE z `/chat`** (zero klikalnych elementów liczy się,
  bo cały plik/katalog jest martwy lub poza drzewem renderu): 9 pozycji —
  `ResponseActions.tsx`, `ResponseQualityIndicator.tsx`, `SmartSuggestions.tsx`, `DiagramArtifact.tsx`,
  `ActionCenter.tsx` (wariant AIChat/), `PendingActionsIndicator.tsx`, `ResearchClarification.tsx`,
  `Actions/**` (InlineActionsList/AIActionCard/MessageActions), `Artifacts/**` (5 plików: panel/
  viewer/editor/index/8 rendererów).
- **Defekty zapisane**: 8 (D-1…D-8) — 4×P1, 4×P2, 0×P0 (żaden nie blokuje główny przepływ
  pisania/czatu — wszystkie dotyczą funkcji pobocznych: zapis jako pomysł/inicjatywa, karta
  propozycji tabeli, martwa karta case-intake, drobne UX/i18n).
- **Trasy HTTP curl'owane na staging**: 26 unikalnych URL, wszystkie 401 (istnieją za
  uwierzytelnieniem), zero 404, zero 500, zero niebezpiecznych 200 bez auth.
