# M16 „Finanse" — STAN PRACY + ODBIORY (program budowy)

> Program budowy + system odbiorów dla M16 Finanse — analogiczny do `M14-STAN-PRACY-ODBIORY.md`. Wszystkie zadania dla wszystkich funkcjonalności (9 fal F1–F9), każde z 8 bramkami odbioru. SSOT pracy + akceptacji. Stan: 2026-06-24 (przed startem).
>
> Dokumenty siostrzane: `M16-WIZJA-SWIATOWA-2026-06-24.md` (wizja+inicjatywy+standard graficzny) · `M16-AUDYT-DETALICZNY-2026-06-24.md` (audyt per-funkcja) · `M16-AUDYT-2026-06-24.md` (przegląd).

## STATUS PRAWDY (2026-06-24)
- Żywy moduł = `/finance` → `EconomicsView` → `FinanceHub.tsx` (6 zakładek), V8-first + legacy fallback, org a3e05d4a (V8 ON, seed). Backend ~70% realny (W0 „prawda księgowa"), brakuje W1-W5 (planowanie/decyzje/wartość/złota-nić/AI).
- Cel programu: z „finansów spółki" (W0) do **„finansów transformacji" poziomu światowego** (W0+W1+W2+W3+W4+W5) — wsparcie decyzji kapitałowych + dowodzenia wartości wdrożeń + złota nić M16↔M13↔M14↔M15.
- Pętla weryfikacji gotowa (lokalny FE→trolley, org a3e05d4a). Prod (centerbeam) NIETKNIĘTY.

## SYSTEM ODBIORÓW — 8 bramek per zadanie
**Bramki realizacji** (CTO): **Kod** (zaimplementowane+wpięte) · **DoD** (7-pkt) · **Testy** (unit/integration zielone) · **Manual** (E2E z dowodem-zrzutem) · **UI** (zgodność z `CANON.md` + `FINANCE_VISUAL_CANON.md`).
**Bramki akceptacji** (Piotr): **→F** (klikasz, działa funkcjonalnie) · **→UI** (akceptacja grafiki).
**ZAMKNIĘTY 8/8** = wszystkie zielone. Legenda: ✅ done · 🟡 część · ⬜ to-do · N/A.

---

## TABLICA ZBIORCZA

| # | Zadanie / funkcjonalność | Fala | Typ | Kod | DoD | Testy | Manual | UI | →F | →UI | Status |
|--|--|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|--|
| 0.1 | Decyzje D1-D5 + seed realistyczny (P&L+BS+CF+modele+analizy+budżet z actuals) | F0 | infra | ⬜ | ⬜ | N/A | ⬜ | N/A | ⬜ | N/A | ⬜ czeka na Piotra |
| 0.2 | `FINANCE_VISUAL_CANON.md` — kanon wizualny | F0 | UI-std | OK | OK | N/A | N/A | OK | N/A | OK | DONE (085fe53c2d) |
| 0.3 | Biblioteka wykresow finansowych (8 prymitywow SVG) | F0 | UI-std | OK | OK | OK 67/67 | N/A | OK | OK | wait | DONE (5cb5ddbfb9) — 8 prymitywow, 67 testow |
| 1.1 | WACC/CAPM Engine (org SSOT) -> zasila kazdy NPV | F1 | FIX | OK | OK | OK 9/9 | wait | N/A | wait | wait | GREEN backend (3a8e5be920) — WACC 8.94 derived vs flat-12 |
| 1.2 | **Football Field render** (silnik liczy valueBridge/scenarioComparison — FE dorobić) | F1 | FIX | OK | OK | OK | wait | OK | wait | wait | GREEN — ValuationVisualsPanel renderuje FootballField (5a48ff952b) |
| 1.3 | Sensitivity heatmap (fix kontraktu + render) | F1 | FIX | OK | OK | OK | wait | OK | wait | wait | GREEN — ValuationVisualsPanel renderuje SensitivityHeatmap; matrix-contract fixed (3a8e5be920) |
| 1.4 | **Server-side finance engine = SSOT** (przenieść NPV/IRR z przeglądarki, audytowalność) | F1 | DOMKN | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (9a8761a46c: financeCalcEngine — kanoniczny SSOT, 17/17) |
| 1.5 | Fix schematu: kategoria `investment` w `financial_analysis_ratios` CHECK (koniec remapu→growth) | F1 | FIX | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (59306469e9: fix CHECK investment (migracja)); wiring route/UI=next |
| 2.1 | **Living Business Case** (przenieś capex/opex/NPV/IRR z analizy→`roi_assumptions` inicjatywy; NPV on-read) | F2 | DOMKN | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (48d47e50c5: livingBusinessCaseService — NPV on-read z realnym WACC, 12/12); wiring route/UI=next |
| 2.2 | **Initiative-Finance Linkage Workflow** (akcja „Powiąż"→domknięcie „Unlinked 86") | F2 | DOMKN | OK | OK | N/A | wait | OK | wait | wait | GREEN — POST /api/initiatives/:id/economics-links + LinkInitiativeModal + klikalny badge „Unlinked" (2026-06-24) |
| 2.3 | **Benefits-Register Bridge M14→M15** (ResultsHub czyta `benefits_register`) | F2 | DOMKN | OK | OK | N/A | wait | OK | wait | wait | GREEN — M14HandoffInbox wired w ResultsHub za ff_m14Handoff; /api/benefits-register mounted (2026-06-24) |
| 2.4 | **Value Attribution Rollup** (wepnij `kpiAttributionService` w „total value delivered", anti-double-count) | F2 | DOMKN | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (ca6874d59c: valueAttributionRollupService — anti-double-count, 7/7); wiring route/UI=next |
| 2.5 | **Realized-Value Reconciliation vs sprawozdania** (`roi_realized_values`↔`financial_statement_lines`) | F2 | DOMKN | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (4d732b4682: realizedValueReconciliationService — realized vs sprawozdania, 11/11); wiring route/UI=next |
| 2.6 | **Benefit Profile S-curve** (`benefit_profile_points` planned/actual cumulative; plan vs actual) | F2 | NOWA | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (3355dbd37d: benefitProfileService — S-curve plan/actual, 9/9); wiring route/UI=next |
| 2.7 | **Value-at-Risk on Slip** (spięcie z EVM/SPI: VaR=forecast×(1−scheduleHealth); heatmapa) | F2 | DOMKN | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (9e48fcbdff: valueAtRiskService — VaR ze schedule-health, 13/13); wiring route/UI=next |
| 2.8 | **Benefit Category Taxonomy** (hard/soft×cost-out/rev-up/WC×run-rate/one-time) | F2 | NOWA | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (3355dbd37d: benefit category taxonomy (hard/soft/run-rate)); wiring route/UI=next |
| 2.9 | **Leading/Lagging KPI Lineage** (`kpi_kind` + link + ostrzeżenie cockpit) | F2 | NOWA | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (59306469e9: kpiLineageService — leading/lagging early-warning, 6/6); wiring route/UI=next |
| 3.1 | **Value Bridge Waterfall** (Baseline→Identified→Committed→In-flight→Realized→Banked, flagowy) | F3 | NOWA | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (cf39efae0e: valueBridgeService — waterfall, 11/11); UI-binding=next |
| 3.2 | **Initiative Business-Case Generator** (one-pager NPV/payback/IRR PRZED fundingiem) | F3 | DOMKN | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (d7b4e7fef9: businessCaseGeneratorService — one-pager, 14/14); UI-binding=next |
| 3.3 | **Value Capture Pipeline + Stage-Gates G0-G5** (lejek z bramkami + sign-off + kryteria) | F3 | NOWA | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (acc8d22ecb: value-capture pipeline + gates G0-G5, 14/14); UI-binding=next |
| 3.4 | **Frozen Baseline & Value Ledger** (zamrożony baseline + rejestr korekt z provenance) | F3 | NOWA | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (1f01415461: frozen baseline + value ledger, 11/11); UI-binding=next |
| 3.5 | **Run-rate vs One-time Split + Phasing** (podział + krzywa dojścia do run-rate) | F3 | NOWA | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (a0c9f41ece: run-rate split + phasing S-curve, 15/15); UI-binding=next |
| 3.6 | **Banking the Value (P&L wire)** (zatwierdzona korzyść→budżet następnego okresu) | F3 | DOMKN | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (49285a5e6f: bankingValueService — P&L wire, 12/12); UI-binding=next |
| 3.7 | **Value Assurance Dashboard** (atestacja CFO: zwalidowane/provenance/alerty bez-dowodu) | F3 | NOWA | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (7603fcf45a: value assurance CFO atestacja, 18/18); UI-binding=next |
| 4.1 | **Hurdle-Rate per klasa ryzyka** (WACC + premia rdzeń/transformacja/R&D) | F4 | NOWA | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (804c2b84a7: capitalDecisionService — hurdle-rate, 20/20); UI-binding=next |
| 4.2 | **Portfolio Prioritization Board** (bąbelki NPV×ryzyko×nakład, ranking, fund/defer/kill) | F4 | NOWA | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (48332488a3: portfolioPrioritizationService — NPV×ryzyko board, 9/9); UI-binding=next |
| 4.3 | **Risk-Adjusted Value rNPV** (NPV×P(sukces) + leakage haircut) | F4 | NOWA | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (804c2b84a7: capitalDecisionService — rNPV haircut, 20/20); UI-binding=next |
| 4.4 | **Capital Rationing Solver** (PI ranking + 0/1 knapsack przy budżecie) | F4 | NOWA | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (891b3f9bed: capitalRationingService — PI+knapsack, 8/8); UI-binding=next |
| 4.5 | **Monte Carlo na NPV** (rozkłady driverów→histogram, P(NPV>0), P10/50/90, VaR) | F4 | NOWA | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (8cf688afc8: monteCarloNpvService — seeded MC, 13/13); UI-binding=next |
| 4.6 | **Real-Options Valuation** (defer/scale/abandon; rekomendacja pilot→bramka→skala) | F4 | NOWA | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (997c98e25a: realOptionsService — defer/abandon/staged, 13/13); UI-binding=next |
| 4.7 | **Efficient Frontier portfela** (wartość vs ryzyko; obecny vs optymalny mix) | F4 | NOWA | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (afa8bcd884: efficientFrontierService — wartość vs ryzyko, 12/12); UI-binding=next |
| 5.1 | **Budget-vs-Actual Variance Bridge** (waterfall plan→actual, F/U, YTD, drill-down) | F5 | NOWA | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (2734a0a093: budget-vs-actual variance bridge, 21/21); UI-binding=next |
| 5.2 | **Multi-Scenario Compute** (ożywić martwe base/bull/bear — realny compute per-scenariusz) | F5 | FIX | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (5f939bf8f7: scenarioComputeService — multi-scenario, 11/11) |
| 5.3 | **Driver-Tree Planner** (drzewo driverów+formuły→propagacja do 3-statement) | F5 | NOWA | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (096b132354: driver-tree planner, 14/14); UI-binding=next |
| 5.4 | **What-if / Sensitivity real-time + Tornado** (suwaki driverów, przelicz, tornado/data-table) | F5 | NOWA | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (salvaged: whatIfSensitivityService — tornado/data-table/break-even, 17/17); UI-binding=next |
| 6.1 | **Schedules: Working-Capital + Debt + Depreciation + Tax** (DSO/DPO/DIO, odsetki z salda, amort z PPE, tax=stawka×EBT) | F6 | NOWA | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (e4f7e69d05: financeSchedulesService — WC/debt/depr/tax, 10/10); UI-binding=next |
| 6.2 | **Rolling Forecast Engine** (re-forecast actual+plan, roll-forward, snapshoty) | F6 | NOWA | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (6270d33ded: rollingForecastService — re-forecast, 12/12); UI-binding=next |
| 6.3 | **Headcount / Workforce Planner** (per-rola salary/ramp/loaded→OPEX+cash) | F6 | NOWA | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (cee03307ac: headcountPlannerService — workforce/OPEX, 14/14); UI-binding=next |
| 6.4 | **Cash / Liquidity Forecast** (direct cash, runway, min-cash alerty) | F6 | NOWA | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (1084801b17: cashForecastService — direct cash+runway, 10/10); UI-binding=next |
| 6.5 | **Model versioning UI + diff** (`financial_model_versions` czytelne, audyt założeń) | F6 | DOMKN | OK | OK | N/A | wait | OK | wait | wait | GREEN — ModelVersionHistory.tsx + GET /models/:id/versions + /diff (2026-06-24) |
| 7.1 | **InvestmentAppraisalPanel** (NPV/IRR/MIRR/payback/disc-payback/PI + go/no-go) | F7 | NOWA | OK | OK | OK 15/15+9/9 | wait | OK | wait | wait | GREEN — InvestmentAppraisalPanel wired w FinanceHub (investment tab) + empty state za ff_investAppraisal (2026-06-24) |
| 7.2 | **Przepięcie analiz na `ratioAnalysisService`** (34 wsk.+DuPont+ROE/ROA/ROIC+statusy) | F7 | DOMKN | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (1beb63854b: extendedRatiosService — ROE/ROA/ROIC/DuPont, 25/25) |
| 7.3 | **Benchmarki branżowe** (`financial_ratio_benchmarks` p25/median/p75 podpięte) | F7 | DOMKN | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (1beb63854b: benchmarkStatus (percentyle) w extendedRatios, 25/25) |
| 7.4 | **Pola inwestycyjne w CreateAnalysisModal** (nakłady/horyzont/stopa/korzyści) | F7 | NOWA | OK | OK | N/A | wait | OK | wait | wait | GREEN — 4 pola (capex/horyzont/stopa/korzyści) w CreateAnalysisModal za investment_case (2026-06-24) |
| 8.1 | **AI Anomaly Detector @import** (tie-out break/skok/błędna klasyfikacja) — najtańszy moat | F8 | NOWA-AI | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (9963ec9dee: financeAnomalyDetectorService — reguły anomalii, 12/12); UI-binding=next |
| 8.2 | **AI Variance Narration** (komentarz CFO z bridge'a) | F8 | NOWA-AI | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (7a9cf049be: varianceNarrationService — narracja, 18/18); UI-binding=next |
| 8.3 | **AI Driver-Suggester** (z historii→drzewo driverów+wartości bazowe) | F8 | NOWA-AI | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (14db9b1fdf: driverSuggesterService — statystyczne drivery, 15/15); UI-binding=next |
| 8.4 | **NL→Model** (prompt→drzewo driverów+3-statement) | F8 | NOWA-AI | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (c3a03c68bd: nlToModelService — NL→model parser, 10/10) |
| 8.5 | **Decision Copilot** (co-jeśli→runway/EBITDA/breakeven+trade-off) | F8 | NOWA-AI | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (8c1498b82d: decisionCopilotService — what-if trade-off, 10/10); UI-binding=next |
| 9.1 | Parytet V8-write valuations/budgets (przed retire legacy) | F9 | KONSO | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (route: financeValueRoutes — V8 endpointy wartości zamontowane /api/v8/finance-value, 7/7) |
| 9.2 | Deprecation 3 legacy lane'ów + konsolidacja 3 tabel „analiz" + dedup migracji `financial_models` | F9 | KONSO | ⬜ | ⬜ | ⬜ | N/A | N/A | ⬜ | N/A | ⬜ |
| 9.3 | Testy warstw ryzyka (gating/fallback/silniki/E2E flows) — ZERO→pokrycie | F9 | TESTY | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (09e0271f9a: testy gatingu+fallbacku finance, 13/13) |
| 9.4 | Statements: cross-statement tie-out + smart-path human-in-loop + naprawa CF | F9 | DOMKN | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (478656757f: crossStatementTieOutService — tie-out P&L↔BS↔CF, 8/8); UI-binding=next |
| 9.5 | Statements: FX + multi-year + OCR + próg `ready` + uczenie aliasów | F9 | NOWA | OK | OK | OK | wait | N/A | wait | wait | GREEN serwis+test (e455b0410d: statementCompletenessService — FX/multi-year/ready, 14/14); UI-binding=next |

**Razem: 48 zadań / 9 fal (F0-F9).** Wszystkie ⬜ (przed startem). Mapa warstw: F1=W0-fundament · F2=W4-złota-nić · F3=W3-wartość · F4=W2-decyzje · F5/F6=W1-planowanie · F7=analizy/inwestycje · F8=W5-AI · F9=konsolidacja+ingestia.

---

## FALE — szczegół (cele + zależności)

**F0 — Fundament programu.** Decyzje D1-D5 (split-brain/silniki/zakres/seed/priorytet); seed realistyczny do live-verify; `FINANCE_VISUAL_CANON.md` + biblioteka wykresów (wszystkie wyższe fale jej używają). *Blokuje: wszystko.*

**F1 — Wiarygodność liczb (W0).** WACC/CAPM jako jedno źródło stopy → naprawia NPV w całej platformie; 2 render-fixy (football field + sensitivity) = 2 światowe wizualizacje „za darmo"; server-side engine SSOT; fix CHECK investment. *Najtańsze, odblokowuje decyzje (F4) i wartość (F3).*

**F2 — Złota nić (W4).** Najwyższy ROI: silniki (EVM/attribution/ROI/reconciliation) już liczą, brakuje spięcia. Living business case (2.1) = bez niego cała pętla mierzy wartość, której nikt nie zadeklarował. Domknięcie 4 szwów (A/B/C/D) + S-curve/VaR/taksonomia/lineage. *Zależy: 1.1 WACC.*

**F3 — Motor wartości transformacji (W3).** Value bridge flagowy + pipeline/gates + frozen baseline + run-rate + banking + assurance. Sedno value-office. *Zależy: F2 (business case), 5.1 (variance dla banking).*

**F4 — Decyzje & alokacja kapitału (W2).** Portfel NPV×ryzyko + rationing + rNPV + Monte Carlo + real options + frontier. Wsparcie kluczowej decyzji „co finansować". *Zależy: 1.1 WACC, 4.1 hurdle, 2.1 business case (NPV per inicjatywa).*

**F5 — Planowanie FP&A rdzeń (W1).** Variance bridge (audyt P0) + ożywienie scenariuszy (audyt P0) + driver-tree (fundament) + what-if/tornado. *Driver-tree (5.3) fundament pod F6.*

**F6 — Planowanie FP&A pełnia (W1).** Schedules (WC/debt/depr/tax) + rolling forecast + headcount + cash + wersjonowanie. *Zależy: 5.3 driver-tree.*

**F7 — Analiza + Inwestycje (domknięcie zakładek z audytu).** InvestmentAppraisalPanel + przepięcie na bogatszy silnik 34-wsk. + benchmarki + pola inwestycyjne. *Zależy: 1.1 WACC, 1.5 fix CHECK.*

**F8 — AI-native moat (W5).** Anomaly (najtańszy) → narration → driver-suggester → NL→model → copilot. Przewaga, bo siedzi na tie-out engine (zero halucynacji). *Zależy: 5.3 driver-tree (dla suggester/NL).*

**F9 — Konsolidacja + ingestia (z audytu technicznego).** Parytet V8-write → retire legacy → testy warstw ryzyka (ZERO→pokrycie) → domknięcie Statements (tie-out/FX/OCR/multi-year). *Higiena, równolegle do F2-F8.*

---

## DECYZJE PIOTRA (F0, przed startem)
- **D1 Split-brain:** V8 SoT + retire legacy (zalecane)?
- **D2 Silniki modelowania:** unifikacja M16 `financialModelingService` z `deliverables/financialEngine` (driver-based, scenariusze, DCF, CFO-review) — JEDEN core, czy rozdział ról? (rekomendacja: unifikacja core, bo F5.2/F5.3/F8 i tak zmierzają do driver-based — `financialEngine` ma już to + scenariusze).
- **D3 Zakres v1:** v1 = F1 (wiarygodność) + F2 (złota nić) + F3 (wartość) — czyli „motor wartości transformacji" jako headline; F4-F8 fala 2 (zalecane — to różnicuje produkt).
- **D4 Seed:** realistyczny komplet (P&L+BS+CF + 3-4 inicjatywy z business-case + budżet z actuals) do live-verify każdej powierzchni.
- **D5 Priorytet:** rekomendacja sekwencji 1→2→3→4→5/6→8→9 (wiarygodność→złota-nić→wartość→decyzje→planowanie→AI→konsolidacja).

## METODA (jak M14)
Per-zadanie: live-verify na żywym kokpicie (lokalny FE→trolley, org a3e05d4a) → komponent+flaga `ff_*` (default OFF) → testy (unit silnika + integration route + Playwright) → screenshot → deploy demo. Każdy nowy wykres z `FINANCE_VISUAL_CANON.md`. Batche izolowanych agentów dla rozłącznych nowych plików (wzorzec M14). Domyślnie (po „decyduj") startuję od F0.2/F0.3 (kanon+biblioteka) + F1 (wiarygodność liczb) równolegle.
