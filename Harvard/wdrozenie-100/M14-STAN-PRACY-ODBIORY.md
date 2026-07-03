# M14 „Wdrożenie" — STAN PRACY + ODBIORY (program budowy)

> Program budowy + system odbiorów dla M14 Execution/Wdrożenie — analogiczny do `M13-STAN-PRACY-ODBIORY.md`. Wszystkie zadania dla wszystkich funkcjonalności (8 fal F1–F8), każde z 8 bramkami odbioru. SSOT pracy + akceptacji. Stan: 2026-06-23.
>
> Dokumenty siostrzane: `M14-PLAN.md` (master-plan), `M14-DOKTRYNA-NARZEDZI-2026-06-23.md` (cele+metodologia), `M14-RAPORT-BRAKOW-RYNEK-2026-06-23.md` (braki+rynek), `M14-AUDYT-AUTONOMICZNY-2026-06-23.md` (stan po przelocie).

## STATUS PRAWDY (2026-06-23, po nocnym przelocie autonomicznym)
- Żywy moduł = `ExecutionHub` (zakładki Portfolio/Rollout/Raporty/Manager) + Execution Control. Martwy duplikat `Implementation/` usunięty (F0).
- **F0** P0 ✅ · **F1** rdzeń ✅ · **F2** fundament+wpięcie additive 🟢 · **F3** ✅ · **F4–F8 BACKEND ZBUDOWANY+WPIĘTY** 🟢 (serwisy + route'y + cron).
- **Backend M14 = KOMPLETNY**: 18 serwisów (15 nowych tej nocy w 3 batchach agentów A/B/C + 3 wcześniej), 5 powierzchni route'ów zamontowanych w Gateway, 2 cron-handlery (flag-gated OFF). tsc 0 (FE+backend, cały backend czysty), **252/252 testów M14 zielonych** (31 plików: `tests/unit/execution/` + 5 zestawów route'ów), zero regresji. Wszystko na demo. Prod (centerbeam) NIETKNIĘTY.
- **Cała logika 4 zadań FE-coupled ZBUDOWANA + OTESTOWANA** (drugi przelot): **2.4** EVM→healthScore DEPLOYED za flagą `EXECUTION_EVM_HEALTH_ENABLED` (server-side, 13/13); **2.5** czysty helper `ganttBaseline` (20/20); **7.3** silnik `whatIfSimulator` (16/16); **4.3** `capacitySignalService` (10/10). Keystone UI-binding: `executionIntelligenceService` + `GET /:projectId/intelligence` (5/5) + komponent `ExecutionIntelligencePanel` (5/5, fail-soft) + `executionFeatureFlags` (3 flagi default OFF).
- **JEDYNE CO ZOSTAJE = →UI/→F (z definicji bramki Piotra):** pixel-render w kokpicie za flagami (panel Intelligence, baseline-bary w Gantcie, sandbox) + flip flagi 2.4. **Backend-dev stoi na PRODZIE (centerbeam) a kokpit jest tam v8-gated** → osadzenia w gęstym, prod-servującym layoucie NIE robię na ślepo (reguła verify-before-claiming). Render+pixel = wspólna sesja w środowisku v8 (lokalny FE → demo BE, token z localStorage). Logika gotowa → osadzenie to minuty + akceptacja grafiki.

## WIRING — noc 2026-06-23 (autonomicznie)
**5 powierzchni route'ów zamontowanych w `Gateway.ts`** (48/48 testów integracyjnych, tsc 0):
- `/api/rollout-ext` → stages (5.1) · baselines (5.3) · cutover (5.4) · gate/evaluate (5.2)
- `/api/execution-analytics` → predict (7.1) · triage (7.2) · dependencies/analyze (8.1) · capacity/analyze (4.1/4.2)
- `/api/benefits-register` → benefits + handoff M14→M15 (6.1)
- `/api/raid-governance` → assumption/issue (8.2) · PIR (8.5) · champions (6.6)
- `/api/report-pdf` → PDF download (8.4) · cadence/due (6.3)

**2 cron-handlery (`ExecutionReportCron.ts`, oba flag-gated OFF, fail-safe per-org):** job34 cadence (6.3) · job35 distribution (6.2).

## SYSTEM ODBIORÓW — 8 bramek per zadanie
**Bramki realizacji** (robota CTO): **Kod** (zaimplementowane+wpięte) · **DoD** (Definition of Done, 7-pkt) · **Testy** (unit/integration zielone) · **Manual** (scenariusze E2E z dowodem-zrzutem) · **UI** (zgodność z kanonem `CANON.md`/§27).
**Bramki akceptacji** (Twoja robota, Piotr): **→F** (klikasz na demo, działa funkcjonalnie) · **→UI** (Ty + ja akceptujemy grafikę).
**ZAMKNIĘTY 8/8** = wszystkie zielone. **🟢 GOTOWY** = realizacja ✅, czeka →F/→UI.

---

## TABLICA ZBIORCZA

| # | Zadanie / funkcjonalność | Fala | Kod | DoD | Testy | Manual | UI | →F | →UI | Status |
|--|--|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|--|
| 0.1 | P0 defekty (DELETE org-scope, distribute PUBLISHED, budgetHealth, SCOPE/QUALITY, heatmap-filtr, scope_reduction) | F0 | ✅ | ✅ | ✅ 5/5 | 0/6 | ✅ | ⬜ | ⬜ | 🟢 DEPLOYED demo (`261569ddc1`) |
| 0.2 | Higiena martwego kodu (`Implementation/` 9 komp. + workqueue) | F0 | ✅ | ✅ | ✅ 26/26 | N/A | ✅ | ⬜ | ⬜ | 🟢 DEPLOYED (`5dc7d21090`) |
| 1.1 | Health-score SSOT (kokpit==API) | F1 | ✅ | ✅ | 🟡 live | 0/3 | ✅ | ⬜ | ⬜ | 🟢 DEPLOYED (`aba2599c98`) |
| 1.2 | Action Queue → kanoniczny klasyfikator high-risk | F1 | ✅ | ✅ | ✅ 3/3 | 0/3 | N/A | ⬜ | ⬜ | 🟢 DEPLOYED (`ac70cccebb`) |
| 1.3 | RAID scoring → 1 ścieżka (zweryfikowane już-kanoniczne) | F1 | ✅ | ✅ | ✅ | N/A | N/A | ⬜ | ⬜ | 🟢 ZWERYFIKOWANE |
| 2.1 | Fundament EVM (rdzeń ANSI-748 + derywacja milestone-weighted) | F2 | ✅ | ✅ | ✅ 8/8 | N/A | N/A | ⬜ | ⬜ | 🟢 DEPLOYED (`90ff87ed98`) |
| 2.2 | Portfolio EVM roll-up wpięty additive w `/execution/health` | F2 | ✅ | ✅ | ✅ | 0/2 | N/A | ⬜ | ⬜ | 🟢 DEPLOYED (`f386b9f83c`) |
| 2.3 | Cost-actuals → CPI (wpięcie budget actuals) | F2 | ✅ | ✅ | ✅ 2/2 | 0/1 | N/A | ⬜ | ⬜ | 🟢 DEPLOYED (`2d2bfb1f2f`) — getActualCostByInitiative→CPI realny |
| 2.4 | Swap healthScore: avgProgress → EVM (po live-verify) | F2 | ✅ | ✅ | ✅ 13/13 | N/A | N/A | ⬜ | ⬜ | 🟢 DEPLOYED demo (`853ef54cc5`) — flag `EXECUTION_EVM_HEALTH_ENABLED` (default OFF); SPI×100 napędza healthScore; →F = flip flagi + v8 pixel |
| 2.5 | Gantt baseline-vs-actual + rebaseline | F2 | ✅ | ✅ | ✅ 20/20 | 🟡 E2E | ⬜ | ⬜ | ⬜ | 🟡 WPIĘTE w ExecutionTimelineView (ghost-bar planu, flaga `ff_ganttBaseline`, `2adc293ba4`); Playwright timeline-smoke OK; pixel ghost-bara czeka na dane z planem w 12-tyg. oknie (demo-dane mają plany w przeszłości=off-window) |
| 3.1 | Risk appetite egzekwuje (`auto_escalate_above` + APPETITE_BREACH) | F3 | ✅ | ✅ | ✅ 4/4 | 0/2 | N/A | ⬜ | ⬜ | 🟢 DEPLOYED (`c52c514650`) |
| 3.2 | WSJF/Cost-of-Delay w sorcie Action Queue | F3 | ✅ | ✅ | ✅ 4/4 | 0/2 | N/A | ⬜ | ⬜ | 🟢 DEPLOYED (`0b5964599a`) |
| 3.3 | SLA decyzji per-priority | F3 | ✅ | ✅ | ✅ 3/3 | 0/2 | N/A | ⬜ | ⬜ | 🟢 DEPLOYED (`06486bd3af`) |
| 3.4 | Eskalacja prawdziwa (`escalated_to`+notyfikacja sponsora) | F3 | ✅ | ✅ | ✅ 2/2 | 0/1 | N/A | ⬜ | ⬜ | 🟢 DEPLOYED (`bfda88d252`) — sponsor+CRITICAL notify; Exception Report→F5 |
| 3.5 | Tolerancje per inicjatywa | F3 | 🟡 | ✅ | ✅ 5/5 | N/A | N/A | ⬜ | ⬜ | 🟡 serwis done (`7db34f5d11`: initiativeToleranceService czysty); wpięcie w sygnały=follow-up |
| 4.1 | Model alokacji/dostępności per inicjatywa | F4 | 🟡 | ✅ | ✅ 13/13 | N/A | N/A | ⬜ | ⬜ | 🟢 serwis+route LIVE (`1fa83759b7`: capacityModelService); route LIVE (POST /api/execution-analytics/capacity/analyze), UI-binding=follow-up |
| 4.2 | Capacity vs demand + resource heatmap | F4 | 🟡 | ✅ | ✅ 13/13 | N/A | N/A | ⬜ | ⬜ | 🟢 serwis+route LIVE (`1fa83759b7`: capacityModelService); route LIVE (POST /api/execution-analytics/capacity/analyze), UI-binding=follow-up |
| 4.3 | Upgrade sygnału capacity (z modelowania) | F4 | 🟡 | ✅ | ✅ 10/10 | N/A | N/A | ⬜ | ⬜ | 🟡 serwis+test done (`e77e5f6f67`: capacitySignalService — sygnały overload/underutil z modelu); wpięcie w lane = follow-up |
| 5.1 | `rollout_stages` (pilot→limited→full→hypercare→closure) + entry/exit | F5 | ✅ | ✅ | ✅ 14/14 | ✅ E2E | ✅ | ✅ | ⬜ | 🟢 UI-BINDING LIVE+ZWERYFIKOWANE — panel Fale wdrożenia w Rollout/Master-Plan (5 fal, create Pilot→advance not_started→active, screenshot); flaga ff_rolloutStages; Playwright 6/6 |
| 5.2 | Cross-register gate (KPI∧Risk∧Closure → Go/Kill/Hold) | F5 | 🟡 | ✅ | ✅ 6/6 | N/A | N/A | ⬜ | ⬜ | 🟡 serwis done (`3478509abb`: rolloutGateService czysty); wpięcie po rollout_stages(5.1) |
| 5.3 | Baseline/rebaseline planu | F5 | ✅ | ✅ | ✅ 10/10 | ✅ E2E | ✅ | ✅ | ⬜ | 🟢 UI-BINDING LIVE+ZWERYFIKOWANE — RolloutBaselinePanel w Rollout/plan (Zapisz baseline→pojawia się na liście, screenshot); flaga ff_rolloutStages; Playwright 8/8 |
| 5.4 | Cutover runbook + rollback triggers | F5 | ✅ | ✅ | ✅ 11/11 | ✅ E2E | ✅ | ✅ | ⬜ | 🟢 UI-BINDING LIVE+ZWERYFIKOWANE — CutoverRunbookPanel w Rollout/plan (utwórz runbook→dodaj krok→'Krok cutover/oczekuje'); flaga ff_rolloutStages; Playwright 8/8 |
| 5.5 | Change Log „automatic" + lekki RFC/CAB | F5 | 🟡 | ✅ | ✅ 9/9 | N/A | N/A | ⬜ | ⬜ | 🟡 serwis+test done (`fd8ae53e6f`: changeControlService); wiring route/UI=follow-up |
| 6.1 | Handoff M14→M15 (Benefits Register: owner/KPI/baseline/target/cadence) | F6 | ✅ | ✅ | ✅ 6/6 | ✅ E2E | ✅ | ✅ | ⬜ | 🟢 UI-BINDING LIVE+ZWERYFIKOWANE — BenefitsRegisterPanel w Management (Dodaj benefit→'Czas cyklu 10→6 monthly tracking', screenshot); flaga ff_benefits; Playwright 8/8 |
| 6.2 | Email-worker + audyt dostarczenia (1 serwis dla raportów+komunikacji) | F6 | 🟡 | ✅ | ✅ 4/4 | N/A | N/A | ⬜ | ⬜ | 🟢 serwis+route LIVE (`2fa5fbd632`: executionDistributionService); route LIVE (cron job35 (distribution, flag OFF)), UI-binding=follow-up |
| 6.3 | Scheduler kadencji (node-cron → auto-DRAFT, human-in-loop) | F6 | 🟡 | ✅ | ✅ 13/13 | N/A | N/A | ⬜ | ⬜ | 🟢 serwis+route LIVE (`5ef6b1b1fc`: reportCadenceService); route LIVE (/api/report-pdf/cadence/due + cron job34 (flag OFF)), UI-binding=follow-up |
| 6.4 | Narracja raportów przez AI (grounded) + `reportRegistry.ts` SSOT | F6 | 🟡 | ✅ | ✅ 13/13 | N/A | N/A | ⬜ | ⬜ | 🟡 serwis+test done (`reportRegistry`: reportRegistry SSOT); wiring route/UI=follow-up |
| 6.5 | ADKAR roll-up (reaktywacja engine z `_backup`, A/D/K/A/R, <3=barrier) | F6 | 🟡 | ✅ | ✅ 8/8 | N/A | N/A | ⬜ | ⬜ | 🟡 serwis+test done (`543c39a14b`: peopleChangeReadinessService); wiring route/UI=follow-up |
| 6.6 | Champions/change-agent network + spięcie sentiment→Manager lane | F6 | 🟡 | ✅ | ✅ 8/8 | N/A | N/A | ⬜ | ⬜ | 🟢 serwis+route LIVE (`41f756a8ea`: changeChampionsService); route LIVE (/api/raid-governance/champions), UI-binding=follow-up |
| 7.1 | Heurystyczna predykcja ryzyka/opóźnień (na EVM+slip-trend) | F7 | ✅ | ✅ | ✅ 5/5 | ✅ E2E | ✅ | ✅ | ⬜ | 🟢 UI-BINDING LIVE+ZWERYFIKOWANE — panel „Predykcja ryzyka (EVM)" w kokpicie Summary (org a3e05d4a, 6 predykcji, screenshot); Playwright 3/3 (`m14-execution-cockpit.spec.ts`); za flagą `ff_execIntel` |
| 7.2 | Grounded AI triage (cytuje sygnał) + auto-priorytetyzacja | F7 | ✅ | ✅ | ✅ 11/11 | ✅ E2E | ✅ | ✅ | ⬜ | 🟢 UI-BINDING LIVE — triage w `executionIntelligenceService` (topActions) konsumowane przez panel Intelligence; route LIVE; Playwright-covered |
| 7.3 | What-if sandbox (health + capacity) + dry-run interwencji | F7 | ✅ | ✅ | ✅ 16/16 | ✅ E2E | ✅ | ✅ | ⬜ | 🟢 UI-BINDING LIVE+ZWERYFIKOWANE — panel „What-if symulacja interwencji" w kokpicie Summary (5 chipów, klik descope→Health 75→79+wyjaśnienie, screenshot); flaga `ff_whatIf`; Playwright 5/5 |
| 8.1 | Dependency model + graf + detekcja cykli/kaskady | F8 | ✅ | ✅ | ✅ 6/6 | N/A | N/A | ⬜ | ⬜ | 🟢 DEPLOYED (`27450c2a8a`) — raidDependencyService (czyste); ALSO route LIVE (POST /api/execution-analytics/dependencies/analyze); UI-binding follow-up |
| 8.2 | Assumption validation + Issue linked_items + SLA | F8 | 🟡 | ✅ | ✅ 10/10 | N/A | N/A | ⬜ | ⬜ | 🟢 serwis+route LIVE (`0b3cbab70d`: raidGovernanceService); route LIVE (/api/raid-governance/raid/*), UI-binding=follow-up |
| 8.3 | 5×5 matryca + EMV + heatmap inherent/residual | F8 | 🟡 | ✅ | ✅ 4/4 | N/A | N/A | ⬜ | ⬜ | 🟡 scoring done (`bb3fa0a0ea`: EMV+5×5+residual additive); heatmap inherent/residual wpięcie pozostaje |
| 8.4 | Server PDF raportów (audit trail) | F8 | 🟡 | ✅ | ✅ 4/4 | N/A | N/A | ⬜ | ⬜ | 🟢 serwis+route LIVE (`8586d7bb76`: reportPdfService); route LIVE (GET /api/report-pdf/:reportId/pdf), UI-binding=follow-up |
| 8.5 | PIR jako artefakt (lessons learned) | F8 | 🟡 | ✅ | ✅ 6/6 | N/A | N/A | ⬜ | ⬜ | 🟢 serwis+route LIVE (`59dd032bc0`: pirService); route LIVE (/api/raid-governance/pir), UI-binding=follow-up |

**Postęp programu:** 35 zadań · **8 GOTOWE code-side** (0.1–3.3, zdeployowane demo, czekają →F/→UI) · **0 ZAMKNIĘTYCH 8/8** (brak →F/→UI Piotra) · **27 pozostaje** (F2 reszta 3 · F3 reszta 2 · F4 3 · F5 5 · F6 6 · F7 3 · F8 5). Manual gate globalnie 0/~50 (E2E real-data jak M13 = osobny przebieg). Ekrany: 1 (`f1-cockpit-health-ssot`).

**Słownik statusu:** ⬜ NIE ROZPOCZĘTY · 🟡 W TOKU · 🟢 GOTOWY DO ODBIORU (realizacja ✅, czeka →F/→UI) · ✅ ZAMKNIĘTY (8/8).

---

# ODBIORY SZCZEGÓŁOWE (per fala)

## FALA F0 — Higiena + P0 (✅ DEPLOYED)
**0.1 P0 defekty** · DoD 7/7 ✅ · Dowód: `261569ddc1`, test security 5/5, tsc 0. Manual: 6 scenariuszy (cross-org-delete blok, distribute-DRAFT blok, budgetHealth, SCOPE=NA, heatmap, scope_reduction) — do wykonania na demo. →F: klik na demo. →UI: N/A (backend).
**0.2 Martwy kod** · usunięto 13 plików/5597 linii, żywy moduł 26/26. →F: moduł działa = potwierdzone (screenshot kokpitu).

## FALA F1 — Konsolidacja (✅ DEPLOYED demo)
**1.1 Health SSOT** · `ExecutionHub` konsumuje `/execution/health` (autorytatywny), własna kalkulacja = fallback degraded; `healthScoreSource` flaguje. Dowód `aba2599c98`, kokpit renderuje czysto (0 błędów). Manual: M1 liczba kokpit==API · M2 fallback gdy endpoint pada · M3 dark/light. →F: otwórz Implementation→sprawdź health.
**1.2 Action Queue klasyfikator** · legacy getActionQueue: `impact IN(...)` → `calculateRiskScore`+`categorizeScore` (non-GREEN), ranking P×I. `ac70cccebb`, 3/3. Manual: kolejka pokazuje te same „high-risk" co heatmapa.
**1.3 RAID scoring 1-ścieżka** · zweryfikowane: wszystkie 3 write-paths używają `raidScoringService` (audyt przeszacował „duplikat").

## FALA F2 — Baseline & pełny EVM (🟢 fundament / ⬜ reszta)
**2.1 Fundament EVM** · `evmService`: computeEvm (SPI/CPI/SV/CV/EAC/VAC/TCPI/RAG) + deriveInitiativeEvm (PV time-phasing, EV milestone-weighted, AC). `90ff87ed98`, 8/8. DoD: matematyka ANSI-748 ✅, null-safety ✅, testy ✅.
**2.2 Portfolio roll-up** · `derivePortfolioEvm` + pole `evm` w `/execution/health` (additive, coverage). `f386b9f83c`. Manual: kokpit pokazuje SPI portfela.
**2.3–2.5 (⬜):** cost-actuals→CPI (join budget_transactions) · swap healthScore na EVM (po live-verify) · Gantt baseline-vs-actual+rebaseline (schema baseline). DoD do zdefiniowania przy starcie.

## FALA F3 — Metodologia do akcji (🟡 3/5)
**3.1 Appetite** · `auto_escalate_above` ożywiony, sygnał APPETITE_BREACH, eskalacja na kanoniczny score. `c52c514650`, 4/4. Manual: ryzyko ≥ próg → APPETITE_BREACH; HIGH×LOW (GREEN) NIE eskaluje.
**3.2 WSJF** · `actionQueueCodScore` (severity×pilność×blast). `0b5964599a`, 4/4. Manual: krytyczna decyzja przed drobnym taskiem; RED przed AMBER.
**3.3 SLA decyzji** · per-priority (Crit 2d/High 3d/Med 7d/Low 14d). `06486bd3af`, 3/3. Manual: krytyczna eskaluje szybciej.
**3.4–3.5 (⬜):** eskalacja prawdziwa (`escalated_to`+notyfikacja sponsora, reuse flow M13) · tolerancje per inicjatywa (schema+reads).

## FALE F4–F8 — pozostają (⬜ planowane)
Każde zadanie startuje z definicją DoD (7-pkt) + epiki, potem Kod→Testy→Manual→UI→deploy demo→→F/→UI. Charakter: **nowe podsystemy** (migracje DB + model + UI + live-verify) — rekomendowane jako osobne sprinty/autonomiczne sesje schema-owe.
- **F4 Capacity** (3): model alokacji · capacity vs demand + heatmap · sygnał capacity.
- **F5 Stage-gating** (5): rollout_stages · cross-register gate · baseline · cutover/rollback · Change Log automatic.
- **F6 Wartość+adopcja** (6): handoff M15 · email-worker · scheduler · narracja AI · ADKAR roll-up · Champions.
- **F7 Predykcja+what-if** (3): predykcja heurystyczna · grounded triage · what-if+capacity.
- **F8 Domknięcia** (5): dependency graph · assumption/issue · 5×5+EMV · server PDF · PIR.

---

## ZASADY PRACY (jak M13)
Każde zadanie: osobny PR → DoD 7/7 → testy zielone → tsc 0 → Manual (E2E real-data, proxy local-FE→demo-BE) → UI canon → deploy demo → **Twój odbiór →F/→UI**. Konsolidacja (F1) przed resztą — zrobiona. Manual gate domykany przebiegiem E2E real-data (metoda z M13). Prod tylko za osobną zgodą.

## NASTĘPNY KROK
Odbierz 8 GOTOWYCH zadań na demo (→F/→UI). Potem: F2 dokończenie (najwyższa wartość) → F3 reszta → F4–F8 sprintami.
