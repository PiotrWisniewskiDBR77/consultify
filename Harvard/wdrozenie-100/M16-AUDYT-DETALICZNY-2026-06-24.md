# M16 „Finanse" — AUDYT DETALICZNY (per-funkcja, poziom M13/M14)

> Detaliczny audyt wdrożeniowy modułu M16 Finanse — funkcja po funkcji: **STAN REALNY** (kod-dokładnie) · **ELEMENTY OCZEKIWANE** (doktryna FP&A + standard rynkowy) · **LUKI** (P0/P1/P2). Ugruntowany na żywym module (org a3e05d4a, staging-trolley) + deep-dive 5 audytorów w kodzie. SSOT przed programem budowy. Lżejszy przegląd: `M16-AUDYT-2026-06-24.md`.

---

## STATUS PRAWDY (zweryfikowane 2026-06-24)
- Route `/finance` → `EconomicsView` → **`FinanceHub.tsx` (2382 lin.)**, 6 zakładek: Statements / Models / Analysis / Prediction / Enterprise valuation / Investment. Beta-gate `MODULE_ECONOMICS` (closed) + `useV8FeatureFlag('finance')` + `ProductionModuleGate`.
- **Werdykt nadrzędny: backend REALNY i GŁĘBOKI** (78 tabel finansowych, ~100 endpointów, silnik 3-statement z prawdziwym tie-outem, pełen pipeline ingestii LLM) — **stary audyt 47/100 jest skrajnie nieaktualny**. ALE: jakość jest „głęboka-ale-dziurawa": kilka funkcji obiecanych w UI to **martwe obietnice lub skorupy**, plus **poczwórny split-brain architektoniczny** i **zero testów na warstwach ryzyka** (gating, fallback).
- **Cztery równoległe „silosy finansów":** (1) **V8** `/api/v8/finance` (nowy SoT, 46 endp.) · (2) **legacy economics** `/api/economics` (56 endp., duplikat) · (3) **legacy modeling/statements** `/api/financial-modeling` + `/api/finance-statements` (duplikat) · (4) **V4-enterprise** `/api/finance-v4` (już `deprecationHeader`). Plus **piąty, odrębny silnik** `deliverables/financialEngine.ts` (biznesplan, 0 wspólnych tabel).
- **Dane = SEED stagingowy** (1 statement „DBR77 Manufacturing" bez CF, 1 model). Ścieżki błędów/edge niezweryfikowane realnym ruchem.
- Prod (centerbeam) NIETKNIĘTY. Środowisko weryfikacji gotowe (lokalny FE→trolley, org a3e05d4a, finance-V8 ON).

---

## DOKTRYNA M16 — czym MA być (standard, do którego mierzymy)
Klasowy moduł finansowy konsultingowy = **5 warstw** (wzorce: Causal/Pigment/Cube/Mosaic [FP&A], Fathom/Spotlight [analiza], Damodaran/McKinsey [wycena], MindBridge [audyt danych]):
1. **Ingestia danych** — import sprawozdań (Excel/PDF/CSV+OCR), AI-mapowanie do taksonomii kanonicznej, **3 sprawozdania spójne z tie-out** (P&L↔BS↔CF), multi-okres/multi-waluta, governance+audyt.
2. **Modelowanie** — zintegrowany model 3-statement **driver-based**, scenariusze (base/bull/bear) liczone osobno, analiza wrażliwości/what-if, harmonogramy (dług/amortyzacja/podatki/working capital), rolling forecast.
3. **Analiza** — pełny zestaw wskaźników (płynność/rentowność/zadłużenie/efektywność + DuPont + ROE/ROA/ROIC), trendy, **benchmark branżowy** (percentyle), statusy/alerty.
4. **Wycena + inwestycje** — DCF (FCFF/FCFE + **WACC z CAPM** + terminal value), mnożniki z realnych comparables, wycena majątkowa, **most wartości/football field**; appraisal inwestycyjny (NPV/IRR/MIRR/payback/disc-payback/PI + go/no-go + wrażliwość).
5. **Budżet/predykcja + governance** — budżet driver-based per okres, **budget-vs-actual variance**, scenariusze sterowalne, alokacja per inicjatywa, domknięty **linkage finanse↔inicjatywy↔KPI**, jeden SoT, audyt mutacji, testy warstw ryzyka.

---

## ZAKŁADKA 1 — STATEMENTS (import + ingestia sprawozdań)
**Pliki:** `Finance/FinancialStatementImportWizard.tsx` (1270) · `FinancialStatementPackWorkspace.tsx` (990) · `FinancialStatementWorkspace.tsx` (recovery) · BE `v8/finance.routes.ts` (statements) + legacy `finance-statements.routes.ts` · serwisy `financialStatementService` / `openAIFinancialExtractionService` (LLM full-doc gpt-4o) / `llmFinancialMappingService` / `financeCanonicalRegistry` (251 linii kanonicznych: P&L 89/BS 90/CF 72).

**STAN REALNY:** 🟢 **Solidny rdzeń.** Wizard 2-ścieżkowy: (A) **smart** = cały plik base64→OpenAI Responses, ekstrakcja wszystkich 3 sprawozdań naraz, auto-map→validate→readiness, FE skacze upload→confirm; (B) **fallback heurystyczny** 4-krokowy (detect keyword-scoring → extract → map z `FinancialStatementMappingEditor` human-in-loop → confirm). Parsery: XLSX (ranking arkuszy), PDF (text-extraction), CSV. Walidacja per-typ: **BS tie-out** (Assets=L+E, tol 1%), P&L (gross-margin sanity), CF (FCF=OCF−capex). Readiness 4-stanowy (pending/recoverable/ready/rejected, `ready`=coverage 100%). Audit trail bogaty (`ingest_runs`/`quality_runs`/`source_artifacts`/`value_versions`). Recovery workbench działa.

**OCZEKIWANE:** cross-statement tie-out (NI→retained earnings; closing cash CF=Cash BS; rekoncyliacja CF pośrednia), kompletność packu (3 sprawozdania), multi-okres (YoY/QoQ jako dane, nie tylko detekcja), FX+przeliczenia, OCR skanów, human-in-loop ZAWSZE (też smart), governance/approval (preparer→reviewer→approver), uczenie aliasów z korekt.

**LUKI:**
- **P0** — brak **cross-statement tie-out** (walidacja jest per-typ, nie spina P&L↔BS↔CF); smart-path **pomija human-in-loop** (LLM commit bez przeglądu, sztywne conf. 0.9); brak ścieżki naprawy **brakującego CF** (live „—CF" bez akcji „dodaj CF").
- **P1** — zero **FX** (tylko detekcja waluty, default PLN, `UNRESOLVED_CURRENCY` nigdy nie rozwiązywane); brak **multi-year** (kolumna porównawcza wykrywana, niezapisywana); brak realnego **OCR** (skan→puste linie); próg **`ready`=100% coverage** zbyt restrykcyjny (realne statementy → Recovery Queue); **Escalations rozłączone** (licznik z lane'u modelowego, nie z ingestii, bez akcji).
- **P2** — brak governance/approval; **uczenie aliasów** (`learnStatementAliases`) zaimplementowane ale nieinwokowane; rozjazd wersji taksonomii (`finance-v2-l3` kod vs `finance-v1` DB); dwa żywe backendy (v8 + legacy mount).

---

## ZAKŁADKA 2 — MODELS (silnik forecastingu)
**Pliki:** `Economics/FinanceModelDocumentView.tsx` · `modals/CreateModelModal.tsx` · BE `v8/finance.routes.ts` (models 254-606) · **silnik `financialModelingService.ts` (1365, `computeModel`@643)** · osobny `deliverables/financialEngine.ts` (`computeFinancialModel`@188).

**STAN REALNY:** 🟢 **REALNY zintegrowany 3-statement event-driven** (NIE skorupa — rzadkość na rynku MVP). `computeModel`: P&L (11 linii) → BS (16, running balances + PPE corkscrew + debt/equity) → CF (14, **metoda pośrednia**: NI+D&A−ΔWC). **Prawdziwy tie-out:** `BS_EQUATION` (Assets=L+E, fail), `CASH_TIEOUT` (ΔCash=OCF+ICF+FCF, fail), `CASH_BS_CF_MATCH` (warning). 13 typów eventów z recurrence+growth. Seed „from statement" (z zatwierdzonego packu). Approve blokuje przy fail, wersjonuje. 

**OCZEKIWANE:** driver-based (cena×wolumen, headcount, churn/NRR), **scenariusze base/bull/bear liczone osobno**, analiza wrażliwości/what-if, **harmonogram długu** (odsetki z salda×stopa), **amortyzacja z CAPEX**, **podatek=stawka×EBT**, working capital z DSO/DPO/DIO, rolling forecast + variance, wersje czytelne+diff, walidacje rozszerzone (negative-cash gate, dług/EBITDA), wycena z modelu, AI-założenia.

**LUKI:**
- **P0** — **SCENARIUSZE MARTWE** (FE ma 3 zakładki base/optimistic/conservative, backend liczy TYLKO jeden przebieg → warianty fallbackują na FE-mock i pokazują „estimated" = **iluzja UI**); **dwa rozjechane silniki** (Models używa słabszego `financialModelingService`; dojrzalszy `deliverables/financialEngine` — driver-based, scenariusze bull/bear, DCF, CFO-review 6 hard-fail, ARR bridge, unit-econ — jest NIEUŻYWANY tutaj → ten sam user dostaje dwa różne modele 3-statement z dwóch miejsc).
- **P1** — brak **wrażliwości/what-if**; **dług** = ręczne eventy (odsetki nie z salda); **amortyzacja** ręczna (nie z PPE); **podatek** ręczny (nie stawka×EBT); **working capital** sztywne 0.4/0.3/0.3 (nie DSO/DPO/DIO); **historia wersji nieczytelna** (`financial_model_versions` zapisywana, brak GET/diff/UI; uwaga: `/versions` w routes to INNY system — financeLaneService P05).
- **P2** — brak rolling forecast/actuals-vs-plan; brak ratio-checks (negative-cash gate); tylko CF pośredni; brak wyceny w widoku modelu; brak AI-propozycji driverów.

---

## ZAKŁADKI 3+6 — ANALYSIS + INVESTMENT
**Pliki:** `Benefits/FinancialAnalysisWorkspace.tsx` · `modals/CreateAnalysisModal.tsx` (współdzielony) · `FinancePreviewPanel.tsx:642` (wspólny render) · **silnik produkcyjny `financialAnalysisService.ts`** (18 wskaźników, NPV/IRR/payback/ROI) · **bogatszy NIEUŻYWANY `ratioAnalysisService.ts`** (34 wskaźniki+DuPont+statusy+benchmarki) · martwy appraisal `economicsFinancials.ts` (WACC konfigurowalny+scenariusze).

**STAN REALNY:** 🟡 silnik liczy **18 wskaźników** (rentowność/koszty/płynność/working-capital/zadłużenie) + 4 inwestycyjne (NPV, IRR-bisekcja, payback, ROI). Generuje insighty **regułowe (bez LLM)** → propozycje inicjatyw do M13 (`source_type='financial_analysis'`). Benchmarki = **stałe progi hardcoded** (nie branżowe). **Investment = SKORUPA-FILTR:** `FinancePreviewPanel` renderuje DLA OBYDWU zakładek identyczny widok (top-wskaźnik per kategoria); brak panelu appraisalu (brak tabeli NPV/IRR, go/no-go, wrażliwości).

**OCZEKIWANE:** pełne wskaźniki (+ROE/ROA/ROIC/ROCE/D/E/DSCR/asset-turnover/DuPont), trendy/CAGR renderowane, benchmark branżowy (p25/median/p75), statusy ok/warn/critical; appraisal: NPV z **WACC** (nie 10%), MIRR, discounted-payback, PI, definicja projektu (nakłady/korzyści/horyzont), wrażliwość+scenariusze, go/no-go z progami, inicjatywa niosąca business case.

**LUKI:**
- **P0** — **Investment to skorupa** (ten sam widok co Analysis, brak InvestmentAppraisalPanel); **stopa dyskontowa 10% hardcoded** (`financialAnalysisService:285` — NPV niewiarygodny); **CreateAnalysisModal bez pól inwestycyjnych** (nie da się zdefiniować nakładów/horyzontu/stopy); **BUG schematu** — investment-ratios zapisywane jako kategoria `'growth'` (CHECK nie dopuszcza `'investment'`, remap `:137`).
- **P1** — brak kluczowych wskaźników (ROE/ROA/ROIC/ROCE/D/E/DSCR/DuPont) — **istnieją w `ratioAnalysisService` ale zakładki go nie używają** (najtańsza naprawa: przepiąć na bogatszy silnik); brak realnych **benchmarków branżowych** (`financial_ratio_benchmarks` istnieje, niepodpięty); brak **MIRR/disc-payback/PI**; brak wrażliwości/scenariuszy w Investment; trendy/CAGR liczone ale nierenderowane.
- **P2** — insighty regułowe (bez LLM, pole `citations` nieużyte); brak statusów/kolorowania w UI analiz; inicjatywa bez business case (goły tytuł); **martwy bogatszy silnik inwestycyjny** `economicsFinancials.ts` (konfigurowalny WACC+scenariusze) — decyzja: przepiąć czy wygasić.

---

## ZAKŁADKA 5 — ENTERPRISE VALUATION (wycena)
**Pliki:** `Benefits/ValuationWorkspace.tsx` (1576) · `modals/CreateValuationModal.tsx` · BE legacy `economics.routes.ts` (read+write!) + V8 read-only listy · **silnik `valuationService.ts` (1597)**.

**STAN REALNY:** 🟡 **DCF działa** (`computeDcf`: PV explicit + terminal **Gordon Growth** ORAZ **exit multiple**, EV→equity przez netDebt, per-share). **Tornado działa** (WACC±1%, FCFF±5%). 4 źródła forecastu (model/analiza/budżet/manual, wszystkie wymagają APPROVED). Liczy I zapisuje, snapshot przy approve. Advisory/negotiation-pack rozbudowane ale **deterministyczne/template** (nie AI).

**OCZEKIWANE:** WACC z CAPM (ke=rf+β·ERP, kd·(1−t), wagi D/E), FCFE, comparables z realnym peer-set (EV/EBITDA, **P/E**, EV/Sales), wycena majątkowa/NAV, **most wartości/football field** (triangulacja DCF vs comps vs assets), sensitivity 2D (WACC×g) renderowana.

**LUKI:**
- **P0** — **WACC z CAPM = SKORUPA** (`waccBreakdown` zapisywany ale ŻADNA funkcja nie liczy `waccPercent` z CAPM; `computeDcf` używa płaskiego %); **sensitivity heatmapy NIE renderują** (bug kontraktu: serwis emituje `{table,waccGrid,gGrid}`, FE oczekuje `matrix:[{wacc,g,ev}]` → fallback tekstowy).
- **P1** — comparables: **brak P/E** (`computeComps` ignoruje, zwraca base=0), peer-set to tylko nazwy (brak danych rynkowych); brak **wyceny majątkowej/NAV**; **value bridge/football field + scenarioComparison** liczone w BE, **FE nie renderuje**; FE wyłącza źródło `financial_model` (disabled mimo wsparcia BE); brak inputów netDebt/shares/manualForecast w FE.
- **P2** — advisory deterministyczne (nie AI); duplikat przycisku „Details"=„Create initiative" (ten sam handler = bug); brak FCFE.

---

## ZAKŁADKA 4 — PREDICTION (budżety/forecast)
**Pliki:** `Benefits/BudgetWorkspace.tsx` (1112) · BE legacy `economics.routes.ts` (read+write) + V8 read-only · **silnik `budgetingService.ts` (441)**. UWAGA: `ai_budgets` to INNA domena (governance kosztów LLM), nie M16; M16 = tabele `budgets`/`budget_lines`/`budget_scenarios`.

**STAN REALNY:** 🟡 budżet = **jedna wartość bazowa/linia** (10 P&L+5 CF), projekcja `baseline·scenarioMult·(1+growth)^i` + waterfall. 3 scenariusze hardcoded ±15%. Approve wymaga linii CAPEX. Linkowanie inicjatyw read-only.

**OCZEKIWANE:** driver-based (linia=KPI×formuła), per-okres grid (linia×okres), **budget-vs-actual variance** (Δ kwota/%, favorable/unfavorable, YTD), scenariusze sterowalne, rolling forecast, alokacja per inicjatywa/dział z wpływem na projekcje, workflow zatwierdzania.

**LUKI:**
- **P0** — **BUDGET-VS-ACTUAL / VARIANCE = CAŁKOWITY BRAK** (najpoważniejsza luka „Prediction" — brak tabel actuals, endpointów, UI wariancji; jedyne „variance" to plan-vs-plan scenariuszy).
- **P1** — **driver-based = skorupa** (pola `driver_kpi_id`/`driver_formula` w tabeli, `computeProjections` je ignoruje, brak UI); **scenariusze placeholder** (sztywne ±15%, `costReduction` martwy, brak UI adjustments mimo endpointu PUT); brak **per-okres grid** (tylko 1 baseline/linia); linkowane inicjatywy **nie wpływają na projekcje** (mimo hinta UI).
- **P2** — brak rolling forecast; granularity/currency niewybieralne w FE; import-document **wprowadza w błąd** (UI reklamuje PDF/Excel, FE wysyła `file.text()` → działa tylko CSV/txt).

---

## PRZEKRÓJ — ARCHITEKTURA / DB / LANE / GATING / TESTY
**STAN REALNY:** 78 tabel finansowych (23 migracje), ~100 endpointów. **Split-brain runtime-selectable:** FE `useFinanceData` — statements/models/analyses = V8-first→legacy-fallback; **valuations/budgets = LEGACY-ONLY** (zero próby V8). **V8 Finance Lane P05** (`financeLaneService`) = realny governance-wrapper (maszyna stanów import→analysis→mutation→readback, audyt mutacji, kpi-coherence, 7 hooków wired). **Dashboard** realny (5 agregacji; „Unlinked 86" = `initiatives NOT EXISTS v8_initiative_economics_linkages`). **Gating:** beta `MODULE_ECONOMICS` closed + v8OrgGate + ProductionModuleGate. **Testy:** ~250 bloków ale skupione na V8 happy-path; **ZERO na gatingu, fallbacku split-brain, dashboard-w-izolacji, FinanceDegradedBanner**.

**LUKI:**
- **P0** — **split-brain bez retire-planu** (3 legacy lane'y aktywne bez `deprecationHeader`, ryzyko dual-write); **valuations/budgets bez ścieżki V8 write** (urwą się jeśli legacy wygasić → trzeba parytet V8 PRZED retire); **ZERO testów gatingu/fallbacku** (regresja niewidoczna).
- **P1** — **linkage „Unlinked" niedomknięty** (licznik real, brak akcji „powiąż" w UI); **duplikat schematu** (`financial_models`/`_versions` CREATE w 3 migracjach `20260228`/`571`/`653` z różnymi kolumnami → ryzyko drift); dashboard testowany tylko z mockami.
- **P2** — **cztery silosy finansów** (V8/legacy/V4-enterprise/`financialEngine` biznesplanu) bez wspólnego modelu liczb (ryzyko rozjazdu metodologii NPV/IRR); brak testów degraded; tabele V4-enterprise (14) żyją mimo deprecation.

---

## SYNTEZA — wszystkie P0 (krytyczne, „obietnica UI bez pokrycia" lub skorupa rdzenia)
1. **Models: scenariusze martwe** — UI obiecuje base/opt/cons, silnik liczy jeden przebieg (iluzja).
2. **Models: dwa rozjechane silniki 3-statement** (słabszy używany, dojrzalszy `financialEngine` nieużywany).
3. **Investment: skorupa-filtr** — brak realnego panelu appraisalu (NPV/IRR/go-no-go).
4. **NPV: stopa 10% hardcoded** (analizy) + **WACC/CAPM skorupa** (wycena) — wyceny/NPV niewiarygodne.
5. **Budget-vs-Actual / variance: całkowity brak** — rdzeń „Prediction" nie istnieje.
6. **Sensitivity heatmapy nie renderują** (bug kontraktu FE↔BE w wycenie).
7. **Statements: brak cross-statement tie-out** + smart-path bez human-in-loop + brak naprawy brakującego CF.
8. **Schema bug:** investment-ratios zapisywane jako `'growth'` (CHECK odrzuca `'investment'`).
9. **Split-brain:** valuations/budgets bez V8-write + 3 legacy lane'y bez retire-planu.
10. **ZERO testów** gatingu/fallbacku/degraded.

**Wniosek:** M16 to NIE „47/100 do przepisania" — to **mocny, głęboki backend (~70%) z warstwą martwych obietnic UI, skorup w kluczowych wzorach (WACC/scenariusze/variance) i długiem architektonicznym (split-brain)**. Praca = domknięcie skorup + konsolidacja + testy, nie budowa od zera.

---

## PROGRAM BUDOWY (szkielet fal — pełna tablica 8-bramkowa w `M16-STAN-PRACY-ODBIORY.md` po decyzjach)
- **F1 — Konsolidacja architektury (split-brain):** parytet V8-write dla valuations/budgets → deprecation 3 legacy lane'ów → konsolidacja 3 tabel „analiz" + dedup migracji `financial_models`.
- **F2 — Silnik modelowania:** realny multi-scenario compute (base/bull/bear osobno) → harmonogramy dług/amortyzacja/podatek → wrażliwość/what-if → historia wersji UI → **decyzja: unifikacja z `financialEngine`**.
- **F3 — Analiza + Inwestycje:** przepięcie na `ratioAnalysisService` (34 wsk.+DuPont+statusy) → benchmarki branżowe → **InvestmentAppraisalPanel** (NPV/IRR/MIRR/payback/PI+WACC input+go/no-go) → pola inwestycyjne w modalu → fix CHECK `investment`.
- **F4 — Wycena:** WACC z CAPM → fix render sensitivity (kontrakt) → P/E+comparables → wycena majątkowa/NAV → most wartości/football field.
- **F5 — Statements/ingestia:** cross-statement tie-out → smart-path human-in-loop → naprawa brakującego CF → FX → multi-year → OCR → próg `ready` → uczenie aliasów.
- **F6 — Budżet/Prediction:** **budget-vs-actual variance** → driver-based budgeting → scenariusze sterowalne → per-okres grid → rolling forecast → wpływ inicjatyw na projekcje.
- **F7 — Linkage + governance:** actionable „Unlinked" workflow → obsługa eskalacji → governance na wszystkich mutacjach.
- **F8 — Testy:** gating/fallback → dashboard-izolacja → degraded banner → unity silników → E2E flows (import→confirm, model→compute, analysis→initiatives, valuation, budget-variance).

---

## DECYZJE PIOTRA (przed startem programu)
- **D1 — Split-brain:** konsolidujemy do V8 jako SoT + retire legacy (zalecane), czy utrzymujemy fallback? (rekomendacja: V8 SoT, legacy→deprecation po teście parytetu — F1).
- **D2 — Dwa/cztery silniki:** unifikujemy silnik modelowania M16 z `financialEngine` biznesplanu (jeden core liczb), czy jawnie rozdzielamy role (Models=księgowy event-driven, biznesplan=driver-based startup)?
- **D3 — Zakres v1:** rdzeń = Statements+Models+Analysis (z domknięciem skorup) na v1, Valuation/Investment/Prediction pełne w fali 2 (zalecane)?
- **D4 — Seed danych:** zaseedować realistyczny komplet (pełny P&L+BS+CF, kilka modeli/analiz/budżet z actuals) do live-verify każdej zakładki, jak przy M14?
- **D5 — Priorytet P0:** które z 10 P0 pierwsze (rekomendacja kolejności: variance [F6] + scenariusze [F2] + Investment panel [F3] + WACC [F4] = najbardziej widoczne „martwe obietnice"; równolegle F1 konsolidacja + F8 testy).

## NASTĘPNY KROK
Po D1–D5 buduję `M16-STAN-PRACY-ODBIORY.md` (tablica zbiorcza ~40 zadań × 8 bramek, jak M14) i ruszamy per-zakładka z live-verify + testami. Pętla weryfikacji gotowa (lokalny FE→trolley, org a3e05d4a). Domyślnie (bez decyzji) zaczynam od **F2 scenariusze + F3 Investment panel + F4 WACC** (najbardziej rażące martwe obietnice na rdzeniu).
