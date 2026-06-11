# Inwentarz funkcjonalności B — MOJA PRACA (bez Ideas)

Część mapy modułów V2. Zweryfikowane w kodzie 2026-06-11, branch `feat/deliverables-light`.
Ideas (zarządzanie + 4 narzędzia) — patrz `docs/audit/2026-06-11/ideas/` (5 osobnych kart).

**Wejście:** sidebar MY_WORK → `src/views/MyWorkView.tsx:32` → `MyWorkHub.tsx` (3809 linii). Parser `parseMyWorkPathIntent` (:428-513): `/my-work/home`, `/my-work/ideas[...]`, `/my-work/tasks[/:id]`, `/my-work/decisions[/:id]`, `/my-work/notebook[/:pageId]`, `/my-work/inbox`, `/my-work/calendar`, `/my-work/manager` + query deep-linki.

**Zakładki widoczne dziś:** Pomysły (🔒 beta closed), Notatnik, Inbox (domyślny landing), Kalendarz, Zadania, Decyzje, Manager (admin/manager/superadmin). **Ukryte:** Radar/Home — `RADAR_ENABLED = false` (:189), fallback = inbox.

**Gating:** Ideas beta `MYWORK_IDEAS: 'closed'` + `BETA_ADMINS_EXEMPT = false` → zablokowane dla WSZYSTKICH ról łącznie z adminami (komentarz „admins keep access" w :606 nieaktualny). Pilot: wszystko oprócz Ideas. Manager: tylko admin/manager/superadmin.

## 1. Radar / Home — UKRYTE (flaga kompilacyjna)
- Radar sygnałów (mapa kwadrantowa + karty + briefingi) — `Home/HomeView.tsx`, serwer `my-work/radar.routes.ts` (7 endpointów) — kod żywy, niemontowany. [UKRYTE]
- Home v2 data feed — `my-work/home.routes.ts` (`/home/v2`, `/brief`, `/spark`, `/pulse`, `/nudge`, `/outputs`). [UKRYTE]
- `handleHomeAction` w hubie (:2027-2186) — create/navigate/open/chat/handoff/radar_feedback + most do Outputs. [UKRYTE — okablowane, nieosiągalne]
- Bloki Home v1 (AICompanionBrief, SparkZone, WorldPulse, GentleNudge, RadarTriageCard, CommandDock, MomentumBlock, TeamSignalBlock, DecisionTemperatureBlock, ExecutionCurrentBlock, IndustryLensBlock, AIPulseCore...) — [MARTWY KOD] (wyjątek: `useRadarTriageData.executeTriageHandoff` importowany przez hub)

## 2. Notatnik / Notebook
Route: `/my-work/notebook` (L1 biblioteka), `?notebook=<id>` (L2), `/my-work/notebook/:pageId`. Dwupoziomowy: lista notatników → strony TipTap z AI.
1. Biblioteka notatników (L1) — App Table, filtry Wszystkie/Osobiste/Zespołowe, liczniki. [DZIAŁA] `NotebookLibraryContent.tsx`
2. Nowy notatnik (CTA) — [DZIAŁA]
3. CRUD notatnika — rename/archive/delete; serwer `notebook.routes.ts:188-360`. [DZIAŁA]
4. Lista stron + edytor TipTap — highlight, linki, tabele, task-listy, wyrównanie. [DZIAŁA] `NotebookContent.tsx`
5. SlashMenu — h1-h3, listy, todo, callout, warning, toggle, divider, table, code + AI: ai-ask/expand/challenge/action + create-task, create-decision, save-as-idea. [DZIAŁA] `notebook/SlashMenu.tsx:45-242`
6. Ekstrakcja akcji AI — `POST /pages/:id/extract-actions`. [DZIAŁA]
7. Sugestie tematów AI — `POST /suggest-topics`. [DZIAŁA]
8. Inline czat AI — z konwersją odpowiedzi na cele. [DZIAŁA] `AIChatInlinePanel` (uwaga: korupcja codemodu „rose" — patrz karta Mind Map)
9. Auto-klasyfikacja strony — debounce 2 s. [DZIAŁA]
10. WorkspacePanelStrip — czat / kontekst / AI suggestions. [DZIAŁA]
11. Załączniki — upload/download/delete. [DZIAŁA]
12. Pin / status strony — [DZIAŁA]
13. Konwersja strony → output (inicjatywa/raport/prezentacja) — [DZIAŁA]
14. Konwersja checklisty → zadania — [DZIAŁA]
15. Expand do dokumentu Canvas — [DZIAŁA]
16. Szablony nowej strony — [DZIAŁA]
17. Strip ścieżki kanonicznej — [DZIAŁA]
18. Capture API (web-clip/email/upload/import, search, rag-context, embed-chips) — `server/src/routes/notebook.routes.ts`. [DZIAŁA — zasilane spoza huba]
19. `KnowledgePulse.tsx`, `InsertMenu.tsx` — [MARTWY KOD]

## 3. Inbox (domyślny landing)
Route: `/my-work/inbox` → `InboxContent.tsx` (3357 linii). Zunifikowany triage: powiadomienia + zadania + decyzje.
1. Zunifikowana lista z deduplikacją — v8 canonical inbox z fallbackiem do legacy. [DZIAŁA]
2. Quick actions inline — Focus Dziś / Tydzień / Done / Save / Dismiss / Snooze. [DZIAŁA]
3. Bulk triage — [DZIAŁA]
4. Skróty klawiaturowe J/K/T/W/E/B/A/X — [DZIAŁA]
5. Presety Menu 3 z licznikami (ALL/Zaległe/Zapisane/AI/Krytyczne/Wymaga akcji/Dziś/Tydzień) — [DZIAŁA]
6. Status-chipy Otwarte/Gotowe/Zapisane — [DZIAŁA]
7. Widok lista ↔ karty — [DZIAŁA]
8. AI Triage — czat z kontekstem + AI assist per item. [DZIAŁA]
9. Heatmapa pilności, aging, „dlaczego to widzę", read-vs-done, Saved/Pin — [DZIAŁA]
10. Detal powiadomienia — `NotificationDetailView.tsx` (3196 l.): mark-as-read, snooze, mute, nawigacja do źródła. [DZIAŁA]

## 4. Kalendarz
Route: `/my-work/calendar` → `Calendar/CalendarView.tsx`.
1. Widoki month/week/day/list — [DZIAŁA]
2. Zunifikowany feed — `GET /my-work/calendar/unified`. [DZIAŁA]
3. Filtr źródeł: task/initiative/decision/consultify/google/outlook + mini-kalendarz. [DZIAŁA]
4. Status integracji Google/Outlook — connected/pending/reauth/error. [DZIAŁA — zależne od integracji konta]
5. Dodaj wydarzenie — [DZIAŁA]
6. Konflikty / day-load preview — z degradacją z komunikatem. [DZIAŁA]
7. Drag-reschedule — PATCH z etag. [DZIAŁA]
8. Klik-through do zadania/decyzji/inicjatywy — [DZIAŁA]

## 5. Zadania / Tasks
Route: `/my-work/tasks[/:id]` → `/my-work/personal-tasks` API.
1. Tabela — ResizableTable, sort, inline status/priorytet, preview panel, row actions. [DZIAŁA] `MyTasksListContent.tsx` (2483 l.)
2. Kanban — pełny DnD = zmiana statusu. [DZIAŁA] `TasksKanbanBoard.tsx`
3. Kalendarz zadań — [DZIAŁA]
4. Przełącznik widoków — [DZIAŁA]
5. Filtry Menu 3 z licznikami — [DZIAŁA]
6. Bulk bar — priorytet, termin, gotowe, usuń. [DZIAŁA]
7. AI Priorytety — czat z kontekstem. [DZIAŁA]
8. Nowe zadanie — tab dokumentu. [DZIAŁA]
9. Detal zadania — `TaskDetailView.tsx` (6574 l.): 9 sekcji + properties strip. [DZIAŁA]
10. **Linkowanie decyzji z zadania — `availableDecisions` zaszyte na sztywno (4 mocki, brak fetcha)** (`TaskDetailView.tsx:318-325`). [WIDOCZNE-ALE-ZEPSUTE]
11. Task advisor API — `mountStub`, brak konsumenta FE. [STUB]

## 6. Decyzje / Decisions
Route: `/my-work/decisions[/:id]`.
1. Tabela z podglądem — approve/reject/remind/escalate/delete, AI w podglądzie, snooze. [DZIAŁA] `DecisionsPanelContent.tsx`
2. Kanban decyzji — [DZIAŁA]
3. **Timeline decyzji — celowo wyłączony** (komponent zachowany). [UKRYTE]
4. Przełącznik lista/kanban + filtr priorytetu — [DZIAŁA]
5. Filtry Menu 3 (Wszystkie/Moje do decyzji/Moje prośby) — [DZIAŁA]
6. Bulk bar — [DZIAŁA]
7. Nowa decyzja — [DZIAŁA]
8. Detal decyzji — `DecisionDetailView.tsx` (7801 l.): alternatywy, ryzyka, interesariusze, komentarze; DEMO_* tylko przy `isDemo`. [DZIAŁA]

## 7. Manager (Executive)
Route: `/my-work/manager` → `Executive/ExecutiveDashboard.tsx` (981 l.). Gating rolą.
1. Portfolio Health Score + KPI Grid — [DZIAŁA]
2. Action Required Strip — [DZIAŁA]
3. Decision Queue Preview z inline approve/reject — [DZIAŁA]
4. Team Performance Preview — [DZIAŁA]
5. AI Operator Overview Card — [DZIAŁA]
6. Postęp inicjatyw + sygnały AI + work patterns — [DZIAŁA]

## 8. Focus — okablowane, bez UI
- `Focus/FocusView.tsx` — lazy-importowany + pełny stan, **nigdy nie renderowany**. [MARTWY KOD]
- `FocusBoard`, `AICoachPanel`, `AIPlanView`, `NudgeStrip` — nieosiągalne (NudgeStrip reużyty w Ideas). [MARTWY KOD]
- Backend focus (`focus.routes.ts`) — zasilany przez triage Inboxa, żaden widok nie pokazuje stanu. [DZIAŁA (zapis) / UKRYTE (odczyt)]

## 9. Przekrojowe
1. Dynamic tabs dokumentów — persist w sessionStorage. [DZIAŁA]
2. Kontekstowy czat AI per tab — systemowe prompty + quick-prompty + workload context (poll 5 min). [DZIAŁA]
3. Ciągłość sesji (L7) — `session-context` zapis [DZIAŁA] / odczyt nieużywany [STUB]
4. EventBus odświeżania + `mywork-open-item` — [DZIAŁA]
5. Wyszukiwarka per tab — [DZIAŁA]
6. Cross-tab alert chips — [DZIAŁA]
7. Breadcrumbs — [DZIAŁA]
8. ConvertTo* flow — żywe w Notebook i Ideas; `shared/ConvertToMenu` [MARTWY KOD]
9. `NotificationSettings.tsx` — montowany w Ustawieniach, nie w hubie. [DZIAŁA poza My Work]

## 10. Martwy kod (zero konsumentów)
`WorkCenter.tsx` + łańcuch (MyProjects, MyTasksList stara, PillNavigation, QuickFilterBar, WorkSidebar, DecisionsPanel, DecisionsList, DecisionBottleneckPanel); WorkloadView, TodayDashboard (+PersonalExecutionBar), ProgressView, FocusCockpit, NotificationsHub, NotificationsContent, NotificationsKanbanBoard, TaskInbox, DecisionReviewNext, LocationFilter, Tasks/TaskFiltersBar, Inbox/InboxTriage, Notifications/NotificationCenter, Team/TeamPerformancePanel (+BottleneckMap/CapacityForecast), Dashboard/* (poza VelocityChart żywym w AdvancedAnalytics), Charts/*, notebook/KnowledgePulse, notebook/InsertMenu, Focus/*.

**Backend (mapa):** monolit `my-work.routes.ts` (13k+ linii) + wyodrębnione `my-work/`: decisions, focus, stats, signals, notebook, calendar, radar, home; obok: `inbox-enterprise.routes.ts`, `tasks.routes.ts`, `notifications.routes.ts`, `notification-rules.routes.ts`, `notificationSettings.routes.ts`, `calendarIntegrations.routes.ts`, `task-advisor.routes.ts` (stub-mount).
