# TESTY — M03 Moja Praca (organizer: Inbox, Kalendarz, Zadania, Decyzje, Manager)

> **Moduł:** M03 Moja Praca — organizer (`/my-work/*`) — wg `Harvard/podzial/_MODULE_MAP_V2.md`, inwentarz `Harvard/podzial/inventory/INV_B_my-work.md`
> **Zakres tej paczki:** hub + nawigacja, **Inbox** (landing), **Kalendarz**, **Zadania**, **Decyzje**, **Manager** — wszystkie przyciski, akcje wsadowe, skróty klawiaturowe, filtry, detale encji, oraz weryfikacja E2E przez endpointy backendu.
> **Poza zakresem:** Pomysły/Ideas (osobne karty `Harvard/podzial/ideas/`, beta closed dla wszystkich) oraz Notatnik (paczka M04). Radar/Home są UKRYTE (flaga kompilacyjna) — patrz §9.
> **Cel:** agent piszący i testujący moduł ma dogłębnie przetestować tworzenie i zmienianie zadań/decyzji/wydarzeń oraz cały triage Inboxa, z dowodem w Network.
> **Data:** 2026-06-14

---

## 0. Architektura i mapa plików

| Obszar | Komponent | Plik |
|---|---|---|
| Wejście / hub | `MyWorkView` → `MyWorkHub` | `src/views/MyWorkView.tsx`, `src/components/MyWork/MyWorkHub.tsx` (~3800 l.) |
| Inbox | `InboxContent` + `NotificationDetailView` | `src/components/MyWork/InboxContent.tsx` (~3357 l.), `NotificationDetailView.tsx` |
| Kalendarz | `CalendarView` (+ `CalendarCreateEventModal`) | `src/components/MyWork/Calendar/CalendarView.tsx` |
| Zadania | `MyTasksListContent`, `TasksKanbanBoard`, `TaskDetailView` | `src/components/MyWork/MyTasksListContent.tsx` (~2483 l.), `TasksKanbanBoard.tsx`, `TaskDetailView.tsx` (~6574 l.) |
| Decyzje | `DecisionsPanelContent`, `DecisionsKanbanBoard`, `DecisionDetailView` | `src/components/MyWork/DecisionsPanelContent.tsx`, `DecisionsKanbanBoard.tsx`, `DecisionDetailView.tsx` (~7801 l.) |
| Manager | `ExecutiveDashboard` | `src/components/MyWork/Executive/ExecutiveDashboard.tsx` (~981 l.) |
| Backend | monolit `my-work.routes.ts` (13k+ l.) + `my-work/{decisions,focus,stats,signals,notebook,calendar,radar,home}.routes.ts`, `inbox-enterprise.routes.ts`, `tasks.routes.ts`, `notifications*.routes.ts`, `calendarIntegrations.routes.ts` | `server/src/routes/` |

**Routing (parser `parseMyWorkPathIntent` w `MyWorkHub`):** `/my-work/inbox` (landing), `/my-work/calendar`, `/my-work/tasks[/:id]`, `/my-work/decisions[/:id]`, `/my-work/manager`, `/my-work/notebook[...]` (M04) + deep-linki query (`?taskId=`, `?decisionId=`, `?ideaId=`).

**Zasada E2E (obowiązkowa):** każdy triage/edit/akcja wsadowa MUSI być potwierdzona w Network właściwym endpointem (sekcje niżej podają je per akcja). Sama zmiana w UI bez żądania = FAIL (możliwy optimistic update bez persystencji). Po akcji odśwież stronę i sprawdź, że stan przetrwał.

**Gating do potwierdzenia:**
- **Manager** widoczny tylko dla `admin | manager | superadmin` (`canViewManager`); dla zwykłego usera zakładka ma być niewidoczna/zablokowana.
- **Ideas** zamknięte dla WSZYSTKICH (łącznie z adminami) — poza zakresem tej paczki, ale potwierdź, że zakładka jest zablokowana (komentarz „admins keep access" w kodzie jest NIEAKTUALNY).

**Setup:** dev server, dwa konta (zwykły user + manager/admin), DevTools (Network filtr `/api/my-work` + Console = 0 błędów). Przygotuj kilka zadań, decyzji i powiadomień testowych w danych.

---

## 1. Hub i nawigacja

### 1.1 Zakładki (pills)
Inbox (landing), Kalendarz, Zadania, Decyzje, Notatnik (M04), Manager (gated), Pomysły (gated).
- Klik zakładki → `setActiveTab(...)`, URL aktualizuje się do `/my-work/<tab>`, ładuje właściwy panel.
- Wejście na `/my-work` bez segmentu → landing = **Inbox** (potwierdź; Radar/Home są wyłączone `RADAR_ENABLED=false`).
- Breadcrumbs: „My Work › {Zakładka}" (+ nazwa dokumentu przy otwartym detalu).

### 1.2 Deep-linki i EventBus
- Wejście z `?taskId=<id>` → otwiera zakładkę Zadania + detal zadania jako tab dokumentu.
- `?decisionId=<id>` → Decyzje + detal.
- `mywork-open-item` (custom event z innych modułów) → otwiera właściwą encję; sprawdź z poziomu np. powiadomienia/Inicjatyw.
- Niepoprawny/usunięty id w deep-linku → łagodny błąd, brak crasha.

### 1.3 Dynamic tabs dokumentów (sessionStorage)
- Otwarcie detalu (zadanie/decyzja/powiadomienie) tworzy tab dokumentu; **persist w `sessionStorage`** (`moduleHub.openDocuments.mywork`).
- „X" na tabie zamyka go; po reloadzie otwarte taby się odtwarzają.
- Wiele otwartych tabów naraz — przełączanie zachowuje stan każdego.

### 1.4 Kontekstowy czat AI per zakładka
- Każda zakładka ma własny system-prompt + quick-prompty (Inbox=triage, Tasks=execution, Decisions=advisor, Calendar=scheduling, Manager=C-level). Workload context odświeżany (~5 min poll).
- Wyślij quick-prompt w każdej zakładce → potwierdź, że kontekst (lista itemów) trafia do odpowiedzi.
- Wyszukiwarka per tab — filtruje listę w aktywnej zakładce.

---

## 2. Inbox (`InboxContent.tsx`) — triage

### 2.1 Quick actions inline (per wiersz) — endpoint `POST /my-work/inbox/{id}/triage`
Dla KAŻDEJ: klik → zmiana statusu + żądanie triage + status-chip aktualizuje się; odśwież → stan trwały.

| Akcja | Skrót | action w payloadzie | efekt |
|---|---|---|---|
| Focus Dziś | **T** | `accept_today` | pending → focused (today) |
| Focus Tydzień | **W** | `accept_week` | pending → focused (week) |
| Focus Później | — | `accept_later` | focused (later) |
| Gotowe (Done) | **E** | `done` | → resolved |
| Zapisz (Save) | **B** | `save` | → snoozed/saved |
| Odłóż (Dismiss) | **A** | `dismiss` | → dismissed |
| Odrzuć (Reject) | **X** | `reject` | → rejected |

### 2.2 Snooze (presety) — `POST /my-work/inbox/{id}/snooze`
2 godziny / Jutro rano (8:00) / 3 dni / Następny poniedziałek (8:00). Sprawdź poprawność `until` w payloadzie i że item znika z listy „open" do wskazanego czasu.

### 2.3 Bulk triage — `POST /my-work/inbox/bulk-triage`
- Select All / Clear; zaznacz N itemów → pasek bulk.
- Akcje wsadowe: Focus Today / Focus Week / Done / Save / Dismiss — payload `{ itemKeys[], action }`, jedno żądanie zbiorcze (nie N pojedynczych — zweryfikuj).
- Pasek disabled gdy brak zaznaczenia.

### 2.4 Skróty klawiaturowe
`J/↓`, `K/↑` (nawigacja), `Enter` (otwórz/preview), `Space` (zaznacz), `T/W/E/B/A/X` (triage), `Esc` (zamknij preview), `?` (pomoc).
- **Krytyczne:** gdy fokus jest w input/textarea/contenteditable — skróty NIE odpalają (potwierdź brak przypadkowego triage podczas pisania w czacie AI).

### 2.5 Presety Menu 3 z licznikami
ALL / Zaległe (SLA breached) / Zapisane (snoozed) / Krytyczne (urgency critical) / Wymaga akcji / Dziś / Tydzień. Liczniki muszą zgadzać się z liczbą realnych itemów po wejściu w preset.

### 2.6 Filtry zaawansowane (multiselect)
Status (open/done/saved/dismissed), Urgency (critical/high/normal/low), Type (assignment/mention/escalation/review/decision/ai_insight/system/billing/project), Section (9 sekcji), Source (system/ai/user). Kombinacje filtrów = iloczyn; reset czyści.

### 2.7 Widok lista ↔ sekcje (karty)
Flat (gradient pilności) vs Sections (9 grup). Przełącz; sprawdź spójność liczników i brak duplikatów (Inbox v8 canonical ma deduplikację — potwierdź, że ten sam item nie pojawia się dwa razy).

### 2.8 AI Triage assist — `POST /my-work/inbox/{id}/ai-assist`
- Sugerowana akcja + confidence; „Apply" wykonuje rekomendowaną akcję (triage).
- **Undo Last AI** → cofa ostatnią akcję AI; potwierdź przywrócenie poprzedniego stanu.
- AI Triage (czat z kontekstem listy) — sensowna rekomendacja.

### 2.9 Detal powiadomienia (`NotificationDetailView.tsx`)
mark-as-read, snooze, mute, nawigacja do źródła (klik-through do zadania/decyzji/inicjatywy). Sprawdź, że mute wycisza dany typ, a nawigacja prowadzi do właściwej encji.

### 2.10 Dodatkowe
„Save as Note" (→ `POST /api/notebook/pages`, tworzy stronę notatnika — most do M04), „Copy Markdown", „Copy for Slack" (schowek). Heatmapa pilności, aging, „dlaczego to widzę", read-vs-done, Pin.

---

## 3. Kalendarz (`Calendar/CalendarView.tsx`)

### 3.1 Tryby widoku
Month / Week / Day / List — przełącznik; każdy renderuje feed poprawnie, nawigacja wstecz/naprzód po okresach.

### 3.2 Zunifikowany feed — `GET /my-work/calendar/unified`
Zawiera task/initiative/decision/consultify (+ google/outlook gdy podłączone). Filtr źródeł (checkboxy) + mini-kalendarz. Wyłącz źródło → znika z siatki.

### 3.3 Integracje Google / Outlook
Status connected/pending/reauth/error (zależny od konta). Obecnie 2-way „coming soon" — potwierdź, że UI pokazuje stan, a brak integracji degraduje się z komunikatem, nie crashem.

### 3.4 Dodaj wydarzenie — `POST /my-work/calendar/events` (`CalendarCreateEventModal`)
Modal: tytuł, start/end, all-day, źródło. Walidacja (end ≥ start), zapis, pojawienie się w siatce. Pusty tytuł → blokada zapisu.

### 3.5 Drag-reschedule — `PATCH /my-work/{type}/{id}` z `etag`
- Przeciągnij task/decyzję na inny dzień → optimistic update + PATCH z `dueDate` i `etag`.
- **Konflikt etag (stale):** zasymuluj równoległą zmianę → sprawdź obsługę 409 (rollback + komunikat, brak cichej utraty).

### 3.6 Day-load / konflikty — `GET /my-work/calendar/day-load?date=`
Klik w dzień → podgląd obciążenia (tasks/decisions/hasConflicts/suggestion). Degradacja z komunikatem gdy brak danych.

### 3.7 Klik-through
Klik wydarzenia → otwiera powiązane zadanie/decyzję/inicjatywę (przez dynamic tab lub nawigację).

---

## 4. Zadania (`MyTasksListContent`, `TasksKanbanBoard`, `TaskDetailView`)

### 4.1 Tabela — quick actions per wiersz (`PATCH /my-work/tasks/{id}`, `DELETE` dla usuwania)
Toggle complete, Status (To Do / In Progress / Blocked), Triage Accept Today, Snooze, Archive, Delete (z confirm), Open Full, Preview. Każda zmiana = PATCH; usuwanie = DELETE + zniknięcie z tabeli; odśwież → trwałe.

### 4.2 Edycja inline kolumn
Title (text), Priority (select), Due Date (date picker), Status (select), Assignee (user picker) — każda → PATCH właściwego pola. Sprawdź walidację daty i że przerwana edycja (Esc) nie zapisuje.

### 4.3 Tryby widoku
Table (ResizableTable, sort, resize kolumn) / Kanban (DnD między kolumnami = zmiana statusu → PATCH) / Calendar. Przeciągnięcie karty Kanban na inną kolumnę musi zmienić status w backendzie.

### 4.4 Filtry Menu 3 z licznikami
All / Overdue (dueDate<today) / Today / This Week / Urgent (priority critical). Liczniki = realna liczba po wejściu.

### 4.5 Bulk bar — wiele zaznaczonych
Select All / Clear; Bulk Complete / Delete (confirm) / Change Priority / Change Due Date / Archive — operacje równoległe na zaznaczonych (`PATCH/DELETE`). Disabled bez zaznaczenia. Sprawdź, że częściowy błąd (1 z N) jest raportowany, nie cicho gubiony.

### 4.6 Nowe zadanie
Otwiera się jako tab dokumentu; AI-text (`POST /my-work/tasks/ai-text`) generuje title/description/priority z surowego tekstu. Zapis tworzy zadanie i pojawia się w tabeli.

### 4.7 Detal zadania (`TaskDetailView.tsx`) — 9 sekcji
Basic, People (owner/assignee), Initiative parent, Checklist, Tags, Risks, Alternatives, Implementation Ideas, Dependencies. Properties strip: Save / Mark Complete / Share / Close. Edycja każdej sekcji → PATCH; checklist add/remove/toggle.

### 4.8 ⚠️ ZNANY DEFEKT — linkowanie decyzji z zadania
W `TaskDetailView` (`availableDecisions`, ok. linii 318–325) lista decyzji do podlinkowania jest **zaszyta na sztywno / inicjalizowana pusto** — możliwy race przy pierwszym otwarciu (dropdown pusty mimo istniejących decyzji).
- **Test:** otwórz detal zadania, sekcja powiązań → sprawdź, czy lista decyzji to **realne dane z fetcha**, czy 4 mocki / pusto. Zaraportuj jako P1 (widoczne-ale-zepsute) z `plik:linia`.

---

## 5. Decyzje (`DecisionsPanelContent`, `DecisionsKanbanBoard`, `DecisionDetailView`)

### 5.1 Tabela — quick actions (endpointy `/my-work/decisions/{id}/{approve|reject|remind|escalate|snooze}`, `DELETE`)
Approve, Reject (z powodem), Remind, Escalate (z interesariuszami), Snooze, Delete (confirm), Open Full, Preview (`DecisionPreviewPanel` z AI). Każda akcja → właściwy endpoint + zmiana statusu (pending→approved/rejected/escalated). Po Approve/Reject akcje znikają (status ≠ pending).

### 5.2 Tryby widoku
Table / Kanban (kolumny statusów). **Timeline celowo WYŁĄCZONY** (`DecisionsTimelineView` istnieje, ale nie renderuje) — potwierdź, że przełącznik Timeline jest niedostępny/ukryty (NIE regresja).

### 5.3 Filtry Menu 3 + priorytet
Wszystkie / Moje do decyzji (owner=me) / Moje prośby (awaiting) + subfiltr priorytetu (all/CRITICAL/HIGH/MEDIUM/LOW). Liczniki zgodne.

### 5.4 Bulk bar
Approve / Reject / Delete / Change Priority / Remind / Escalate / Snooze Tomorrow — na zaznaczonych. Endpointy bulk lub równoległe pojedyncze (zweryfikuj który). Disabled bez zaznaczenia.

### 5.5 Nowa decyzja
Tworzenie (tab dokumentu); zapis tworzy decyzję w stanie pending, pojawia się w tabeli.

### 5.6 Detal decyzji (`DecisionDetailView.tsx`)
Sekcje: Description (problem/context/question/recommendation), Alternatives, Risk, Consequences of inaction (7d/30d/90d), Comments (+ canvas), Activity log, Control (sticky approve/reject), Stakeholders (+ notyfikacje), Escalation rules, Tags, Attachments, Linked items.
- Primary actions: Approve / Reject (modal powodu) / Escalate (wybór interesariuszy) / Remind / Save / Share. Approve/Reject disabled gdy status ≠ pending.
- **DEMO_\* dane** pokazują się tylko gdy `isDemo` — potwierdź, że na realnym koncie sekcje są zasilane prawdziwymi danymi, nie demo.

---

## 6. Manager (`Executive/ExecutiveDashboard.tsx`) — gated rolą

### 6.1 Gating
Zakładka dostępna tylko dla admin/manager/superadmin. **Test na dwóch kontach:** zwykły user — brak zakładki/dostępu; manager — pełny dashboard.

### 6.2 Karty (klikalne, nawigujące)
Portfolio Health Score (→ initiatives), KPI Grid (4 kwadranty → sekcje task/decision/team/risk), Action Required Strip (→ inbox/tasks/decisions), Decision Queue Preview (inline approve/reject + → decisions), Team Performance (→ team), Initiative Progress cards (→ detal inicjatywy), AI Signal cards (→ encja). Każdy klik nawiguje do właściwego miejsca.

### 6.3 Decision Queue — inline approve/reject
`POST /my-work/decisions/{id}/{approve|reject}` bez wychodzenia z dashboardu; po akcji item znika z kolejki. Potwierdź spójność z modułem Decyzje.

### 6.4 Odświeżanie
Manual refresh + auto-poll (~60 s). Dane (`GET /my-work/dashboard/executive`) świeże.

---

## 7. Przekrojowe (cross-cutting)
1. **Spójność cross-tab:** decyzja zatwierdzona w Manager znika też z Inbox/Decyzje (po refreshu/EventBus). Zadanie ukończone w Kanban = ukończone w tabeli i kalendarzu.
2. **Optimistic vs persist:** dla każdej akcji potwierdź realny endpoint; wymuś błąd sieci → rollback + komunikat, nie cicha utrata.
3. **i18n PL/EN** dla zakładek, akcji, filtrów, skrótów (tooltipy), komunikatów.
4. **Dark mode** dla wszystkich list, kanbanów, detali, dashboardu.
5. **A11y:** `aria-label` na akcjach, nawigacja klawiaturą (J/K + Tab), focus trap w modalach, Esc zamyka.
6. **Wydajność:** duże listy (100+ itemów) — sort/filtr/scroll płynne; uwaga na latencję N+1 (znana charakterystyka staging, patrz `finding_staging_db_perf`).
7. **Console:** 0 błędów/warningów przez całą sesję.

---

## 8. Testy jednostkowe / regresja
- Istniejące smoke/unit (potwierdź zielone): `NotebookLibraryContent.smoke`, `table/__tests__/*`, cell renderers (Priority/Risk/Classification/Summary).
- **Luki do dopisania** (brak testów): triage Inbox (skróty + bulk), bulk zadań, flow approve/reject decyzji, drag-reschedule kalendarza, `parseMyWorkPathIntent` (rozwiązywanie deep-linków).

---

## 9. Świadomość martwego/ukrytego kodu (NIE testować jako żywe)
- **Radar / Home** — `RADAR_ENABLED=false`, HomeView nigdy nie montowany; `handleHomeAction` okablowany, nieosiągalny. Potwierdź jedynie, że NIE są dostępne (brak zakładki).
- **Focus** (`Focus/FocusView`, FocusBoard, AICoachPanel, AIPlanView) — okablowane, bez UI (backend focus zasilany przez triage Inboxa, odczyt nieużywany).
- **Martwy łańcuch** `WorkCenter` i pochodne (MyProjects, stara MyTasksList, PillNavigation, DecisionsPanel/List/BottleneckPanel, WorkloadView, TodayDashboard, NotificationsHub/Content/KanbanBoard, TaskInbox, DecisionReviewNext, Dashboard/* poza VelocityChart, Charts/*). **Nie raportuj ich jako bugów** — to znany dead code; co najwyżej odnotuj, jeśli przypadkiem jest osiągalny.

---

## 10. Format raportu i DoD
Per przycisk/akcja: **kroki → oczekiwane → faktyczne → PASS/FAIL → dowód** (screenshot + payload+endpoint z Network + stan po reloadzie). Dla FAIL: `plik:linia`, przyczyna, propozycja fixu. Defekt `availableDecisions` (§4.8) i każde „widoczne-ale-zepsute" oznacz priorytetem.

**Definition of Done:** wszystkie quick actions, bulk bary, filtry, skróty i detale PASS z potwierdzeniem E2E w Network; gating Manager zweryfikowany na 2 kontach; spójność cross-tab potwierdzona; Timeline decyzji potwierdzony jako wyłączony (nie regresja); znany defekt linkowania decyzji zaraportowany; zero błędów w konsoli; PL+EN; light+dark.
