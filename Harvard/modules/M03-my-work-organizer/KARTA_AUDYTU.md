# M03 — Moja Praca (organizer) — Karta audytu (Protokół V1)

**Data:** 2026-06-11 · **Branch:** `feat/deliverables-light` (commit `ee4319b076`) · **Audytor:** Claude + agenci (KOD/TESTY/KANON+SEC)
**Wejścia:** _MODULE_MAP_V2 wpis M03 · inwentarz `Harvard/podzial/inventory/INV_B_my-work.md` (sekcje 1,3-10; bez Notatnika=M04 i Ideas=M05-09) · poprzednia karta `docs/audit/2026-06-02/MODULE_02` (57/100)
**Evidence:** `Harvard/modules/M03-my-work-organizer/evidence/` (f1_code_truth.md, f2_tests_report.md, f2_tests.log, f56_kanon_sec.md)

## OCENA: 54/100 — Tier: Alpha · status 🟦 NIEPEŁNY (Fazy 3+4 do wykonania)
> **Re-audit 2026-06-11 po Sprintach 1–5:** F: 2→7 (W1 DecisionController+inbox org-scope naprawiony, commit `b9f2dee9d2`, hard cap zdjęty); C: 7→8 (W15 CI gate + kontraktowe testy cross-org, commit `7ab1b8aace`). **Fala 2 (pominięte w re-audycie):** A: 19→21 (W6 decision linking mock→real fetch `f35aa8d7c8` +1; 15 dead components deleted `d05382fb44` +1); F: 7→9 (inbox canonical IDOR `45d74b0de1` +1; executive-analytics server role-guard `d05382fb44` +1). Suma: 54.

| Wymiar | Waga | Punkty | Uzasadnienie (1 zdanie) |
|---|---|---|---|
| A. Realność funkcji | 25 | 21 | Inbox/Kalendarz/Zadania/Decyzje/Manager realne; decision linking mock→real (`f35aa8d7c8`); 15 dead components deleted (`d05382fb44`); pozostałe: session-context + task-advisor stuby. |
| B. Wiring i dane | 15 | 10 | Inbox ma graceful fallback v8→legacy, CRUD wpięte, ale odczyt session-context to martwy stub + cross-org gapy. |
| C. Testy automatyczne | 15 | 8 | 595 PASS / 19 FAIL; +1 W15 CI gate na Londyn + kontraktowe testy cross-org (W1, commit `7ab1b8aace`). |
| D. Żywa użyteczność | 15 | 0 | Faza 4 niewykonana. |
| E. Kanony/UI | 10 | 6 | §27 w większości spełnione, ale RC-4 (sticky thead łamany przez `overflow-hidden`) na wszystkich 3 tabelach + szerokości kolumn nieperzystowane. |
| F. Bezpieczeństwo/dostęp | 10 | 9 | W1 DecisionController+inbox org-scope (`b9f2dee9d2`); inbox canonical IDOR NAPRAWIONE (`45d74b0de1` — delegate/snooze/SLA 2-step org-verify); executive-analytics server role-guard NAPRAWIONE (`d05382fb44`); W7 beta-lock 3-warstwowy; pozostałe: pilot gating tylko klient (P2). |
| G. Środowiska (Railway) | 10 | 0 | Faza 3 niewykonana. |
| **Hard cap zastosowany?** | — | — | **NIE — cross-org P0 naprawiony (W1, commit `b9f2dee9d2`), hard cap zdjęty.** Suma surowa 50 < 70 (Faza 4 niewykonana). |

**Werdykt jednym akapitem:** Organizer to najbardziej rozbudowany moduł aplikacji — Inbox (triage v8 z uczciwym fallbackiem do legacy), Kalendarz (unified feed + drag-reschedule), Zadania (tabela+Kanban+detal 6.5k linii), Decyzje, Manager — wszystko zasadniczo realne i wpięte. Tier ciągnie w dół pięć rzeczy: **P0 widoczne-ale-zepsute** (linkowanie decyzji z zadania operuje na 4 zaszytych mockach `dec-1..dec-4` bez fetcha), **dwa cross-org IDOR-y na zapisie** (admin może zatwierdzić decyzję cudzej org; każdy może snooze/delegować element inboxa cudzej org), brak jakiegokolwiek funkcjonalnego E2E w PR-gate, kanon RC-4 (sticky thead) złamany na wszystkich trzech tabelach, oraz ~15 martwych komponentów. Gating Managera jest wyłącznie kosmetyczny (UI), bez egzekucji serwerowej.

---

## 0. Zakres i scenariusze krytyczne (FAZA 0)
**Checklist:** sekcje INV_B 1,3,4,5,6,7,8,9,10 (organizer). Sekcja 2 (Notatnik) = M04; Ideas = M05-09.
**Scenariusze krytyczne (6):**
1. **S1** — Inbox (landing) → quick action (Focus Dziś/Done/Snooze) → reload → stan trwały.
2. **S2** — Zadanie: create → status/priorytet inline (tabela) + Kanban DnD → reload → trwałość.
3. **S3** — Zadanie → linkowanie decyzji (znany WIDOCZNE-ALE-ZEPSUTE: 4 mocki).
4. **S4** — Decyzja approve/reject → trwałość.
5. **S5** — Kalendarz: unified feed (task/initiative/decision) + drag-reschedule (PATCH etag).
6. **S6** — Manager (rola admin) → decision queue inline approve.
**Obowiązujące kanony:** §27 dla tabel **Zadania / Decyzje / Inbox** · CARD_CONTENT_FORMULA: NIE · wzorzec hubowy: `MyWorkHub` (Menu 1/2/3, dynamic tabs) ~ModuleHub · beta-gating: Ideas closed (osobne moduły), organizer otwarty.

## 1. Prawda kodu (FAZA 1)
> Pełny raport: `evidence/f1_code_truth.md`. Zbiorczo: **REALNE ~14 obszarów · MOCK/STUB 3 · ZEPSUTE 1+komentarz · UKRYTE 4 · MARTWE 15+.**

### 1a. REALNE
- Inbox (triage, quick actions, bulk, skróty J/K/T/W/E/B/A/X, presety z licznikami), Kalendarz (unified feed, drag-reschedule etag), Zadania (tabela+Kanban+detal), Decyzje (approve/reject/escalate), Manager/Executive, EventBus `mywork-open-item`, ConvertToOutput, focus-zapis, inbox-v4 API.

### 1b. MOCK / STUB / fabrykowane klientem
- **[P0] `TaskDetailView.tsx:318-325`** — `availableDecisions` = 4 zaszyte (`dec-1..dec-4`); `setAvailableDecisions` woła się tylko lokalnie (`:5407`), **zero fetcha z BE**; picker (`:5487,:5533`) operuje na fikcji.
- **[P1] session-context odczyt** (`MyWorkHub.tsx:946-951`) — GET wykonany, ciało `if(...){}` to tylko komentarz, wynik wyrzucany → „ciągłość sesji L7" po stronie odczytu nie istnieje.
- **[P1] task-advisor** (`task-advisor.routes.ts:12-20`, mount `Gateway.ts:483`) — każdy request 503, zero konsumenta FE.

### 1c. ZEPSUTE / WIDOCZNE-ALE-ZEPSUTE
- Linkowanie decyzji z zadania (1b P0) — UI w pełni wyrenderowane na danych-atrapach.
- **[P1] mylący komentarz beta** `MyWorkHub.tsx:604-605` „Admins keep access" sprzeczny z runtime (`betaAccess.ts:71` zwraca `true` dla wszystkich, `BETA_ADMINS_EXEMPT=false:32`) → Ideas zablokowane też adminom.

### 1d. UKRYTE / MARTWY KOD
- **UKRYTE-celowo (zostaw):** HomeView/Radar (`RADAR_ENABLED=false` `MyWorkHub.tsx:189`, render nieosiągalny `:3155`), FocusView (lazy, brak JSX), DecisionsTimelineView (`:3357` wyłączony), handleHomeAction. Backendy radar/home/focus zamontowane i żywe.
- **MARTWE (wytnij):** łańcuch WorkCenter (+MyProjects/PillNavigation/QuickFilterBar/WorkSidebar/DecisionsPanel/DecisionsList/DecisionBottleneckPanel), WorkloadView, TodayDashboard, ProgressView, FocusCockpit, NotificationsHub/Content/Kanban, TaskInbox, ConvertToMenu, KnowledgePulse, InsertMenu, Focus/*. **UWAGA:** `NudgeStrip` żywy w Ideas — NIE wycinać.

### 1e. Wiring FE↔BE↔DB
| Funkcja | Endpoint | Tabela DB | Migracja | Status |
|---|---|---|---|---|
| Inbox kanoniczny | `GET /api/v8/my-work/inbox/canonical` (gate) → fallback `/my-work/inbox` | notifications, inbox | tak | DZIAŁA (graceful 404→legacy) |
| Zadania CRUD | `/my-work/personal-tasks` + `tasks.routes.ts` | tasks | tak | DZIAŁA |
| Linkowanie decyzji z zadania | — (brak fetcha) | — | — | **ZEPSUTE — mock** |
| Decyzje decide | `DecisionController.decide` | decisions, decision_history | tak | DZIAŁA, ale **bez org-scope (P0)** |
| Kalendarz | `GET /my-work/calendar/unified` + calendarIntegrations | calendar_events | tak | DZIAŁA |
| Executive | `GET /my-work/executive-analytics` | wiele | tak | DZIAŁA, ale **leak (P1)** |
| Focus | `focus.routes.ts` | focus_state | tak | DZIAŁA (zapis) / UKRYTE (odczyt) |

### 1f. Flagi
| Flaga | Default BE | Default FE | Kto włącza | Wpływ |
|---|---|---|---|---|
| `RADAR_ENABLED` | `false` (`MyWorkHub.tsx:189`) | — | kod (compile) | Home/Radar ukryte, fallback inbox |
| `ENABLE_V8_GLOBAL` | OFF | — | env | inbox kanoniczny 404 → legacy (graceful) |
| `MYWORK_IDEAS` beta | `'closed'`, `BETA_ADMINS_EXEMPT=false` | — | betaAccess | Ideas blokowane dla wszystkich (też admin) |

### 1g. Połączenia międzymodułowe
| Kierunek | Moduł | Mechanizm | Plik:linia | Status |
|---|---|---|---|---|
| WEJŚCIE ← | cała apka | Inbox agreguje powiadomienia (notifications) | `inbox-enterprise.routes.ts` | DZIAŁA |
| WEJŚCIE ← | M13/M14/M10 | Kalendarz feed: task/initiative/decision + google/outlook | `/my-work/calendar/unified` | DZIAŁA |
| WEJŚCIE ← | M04 Notatnik / M05-09 Ideas | ConvertTo* (→zadanie/decyzja) | sekcja 9 poz.8 | DZIAŁA (z Notatnika/Ideas) |
| WYJŚCIE → | M17 Outputs | ConvertToOutput / handoff | sekcja 9 | DZIAŁA |
| WYJŚCIE → | M13 Inicjatywy | klik-through z kalendarza/decyzji | sekcja 4 poz.8 | DZIAŁA |
| WEJŚCIE ← | M01 Czat | karty propozycji → zadanie/decyzja (`/chat/confirm`) | INV_A poz.30 | DZIAŁA |
| przekrój | EventBus | `mywork-open-item` + odświeżanie | sekcja 9 poz.4 | DZIAŁA |

## 2. Testy automatyczne (FAZA 2)
> Raport: `evidence/f2_tests_report.md` · log: `f2_tests.log`.
**Uruchomienie (vitest, 4 batche, @ `ee4319b076`):** **595 PASS / 19 FAIL / 5 SKIP** (619 testów, 55 plików; Ideas+Notatnik wykluczone).
- FE component 123/3 — `CalendarCreateEventModal` 3/4 FAIL (onSubmit/conflict callbacks nie wołane — S5).
- unit+BE(sqlite) 218/10 — `DecisionsList`+`MyTasksList` unit FAIL na mocku i18n (harness, nie produkt).
- server route/service **156/0** ✅ (calendar-interop, myWorkRoofService, v8 inbox/calendar).
- integracja na realnym Postgresie **98/6/5** — faily = dryf schematu (`user_sessions` brak) + stuby kontraktowe; **rdzeń M03 przechodzi** (inbox-triage, decisions, calendar-interop, tasks CRUD).

**Pokrycie scenariuszy:**
| Scenariusz | FE | BE | E2E | CI (PR-gate) | Luka |
|---|---|---|---|---|---|
| S1 inbox triage→reload | częśc. | ✓ | smoke (nightly) | ✗ | brak testu trwałości po reload |
| S2 task inline+Kanban DnD | ✗ | ✓ | weekly | ✗ | brak inline-edit/DnD-persist |
| S3 link decyzji | ✗ | ✗ | ✗ | ✗ | **BRAK + ZEPSUTE** (mock) |
| S4 decyzja approve/reject | ✓ | ✓ | weekly | ✗ | OK na BE |
| S5 kalendarz feed+reschedule | FAIL | ✓ | weekly | ✗ | create-event FE FAIL |
| S6 manager inline approve | render-only | częśc. | ✗ | ✗ | concurrent-approval FAIL |

**Pułapka CI (poważna):** joby unit/component/integration/e2e są **„Deferred outside main/develop"** → na PR-ach `feat/*` (jak bieżący) **nie biegną wcale**. Funkcjonalne E2E M03 (task-management-flow, decision-management, calendar-management) tylko w **weekly**; smoke w **nightly** — nigdy nie blokuje PR.

**Backlog testowy:**
1. [P0] integration/E2E — linkowanie decyzji (S3) po naprawie mocka.
2. [P0] component — fix `CalendarCreateEventModal` (S5).
3. [P1] E2E — trwałość-po-reload inbox (S1), inline-edit + Kanban DnD (S2), drag-reschedule etag/412 (S5), inline-approve+race manager (S6).
4. [P1] CI — promować ≥1 funkcjonalny E2E M03 do nightly/tier0 (dziś zero w PR-gate).
5. [P2] fix mock i18n w unit (`{defaultValue}` jako React child).

## 3. Środowiska / Railway (FAZA 3)
**Status: NIEWYKONANE (PENDING).** Do zrobienia: smoke `/my-work/inbox`, `/my-work/calendar/unified`, `/my-work/personal-tasks`, `DecisionController.decide`, executive-analytics; weryfikacja migracji (tasks/decisions/calendar/focus/notifications) + flag (`ENABLE_V8_GLOBAL`) na staging/prod; logi 24-48h.
| Aspekt | Staging | Prod | Werdykt |
|---|---|---|---|
| Wdrożony commit / migracje / flagi / smoke / logi | — | — | PENDING |

## 4. Żywa weryfikacja frontu (FAZA 4 — Claude osobiście)
**Status: NIEWYKONANE (PENDING).** Preview działa. Do przejścia 6 scenariuszy z reloadem + przyciski-zawsze-błąd + stany + i18n PL↔EN + rola MEMBER (i osobno admin dla S6) + konsola/sieć. Bez tego D=0. **Uwaga DB:** `.env`→Railway zdalna; tylko dane jednorazowe.
| # | Scenariusz | Wynik | Dowód |
|---|---|---|---|
| S1–S6 | — | PENDING | evidence/f4_* |

## 5. Kanony i standardy (FAZA 5)
> Raport: `evidence/f56_kanon_sec.md`.
**§27 (Zadania / Decyzje / Inbox):** zasadniczo zgodne (preview, filtry kolumn, sort, kebab 3-strefy, EntityStatusChip, jeden DueChip, wyrównanie wg roli, empty/loading/error z retry). **Odstępstwa:**
- **[P1] RC-4** na wszystkich 3 tabelach — wrapper `rounded-xl overflow-hidden` nad sticky `<thead>` (`MyTasksListContent.tsx:2173`, `DecisionsPanelContent.tsx:1873`, `InboxContent.tsx:3316`) → łamie `position:sticky`.
- **[P1] brak persistencji szerokości kolumn** (Zadania+Decyzje) — `handleColumnResize` trzyma szerokości tylko w stanie React (`MyTasksListContent.tsx:1467`); giną po reloadzie.
- **[P2]** Archive/Delay disabled „Wkrótce backend" dla Decyzji (§14 lifecycle).
**Wzorzec hubowy:** `MyWorkHub` zgodny (Menu 1/2/3, dynamic tabs). **i18n:** brak korupcji „rose"/„roseuction" (wszystkie `rose-*` = legalny Tailwind).

## 6. Bezpieczeństwo i dostęp (FAZA 6)
> Raport: `evidence/f56_kanon_sec.md`. **14 endpointów sprawdzonych, 11 scoped, 3 rodziny bez scope zasobu.**
| Warstwa | Nawigacja | Route | API | Dziura? |
|---|---|---|---|---|
| Organizer (core) | sidebar otwarty | zalogowany | requireOrgAccess (waliduje usera) | — |
| Manager | sidebar admin/manager | brak role-guard | **brak `requireRole` (UI-only)** | **TAK (P1)** |
| Decyzje decide | — | — | bez org-scope | **TAK (P0)** |

**Findingi:**
- **[P0] F-SEC-2 cross-org IDOR write decyzji** — `DecisionController.decide` (`DecisionController.ts:985` SELECT, `:1012` UPDATE) `WHERE id=?` bez `organization_id`; check własności (`:994-1001`) przepuszcza ADMIN/SUPERADMIN → admin org A zatwierdza/odrzuca decyzję org B. Zweryfikowane osobiście (Claude).
- **[P0/P1] F-SEC-3 cross-org IDOR inbox** — `inboxService.triageItem`/`delegateItem` (`inboxService.ts:332,351`) `WHERE id=?` bez org/user → dowolny user snooze/SLA/deleguje element inboxa dowolnej org (delegate klonuje do arbitralnego `toUserId`).
- **[P1] F-SEC-1 leak executive-analytics** — `GET /my-work/executive-analytics` (`my-work.routes.ts:7832`) zwraca portfel całej org (overload alerts z imionami+godzinami per-pracownik) KAŻDEMU członkowi; manager-gate tylko UI.
- **[P3]** email logowany `my-work.routes.ts:619`.

## 7. PLAN DOKOŃCZENIA (FAZA 8)
### Fala 1 — Integralność (P0)
1. **Org-scope na `DecisionController.decide`** — dodać `organization_id` do SELECT/UPDATE + weryfikacja przynależności decyzji do org callera — Weryfikacja: test cross-org (admin org-A nie zatwierdzi decyzji org-B → 404/403).
2. **Org/owner-scope na inbox triage/delegate** (`inboxService.triageItem/delegateItem`) — `WHERE id=? AND organization_id=?` + walidacja `toUserId` w tej samej org — Weryfikacja: test cross-org snooze/delegate → odmowa.
3. **Naprawa linkowania decyzji z zadania** — zastąpić 4 mocki `TaskDetailView.tsx:318-325` realnym fetchem decyzji (org-scoped) — Weryfikacja: picker pokazuje realne decyzje; test integracyjny.

### Fala 2 — Domknięcie wartości (P1)
1. **Role-guard serwerowy Managera** — `requireRole(admin/manager)` na `/executive-analytics` i akcjach managerskich — Weryfikacja: member → 403.
2. **Domknięcie session-context (L7) odczytu** — albo wpiąć wynik do promptu, albo usunąć martwy GET — Weryfikacja: odczyt wpływa na zachowanie LUB usunięty.
3. **Fix `CalendarCreateEventModal`** (S5) + drag-reschedule etag — Weryfikacja: testy zielone, event trwały po reloadzie.
4. **RC-4 sticky thead** na 3 tabelach + persistencja szerokości kolumn — Weryfikacja: thead sticky przy scrollu, szerokości trwałe po reloadzie.
5. **Promocja ≥1 E2E M03 do PR-gate** — Weryfikacja: PR uruchamia task/decision flow.

### Fala 3 — Jakość i kanony (P2)
1. **Wycięcie ~15 martwych komponentów** (łańcuch WorkCenter + sieroty; NIE NudgeStrip) — Weryfikacja: build zielony, 0 referencji.
2. **task-advisor** — wpiąć konsumenta FE albo usunąć stub-mount — Weryfikacja: brak 503-only endpointu.
3. **Decyzje Archive/Delay** (§14) — dokończyć backend lifecycle — Weryfikacja: akcje aktywne.
4. **Poprawić komentarz beta** `MyWorkHub.tsx:604` + fix mock i18n w unit.

### Definition of Done (odhaczane przy realizacji)
- [ ] 1. Testy auto FE+BE scenariuszy krytycznych zielone w CI
- [ ] 2. Żywa weryfikacja Claude'a: pełny skrypt Fazy 4 PASS z dowodami
- [ ] 3. Railway: migracje + flagi + smoke 200 + czyste logi
- [ ] 4. Kanony: checklisty Fazy 5 bez odstępstw P0/P1
- [ ] 5. Zero WIDOCZNE-ALE-ZEPSUTE
- [ ] 6. Zero cichych degradacji bez komunikatu

---
**Pozostałe do domknięcia audytu M03:** Faza 3 (Railway) i Faza 4 (żywe 6 scenariuszy, w tym rola member vs admin). Ocena ≤50 dopóki P0 cross-org (decyzje+inbox) nienaprawione.
