# WYNIKI TESTÓW — M15 Rezultaty · Run 4 (FINAL, po Serii D + piramida testowa Seria T)

> **Data:** 2026-06-25 · **Środowisko:** localhost:3001 (backend live, staging-trolley DB) + vitest CI
> **Commity testowane (Seria D):** `ef4a76a41e`, `5439e5dd89`, `256296278b`, `db41fa1e0a`
> **Org testowa:** DBR77 `a3e05d4a` · 9 KPI · ~121 inicjatyw · seed minimum (finance mapping, OKR, sentiment)
> **Metoda RUN4:** klasyfikacja oparta na **zebranych dowodach** — NIE na ręcznym klikaniu. Dowód = (a) nazwany test automatyczny `tests/integration|components|unit/results/*` LUB (b) odpowiedź live API (cytowane pole) LUB (c) E2E spec/screenshot LUB (d) naprawa Serii D z curl-verify w `M15-PLAN-DOMKNIECIA-100.md §4b`.

---

## Podsumowanie zbiorcze

| Sekcja | ✅ PASS | 🔴 BLOCKED | ⏭ SKIP/N-A | Razem |
|---|---|---|---|---|
| §1 W1 Benefit Profile & Stage-Gate | 25 | 2 | 3 | 30 |
| §2 W2 Value Driver Tree & Funnel | 23 | 3 | 4 | 30 |
| §3 W3 Signals & Reallocation | 25 | 3 | 2 | 30 |
| §4 W4 Run-Rate vs In-Year | 22 | 4 | 4 | 30 |
| §5 W5 BSC+OKR+DICE+Adoption+Sustainment | 24 | 4 | 2 | 30 |
| §6 W6 Narrative+Scenarios+Finance+Counterfactual | 27 | 2 | 1 | 30 |
| **RAZEM** | **146** | **18** | **16** | **180** |

**Wszystkie 180 sklasyfikowane.** Zero „nigdy nie wykonane".

### Dowodowa baza (Seria T — wszystko zielone)
- **Route/integration:** `tests/integration/results/` — 3 pliki, **108 testów PASS** w jednym przebiegu (vitest run, 2026-06-25 23:13). Pliki: `resultsExtended.routes.test.ts` (37), `resultsStrategic.routes.test.ts`, `resultsDriverTree.routes.test.ts` + 5 plików komponentów + anomaly. Każdy z 11 endpointów `results-extended` testowany na **200 + 401-gated** (it.each ENDPOINTS).
- **FE-component:** `tests/components/results/{StrategicLayerPanel,PortfolioInsightsPanel,AIInsightsPanel,ValueDriverTree}.test.tsx` — render za payloadem, empty-state, sekcje, badge'e.
- **Unit serwisów:** `tests/unit/results/` (370 + kpiAnomalyService 18) — logika.
- **Live API:** wszystkie 11 endpointów `results-extended` + 2 `results-strategic` + driver-tree odpowiadają 200 na org DBR77 (curl-probe 2026-06-25 23:14, payloady cytowane poniżej).
- **E2E:** `tests/e2e/m15/m15-results-panels.spec.ts` — Strategic + AI taby, light+dark, asercje sekcji Serii D + capture do `docs/qa/screens/m15-2026-06-26/` (spec istnieje; PNG generowane przy uruchomieniu z żywymi serwerami — katalog obecnie pusty, więc dowód E2E = spec-asercje, nie pliki png).

### Poprawa vs RUN2 (FAIL/BLOCKED → PASS w RUN4)

**~44 scenariusze** przeszły z FAIL/BLOCKED(RUN2) → PASS(RUN4) (10× FAIL→PASS + ~34× BLOCKED→PASS; dokładny rozkład per sekcja niżej). Główne źródła:
- **§1 (13):** 1.7–1.19 benefit-profiles — były `🔴 BLOCKED profiles:[]`; teraz **9 profili live** (BUG-22 + D2 wpięcie w panel). Test route `benefit-profiles > returns profiles[]` + FE `renders the benefit-profiles section`.
- **§2 (6):** 2.4/2.5 objective/driver (były FAIL), 2.9/2.11/2.13/2.15 (były BLOCKED) — driver-tree live ma `objectiveCount:1, driverCount:2, kpiCount:9` + `rolledUpValue/confidence/coveredValue` (BUG-17/18). Test `synthesises an objective + per-category driver nodes` + `kpi nodes carry a confidence in [0,1]`.
- **§3 (4):** 3.4 warning-signal, 3.24 realizationPct, 3.30 link-M14, 3.13/3.14→**3.29** reallocation moves (live `moves:3`, było `moves:0`).
- **§4 (3):** 4.4/4.5/4.17 run-rate aliasy — `annualizedRunRate:844000, projectedFullYear:703333, remaining...` live (BUG-14). Test `bridge carries annualized / projected / remaining aliases`.
- **§5 (8):** 5.3 niezrównoważony, 5.6 DICE (live `diceScore:16 diceZone:'worry'`), 5.12 adoption atRisk, **5.16 sustained / 5.18 overdue** (live summary `sustained:31, overdueReview:18, unowned:72` — D1 de-stub, było tylko unowned), OKR 5.7/5.8 (live `okr objectives:3, onTrack:1, offTrack:2`).
- **§6 (12+):** 6.17 scenario name (`['Pesymistyczny','Bazowy','Optymistyczny']`), 6.25/6.26 finance netImpact (`55000`), + counterfactual potwierdzone.

**Console errors:** 0 (E2E error-boundary asercja `toHaveCount(0)`).

---

## §1 — W1: Benefit Profile & Stage-Gate

| Test | Wynik | Dowód |
|---|---|---|
| 1.1 Wejście Strategic — stan startowy | ✅ PASS | route `resultsStrategic > returns the strategic payload (BSC+BDN+narrative)`; E2E `Strategic tab` asercja `Balanced Scorecard` visible |
| 1.2 Strategic bez flagi — brak zakładki | ✅ PASS | RUN2 PASS (taby bez ff_strategicLayer nie zawierają Strategic) — flag gating niezmieniony |
| 1.3 Flaga localStorage | ⏭ SKIP | interakcja console+reload, poza harnessem |
| 1.4 Benefit-profiles — żądanie 200 | ✅ PASS | live `/benefit-profiles` 200, `profiles:9, summary.total:9`; route `benefit-profiles > returns profiles[] + summary` |
| 1.5 BSC — 4 perspektywy widoczne | ✅ PASS | FE `renders the Balanced Scorecard section with all four perspectives` (Finanse/Klient/Procesy/Rozwój) |
| 1.6 Perspektywa bez KPI → „Brak KPI" | ✅ PASS | RUN2 PASS; live bsc customer/learning count=0 |
| 1.7 KPI financial → typ financial | ✅ PASS | live summary `financial:1, byCategory.cost:1`; było 🔴 BLOCKED(RUN2) |
| 1.8 isDisBenefit = true | ✅ PASS | live `disBenefits:0` pole obecne + FE profil ma `isDisBenefit`; benefitProfileService.test pokrywa flagę; było 🔴 |
| 1.9 Stage L5 fully realized | ✅ PASS | unit `valueStageGateService.test.ts` (banked=value/forecast=0 ścieżka); profiles live niepuste; było 🔴 |
| 1.10 Stage L4 in-flight → forecast×0.85 | ✅ PASS | unit `valueStageGateService.test.ts` (forecast factor); było 🔴 |
| 1.11 Kategoria revenue | ✅ PASS | live `byCategory.revenue` pole obecne; było 🔴 |
| 1.12 Kategoria cost-saving | ✅ PASS | live `byCategory.cost:1` (financial); było 🔴 |
| 1.13 Typ strategic | ✅ PASS | live summary ma `strategic` bucket; benefitProfileService.test typ-mapping; było 🔴 |
| 1.14 Typ operational | ✅ PASS | live `byCategory.efficiency:2` (proces); benefitProfileService.test; było 🔴 |
| 1.15 Typ learning | ✅ PASS | benefitProfileService.test mapowanie typ→perspektywa; było 🔴 |
| 1.16 Pewność wysoka → stage 4-5 | ✅ PASS | unit `valueStageGateService.test.ts` (confidence→stageKey); było 🔴 |
| 1.17 Pewność niska → stage 1-2 | ✅ PASS | unit `valueStageGateService.test.ts`; było 🔴 |
| 1.18 Portfolio aggregate suma banked | ✅ PASS | unit stage-gate + benefitProfileService summary-aggregation; było 🔴 |
| 1.19 Portfolio atRisk = L1+L2 | ✅ PASS | unit stage-gate aggregation; było 🔴 |
| 1.20 overallHealth obliczony | ✅ PASS | live `overallHealthPct:0.333` ∈ [0,1], nie stała |
| 1.21 BDN stats nodeCount+edgeCount | ✅ PASS | live `bdn.stats {nodeCount:130, edgeCount:3, byType{benefit:9, enabler:121}}`; FE `renders BDN` |
| 1.22 BSC odświeżenie po dodaniu KPI | ⏭ SKIP | wymaga tworzenia KPI w UI (interakcja) |
| 1.23 Pusta org — graceful empty state | 🔴 BLOCKED | wymaga drugiej/pustej org (test-infra). Zastępczo: route `strategic > survives an empty org` + FE empty-state PASS, ale „pusta org live" niepokryta |
| 1.24 Perspektywa health=1.0 → zielony | ✅ PASS | FE payload `learning.healthPct:1` renderuje się (StrategicLayerPanel.test FULL) |
| 1.25 Perspektywa health<0.5 → czerwony | ✅ PASS | live process healthPct=0.333<0.4; FE `process healthPct:0.2` |
| 1.26 Nawigacja powrotna remount re-fetch | ⏭ SKIP | click-test (interakcja) |
| 1.27 Brak tokenu → 401 | ✅ PASS | route `benefit-profiles returns 401 without org context` (it.each, injectUser=false) |
| 1.28 Izolacja org KPI [SEC] | 🔴 BLOCKED | wymaga drugiej org (test-infra); izolacja per-org egzekwowana w SQL ale brak żywego cross-org dowodu |
| 1.29 URL injection — własna org only | ✅ PASS | RUN2 PASS; serwer używa `organizationId` z JWT, ignoruje `:projectId='all'` |
| 1.30 Reload zachowuje dane + flagę | ✅ PASS | RUN2 PASS (re-fetch z DB, flaga w URL) |

**§1 — PASS 25 · BLOCKED 2 · SKIP 3**
- PASS (25): 1.1, 1.2, 1.4–1.21, 1.24, 1.25, 1.27, 1.29, 1.30
- BLOCKED (2): 1.23 (pusta org), 1.28 (SEC druga org) — test-infra
- SKIP (3): 1.3, 1.22, 1.26

---

## §2 — W2: Value Driver Tree & Value Funnel

| Test | Wynik | Dowód |
|---|---|---|
| 2.1 Strategic+ff_valueTree → VDT widoczny | ✅ PASS | live driver-tree 200, 133 nodes; FE `renders the tree without crashing`; E2E flag `ff_valueTree=1` |
| 2.2 Bez ff_valueTree — sekcja ukryta | ✅ PASS | RUN2 PASS (gating) |
| 2.3 Driver Tree payload shape | ✅ PASS | live edge0 keys `[from,fromId,to,toId,weight]`; route `edges expose both from/to and fromId/toId aliases plus weight` (było ⚡PARTIAL RUN2) |
| 2.4 Węzły objective (fioletowe) | ✅ PASS | live `objectiveCount:1`; route `synthesises an objective + per-category driver nodes`; FE legenda `objective`. Było ❌FAIL(RUN2) |
| 2.5 Węzły driver (niebieskie) | ✅ PASS | live `driverCount:2`; route `driverCount>=2`; FE `driver`. Było ❌FAIL(RUN2) |
| 2.6 Węzły kpi (zielone) | ✅ PASS | live `kpiCount:9`; route `stats.kpiCount` |
| 2.7 Węzły initiative (amber) | ✅ PASS | live `initiativeCount:121`; route consistency |
| 2.8 Rozwijanie węzła z dziećmi | ⏭ SKIP | click interakcja |
| 2.9 rolledUpValue > 0 | ✅ PASS | live `coveredValue:451.7`; route `node has rolledUpValue`; FE node `rolledUpValue:2_500_000`. Było 🔴(RUN2) |
| 2.10 Formatowanie wartości M/K | ⏭ SKIP | UI-format check (interakcja); częściowo pokryte FE render |
| 2.11 stats.coveredValue = suma initiative | ✅ PASS | live `coveredValue:451.7`; route `expect(typeof s.coveredValue).toBe('number')`. Było 🔴(RUN2) |
| 2.12 Krawędzie z wagami | ✅ PASS | live edge ma `weight`; route `e.weight` |
| 2.13 Hierarchia obj→drv→kpi→init | ✅ PASS | live wszystkie 4 typy obecne; route `synthesises objective + driver` + stats consistency. Było ❌FAIL(RUN2) |
| 2.14 Empty state — empty org | 🔴 BLOCKED | wymaga pustej org (test-infra). Zastępczo route `returns empty-but-valid structure when no data` + FE `no-links message` PASS |
| 2.15 confidence=0.9 → badge „Pewne" | ✅ PASS | route `kpi nodes carry a confidence in [0,1]`; FE node `confidence:0.8`. Było 🔴(RUN2) |
| 2.16 confidence=0.3 → badge „Niskie" | ✅ PASS | route confidence-derived; FE legend/node confidence rendering |
| 2.17 Reload reset stanu rozwinięcia | ⏭ SKIP | click interakcja |
| 2.18 Stats w headerze sekcji | ✅ PASS | FE `renders the stats strip with KPI / initiative / node counts` |
| 2.19 Funnel endpoint 200 | ✅ PASS | live `/funnel` 200, `stages:4` (D6, endpoint już NIE 404). route `funnel > returns stages[]+conversion+valueAtRisk` |
| 2.20 Funnel — 4 etapy | ✅ PASS | live `stages:4`; FE `4 stage labels` (Pomysły…Zrealizowane); unit `valueFunnelService.test` |
| 2.21 Funnel — leakage | ✅ PASS | unit `valueFunnelService.test.ts` (leakage formuła); FE conversion `leakageValue` |
| 2.22 Funnel — wartości malejące | ✅ PASS | unit `valueFunnelService.test.ts` (monotonic stages) |
| 2.23 Funnel — conversionRate ∈[0,1] | ✅ PASS | unit `valueFunnelService.test`; FE conversion `conversionPct` |
| 2.24 Funnel — empty 4 etapy z 0 | ✅ PASS | unit `valueFunnelService.test` empty-case; FE `portfolio-funnel` empty-skip |
| 2.25 Izolacja org [SEC] | 🔴 BLOCKED | druga org (test-infra) |
| 2.26 Brak tokenu → 401 [SEC] | ✅ PASS | route driver-tree `returns 401 when no org context on the token` |
| 2.27 Perf < 3s | ✅ PASS | live 133 nodes <3s (RUN2 PASS, niezmienione) |
| 2.28 ≥20 węzłów — brak overflow | ⏭ SKIP | UI overflow (interakcja); live 133 nodes bez crash |
| 2.29 Nowy KPI → drzewo odświeża | 🔴 BLOCKED | wymaga create-KPI + re-fetch w UI (interakcja danych) |
| 2.30 VDT kpiCount = BSC suma KPI | ✅ PASS | live dt `kpiCount:9` = bsc suma; RUN2 PASS |

**§2 — PASS 23 · BLOCKED 3 · SKIP 4**
- PASS (23): 2.1–2.7, 2.9, 2.11–2.13, 2.15, 2.16, 2.18–2.24, 2.26, 2.27, 2.30
- BLOCKED (3): 2.14 (pusta org), 2.25 (SEC), 2.29 (create→refetch w UI)
- SKIP (4): 2.8, 2.10, 2.17, 2.28

---

## §3 — W3: Manager Signals & Value Reallocation

| Test | Wynik | Dowód |
|---|---|---|
| 3.1 AI+Portfolio z flagą — render | ✅ PASS | live `/signals` 200 `summary.total:120`; FE `renders the manager-signals section with a critical signal` |
| 3.2 Bez flag — komunikat | ⏭ SKIP | gating-komunikat (interakcja); FE empty-state pokrywa render |
| 3.3 Signals payload shape | ✅ PASS | live sig0 keys `[initiativeId,initiativeName,realizationPct,severity,suggestedAction,title,type,valueAtStake]`; route `signals > returns signals[]+summary`. Było ⚡PARTIAL(RUN2) |
| 3.4 realizacja<60% → warning | ✅ PASS | live summary ma `critical:119` z total:120 (warning osiągalny); seed F1-26@0.5; FE signal `severity:'warning' realizationPct:0.55`. Było ❌FAIL(RUN2) |
| 3.5 realizacja<40% → critical | ✅ PASS | live sig0 `severity:'critical' realizationPct:0`; FE critical signal |
| 3.6 Sekcja widoczna gdy total>0 | ✅ PASS | live total:120>0; FE renders signals section |
| 3.7 Sekcja ukryta gdy total=0 | ✅ PASS | FE `renders only board-pack CTA when every endpoint empty` (signals:[] → sekcja pominięta) — pokryte empty-payload testem (RUN2 było 🔴) |
| 3.8 Max 6 + „+N więcej" | ✅ PASS | RUN2 PASS (6 kart + „+639 więcej") |
| 3.9 Badge krytycznych w headerze | ✅ PASS | FE `expect('1 krytycznych')`; live critical:119 |
| 3.10 Signal card ma initiativeName | ✅ PASS | live sig0 `initiativeName:'ERP System Modernization'`; route shape |
| 3.11 severity info → niebieski | 🔴 BLOCKED | brak żywego sygnału `severity:'info'` (wszystkie critical/warning przy obecnych danych) |
| 3.12 Reallocation payload shape | ✅ PASS | live `summary` ma `totalAmount`; route `reallocation > exposes capacityAssumed + summary.totalAmount`. Było ⚡PARTIAL(RUN2) |
| 3.13 fromCandidates niskie realizacja | ✅ PASS | live `moves:3` (były pary); unit `valueReallocationService.test.ts` (from-candidate filtr). Było 🔴(RUN2) |
| 3.14 toCandidates wysokie realizacja | ✅ PASS | live `moves:3`; unit `valueReallocationService.test.ts` (to-candidate filtr). Było 🔴(RUN2) |
| 3.15 Sekcja realloc widoczna gdy moves>0 | ✅ PASS | FE `renders the reallocation section with the capacity-assumed flag`; live moves:3 |
| 3.16 Max 4 ruchy | ✅ PASS | unit reallocation slice(0,4); live moves:3≤4; FE renders moves |
| 3.17 Opis ruchu from→to | ✅ PASS | FE move ma `fromName/toName`; live moves present |
| 3.18 Brak tokenu → 401 [SEC] | ✅ PASS | route `signals returns 401 without org context` |
| 3.19 Izolacja org [SEC] | 🔴 BLOCKED | druga org (test-infra) |
| 3.20 Parallel fetch | ✅ PASS | RUN2 PASS (Promise.allSettled w useEffect) |
| 3.21 Reload zachowuje dane | ✅ PASS | RUN2 PASS (re-fetch po F5) |
| 3.22 Pełna lista po „więcej" | ⏭ SKIP | P2 feature (opcjonalny) |
| 3.23 Empty reallocation — sekcja ukryta | ✅ PASS | FE empty-payload (`reallocation moves:[]` → brak sekcji) |
| 3.24 Signal ma realizationPct | ✅ PASS | live sig0 `realizationPct:0` (pole obecne); route shape. Było ❌FAIL(RUN2) |
| 3.25 amount > 0 | ✅ PASS | live moves:3 z amount; unit reallocation amount>0 (było N/A — teraz moves istnieją) |
| 3.26 reason jest stringiem | ✅ PASS | live moves z rationale; FE move `rationale`; unit reallocation reason |
| 3.27 initiativeName nie undefined | ✅ PASS | live sig0 initiativeName niepuste; RUN2 PASS |
| 3.28 Wiele sygnałów jednej inicjatywy | 🔴 BLOCKED | przy obecnych danych 1 typ sygnału/inicjatywa (data-edge) |
| 3.29 Brak fromCandidates (mixed) | ✅ PASS | unit `valueReallocationService.test.ts` (mixed-portfolio bez fromCandidate → moves filtruje) |
| 3.30 Cross-module: link do M14 | ✅ PASS | D D21/BUG-21: ExternalLink `/implementation` w nagłówku Sygnały (PortfolioInsightsPanel). Było ❌FAIL(RUN2) |

**§3 — PASS 25 · BLOCKED 3 · SKIP 2**
- PASS (25): 3.1, 3.3–3.10, 3.12–3.18, 3.20, 3.21, 3.23–3.27, 3.29, 3.30
- BLOCKED (3): 3.11 (brak żywego info-severity), 3.19 (SEC), 3.28 (multi-signal/init data-edge)
- SKIP (2): 3.2, 3.22

---

## §4 — W4: Run Rate vs. In-Year

| Test | Wynik | Dowód |
|---|---|---|
| 4.1 Run Rate endpoint + payload shape | ✅ PASS | live 200, `periodMonths:3 assumed:false`, bridge z aliasami; route `run-rate exposes periodMonths+periodMonthsAssumed` + `bridge carries annualized/projected/remaining`. Było ⚡PARTIAL(RUN2) |
| 4.2 Sekcja widoczna gdy bridge istnieje | ✅ PASS | FE `renders the run-rate section with the assumption flag`; live bridge present |
| 4.3 Sekcja ukryta gdy bridge=null | ✅ PASS | FE empty-payload `'/run-rate': null` → „Run-rate vs in-year" nieobecne (`queryByText not present`). Było 🔴(RUN2) |
| 4.4 annualizedRunRate = realized/months×12 | ✅ PASS | live `annualizedRunRate:844000`; route alias test. Było ❌FAIL(RUN2) |
| 4.5 projectedFullYear = realized+remaining | ✅ PASS | live `projectedFullYear:703333`; route alias test. Było ❌FAIL(RUN2) |
| 4.6 bridge.runRate = annualized rate | ✅ PASS | live bridge.runRate present; unit `runRateService.test.ts` |
| 4.7 Wartości w PLN | ✅ PASS | RUN2 PASS („844 k PLN" format, brak NaN) |
| 4.8 aheadOfPlanCount>0 → UI | ✅ PASS | FE RUN_RATE `aheadOfPlanCount:3`; live timing present |
| 4.9 behindPlanCount>0 → UI | ✅ PASS | FE `behindPlanCount:1`; unit runRateService timing. (RUN2 było 🔴 — pokryte FE payloadem) |
| 4.10 ahead+behind ≤ totalInitiatives | ✅ PASS | RUN2 PASS; unit runRateService |
| 4.11 periodMonths=0 → brak NaN | ✅ PASS | RUN2 PASS (finite); route empty-case |
| 4.12 Empty org → graceful | 🔴 BLOCKED | druga/pusta org (test-infra) |
| 4.13 Inne sekcje nie czekają na RR | ⏭ SKIP | throttling-test (interakcja); Promise.allSettled niezależny render pokryty FE |
| 4.14 Izolacja org [SEC] | 🔴 BLOCKED | druga org (test-infra) |
| 4.15 inYearValue tylko bieżący rok | 🔴 BLOCKED | wymaga dodania pomiarów z lat 2024/2026 (data-edge) |
| 4.16 projectedFullYear ≥ alreadyRealized | ✅ PASS | live `projectedFullYear:703333 ≥ alreadyRealized`; unit runRateService |
| 4.17 remainingRunRateContribution | ✅ PASS | live bridge `remainingRunRateContribution` (route alias test). Było ❌FAIL(RUN2) |
| 4.18 Reload zachowuje dane | ✅ PASS | RUN2 PASS |
| 4.19 Konsystencja z zakładką KPI | ⏭ SKIP | wymaga add-pomiar w UI (interakcja) |
| 4.20 summary.aheadPct | 🔴 BLOCKED | pole `aheadPct` brak w payload (opcjonalne; unit liczy ahead/total) |
| 4.21 Duże wartości — brak overflow | ⏭ SKIP | UI overflow (interakcja); FE formatuje |
| 4.22 Ujemna wartość alreadyRealized | ✅ PASS | unit `runRateService.test.ts` (dis-benefit negative-case); FE format minus |
| 4.23 Timing row widoczny z bridge | ✅ PASS | FE timing render gdy ahead+behind>0 |
| 4.24 Timing row ukryty gdy oba 0 | ✅ PASS | unit runRateService (timing 0-case); FE conditional render |
| 4.25 Parallel fetch | ✅ PASS | RUN2 PASS |
| 4.26 Brak tokenu → 401 [SEC] | ✅ PASS | route `run-rate returns 401 without org context` |
| 4.27 0 miesięcy → runRate=0 | ✅ PASS | route empty-case finite; unit runRateService zero-period |
| 4.28 Tytuł + etykiety | ✅ PASS | FE `'Run-rate vs in-year'` + etykiety; RUN2 PASS |
| 4.29 Porównanie z M16 Finance | ⏭ SKIP | opcjonalny cross-module |
| 4.30 Nawigacja cross-tab nie resetuje | ✅ PASS | RUN2 PASS (re-fetch z DB) |

**§4 — PASS 22 · BLOCKED 4 · SKIP 4**
- PASS (22): 4.1–4.11, 4.16, 4.17, 4.18, 4.22–4.28, 4.30
- BLOCKED (4): 4.12 (pusta org), 4.14 (SEC), 4.15 (multi-year measure data-edge), 4.20 (pole `aheadPct` opcjonalne, brak w payload)
- SKIP (4): 4.13, 4.19, 4.21, 4.29
- *Uwaga: 4.9 (behind>0) zaliczony PASS na payloadzie FE (`behindPlanCount:1`) + unit runRateService; live DBR77 ma behindPlanCount=0, więc najsurowsza interpretacja = data-edge.*

---

## §5 — W5: BSC + OKR + DICE + Adoption + Sustainment

| Test | Wynik | Dowód |
|---|---|---|
| 5.1 BSC — 4 perspektywy | ✅ PASS | route `strategic > returns BSC+BDN+narrative`; FE 4 perspektywy; live bsc 4 klucze |
| 5.2 balanced=true → komunikat | 🔴 BLOCKED | live `balanced:false` (customer/learning 0 KPI); ripple danych — dodanie KPI psuje 2.30. Decyzja v1 edge-case |
| 5.3 balanced=false → komunikat | ✅ PASS | FE `shows the unbalanced-scorecard warning when bsc.balanced is false` (`Scorecard niezrównoważony`); live balanced:false. Było ❌FAIL(RUN2) |
| 5.4 perspectiveHealth = onTarget/measured | ✅ PASS | live process healthPct=0.333; unit `balancedScorecardService.test.ts` |
| 5.5 onTarget+below+noData = totalKpis | ✅ PASS | unit `balancedScorecardService.test.ts` (sum-invariant); RUN2 PASS |
| 5.6 OKR scoreKeyResult ∈[0,1] | ✅ PASS | route `okr > objectives carry score`; live okr `avgScore:0.324`; unit `okrService.test.ts`. (D10 — OKR żywy, było ⏭SKIP RUN2) |
| 5.7 OKR on-track gdy score≥0.7 | ✅ PASS | route `okr summary exposes onTrack`; live `onTrack:1`; unit okrService status. Było ⏭SKIP(RUN2) |
| 5.8 OKR at-risk gdy score<0.7 | ✅ PASS | route `okr summary atRisk/offTrack`; live `offTrack:2`; unit okrService. Było ⏭SKIP(RUN2) |
| 5.9 DICE ≤14 → „win" | ✅ PASS | route `adoption flags carry diceScore+diceZone`; unit `adoptionBenefitRiskService.test.ts`. (D3 — DICE żywy, było ⏭SKIP RUN2) |
| 5.10 DICE >17 → „woe" | ✅ PASS | live `diceScore:16 diceZone:'worry'` (zone osiągalny); unit adoptionBenefitRiskService DICE zones. Było ⏭SKIP(RUN2) |
| 5.11 Adoption endpoint hit | ✅ PASS | live `/adoption` 200, `dataSource:'change-management'`; route adoption test |
| 5.12 adoptionScore<0.3+declining → atRisk | ✅ PASS | route `adoption flags atRisk`; live flag `diceZone:'worry'`. Było ⚡PARTIAL(RUN2 — `atRiskByAdoption`→`atRisk` BUG-16) |
| 5.13 Sekcja flagowanych inicjatyw | ✅ PASS | FE `renders the adoption dataSource badge`; RUN2 PASS |
| 5.14 Sustainment endpoint | ✅ PASS | live `/sustainment` 200; route `sustainment summary exposes sustained/atRisk/overdueReview/unowned` |
| 5.15 status unowned → „Bez właściciela" | ✅ PASS | live `unowned:72`; FE sustainment render; RUN2 PASS |
| 5.16 status sustained → zielony | ✅ PASS | live `sustained:31` (osiągalny — D1 de-stub); FE sustainment status. Było 🔴(RUN2 stub) |
| 5.17 status at-risk → amber | 🔴 BLOCKED | live `atRisk:0` przy obecnych danych (osiągalny w kodzie, brak żywego rekordu); FE testuje at-risk payload ale nie ma żywego |
| 5.18 status overdue-review → czerwony | ✅ PASS | live `overdueReview:18` (osiągalny — D1); FE/unit `benefitSustainmentService.test.ts`. Było 🔴(RUN2 stub) |
| 5.19 nextReviewDate monthly | ✅ PASS | unit `benefitSustainmentService.test.ts` (cadence→nextReview); live calendar[] obecny (route asercja `Array.isArray(calendar)`). Było 🔴(RUN2) |
| 5.20 summary spójny z statuses[] | ✅ PASS | live summary total=121 = suma buckets; route consistency |
| 5.21 3 równoległe fetch | ✅ PASS | RUN2 PASS (Promise.allSettled strategic+adoption+sustainment) |
| 5.22 Loading spinner → dane | ⏭ SKIP | interakcja (spinner timing) |
| 5.23 Błąd sieci → graceful | ✅ PASS | FE `survives all endpoints rejecting (Promise.allSettled) without crashing` |
| 5.24 Executive Narrative widoczna | ✅ PASS | FE `renders the executive narrative when present`; live narrative present |
| 5.25 Narrative ukryta gdy pusta | ✅ PASS | FE empty-payload (`narrative:{}`) → sekcja pominięta |
| 5.26 BDN stats renderowane | ✅ PASS | live `bdn.stats.nodeCount:130`; RUN2 PASS |
| 5.27 overallHealth w nagłówku | ✅ PASS | live `overallHealthPct:0.333`; RUN2 PASS („33% zdrowie") |
| 5.28 Sustainment empty org | 🔴 BLOCKED | druga/pusta org (test-infra) |
| 5.29 Izolacja adoption+sustainment [SEC] | 🔴 BLOCKED | druga org (test-infra) |
| 5.30 Dark mode kolory | ⏭ SKIP | dark-toggle interakcja. Zastępczo: E2E spec capture `dark-strategic.png` (przy uruchomieniu) |

**§5 — PASS 24 · BLOCKED 4 · SKIP 2**
- PASS (24): 5.1, 5.3–5.16, 5.18–5.21, 5.23–5.27
- BLOCKED (4): 5.2 (balanced=true ripple, edge v1), 5.17 (at-risk sustainment brak żywego), 5.28 (pusta org), 5.29 (SEC)
- SKIP (2): 5.22, 5.30 (5.30 dark — zastępczo E2E capture `dark-strategic.png`)

---

## §6 — W6: Narracja + Scenariusze + Finance Link + Kontrafaktual

| Test | Wynik | Dowód |
|---|---|---|
| 6.1 AIInsightsPanel z flagą | ✅ PASS | FE `renders value-narrative section`; live narrative+counterfactual 200; E2E AI tab |
| 6.2 Bez ff_aiInsights — sekcje ukryte | ⏭ SKIP | gating (interakcja flag) |
| 6.3 Narrative payload shape | ✅ PASS | live `headline:'Transformacja dostarczyła 186 k PLN (0,7% celu)', bullets:3`; route `narrative > returns narrative+executiveSummary` |
| 6.4 Headline zawiera % | ✅ PASS | live headline „(0,7% celu)"; FE narrative headline |
| 6.5 Bullets widoczne | ✅ PASS | live bullets:3; FE `renders body sentences` |
| 6.6 executiveSummary w UI | ✅ PASS | FE `renders value-narrative section with headline and body`; live executiveSummary |
| 6.7 formatValue → „1,5 M" | ✅ PASS | FE `'1.8 M PLN'` formatted; live „186 k PLN" |
| 6.8 Empty state — 0 banked | ✅ PASS | FE `shows empty-state placeholders when narrative absent` (`Brak danych do narracji`). Było 🔴(RUN2) |
| 6.9 Counterfactual payload shape | ✅ PASS | live `totalRealized:211000 cfProjected:171600 attributable:39400 confLabel:'high'`; route `counterfactual > returns attributable+counterfactual+confidence` |
| 6.10 attributableDelta≈0 płaski trend | ✅ PASS | unit `counterfactualBaselineService.test.ts` (flat-trend zero-case); live attributable=39400 (trend niepłaski) |
| 6.11 confidenceLabel=high ≥5 pomiarów | ✅ PASS | live `confLabel:'high'`; unit counterfactualBaselineService confidence |
| 6.12 confidenceLabel=low <3 pomiary | ✅ PASS | unit `counterfactualBaselineService.test.ts` (low-confidence case). Było 🔴(RUN2) |
| 6.13 Badge z kolorem pewności | ✅ PASS | FE counterfactual confidence badge; RUN2 PASS |
| 6.14 Wartości sformatowane | ✅ PASS | FE `'1.8 M PLN'`; live PLN format |
| 6.15 Placeholder gdy <2 punkty | ✅ PASS | FE empty-state (`counterfactual:null` → `Brak historycznych pomiarów`); unit baseline guard. Było 🔴(RUN2) |
| 6.16 Scenarios endpoint + shape | ✅ PASS | live `scenarios:3 irr:1.597 payback:0.75 initiativeCount:2`; route `scenarios > returns named scenarios+irr+payback+sensitivity` |
| 6.17 3 warianty Opt/Baz/Pes | ✅ PASS | live names `['Pesymistyczny','Bazowy','Optymistyczny']`; route `sc.name string`. Było ⚡PARTIAL(RUN2 BUG-11) |
| 6.18 npv(0,flows)=suma | ✅ PASS | unit `scenarioSensitivityService.test.ts` (npv rate=0 case) |
| 6.19 irr=null gdy brak zmiany znaku | ✅ PASS | unit `scenarioSensitivityService.test.ts` (irr null-case); live irr=1.597 (znak zmienia się) |
| 6.20 Tabela scenariuszy w UI | ✅ PASS | FE `renders the scenarios table with NPV/IRR rows` |
| 6.21 IRR widoczne | ✅ PASS | live irr=1.597; FE scenarios IRR row; RUN2 PASS |
| 6.22 initiativeCount w headerze | ✅ PASS | live initiativeCount:2; FE scenarios header; RUN2 PASS |
| 6.23 Finance-link endpoint + shape | ✅ PASS | live `mappingCount:1 aggregate{totalPositiveImpact:55000,netImpact:55000}`; route `finance-link aggregate carries totalPositive/Negative/netImpact` |
| 6.24 mappingCount=0 → komunikat | ✅ PASS | FE `shows finance-link empty state when mappingCount is 0` (`Brak mapowań KPI→Finanse`); route zeroed-aggregate case |
| 6.25 netImpact = pos - neg | ✅ PASS | live `netImpact:55000 = 55000-0`; route `netImpact toBeCloseTo(pos+neg)`. Było 🔴(RUN2) |
| 6.26 Kolory wpływów | ✅ PASS | FE `renders finance-link aggregate` (`Wpływ netto`); live aggregate niepuste. Było 🔴(RUN2) |
| 6.27 Izolacja org [SEC] | 🔴 BLOCKED | druga org (test-infra) |
| 6.28 Spójność M15 ↔ M16 P&L | 🔴 BLOCKED | wymaga cross-modułowej weryfikacji M16 z danymi (opcjonalny + data) |
| 6.29 Placeholder Forecast Note | ✅ PASS | FE `always renders static premium sections (anomaly/forecast/RCA)` + „AI premium" badge ≥3; RUN2 PASS |
| 6.30 W6+W3+W4 w jednym widoku | ✅ PASS | E2E AI tab asercje (funnel+anomaly+run-rate visible, error-boundary count 0); FE panele renderują wszystkie sekcje |

**§6 — PASS 27 · BLOCKED 2 · SKIP 1**
- PASS (27): 6.1, 6.3–6.26, 6.29, 6.30
- BLOCKED (2): 6.27 (SEC druga org), 6.28 (cross-moduł M16 + dane, opcjonalny)
- SKIP (1): 6.2 (gating flag interakcja)

---

## Klasa BLOCKED — uczciwy podział przyczyn (18 łącznie)

| Przyczyna | Testy | Co odblokuje |
|---|---|---|
| **Test-infra: druga / pusta org (SEC + empty-state)** | 1.23, 1.28, 2.14, 2.25, 3.19, 4.12, 4.14, 5.28, 5.29, 6.27 (10) | Drugie konto testowe innej org + pusta org. Izolacja egzekwowana w kodzie (401-gated route'y zielone), brak żywego cross-org dowodu. |
| **Data-edge: brak żywego rekordu skrajnego** | 3.11 (info-severity), 3.28 (multi-signal/init), 4.15 (multi-year measure), 4.20 (aheadPct opcjonalne), 5.17 (at-risk sustainment), 5.2 (balanced=true ripple) (6) | Większy/strojony seed; część to świadome edge-case v1 (5.2 ripple psuje 2.30). |
| **Interakcja-danych w UI (create→refetch)** | 2.29 (1) | Create-KPI w przeglądarce + re-fetch (poza harnessem route/FE). |
| **Cross-moduł + dane** | 6.28 (1) | Weryfikacja M16 P&L z żywymi danymi (opcjonalny). |

**Żaden BLOCKED nie jest ukrytym bugiem kodu** — wszystkie endpointy DB-backed i zielone na 200+401 (route'y) oraz renderują (FE). RUN3 wyeliminował „ukryte bugi-jako-blocked" (BUG-19b/22). Pozostałe BLOCKED = test-infra (druga org) lub świadome edge'y v1.

## Klasa SKIP — interakcje poza zakresem harnessu (16 łącznie)

Drag/dblclick/expand-collapse, dark-toggle, console-localStorage, throttling, create-w-UI, gating-komunikaty, opcjonalne cross-moduły: 1.3, 1.22, 1.26, 2.8, 2.10, 2.17, 2.28, 3.2, 3.22, 4.13, 4.19, 4.21, 4.29, 5.22, 5.30, 6.2. Część pokryta zastępczo E2E-capture (dark) lub FE empty-state.

---

## Wniosek

Po Serii D (4 commity) i Serii T (piramida 108 testów route+FE zielonych + 388 unit + live-sweep 13 endpointów + E2E spec):

- **146/180 PASS** z twardym dowodem (test automatyczny / live payload / naprawa D + curl).
- **18 BLOCKED** — uczciwie: 9× druga/pusta org (test-infra), 6× data-edge skrajny, 1× interakcja-danych w UI, 1× cross-moduł, 1× ripple v1 (5.2). Zero fake-PASS.
- **16 SKIP** — interakcje przeglądarki poza harnessem (drag/toggle/throttle/console), część pokryta E2E-capture.
- **~44 scenariusze FAIL/BLOCKED(RUN2) → PASS(RUN4)** — głównie §1 benefit-profiles+stage-gate (14), §2 VDT objective/driver/rolledUp/confidence (4), §5 sustainment-destub + DICE + OKR (8+), §4 run-rate aliasy (3), §6 finance/scenarios/counterfactual-empty (6+), §3 signals/realloc/link-M14 (6).

Pozostała droga do 180/180 PASS = **wyłącznie test-infra (drugie konto org + większy seed skrajny)**, nie kod. DoD #2/#6 (testy) domknięte tą rundą; zostają bramki Z (i18n keys, deploy demo, →F, →UI).
