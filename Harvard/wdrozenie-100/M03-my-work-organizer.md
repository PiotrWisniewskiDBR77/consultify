# TECZKA M03 — Moja Praca (organizer) · pełna teczka reuse-first (pogłębiona do M13-level)

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje istniejące (karta audytu §1–§7 + evidence) i dokłada brakujące ogniwa (Rejestr Wejść z uwagami żywymi #5/#9/#10/#11 · Rejestr Decyzji · DoD z liczbami). Wzór głębi: [`M13-inicjatywy.md`](M13-inicjatywy.md) · struktura: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md) · decyzje: [`_DECYZJE.md`](_DECYZJE.md) (DP-2 trzeci panel IDE-tabs zamyka #10/D-02, DP-5 stuby, DP-9 §27 sweep).

## 00 · Nagłówek
- **Moduł:** M03 Moja Praca (Inbox · Kalendarz · Zadania · Decyzje · Manager) · **Pula:** core — najbardziej rozbudowany moduł aplikacji
- **Ocena audytu:** 54/100 · **Status:** FAZA 2/3 → FAZA 4 (sweepy) · **Rozmiar:** M (rdzeń) + **L** (i18n 2888 inline)
- **Żywy bloker:** 1×P1 leak executive-analytics (L-01) — **#5 crash ZAMKNIĘTY** (2026-06-16, patrz L-06 poniżej)
- **3 uwagi żywe:** #9 kalendarz Connect → Integracje (P2, fix w 952f309) · #10 otwarcie inicjatywy nawiguje (P1) · #11 paski multi-day (P2-design)
- **Właściciel:** Piotr · **Daty:** karta 2026-06-11 (`ee4319b076`) · teczka 2026-06-13
- **Karta:** `Harvard/modules/M03-my-work-organizer/KARTA_AUDYTU.md` · **Evidence:** `…/evidence/f1_code_truth.md`, `f2_tests_report.md`, `f56_kanon_sec.md`
- **Kod:** `src/components/MyWork/` (MyWorkHub 9k+, Calendar/CalendarView+CalendarSidebar+CalendarGrid+CalendarCreateEventModal, table/MyTasksListContent, TaskDetailView 6.5k, DecisionsPanelContent+DecisionDetailView, InboxContent, ExecutiveDashboard) · `src/views/MyWorkView.tsx` · `server/src/routes/my-work.routes.ts` (9061 l.) · `server/src/routes/my-work/calendar.routes.ts` · `server/src/routes/decisions.routes.ts` · `server/src/controllers/DecisionController.ts` · `server/src/services/integrationOAuthEngine.ts` · `src/types/core.ts` (TaskStatus/DecisionStatus enums)

## MAPA POKRYCIA
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta werdykt + §0 (6 scenariuszy) | job-to-be-done + persony + zakres (niżej) |
| B UX docelowe | 🟢 | karta §5 (§27 Zadania/Decyzje/Inbox) | **5 powierzchni: layout + WSZYSTKIE stany + delty crash #5/kalendarz #9/#11** (niżej) |
| C Dane+API+reguły | 🟢 | karta §1e/§1f | **enumeracja endpointów (inbox/tasks/decisions/calendar) + maszyny stanów + reguła nawigacji #10** (niżej) |
| D AI/Teresa | 🟡 | karta §1a (karty propozycji ← M01) | task-advisor stub (L-03) + session-context martwy (L-02) |
| E Integracje | 🟢 | karta §1g | delta #10 (nawigacja → klaster trzeciego panelu DP-2) |
| F Epiki | 🟢 | karta §7 (3 fale) | **epiki→stories→Gherkin→L-xx** (niżej) |
| G DoD/jakość | 🟢 | karta §0/§2/§7 | **liczby grep zweryfikowane** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść (4 uwagi żywe) + Decyzji** (niżej) |

---

## A · INTENCJA / PRODUKT
- **Job-to-be-done:** dać pracownikowi **jeden organizer pracy** — Inbox (triage), Kalendarz (unified feed), Zadania (tabela+Kanban), Decyzje (approve/reject/escalate), Manager (portfel zespołu).
- **Persony/role:**
  - **Member** — własna praca (Inbox/Kalendarz/Zadania/Decyzje); domyślny.
  - **Manager/Executive** — `ExecutiveDashboard` + executive-analytics (portfel zespołu z overload alerts). **Dziś gating tylko UI** → leak L-01 (member czyta cudzy portfel).
  - **Admin** — org-scope.
  - Ideas (M05-09) = closed beta, osobne moduły.
- **Zakres v1:** Inbox v8 (`/inbox/canonical`) + legacy fallback (graceful 404→`/inbox`) · kalendarz unified feed + drag-reschedule etag · zadania CRUD + Kanban DnD + detal · decyzje lifecycle · EventBus `mywork-open-item` · ConvertToOutput · focus zapis/odczyt.
- **POZA v1:** odczyt session-context (martwy stub L-02 — do wpięcia/usunięcia); Home/Radar (ukryte celowo `RADAR_ENABLED=false`); task-advisor (stub 503 L-03).
- **Metryka:** triage→reload trwałość; **0 crashy na landing (#5)**; kolorowanie źródła kalendarza działa (#11).

## B · UI/UX — STAN DOCELOWY
**Hub `MyWorkHub` (Menu 1/2/3, dynamic tabs):** 5 powierzchni przełączanych zakładkami: **Inbox** (`InboxContent`) · **Kalendarz** (`CalendarView`+`CalendarSidebar`+`CalendarGrid`) · **Zadania** (`MyTasksListContent` tabela + Kanban DnD `DraggableTaskRow`) · **Decyzje** (`DecisionsPanelContent`+`DecisionsKanbanBoard`) · **Manager** (`ExecutiveDashboard`).

**Layout per powierzchnia (docelowo):**
- **Inbox:** triage z quick-actions (Focus Dziś/Done/Snooze), bulk, skróty J/K/T/W/E/B/A/X, presety z licznikami `Overdue/Urgent/Inbox`.
- **Kalendarz:** grid Month/Week/Day/List + lewy `CalendarSidebar` (SOURCES: Tasks niebieski / Initiatives czerwony / Decisions pomarańcz / Google / Outlook) + unified feed.
- **Zadania/Decyzje:** §27 tabela (preview, filtry kolumn, sort, kebab 3-strefy, EntityStatusChip, DueChip, empty/loading/error+retry).

**Stany ekranu (docelowo każdy z komunikatem):**
- **Pusty:** Inbox „skrzynka pusta"; Zadania/Decyzje empty-state z CTA.
- **Ładowanie:** skeleton tabeli; kalendarz spinner.
- **Błąd:** dziś **#5 crash error-boundary „Coś poszło nie tak" na landing** (P1) → docelowo 0 crashy + granica z retry (`RouteErrorBoundary`/`ViewErrorBoundary`).
- **Pełny:** feed/tabela/grid.
- **Brak-uprawnień:** Manager → docelowo serwerowy `requireRole` (member→403, dziś leak L-01).

**Delty żywe:**
- **#5 crash My Work (P1) → ✅ ZAMKNIĘTY 2026-06-16:** `RelationChip` w `PreviewRelations.tsx:37` sprawdzał `typeof icon === 'function'` → Lucide ≥0.400 zwraca `forwardRef` (object, nie function) → `Icon = null` → komponent renderowany jako `ReactNode` → `Objects are not valid as a React child`. Fix: warunek `typeof === 'function' || (typeof === 'object' && '$$typeof' in icon)`. Stack trace z `/tmp/consultify-be.log` (HeadlessChrome 2026-06-16 03:18 UTC).
- **#9 kalendarz „Connect in Integrations" martwy (P2 LOKALNE):** „Podłącz w Integracjach" = `<span>` w `<button>` z `onClick=toggleSource` (`CalendarSidebar.tsx:166,184-192`) — NIE nawiguje. Docelowo: deep-link do `IntegrationsModule` + OAuth-connect kalendarza (provider `google_calendar` z właściwym scope; dziś `google` ma scope Gmail; `calendarIntegrations.routes.ts:132 „(future)"`).
- **#11 paski multi-day (P2-design):** Month renderuje wielodniowe inicjatywy jako pełne paski powtarzane co tydzień + **gubią kolor źródła** (wszystko fioletowe vs legenda). Docelowo: inicjatywy WYJĄĆ z siatki do listwy Timeline/Roadmap; cap 2 wiersze/dzień + „+N" popover; przywrócić kolory źródła (`CalendarView.tsx:331`).

**Zgodność:** §27 (Zadania/Decyzje/Inbox) — **RC-4 sticky thead złamany** na 3 tabelach (`MyTasksListContent.tsx:2173`, `DecisionsPanelContent.tsx:1873`, `InboxContent.tsx:3316` — wrapper `rounded-xl overflow-hidden`); brak persistKey szerokości kolumn (`:1467`). Korupcja „rose" nie występuje (DP-9: §27 → sweep Faza 4).

## C · DANE + API + REGUŁY (kontrakt)
- **Model danych:** `tasks`, `decisions`+`decision_history`, `calendar_events`, `notifications`/`inbox`, `focus_state`. **Maszyny stanów (`src/types/core.ts`):**
  - **TaskStatus** (`:760`): `TODO · IN_PROGRESS · BLOCKED · DONE` (UI enum); kanon serwerowy (`taskWorkflowService.ts`): `backlog · todo · in_progress · review · blocked · on_hold · done · cancelled`.
  - **DecisionStatus** (`:768`): `PENDING · APPROVED · REJECTED · ESCALATED`; workflow (`decisionWorkflowService.ts`): `proposed · review · approve · published`.
  - **NotebookPageStatus** (M04) i in. w `myWork.ts`.
- **API — enumeracja (RBAC `requireOrgAccess`/`verifyToken` + org-scope):**
  - **Inbox (`my-work.routes.ts`):** `GET /inbox` (L1465), `GET /inbox/canonical` (L2268, gate v8) + `/stats` (L2294), `POST /inbox/:id/triage` (L2039), `/bulk-triage` (L2158), `/undo-last-ai-triage` (L2121), `/materialize` (L2251), `POST /inbox/canonical/:id/delegate` (L2311, IDOR ✅ `45d74b0de1`), `/snooze` (L2344), `PATCH …/sla` (L2377), `/sla/refresh` (L2419), `/ai-assist` (L7621), `/auto-triage` (L7451), evals (golden-set/run/cost).
  - **Zadania:** `GET /tasks` (L960), `GET/POST/PUT/DELETE /personal-tasks` (L1049/1161/1312/1435), `GET /personal-tasks/:id` (L1268), `POST /tasks/ai-text` (L8239) + `tasks.routes.ts` CRUD (`GET/POST/PUT/DELETE /` + `/:id`).
  - **Decyzje (`decisions.routes.ts`, org-scope `b9f2dee9d2`):** `GET /` (L68), `GET /pending` (L142), `POST /` (L166), `GET /:id` (L210) + `/history` (L347)/`/escalation-chain` (L404)/`/escalation-log` (L461)/`/opinions` (L614)/`/stakeholders` (L637)/`/delegations` (L591), `DELETE /:id` (L282), `POST /:id/escalate` (L315)/`/manual-escalate` (L484)/`/delegate` (L519)/`/request-input` (L555)/`/stakeholders` (L660), `GET /project/:id` (L376), `GET /delegations/pending` (L816). `DecisionController.decide` (approve/reject org-scoped `:986`).
  - **Kalendarz (`my-work/calendar.routes.ts`):** `GET /calendar` · `/calendar/unified` · `/calendar/conflicts`, `POST /calendar/events`, `PATCH /calendar/events/:id/reschedule` (etag). v8 (`v8/calendar.routes.ts`): sources CRUD + sync (full/incremental/error) + items + lifecycle. OAuth: `calendarIntegrations.routes.ts` (`GET /`, `/ics`), webhook `google`/`microsoft`.
  - **Executive/Focus/Session:** `GET /executive-analytics` (L7907, **leak L-01, manager-gate tylko UI**), `GET/POST /session-context` (L8623/8571 — **odczyt martwy L-02**), `POST /focus/ai-plan` (L8464), `GET /morning-brief` (L6883), `POST /chat-actions` (L6964). `task-advisor.routes.ts` = 503 stub (L-03).
- **Reguły biznesowe:**
  - **Reguła nawigacji (#10, kanon docelowy):** generyczny handler `mywork-open-item` (`MyWorkHub.tsx:1235-1251`) dla `initiative,assessment,report,presentation,meeting,financial_model,budget,valuation,analysis,tool` robi `navigate(getArtifactPath)` → ZAWSZE przerzuca; kontrast `task,decision,idea,notification,notebook` (`:1252-1273`) otwierają **in-context** przez `handleOpenDocument`/`setNotebookOpenPageId`. Kalendarz `onInitiativeClick`→`navigate` (`:3192-3194`). **Docelowo (DP-2 IDE-tabs):** inicjatywa/notatka/zadanie → in-context; deck/doc → Canvas; ciężkie (budget/valuation/raport) → pełny moduł.
  - **Inbox:** v8 canonical → graceful 404 → legacy fallback.

## D · AI / TERESA
- Karty propozycji ← M01 Czat (`POST /chat/confirm`) → zadanie/decyzja — realne (karta §1g). AI-assist Inbox (`/inbox/ai-assist`, `/auto-triage`), AI-plan focus, tasks ai-text — realne LLM.
- **task-advisor stub (L-03):** `task-advisor.routes.ts:12-20` (mount `Gateway.ts:483`) — każdy request 503, zero konsumenta FE. Decyzja D-04: wpiąć konsumenta FE ALBO usunąć stub-mount (DP-5: ukryć za flagą + label).
- **session-context odczyt martwy (L-02):** `GET /session-context` (L8623) wykonany, ciało `if(...){}` to komentarz, wynik wyrzucany (`MyWorkHub.tsx:946-951`) → „ciągłość sesji L7" nie istnieje (D-01).

## E · INTEGRACJE — mapa połączeń
Pełna tabela: karta §1g. **←** cała apka (Inbox agreguje notifications `inbox-enterprise.routes.ts`), M13/M14/M10 (kalendarz feed task/initiative/decision + google/outlook), M04/M05-09 (ConvertTo*), M01 (karty propozycji). **→** M17 Outputs (ConvertToOutput), M13 (klik-through z kalendarza/decyzji). **Przekrój:** EventBus `mywork-open-item`.
**Delta #10 (SYSTEMOWE, klaster trzeciego panelu DP-2):** klik inicjatywy hard-nawiguje (asymetria z task/decision in-context) → przepiąć `initiative` (+ wybrane typy) na `handleOpenDocument`/dynamiczną zakładkę. Konwerguje z #1/#6/#7/#13.

## F · EPIKI → STORIES → ZADANIA
**EPIK 1 — Integralność (P0, DONE):** cross-org decyzje `b9f2dee9d2`; inbox IDOR `45d74b0de1`; linkowanie decyzji mock→real `f35aa8d7c8`.

**EPIK 2 — Crash landing (#5, P1 TOP) [L-06]:**
- Story 2.1: jako user chcę otworzyć My Work bez crasha. *Dane:* zalogowany member. *Gdy:* wchodzę na `/my-work`. *Wtedy:* widzę Inbox, ZERO error-boundary. → Z: złapać stack-trace (telemetria/preview console) → naprawić render-time wyjątek.

**EPIK 3 — Domknięcie wartości (P1) [L-01/L-02/L-04]:**
- Story 3.1: *Dane:* member (nie manager). *Gdy:* GET `/executive-analytics`. *Wtedy:* 403 (role-guard serwerowy). Story 3.2: session-context wpiąć/usunąć (D-01). Story 3.3: *Gdy:* `CalendarCreateEventModal` submit. *Wtedy:* event powstaje (3/4 FAIL→0, S5) + drag-reschedule etag/412.

**EPIK 4 — Kalendarz connect + sprzątanie (#9/#11, P2) [L-07/L-09]:**
- Story 4.1: *Dane:* kalendarz, Google „Not connected". *Gdy:* klikam „Podłącz w Integracjach". *Wtedy:* nawiguję do `IntegrationsModule` → OAuth-connect → źródło `isAvailable`. Story 4.2: *Gdy:* Month z wielodniowymi inicjatywami. *Wtedy:* listwa Timeline/Roadmap + kolory źródła + cap 2/dzień+„+N".

**EPIK 5 — In-context open (#10, P1-design) [L-08]:**
- Story 5.1: *Dane:* kalendarz/lista. *Gdy:* klikam inicjatywę. *Wtedy:* karta w trzecim panelu bieżącego widoku (NIE hard-nav). → Z (DP-2 IDE-tabs, D-02): `initiative`→`handleOpenDocument`.

**EPIK 6 — Szlif kanonu (P2/P4) [L-10/L-11]:** RC-4 sticky thead (3 tabele) + persistKey kolumn; wycięcie ~15 martwych (NIE NudgeStrip); task-advisor (L-03); Decyzje Archive/Delay; i18n 2888; ≥1 E2E→PR-gate+`Londyn`.

## G · JAKOŚĆ / WERYFIKACJA
| # | Kryterium | Miara M03 (grep 2026-06-13) |
|---|-----------|-----------|
| 1 | Front↔back | 0 crashy na landing (#5); session-context+task-advisor wpięte/usunięte; `CalendarCreateEventModal` działa; kalendarz Connect actionable (#9); 0 martwych CTA |
| 2 | Bezpieczeństwo | cross-org decyzje+inbox ✅ `b9f2dee9d2`/`45d74b0de1`; leak executive-analytics zamknięty role-guardem serwerowym (member→403, test — R3: karta mówi `d05382fb44`, **zweryfikować że `requireRole` wpięte na `:7907`**) |
| 3 | i18n | 0 z **2888** inline (`i18n.language==='pl'`/`isPolish`) w `src/components/MyWork/` *(grep potwierdzony)* + fix mock `{defaultValue}` |
| 4 | Tokeny | z **823** hex w `src/components/MyWork/` (zweryfikować ile = legalne kolory kalendarza/wykresów vs hardkod); kolory źródła kalendarza przywrócone (#11) |
| 5 | §27 | RC-4 sticky thead naprawione (3 tabele); szerokości kolumn trwałe; **24** surowych `<table>` → FilterableTable (DP-9 sweep) *(grep potwierdzony)* |
| 6 | E2E w PR-gate | ≥1 funkcjonalny flow (task/decision/calendar) zielony na `Londyn` (dziś 0 — „Deferred outside main/develop") |

**Scenariusze S1–S6** (karta §0): S1 inbox triage→reload (brak testu trwałości); S2 task inline+Kanban DnD (brak); S3 link decyzji (✅ `f35aa8d7c8`); S4 decyzja approve/reject (OK BE); S5 kalendarz feed+reschedule (create-event FAIL 3/4); S6 manager inline approve (race FAIL). **Pułapka CI:** joby „Deferred outside main/develop" → na `feat/*` NIE biegną; E2E tylko weekly, smoke nightly. Bezpieczeństwo: karta §6 (11/14 scoped; Manager bez `requireRole`).

## H · GOVERNANCE / STEROWANIE

### 01 · Rejestr wejść (R1)
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §1–§7 | 2026-06-11 | rdzeń realny; cross-org naprawione; leak + martwe stuby | L-01,02,03,04,05 |
| W-02 | **Uwaga żywa #5** | 2026-06-13 | crash „Coś poszło nie tak" na My Work (P1) | L-06 |
| W-03 | **Uwaga żywa #9** | 2026-06-13 | kalendarz „Connect in Integrations" martwy (P2) | L-07 |
| W-04 | **Uwaga żywa #10** | 2026-06-13 | otwarcie inicjatywy hard-nawiguje (P1 SYSTEMOWE) | L-08 (D-02) |
| W-05 | **Uwaga żywa #11** | 2026-06-13 | paski multi-day przytłaczają + gubią kolor źródła (P2) | L-09 |
| W-06 | Karta §5 (§27 RC-4) | 2026-06-11 | sticky thead złamany + brak persistKey | L-10 |
| W-07 | `_DECYZJE.md` DP-2 (trzeci panel IDE-tabs) + DP-5/DP-9 | 2026-06-13 | #10 in-context; stuby; §27 sweep | L-08,L-03,L-10 |
| W-08 | Feedback prod (`finding_railway_db_topology`) | — | dev `.env` → Railway PROD DB | ryzyko |

### 02 · Stan obecny (prawda kodu) — karta §1 (REALNE ~14 · MOCK/STUB 2 · MARTWE 15+ · UKRYTE 4). Naprawione: `b9f2dee9d2` (decyzje), `45d74b0de1` (inbox IDOR), `f35aa8d7c8` (linkowanie decyzji), `d05382fb44` (executive role-guard + 15 dead components), `7ab1b8aace` (cross-org testy + CI gate).

### 03 · Rejestr luk (= docelowy − obecny)
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | Status |
|----|------|---------|--------------------|-------|------|--------|
| L-01 | leak executive-analytics (manager-gate tylko UI) | W-01 | `my-work.routes.ts:7907` | P1 | 2 | **ZAMKNIĘTA `36deb2708c` (2026-06-17)** — `requireRole('ADMIN','MANAGER','OWNER','SUPERADMIN')` wpięte na route (`:7965`, member→403 serwerowo, zweryfikowane w kodzie). Bonus: stale komentarz beta-gating `MyWorkHub.tsx:607` (mówił `BETA_ADMINS_EXEMPT=false`/„everyone blocked" — nieprawda, jest `true`+MYWORK_IDEAS=`open`) poprawiony; test `betaAccessGating.test.ts` (4/4, CI-gated) |
| L-02 | session-context odczyt = martwy stub | W-01 | `MyWorkHub.tsx:946-951`, `GET /session-context:8623` | P1 | 2 | **ZAMKNIĘTA `1c2d6ac279` (2026-06-17, D-01)** — feature był write-only (POST co 5s, ZERO konsumenta GET w FE → brak ciągłości); ciągłość już przez localStorage (`readStoredMyWorkDocuments`). Martwy zapis USUNIĘTY (nie półwpinano serwerowego odczytu) |
| L-03 | task-advisor stub 503, 0 konsumenta FE | W-01 | `task-advisor.routes.ts:12-20`, `Gateway.ts:483` | P1 | 3 | **INERT — FALSE POSITIVE user-impact (2026-06-17)**: 0 konsumenta FE (grep `task-advisor` w `src/`=0) → brak martwego CTA, brak surface'u dla użytkownika. Mount = backend-only 503, nieszkodliwy. Usunięcie mountu = edycja współdzielonego `Gateway.ts` (ryzyko wyścigu) → odroczone, zero user-impact |
| L-04 | `CalendarCreateEventModal` 3/4 FAIL (S5) | W-01 | onSubmit/conflict callbacks | P0-test | 2 | **ZAMKNIĘTA (zweryf. 2026-06-17)** — `tests/components/MyWork/CalendarCreateEventModal.test.tsx` 4/4 PASS (tworzenie task-backed eventu + callbacki hosta + submit z pola tytułu + bounded warning), CI-gated (`tests/components`). „3/4 FAIL" nieaktualne |
| L-05 | ~15 martwych komponentów (łańcuch WorkCenter; NIE NudgeStrip) | W-01 | f1_code_truth | P2 | 3 | **ZAMKNIĘTA `de3eccbdd0` (2026-06-17)** — łańcuch WorkCenter już usunięty (`d05382fb44`); skan MyWork wykrył 1 pozostały orphan `FocusCockpit.tsx` (390 lin, 0 ref) → USUNIĘTY. NudgeStrip = żywy (zachowany) |
| L-06 | crash render-time na landing My Work | W-02 | `src/components/shared/PreviewPane/PreviewRelations.tsx:37` — `RelationChip` | P1 | 1 | **✅ ZAMKNIĘTA 2026-06-16** — fix `$$typeof` check w `RelationChip` |
| L-07 | kalendarz Connect martwy CTA + OAuth niedopięty | W-03,W-07 | `CalendarSidebar.tsx:60,62-67,169-194` (navigate→/settings/integrations); `calendarIntegrations.routes.ts:7,26` „not available yet"; OAuth env `Config.ts:35-36,49-50` + `ConfigValidator.ts:149,167` | P2 | 2/3 | **CZĘŚCIOWO ZAMKNIĘTA — CTA done, OAuth blocked-on-env (R3 2026-06-17, H2)**. CTA: ZAMKNIĘTA — `toggleSource` deep-linkuje niedostępne źródła zewn. (`google`/`outlook`) do `/settings/integrations` (`useNavigate`, commit `952f309eed`, zweryf. w kodzie); test `tests/components/MyWork/CalendarSidebar.availability.test.tsx` naprawiony RED→GREEN (Router wrapper + asercja `navigate('/settings/integrations')`), 4/4 PASS CI-gated. OAuth backend: **BLOCKED-ON-ENV (deploy-time)** — wymaga `GOOGLE_CLIENT_ID/SECRET` + `MICROSOFT_CLIENT_ID/SECRET` (+ `GOOGLE/MICROSOFT_CALLBACK_URL`) na Railway; zgoda Piotra (prod=centerbeam). |
| L-08 | initiative hard-nawiguje (in-context open) | W-04,W-07 | `MyWorkHub.tsx:1235-1251,3192-3194` | P1-design | 0.4 | **ZAMKNIĘTA (2026-06-17, D-02/DP-2)** — `initiative` wyjęte z listy hard-`navigate()` w handlerze `mywork-open-item` → otwiera się IN-CONTEXT przez `handleOpenDocument` (dynamiczna zakładka IDE), tak jak `task`/`decision`. Renderuje `InitiativeFullView` (self-fetch po `initiativeId`, ten sam widok co moduł M13) w panelu dokumentu; host-tab = `tasks`. Kalendarz `onInitiativeClick` przepięty z `navigate(getArtifactPath)` na nowy `handleInitiativeClick` (in-context). Ciężkie typy (report/presentation→Canvas, budget/valuation→pełny moduł) nadal nawigują. SSOT routingu wyekstrahowany do `src/components/MyWork/openItemRouting.ts` (`resolveOpenItemRoute`). Test `tests/unit/myWorkOpenItemRouting.test.ts` 6/6 PASS (CI-gated `tests/unit`): asercja initiative→in-context (NIE navigate) + ciężkie→navigate + brak overlapu zbiorów. Pliki: `MyWorkHub.tsx` (OpenDocument.type +`initiative`, isOpenDocument, getDocumentTab→tasks, lazy `InitiativeFullView`, render-case, tab-strip Rocket-ikona, handler) + nowy `openItemRouting.ts` |
| L-09 | paski multi-day + utrata koloru źródła | W-05 | `CalendarView.tsx:331` (nieaktualne — patrz niżej) | P2-design | 4 | **ODROCZONA — D-03 design (2026-06-17, weryfikacja kodu)**: utrata koloru źródła JUŻ NIE WYSTĘPUJE — stary ręcznie-renderowany grid Month (`CalendarView.tsx:331`) zastąpiony FullCalendar (`CalendarGrid.tsx`); paski multi-day dziedziczą `backgroundColor: SOURCE_COLORS[e.source]` (`CalendarGrid.tsx:84`, kolory distinct: task `#2563eb`/initiative `#A51C30`/decision `#d97706`/google/outlook). „Wszystko fioletowe" = override CSS dla `status="ai_suggestion"` (`calendar-theme.css:176-187`, `#7c3aed`) — celowy, nie source-loss. **Color-loss zamknięty migracją do FullCalendar.** Pozostaje wyłącznie decyzja design D-03 (cap 2/dzień+„+N" vs listwa Timeline/Roadmap) = modułowa decyzja Piotra → rebuild renderu po decyzji + R6. Brak LOW-RISK fixu do dołożenia (kod kolorów już poprawny) |
| L-10 | RC-4 sticky thead + brak persistKey (3 tabele) | W-06,W-07 | `MyTasksListContent.tsx:2173,1467`, `DecisionsPanelContent.tsx:1873`, `InboxContent.tsx:3316` | P1 | 4 | **ZAMKNIĘTA `d03c0bc37f` (2026-06-17)** — sticky thead `overflow-hidden` usunięte (`952f309eed`) + persistKey: nowy hook `usePersistedColumnWidths` (hydrate/persist do localStorage per-tabela) wpięty w Tasks/Decisions/Inbox; test `usePersistedColumnWidths.test.ts` (4/4, CI-gated) |
| L-11 | i18n inline 2888× | W-01 | `src/components/MyWork/` | P1 | 4 | **ODROCZONA — FAZA 4 SWEEP (2026-06-17)**: 2888 inline `isPolish`/ternary to mechaniczny sweep i18n na ~całym module (nie correctness-bug; UI działa dwujęzycznie przez inline). Wymaga dedykowanej fali FAZA-4 + koordynacji z `public/locales/*` (ZAKAZANE dla agenta bez zgody) → osobny pass |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | session-context (L-02): wpiąć czy usunąć? | wpiąć do promptu / usunąć martwy GET | Piotr | TBD | otwarta (modułowa — przy wejściu w moduł) |
| D-02 | #10 które z 10 typów otwierać in-context? | initiative+wybrane in-context / report/presentation→Canvas / budget/valuation→pełny moduł | Piotr | TBD | **ROZSTRZYGNIĘTE → DP-2: globalny dok IDE-tabs (init/notatka/zadanie in-context; deck/doc→Canvas; ciężkie→pełny moduł)** |
| D-03 | #11 Month domyślny lekki + osobny Timeline/Roadmap? | listwa nad gridem / cienki brzeg w komórce | Piotr | TBD | otwarta (modułowa — przy wejściu w moduł) |
| D-04 | task-advisor + Decyzje Archive/Delay: dopiąć czy ukryć? | dopiąć BE / ukryć (DP-5) | Piotr | TBD | **ROZSTRZYGNIĘTE → DP-5: ukryj za flagą + label „wkrótce"** |

### 05 · Flagi / rollout / beta — `RADAR_ENABLED=false` (Home/Radar ukryte); `ENABLE_V8_GLOBAL` (inbox kanoniczny 404→legacy graceful); `MYWORK_IDEAS` beta closed (też admin — komentarz `MyWorkHub.tsx:604` mylący `BETA_ADMINS_EXEMPT=false`). Organizer core otwarty.
### 06 · Ryzyka i założenia — L-06 crash bez stack-trace → najpierw repro/telemetria (R3: nie kwalifikować przyczyny bez dowodu). L-01 leak: karta `d05382fb44` → zweryfikować że `requireRole` wpięte (member→403 test). #9 OAuth wymaga env `GOOGLE_CLIENT_ID/SECRET`, `MICROSOFT_CLIENT_ID/SECRET` na Railway. Dev `.env` → Railway PROD DB.
### 07 · Log + re-ocena — 2026-06-13: 4 uwagi żywe zalogowane (#5/#9/#10/#11); teczka pogłębiona do M13-level. Audyt 2026-06-11: 54/100. 2026-06-17 (Harvard 2): L-01 ZAMKNIĘTA (`36deb2708c` — requireRole zweryf. + beta comment + test); L-02 ZAMKNIĘTA (`1c2d6ac279` — dead write removed); L-04 ZAMKNIĘTA (4/4 test CI-gated); L-05 ZAMKNIĘTA (`de3eccbdd0` — FocusCockpit orphan); L-10 ZAMKNIĘTA (`d03c0bc37f` — persistKey hook+test); L-06 już zamknięta (`$$typeof` 2026-06-16); L-03 INERT (0 user-impact); L-07 częściowa (OAuth=deploy-time env Railway); **L-08 ZAMKNIĘTA (initiative→in-context przez `handleOpenDocument`+`InitiativeFullView`; SSOT `openItemRouting.ts`; test 6/6 CI-gated)**; L-09 ODROCZONA D-03 (color-loss zamknięty migracją FullCalendar — zostaje tylko decyzja design Timeline vs cap); L-11 i18n FAZA-4 sweep (odroczona). **Wszystkie luki P0/P1 funkcjonalne+security ZAMKNIĘTE (w tym L-08 in-context open); pozostałe = decyzja design D-03 (Month cap/Timeline), sweep i18n FAZA-4, deploy-time OAuth.** Re-ocena po sesji żywej (R6).

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia pełne (karta + 4 uwagi żywe #5/#9/#10/#11 + §27 + DP-2/DP-5/DP-9 + feedback prod) · R2 zero sierot (W→L→DoD) · R3 L-06 „przyczyna NIEustalona" + L-01 „zweryfikować fix" (nie dziedziczone) · R4 DoD z liczbami grep (2888 i18n · 24 table · 823 hex) · R5 decyzje rozstrzygnięte (D-02=DP-2, D-04=DP-5; D-01/D-03 modułowe) · A–E docelowy z 5 powierzchniami+stanami+enumeracją endpointów+maszyny stanów · F epiki↔stories↔Gherkin↔luki · G DoD+S+sec · R6 sesja żywa = Faza 4. **Teczka kompletna do egzekucji.**
