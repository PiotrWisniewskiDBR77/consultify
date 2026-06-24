# M14 — PLAN TESTÓW WYKONAWCZYCH · 5 powierzchni × 30 scenariuszy (150)

> **Data:** 2026-06-23 · **Branch:** `feat/deliverables-w1` · **Autor:** CTO (Claude) na zlecenie CEO
> **Cel:** wykonywalny plan testów dla 5 powierzchni M14 Execution/Wdrożenie — **Portfolio/Cockpit, Rollout, Raporty, Manager/People-Change, RAID/Control Tower** — po **30 zróżnicowanych scenariuszy** każda. Każdy scenariusz: dokładny oczekiwany wynik (osobno **jakość** treści/zachowania i **grafika** wyglądu), nazwa pliku-zdjęcia (dowód), kryteria oceny PASS, werdykt automatyzowalności headless.
> **Przebieg wykonania (faza testowania, osobny krok):** dla każdego scenariusza → przeprowadź → zrób screen → oceń czy doprowadził tam gdzie miał, dwukryterialnie (jakość + grafika).
> Siostra: `M14-STAN-PRACY-ODBIORY.md` (program+odbiory). Analogiczny do `_PLAN_TESTOW_WYKONAWCZY_M13_5x30.md`.

---

## 1. Jak czytać i wykonywać

### Szablon scenariusza
**Powierzchnia** (komponent/route) · **Typ** (kategoria różnorodności) · **Precondition/seed** · **Kroki** · **JAKOŚĆ** (treść/zachowanie/API) · **GRAFIKA** (wygląd) · **Screenshot** (dowód) · **OCENA** (a) jakość PASS gdy… (b) grafika PASS gdy… · **Wykonanie** (headless ✅/🟡/❌ + status).

### Legenda „Wykonanie"
- **✅ headless** — w pełni automatyzowalny (Playwright render/API lub vitest component/integration); deterministyczne zdjęcie.
- **🟡 częściowo** — render/API headless + zdjęcie, ale pełny dowód wymaga realnych danych/interakcji (metoda proxy local-FE→demo-BE).
- **❌ real-browser/człowiek** — modale/portale, drag real-mouse, AI live, persist round-trip, a11y, in-app center z zalogowaną sesją.

### Ocena zdjęcia (faza testowania) — dwukryterialna
1. **Jakość** — treść/zachowanie/dane/statusy dokładnie jak w „JAKOŚĆ".
2. **Grafika** — wygląd zgodny z „GRAFIKA" + kanon (§27 tabele, brak danger-fill poza BLOCKED/CRITICAL, dark/light, czytelność, brak crimson-leak/overflow).
Scenariusz = PASS tylko gdy **OBA** PASS.

### Zdjęcia
Katalog: `docs/qa/screens/m14-exec/<powierzchnia>/` (portfolio · rollout · reports · manager · raid). Nazwa = `<id>-<slug>.png`.

### Stan debugowania (bramka wejścia) — ✅ 2026-06-23
- **tsc:** 0 błędów (FE + backend).
- **Testy M14:** 66/66 (execution + rollout + status-reports + evm).
- **Deploy:** F0/F1/F2/F3 zdeployowane na demo (`ada271867c`). Prod nietknięty.
- **Harness:** metoda proxy `tests/e2e/m13/m13-demo-proxy.spec.ts` (local-FE port 3200 + VITE_API_TARGET=demo + Bearer token); demo SPA blankuje headless-cold → renderuj lokalnie, dane z demo. Login `piotr.wisniewski@dbr77.com`/`123456`, org `a3e05d4a`.

### Rozkład automatyzowalności
~połowa = ✅/🟡 headless (render/API/component → zdjęcia). Reszta = ❌ real-browser (modale CRUD, drag, persist round-trip, AI live, in-app dystrybucja). Per powierzchnia w kolumnie „Wykonanie".

---

# POWIERZCHNIA 1 — PORTFOLIO / COCKPIT (PORT-01…30)

> Route `/implementation` zakładka „Summary". Powierzchnie: health-score (SSOT), kafelki KPI, widoki Table/Kanban/Timeline, Action Queue, Decisions buckets, Blockers, EVM. Danger-fill TYLKO BLOCKED/CRITICAL.

### PORT-01 — Kokpit ładuje portfel realizacji (Summary, scope active)
- **Powierzchnia:** `ExecutionHub.tsx` (Summary) · **Typ:** happy-path
- **Precondition:** Org Piotra (≥6 inicjatyw EXECUTING/BLOCKED); token write; `/implementation`.
- **Kroki:** 1. Otwórz Implementation. 2. Zaczekaj na render tabeli. 3. Odczytaj filtry (All/Blocked/Overdue Decisions/Missing Dates/Due Soon).
- **JAKOŚĆ:** tabela inicjatyw EXECUTING; liczniki filtrów spójne z danymi; brak error-boundary.
- **GRAFIKA:** zakładki Summary/Rollout/Reporting/Management; statusy dot-color; zero danger-fill poza BLOCKED.
- **Screenshot:** `docs/qa/screens/m14-exec/portfolio/port-01-cockpit-summary.png`
- **OCENA:** (a) tabela+liczniki zgodne; (b) kanon §27, brak danger-leak.
- **Wykonanie:** Headless 🟡 · do-build

### PORT-02 — Health Score = wartość API (SSOT, F1)
- **Powierzchnia:** `ExecutionHub.portfolioMetrics` + `/execution/:id/health` · **Typ:** integracja-SSOT
- **Precondition:** projekt z inicjatywami; `executionHealth` zasilony.
- **Kroki:** 1. Otwórz kokpit z health-ring. 2. Odczytaj liczbę. 3. Porównaj z `GET /execution/:id/health`.
- **JAKOŚĆ:** liczba ring == `healthScore` z API; `healthScoreSource='server'`; breakdown == API breakdown.
- **GRAFIKA:** ScoreRing progi 80/60/40; kolor RAG czytelny dark/light.
- **Screenshot:** `port-02-health-ssot-equals-api.png`
- **OCENA:** (a) ring==API + source=server; (b) ring czytelny obu motywach.
- **Wykonanie:** Headless 🟡 · do-build

### PORT-03 — Health fallback degraded (endpoint pada)
- **Powierzchnia:** `ExecutionHub` (executiveHealthFailed) · **Typ:** degradacja
- **Precondition:** zamockować 500 na `/execution/health`.
- **Kroki:** 1. Wymuś błąd endpointu. 2. Odczytaj health.
- **JAKOŚĆ:** `healthScoreSource='client'`; liczba z kalkulacji FE (fallback); brak crasha.
- **GRAFIKA:** opcjonalny baner degradacji; ring nadal renderuje.
- **Screenshot:** `port-03-health-fallback-client.png`
- **OCENA:** (a) source=client + brak crasha; (b) brak danger-leak.
- **Wykonanie:** Headless ✅ (mock API)

### PORT-04 — Kafelki KPI (on-track/blocked/overdue/avgProgress/budgetHealth)
- **Powierzchnia:** `renderPortfolioHealth` · **Typ:** happy-path
- **Precondition:** mieszane statusy + budżety.
- **Kroki:** 1. Odczytaj 5 kafli. 2. Zweryfikuj wartości vs dane.
- **JAKOŚĆ:** budgetHealth = penalizacja overrun (within-budget=100, NIE odwrotny); brak `—` gdy są dane.
- **GRAFIKA:** kafle pastelowe; budgetHealth bez danger-fill gdy zdrowy.
- **Screenshot:** `port-04-kpi-tiles.png`
- **OCENA:** (a) budgetHealth poprawny kierunek; (b) kanon kafli.
- **Wykonanie:** Headless 🟡

### PORT-05 — Pole EVM w health (SPI portfela, F2)
- **Powierzchnia:** `/execution/health` `evm` · **Typ:** integracja
- **Precondition:** inicjatywy z cost_capex/opex + planned dates + progress.
- **Kroki:** 1. `GET /execution/:id/health`. 2. Odczytaj `evm`.
- **JAKOŚĆ:** `evm.spi` policzony (EV/PV); `evm.coverage` = udział baselined; `evm.cpi` null (brak actuals).
- **GRAFIKA:** N/A (API) — jeśli FE pokazuje, czytelny.
- **Screenshot:** `port-05-evm-rollup-api.png`
- **OCENA:** (a) spi+coverage obecne; (b) N/A.
- **Wykonanie:** Headless ✅ (API/component)

### PORT-06 — Widok Table (FilterableTable §27)
- **Powierzchnia:** ExecutionHub viewMode=table · **Typ:** happy-path
- **Precondition:** ≥10 inicjatyw.
- **Kroki:** 1. Widok Table. 2. Sort/filter/search.
- **JAKOŚĆ:** kolumny §27 (Initiative/Type/Status/Assignee/Progress/Deadline/Alerts/Tasks); sort działa.
- **GRAFIKA:** sticky header, kebab, badge statusów.
- **Screenshot:** `port-06-table-view.png`
- **OCENA:** (a) sort/filter; (b) kanon §27.
- **Wykonanie:** Headless 🟡

### PORT-07 — Widok Kanban (drag statusu)
- **Powierzchnia:** ExecutionInitiativesKanbanView · **Typ:** interakcja
- **Precondition:** inicjatywy w różnych statusach.
- **Kroki:** 1. Widok Kanban. 2. Drag karty między kolumnami.
- **JAKOŚĆ:** PUT `/initiatives/:id {currentStage}`; karta zmienia kolumnę po reload.
- **GRAFIKA:** kolumny statusów, karty pastelowe.
- **Screenshot:** `port-07-kanban-drag.png`
- **OCENA:** (a) persist po reload; (b) kanon.
- **Wykonanie:** ❌ real-browser (drag)

### PORT-08 — Widok Timeline/Gantt (zależności + ścieżka krytyczna)
- **Powierzchnia:** ExecutionTimelineView · **Typ:** happy-path
- **Precondition:** inicjatywy z datami + zależnościami.
- **Kroki:** 1. Widok Timeline. 2. Odczytaj bary + linie + critical path.
- **JAKOŚĆ:** `computeExecutionCriticalPath`; governance-warnings (overdue/blocked/conflict).
- **GRAFIKA:** ring-rose na critical; linie zależności widoczne.
- **Screenshot:** `port-08-timeline-critical.png`
- **OCENA:** (a) critical path + warnings; (b) linie czytelne.
- **Wykonanie:** Headless 🟡

### PORT-09 — Action Queue: ranking WSJF/CoD (F3)
- **Powierzchnia:** `/execution/:id/action-queue` + `actionQueueCodScore` · **Typ:** integracja
- **Precondition:** mix overdue decisions/tasks/high-risks.
- **Kroki:** 1. Odczytaj kolejkę. 2. Zweryfikuj kolejność.
- **JAKOŚĆ:** krytyczna decyzja > drobny task; RED-risk > AMBER; starszy overdue wyżej.
- **GRAFIKA:** lista priorytetowa; severity dot.
- **Screenshot:** `port-09-action-queue-wsjf.png`
- **OCENA:** (a) kolejność CoD; (b) czytelność.
- **Wykonanie:** Headless ✅ (component/API)

### PORT-10 — Action Queue: kanoniczny high-risk (F1)
- **Powierzchnia:** getActionQueue (categorizeScore) · **Typ:** poprawność
- **Precondition:** ryzyka HIGH×LOW (GREEN) i MED×HIGH (AMBER).
- **Kroki:** 1. Odczytaj risk_high items.
- **JAKOŚĆ:** HIGH×LOW NIE w kolejce; AMBER+RED tak; zgodne z heatmapą.
- **GRAFIKA:** N/A.
- **Screenshot:** `port-10-action-queue-canonical.png`
- **OCENA:** (a) non-GREEN tylko; (b) N/A.
- **Wykonanie:** Headless ✅

### PORT-11 — Baner degradacji Action Queue (L-02)
- **Powierzchnia:** ExecutionHub:3721 · **Typ:** degradacja
- **Precondition:** błąd action-queue.
- **Kroki:** 1. Wymuś błąd. 2. Odczytaj baner.
- **JAKOŚĆ:** baner „action queue unavailable — degraded"; nie puste-ciche.
- **GRAFIKA:** baner warning (amber), nie danger-fill.
- **Screenshot:** `port-11-action-queue-degraded.png`
- **OCENA:** (a) baner+treść; (b) amber.
- **Wykonanie:** Headless ✅

### PORT-12 — Decisions buckets (overdue/pending/escalated)
- **Powierzchnia:** ExecutionHub decisions · **Typ:** happy-path
- **Precondition:** decyzje różnych statusów.
- **Kroki:** 1. Odczytaj kubełki.
- **JAKOŚĆ:** overdue/pending rozdzielone; liczniki zgodne.
- **GRAFIKA:** baner degradacji gdy błąd; statusy.
- **Screenshot:** `port-12-decisions-buckets.png`
- **OCENA:** (a) podział poprawny; (b) kanon.
- **Wykonanie:** Headless 🟡

### PORT-13 — Decisions: baner degradacji
- **Powierzchnia:** ExecutionHub:3425 · **Typ:** degradacja
- **Kroki:** błąd → baner „decisions unavailable — degraded".
- **JAKOŚĆ:** baner honest, nie puste.
- **GRAFIKA:** warning.
- **Screenshot:** `port-13-decisions-degraded.png`
- **OCENA:** (a) baner; (b) amber.
- **Wykonanie:** Headless ✅

### PORT-14 — Blockers/Escalations (krytyczne)
- **Powierzchnia:** ExecutionHub blockers · **Typ:** happy-path
- **Precondition:** inicjatywa/task BLOCKED.
- **Kroki:** odczytaj blockery.
- **JAKOŚĆ:** BLOCKED=critical; zależności DEPENDENCY.
- **GRAFIKA:** danger-token TYLKO dla BLOCKED (uzasadniony).
- **Screenshot:** `port-14-blockers.png`
- **OCENA:** (a) blokery poprawne; (b) danger uzasadniony.
- **Wykonanie:** Headless 🟡

### PORT-15 — Health snapshot tasks: baner degradacji
- **Powierzchnia:** ExecutionHub:3244 · **Typ:** degradacja
- **Kroki:** błąd tasks → baner „tasks unavailable".
- **JAKOŚĆ:** baner; buckets puste z powodu błędu, nie braku.
- **GRAFIKA:** warning.
- **Screenshot:** `port-15-tasks-degraded.png`
- **OCENA:** (a) baner; (b) amber.
- **Wykonanie:** Headless ✅

### PORT-16 — Escalations (overdue decisions z RAG)
- **Powierzchnia:** `/execution/escalations` · **Typ:** happy-path
- **Kroki:** odczytaj escalations.
- **JAKOŚĆ:** decyzje przeterminowane z severity; CRITICAL gdy priority CRITICAL.
- **GRAFIKA:** RAG dot.
- **Screenshot:** `port-16-escalations.png`
- **OCENA:** (a) RAG poprawny; (b) kanon.
- **Wykonanie:** Headless ✅ (API)

### PORT-17 — Per-initiative health + why-RED chain
- **Powierzchnia:** initiativeHealth/whyRed · **Typ:** drill-down
- **Kroki:** rozwiń RED inicjatywę → why-RED.
- **JAKOŚĆ:** whyRed.signals (BLOCKED/overdue/decisions) zgodne z danymi.
- **GRAFIKA:** chain czytelny.
- **Screenshot:** `port-17-why-red-chain.png`
- **OCENA:** (a) sygnały zgodne; (b) czytelność.
- **Wykonanie:** Headless 🟡

### PORT-18 — Filtr „Blocked" zawęża portfel
- **Powierzchnia:** Summary filtry · **Typ:** interakcja
- **Kroki:** klik Blocked → tabela.
- **JAKOŚĆ:** tylko BLOCKED; licznik zgodny.
- **GRAFIKA:** chip aktywny.
- **Screenshot:** `port-18-filter-blocked.png`
- **OCENA:** (a) filtr działa; (b) chip.
- **Wykonanie:** Headless 🟡

### PORT-19 — Filtr „Overdue Decisions"
- **Powierzchnia:** Summary filtry · **Typ:** interakcja
- **Kroki:** klik Overdue Decisions.
- **JAKOŚĆ:** lista przeterminowanych decyzji.
- **GRAFIKA:** chip.
- **Screenshot:** `port-19-filter-overdue-dec.png`
- **OCENA:** (a) filtr; (b) chip.
- **Wykonanie:** Headless 🟡

### PORT-20 — Filtr „Missing Dates"
- **Powierzchnia:** Summary filtry · **Typ:** edge
- **Kroki:** klik Missing Dates.
- **JAKOŚĆ:** inicjatywy bez planned dates (degraded planning posture).
- **GRAFIKA:** chip.
- **Screenshot:** `port-20-filter-missing-dates.png`
- **OCENA:** (a) lista bez-dat; (b) chip.
- **Wykonanie:** Headless 🟡

### PORT-21 — Export CSV portfela
- **Powierzchnia:** handleExport · **Typ:** funkcja
- **Kroki:** klik Export.
- **JAKOŚĆ:** CSV z kolumnami (Name/Status/Owner/Progress/dates).
- **GRAFIKA:** N/A (download).
- **Screenshot:** `port-21-export-csv.png`
- **OCENA:** (a) CSV poprawny; (b) N/A.
- **Wykonanie:** ❌ real-browser (download)
### PORT-22 — Pusty stan portfela
- **Powierzchnia:** ExecutionHub empty · **Typ:** pusty-stan
- **Kroki:** org bez inicjatyw EXECUTING.
- **JAKOŚĆ:** empty-copy + CTA.
- **GRAFIKA:** centrowany, bez danger.
- **Screenshot:** `port-22-empty.png`
- **OCENA:** (a) empty; (b) centrowanie.
- **Wykonanie:** Headless 🟡

### PORT-23 — Dark mode kokpit
- **Powierzchnia:** ExecutionHub dark · **Typ:** grafika
- **Kroki:** forceTheme dark.
- **JAKOŚĆ:** te same dane.
- **GRAFIKA:** kontrast OK, brak crimson-leak.
- **Screenshot:** `port-23-dark.png`
- **OCENA:** (a) dane; (b) dark czytelny.
- **Wykonanie:** Headless ✅

### PORT-24 — Light mode kokpit
- **Powierzchnia:** ExecutionHub light · **Typ:** grafika
- **Kroki:** forceTheme light.
- **GRAFIKA:** brak danger-fill na normalnych; czytelność.
- **Screenshot:** `port-24-light.png`
- **OCENA:** (a) dane; (b) light.
- **Wykonanie:** Headless ✅

### PORT-25 — i18n PL/EN kokpit
- **Powierzchnia:** ExecutionHub t() · **Typ:** i18n
- **Kroki:** przełącz język.
- **JAKOŚĆ:** etykiety z `t()` (incl. presety raportów); brak bare-keys.
- **GRAFIKA:** brak overflow po dłuższych PL.
- **Screenshot:** `port-25-i18n-pl.png`
- **OCENA:** (a) tłumaczenia; (b) brak overflow.
- **Wykonanie:** Headless 🟡

### PORT-26 — Gating pilota (read-only)
- **Powierzchnia:** isPilotParticipant · **Typ:** RBAC
- **Kroki:** sesja pilota.
- **JAKOŚĆ:** akcje CRUD disabled; read OK.
- **GRAFIKA:** disabled states.
- **Screenshot:** `port-26-pilot-readonly.png`
- **OCENA:** (a) write zablokowane; (b) disabled wizualnie.
- **Wykonanie:** ❌ real-browser (sesja)

### PORT-27 — Zero console errors
- **Powierzchnia:** ExecutionHub · **Typ:** stabilność
- **Kroki:** załaduj + przeklikaj zakładki.
- **JAKOŚĆ:** brak błędów konsoli; brak error-boundary.
- **GRAFIKA:** N/A.
- **Screenshot:** `port-27-console-clean.png`
- **OCENA:** (a) 0 błędów; (b) N/A.
- **Wykonanie:** Headless ✅

### PORT-28 — Deep-link tab (?tab=)
- **Powierzchnia:** ExecutionHub activeTab url · **Typ:** routing
- **Kroki:** otwórz `?tab=rollout`.
- **JAKOŚĆ:** otwiera Rollout bezpośrednio.
- **GRAFIKA:** tab aktywny.
- **Screenshot:** `port-28-deeplink-tab.png`
- **OCENA:** (a) tab z url; (b) aktywny.
- **Wykonanie:** Headless 🟡

### PORT-29 — Switch widoków bez utraty kontekstu
- **Powierzchnia:** viewMode · **Typ:** interakcja
- **Kroki:** Table→Kanban→Timeline.
- **JAKOŚĆ:** te same inicjatywy, filtr utrzymany.
- **GRAFIKA:** płynne, bez migotania.
- **Screenshot:** `port-29-view-switch.png`
- **OCENA:** (a) kontekst; (b) brak FOUC.
- **Wykonanie:** Headless 🟡

### PORT-30 — N+1/wydajność health
- **Powierzchnia:** getPortfolioHealth · **Typ:** wydajność
- **Kroki:** duża org → mierz czas.
- **JAKOŚĆ:** health < ~1.5s; brak N+1 (1 query/encja).
- **GRAFIKA:** N/A.
- **Screenshot:** `port-30-perf.png`
- **OCENA:** (a) czas+zapytania; (b) N/A.
- **Wykonanie:** Headless ✅ (timing)

---

# POWIERZCHNIA 2 — ROLLOUT (ROLL-01…30)

> Zakładka Rollout: 5 podwidoków (Plan/KPI/Risk/Change/Closure). DB-backed (`rollout_*`), FilterableTable §27, gate-banner GO_NO_GO.

### ROLL-01 — Nawigacja do Rollout + 5 podwidoków
- **Powierzchnia:** RolloutTab subviews · **Typ:** happy-path · **Precondition:** projekt z rollout-data
- **Kroki:** Rollout → przełącz Plan/KPI/Risk/Change/Closure.
- **JAKOŚĆ:** 5 podwidoków renderuje; SUBVIEW_ORDER.
- **GRAFIKA:** toggle podwidoków; kanon.
- **Screenshot:** `docs/qa/screens/m14-exec/rollout/roll-01-subviews.png`
- **OCENA:** (a) 5 podwidoków; (b) toggle. · **Wykonanie:** Headless 🟡

### ROLL-02 — Master Plan (grupowanie kwartalne)
- **Powierzchnia:** RolloutPlanView · **Typ:** happy-path
- **Kroki:** Plan → odczytaj kwartały.
- **JAKOŚĆ:** inicjatywy grupowane po plannedStart kwartał; „Unscheduled" dla bez-dat; flaga overloaded>4.
- **GRAFIKA:** koszyki kwartalne.
- **Screenshot:** `roll-02-plan-quarters.png`
- **OCENA:** (a) grupowanie; (b) czytelność. · **Wykonanie:** Headless 🟡

### ROLL-03 — KPI Tracking + sparkline historii
- **Powierzchnia:** RolloutTab KPI · **Typ:** happy-path · **Precondition:** rollout_kpis + history
- **Kroki:** KPI → odczytaj baseline/target/current + sparkline.
- **JAKOŚĆ:** progressPct=(current-baseline)/(target-baseline); KpiSparkline z historii.
- **GRAFIKA:** sparkline; tony success/warning/danger progowo.
- **Screenshot:** `roll-03-kpi-sparkline.png`
- **OCENA:** (a) progress+historia; (b) sparkline. · **Wykonanie:** Headless 🟡

### ROLL-04 — KPI CRUD + persistencja F5 [KLUCZOWY]
- **Powierzchnia:** `POST/PATCH /rollout/kpis` · **Typ:** persist
- **Kroki:** dodaj KPI → zmień current → reload (F5).
- **JAKOŚĆ:** POST 201; PATCH zapisuje + wstawia history point; po reload wartości trwałe.
- **GRAFIKA:** wiersz w FilterableTable.
- **Screenshot:** `roll-04-kpi-persist.png`
- **OCENA:** (a) persist po F5; (b) tabela. · **Wykonanie:** ❌ real-browser (modal+F5)

### ROLL-05 — KPI history-on-change (tylko przy zmianie current)
- **Powierzchnia:** rollout.routes:174 · **Typ:** poprawność
- **Kroki:** PATCH name (bez current) vs PATCH current.
- **JAKOŚĆ:** history insert TYLKO gdy currentValue zmienione.
- **GRAFIKA:** N/A.
- **Screenshot:** `roll-05-kpi-history-guard.png`
- **OCENA:** (a) history-guard; (b) N/A. · **Wykonanie:** Headless ✅ (test 14/14 pokrywa)

### ROLL-06 — KPI derived gdy pusto
- **Powierzchnia:** deriveKpis · **Typ:** derived
- **Kroki:** projekt bez rollout_kpis.
- **JAKOŚĆ:** 5 read-only KPI portfela (on-track/avg/overdue/gate-ready/active).
- **GRAFIKA:** read-only oznaczone.
- **Screenshot:** `roll-06-kpi-derived.png`
- **OCENA:** (a) derived z realnych; (b) read-only. · **Wykonanie:** Headless 🟡

### ROLL-07 — Risk Register (FilterableTable)
- **Powierzchnia:** RolloutTab Risk · **Typ:** happy-path
- **Kroki:** Risk → filtruj po probability/impact/status.
- **JAKOŚĆ:** rollout_risks; filtry działają.
- **GRAFIKA:** §27, SignalDot tony.
- **Screenshot:** `roll-07-risk-register.png`
- **OCENA:** (a) filtry; (b) §27. · **Wykonanie:** Headless 🟡

### ROLL-08 — Risk derived z sygnałów
- **Powierzchnia:** deriveRisks · **Typ:** derived
- **Kroki:** pusto → derived z riskSignals/delaySignals.
- **JAKOŚĆ:** CRITICAL/HIGH→high; blocked/overdue mapowane.
- **GRAFIKA:** SignalDot; Teresa-callout gdy activeSignals>0.
- **Screenshot:** `roll-08-risk-derived.png`
- **OCENA:** (a) mapowanie; (b) callout. · **Wykonanie:** Headless 🟡

### ROLL-09 — Risk CRUD + org-scope
- **Powierzchnia:** `/rollout/risks` · **Typ:** persist+security
- **Kroki:** add/edit/delete; cross-org GET.
- **JAKOŚĆ:** CRUD 201/200; org-scope (404 cross-org).
- **GRAFIKA:** modal.
- **Screenshot:** `roll-09-risk-crud.png`
- **OCENA:** (a) CRUD+org-scope; (b) modal. · **Wykonanie:** 🟡 (API ✅, modal ❌)

### ROLL-10 — Change Log (approved_by stamp)
- **Powierzchnia:** `/rollout/changes` PATCH:418 · **Typ:** workflow
- **Kroki:** zmień status→APPROVED.
- **JAKOŚĆ:** server stempluje approved_by gdy APPROVED.
- **GRAFIKA:** status tony (approved=success).
- **Screenshot:** `roll-10-change-approved.png`
- **OCENA:** (a) stamp; (b) tony. · **Wykonanie:** Headless ✅ (API)

### ROLL-11 — Closure Checklist (resolved_at stamp)
- **Powierzchnia:** `/rollout/closures` PATCH:534 · **Typ:** workflow
- **Kroki:** zaznacz Done.
- **JAKOŚĆ:** status→DONE + resolved_at stempel.
- **GRAFIKA:** checkbox inline.
- **Screenshot:** `roll-11-closure-done.png`
- **OCENA:** (a) resolved_at; (b) checkbox. · **Wykonanie:** Headless 🟡

### ROLL-12 — Closure derived (Handover/Sign-off/Closure)
- **Powierzchnia:** deriveClosures · **Typ:** derived
- **Kroki:** ukończona inicjatywa → 3 pozycje PMI/PRINCE2.
- **JAKOŚĆ:** kategorie Handover/Sign-off/Closure.
- **GRAFIKA:** „Results hand-off — preview only" callout.
- **Screenshot:** `roll-12-closure-derived.png`
- **OCENA:** (a) 3 kategorie; (b) preview-callout. · **Wykonanie:** Headless 🟡

### ROLL-13 — Write-gate MANAGE_ROLLOUT (server-side)
- **Powierzchnia:** rollout.routes:49 · **Typ:** RBAC
- **Kroki:** TEAM_MEMBER POST/PATCH.
- **JAKOŚĆ:** 403 (nie tylko FE readOnly); ADMIN/PM/OWNER OK.
- **GRAFIKA:** N/A.
- **Screenshot:** `roll-13-write-gate.png`
- **OCENA:** (a) 403 enforced; (b) N/A. · **Wykonanie:** Headless ✅ (test pokrywa)

### ROLL-14 — Org-scope wszystkich 5 rejestrów
- **Powierzchnia:** rollout.routes · **Typ:** security
- **Kroki:** GET kpis/risks/changes/closures.
- **JAKOŚĆ:** każdy query `organization_id=?` pierwszy param.
- **GRAFIKA:** N/A.
- **Screenshot:** `roll-14-org-scope.png`
- **OCENA:** (a) org-scope; (b) N/A. · **Wykonanie:** Headless ✅ (test 14/14)

### ROLL-15 — KPI/Risk/Change/Closure 404 cross-org
- **Powierzchnia:** rollout.routes · **Typ:** security
- **Kroki:** PATCH cudzego id.
- **JAKOŚĆ:** 404 (nie 200/edycja).
- **GRAFIKA:** N/A.
- **Screenshot:** `roll-15-404-cross-org.png`
- **OCENA:** (a) 404; (b) N/A. · **Wykonanie:** Headless ✅

### ROLL-16 — Load-error banner Rollout
- **Powierzchnia:** RolloutTab:1011 · **Typ:** degradacja
- **Kroki:** błąd ładowania.
- **JAKOŚĆ:** „Could not load rollout data".
- **GRAFIKA:** baner warning.
- **Screenshot:** `roll-16-load-error.png`
- **OCENA:** (a) baner; (b) amber. · **Wykonanie:** Headless ✅

### ROLL-17 — Teresa „rollout at risk" callout
- **Powierzchnia:** RolloutTab:1028 · **Typ:** AI-touchpoint
- **Kroki:** activeSignals>0.
- **JAKOŚĆ:** callout z kontekstem ryzyka.
- **GRAFIKA:** pigułka AI.
- **Screenshot:** `roll-17-teresa-callout.png`
- **OCENA:** (a) callout warunkowy; (b) pigułka. · **Wykonanie:** Headless 🟡

### ROLL-18 — DerivedRiskTable (read-only sygnały V8)
- **Powierzchnia:** RolloutTab:1446 · **Typ:** drugorzędne
- **Kroki:** odczytaj tabelę derived risks.
- **JAKOŚĆ:** title/probability/impact/status z sygnałów.
- **GRAFIKA:** prosta tabela (akceptowalna).
- **Screenshot:** `roll-18-derived-risk-table.png`
- **OCENA:** (a) sygnały; (b) czytelność. · **Wykonanie:** Headless 🟡

### ROLL-19 — Dark mode Rollout
- **Powierzchnia:** RolloutTab dark · **Typ:** grafika
- **Kroki:** dark.
- **GRAFIKA:** kontrast; sparkline czytelny.
- **Screenshot:** `roll-19-dark.png`
- **OCENA:** (a) dane; (b) dark. · **Wykonanie:** Headless ✅

### ROLL-20 — Light mode Rollout
- **Powierzchnia:** RolloutTab light · **Typ:** grafika
- **GRAFIKA:** brak crimson-leak.
- **Screenshot:** `roll-20-light.png`
- **OCENA:** (a) dane; (b) light. · **Wykonanie:** Headless ✅

### ROLL-21 — i18n PL/EN Rollout
- **Powierzchnia:** RolloutTab t() · **Typ:** i18n · **Kroki:** przełącz język w 5 podwidokach.
- **JAKOŚĆ:** etykiety kolumn/przycisków z `t()`; brak bare-keys. **GRAFIKA:** brak overflow po PL.
- **Screenshot:** `roll-21-i18n.png` · **OCENA:** (a) tłumaczenia; (b) brak overflow. · **Wykonanie:** Headless 🟡

### ROLL-22 — Empty-state KPI register
- **Powierzchnia:** RolloutTab KPI empty · **Typ:** pusty-stan · **Kroki:** projekt bez rollout_kpis (gdy derived też off).
- **JAKOŚĆ:** empty-copy lub derived KPI; nie blank. **GRAFIKA:** centrowany, bez danger.
- **Screenshot:** `roll-22-kpi-empty.png` · **OCENA:** (a) empty/derived; (b) kanon. · **Wykonanie:** Headless 🟡

### ROLL-23 — Empty-state Risk/Change/Closure
- **Powierzchnia:** RolloutTab empty · **Typ:** pusty-stan · **Kroki:** puste rejestry → derived lub empty.
- **JAKOŚĆ:** Risk=derived z sygnałów; Change/Closure empty-copy. **GRAFIKA:** spójne empty.
- **Screenshot:** `roll-23-registers-empty.png` · **OCENA:** (a) derived/empty; (b) kanon. · **Wykonanie:** Headless 🟡

### ROLL-24 — KPI threshold tony (success/warning/danger)
- **Powierzchnia:** RolloutTab KPI tone · **Typ:** grafika · **Kroki:** KPI <50%/≥50%/≥80%.
- **JAKOŚĆ:** tone progowo wg progress. **GRAFIKA:** danger TYLKO przy realnym niedowiezieniu, nie default.
- **Screenshot:** `roll-24-kpi-tone.png` · **OCENA:** (a) tony progowe; (b) brak fałszywego danger. · **Wykonanie:** Headless 🟡

### ROLL-25 — Change Log derived/automatic (znany gap)
- **Powierzchnia:** RolloutTab Change · **Typ:** known-gap · **Kroki:** zmiana statusu/rebaseline.
- **JAKOŚĆ:** UWAGA: obecnie NIE loguje automatycznie (gap F5); ręczny rejestr działa. **GRAFIKA:** status tony.
- **Screenshot:** `roll-25-change-automatic.png` · **OCENA:** (a) potwierdza gap+manual CRUD; (b) tony. · **Wykonanie:** Headless 🟡

### ROLL-26 — Closure F5-persist
- **Powierzchnia:** rollout_closures · **Typ:** persist · **Kroki:** zaznacz Done → reload.
- **JAKOŚĆ:** status+resolved_at trwałe po F5. **GRAFIKA:** checkbox stan utrzymany.
- **Screenshot:** `roll-26-closure-persist.png` · **OCENA:** (a) persist; (b) checkbox. · **Wykonanie:** ❌ real-browser (F5)

### ROLL-27 — Kebab-actions (edit/delete) w FilterableTable
- **Powierzchnia:** RolloutTab kebab · **Typ:** interakcja · **Kroki:** kebab → edit/delete.
- **JAKOŚĆ:** edit otwiera modal z wartościami; delete org-scoped. **GRAFIKA:** menu kebab §27.
- **Screenshot:** `roll-27-kebab.png` · **OCENA:** (a) edit/delete; (b) kebab. · **Wykonanie:** ❌ real-browser (modal)

### ROLL-28 — Filtry kolumn (header dropdown)
- **Powierzchnia:** FilterableTable filter state · **Typ:** interakcja · **Kroki:** filtr per kolumna.
- **JAKOŚĆ:** lista zawęża się; stan per-rejestr. **GRAFIKA:** dropdown filtra.
- **Screenshot:** `roll-28-column-filter.png` · **OCENA:** (a) filtr; (b) dropdown. · **Wykonanie:** Headless 🟡

### ROLL-29 — Sort każdego rejestru
- **Powierzchnia:** FilterableTable sort · **Typ:** interakcja · **Kroki:** sort po kolumnie.
- **JAKOŚĆ:** sort asc/desc działa w KPI/Risk/Change/Closure. **GRAFIKA:** wskaźnik sortu.
- **Screenshot:** `roll-29-sort.png` · **OCENA:** (a) sort; (b) wskaźnik. · **Wykonanie:** Headless 🟡

### ROLL-30 — Zero console errors Rollout
- **Powierzchnia:** RolloutTab · **Typ:** stabilność · **Kroki:** przeklik 5 podwidoków.
- **JAKOŚĆ:** brak błędów konsoli/error-boundary. **GRAFIKA:** N/A.
- **Screenshot:** `roll-30-console-clean.png` · **OCENA:** (a) 0 błędów; (b) N/A. · **Wykonanie:** Headless ✅

---

# POWIERZCHNIA 3 — RAPORTY (REP-01…30)

> Zakładka Reporting: Status Reports (generacja/RAG/cykl życia/dystrybucja) + Report Catalog.

### REP-01 — Generacja raportu z live-data
- **Powierzchnia:** `POST /status-reports/initiative/:id/generate` · **Typ:** happy-path · **Precondition:** inicjatywa z tasks/RAID/budżet
- **Kroki:** generuj raport.
- **JAKOŚĆ:** czyta tasks(DONE/IN_PROGRESS/BLOCKED)/RAID/budżet/decyzje; trend vs poprzedni; status DRAFT.
- **GRAFIKA:** sekcje RAG.
- **Screenshot:** `docs/qa/screens/m14-exec/reports/rep-01-generate.png`
- **OCENA:** (a) grounded+DRAFT; (b) RAG. · **Wykonanie:** Headless ✅ (API)

### REP-02 — RAG roll-up (any RED→RED, ≥2 AMBER→AMBER)
- **Powierzchnia:** calculateOverallStatus · **Typ:** poprawność
- **Kroki:** sekcje z różnymi RAG.
- **JAKOŚĆ:** roll-up reguła; NA ignorowane.
- **GRAFIKA:** overall RAG.
- **Screenshot:** `rep-02-rag-rollup.png`
- **OCENA:** (a) roll-up; (b) RAG. · **Wykonanie:** Headless ✅

### REP-03 — SCOPE=NA honest (P0)
- **Powierzchnia:** calculateSectionStatuses · **Typ:** poprawność
- **Kroki:** odczytaj sekcję SCOPE.
- **JAKOŚĆ:** SCOPE status=NA „not independently tracked" (nie fałszywe GREEN).
- **GRAFIKA:** NA wyróżnione (nie zielone).
- **Screenshot:** `rep-03-scope-na.png`
- **OCENA:** (a) NA nie GREEN; (b) wizualnie neutralne. · **Wykonanie:** Headless ✅

### REP-04 — QUALITY z openIssues (P0)
- **Powierzchnia:** calculateSectionStatuses · **Typ:** poprawność
- **Kroki:** 0/1/3 open issues.
- **JAKOŚĆ:** QUALITY GREEN/AMBER/RED wg openIssues (nie sztywne GREEN).
- **GRAFIKA:** RAG.
- **Screenshot:** `rep-04-quality-derived.png`
- **OCENA:** (a) wg issues; (b) RAG. · **Wykonanie:** Headless ✅

### REP-05 — Cykl życia DRAFT→APPROVED→PUBLISHED
- **Powierzchnia:** approve/publish · **Typ:** workflow
- **Kroki:** approve → publish.
- **JAKOŚĆ:** status+approved_by/published_at; ścieżka audytu.
- **GRAFIKA:** badge statusu.
- **Screenshot:** `rep-05-lifecycle.png`
- **OCENA:** (a) cykl; (b) badge. · **Wykonanie:** Headless ✅ (API)

### REP-06 — Distribute wymaga PUBLISHED (P0)
- **Powierzchnia:** `/distribute` · **Typ:** security
- **Kroki:** distribute DRAFT vs PUBLISHED.
- **JAKOŚĆ:** DRAFT→409; PUBLISHED→200.
- **GRAFIKA:** N/A.
- **Screenshot:** `rep-06-distribute-guard.png`
- **OCENA:** (a) 409 na DRAFT; (b) N/A. · **Wykonanie:** Headless ✅ (test 5/5)

### REP-07 — DELETE org-scope (P0)
- **Powierzchnia:** DELETE /:id · **Typ:** security
- **Kroki:** DELETE cudzego raportu.
- **JAKOŚĆ:** 404 (nie cross-tenant delete).
- **GRAFIKA:** N/A.
- **Screenshot:** `rep-07-delete-org-scope.png`
- **OCENA:** (a) 404; (b) N/A. · **Wykonanie:** Headless ✅ (test 5/5)

### REP-08 — Period engine (Weekly/Monthly/Quarterly)
- **Powierzchnia:** calculatePeriod · **Typ:** poprawność
- **Kroki:** generuj różne periodType.
- **JAKOŚĆ:** daty/etykiety okresu poprawne.
- **GRAFIKA:** label okresu.
- **Screenshot:** `rep-08-period.png`
- **OCENA:** (a) okresy; (b) label. · **Wykonanie:** Headless ✅

### REP-09 — Katalog raportów (presety audience/cadence)
- **Powierzchnia:** ExecutionHub reportPresets · **Typ:** happy-path
- **Kroki:** odczytaj katalog.
- **JAKOŚĆ:** presety Weekly/Monthly/Bi-weekly/On-demand/Sponsor; etykiety z `t()` (i18n F2).
- **GRAFIKA:** chipy presetów.
- **Screenshot:** `rep-09-catalog.png`
- **OCENA:** (a) presety i18n; (b) chipy. · **Wykonanie:** Headless 🟡

### REP-10 — Eksport (PDF/DOCX/MD)
- **Powierzchnia:** exportReportPDF · **Typ:** funkcja
- **Kroki:** eksport.
- **JAKOŚĆ:** eksportuje (uwaga: obecnie Markdown; server-PDF=F8).
- **GRAFIKA:** N/A.
- **Screenshot:** `rep-10-export.png`
- **OCENA:** (a) eksport działa; (b) N/A. · **Wykonanie:** ❌ real-browser (download)

### REP-11 — History sekcji (report_section_history)
- **Powierzchnia:** report_section_history · **Typ:** poprawność · **Kroki:** 2 generacje → odczyt historii.
- **JAKOŚĆ:** snapshot per generacja. **GRAFIKA:** N/A.
- **Screenshot:** `rep-11-section-history.png` · **OCENA:** (a) snapshoty; (b) N/A. · **Wykonanie:** Headless ✅

### REP-12 — Trend vs poprzedni raport
- **Powierzchnia:** generateReport trend · **Typ:** poprawność · **Kroki:** 2 raporty z różnym progresem.
- **JAKOŚĆ:** overall_trend (up/down/flat) vs poprzedni. **GRAFIKA:** strzałka trendu.
- **Screenshot:** `rep-12-trend.png` · **OCENA:** (a) trend; (b) strzałka. · **Wykonanie:** Headless ✅

### REP-13 — Degradacja generacji (brak danych)
- **Powierzchnia:** generateReport · **Typ:** degradacja · **Kroki:** inicjatywa bez tasks/RAID.
- **JAKOŚĆ:** raport generuje z sekcjami NA/empty, nie crash. **GRAFIKA:** sekcje neutralne.
- **Screenshot:** `rep-13-degraded.png` · **OCENA:** (a) brak crasha; (b) neutralne. · **Wykonanie:** Headless ✅

### REP-14 — Pusty-stan katalogu raportów
- **Powierzchnia:** ExecutionHub reports empty · **Typ:** pusty-stan · **Kroki:** brak raportów.
- **JAKOŚĆ:** empty-copy + CTA generuj. **GRAFIKA:** centrowany.
- **Screenshot:** `rep-14-empty.png` · **OCENA:** (a) empty+CTA; (b) kanon. · **Wykonanie:** Headless 🟡

### REP-15 — Audience-tiering presetów
- **Powierzchnia:** reportPresets audience · **Typ:** happy-path · **Kroki:** odczytaj audience/cadence per preset.
- **JAKOŚĆ:** PMO/Steering/Finance/Sponsors; cadence Weekly/Monthly/Bi-weekly. **GRAFIKA:** chipy.
- **Screenshot:** `rep-15-audience-tiering.png` · **OCENA:** (a) tiering; (b) chipy. · **Wykonanie:** Headless 🟡

### REP-16 — ReportDocumentView (pełny raport)
- **Powierzchnia:** ReportDocumentView · **Typ:** happy-path · **Kroki:** otwórz raport.
- **JAKOŚĆ:** sekcje SCHEDULE/BUDGET/SCOPE/QUALITY/RISKS/RESOURCES + narracja + escalations. **GRAFIKA:** layout dokumentu.
- **Screenshot:** `rep-16-document-view.png` · **OCENA:** (a) sekcje+narracja; (b) layout. · **Wykonanie:** Headless 🟡

### REP-17 — Copy-to-clipboard raportu
- **Powierzchnia:** copy · **Typ:** funkcja · **Kroki:** klik Copy.
- **JAKOŚĆ:** treść do schowka + toast „copied". **GRAFIKA:** toast.
- **Screenshot:** `rep-17-copy.png` · **OCENA:** (a) copy+toast; (b) toast. · **Wykonanie:** ❌ real-browser (clipboard)

### REP-18 — Weekly pack (szybki pakiet)
- **Powierzchnia:** weeklyPack · **Typ:** happy-path · **Kroki:** generuj weekly pack.
- **JAKOŚĆ:** prosty pakiet tygodniowy z live-data. **GRAFIKA:** pack layout.
- **Screenshot:** `rep-18-weekly-pack.png` · **OCENA:** (a) pakiet; (b) layout. · **Wykonanie:** Headless 🟡

### REP-19 — Approval read-back badge
- **Powierzchnia:** approve readback · **Typ:** workflow · **Kroki:** approve → odczytaj badge.
- **JAKOŚĆ:** badge APPROVED + approved_by widoczny po read-back. **GRAFIKA:** badge.
- **Screenshot:** `rep-19-approval-readback.png` · **OCENA:** (a) read-back; (b) badge. · **Wykonanie:** Headless 🟡

### REP-20 — Distribution log (report_distributions)
- **Powierzchnia:** report_distributions · **Typ:** known-gap · **Kroki:** distribute PUBLISHED → odczyt log.
- **JAKOŚĆ:** wpis w report_distributions; UWAGA: e-mail nie wysyłany (gap F6 — worker). **GRAFIKA:** lista odbiorców.
- **Screenshot:** `rep-20-distribution-log.png` · **OCENA:** (a) log (e-mail=F6); (b) lista. · **Wykonanie:** Headless ✅ (API)

### REP-21 — Multi-okres (Weekly+Monthly tej samej inicjatywy)
- **Powierzchnia:** status_reports per period · **Typ:** edge · **Kroki:** generuj weekly i monthly.
- **JAKOŚĆ:** osobne rekordy per periodType; nie nadpisują. **GRAFIKA:** lista raportów.
- **Screenshot:** `rep-21-multi-period.png` · **OCENA:** (a) osobne rekordy; (b) lista. · **Wykonanie:** Headless ✅

### REP-22 — Dark mode Reporting
- **Powierzchnia:** reports dark · **Typ:** grafika · **GRAFIKA:** RAG czytelne dark; brak crimson-leak.
- **Screenshot:** `rep-22-dark.png` · **OCENA:** (a) dane; (b) dark. · **Wykonanie:** Headless ✅

### REP-23 — Light mode Reporting
- **Powierzchnia:** reports light · **Typ:** grafika · **GRAFIKA:** brak danger-fill na normalnych sekcjach.
- **Screenshot:** `rep-23-light.png` · **OCENA:** (a) dane; (b) light. · **Wykonanie:** Headless ✅

### REP-24 — i18n PL/EN raporty
- **Powierzchnia:** reports t() · **Typ:** i18n · **JAKOŚĆ:** etykiety+presety z `t()`. **GRAFIKA:** brak overflow PL.
- **Screenshot:** `rep-24-i18n.png` · **OCENA:** (a) tłumaczenia; (b) overflow. · **Wykonanie:** Headless 🟡

### REP-25 — Filtr presetu (Weekly/Sponsor)
- **Powierzchnia:** reportPresets filter · **Typ:** interakcja · **Kroki:** klik preset → filtruje katalog.
- **JAKOŚĆ:** katalog zawężony do presetu. **GRAFIKA:** chip aktywny.
- **Screenshot:** `rep-25-preset-filter.png` · **OCENA:** (a) filtr; (b) chip. · **Wykonanie:** Headless 🟡

### REP-26 — Teresa chat z kontekstem raportu
- **Powierzchnia:** AI context · **Typ:** AI-live · **Kroki:** czat „podsumuj status".
- **JAKOŚĆ:** odpowiedź grounded na danych raportu. **GRAFIKA:** pigułka AI.
- **Screenshot:** `rep-26-teresa-context.png` · **OCENA:** (a) grounded; (b) pigułka. · **Wykonanie:** ❌ real-browser (AI)

### REP-27 — Zero console errors Reporting
- **Powierzchnia:** reports · **Typ:** stabilność · **JAKOŚĆ:** brak błędów. **GRAFIKA:** N/A.
- **Screenshot:** `rep-27-console-clean.png` · **OCENA:** (a) 0 błędów; (b) N/A. · **Wykonanie:** Headless ✅

### REP-28 — Perf generacji
- **Powierzchnia:** generateReport · **Typ:** wydajność · **JAKOŚĆ:** generacja < ~3s; brak N+1. **GRAFIKA:** N/A.
- **Screenshot:** `rep-28-perf.png` · **OCENA:** (a) czas; (b) N/A. · **Wykonanie:** Headless ✅ (timing)

### REP-29 — Narracja szablonowa (znany gap → F6 AI)
- **Powierzchnia:** generateNarrative · **Typ:** known-gap · **Kroki:** odczytaj narrację.
- **JAKOŚĆ:** obecnie string-template (nie AI); UWAGA: AI-narracja=F6. **GRAFIKA:** czytelna.
- **Screenshot:** `rep-29-narrative.png` · **OCENA:** (a) potwierdza gap+treść poprawna; (b) czytelność. · **Wykonanie:** Headless ✅

### REP-30 — Kadencja bez schedulera (znany gap → F6)
- **Powierzchnia:** cadence · **Typ:** known-gap · **Kroki:** sprawdź auto-generację.
- **JAKOŚĆ:** brak crona (manual `POST /generate`); UWAGA: scheduler=F6. **GRAFIKA:** N/A.
- **Screenshot:** `rep-30-cadence.png` · **OCENA:** (a) potwierdza gap; (b) N/A. · **Wykonanie:** Headless ✅

---

# POWIERZCHNIA 4 — MANAGER / PEOPLE-CHANGE (MGR-01…30)

> Zakładka Management: manager lanes (action-queue/decisions/blockers/people-change) + People-Change Workspace (capability/sentiment/communication) + AI.

### MGR-01 — Lanes ładują problemy
- **Powierzchnia:** `/v8/execution-control/manager/lanes/:id/problems` · **Typ:** happy-path
- **Kroki:** otwórz lane.
- **JAKOŚĆ:** problemy grounded (initiatives/tasks/decisions/RAID).
- **GRAFIKA:** karty problemów severity.
- **Screenshot:** `docs/qa/screens/m14-exec/manager/mgr-01-lanes.png`
- **OCENA:** (a) grounded; (b) severity. · **Wykonanie:** Headless 🟡

### MGR-02 — SLA decyzji per-priority (F3)
- **Powierzchnia:** buildDecisions · **Typ:** poprawność
- **Kroki:** decyzje Crit/High/Med/Low overdue.
- **JAKOŚĆ:** SLA 2/3/7/14d; krytyczna eskaluje szybciej (severity).
- **GRAFIKA:** severity dot.
- **Screenshot:** `mgr-02-decision-sla.png`
- **OCENA:** (a) SLA per-priority; (b) dot. · **Wykonanie:** Headless ✅ (test 3/3)

### MGR-03 — Action Queue lane (overdue/blocked/issues)
- **Powierzchnia:** buildActionQueue · **Typ:** happy-path
- **Kroki:** odczytaj action-queue lane.
- **JAKOŚĆ:** tasks overdue/BLOCKED, RAID issues; severity.
- **GRAFIKA:** sort severity.
- **Screenshot:** `mgr-03-action-queue-lane.png`
- **OCENA:** (a) typy; (b) sort. · **Wykonanie:** Headless 🟡

### MGR-04 — Blockers lane (critical)
- **Powierzchnia:** buildBlockers · **Typ:** happy-path
- **Kroki:** BLOCKED inicjatywy/tasks.
- **JAKOŚĆ:** zawsze critical; akcje unblock/escalate/scope_reduction.
- **GRAFIKA:** danger uzasadniony.
- **Screenshot:** `mgr-04-blockers-lane.png`
- **OCENA:** (a) blokery; (b) danger. · **Wykonanie:** Headless 🟡

### MGR-05 — People-Change lane (governance)
- **Powierzchnia:** buildPeopleChange · **Typ:** happy-path
- **Kroki:** otwórz people-change.
- **JAKOŚĆ:** no_owner/no_sponsor/no_dates/bus_factor.
- **GRAFIKA:** lane karty.
- **Screenshot:** `mgr-05-people-change.png`
- **OCENA:** (a) governance gaps; (b) karty. · **Wykonanie:** Headless 🟡

### MGR-06 — Wykonanie akcji (replan/reassign/escalate)
- **Powierzchnia:** executeManagerProblemAction · **Typ:** interakcja+persist
- **Kroki:** wykonaj akcję.
- **JAKOŚĆ:** realna mutacja (forecast_*/assignee/status); readback kolejek; audit log.
- **GRAFIKA:** stan po readback.
- **Screenshot:** `mgr-06-action-execute.png`
- **OCENA:** (a) mutacja+readback+audit; (b) stan. · **Wykonanie:** ❌ real-browser (akcja)

### MGR-07 — scope_reduction → forecast (P0, baseline integrity)
- **Powierzchnia:** managerActionExecutionService:316 · **Typ:** poprawność
- **Kroki:** wykonaj scope_reduction.
- **JAKOŚĆ:** pisze `forecast_end_date` (NIE planned_end_date); baseline zachowany.
- **GRAFIKA:** N/A.
- **Screenshot:** `mgr-07-scope-reduction-forecast.png`
- **OCENA:** (a) forecast nie baseline; (b) N/A. · **Wykonanie:** Headless ✅ (API)

### MGR-08 — Capability / Training Needs
- **Powierzchnia:** PeopleChangeWorkspace capability · **Typ:** happy-path
- **Kroki:** capability → odczytaj gaps.
- **JAKOŚĆ:** `/capabilities` + requirements + match (gaps).
- **GRAFIKA:** lista luk.
- **Screenshot:** `mgr-08-capability.png`
- **OCENA:** (a) gaps; (b) lista. · **Wykonanie:** Headless 🟡

### MGR-09 — Change sentiment / pulse
- **Powierzchnia:** changeSentimentService · **Typ:** happy-path
- **Kroki:** sentiment → pulse summary + alerts.
- **JAKOŚĆ:** avg/trend/resistance-alerts.
- **GRAFIKA:** trend wykres.
- **Screenshot:** `mgr-09-sentiment.png`
- **OCENA:** (a) metryki; (b) trend. · **Wykonanie:** Headless 🟡

### MGR-10 — Stakeholder communication (send=atrapa)
- **Powierzchnia:** stakeholderCommService · **Typ:** known-gap
- **Kroki:** „send" plan item.
- **JAKOŚĆ:** status='sent' + log; UWAGA: nie wysyła e-maila (gap F6).
- **GRAFIKA:** status sent.
- **Screenshot:** `mgr-10-stakeholder-send.png`
- **OCENA:** (a) status+log (e-mail=F6); (b) status. · **Wykonanie:** 🟡

### MGR-11 — AI recommend/triage (grounded?)
- **Powierzchnia:** managerAiService · **Typ:** AI-live
- **Kroki:** AI recommend per lane.
- **JAKOŚĆ:** rekomendacja LLM (people-change prompt); UWAGA: karmiony tylko governance (gap F6).
- **GRAFIKA:** pigułka AI.
- **Screenshot:** `mgr-11-ai-recommend.png`
- **OCENA:** (a) rekomendacja; (b) pigułka. · **Wykonanie:** ❌ real-browser (AI live)

### MGR-12 — Gating V8 (baner gdy off)
- **Powierzchnia:** people_change V8 flag · **Typ:** degradacja
- **Kroki:** V8 off.
- **JAKOŚĆ:** baner degradacji.
- **GRAFIKA:** baner.
- **Screenshot:** `mgr-12-v8-gating.png`
- **OCENA:** (a) baner; (b) kanon. · **Wykonanie:** Headless 🟡

### MGR-13 — Decisions lane (overdue/pending z SLA)
- **Powierzchnia:** buildDecisions lane · **Typ:** happy-path · **Kroki:** otwórz decisions lane.
- **JAKOŚĆ:** overdue/pending z severity per-priority (F3). **GRAFIKA:** karty.
- **Screenshot:** `mgr-13-decisions-lane.png` · **OCENA:** (a) SLA severity; (b) karty. · **Wykonanie:** Headless 🟡

### MGR-14 — Workload lane (overload)
- **Powierzchnia:** buildWorkload · **Typ:** happy-path · **Kroki:** owner ≥ próg zadań.
- **JAKOŚĆ:** overload flagowany (OVERLOAD_THRESHOLD). **GRAFIKA:** karty obciążenia.
- **Screenshot:** `mgr-14-workload.png` · **OCENA:** (a) overload; (b) karty. · **Wykonanie:** Headless 🟡

### MGR-15 — Risk lane (RAID issues/deps)
- **Powierzchnia:** buildBlockers RAID · **Typ:** happy-path · **Kroki:** risk lane.
- **JAKOŚĆ:** ISSUE/DEPENDENCY z risk_score; critical ≥10. **GRAFIKA:** severity.
- **Screenshot:** `mgr-15-risk-lane.png` · **OCENA:** (a) score; (b) severity. · **Wykonanie:** Headless 🟡

### MGR-16 — Apply suggestion bulk (executeByPrefix)
- **Powierzchnia:** applyManagerSuggestion · **Typ:** interakcja+persist · **Kroki:** AI manage-all → bulk akcje.
- **JAKOŚĆ:** bulk wykonuje po prefiksie; readback. **GRAFIKA:** stan po readback.
- **Screenshot:** `mgr-16-bulk-suggestion.png` · **OCENA:** (a) bulk+readback; (b) stan. · **Wykonanie:** ❌ real-browser

### MGR-17 — Empty-state lane (brak problemów)
- **Powierzchnia:** lane empty · **Typ:** pusty-stan · **Kroki:** lane bez problemów.
- **JAKOŚĆ:** empty-copy „brak inicjatyw w realizacji" (i18n). **GRAFIKA:** centrowany.
- **Screenshot:** `mgr-17-lane-empty.png` · **OCENA:** (a) empty; (b) kanon. · **Wykonanie:** Headless 🟡

### MGR-18 — Read-back po akcji (mandatory)
- **Powierzchnia:** refreshControlTower · **Typ:** poprawność · **Kroki:** wykonaj akcję → readback.
- **JAKOŚĆ:** kolejki odświeżone po akcji (mandatory readback). **GRAFIKA:** liczniki zaktualizowane.
- **Screenshot:** `mgr-18-readback.png` · **OCENA:** (a) readback; (b) liczniki. · **Wykonanie:** ❌ real-browser

### MGR-19 — Escalate → tworzy RAID
- **Powierzchnia:** /interventions/escalate · **Typ:** persist · **Kroki:** escalate problem.
- **JAKOŚĆ:** trwały raid_items + audit. **GRAFIKA:** potwierdzenie.
- **Screenshot:** `mgr-19-escalate-raid.png` · **OCENA:** (a) RAID+audit; (b) potwierdzenie. · **Wykonanie:** Headless ✅ (API)

### MGR-20 — Stakeholder segments
- **Powierzchnia:** stakeholderCommService segments · **Typ:** happy-path · **Kroki:** odczytaj segmenty.
- **JAKOŚĆ:** segmenty interesariuszy z wpływem. **GRAFIKA:** lista segmentów.
- **Screenshot:** `mgr-20-segments.png` · **OCENA:** (a) segmenty; (b) lista. · **Wykonanie:** Headless 🟡

### MGR-21 — Stakeholder plans + overdue
- **Powierzchnia:** getStakeholderPlans/OverduePlans · **Typ:** happy-path · **Kroki:** odczytaj plany.
- **JAKOŚĆ:** plany komunikacji + overdue oznaczone. **GRAFIKA:** overdue badge.
- **Screenshot:** `mgr-21-plans.png` · **OCENA:** (a) plany+overdue; (b) badge. · **Wykonanie:** Headless 🟡

### MGR-22 — Steerco pack distribute
- **Powierzchnia:** distributeSteercoPack · **Typ:** known-gap · **Kroki:** distribute pack.
- **JAKOŚĆ:** log; UWAGA: e-mail nie wysyłany (gap F6). **GRAFIKA:** potwierdzenie.
- **Screenshot:** `mgr-22-steerco.png` · **OCENA:** (a) log (e-mail=F6); (b) potwierdzenie. · **Wykonanie:** 🟡

### MGR-23 — Capability match-candidates
- **Powierzchnia:** /capabilities/match · **Typ:** happy-path · **Kroki:** match → kandydaci.
- **JAKOŚĆ:** required vs actual → gaps + kandydaci. **GRAFIKA:** lista dopasowań.
- **Screenshot:** `mgr-23-capability-match.png` · **OCENA:** (a) match+gaps; (b) lista. · **Wykonanie:** Headless 🟡

### MGR-24 — Sentiment acknowledge alert
- **Powierzchnia:** /change-sentiment/alerts/:id/acknowledge · **Typ:** interakcja · **Kroki:** ack resistance alert.
- **JAKOŚĆ:** alert→acknowledged; znika z aktywnych. **GRAFIKA:** stan ack.
- **Screenshot:** `mgr-24-sentiment-ack.png` · **OCENA:** (a) ack; (b) stan. · **Wykonanie:** ❌ real-browser

### MGR-25 — ADKAR roll-up (znany gap → F6)
- **Powierzchnia:** people-change · **Typ:** known-gap · **Kroki:** szukaj scoringu A/D/K/A/R.
- **JAKOŚĆ:** UWAGA: brak roll-upu (engine w _backup, gap F6); 3 pod-zakładki działają osobno. **GRAFIKA:** N/A.
- **Screenshot:** `mgr-25-adkar-gap.png` · **OCENA:** (a) potwierdza gap; (b) N/A. · **Wykonanie:** Headless 🟡

### MGR-26 — Champions (znany gap → F6)
- **Powierzchnia:** people-change · **Typ:** known-gap · **Kroki:** szukaj champion network.
- **JAKOŚĆ:** UWAGA: brak warstwy Champions (gap F6). **GRAFIKA:** N/A.
- **Screenshot:** `mgr-26-champions-gap.png` · **OCENA:** (a) potwierdza gap; (b) N/A. · **Wykonanie:** Headless 🟡

### MGR-27 — Dark mode Manager
- **Powierzchnia:** management dark · **Typ:** grafika · **GRAFIKA:** kontrast lane/karty.
- **Screenshot:** `mgr-27-dark.png` · **OCENA:** (a) dane; (b) dark. · **Wykonanie:** Headless ✅

### MGR-28 — Light mode Manager
- **Powierzchnia:** management light · **Typ:** grafika · **GRAFIKA:** brak danger-fill poza critical.
- **Screenshot:** `mgr-28-light.png` · **OCENA:** (a) dane; (b) light. · **Wykonanie:** Headless ✅

### MGR-29 — i18n + zero console Manager
- **Powierzchnia:** management t() · **Typ:** i18n+stabilność · **JAKOŚĆ:** `t()` + brak błędów konsoli. **GRAFIKA:** brak overflow PL.
- **Screenshot:** `mgr-29-i18n-console.png` · **OCENA:** (a) tłumaczenia+0-błędów; (b) overflow. · **Wykonanie:** Headless 🟡

### MGR-30 — Perf lanes
- **Powierzchnia:** managerProblemsService · **Typ:** wydajność · **JAKOŚĆ:** lane < ~1.5s; brak N+1. **GRAFIKA:** N/A.
- **Screenshot:** `mgr-30-perf.png` · **OCENA:** (a) czas; (b) N/A. · **Wykonanie:** Headless ✅ (timing)

---

# POWIERZCHNIA 5 — RAID / CONTROL TOWER (RAID-01…30)

> RAID (Risk/Assumption/Issue/Dependency + scoring/appetite/heatmap) + Execution Control (sygnały + control-tower + interventions).

### RAID-01 — Risk CRUD + scoring kanoniczny
- **Powierzchnia:** `/api/raid` + raidScoringService · **Typ:** happy-path
- **Kroki:** dodaj risk z P/I.
- **JAKOŚĆ:** risk_score=calculateRiskScore; score_category=categorizeScore.
- **GRAFIKA:** badge kategorii.
- **Screenshot:** `docs/qa/screens/m14-exec/raid/raid-01-risk-crud.png`
- **OCENA:** (a) scoring kanoniczny; (b) badge. · **Wykonanie:** Headless ✅ (API)

### RAID-02 — Heatmap filtr aktywnych (P0)
- **Powierzchnia:** `/raid/scoring/heatmap` · **Typ:** poprawność
- **Kroki:** ryzyka OPEN i CLOSED/REALIZED.
- **JAKOŚĆ:** heatmapa liczy tylko NOT IN(CLOSED,REALIZED) (nie zawyża czerwieni).
- **GRAFIKA:** macierz P×I.
- **Screenshot:** `raid-02-heatmap-active.png`
- **OCENA:** (a) wyklucza zamknięte; (b) macierz. · **Wykonanie:** Headless ✅

### RAID-03 — APPETITE_BREACH (auto_escalate_above, F3)
- **Powierzchnia:** detectRiskSignals · **Typ:** poprawność
- **Kroki:** ryzyko score≥próg org.
- **JAKOŚĆ:** sygnał APPETITE_BREACH (CRITICAL); próg z raid_appetite_thresholds (fallback default).
- **GRAFIKA:** N/A (sygnał).
- **Screenshot:** `raid-03-appetite-breach.png`
- **OCENA:** (a) breach przy ≥próg; (b) N/A. · **Wykonanie:** Headless ✅ (test 4/4)

### RAID-04 — Kanoniczna eskalacja (HIGH×LOW nie eskaluje, F3)
- **Powierzchnia:** detectRiskSignals · **Typ:** poprawność
- **Kroki:** ryzyko HIGH×LOW (score 3=GREEN).
- **JAKOŚĆ:** NIE generuje UNOWNED/UNMITIGATED/APPETITE (GREEN); AMBER+ tak.
- **GRAFIKA:** N/A.
- **Screenshot:** `raid-04-canonical-escalation.png`
- **OCENA:** (a) GREEN nie eskaluje; (b) N/A. · **Wykonanie:** Headless ✅ (test 4/4)

### RAID-05 — Appetite thresholds GET/PUT
- **Powierzchnia:** `/raid/scoring/thresholds` · **Typ:** config
- **Kroki:** PUT progi org → GET.
- **JAKOŚĆ:** zapis+odczyt per org; auto_escalate_above teraz czytany (RAID-03).
- **GRAFIKA:** N/A.
- **Screenshot:** `raid-05-thresholds.png`
- **OCENA:** (a) persist+czytany; (b) N/A. · **Wykonanie:** Headless ✅

### RAID-06 — Risk signals (UNOWNED/UNMITIGATED/OVERDUE)
- **Powierzchnia:** riskDetectionService · **Typ:** happy-path
- **Kroki:** odczytaj risk-signals.
- **JAKOŚĆ:** sygnały z dismissals respect; org-guard.
- **GRAFIKA:** lista sygnałów.
- **Screenshot:** `raid-06-risk-signals.png`
- **OCENA:** (a) sygnały+dismiss; (b) lista. · **Wykonanie:** Headless 🟡

### RAID-07 — Delay signals + „why slip"
- **Powierzchnia:** delayDetectionService · **Typ:** happy-path
- **Kroki:** odczytaj delay-signals.
- **JAKOŚĆ:** LATE_START/FINISH/DEADLINE + progi per priorytet + why-slip context.
- **GRAFIKA:** sygnały.
- **Screenshot:** `raid-07-delay-signals.png`
- **OCENA:** (a) why-slip; (b) lista. · **Wykonanie:** Headless 🟡

### RAID-08 — Control Tower 5 kolejek
- **Powierzchnia:** v8ExecutionControlTowerService · **Typ:** happy-path
- **Kroki:** control-tower/health.
- **JAKOŚĆ:** late/at-risk/blocked/overloaded/stale; dedup; degraded posture.
- **GRAFIKA:** 5 kolejek.
- **Screenshot:** `raid-08-control-tower.png`
- **OCENA:** (a) 5 kolejek; (b) drill-down. · **Wykonanie:** Headless 🟡

### RAID-09 — Baseline-variance (missing_baseline posture)
- **Powierzchnia:** `/baseline-variance/:id` · **Typ:** poprawność
- **Kroki:** inicjatywa bez/z planned dates.
- **JAKOŚĆ:** wariancja dni; explicit missing_baseline gdy brak.
- **GRAFIKA:** N/A.
- **Screenshot:** `raid-09-baseline-variance.png`
- **OCENA:** (a) posture; (b) N/A. · **Wykonanie:** Headless ✅

### RAID-10 — Intervention escalate (RAID + readback + audit)
- **Powierzchnia:** `/interventions/escalate` · **Typ:** interakcja+persist
- **Kroki:** escalate.
- **JAKOŚĆ:** tworzy realny raid_items + audit + mandatory readback kolejek.
- **GRAFIKA:** stan po readback.
- **Screenshot:** `raid-10-escalate.png`
- **OCENA:** (a) RAID+audit+readback; (b) stan. · **Wykonanie:** ❌ real-browser

### RAID-11 — Intervention permission-gate (VIEWER 403)
- **Powierzchnia:** checkInterventionPermission · **Typ:** RBAC
- **Kroki:** VIEWER intervention.
- **JAKOŚĆ:** 403 z whatNext; org-scoped; 404 obca encja.
- **GRAFIKA:** N/A.
- **Screenshot:** `raid-11-intervention-gate.png`
- **OCENA:** (a) 403/404; (b) N/A. · **Wykonanie:** Headless ✅ (test pokrywa)

### RAID-12 — Bounded intervention (baseline preserved)
- **Powierzchnia:** smooth/replan · **Typ:** poprawność
- **Kroki:** smooth/replan.
- **JAKOŚĆ:** pisze forecast_*, NIE planned_* (baseline integrity).
- **GRAFIKA:** N/A.
- **Screenshot:** `raid-12-bounded.png`
- **OCENA:** (a) forecast nie baseline; (b) N/A. · **Wykonanie:** Headless ✅

### RAID-13 — Assumption widoczność (znany gap → F8)
- **Powierzchnia:** detectRiskSignals (type!==RISK) · **Typ:** known-gap · **Kroki:** dodaj ASSUMPTION.
- **JAKOŚĆ:** UWAGA: niewidoczne dla governance (gap F8 — validation). **GRAFIKA:** wiersz RAID.
- **Screenshot:** `raid-13-assumption-gap.png` · **OCENA:** (a) potwierdza gap; (b) wiersz. · **Wykonanie:** Headless 🟡

### RAID-14 — Issue linked_items (znany gap)
- **Powierzchnia:** raid_items linked_items · **Typ:** known-gap · **Kroki:** materializacja risk→issue.
- **JAKOŚĆ:** UWAGA: linked_items nigdy nie zapisywane (gap F8). **GRAFIKA:** N/A.
- **Screenshot:** `raid-14-issue-linked-gap.png` · **OCENA:** (a) potwierdza gap; (b) N/A. · **Wykonanie:** Headless ✅

### RAID-15 — Dependency model (znany gap → F8)
- **Powierzchnia:** DEPENDENCY · **Typ:** known-gap · **Kroki:** dodaj DEPENDENCY.
- **JAKOŚĆ:** UWAGA: płaski wiersz (brak kierunku/grafu, gap F8). **GRAFIKA:** wiersz.
- **Screenshot:** `raid-15-dependency-gap.png` · **OCENA:** (a) potwierdza gap; (b) wiersz. · **Wykonanie:** Headless 🟡

### RAID-16 — Heatmap drill-down (komórka → lista)
- **Powierzchnia:** buildHeatmap items · **Typ:** interakcja · **Kroki:** klik komórki P×I.
- **JAKOŚĆ:** lista ryzyk w komórce (items[]). **GRAFIKA:** drill-down panel.
- **Screenshot:** `raid-16-heatmap-drill.png` · **OCENA:** (a) lista; (b) panel. · **Wykonanie:** ❌ real-browser (klik)

### RAID-17 — Matryca 3×4 (5×5 = F8)
- **Powierzchnia:** buildHeatmap · **Typ:** known-gap · **Kroki:** odczytaj wymiar.
- **JAKOŚĆ:** obecnie 3×4=12 komórek; UWAGA: 5×5=F8. **GRAFIKA:** macierz.
- **Screenshot:** `raid-17-matrix-3x4.png` · **OCENA:** (a) 3×4 + gap-notatka; (b) macierz. · **Wykonanie:** Headless ✅

### RAID-18 — Budget signals (overspend)
- **Powierzchnia:** executionBudgetService · **Typ:** happy-path · **Kroki:** overspend.
- **JAKOŚĆ:** detectOverspendSignals; initiative/portfolio summary. **GRAFIKA:** sygnał budżetu.
- **Screenshot:** `raid-18-budget-signals.png` · **OCENA:** (a) overspend; (b) sygnał. · **Wykonanie:** Headless 🟡

### RAID-19 — Capacity signals (overload)
- **Powierzchnia:** workloadCapacityService · **Typ:** happy-path · **Kroki:** overload.
- **JAKOŚĆ:** getLevelingAlerts/capacityTimeline. **GRAFIKA:** sygnał capacity.
- **Screenshot:** `raid-19-capacity-signals.png` · **OCENA:** (a) overload; (b) sygnał. · **Wykonanie:** Headless 🟡

### RAID-20 — Dismiss signal (org-guard L-03)
- **Powierzchnia:** risk-signals dismiss · **Typ:** security · **Kroki:** dismiss + cross-org dismiss.
- **JAKOŚĆ:** dismiss respektowany; cross-org zablokowany. **GRAFIKA:** sygnał znika.
- **Screenshot:** `raid-20-dismiss-guard.png` · **OCENA:** (a) org-guard; (b) znika. · **Wykonanie:** Headless ✅

### RAID-21 — Control-tower stale queue (STALE_DAYS=14)
- **Powierzchnia:** controlTower stale · **Typ:** poprawność · **Kroki:** inicjatywa stale>14d.
- **JAKOŚĆ:** trafia do kolejki stale. **GRAFIKA:** kolejka stale.
- **Screenshot:** `raid-21-stale.png` · **OCENA:** (a) stale; (b) kolejka. · **Wykonanie:** Headless 🟡

### RAID-22 — Intervention dry-run (znany gap → F7)
- **Powierzchnia:** interventions · **Typ:** known-gap · **Kroki:** szukaj dry-run.
- **JAKOŚĆ:** UWAGA: brak what-if/dry-run przed zapisem (gap F7). **GRAFIKA:** N/A.
- **Screenshot:** `raid-22-dryrun-gap.png` · **OCENA:** (a) potwierdza gap; (b) N/A. · **Wykonanie:** Headless 🟡

### RAID-23 — recalculate progi per-inicjatywa (znany gap)
- **Powierzchnia:** /scoring/recalculate · **Typ:** known-gap · **Kroki:** recalc z progami per-init.
- **JAKOŚĆ:** UWAGA: używa tylko org-level (gap — per-init ignorowane). **GRAFIKA:** N/A.
- **Screenshot:** `raid-23-recalc-gap.png` · **OCENA:** (a) potwierdza gap; (b) N/A. · **Wykonanie:** Headless ✅

### RAID-24 — Cross-module RAID↔initiative
- **Powierzchnia:** raid_items.initiative_id · **Typ:** integracja · **Kroki:** RAID linked do inicjatywy.
- **JAKOŚĆ:** RAID widoczny w dokumencie inicjatywy (M13) i w Execution. **GRAFIKA:** link.
- **Screenshot:** `raid-24-cross-module.png` · **OCENA:** (a) współdzielenie; (b) link. · **Wykonanie:** Headless 🟡

### RAID-25 — Response strategy 5T
- **Powierzchnia:** response_strategy · **Typ:** happy-path · **Kroki:** ustaw strategy.
- **JAKOŚĆ:** AVOID/MITIGATE/TRANSFER/ACCEPT/ESCALATE zapisywane. **GRAFIKA:** select strategy.
- **Screenshot:** `raid-25-response-5t.png` · **OCENA:** (a) 5T; (b) select. · **Wykonanie:** Headless 🟡

### RAID-26 — Mitigation lifecycle
- **Powierzchnia:** mitigation_status · **Typ:** workflow · **Kroki:** OPEN→...→CLOSED.
- **JAKOŚĆ:** lifecycle + owner + due_date. **GRAFIKA:** status.
- **Screenshot:** `raid-26-mitigation.png` · **OCENA:** (a) lifecycle; (b) status. · **Wykonanie:** Headless 🟡

### RAID-27 — Dark mode RAID/Control Tower
- **Powierzchnia:** dark · **Typ:** grafika · **GRAFIKA:** heatmapa+sygnały czytelne dark.
- **Screenshot:** `raid-27-dark.png` · **OCENA:** (a) dane; (b) dark. · **Wykonanie:** Headless ✅

### RAID-28 — Light mode RAID/Control Tower
- **Powierzchnia:** light · **Typ:** grafika · **GRAFIKA:** danger TYLKO RED/CRITICAL (uzasadniony).
- **Screenshot:** `raid-28-light.png` · **OCENA:** (a) dane; (b) danger-budżet. · **Wykonanie:** Headless ✅

### RAID-29 — i18n + zero console
- **Powierzchnia:** t() · **Typ:** i18n+stabilność · **JAKOŚĆ:** `t()` + 0 błędów konsoli. **GRAFIKA:** brak overflow.
- **Screenshot:** `raid-29-i18n-console.png` · **OCENA:** (a) tłumaczenia+0-błędów; (b) overflow. · **Wykonanie:** Headless 🟡

### RAID-30 — Perf signals (cały silnik)
- **Powierzchnia:** detectRiskSignals + control-tower · **Typ:** wydajność · **JAKOŚĆ:** sygnały < ~2s; brak N+1; appetite-fetch 1×. **GRAFIKA:** N/A.
- **Screenshot:** `raid-30-perf.png` · **OCENA:** (a) czas+zapytania; (b) N/A. · **Wykonanie:** Headless ✅ (timing)

---

## PODSUMOWANIE WYKONANIA
- **150 scenariuszy** (5 powierzchni × 30). Rozkład: ~80 ✅/🟡 headless (render/API/component → zdjęcia automatyczne metodą proxy), ~40 ❌ real-browser (modale CRUD, drag, AI live, persist round-trip, akcje interwencji), reszta = potwierdzenia znanych luk (wejście do F4–F8).
- **Faza testowania (osobny krok):** dla każdego scenariusza → wykonaj → zrzut do `docs/qa/screens/m14-exec/<powierzchnia>/` → ocena dwukryterialna (jakość + grafika) → PASS gdy oba. Scenariusze ROLL-21…30, REP-11…30, MGR-13…30, RAID-13…30 rozpisywane w pełni przy podejściu do danej powierzchni (szkielet+wzorzec gotowy).
- **Bramka:** ten plan = warstwa Manual w `M14-STAN-PRACY-ODBIORY.md` (kolumna Manual). Domknięcie Manual = wykonanie + dowody real-data, jak przy M13.
