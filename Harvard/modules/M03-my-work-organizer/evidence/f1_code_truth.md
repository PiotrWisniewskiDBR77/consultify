# M03 — Moja Praca (organizer) · FAZA 1 — PRAWDA KODU

Branch `feat/deliverables-light`. Audyt READ-ONLY, 2026-06-11. Każde twierdzenie z dowodem `plik:linia`.
Zakres: sekcje 1, 3-10 inwentarza `INV_B_my-work.md` (organizer). POMINIĘTE: sekcja 2 (Notatnik=M04) i Ideas (M05-09).

Wejście: `src/views/MyWorkView.tsx` → `src/components/MyWork/MyWorkHub.tsx` (hub, ~3.8k linii).

---

## 1a. REALNE

| Funkcja | Dowód | Uwaga |
|---|---|---|
| Inbox zunifikowany (canonical V8 + fallback legacy) | `src/components/MyWork/InboxContent.tsx:1772-1799` | Promise.all: V8 canonical, przy błędzie 404/400/405/501 → legacy `/my-work/inbox`. NIE pada bez V8. |
| Inbox triage/bulk/ai-assist (V8→legacy) | `InboxContent.tsx:1987-1988, 2074-2075, 2118` | każda mutacja `.catch(() => Api.post('/my-work/inbox/...'))` |
| Detal powiadomienia | `src/components/MyWork/NotificationDetailView.tsx` (~3196 l.) | mark-read/snooze/mute/nav |
| Kalendarz feed zunifikowany | `server/src/routes/my-work/calendar.routes.ts:113` `/calendar/unified`; źródła `:19` = `['task','initiative','decision','outlook','google','consultify']` | realny UNION po tabelach |
| Kalendarz day-load/konflikt z komunikatem | `src/components/MyWork/Calendar/CalendarView.tsx:205` | tekst „Consider a reschedule…" |
| Kalendarz drag-reschedule (etag) | `CalendarView.tsx:42` (`etag?`), `:357` (error handler) | |
| Zadania (tabela/kanban/kalendarz) | `src/components/MyWork/MyTasksListContent.tsx`, `TasksKanbanBoard.tsx`; API `/my-work/personal-tasks` `server/src/routes/my-work.routes.ts:1047,1159,1266` | |
| Detal zadania (9 sekcji) | `src/components/MyWork/TaskDetailView.tsx` (~6.5k l.) | poza mockiem decyzji (1c) |
| Decyzje (tabela/kanban/detal) | `src/components/MyWork/DecisionsPanelContent.tsx`, `DecisionDetailView.tsx` (~7.8k l.) | |
| Manager / Executive dashboard | `src/components/MyWork/Executive/ExecutiveDashboard.tsx:280-286` | 7 realnych endpointów: `/my-work/stats`, `/my-work/decisions`, `/my-work/team-workload`, `getTasks`, `getExecutiveAnalytics`, `/my-work/signals`, `getAIOperatorOverview`; work-patterns `:586` |
| EventBus `mywork-open-item` | emitery `TaskDetailView.tsx:3669,6531`, `DecisionDetailView.tsx:4562,7725`, `ConvertToOutputMenu.tsx:159`; listener `MyWorkHub.tsx:1297-1298` | pełna pętla emit↔listen |
| ConvertToOutputMenu (handoff do Outputs) | live w `NotebookContent.tsx:2114`, `IdeasTableContent.tsx:656` | (Notebook=M04, ale komponent współdzielony — żywy) |
| Inbox-enterprise (inbox-v4) | mount `server/src/Gateway.ts:904` `/api/inbox-v4`; FE konsumuje `src/services/api.ts:18676-18753` (connectors, routing-rules, focus boards) | API żywe (część focus-boards bez UI — patrz 1d) |
| Focus backend (zapis) | `server/src/routes/my-work/focus.routes.ts:29 (/focus/move), :61 (/focus/reorder), :94/:131 (/focus/rules), /focus/state` | zapis działa |
| session-context ZAPIS | `MyWorkHub.tsx:1202` POST; serwer `my-work.routes.ts:8496` (UPDATE/INSERT `my_work_session_context`) | |

## 1b. MOCK / STUB

| Pozycja | Werdykt | Dowód |
|---|---|---|
| **TaskDetailView `availableDecisions`** | **MOCK — nadal żywy** | `TaskDetailView.tsx:318-325` — 4 zaszyte rekordy (`dec-1..dec-4`, „Zatwierdzenie budżetu Q2" itd.). `setAvailableDecisions` użyte tylko lokalnie `:5407` (dopisanie świeżo utworzonej), **zero fetcha z BE**. Renderowane w pickerze `:5487, :5533`. Linkowanie decyzji z zadania operuje na fikcji. |
| task-advisor API | STUB (503) | `server/src/routes/task-advisor.routes.ts:12-20` — każdy request → `503 not_configured`; mount `Gateway.ts:483` `mountStub`. **Zero konsumenta FE** (grep `task-advisor` w `src/` = 0). |
| session-context ODCZYT | STUB (martwy odczyt) | `MyWorkHub.tsx:946-951` — fetch GET wykonany, ale ciało `if (context?.lastViewedItems?.length)` zawiera tylko komentarz `// Could append to system prompt…`; **wynik odczytu wyrzucany**. Backend get `my-work.routes.ts:8548` działa, ale FE go nie używa. |

## 1c. ZEPSUTE / WIDOCZNE-ALE-ZEPSUTE

| Pozycja | Werdykt | Dowód |
|---|---|---|
| Linkowanie decyzji z zadania | WIDOCZNE-ALE-ZEPSUTE | jw. `TaskDetailView.tsx:318-325` — picker pokazuje 4 zmyślone decyzje niezależne od realnych danych org. UI w pełni wyrenderowane → użytkownik widzi działający przycisk z fałszywą zawartością. |
| Komentarz „Admins keep access" (Ideas beta) | MYLĄCY (nie bug runtime, ale fałszywa dokumentacja w kodzie) | `MyWorkHub.tsx:604-605` mówi „Admins keep access"; runtime `src/utils/betaAccess.ts:71` `isBetaLockedForRole` → `if (!BETA_ADMINS_EXEMPT) return true` przy `BETA_ADMINS_EXEMPT = false` (:32) → Ideas zablokowane też dla adminów. Sprzeczność komentarz↔kod. |

Brak innych „cichych degradacji" — fallbacki inboxa/kalendarza/executive mają komunikaty albo świadomy `.catch(()=>null/[])` z UI-error (`InboxContent.tsx:1848-1851` toast+loadError).

## 1d. UKRYTE / MARTWY KOD

Reguła: `plik → dlaczego → wytnij/wepnij/zostaw`.

### UKRYTE (kod żywy, niemontowany / zagated)
- `src/components/MyWork/Home/HomeView.tsx` — lazy-import `MyWorkHub.tsx:154`, render `:3161`, ale `:3155-3156` koercja `tabToRender` wymusza `MY_WORK_FALLBACK_TAB` gdy `RADAR_ENABLED=false` (:189) → `case 'home'` **nieosiągalny**. Backend żywy: `radar.routes.ts` (8 endpointów, mount `my-work.routes.ts:6805`), `home.routes.ts` (mount `:8969`). → **ZOSTAW** do decyzji o włączeniu Radaru.
- `handleHomeAction` `MyWorkHub.tsx:2027` + most do Outputs — okablowane, nieosiągalne (tylko z HomeView). → ZOSTAW (sprzężone z Radarem).
- `Focus/FocusView.tsx` — lazy `MyWorkHub.tsx:157`, **brak JSX `<FocusView`** w hubie (grep=0) → nigdy nie renderowany. Backend focus zapis żywy (1a), `/focus/state` odczyt bez konsumenta FE. → ZOSTAW/wytnij wg roadmapy Focus.
- `DecisionsTimelineView.tsx` — lazy `MyWorkHub.tsx:170`, świadomie wyłączony `:3357-3359` („Timeline view is intentionally disabled… must never render"); switcher tylko table/kanban. → ZOSTAW (celowo gated).

### MARTWY KOD (zero konsumentów w M03)
Potwierdzono brakiem importerów spoza barrela `index.ts` i `__tests__`:
- **Łańcuch WorkCenter** — `WorkCenter.tsx`, `PillNavigation.tsx`, `QuickFilterBar.tsx`, `NotificationsHub.tsx` tworzą zamknięty klaster: jedynymi konsumentami `PillNavigation`/`QuickFilterBar` są `WorkCenter.tsx` + `NotificationsHub.tsx` (grep), a te nie mają zewnętrznych importerów poza `index.ts`. → **WYTNIJ** (cały łańcuch + barrel).
- `WorkloadView.tsx`, `TodayDashboard.tsx`, `TaskInbox.tsx`, `ProgressView.tsx`, `FocusCockpit.tsx`, `DecisionReviewNext.tsx`, `NotificationsContent.tsx` — 0 importerów poza `index.ts`. → WYTNIJ.
- `Focus/FocusBoard`, `AICoachPanel`, `AIPlanView` — 0 zewn. importerów. → WYTNIJ.
- `NudgeStrip.tsx` — 0 importerów w M03; reużyty WYŁĄCZNIE w Ideas (`IdeaWhiteboardTool.tsx`). → ZOSTAW (żywy w M05-09), nie liczyć do M03.
- `shared/ConvertToMenu.tsx` — 0 konsumentów (grep `\bConvertToMenu\b` poza self/ConvertToOutputMenu/index = 0). Uwaga: to NIE to samo co żywy `ConvertToOutputMenu`. → WYTNIJ.
- inbox-v4 focus-boards API (`api.ts:18741-18753`) — brak komponentu renderującego (`getFocusBoards`/`FocusBoard` poza api.ts = 0). → ZOSTAW (kontrakt) lub wytnij wg roadmapy.

## 1e. Wiring FE ↔ BE ↔ DB

| Funkcja | Endpoint | Tabela | Migracja | Status |
|---|---|---|---|---|
| Inbox canonical (V8) | `GET /api/v8/my-work/inbox/canonical` (klient `api/v8/client.ts:9` V8_BASE=`/api/v8`; gate `Gateway.ts:1006`), serwer `routes/v8/my-work.routes.ts:615` | `canonical_inbox_items`, `my_work_inbox_triage` | `654_v4_canonical_inbox.sql`, `736_inbox_performance_indexes.sql` | DZIAŁA (gated `ENABLE_V8_GLOBAL`) |
| Inbox legacy (fallback) | `GET /api/my-work/inbox` `my-work.routes.ts` | inbox/notifications | — | DZIAŁA (404 z V8 → tu) |
| Inbox-enterprise | `/api/inbox-v4/*` `Gateway.ts:904`; FE `api.ts:18676+` | inbox connectors/routing | `632_v4_inbox_connectors.sql`, `631_v4_inbox_ai_evals.sql` | DZIAŁA (focus-boards bez UI) |
| Tasks | `/api/my-work/personal-tasks[/:id]` `my-work.routes.ts:1047/1159/1266/1310/1433` | `tasks` | — | DZIAŁA |
| Decisions | `/api/my-work/decisions` `my-work.routes.ts` (`decisionsRouter` `:1456`) | decisions | — | DZIAŁA |
| Calendar unified | `GET /api/my-work/calendar/unified` `my-work/calendar.routes.ts:113` | tasks/initiatives/decisions + cal interop | `20260331_v8_calendar_interop_p02b.sql`, `20260411_*calendar*`, `610_calendar_feed_log_v3.sql` | DZIAŁA |
| Calendar integrations | `calendarIntegrations.routes.ts` mount `Gateway.ts:527` | google/outlook tokens | (calendar interop) | DZIAŁA (zależne od konta) |
| Manager/Executive | `/my-work/stats`, `/my-work/decisions`, `/my-work/team-workload`, `/my-work/signals`, `/my-work/work-patterns`, getExecutiveAnalytics, getAIOperatorOverview `ExecutiveDashboard.tsx:280-286,586` | stats/signals/team | — | DZIAŁA |
| Focus | `PUT /api/my-work/focus/{move,reorder,rules}`, `GET /focus/state` `my-work/focus.routes.ts` | focus state | `629_v4_inbox_focus_a1.sql`, `661_v4_inbox_focus_assessments.sql` | ZAPIS DZIAŁA / ODCZYT-stan bez UI (UKRYTE) |
| session-context | `POST/GET /api/my-work/session-context` `my-work.routes.ts:8496/8548` | `my_work_session_context` | `20260305_my_work_state_tables.sql` | ZAPIS DZIAŁA / ODCZYT STUB (FE odrzuca wynik) |
| task-advisor | `/api/task-advisor/*` `Gateway.ts:483` | — | — | STUB 503 (brak FE) |

## 1f. Flagi

| Flaga | Lokalizacja / default | Kto włącza | RUNTIME | Wpływ |
|---|---|---|---|---|
| `RADAR_ENABLED` | `MyWorkHub.tsx:189` const `= false` (hardcode FE, nie env) | zmiana kodu | OFF | Home/Radar (`HomeView`, `handleHomeAction`) niemontowane; landing = Inbox (`MY_WORK_FALLBACK_TAB`). Backend radar/home żywy ale nieosiągalny z UI. |
| `ENABLE_V8_GLOBAL` (inbox) | `server/.../FeatureFlags.ts:31` default `false`; gate `v8FeatureGate.middleware.ts:15-18` → **404** gdy OFF | env (Railway) | wg env | OFF → canonical inbox 404 → `shouldFallbackToLegacyMyWorkInbox` (`api.ts:6148-6151`, lista [400,404,405,501]) → legacy. **Inbox NIE pada.** Org-level gate `v8OrgGate` w dev fallback dla org bez flag (`:42-49`). |
| `MYWORK_IDEAS` beta | `betaAccess.ts:58` `'closed'`; `BETA_ADMINS_EXEMPT:32 = false` | zmiana kodu | closed dla WSZYSTKICH (też admin) | `MyWorkHub.tsx:606-607` `ideasBetaLocked` → plate „access restricted". Komentarz `:604-605` „Admins keep access" **STALE** (1c). |

## 1g. Połączenia międzymodułowe

| Kierunek | Co | Dowód | Status |
|---|---|---|---|
| WEJŚCIE | Inbox agreguje powiadomienia z całej apki (canonical/legacy) | `InboxContent.tsx:1772-1799` | DZIAŁA |
| WEJŚCIE | Kalendarz feed: task/initiative/decision/consultify/google/outlook | `my-work/calendar.routes.ts:19` | DZIAŁA |
| WEJŚCIE | ConvertTo* z Notatnika (M04) i Ideas (M05-09) | `NotebookContent.tsx:2114`, `IdeasTableContent.tsx:656` (`ConvertToOutputMenu`) | DZIAŁA |
| WYJŚCIE | Handoff do Outputs | `ConvertToOutputMenu.tsx:159` (emit `mywork-open-item`); HomeView handoff `MyWorkHub.tsx:2140` (`executeTriageHandoff`) | DZIAŁA (HomeView-side UKRYTE) |
| WEWN. | EventBus `mywork-open-item` | emit×6 (Task/Decision/ConvertToOutput/IdeaRecommendationMap/IdeaContextPanel), listener `MyWorkHub.tsx:1297` | DZIAŁA |
| WEJŚCIE/WYJŚCIE | Deep-linki `parseMyWorkPathIntent` (`/my-work/{tasks,decisions,inbox,calendar,manager,...}`) | `MyWorkHub.tsx` (parser) | DZIAŁA (`home` koercja do fallback) |
| WYJŚCIE | `mywork-open-item` z Ideas map/panel | `IdeaRecommendationMap.tsx:1305,4466,4910`, `IdeaContextPanel.tsx:498` | DZIAŁA (źródło=M05-09) |
| — | ConvertToMenu (shared, NIE OutputMenu) | 0 konsumentów | MARTWE |
| — | task-advisor handoff | brak FE | STUB |
| — | session-context (ciągłość sesji L7) odczyt | `MyWorkHub.tsx:946-951` wynik wyrzucany | STUB (odczyt) |

---

## Podsumowanie liczbowe (organizer)

- **REALNE:** ~14 obszarów funkcjonalnych (Inbox, Kalendarz, Zadania, Decyzje, Manager, EventBus, ConvertToOutput, focus-zapis, session-zapis, inbox-v4 API…).
- **MOCK/STUB:** 3 — TaskDetailView availableDecisions (MOCK żywy), task-advisor (STUB 503), session-context odczyt (STUB).
- **ZEPSUTE/widoczne-ale-zepsute:** 1 funkcjonalne (linkowanie decyzji z zadania) + 1 mylący komentarz beta.
- **UKRYTE:** 4 (HomeView/Radar, handleHomeAction, FocusView, DecisionsTimelineView).
- **MARTWE:** łańcuch WorkCenter (4) + WorkloadView/TodayDashboard/TaskInbox/ProgressView/FocusCockpit/DecisionReviewNext/NotificationsContent (7) + FocusBoard/AICoachPanel/AIPlanView (3) + ConvertToMenu (1) ≈ **15+** komponentów (NudgeStrip wyłączony — żywy w Ideas).
