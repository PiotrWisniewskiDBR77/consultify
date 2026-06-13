# TECZKA M03 — Moja Praca (organizer) · pełna teczka reuse-first

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje istniejące (karta audytu §1–§7 + evidence) i dokłada brakujące ogniwa (Rejestr Wejść z uwagami żywymi #5/#9/#10/#11 · Rejestr Decyzji · DoD z liczbami). Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md) · referencja: [`M13-inicjatywy.md`](M13-inicjatywy.md).

## 00 · Nagłówek
- **Moduł:** M03 Moja Praca (Inbox · Kalendarz · Zadania · Decyzje · Manager) · **Pula:** core — najbardziej rozbudowany moduł aplikacji
- **Ocena audytu:** 54/100 · **Status:** FAZA 2/3 → FAZA 4 (sweepy) · **Rozmiar:** M (rdzeń) + **L** (i18n 2888 inline)
- **Żywy bloker:** **#5 crash „Coś poszło nie tak" na My Work (P1 WIDOCZNE-ALE-ZEPSUTE)** + 1×P1 leak executive-analytics
- **4 uwagi żywe:** #5 crash (P1) · #9 kalendarz Connect martwy (P2) · #10 otwarcie inicjatywy nawiguje (P1) · #11 paski multi-day (P2-design)
- **Właściciel:** Piotr · **Daty:** karta 2026-06-11 · teczka 2026-06-13
- **Karta:** `Harvard/modules/M03-my-work-organizer/KARTA_AUDYTU.md` · **Evidence:** `…/evidence/f1_code_truth.md`, `f2_tests_report.md`, `f56_kanon_sec.md`
- **Kod:** `src/components/MyWork/` (MyWorkHub, Calendar/CalendarView+CalendarSidebar, table/MyTasksListContent, DecisionsPanelContent, InboxContent, TaskDetailView) · `src/views/MyWorkView.tsx` · `server/src/routes/my-work.routes.ts` · `server/src/services/integrationOAuthEngine.ts`

## MAPA POKRYCIA
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta werdykt + §0 (6 scenariuszy) | job-to-be-done + zakres (niżej) |
| B UX docelowe | 🟢 | karta §5 (§27 Zadania/Decyzje/Inbox) | delta crash #5 + kalendarz #9/#11 |
| C Dane+API+reguły | 🟢 | karta §1e (wiring) + §1f (flagi) | link + reguła nawigacji #10 |
| D AI/Teresa | 🟡 | karta §1a (karty propozycji ← M01) | task-advisor stub (L-04) |
| E Integracje | 🟢 | karta §1g (tabela połączeń) | delta #10 (nawigacja) |
| F Epiki | 🟢 | karta §7 (3 fale) | epiki + uwagi żywe (niżej) |
| G DoD/jakość | 🟢 | karta §0/§2/§7 | **liczby** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść (4 uwagi żywe) + Decyzji** (niżej) |

---

## A · INTENCJA *(link + uzupełnienie)*
- **Job-to-be-done:** dać pracownikowi jeden organizer pracy — Inbox (triage), Kalendarz (unified feed), Zadania (tabela+Kanban), Decyzje (approve/reject/escalate), Manager (portfel zespołu).
- **Persony/role:** member (własna praca); admin/manager (Executive/Manager — dziś gating tylko UI, leak L-02). Core otwarty; Ideas closed (osobne moduły M05-09).
- **Zakres v1:** Inbox v8+legacy fallback · kalendarz unified + drag-reschedule etag · zadania CRUD+Kanban DnD+detal · decyzje lifecycle · EventBus `mywork-open-item` · ConvertToOutput. **POZA v1:** odczyt session-context (martwy stub, do wpięcia/usunięcia); Home/Radar (ukryte celowo `RADAR_ENABLED=false`).
- **Metryka:** triage→reload trwałość; 0 crashy na landing (#5); kolorowanie źródła kalendarza działa (#11).

## B · UX DOCELOWE *(link + delty żywe)*
Stany + §27 (Zadania/Decyzje/Inbox): karta §5 (RC-4 sticky thead złamany na 3 tabelach; brak persistKey szerokości kolumn). Korupcja „rose" **nie występuje**.
**Delty żywe:**
- **#5 crash My Work (P1 LOKALNE WIDOCZNE-ALE-ZEPSUTE):** wejście na My Work → error boundary „Coś poszło nie tak". Render-time wyjątek; kandydaci `MyWorkView.tsx`→`MyWorkHub.tsx`; granice `RouteErrorBoundary.tsx`, `table/ViewErrorBoundary.tsx`; hak `useV8MyWorkRoof.ts`, API `api/v8/my-work.ts`. **Przyczyna NIEustalona — brak stack-trace** (crash-diagnostics „sent successfully" → sprawdzić telemetrię lub repro przez preview console). Docelowo: 0 crashy na landing.
- **#9 kalendarz „Connect in Integrations" martwy (P2 LOKALNE):** „Podłącz w Integracjach" to `<span>` w `<button>` którego `onClick=toggleSource` (`CalendarSidebar.tsx:166,184-192`) — NIE nawiguje. Docelowo: realny deep-link do `IntegrationsModule` + dopięty OAuth-connect kalendarza (provider `google_calendar` z właściwym scope, dziś `google` ma scope Gmail).
- **#11 paski multi-day (P2-design):** widok miesiąca renderuje wielodniowe inicjatywy jako pełne paski powtarzane co tydzień + **gubią kolor źródła** (wszystko fioletowe vs legenda Tasks-niebieski/Initiatives-czerwony/Decisions-pomarańcz). Docelowo: inicjatywy WYJĄĆ z siatki dni do listwy Timeline/Roadmap; cap 2 wiersze/dzień + „+N" popover; przywrócić kolory źródła (`CalendarView.tsx:331` render).

## C · DANE + API + REGUŁY *(link + reguła nawigacji)*
- **Wiring FE↔BE↔DB:** karta §1e (Inbox kanoniczny 404→legacy graceful; zadania CRUD; linkowanie decyzji `f35aa8d7c8` real fetch; decyzje decide org-scope `b9f2dee9d2`; kalendarz unified; executive-analytics — leak L-02; focus zapis/odczyt). **Flagi:** karta §1f (`RADAR_ENABLED=false`, `ENABLE_V8_GLOBAL`, `MYWORK_IDEAS` beta closed).
- **Reguła nawigacji (#10, kanon docelowy):** generyczny handler `mywork-open-item` (`MyWorkHub.tsx:1235-1251`) dla `initiative,assessment,report,presentation,meeting,financial_model,budget,valuation,analysis,tool` robi `navigate(getArtifactPath)` — ZAWSZE przerzuca; kontrast `task,decision,idea,notification,notebook` (`:1252-1273`) otwierają **in-context** przez `handleOpenDocument`. Kalendarz: `onInitiativeClick`→`navigate` (`:3192-3194`). Docelowo: część typów (initiative i in. gdzie sensowne) na in-context — wymaga reużywalnego „trzeciego panelu" (klaster #1/#6/#7/#10/#13).

## D · AI / TERESA *(link + stub)*
- Karty propozycji ← M01 Czat (`/chat/confirm`) → zadanie/decyzja — realne (karta §1g).
- **task-advisor stub (L-04):** `task-advisor.routes.ts:12-20` (mount `Gateway.ts:483`) — każdy request 503, zero konsumenta FE. Decyzja: wpiąć konsumenta FE ALBO usunąć stub-mount.

## E · INTEGRACJE
Pełna tabela: karta §1g. Skrót: **←** cała apka (Inbox agreguje notifications), M13/M14/M10 (kalendarz feed task/initiative/decision + google/outlook), M04/M05-09 (ConvertTo*), M01 (karty propozycji). **→** M17 Outputs (ConvertToOutput), M13 (klik-through z kalendarza/decyzji). **przekrój:** EventBus `mywork-open-item`. **Delta #10:** klik inicjatywy hard-nawiguje (asymetria z task/decision in-context) → klaster trzeciego panelu.

## F · EPIKI *(z karty §7 + uwagi żywe)*
- **EPIK 1 — Integralność (P0):** ~~cross-org decyzje~~ `b9f2dee9d2`; ~~cross-org inbox~~ `45d74b0de1`; ~~linkowanie decyzji mock→real~~ `f35aa8d7c8`. [Fala 1, DONE]
- **EPIK 2 — Crash landing (#5, P1 TOP):** złapać stack-trace → naprawić render-time wyjątek na My Work. [uwaga żywa]
- **EPIK 3 — Domknięcie wartości (P1):** role-guard Managera serwerowy (leak L-02); session-context wpiąć/usunąć; `CalendarCreateEventModal` (S5) + drag-reschedule etag. [Fala 2]
- **EPIK 4 — Kalendarz connect + sprzątanie (#9/#11, P2):** deep-link Integracje + OAuth-connect; listwa Timeline/Roadmap + kolory źródła + cap. [uwagi żywe]
- **EPIK 5 — In-context open (#10, P1-design):** initiative na `handleOpenDocument` (klaster trzeciego panelu, decyzja D-02). [uwaga żywa]
- **EPIK 6 — Szlif kanonu (P2):** RC-4 sticky thead (3 tabele) + persistKey kolumn; wycięcie ~15 martwych (NIE NudgeStrip); task-advisor; Decyzje Archive/Delay; i18n inline (2888); ≥1 E2E→PR-gate+`Londyn`. [Fala 3/4]

## G · JAKOŚĆ / DoD *(skwantyfikowane)*
| # | Kryterium | Miara M03 |
|---|-----------|-----------|
| 1 | Front↔back | 0 crashy na landing (#5); session-context+task-advisor wpięte/usunięte; `CalendarCreateEventModal` działa; kalendarz Connect actionable (#9); 0 martwych CTA |
| 2 | Bezpieczeństwo | cross-org decyzje+inbox ✅ `b9f2dee9d2`/`45d74b0de1`; leak executive-analytics zamknięty role-guardem serwerowym (member→403, test — R3: karta mówi `d05382fb44` naprawione, **zweryfikować że `requireRole` faktycznie wpięte**) |
| 3 | i18n | 0 z **2888** inline (`i18n.language==='pl'`/`isPolish`) w `src/components/MyWork/` + fix mock `{defaultValue}` |
| 4 | Tokeny | **823** hex w `src/components/MyWork/` (zweryfikować ile = legalne kolory kalendarza/wykresów vs hardkod); kolory źródła kalendarza przywrócone (#11) |
| 5 | §27 | RC-4 sticky thead naprawione na 3 tabelach; szerokości kolumn trwałe; **24** surowych `<table>` → Zadania/Decyzje/Inbox przez FilterableTable |
| 6 | E2E w PR-gate | ≥1 funkcjonalny flow (task/decision/calendar) zielony na `Londyn` (dziś 0 w PR-gate — „Deferred outside main/develop") |

Scenariusze S1–S6 + pokrycie: karta §0/§2. Bezpieczeństwo: karta §6.

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1) — scala WSZYSTKIE źródła
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §1–§7 | 2026-06-11 | rdzeń realny; cross-org naprawione; leak + martwe stuby | L-01,02,03,04,05 |
| W-02 | **Uwaga żywa #5** | 2026-06-13 | crash „Coś poszło nie tak" na My Work (P1) | L-06 |
| W-03 | **Uwaga żywa #9** | 2026-06-13 | kalendarz „Connect in Integrations" martwy (P2) | L-07 |
| W-04 | **Uwaga żywa #10** | 2026-06-13 | otwarcie inicjatywy hard-nawiguje (P1) | L-08 (D-02) |
| W-05 | **Uwaga żywa #11** | 2026-06-13 | paski multi-day przytłaczają + gubią kolor źródła (P2) | L-09 |
| W-06 | Karta §5 (§27 RC-4) | 2026-06-11 | sticky thead złamany + brak persistKey | L-10 |
| W-07 | Feedback prod (`finding_railway_db_topology`) | — | dev `.env` → Railway PROD DB | ryzyko (niżej) |

### 02 · Stan obecny (prawda kodu) — karta §1 (REALNE ~14 · MOCK/STUB 2 · MARTWE 15+ · UKRYTE 4). Naprawione: `b9f2dee9d2` (decyzje org-scope), `45d74b0de1` (inbox IDOR), `f35aa8d7c8` (linkowanie decyzji real), `d05382fb44` (executive role-guard + 15 dead components), `7ab1b8aace` (cross-org testy + CI gate).

### 03 · Rejestr luk (= docelowy − obecny)
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | Status |
|----|------|---------|--------------------|-------|------|--------|
| L-01 | leak executive-analytics (manager-gate tylko UI) | W-01 | `my-work.routes.ts:7832` | P1 | 2 | otwarta (R3: karta mówi `d05382fb44` naprawione — zweryfikować) |
| L-02 | session-context odczyt = martwy stub | W-01 | `MyWorkHub.tsx:946-951` | P1 | 2 | otwarta |
| L-03 | task-advisor stub 503, 0 konsumenta FE | W-01 | `task-advisor.routes.ts:12-20`, `Gateway.ts:483` | P1 | 3 | otwarta |
| L-04 | `CalendarCreateEventModal` 3/4 FAIL (S5) | W-01 | onSubmit/conflict callbacks | P0-test | 2 | otwarta |
| L-05 | ~15 martwych komponentów (łańcuch WorkCenter; NIE NudgeStrip) | W-01 | f1_code_truth | P2 | 3 | otwarta |
| L-06 | crash render-time na landing My Work | W-02 | `MyWorkView.tsx`/`MyWorkHub.tsx` (stack nieznany) | P1 | 1 | **otwarta — przyczyna NIEustalona (R3: brak stack-trace)** |
| L-07 | kalendarz Connect martwy CTA + OAuth niedopięty | W-03 | `CalendarSidebar.tsx:166,184-192`; `calendarIntegrations.routes.ts:132 „(future)"` | P2 | 2/3 | otwarta |
| L-08 | initiative hard-nawiguje (in-context open) | W-04 | `MyWorkHub.tsx:1235-1251,3192-3194` | P1-design | 0.4 | **D-02** |
| L-09 | paski multi-day + utrata koloru źródła | W-05 | `CalendarView.tsx:331` | P2-design | 4 | otwarta |
| L-10 | RC-4 sticky thead + brak persistKey (3 tabele) | W-06 | `MyTasksListContent.tsx:2173,1467`, `DecisionsPanelContent.tsx:1873`, `InboxContent.tsx:3316` | P1 | 4 | otwarta |
| L-11 | i18n inline | W-01 | `src/components/MyWork/` (2888×) | P1 | 4 | otwarta |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | session-context (L7): wpiąć czy usunąć? | wpiąć do promptu / usunąć martwy GET | Piotr | TBD | otwarta |
| D-02 | #10 które z 10 typów otwierać in-context? | initiative+wybrane in-context / report/presentation→Canvas / budget/valuation→pełny moduł | Piotr | TBD | otwarta (klaster trzeciego panelu) |
| D-03 | #11 Month domyślny lekki + osobny Timeline/Roadmap? | listwa nad gridem / cienki brzeg w komórce | Piotr | TBD | otwarta |
| D-04 | task-advisor + Decyzje Archive/Delay: dopiąć czy ukryć? | dopiąć BE / ukryć | Piotr | TBD | otwarta |

### 05 · Flagi/rollout — `RADAR_ENABLED=false` (Home/Radar ukryte); `ENABLE_V8_GLOBAL` (inbox kanoniczny 404→legacy graceful); `MYWORK_IDEAS` beta closed (też admin — komentarz `:604` mylący, do poprawy). Organizer core otwarty.
### 06 · Ryzyka — L-06 crash bez stack-trace → najpierw repro/telemetria, R3: nie kwalifikować przyczyny bez dowodu. L-01 leak: karta mówi `d05382fb44` naprawione → zweryfikować że `requireRole` faktycznie wpięte (member→403 test). #9 OAuth wymaga env `GOOGLE_CLIENT_ID/SECRET`, `MICROSOFT_CLIENT_ID/SECRET` na Railway. Dev `.env` → Railway PROD DB — tylko dane jednorazowe.
### 07 · Log — 2026-06-13: 4 uwagi żywe zalogowane (#5/#9/#10/#11). Audyt 2026-06-11: ocena 54/100; cross-org `b9f2dee9d2`/`45d74b0de1`, linkowanie `f35aa8d7c8`. Re-ocena D/G po Fazie 3/4.

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia pełne (karta + 4 uwagi żywe #5/#9/#10/#11 + §27 + feedback prod) · R2 zero sierot (wejście→luka→DoD) · R3 L-06 „przyczyna NIEustalona" + L-01 „zweryfikować fix" (nie dziedziczone) · R4 DoD z liczbami (2888 i18n · 24 table · 823 hex) · R5 decyzje z właścicielem (terminy TBD) · A–E docelowy zlinkowany · F epiki↔luki · G DoD+S+sec · R6 sesja żywa = Faza 4 (zaplanowana). **Teczka kompletna do egzekucji.**
