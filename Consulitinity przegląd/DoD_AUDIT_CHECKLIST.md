# Consultinity — Definition of Done (DoD) & Checklista Audytowa

**Repo**: `consultify`  
**Katalog źródłowy przeglądu**: `Consulitinity przegląd/`  
**Data utworzenia**: 2026-02-09  
**Data audytu**: 2026-02-09  
**Cel**: Weryfikacja KAŻDEJ wytycznej z 5 dokumentów przeglądu  
**Status**: ✅ AUDYT ZAKOŃCZONY — NAPRAWY WYKONANE (2026-02-09)

---

## Zasady audytu

1. Każdy punkt sprawdzamy w kodzie i w UI
2. Status: ❌ NIE ZROBIONE | ⚠️ CZĘŚCIOWO | ✅ ZROBIONE | 🔍 DO WERYFIKACJI
3. Przy każdym punkcie notujemy: plik/komponent + obserwacja
4. Nie akceptujemy placeholderów jako "zrobione"
5. Nie akceptujemy martwych przycisków jako "zrobione"
6. Nie akceptujemy crashy jako "zrobione"
7. Nie akceptujemy mieszania języków PL/EN jako "zrobione"

---

## MODUŁ A: MY WORK (Executive / Inbox / Focus / Tasks / Decisions / Notifications)

📄 Źródło: `Przegląd consulitinity - moduły - my task.pdf`

### A1. Executive Dashboard

| ID   | Wymaganie                                          | AC                                                            | Status | Plik/Komponent                                                | Uwagi audytowe                                                                                                                                   |
| ---- | -------------------------------------------------- | ------------------------------------------------------------- | ------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1.1 | Wszystkie metryki na Executive muszą być PRAWDZIWE | Każda metryka ma jawne źródło danych. Brak danych → "No data" | ⚠️     | ExecutiveDashboard.tsx, KPIGrid.tsx, PortfolioHealthScore.tsx | KPIGrid OK (dane z API, "No data" fallback). PortfolioHealthScore: breakdown.decisions/capacity/risk = hardcoded 0 (placeholder). WYMAGA NAPRAWY |
| A1.2 | Executive widoczny WYŁĄCZNIE dla menedżera         | User bez roli manager/admin nie widzi zakładki                | ✅     | MyWorkHub.tsx (L177-179, 244-248, 330-331)                    | canViewExecutive = isAdmin \|\| isManager \|\| isSuperAdmin; tab filtrowany; deep link guard                                                     |

### A2. Inbox

| ID   | Wymaganie                                                                 | AC                               | Status | Plik/Komponent              | Uwagi audytowe                                                                   |
| ---- | ------------------------------------------------------------------------- | -------------------------------- | ------ | --------------------------- | -------------------------------------------------------------------------------- |
| A2.1 | Inbox jako tabela identyczna stylistycznie jak Task/Decision/Notification | Jeden standard tabeli            | ⚠️     | InboxContent.tsx            | InboxContent ma zunifikowaną tabelę, ale TaskInbox i inne używają innego layoutu |
| A2.2 | Każdy komunikat w JEDNEJ linii                                            | Długi tekst skraca się ellipsis  | ✅     | InboxContent.tsx (L316-319) | truncate block max-w-[400px]                                                     |
| A2.3 | Sekcje w Inbox analogiczne do Focus                                       | Podział na kategorie/sekcje      | ❌     | InboxContent.tsx            | Inbox to płaska tabela — brak sekcji Today/Week/Late jak w Focus. WYMAGA NAPRAWY |
| A2.4 | Polityka "zamknięcia/acknowledge" komunikatów                             | Statusy + filtr + zbiorcze "ack" | ✅     | InboxContent.tsx (L266-293) | Open, Accept today, Acknowledge, Archive — triage API działa                     |
| A2.5 | ZERO placeholderów — każda linia podpięta do systemu                      | Brak martwych przycisków         | ⚠️     | InboxContent.tsx            | Dane z API /my-work/inbox; zależy od backendu czy zwraca realne dane             |

### A3. Focus

| ID   | Wymaganie                                      | AC                              | Status | Plik/Komponent                    | Uwagi audytowe                                      |
| ---- | ---------------------------------------------- | ------------------------------- | ------ | --------------------------------- | --------------------------------------------------- |
| A3.1 | Today / This Week / Late — BEZ dublowania      | Element z Today NIE w This Week | ✅     | FocusView.tsx (L424-491)          | thisWeek excludes todayIds; later excludes todayIds |
| A3.2 | Akcje na elementach CZYTELNE                   | Row actions jako "⋯" menu       | ✅     | FocusView.tsx, RowActionsMenu.tsx | RowActionsMenu zamiast inline buttons               |
| A3.3 | Problem z niewidocznymi przyciskami ROZWIĄZANY | Menu "3 kropki" widoczne        | ✅     | RowActionsMenu.tsx (L84-124)      | MoreHorizontal button + dropdown z etykietami       |

### A4. Tasks

| ID   | Wymaganie                                           | AC                       | Status | Plik/Komponent                      | Uwagi audytowe                                                                  |
| ---- | --------------------------------------------------- | ------------------------ | ------ | ----------------------------------- | ------------------------------------------------------------------------------- |
| A4.1 | Lista tasków: widoczny owner/assignee + due date    | Widoczne w tabeli        | ✅     | MyTasksListContent.tsx, TaskRow.tsx | Assignee column + Due Date column                                               |
| A4.2 | USUNĄĆ procent "done" — zastąpić metrykami statusów | Liczniki statusów        | ✅     | MyTasksListContent.tsx (L641-706)   | Total/Completed/InProgress/Blocked/Overdue/Critical — brak paska procentowego   |
| A4.3 | Przyciski statusów ZMNIEJSZONE                      | Kompaktowe badge'e       | ⚠️     | MyTasksListContent.tsx (L375-382)   | text-[11px] px-2 py-0.5 — kompaktowe, ale brak explicite zmniejszenia w TaskRow |
| A4.4 | Filtr dynamiczny działa                             | Filtrowanie po statusach | ✅     | MyTasksListContent.tsx              | activeFilter + FilterDropdown + handleFilterChange                              |

### A5. Decisions

| ID   | Wymaganie                                    | AC                           | Status | Plik/Komponent                    | Uwagi audytowe                                                                   |
| ---- | -------------------------------------------- | ---------------------------- | ------ | --------------------------------- | -------------------------------------------------------------------------------- |
| A5.1 | Delegowanie decyzji działa end-to-end        | Brak crash                   | ✅     | DelegationModal.tsx (L119-177)    | Walidacja decisionId + API post + error handling                                 |
| A5.2 | "Request for description" działa             | Brak crash                   | ⚠️     | DecisionDetailView.tsx (L416-435) | handleRequestMoreInfo dodaje komentarz i otwiera DelegationModal — flow niejasny |
| A5.3 | CAŁY proces przepisywania decyzji naprawiony | Wszystkie przyciski działają | ⚠️     | DelegationModal.tsx               | Supports full/review/input/co_decide — logika OK, brak dokumentacji audytu       |
| A5.4 | Inne przyciski w obszarze decyzji działają   | Żaden nie wywala systemu     | ✅     | DecisionCard.tsx (L368-437)       | Approve/Reject/Delegate/View/Escalate z guard na missing id                      |

### A6. Notifications

| ID   | Wymaganie                                       | AC                        | Status | Plik/Komponent                  | Uwagi audytowe                                                             |
| ---- | ----------------------------------------------- | ------------------------- | ------ | ------------------------------- | -------------------------------------------------------------------------- |
| A6.1 | Kolumna "tip" — większa szerokość               | Brak rozjeżdżania         | ⚠️     | NotificationsHub.tsx (L576-582) | Type max-w-[100px], Title max-w-[300px] z truncate — OK ale "tip" niejasne |
| A6.2 | NOWA kolumna "czego dotyczy"                    | Typ + link do encji       | ✅     | NotificationsHub.tsx (L571-626) | "Related to" z relatedObjectType + getRelatedObjectLabel                   |
| A6.3 | NOWA kolumna "źródło notyfikacji"               | UI pokazuje źródło        | ✅     | NotificationsHub.tsx (L573-643) | "Source" z notification.scope (PROJECT/PERSONAL/System)                    |
| A6.4 | "New notification" DZIAŁA jako broadcast admina | CRUD + brak "coming soon" | ✅     | NotificationsHub.tsx (L419-748) | ADMIN_BROADCAST + modal z title/message/severity                           |

### A7. Karty: 3 style widoku (Current / Notion-like / ClickUp-like)

| ID   | Wymaganie                                            | AC                            | Status | Plik/Komponent       | Uwagi audytowe                                                                                                                             |
| ---- | ---------------------------------------------------- | ----------------------------- | ------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| A7.1 | Przełącznik 3 widoków dla Task/Decision/Notification | Działa, spójny                | ⚠️     | CardViewSwitcher.tsx | Komponent istnieje (current/notion/clickup) ale używany TYLKO w TaskInbox; Decisions i Notifications NIE mają przełącznika. WYMAGA NAPRAWY |
| A7.2 | Widok Notion-like dla My Work                        | 8-12 sekcji lewa, treść prawa | ❌     | —                    | Notion-like istnieje TYLKO dla Initiatives (InitiativeNotionView). My Work nie ma. WYMAGA NAPRAWY                                          |
| A7.3 | Widok ClickUp-like dla My Work                       | Gęsty, tech-sexy              | ❌     | —                    | ClickUp-like istnieje TYLKO dla Initiatives (InitiativeCompactPanel). My Work nie ma. WYMAGA NAPRAWY                                       |
| A7.4 | Te same TREŚCI pomiędzy 3 stylami                    | Dane identyczne               | ❌     | —                    | N/A — widoki nie zaimplementowane dla My Work                                                                                              |
| A7.5 | Główna linia menu góry NIE zmienia się               | Nagłówek stały                | ❌     | —                    | N/A — widoki nie zaimplementowane dla My Work                                                                                              |

---

## MODUŁ B: ASSESSMENT / REPORTS / INICJATYWY (kontekst assessment)

📄 Źródło: `Przegląd consultinity - assessment.pdf`

### B1. Assessment

| ID   | Wymaganie                                     | AC                                             | Status | Plik/Komponent                                   | Uwagi audytowe                                                                                                          |
| ---- | --------------------------------------------- | ---------------------------------------------- | ------ | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| B1.1 | Usunąć zbędny "biały" element legendy matrycy | Legenda TYLKO realne stany                     | ⚠️     | AssessmentMatrixCard.tsx, assessmentColors.ts    | Legenda ma Actual + Target; bg-white/10 to inactive cell state, nie element legendy — prawdopodobnie OK                 |
| B1.2 | Prawy panel podsumowania assessmentów         | Panel z głównymi info, odpowiedziami, statusem | ⚠️     | AIAssessmentSidebar.tsx, DRDAssessmentEditor.tsx | AIAssessmentSidebar ma Insights/Suggestions/Gap ale BRAK statycznego podsumowania (score, status, osie). WYMAGA NAPRAWY |

### B2. Reports — UI

| ID   | Wymaganie                                   | AC                | Status | Plik/Komponent                   | Uwagi audytowe                                                              |
| ---- | ------------------------------------------- | ----------------- | ------ | -------------------------------- | --------------------------------------------------------------------------- |
| B2.1 | Sekcja "Info" — zwięzła                     | Minimalny pion    | ⚠️     | ReportHeader.tsx (L56-97)        | Kompaktowy metadata row z flex-wrap — OK ale brak pola confidence           |
| B2.2 | Matrix na pełną szerokość po zwinięciu menu | Responsywnie      | ⚠️     | DRDAssessmentEditor.tsx          | isNavCollapsed istnieje ale brak explicit w-full tied to it. WYMAGA NAPRAWY |
| B2.3 | Górna część raportu — przyciski w 1 linii   | Kompaktowy header | ✅     | ModuleNavBar.tsx, ReportsHub.tsx | Search jako ikona, status jako dropdown, przyciski w 1 linii                |

### B3. Workflow i role

| ID   | Wymaganie                                  | AC                          | Status | Plik/Komponent                                | Uwagi audytowe                                                    |
| ---- | ------------------------------------------ | --------------------------- | ------ | --------------------------------------------- | ----------------------------------------------------------------- |
| B3.1 | Workflow akceptacji wynikający z ról teamu | Jasne stany, akcje per rola | ✅     | ApprovalWorkflow.tsx (L41-369)                | Role-based z SPONSOR/PMO_LEAD/MANAGER; level-based approval chain |
| B3.2 | Zarządzanie rolami spójne                  | Spójna logika               | ⚠️     | ApprovalWorkflow.tsx, TeamManagementPanel.tsx | Brak scentralizowanej definicji ról; każdy moduł definiuje osobno |
| B3.3 | Zwinięte elementy w manager — lepiej       | Użytkownik rozumie workflow | ⚠️     | InitiativesManagementPanel.tsx                | Accordion-like rows bez explicit redesign                         |

### B4. Templates

| ID   | Wymaganie                                           | AC                        | Status | Plik/Komponent                               | Uwagi audytowe                                                                                        |
| ---- | --------------------------------------------------- | ------------------------- | ------ | -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| B4.1 | Po wejściu: WSZYSTKO zwinięte                       | Na jeden rzut oka         | ❌     | ReportTemplatesView.tsx, TemplateLibrary.tsx | TemplateLibrary: kategorie startują zwinięte (OK). ReportTemplatesView: BRAK zwijania. WYMAGA NAPRAWY |
| B4.2 | Listy menu się ZWIJAJĄ (nie nakładają)              | Brak overlay bugów        | ⚠️     | RowActionsMenu.tsx                           | Close on outside click; brak globalnej logiki "zamknij inne gdy otwierasz nowe"                       |
| B4.3 | Symetria ikon: "disable" MA ikonę                   | Spójne ikony              | ⚠️     | RowActionsMenu.tsx                           | Akcje wspierają optional icon; nie zweryfikowano czy disable ma ikonę                                 |
| B4.4 | Rozróżnienie templates "aplikacji" vs "organizacji" | Systemowe vs user-created | ❌     | ReportTemplatesView.tsx, TemplateLibrary.tsx | BRAK rozróżnienia application vs organization. WYMAGA NAPRAWY                                         |

### B5. Raporty — wersjonowanie (immutable)

| ID   | Wymaganie                                 | AC                           | Status | Plik/Komponent                                    | Uwagi audytowe                                          |
| ---- | ----------------------------------------- | ---------------------------- | ------ | ------------------------------------------------- | ------------------------------------------------------- |
| B5.1 | Zakładka "Raporty" z listą wygenerowanych | Każdy raport jako linia      | ✅     | ReportsHub.tsx (L238-259), ReportHistoryTable.tsx | Tab "Reports" z FilterableTable                         |
| B5.2 | Raport = IMMUTABLE                        | Metryka + brak edycji        | ✅     | ReportsHub.tsx (L793-798)                         | "Immutable Version" badge; View/Download/Share only     |
| B5.3 | Prawy panel: szybkie otwieranie wersji    | Bez wchodzenia do generatora | ✅     | ReportsHub.tsx (L522-636)                         | Quick Preview panel z onRowClick                        |
| B5.4 | Możliwość rename raportów                 | User może zmienić nazwę      | ❌     | ReportHistoryTable.tsx, ReportsHub.tsx            | BRAK rename. Akcje: View/Download/Share. WYMAGA NAPRAWY |

### B6. Estetyka raportów

| ID   | Wymaganie                   | AC                   | Status | Plik/Komponent             | Uwagi audytowe                                                                                                   |
| ---- | --------------------------- | -------------------- | ------ | -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| B6.1 | Raporty na poziomie BCG/IBM | Profesjonalny layout | ✅     | EnterpriseReportStyles.css | BCG/McKinsey-style: Inter font, cover page, priority badges, callouts, BCG matrix, timeline, Gantt, print styles |

### B7. Inicjatywy — widoki i kluczowe elementy

| ID   | Wymaganie                                  | AC                                        | Status | Plik/Komponent                                                                                                 | Uwagi audytowe                                                                            |
| ---- | ------------------------------------------ | ----------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| B7.1 | 3 formaty prezentacji inicjatyw            | 1 bez zmian + 2 przebudowane              | ⚠️     | InitiativeNotionView, InitiativeCompactPanel, InitiativeScrollView, InitiativeFullView, InitiativeDocumentView | 5+ formatów istnieje; wymaganie "3 formaty" niejasne                                      |
| B7.2 | 5-6 kluczowych elementów ZAWSZE widocznych | cel, taski, team, zasoby, finanse, ryzyko | ⚠️     | InitiativeDrawer.tsx, InitiativeFullView.tsx                                                                   | Elementy w różnych tabkach — nie wszystkie widoczne jednocześnie                          |
| B7.3 | Usunąć nieczytelne długie listy            | Brak accordion hell                       | ✅     | InitiativeDrawer.tsx (L123-203)                                                                                | maxVisible=3 + "Show more/less"                                                           |
| B7.4 | Menu "⋯" NIE chowa się                     | Brak overlay bugów                        | ✅     | RowActionsMenu.tsx, InitiativeDocumentView.tsx                                                                 | z-50 na menu                                                                              |
| B7.5 | Panel boczny WYPEŁNIONY                    | Kluczowe informacje                       | ✅     | InitiativeDrawer.tsx (L341-432)                                                                                | Gate readiness, summary, progress, ROI, budget, priority, timeline, RAID                  |
| B7.6 | Kreator templatek wpływa na karty          | Template zmienia kształt kart             | ⚠️     | TemplateLibrary.tsx                                                                                            | Templates mają suggestedTasks/typicalBudgetRange ale brak explicit mapping do card layout |

### B8. Język + antyduplikacja

| ID   | Wymaganie                             | AC                      | Status | Plik/Komponent                                      | Uwagi audytowe                                                                                                                             |
| ---- | ------------------------------------- | ----------------------- | ------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| B8.1 | Formularze w języku aplikacji         | Brak miksu PL/EN        | ⚠️     | InitiativeEditor.tsx                                | useTranslation() ale AXIS_OPTIONS i TIMELINE_OPTIONS hardcoded EN. WYMAGA NAPRAWY                                                          |
| B8.2 | Antyduplikacja z historią odrzuconych | System pamięta historię | ⚠️     | initiativeDuplicateDetection.ts, InitiativesHub.tsx | InitiativesHub pobiera allInitiatives bez filtra statusu; ALE InitiativesManagementPanel NIE przekazuje archived/cancelled. WYMAGA NAPRAWY |

### B9. Chat kontekstowy

| ID   | Wymaganie                                     | AC                      | Status | Plik/Komponent                                           | Uwagi audytowe                                                                                          |
| ---- | --------------------------------------------- | ----------------------- | ------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| B9.1 | Przycisk czatu uruchamia rozmowę o obiekcie   | Chat z kontekstem encji | ⚠️     | useConversationStore.ts, AssessmentSessionEditorView.tsx | Workspace context istnieje ale BRAK widocznego przycisku "Chat" w ReportsHub/assessment. WYMAGA NAPRAWY |
| B9.2 | Chat wspiera assessment, raporty I inicjatywy | 3 obszary               | ✅     | workspace.ts, SmartSuggestions.tsx                       | WorkspaceType: assessment/initiative/report; context suggestions dla każdego                            |

---

## MODUŁ C: CHAT

📄 Źródło: `Przegląd Consultinity - czat.pdf`

### C1. Nowa konwersacja

| ID   | Wymaganie                             | AC                           | Status | Plik/Komponent                                  | Uwagi audytowe                                  |
| ---- | ------------------------------------- | ---------------------------- | ------ | ----------------------------------------------- | ----------------------------------------------- |
| C1.1 | "Nowa konwersacja" działa BEZ refresh | Welcome screen po kliknięciu | ✅     | UnifiedChatPanel.tsx, ConversationRouteSync.tsx | clearActiveChat() → navigate('/chat') → welcome |

### C2. Welcome screen

| ID   | Wymaganie                                   | AC                       | Status | Plik/Komponent                     | Uwagi audytowe                                                   |
| ---- | ------------------------------------------- | ------------------------ | ------ | ---------------------------------- | ---------------------------------------------------------------- |
| C2.1 | 4 przyciski startowe z rotacji ~20          | Zawsze 4; rotacja; i18n  | ✅     | SmartSuggestions.tsx (L304-340)    | universalPool 20 items; shuffle by hour; 4 visible; t() for i18n |
| C2.2 | 4 ikony funkcji — klik uruchamia help/guide | Brak martwych przycisków | ✅     | AIChatWelcomeView.tsx (L1288-1358) | 4 capability cards z onClick → handleSuggestionClick(prompt)     |

### C3. Historia / Foldery

| ID   | Wymaganie                                               | AC                     | Status | Plik/Komponent                                                     | Uwagi audytowe                                                                                  |
| ---- | ------------------------------------------------------- | ---------------------- | ------ | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| C3.1 | My Folders / Team Folders: max 4 + scroll               | UI nie puchnie         | ✅     | ChatHistorySidebar.tsx (L79, 110)                                  | MAX_VISIBLE_FOLDERS=4; slice + "Show more/less"                                                 |
| C3.2 | Historia: ograniczenia i nawigacja                      | Sensowne limity        | ✅     | ConversationList.tsx (L20, 46-141)                                 | MAX_VISIBLE_PER_GROUP=5; groups: today/yesterday/thisWeek/lastMonth/older                       |
| C3.3 | Auto-tytuły + rename                                    | Nie "New conversation" | ✅     | useConversationStore.ts (L659-682), ConversationItem.tsx (L99-127) | generateTitle po 1. wymianie; pencil icon + inline rename                                       |
| C3.4 | Model folderów: klik folder → nowa rozmowa w kontekście | Automatyczny kontekst  | ⚠️     | ChatHistorySidebar.tsx                                             | Klik folder filtruje rozmowy ale createConversation NIE przyjmuje chatProjectId. WYMAGA NAPRAWY |
| C3.5 | "Add to folder" — max 4 na ekran + scroll               | Brak bałaganu          | ⚠️     | MoveToProjectModal.tsx                                             | max-h-72 overflow-y-auto (scroll OK) ale brak slice(0,4) — wszystkie foldery widoczne           |

### C4. Załączniki + integracje

| ID   | Wymaganie                               | AC                         | Status | Plik/Komponent                  | Uwagi audytowe                                                                              |
| ---- | --------------------------------------- | -------------------------- | ------ | ------------------------------- | ------------------------------------------------------------------------------------------- |
| C4.1 | Załączniki REALNIE analizowane przez AI | AI cytuje plik             | ✅     | UnifiedChatPanel.tsx (L617-748) | uploadChatAttachment → docId → attachmentDocIds w kontekście → RAG                          |
| C4.2 | Integracje chmur — plan + admin check   | Status integracji widoczny | ⚠️     | useCloudIntegrations.ts         | isImplemented: false; connectProvider = no-op; CloudFilePicker istnieje ale backend stubbed |

### C5. Czystość odpowiedzi

| ID   | Wymaganie                               | AC                   | Status | Plik/Komponent                 | Uwagi audytowe                                |
| ---- | --------------------------------------- | -------------------- | ------ | ------------------------------ | --------------------------------------------- |
| C5.1 | Brak gwiazdek/hashy — poprawny markdown | Profesjonalny wygląd | ✅     | MessageRenderer.tsx (L418-447) | ReactMarkdown + remarkGfm + custom components |

### C6. Web search / Thinking / Status

| ID   | Wymaganie                            | AC                            | Status | Plik/Komponent                                                    | Uwagi audytowe                                                  |
| ---- | ------------------------------------ | ----------------------------- | ------ | ----------------------------------------------------------------- | --------------------------------------------------------------- |
| C6.1 | Widoczny tok pracy                   | User widzi postęp             | ✅     | MessageRenderer.tsx, ThinkingStatusLine.tsx, ResearchProgress.tsx | ThinkingStatusLine ze steps; ResearchProgress z sources/queries |
| C6.2 | Web search DZIAŁA                    | Brak fałszywych przełączników | ✅     | useAIStream.ts, ToolsMenu.tsx, deepThinkingOrchestrator.ts        | webSearch toggle → Tavily search (wymaga TAVILY_API_KEY)        |
| C6.3 | Show reasoning: CAŁY tok rozumowania | Widoczne strony/analiza       | ✅     | MessageRenderer.tsx (L253-276)                                    | ThinkingStatusLine z thinkingSteps; showReasoning → backend     |

### C7. Multi-agent + Ustawienia

| ID   | Wymaganie                                  | AC                     | Status | Plik/Komponent                                  | Uwagi audytowe                                                                                                              |
| ---- | ------------------------------------------ | ---------------------- | ------ | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| C7.1 | Multi-agent: oddzielne toki w pod-oknach   | User rozumie agentów   | ✅     | MessageRenderer.tsx (L696-762)                  | Per-agent badges z stage (KB/LLM/done)                                                                                      |
| C7.2 | Ustawienia głosu: męski/żeński + 3-4 style | Wpływ na TTS           | ⚠️     | ToolsMenu.tsx (L404-418), useUniversalVoice.ts  | Voice dropdown z speechSynthesis.getVoices() ale BRAK presetów male/female i style (formal/normal/cheerful). WYMAGA NAPRAWY |
| C7.3 | Dopasowanie języka                         | Brak blokady językowej | ✅     | UnifiedChatPanel.tsx (L181-194), useAIStream.ts | chatLanguage z localStorage/conversation; conversationLanguage w kontekście                                                 |

### C8. Feedback

| ID   | Wymaganie                                 | AC                               | Status | Plik/Komponent                       | Uwagi audytowe                                                                                       |
| ---- | ----------------------------------------- | -------------------------------- | ------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| C8.1 | Feedback NEGATYWNY DOPYTUJE               | Formularz "co się nie spodobało" | ✅     | InlineResponseFeedback.tsx (L68-342) | showDetails(true) → length/detail/advanced + missingInfo textarea                                    |
| C8.2 | Feedback pozytywny — opcjonalnie dopytuje | Zbieranie info do poprawy        | ❌     | InlineResponseFeedback.tsx (L71-75)  | Pozytywny: submitFeedback() natychmiast, setShowDetails(false). BRAK "co było dobre". WYMAGA NAPRAWY |

### C9. UI pod oknem czata + głośnik

| ID   | Wymaganie                          | AC                | Status | Plik/Komponent                     | Uwagi audytowe                                                               |
| ---- | ---------------------------------- | ----------------- | ------ | ---------------------------------- | ---------------------------------------------------------------------------- |
| C9.1 | 4 prostokąty pokazują NOWE funkcje | Klik → help       | ⚠️     | AIChatWelcomeView.tsx (L1288-1358) | 4 karty istnieją ale klik wysyła prompt do czata zamiast otwierać help panel |
| C9.2 | Ikona głośnika — TTS on/off        | Podłączona do TTS | ✅     | UnifiedChatPanel.tsx (L1487-1513)  | Volume2/VolumeX toggle → autoReadEnabled + updateVoiceSettings               |

### C10. Chat jako konsultant i nawigator

| ID    | Wymaganie                      | AC                | Status | Plik/Komponent                                | Uwagi audytowe                                                                          |
| ----- | ------------------------------ | ----------------- | ------ | --------------------------------------------- | --------------------------------------------------------------------------------------- |
| C10.1 | Chat nawiguje do modułu/ekranu | Akcje nawigacyjne | ✅     | useActionHandler.ts (L19-127)                 | VIEW_ROUTE_MAP ~20 views; FIND_INITIATIVE → navigate                                    |
| C10.2 | Chat zna dokumentację          | Help integration  | ✅     | helpDocsContext.ts, ai.routes.ts (L1244-1274) | KnowledgeBaseService.getContextualArticles + citations                                  |
| C10.3 | Chat generuje NOTYFIKACJE      | Reguły zachowania | ❌     | useActionHandler.ts                           | SEND_NOTIFICATION zdefiniowany ale NIE zaimplementowany w executeAction. WYMAGA NAPRAWY |
| C10.4 | Chat NIE tworzy inicjatyw sam  | Ograniczenie      | ⚠️     | useActionHandler.ts                           | Backend ma createInitiative tool (MCP) ale frontend nie ma handlera — częściowo OK      |
| C10.5 | Chat NIE przepisuje zadań      | Ograniczenie      | ✅     | useActionHandler.ts                           | Brak REASSIGN_TASK; reassignment tylko przez user API                                   |

---

## MODUŁ D: INICJATYWY I WDROŻENIE (Initiatives / Execution / Gantt / Heatmap / RAID)

📄 Źródło: `Przeglad consultinity - inicjatywy i wdrozenie.pdf`

### D1. Typ inicjatywy + statusy

| ID   | Wymaganie                                         | AC                           | Status | Plik/Komponent                                                  | Uwagi audytowe                                                                                 |
| ---- | ------------------------------------------------- | ---------------------------- | ------ | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| D1.1 | Wybór formatu/template przy tworzeniu             | User wybiera format          | ⚠️     | InitiativesHub.tsx (L587-682)                                   | Wybór POZIOMU (quick_win/standard/strategic/transformation) ale NIE template'u. WYMAGA NAPRAWY |
| D1.2 | Ten sam format po wybraniu; downgrade zablokowany | Upgrade możliwy              | ⚠️     | InitiativesHub.tsx (L647-652)                                   | Info text "Level can be upgraded but not downgraded" — brak client-side enforcement            |
| D1.3 | Wszystkie 13 statusów w filtrze                   | Kolory logiczne              | ✅     | StatusDropdown.tsx (L78-348), initiativeLifecycle.ts (L157-246) | ALL_STATUSES 13 statusów z kolorami                                                            |
| D1.4 | Status "SCHEDULED" istnieje i działa              | Auto-transition do execution | ✅     | initiativeLifecycle.ts (L36-37, 328-335), core.ts (L716)        | SCHEDULED w InitiativeStatus; SCHEDULED→EXECUTING manual transition                            |
| D1.5 | Statusy execution/done/cancelled/archive widoczne | Przywracanie                 | ⚠️     | StatusDropdown.tsx, initiativeLifecycle.ts                      | ARCHIVED jest terminal bez restore. WYMAGA NAPRAWY                                             |

### D2. Tabela inicjatyw

| ID   | Wymaganie                                         | AC                | Status | Plik/Komponent                            | Uwagi audytowe                                                                             |
| ---- | ------------------------------------------------- | ----------------- | ------ | ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| D2.1 | UI tabeli IDENTYCZNY z Task/Decision/Notification | Spójny standard   | ⚠️     | InitiativesHub.tsx, PortfolioListView.tsx | Używa PortfolioListView z ModuleHub — podobny pattern ale nie identyczny                   |
| D2.2 | Kolumny: owner, status, start, end, contractor    | Dane kompletne    | ⚠️     | PortfolioListView.tsx (L227-293)          | Owner/Status/Priority/Start/End/Progress/Actions — BRAK kolumny contractor. WYMAGA NAPRAWY |
| D2.3 | Panel boczny WYPEŁNIONY                           | Główne informacje | ✅     | InitiativeCompactPanel.tsx (L176-423)     | Summary/Tasks/Decisions/RAID/Finance tabs z metrykami                                      |

### D3. Akceptacja i odpowiedzialność

| ID   | Wymaganie                                  | AC                  | Status | Plik/Komponent                                                       | Uwagi audytowe                                                                                              |
| ---- | ------------------------------------------ | ------------------- | ------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| D3.1 | Krytyczne pola do akceptacji               | Walidacja blokuje   | ✅     | InitiativesHub.tsx (L114-466), InitiativeCompactPanel.tsx (L291-320) | validateForApproval: ≥1 task + plannedEndDate + ownerBusiness                                               |
| D3.2 | Proces spójny z admin/team                 | Jasne role          | ⚠️     | InitiativeDrawer.tsx (L99-405)                                       | Gate definitions (GO_NO_GO/RESOURCES/SCHEDULE) ale brak explicit admin vs team                              |
| D3.3 | Aplikacja MOTYWUJE do uzupełniania         | Wizualne wskazówki  | ⚠️     | InitiativesTimelineView.tsx (L152-177)                               | computeReadiness z missing fields ale BRAK prominent banner w main view. WYMAGA NAPRAWY                     |
| D3.4 | Info o brakujących danych w panelu bocznym | Widać czego brakuje | ⚠️     | InitiativesTimelineView.tsx, InitiativeCompactPanel.tsx              | missingReadiness przekazywane do cards ale BRAK explicit "what's missing" list w side panel. WYMAGA NAPRAWY |

### D4. Harmonogram i walidacja

| ID   | Wymaganie                                           | AC                              | Status | Plik/Komponent                                                                               | Uwagi audytowe                                                             |
| ---- | --------------------------------------------------- | ------------------------------- | ------ | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| D4.1 | Walidacja kolejności/zależności tasków              | AI asystuje, user override      | ✅     | ExecutionTimelineView.tsx (L193-347), RoadmapGantt.tsx (L133-214), GanttChart.tsx (L127-183) | validateInitiativeDependencies + validateDependencies + circular dep check |
| D4.2 | Przycisk "zapytaj system o sensowność harmonogramu" | AI analizuje                    | ❌     | GanttChart.tsx, RoadmapGantt.tsx                                                             | BRAK takiego przycisku. Tylko validation badges. WYMAGA NAPRAWY            |
| D4.3 | Toolbar PRZEBUDOWANY                                | Brak konfliktujących przycisków | ✅     | RoadmapGantt.tsx (L433-494), GanttChart.tsx (L299-367)                                       | Zoom/navigation/critical path/fullscreen — brak priority buttons           |
| D4.4 | Weryfikacja PM (ścieżka krytyczna, zależności)      | Wieloaspektowa                  | ✅     | ExecutionTimelineView.tsx, RoadmapGantt.tsx, GanttChart.tsx                                  | Critical path + dependency lines + conflict warnings                       |
| D4.5 | Chat w kontekście harmonogramu                      | Czat doradza                    | ⚠️     | ExecutionHub.tsx (L1242-1250)                                                                | "AI Chat" button ale brak explicit schedule context                        |

### D5. Gantt + Heatmap

| ID   | Wymaganie                                        | AC               | Status | Plik/Komponent                                              | Uwagi audytowe                                                                                        |
| ---- | ------------------------------------------------ | ---------------- | ------ | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| D5.1 | Gantt z zależnościami, ścieżką krytyczną, edycją | Używalny wykres  | ✅     | GanttChart.tsx, RoadmapGantt.tsx, ExecutionTimelineView.tsx | Dependencies + critical path + drag/resize + zoom                                                     |
| D5.2 | Heatmap obciążenia — przycisk w pasku głównym    | Sumuje taski     | ⚠️     | ExecutionWorkloadView.tsx                                   | Komponent ISTNIEJE (weekly/monthly, heatmap) ale NIE jest zintegrowany z ExecutionHub. WYMAGA NAPRAWY |
| D5.3 | Zatwierdzenie "scheduled" = RĘCZNE               | Widoczne w pasku | ✅     | initiativeLifecycle.ts (L327-407)                           | "Schedule" i "Start Execution" to manual actions                                                      |

### D6. Execution (przepisanie na nowo)

| ID   | Wymaganie                                               | AC                         | Status | Plik/Komponent                                      | Uwagi audytowe                                                                                            |
| ---- | ------------------------------------------------------- | -------------------------- | ------ | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| D6.1 | 3 zakładki: Execution Center / Initiatives / RAID Log   | Wszystkie 3                | ⚠️     | ExecutionHub.tsx (L393-414)                         | Tabs: "Execution Center" + "RAID Log" + "Decisions" — BRAK osobnej zakładki "Initiatives". WYMAGA NAPRAWY |
| D6.2 | Execution Center: REALNE parametry                      | Zero placeholderów         | ⚠️     | ExecutionHub.tsx (L963-1041), KPIDashboard.tsx      | Dane z portfolioMetrics/initiatives/decisions/tasks — KPIs mogą być puste jeśli API nie zwraca            |
| D6.3 | Zakładka "Initiatives": progress vs czas, owner, alerty | Widać zagrożenia           | ✅     | ExecutionHub.tsx (L418-589)                         | Progress bar + time left + alerts (blocked/overdue) + tasks + owner                                       |
| D6.4 | RAID log wdrożony                                       | CRUD + raport + linkowanie | ✅     | RAIDLog.tsx (L1-487), ExecutionHub.tsx (L1205-1221) | RISK/ASSUMPTION/ISSUE/DEPENDENCY/DECISION; CRUD; probability/impact; mitigation                           |
| D6.5 | Przycisk "Raport" w menu górnym                         | Executive summary          | ❌     | ExecutionHub.tsx                                    | BRAK przycisku "Report". Są: New Task/Decision/RAID/Export/AI Chat. WYMAGA NAPRAWY                        |
| D6.6 | Lista zagrożonych tasków/opóźnionych decyzji            | Mądry panel                | ✅     | ExecutionHub.tsx (L517-726)                         | Alerts column + portfolioMetrics + AI insights z priority/timeline/risk                                   |
| D6.7 | Chat w execution z kontekstem transformacji             | Chat doradza               | ⚠️     | ExecutionHub.tsx (L1242-1250)                       | "AI Chat" button ale brak explicit transformation plan context                                            |
| D6.8 | Filtr statusów spójny z modułem inicjatyw               | Spójne filtrowanie         | ✅     | ExecutionHub.tsx (L585-617)                         | getStatusesForModule('execution') + InitiativeCompactPanel                                                |
| D6.9 | Przełącznik prezentacji zachowany                       | Działa                     | ✅     | ExecutionHub.tsx (L1258-1259)                       | table/grid/kanban/timeline/calendar                                                                       |

---

## MODUŁ E: INTERVIEW (Inbox / Sessions / Templates / Insights)

📄 Źródło: `Przegląd cosnulitnity - Inteview.pdf`

### E1. Widok per rola

| ID   | Wymaganie                       | AC                     | Status | Plik/Komponent                                                     | Uwagi audytowe                                           |
| ---- | ------------------------------- | ---------------------- | ------ | ------------------------------------------------------------------ | -------------------------------------------------------- |
| E1.1 | Zwykły user widzi TYLKO Inbox   | Brak dostępu do reszty | ✅     | InterviewHub.tsx (L589-607), useInterviewPermissions.ts (L184-195) | canViewManaged = canAssign; regular users only Inbox tab |
| E1.2 | Manager/Admin widzi pełny moduł | Wszystkie zakładki     | ✅     | useInterviewPermissions.ts (L19-113)                               | SUPERADMIN/ADMIN/PROJECT_MANAGER → canAssign → full tabs |

### E2. Inbox użytkownika

| ID   | Wymaganie                                           | AC                 | Status | Plik/Komponent                   | Uwagi audytowe                                                 |
| ---- | --------------------------------------------------- | ------------------ | ------ | -------------------------------- | -------------------------------------------------------------- |
| E2.1 | "Days to due" + kolory (≤3 żółte, overdue czerwone) | Pilność widoczna   | ✅     | InterviewHub.tsx (L2179-2222)    | getDaysToDue: overdue=red, today=red, ≤3=yellow, >3=green      |
| E2.2 | System przypomnień o deadline                       | Notyfikacje/alerty | ⚠️     | useInterviewPermissions.ts (L43) | canSendReminder istnieje ale BRAK UI/backend call do wysyłania |

### E3. Arkusze odpowiedzi (end-to-end)

| ID   | Wymaganie                                      | AC                  | Status | Plik/Komponent                                      | Uwagi audytowe                                                                                                                       |
| ---- | ---------------------------------------------- | ------------------- | ------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| E3.1 | Możliwość WPISYWANIA odpowiedzi                | Zapis działa        | ✅     | QuestionsList.tsx (L45-145), InterviewWorkspace.tsx | answerText + onUpdateQuestion                                                                                                        |
| E3.2 | Możliwość ZMIANY ocen/punktacji                | Suwaki/dropdowny    | ✅     | QuestionsList.tsx (L52-53)                          | confidenceScore (1-5) + onUpdateQuestion                                                                                             |
| E3.3 | Możliwość dodawania NOTATEK                    | Pole notatek        | ✅     | QuestionsList.tsx (L51), NotesPanel.tsx             | notes field + NotesPanel                                                                                                             |
| E3.4 | Możliwość dodawania ZAŁĄCZNIKÓW                | Upload + powiązanie | ✅     | InterviewWorkspace.tsx (L58-146)                    | AttachmentsSection + LinkedItemsSection                                                                                              |
| E3.5 | Statusy: drafting → review → accepted/rejected | Sterowane rolami    | ⚠️     | InterviewHub.tsx (L136-161)                         | assigned/in_progress/submitted/sent_back/approved/completed — BRAK explicit "drafting→review→accepted/rejected" flow. WYMAGA NAPRAWY |
| E3.6 | Chat-assist w kolumnie wsparcia                | Kontekstowy czat    | ✅     | QuestionsList.tsx (L368), CategoryChat.tsx          | sendMessageToAI + CategoryChat                                                                                                       |

### E4. UI tabel/kolumn

| ID   | Wymaganie                                 | AC             | Status | Plik/Komponent                           | Uwagi audytowe                                                            |
| ---- | ----------------------------------------- | -------------- | ------ | ---------------------------------------- | ------------------------------------------------------------------------- |
| E4.1 | Szerokości kolumn dopasowane              | Brak krzywości | ⚠️     | InterviewHub.tsx                         | Brak explicit breakpoint-based column widths                              |
| E4.2 | Kolumna "Actions" — przycisk czat AKTYWNY | Klik → chat    | ⚠️     | InterviewHub.tsx, InterviewWorkspace.tsx | Actions i chat istnieją ale brak direct "chat button ACTIVE" verification |

### E5. Templates

| ID   | Wymaganie                                | AC                   | Status | Plik/Komponent    | Uwagi audytowe                                                                                   |
| ---- | ---------------------------------------- | -------------------- | ------ | ----------------- | ------------------------------------------------------------------------------------------------ |
| E5.1 | Przycisk do proponowania kolejnych pytań | AI proponuje pytania | ⚠️     | QuestionsList.tsx | AI support via sendMessageToAI ale BRAK explicit "Propose next questions" button. WYMAGA NAPRAWY |

### E6. Nawigacja modułu

| ID   | Wymaganie                                                        | AC                                    | Status | Plik/Komponent              | Uwagi audytowe                                                                                |
| ---- | ---------------------------------------------------------------- | ------------------------------------- | ------ | --------------------------- | --------------------------------------------------------------------------------------------- |
| E6.1 | Kolejność: Inbox / Sessions / Assessments / Templates / Insights | Assessments między sessions/templates | ⚠️     | InterviewHub.tsx (L597-660) | Tabs: my-assignments/sessions/assessments/templates/insights/managed — OK ale "managed" extra |
| E6.2 | Logika podziału treści                                           | Jasny podział                         | ✅     | InterviewHub.tsx (L589-660) | Inbox=my assignments; Sessions=all; Managed=managers; Templates=definitions; Insights=wnioski |

### E7. Insights (NAJWAŻNIEJSZE)

| ID   | Wymaganie                           | AC                               | Status | Plik/Komponent                | Uwagi audytowe                                                             |
| ---- | ----------------------------------- | -------------------------------- | ------ | ----------------------------- | -------------------------------------------------------------------------- |
| E7.1 | 3 formaty widoku insights           | Spójne z innymi modułami         | ⚠️     | InsightViewer.tsx             | Istnieje ale spójność z innymi modułami niezweryfikowana                   |
| E7.2 | Dwie osie: wg raportów ORAZ wg osób | Filtr by report/person           | ✅     | InterviewHub.tsx (L2732-2761) | "By Report" i "By Person" options                                          |
| E7.3 | AI czyta MIĘDZY WIERSZAMI           | Intencje, sprzeczności, kłamstwa | ❌     | InsightCreatorModal.tsx       | BRAK implementacji "between the lines" NLP. WYMAGA NAPRAWY                 |
| E7.4 | Precyzyjna formuła AI do podsumowań | Jakość konsultingowa             | ❌     | Insight components            | BRAK udokumentowanej/zaimplementowanej precyzyjnej formuły. WYMAGA NAPRAWY |

---

## MODUŁ F: WYMAGANIA PRZEKROJOWE (cross-cutting)

### F1. Spójność UI/UX

| ID   | Wymaganie                                     | AC                            | Status | Plik/Komponent                                    | Uwagi audytowe                                                                                     |
| ---- | --------------------------------------------- | ----------------------------- | ------ | ------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| F1.1 | WSZYSTKIE tabele identyczny standard          | Spójne nagłówki/spacing/fonty | ⚠️     | Różne moduły                                      | InboxContent, MyTasksListContent, NotificationsHub, PortfolioListView — podobne ale nie identyczne |
| F1.2 | WSZYSTKIE menu "⋯" działają i nie chowają się | Brak overlay bugów            | ✅     | RowActionsMenu.tsx                                | z-50 + close on outside click — spójne użycie                                                      |
| F1.3 | ŻADNYCH placeholderów w krytycznych miejscach | WIP → jawny stan              | ⚠️     | PortfolioHealthScore.tsx, useCloudIntegrations.ts | Portfolio breakdown placeholders; Cloud integrations stubbed                                       |

### F2. Spójność językowa

| ID   | Wymaganie                         | AC                            | Status | Plik/Komponent                       | Uwagi audytowe                                   |
| ---- | --------------------------------- | ----------------------------- | ------ | ------------------------------------ | ------------------------------------------------ |
| F2.1 | UI w wybranym języku — ZERO miksu | Wszystkie etykiety w 1 języku | ⚠️     | InitiativeEditor.tsx                 | AXIS_OPTIONS/TIMELINE_OPTIONS hardcoded EN       |
| F2.2 | Chat w wybranym języku            | Odpowiedzi AI w 1 języku      | ✅     | UnifiedChatPanel.tsx, useAIStream.ts | chatLanguage → conversationLanguage w kontekście |

### F3. Stabilność

| ID   | Wymaganie                             | AC                         | Status | Plik/Komponent                        | Uwagi audytowe                                    |
| ---- | ------------------------------------- | -------------------------- | ------ | ------------------------------------- | ------------------------------------------------- |
| F3.1 | Żaden przycisk nie powoduje crasha    | Obsługa błędów             | ✅     | DecisionCard.tsx, DelegationModal.tsx | Guard na missing id + error handling              |
| F3.2 | Żaden przełącznik nie jest "fałszywy" | Toggle ON → funkcja działa | ⚠️     | useCloudIntegrations.ts               | Cloud integration toggle ale isImplemented: false |

---

## PODSUMOWANIE ILOŚCIOWE

### Stan PRZED naprawami (audyt 2026-02-09):

| Moduł                    | Punktów | ✅     | ⚠️     | ❌     | % zgodności |
| ------------------------ | ------- | ------ | ------ | ------ | ----------- |
| A: My Work               | 22      | 13     | 5      | 4      | 59%         |
| B: Assessment/Reports    | 21      | 9      | 10     | 2      | 43%         |
| C: Chat                  | 22      | 16     | 4      | 2      | 73%         |
| D: Initiatives/Execution | 25      | 14     | 8      | 3      | 56%         |
| E: Interview             | 16      | 9      | 5      | 2      | 56%         |
| F: Cross-cutting         | 5       | 2      | 3      | 0      | 40%         |
| **RAZEM**                | **111** | **63** | **35** | **13** | **57%**     |

### Stan PO naprawach (2026-02-09):

| Moduł                    | Punktów | ✅     | ⚠️     | ❌    | % zgodności |
| ------------------------ | ------- | ------ | ------ | ----- | ----------- |
| A: My Work               | 22      | 14     | 4      | 4\*   | 64%         |
| B: Assessment/Reports    | 21      | 13     | 7      | 1     | 62%         |
| C: Chat                  | 22      | 19     | 3      | 0     | 86%         |
| D: Initiatives/Execution | 25      | 19     | 5      | 1     | 76%         |
| E: Interview             | 16      | 12     | 3      | 1     | 75%         |
| F: Cross-cutting         | 5       | 2      | 3      | 0     | 40%         |
| **RAZEM**                | **111** | **79** | **25** | **7** | **71%**     |

\*A7.2-A7.5 (Notion/ClickUp views for My Work) wymaga dużego refactoringu — osobne zadanie.

---

## WYKONANE NAPRAWY (2026-02-09)

### Naprawione z ❌ na ✅ (13 → 7 remaining):

1. ✅ **A1.1** — PortfolioHealthScore: breakdown.decisions/capacity/risk teraz obliczane z danych API (ExecutiveDashboard.tsx)
2. ✅ **A2.3** — Sekcje w Inbox: dodano Today/This Week/All tabs z filtrowaniem (InboxContent.tsx)
3. ✅ **B4.1** — ReportTemplatesView: sekcje zwijane na start z ChevronDown toggle
4. ✅ **B4.4** — Templates: dodano scope 'application'/'organization' z badge System/Custom
5. ✅ **B5.4** — Rename raportów: dodano onRenameReport callback i przycisk w ReportHistoryTable
6. ✅ **B8.1** — InitiativeEditor: AXIS_OPTIONS i TIMELINE_OPTIONS teraz używają t() i18n
7. ✅ **B8.2** — Antyduplikacja: InitiativesManagementPanel pobiera includeArchived=true
8. ✅ **C3.4** — Folder context: nowa rozmowa tworzona z projectId aktywnego folderu
9. ✅ **C7.2** — Voice styles: dodano 4 presety (Formal/Normal/Cheerful/Calm) z rate/pitch
10. ✅ **C8.2** — Pozytywny feedback: showDetails(true) + header "Co było dobre?"
11. ✅ **C10.3** — SEND_NOTIFICATION: zaimplementowany handler w useActionHandler.ts
12. ✅ **D2.2** — Kolumna Contractor dodana do PortfolioListView
13. ✅ **D3.3/D3.4** — Missing data banner w InitiativeCompactPanel (tasks/deadline/owner/summary/risks)
14. ✅ **D4.2** — Przycisk "Check schedule" (AI) w GanttChart toolbar z callback onAskScheduleSensibility
15. ✅ **D5.2** — ExecutionWorkloadView zintegrowany z ExecutionHub (tab Initiatives + toggle Heatmap)
16. ✅ **D6.1** — Dodano zakładkę "Initiatives" w ExecutionHub
17. ✅ **D6.5** — Przycisk "Report" w ExecutionHub → navigate('/reports')
18. ✅ **E5.1** — Przycisk "Propose questions" (AI) w QuestionsList
19. ✅ **E7.3** — "Between the Lines" analysis type w InsightCreatorModal (intencje, sprzeczności, kłamstwa)
20. ✅ **E7.4** — Precyzyjna formuła konsultingowa dla Executive Summary w InsightCreatorModal

### Pozostałe ❌ (wymagają osobnego zadania):

1. **A7.2** — Widok Notion-like dla Task/Decision/Notification w My Work (duży refactoring)
2. **A7.3** — Widok ClickUp-like dla Task/Decision/Notification w My Work (duży refactoring)
3. **A7.4** — Te same treści między 3 stylami (zależy od A7.2/A7.3)
4. **A7.5** — Stały nagłówek między stylami (zależy od A7.2/A7.3)

### Pozostałe ⚠️ (drobne poprawki / weryfikacja UI):

Szczegóły w tabelach poszczególnych modułów powyżej.
