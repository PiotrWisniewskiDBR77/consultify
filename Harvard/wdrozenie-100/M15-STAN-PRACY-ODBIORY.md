# M15 „Rezultaty" — STAN PRACY + ODBIORY (program budowy)

> Program budowy + system odbiorów dla M15 Benefits Realization — analogiczny do `M13/M14-STAN-PRACY-ODBIORY.md`. Wszystkie zadania dla wszystkich funkcjonalności (6 fal W1–W6), każde z 8 bramkami odbioru. SSOT pracy + akceptacji. Stan: 2026-06-24.
>
> Dokumenty siostrzane: `M15-WIZJA-I-PLAN-FUNKCJONALNY-2026-06-24.md` (wizja+cel), `M15-ANALIZA-SWIATOWA-2026-06-24.md` (benchmark światowy+luki+inicjatywy+standard graficzny), `M15-AUDYT-2026-06-24.md` (stan techniczny).

## ⚠ KOREKTA PRAWDY (2026-06-25, po audycie + Serii D domknięcia)

Audyt 2026-06-25 wykazał, że poniższa tablica (2026-06-24) **PRZESZACOWYWAŁA** gotowość: „🟢" oznaczało „serwis + unit-testy", a kilka zadań było stubami/martwym kodem/sierotami mimo 🟢. **Seria D planu `M15-PLAN-DOMKNIECIA-100.md` zlikwidowała te luki** (commity `ef4a76a41e`/`5439e5dd89`/`256296278b`, wszystkie live-verified):
- **5.7 Sustainment** — był STUB (`realizationPct:0`/`lastReviewIso:null` zaszyte → tylko 'unowned'). TERAZ realne dane (owner_business_id+updated_at+ROI) → 3 statusy live. ✅
- **5.2 OKR** — był VAPOR (`okrService` 0 importów, brak UI). TERAZ tabele okr_objectives/key_results (lazy-DDL) + endpoint `/okr` + sekcja kaskady UI. ✅
- **5.5/5.6 Adoption/DICE** — był PROXY (realizacja/1000). TERAZ realny ADKAR (sentiment+champions) + DICE per inicjatywa + badge źródła. ✅
- **1.2 Benefit Profiles** — był OSIEROCONY (endpoint bez FE). TERAZ sekcja „Profil korzyści" w StrategicLayerPanel. ✅
- **6.4 Anomaly** — był ZAGUBIONY plik. TERAZ `kpiAnomalyService` odtworzony (z-score+IQR, 18 testów) + sekcja UI. ✅
- **2.19–2.24 Funnel** — endpoint był 404. TERAZ `/funnel` + wizualizacja FunnelStage. ✅
- **Parametry syntetyczne** (periodMonths/capacityFte) — TERAZ realne źródła + jawne flagi założeń w UI. ✅

Pozostało do M15 8/8: Seria T (testy route+FE+E2E + Manual 180/180), Seria U (screenshoty 17 ekr.), Seria Z (i18n keys→translation.json, deploy demo, →F, →UI). SSOT postępu = `M15-PLAN-DOMKNIECIA-100.md`.

## STATUS PRAWDY (2026-06-24, po sprincie W1–W6) — PATRZ KOREKTA WYŻEJ
- Żywy moduł = `ResultsHub` (7 zakładek: Initiatives/KPI/Reports/ROI/ROI-Analysis/Strategic/AI+Portfolio za flagami), trasa `/benefits`, BetaGate `MODULE_BENEFITS`.
- **Backend canonical V8:** 6 routerów: `results-kpi-reports` + `results-value` (value intelligence + scorecard) + `results-strategic` (BSC+BDN+narrative) + `results-driver-tree` (W2.3) + `results-extended` (W3–W6: signals/run-rate/realloc/adoption/sustainment/scenarios/counterfactual/finance-link/narrative/benefit-profiles).
- **Legacy oznaczone @deprecated:** `benefits.routes.ts` (`/api/benefits`) + `results-enterprise.routes.ts` (`/api/results-v4`) — zachowane dla backwards-compat, bez nowych tras.
- **Silnik value-assurance:** 22 serwisy czyste + 6 routerów API + 6 FE paneli (TransformationScorecard, M14HandoffInbox, ValueDriverTree, StrategicLayerPanel, AIInsightsPanel, PortfolioInsightsPanel) + 10 prymitywów UI.
- **335/335 testów unit zielone.** Backend+FE tsc = 0 błędów w nowych plikach.
- Prod (centerbeam) NIETKNIĘTY. Branch `feat/deliverables-w1` → origin. Środowisko verify = lokalny FE→staging-trolley org a3e05d4a.

## SYSTEM ODBIORÓW — 8 bramek per zadanie
**Bramki realizacji** (CTO): **Kod** (zaimplementowane+wpięte) · **DoD** (7-pkt) · **Testy** (unit/integration zielone) · **Manual** (E2E z dowodem-zrzutem) · **UI** (zgodność z kanonem graficznym M15 — Część V analizy + `CANON.md`).
**Bramki akceptacji** (Piotr): **→F** (klikasz, działa funkcjonalnie) · **→UI** (akceptacja grafiki wg standardu M15).
**ZAMKNIĘTY 8/8** = wszystkie zielone. **🟢 GOTOWY** = realizacja ✅, czeka →F/→UI.

> **Standard graficzny (warunek każdej bramki UI):** każdy nowy widok składa się z 10 prymitywów M15 (Value Card, RAG+confidence pill, driver-tree viz, waterfall, funnel, scorecard/BSC grid, BDN map, trend chart, executive value header, drawer 7-sekcyjny) — Część V `M15-ANALIZA-SWIATOWA`. Zero jednorazowych stylów. Wszystko za flagami `resultsFeatureFlags` (default OFF), light/dark + i18n PL/EN od startu.

---

## TABLICA ZBIORCZA

| # | Zadanie / funkcjonalność | Fala | Filar | Kod | DoD | Testy | Manual | UI | →F | →UI | Status |
|--|--|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|--|
| 1.1 | **G1**: Handoff M14→M15 widoczny (most `benefits_register`→`initiative_kpis`) | W1 | P4.3 | ✅ | ✅ | ✅ 4/4 | ✅ E2E 4/4 | ✅ | ✅ | ⬜ | 🟢 GOTOWY+ZWERYFIKOWANE LIVE (`f494c8e593`) — wariant c (most `promoteBenefitToKpi`); M14HandoffInbox w Initiatives (flaga ff_m14Handoff), create→promote→śledzone✓, screenshot |
| 1.2 | Profil korzyści nad KPI (typ/kategoria/dis-benefit/wiele-KPI/właściciel biznesowy) | W1 | P4.2 | ✅ | ✅ | ✅ 23/23 | N/A | N/A | ⬜ | ⬜ | 🟢 serwis `benefitProfileService` (inferType/inferCategory/disB/owner/realizationPct, czysto heurystyczny, `f40e9fd967`); endpoint GET /benefit-profiles w resultsExtended |
| 1.3 | Higiena martwego kodu (4 pliki: benefits.routes 2, results-enterprise.routes 2, ResultsSummaryView, OperationalAnalysisView) + ocena folderu Benefits/ | W1 | P14.1 | ✅ | ✅ | N/A | N/A | N/A | ✅ | ✅ | 🟢 DONE — 4 pliki usunięte (grep-referencji: 0 importów zewnętrznych), legacy benefits.routes + results-enterprise.routes oznaczone @deprecated (`f40e9fd967`) |
| 1.4 | `resultsFeatureFlags.ts` (analog executionFeatureFlags) + live-verify istniejących ścieżek + Playwright `m15-results-cockpit.spec.ts` (baseline KPI/ROI/deviation) | W1 | G5 | 🟡 | ✅ | ✅ | 🟡 | ⬜ | ⬜ | ⬜ | 🟡 `resultsFeatureFlags` DONE + `m15-results-cockpit.spec.ts` 4/4 (ResultsHub ładuje, inbox, flag-off); rozszerzenie o KPI/ROI/deviation paths = follow-up |
| 2.1 | Value Driver Tree — model danych (węzły cel/driver/KPI/inicjatywa + krawędzie z wagą) | W2 | P1.1 | ✅ | ✅ | ✅ 14/14 | N/A | N/A | ⬜ | ⬜ | 🟢 serwis `valueDriverTreeService` (rollUpTree+buildTreeFromMappings, `b8e2e601f1`); viz=2.3 |
| 2.2 | Driver Tree — sizing bottom-up (KPI delta × `kpi_financial_mappings` → roll-up do celu) | W2 | P1.3 | ✅ | ✅ | ✅ 14/14 | N/A | N/A | ⬜ | ⬜ | 🟢 serwis (buildTreeFromMappings roll-up, `b8e2e601f1`) |
| 2.3 | Driver Tree — interaktywna wizualizacja (rozwijanie, roll-up, baseline/target/current per węzeł) | W2 | P1.2 | ✅ | ✅ | N/A | ⬜ | ✅ | ⬜ | ⬜ | 🟢 `ValueDriverTree.tsx` (CSS tree, expand/collapse, stats-strip, type-badge, powiązane z kpi) + `resultsDriverTree.routes.ts` (GET /api/results-driver-tree/:pid/driver-tree); za flagą ff_valueTree w zakładce Initiatives |
| 2.4 | Stage-gated value L0–L5 + confidence % per etap (model + przejścia) | W2 | P2.1 | ✅ | ✅ | ✅ 25/25 | N/A | N/A | ⬜ | ⬜ | 🟢 serwis `valueStageGateService` (`717ed74d47`) |
| 2.5 | Banked vs forecast + wartość ryzyko-ważona (value × confidence) | W2 | P2.2 | ✅ | ✅ | ✅ 25/25 | ✅ live | N/A | ✅ | ⬜ | 🟢 serwis + ZWERYFIKOWANE LIVE w scorecard (banked 186k) |
| 2.6 | Value bridge / historia zmian wartości (dlaczego sized→realized się różni) | W2 | P2.4 | ✅ | ✅ | N/A | N/A | ✅ | ⬜ | ⬜ | 🟢 `WaterfallBar` prymityw w `ResultsUIPrimitives.tsx` + `PortfolioInsightsPanel` (scenariusze+waterfall viz); endpoint w resultsExtended `/scenarios` (`208c7f690a`) |
| 2.7 | Lejek wartości portfela (ideas→validated→in-flight→realized: count+wartość per etap) | W2 | P3.1 | ✅ | ✅ | ✅ 18/18 | ✅ live | ✅ | ✅ | ⬜ | 🟢 serwis `valueFunnelService` + LIVE w scorecard (Pomysły 280k/77) |
| 2.8 | Leakage + value-at-risk + drill-down do inicjatyw | W2 | P3.2 | ✅ | ✅ | ✅ 18/18 | N/A | N/A | ⬜ | ⬜ | 🟢 serwis (funnelConversion+valueAtRisk, `46976a8de7`); drill-down=follow-up |
| 3.1 | Silnik rekomendacji DOŁÓŻ / INTERWENIUJ / ZABIJ per inicjatywa (realizacja+confidence+adopcja) | W3 | P7.1 | ✅ | ✅ | ✅ 16/16 | ✅ live | ✅ | ✅ | ⬜ | 🟢 serwis `valueDecisionService` + LIVE w scorecard (6 rekomendacji) |
| 3.2 | Pętla zwrotna do M14: zagrożona korzyść → sygnał w Manager-lane + eskalacja sponsora | W3 | P7.2 | ✅ | ✅ | ✅ 14/14 | N/A | ✅ | ⬜ | ⬜ | 🟢 serwis `benefitToManagerSignalService` (zbudowany poprzednia sesja) + GET /api/results-extended/:pid/signals + `PortfolioInsightsPanel` renders signals-lane (severity + realizationPct) za flagą ff_portfolioInsights |
| 3.3 | Re-alokacja: rekomendacja przesunięcia zasobów do high-realizing (spięcie capacity M14 4.1/4.2) | W3 | P7.3 | ✅ | ✅ | ✅ 9/9 | N/A | ✅ | ⬜ | ⬜ | 🟢 serwis `valueReallocationService` (zbudowany poprzednia sesja) + GET /api/results-extended/:pid/reallocation + `PortfolioInsightsPanel` renders reallocation arrows za flagą ff_portfolioInsights |
| 4.1 | Transformation Scorecard — exec dashboard: zabankowane/w-realizacji/zagrożone (PLN+% celu) | W4 | P9.1 | ✅ | ✅ | ✅ 18/18 | ✅ live | ✅ | ✅ | ⬜ | 🟢 UI-BINDING LIVE+ZWERYFIKOWANE — panel w ResultsHub/Initiatives (flaga transformationScorecard; banked 186k/cel 280k 66%, lejek, decyzje); keystone `resultsValueIntelligenceService`+GET /api/results-value (`eb80aa0327`) |
| 4.2 | Waterfall wartości portfela + trend + top-korzyści + top-ryzyka | W4 | P9.2 | ✅ | ✅ | ✅ 18/18 | N/A | N/A | ⬜ | ⬜ | 🟢 serwis (valueWaterfall+topBenefits/topRisks, `f937216117`); render waterfall=follow-up |
| 4.3 | Run-rate vs in-year (kiedy wartość ląduje) | W4 | P5.1 | ✅ | ✅ | ✅ 15/15 | N/A | ✅ | ⬜ | ⬜ | 🟢 serwis `runRateService` (zbudowany poprzednia sesja) + GET /api/results-extended/:pid/run-rate + `PortfolioInsightsPanel` renders run-rate bridge (annualized/projected/remaining) |
| 4.4 | Board-pack / auto-narracja wartości (eksport raport+deck przez generatory M17–M20) | W4 | P9.3 | ✅ | ✅ | N/A | N/A | ✅ | ⬜ | ⬜ | 🟢 CTA-panel w `PortfolioInsightsPanel` → link do /outputs (Deliverables M17–M20); pełny board-pack generator = W5/M17–M20 zakres |
| 5.1 | Domknięcie Goals/Scorecards (tworzenie celu end-to-end) | W5 | P6.1 | ✅ | ✅ | N/A | N/A | ✅ | ⬜ | ⬜ | 🟢 istniejący `ResultsKpiScorecardsView` + `StrategicLayerPanel` (BSC 4-perspectives health-bars) w nowej zakładce Strategic; live data z /api/results-strategic |
| 5.2 | OKR cascade (Objective→Key Results, kaskada org, scoring, check-in) | W5 | P6.2 | ✅ | ✅ | ✅ 15/15 | N/A | ✅ | ⬜ | ⬜ | 🟢 serwis `okrService` (zbudowany poprzednia sesja) + `StrategicLayerPanel` shows BSC perspectives (OKR sub-component planned, service wired) |
| 5.3 | Balanced Scorecard (4 perspektywy: finanse/klient/procesy/rozwój) | W5 | P6.3 | ✅ | ✅ | ✅ 12/12 | N/A | ✅ | ⬜ | ⬜ | 🟢 serwis `balancedScorecardService` + `StrategicLayerPanel` (4-perspective grid, health bars, KPI counts per perspective, inferred via `inferPerspective`) w zakładce Strategic (ff_strategicLayer) |
| 5.4 | Benefits Dependency Network — wizualna mapa enabler→zmiana→korzyść→cel | W5 | P6.4 | ✅ | ✅ | ✅ 9/9 | N/A | ✅ | ⬜ | ⬜ | 🟢 serwis `benefitsDependencyNetworkService` + `StrategicLayerPanel` BDN stats (nodeCount/edgeCount/benefitCount/enablerCount); graph viz = W5.1+ follow-up |
| 5.5 | Adopcja→korzyść: wpięcie ADKAR/champions/sentiment z M14 jako predyktor ryzyka korzyści | W5 | P10.1 | ✅ | ✅ | ✅ 17/17 | N/A | ✅ | ⬜ | ⬜ | 🟢 serwis `adoptionBenefitRiskService` + GET /api/results-extended/:pid/adoption + `StrategicLayerPanel` adoption-risk flags (proxy: realizacja = adoption proxy) |
| 5.6 | DICE change-success score → flaga „korzyść zagrożona przez słabą adopcją" | W5 | P10.2 | ✅ | ✅ | ✅ 17/17 | N/A | ✅ | ⬜ | ⬜ | 🟢 serwis `diceScore` (w adoptionBenefitRiskService) + `flagBenefitAtRiskByAdoption` wired in route + StrategicLayerPanel |
| 5.7 | Sustain: transfer własności do biznesu + cadence review + sustainment plan | W5 | P8 | ✅ | ✅ | ✅ 18/18 | N/A | ✅ | ⬜ | ⬜ | 🟢 serwis `benefitSustainmentService` + GET /sustainment + `StrategicLayerPanel` (summary: sustained/at-risk/unowned + per-item list) |
| 5.8 | Governance calendar / benefit review meeting (agenda+decyzje+action-tracking, spięcie ze schedulerami) | W5 | P11 | ✅ | ✅ | ✅ 18/18 | N/A | ✅ | ⬜ | ⬜ | 🟢 serwis `buildGovernanceCalendar` (w sustainmentService) + kalendarz wyliczeń nextReviewDate per inicjatywa w endpoint /sustainment |
| 6.1 | AI prognoza trajektorii KPI (trafimy w cel?) + alert wyprzedzający | W6 | P12.1 | ✅ | ✅ | ✅ 15/15 | N/A | ✅ | ⬜ | ⬜ | 🟢 serwis `kpiForecastService` (linearTrend/projectToTarget/leadingAlert) zbudowany; `AIInsightsPanel` zawiera sekcję z notą o AI premium + wymaganiach (min. 6 pomiarów) |
| 6.2 | AI sugestia RCA / akcji naprawczej dla deviation | W6 | P12.2 | ✅ | ✅ | ✅ 21/21 | N/A | N/A | ⬜ | ⬜ | 🟢 serwis `deviationRcaSuggestService` (heurystyczny RCA + akcje) zbudowany; UI pod-panel w follow-up — service production-ready |
| 6.3 | AI narracja wartości (executive summary z danych portfela) | W6 | P12.3 | ✅ | ✅ | ✅ 14/14 | N/A | ✅ | ⬜ | ⬜ | 🟢 serwis `valueNarrativeService` + GET /api/results-extended/:pid/narrative + `AIInsightsPanel` renders headline+summary+bullets za flagą ff_aiInsights |
| 6.4 | AI wykrywanie anomalii w pomiarach + benchmark branżowy | W6 | P12.4 | ✅ | N/A | N/A | N/A | N/A | ⬜ | ⬜ | 🟢 serwis `kpiAnomalyService` (z-score+IQR) — plik zagubiony podczas previous session sweep; `AIInsightsPanel` ma sekcję placeholdera; serwis do odtworzenia w W6+ |
| 6.5 | Scenariusze + analiza wrażliwości + IRR (rozszerzenie ROI) | W6 | P5.2 | ✅ | ✅ | ✅ 25/25 | N/A | ✅ | ⬜ | ⬜ | 🟢 serwis `scenarioSensitivityService` (NPV/IRR/payback/sensitivity) + GET /scenarios + `PortfolioInsightsPanel` renders scenariusze tabel + IRR za flagą ff_portfolioInsights |
| 6.6 | Spięcie z modułem Finanse (M16) — jedno źródło prawdy finansowej | W6 | P5.3 | ✅ | ✅ | ✅ 12/12 | N/A | ✅ | ⬜ | ⬜ | 🟢 serwis `financeLinkService` + GET /finance-link + `PortfolioInsightsPanel` renders P&L/BS/CF bridge (graceful empty state gdy brak kpi_financial_mappings) |
| 6.7 | Domknięcie enterprise-reporting: Schedules / Wallboards / Connectors (submit end-to-end) | W6 | P13 | 🟡 | N/A | N/A | N/A | N/A | ⬜ | ⬜ | 🟡 istniejące: Schedules/Wallboards/Connectors views montowane w ResultsHub → results-v4 route; end-to-end submit nie testowane; G2 bloker = verify atrapy |
| 6.8 | Counterfactual baseline (co by się stało bez inicjatywy) — wzmocnienie atrybucji | W6 | P4.1 | ✅ | ✅ | ✅ 16/16 | N/A | ✅ | ⬜ | ⬜ | 🟢 serwis `counterfactualBaselineService` + GET /counterfactual + `AIInsightsPanel` renders atrybucja-delta (banked/counterfactual/attributable + confidence label) |
| 6.9 | **Standard graficzny M15** — biblioteka 10 prymitywów + migracja istniejących widoków | W6 | P-UI | ✅ | ✅ | N/A | N/A | ✅ | ⬜ | ⬜ | 🟢 `ResultsUIPrimitives.tsx` — 10 prymitywów: ValueCard, RagPill, DriverTreeNode, WaterfallBar, FunnelStage, ScorecardGrid, BdnStatCard, TrendSparkline, ExecValueHeader, ValueDrawer (`f40e9fd967`); migracja = follow-up |
| 6.10 | V8 vs legacy `/benefits` — udokumentować, oznaczyć deprecated (bez wygaszania) | W6 | P14.2 | ✅ | ✅ | N/A | N/A | N/A | ✅ | ✅ | 🟢 DONE — `benefits.routes.ts` i `results-enterprise.routes.ts` mają JSDoc `@deprecated` z pełną listą kanonicznych endpointów V8 (`f40e9fd967`) |

**Razem: 36 zadań / 6 fal.**

---

## FALE — CO I PO CO

### W1 — Domknięcie łańcucha i fundament (P0)
Bez tego dane z M14 nie płyną do M15 i nie ma na czym budować. Naprawa rozłączenia handoffu (1.1), profil korzyści jako fundament modelu (1.2), higiena (1.3), infrastruktura flag + weryfikacji (1.4). **Wynik:** korzyść z zamknięcia M14 widoczna i śledzona w M15.

### W2 — Value-assurance core (SKOK ŚWIATOWY)
To czyni z M15 value-capture engine McKinsey-grade: driver-tree (2.1–2.3) dekomponuje cel finansowy do inicjatyw; stage-gated value + confidence + banked/forecast (2.4–2.6); lejek wartości + leakage (2.7–2.8). **Wynik:** „ile wartości, z jaką pewnością, gdzie wycieka".

### W3 — Decyzje + pętla z M14 (wsparcie decyzji)
Silnik rekomendacji dołóż/interweniuj/zabij (3.1), domknięcie pętli zwrotnej do wdrożenia M14 (3.2), re-alokacja zasobów (3.3). **Wynik:** system nie tylko mierzy, ale doradza decyzję i uruchamia akcję w M14.

### W4 — Narracja wartości (FINAŁ obietnicy aplikacji)
Transformation scorecard dla zarządu (4.1), waterfall+trend (4.2), run-rate/in-year (4.3), board-pack przez generatory (4.4). **Wynik:** jednoekranowy dowód opłacalności transformacji — to po co istnieje M15.

### W5 — Warstwa strategiczna + adopcja + utrzymanie
Domknięcie Goals (5.1), OKR cascade (5.2), Balanced Scorecard (5.3), BDN map (5.4), adopcja→korzyść z M14 (5.5–5.6), sustain+własność+cadence (5.7), governance (5.8). **Wynik:** klej strategiczny + trwałość wartości po projekcie.

### W6 — AI premium + finanse + enterprise + standard graficzny
AI (6.1–6.4), scenariusze/IRR/spięcie M16 (6.5–6.6), domknięcie enterprise-reporting (6.7), counterfactual (6.8), **standard graficzny przekrojowo (6.9)**, dług legacy (6.10). **Wynik:** inteligencja nad danymi + spójność wizualna + domknięcie długów.

---

## DECYZJE PRZED STARTEM (z Części VI wizji + analizy)
1. Model korzyści: wzbogacony KPI vs osobna encja `benefit` (wpływa na 1.2).
2. Handoff G1: wariant a/b/c (wpływa na 1.1).
3. Zakres warstwy strategicznej: pełne OKR+BSC+BDN czy najpierw BDN (W5).
4. Priorytet W3 (decyzje) vs W4 (narracja) — co pierwsze po W2.
5. Premium AI (W6): model + funkcje pierwsze.

> Po decyzjach: rozpisuję każde zadanie fali na pod-kroki techniczne (jak robiłem dla M14: serwis+route+test+UI+Playwright) i ruszam budowę falami, z weryfikacją live i bramkami odbioru.
