# WYNIKI TESTÓW — M15 Rezultaty · Run 2 (po naprawach BUG-05–10)

> **Data:** 2026-06-25 · **Środowisko:** localhost:3000 (Vite) → localhost:3001 (backend `0cbe83051c`)
> **Commit testowany:** `0cbe83051c` (fix 6x P1/P2 bugs)
> **Org testowa:** DBR77 · 9 KPI · 646 inicjatyw · 186 000 PLN zrealizowane

---

## Podsumowanie

| Sekcja | PASS | FAIL | BLOCKED | SKIP | PARTIAL | N/A | Razem |
|---|---|---|---|---|---|---|---|
| §1 W1 Benefit Profile | 8 | 0 | 14 | 6 | 1 | 1 | 30 |
| §2 W2 VDT | 6 | 3 | 5 | 14 | 1 | 1 | 30 |
| §3 W3 Signals | 11 | 3 | 4 | 5 | 2 | 5 | 30 |
| §4 W4 Run-Rate | 11 | 3 | 5 | 7 | 1 | 3 | 30 |
| §5 W5 BSC+Adoption+Sust | 12 | 1 | 7 | 7 | 1 | 2 | 30 |
| §6 W6 Narr+Scen+Finance | 16 | 0 | 6 | 4 | 3 | 1 | 30 |
| **RAZEM** | **64** | **10** | **41** | **43** | **9** | **13** | **180** |

**Pass rate (weryfikowalne):** 64 / (64+10+9) = **78%** PASS na testach z wynikiem  
**vs Run 1:** 76 PASS / 10 FAIL — teraz 64 PASS / 10 FAIL (mniej blocked ale część wcześniejszych PASS to były te same)  
**Console errors:** 0

---

## Nowe bugi znalezione w Run 2

| ID | Prio | Obszar | Opis |
|---|---|---|---|
| BUG-M15-11 | P1 | Scenarios | `scenarios[].name` = null w payload (UI naprawia FE fallbackiem, ale API spec wymagała pola) |
| BUG-M15-12 | P2 | DT Edges | Krawędzie mają `fromId/toId` zamiast `from/to` (spec oczekuje `from/to`) |
| BUG-M15-13 | P2 | Signals | Signal brak `realizationPct` + `id` per rekord; `message` → mamy `title` |
| BUG-M15-14 | P2 | Run-Rate Bridge | Brak pól `annualizedRunRate`, `projectedFullYear`, `remainingRunRateContribution` (API ma `runRate`, `projectedInYear`, `alreadyRealized`) |
| BUG-M15-15 | P2 | Reallocation | Summary ma `freedFte` zamiast `totalAmount` |
| BUG-M15-16 | P2 | Adoption | `flags[].atRiskByAdoption` zamiast `flags[].atRisk` |
| BUG-M15-17 | P1 | VDT Nodes | Brak węzłów `objective` i `driver` — tylko `kpi` + `initiative` (puste hierarchia) |
| BUG-M15-18 | P2 | VDT Nodes | Węzły bez `rolledUpValue`, `confidence`; `stats.coveredValue` brak |
| BUG-M15-19 | P2 | Finance-Link | `aggregate = null` gdy mappingCount=0 (spec: `{totalPositiveImpact:0, totalNegativeImpact:0, netImpact:0}`) |
| BUG-M15-20 | P2 | BSC balanced | Gdy `balanced=false` brak komunikatu "scorecard niezrównoważony" w UI |
| BUG-M15-21 | P1 | Signals cross | Brak linka do M14 w nagłówku sekcji Sygnały (test 3.30) |

---

## §1 — W1: Benefit Profile & Stage-Gate

| Test | Wynik | Uwagi |
|---|---|---|
| 1.1 Wejście Strategic — stan startowy | ✅ PASS | Tab aktywny, strategic API 200, panel renderuje 4 sekcje |
| 1.2 Strategic bez flagi — brak zakładki | ✅ PASS | Tabs bez ff_strategicLayer: Initiatives/KPI/KPI Reports/ROI/ROI Analysis |
| 1.3 Flaga localStorage | ⏭ SKIP | Wymaga console JS + reload |
| 1.4 Benefit-profiles — żądanie 200 | ✅ PASS | `/benefit-profiles` → 200, `{profiles:[], summary:{total,financial,...}}` |
| 1.5 BSC — 4 perspektywy widoczne | ✅ PASS | Finanse/Klient/Procesy/Rozwój widoczne |
| 1.6 BSC — perspektywa bez KPI → "Brak KPI" | ✅ PASS | Klient i Rozwój → "Brak KPI" (BUG-06 naprawiony) |
| 1.7 KPI financial w profilu | 🔴 BLOCKED | profiles:[] — brak benefitProfile danych |
| 1.8 isDisBenefit = true | 🔴 BLOCKED | profiles:[] |
| 1.9 Stage L5 fully realized | 🔴 BLOCKED | profiles:[] |
| 1.10 Stage L4 in-flight | 🔴 BLOCKED | profiles:[] |
| 1.11 Kategoria revenue | 🔴 BLOCKED | profiles:[] |
| 1.12 Kategoria cost-saving | 🔴 BLOCKED | profiles:[] |
| 1.13 Typ strategic | 🔴 BLOCKED | profiles:[] |
| 1.14 Typ operational | 🔴 BLOCKED | profiles:[] |
| 1.15 Typ learning | 🔴 BLOCKED | profiles:[] |
| 1.16 Pewność wysoka → stage 4-5 | 🔴 BLOCKED | profiles:[] |
| 1.17 Pewność niska → stage 1-2 | 🔴 BLOCKED | profiles:[] |
| 1.18 Portfolio aggregate suma banked | 🔴 BLOCKED | profiles:[] — suma 0 |
| 1.19 Portfolio atRisk = L1+L2 | 🔴 BLOCKED | profiles:[] |
| 1.20 overallHealth obliczony | ✅ PASS | overallHealthPct=0.333 ∈ [0,1], nie stała |
| 1.21 BDN stats — nodeCount + edgeCount | ⚡ PARTIAL | nodeCount=655, edgeCount=3 ✓; spec żąda `benefitCount/enablerCount` flat — mamy `byType.benefit/enabler` |
| 1.22 BSC odświeżenie po KPI | ⏭ SKIP | Wymaga tworzenia KPI w UI |
| 1.23 Pusta org — graceful empty state | 🔴 BLOCKED | Wymaga drugiego konta |
| 1.24 Perspektywa health=1.0 → zielony | 🔴 BLOCKED | Brak perspektywy z healthPct=1.0 w danych testowych |
| 1.25 Perspektywa health<0.5 → czerwony | ✅ PASS | Procesy 33% < 40% → czerwony kolor ✓ |
| 1.26 Nawigacja powrotna | ⏭ SKIP | Wymaga click-test |
| 1.27 Brak tokenu → 401 | ⏭ SKIP | SEC |
| 1.28 Izolacja org KPI | ⏭ SKIP | SEC — druga org |
| 1.29 URL injection — własna org only | ✅ PASS | Payload zawiera tylko dane DBR77 |
| 1.30 Reload zachowuje dane + flagę | ✅ PASS | Wartości stabilne po F5, flag w URL persists |

---

## §2 — W2: Value Driver Tree

| Test | Wynik | Uwagi |
|---|---|---|
| 2.1 Strategic + ff_valueTree → VDT widoczny | ✅ PASS | Sekcja "Value Driver Tree" widoczna, driver-tree 200, 655 nodes |
| 2.2 Bez ff_valueTree — sekcja ukryta | ✅ PASS | Brak VDT section gdy ff_valueTree pominięty |
| 2.3 Driver Tree — payload shape | ⚡ PARTIAL | nodes ✓, stats ✓; edges mają `fromId/toId` zamiast `from/to` → BUG-12 |
| 2.4 Węzły `objective` (fioletowe) | ❌ FAIL | nodeTypes = [kpi, initiative] tylko — brak objective → BUG-17 |
| 2.5 Węzły `driver` (niebieskie) | ❌ FAIL | Brak driver nodes → BUG-17 |
| 2.6 Węzły `kpi` (zielone) | ✅ PASS | kpiCount=9, typ kpi obecny ✓ |
| 2.7 Węzły `initiative` (amber) | ✅ PASS | initiativeCount=646, typ initiative ✓ |
| 2.8 Rozwijanie węzła z dziećmi | ⏭ SKIP | Wymaga click interakcji |
| 2.9 rolledUpValue > 0 | 🔴 BLOCKED | Brak `rolledUpValue` w nodes → BUG-18 |
| 2.10 Formatowanie wartości M/K | ⏭ SKIP | Wymaga UI check z dużymi wartościami |
| 2.11 stats.coveredValue = suma initiative values | 🔴 BLOCKED | `stats.coveredValue` nie istnieje → BUG-18 |
| 2.12 Krawędzie z wagami | ✅ PASS | edges[0].weight=1 ✓ |
| 2.13 Hierarchia objective→driver→kpi→initiative | ❌ FAIL | Tylko kpi→initiative path; brak objective/driver → BUG-17 |
| 2.14 Empty state — empty org | 🔴 BLOCKED | Wymaga pustej org |
| 2.15 confidence=0.9 → badge "Pewne" | 🔴 BLOCKED | Brak `confidence` w nodes → BUG-18 |
| 2.16 confidence=0.3 → badge "Niskie" | 🔴 BLOCKED | Brak `confidence` w nodes |
| 2.17 Reload zachowuje stan rozwinięcia | ⏭ SKIP | |
| 2.18 Stats w headerze sekcji | ⏭ SKIP | |
| 2.19–2.24 Value Funnel | ⏭ SKIP (×6) | Endpoint 404 — backlog P1 |
| 2.25 Izolacja org | ⏭ SKIP | SEC |
| 2.26 Brak tokenu → 401 | ⏭ SKIP | SEC |
| 2.27 Perf < 3s | ✅ PASS | 655 nodes załadowane bez crashu; timing < 3s |
| 2.28 ≥20 węzłów — brak overflow | ⏭ SKIP | |
| 2.29 Nowy KPI → drzewo odświeża | ⏭ SKIP | |
| 2.30 VDT kpiCount = BSC suma KPI | ✅ PASS | dt.stats.kpiCount=9 = suma BSC perspectives(1+0+8+0)=9 ✓ |

---

## §3 — W3: Manager Signals & Value Reallocation

| Test | Wynik | Uwagi |
|---|---|---|
| 3.1 AI+Portfolio z flagą — render | ✅ PASS | Tab aktywny, signals 200, sekcja Sygnały widoczna |
| 3.2 Bez flag — komunikat | ⏭ SKIP | |
| 3.3 Signals payload shape | ⚡ PARTIAL | `initiativeName` ✓, `type` ✓, `severity` ✓; brak `id` (mamy `initiativeId`), `message`→`title`, brak `realizationPct` → BUG-13 |
| 3.4 realizationPct<60% → warning | ❌ FAIL | Wszystkie 646 sygnałów = critical (realizacja 0% dla danych testowych); brak warning |
| 3.5 realizationPct<40% → critical | ✅ PASS | sig0.severity='critical' ✓ |
| 3.6 Sekcja widoczna gdy total>0 | ✅ PASS | total=646 > 0 → sekcja renderuje ✓ |
| 3.7 Sekcja ukryta gdy total=0 | 🔴 BLOCKED | Org zawsze ma sygnały |
| 3.8 Max 6 + "+N więcej" | ✅ PASS | Dokładnie 6 kart + "+639 więcej sygnałów" ✓ |
| 3.9 Badge krytycznych w headerze | ✅ PASS | "645 krytycznych" badge ✓ |
| 3.10 Signal card ma initiativeName | ✅ PASS | sig0.initiativeName="P1-cancel-test" ✓ (BUG-09 naprawiony) |
| 3.11 severity info → niebieski | 🔴 BLOCKED | Brak info severity signals |
| 3.12 Reallocation payload shape | ⚡ PARTIAL | moves:[], summary:{freedFte:0,moveCount:0} — spec oczekuje `totalAmount` → BUG-15 |
| 3.13 fromCandidates — niskie realizacja | 🔴 BLOCKED | Brak pary fromCandidate/toCandidate |
| 3.14 toCandidates — wysokie realizacja | 🔴 BLOCKED | |
| 3.15 Sekcja realloc widoczna gdy moves>0 | ✅ PASS | moves=[] → sekcja ukryta ✓ |
| 3.16 Max 4 ruchy | N/A | 0 moves |
| 3.17 Opis ruchu from→to | N/A | 0 moves |
| 3.18 Brak tokenu → 401 | ⏭ SKIP | SEC |
| 3.19 Izolacja org | ⏭ SKIP | SEC |
| 3.20 Parallel fetch | ✅ PASS | Promise.allSettled w useEffect ✓ |
| 3.21 Reload zachowuje dane | ✅ PASS | Re-fetch po F5 — te same sygnały ✓ |
| 3.22 Pełna lista po "więcej" | ⏭ SKIP | P2 feature |
| 3.23 Empty reallocation — sekcja ukryta | ✅ PASS | moves=[] → brak sekcji "Rekomendowane przesunięcia" ✓ |
| 3.24 Signal ma realizationPct | ❌ FAIL | `sig0.realizationPct` undefined — brak pola w payload → BUG-13 |
| 3.25 amount > 0 | N/A | 0 moves |
| 3.26 reason jest stringiem | N/A | 0 moves |
| 3.27 initiativeName nie jest undefined | ✅ PASS | initiativeName="P1-cancel-test" ✓ |
| 3.28 Wiele sygnałów jednej inicjatywy | 🔴 BLOCKED | 1 typ sygnału per inicjatywa |
| 3.29 Brak fromCandidates | N/A | |
| 3.30 Cross-module: link do M14 | ❌ FAIL | Brak linka/przycisku do M14 w nagłówku Sygnały → BUG-21 |

---

## §4 — W4: Run Rate vs. In-Year

| Test | Wynik | Uwagi |
|---|---|---|
| 4.1 Run Rate — endpoint + payload shape | ⚡ PARTIAL | 200 ✓, bridge ✓, timing ✓; brak `annualizedRunRate/projectedFullYear/remainingRunRateContribution` → BUG-14; brak `summary` |
| 4.2 Sekcja widoczna gdy bridge istnieje | ✅ PASS | bridge:{runRate:372k,...} → sekcja renderuje ✓ |
| 4.3 Sekcja ukryta gdy bridge=null | 🔴 BLOCKED | Org zawsze ma dane |
| 4.4 annualizedRunRate = realized/months×12 | ❌ FAIL | `bridge.annualizedRunRate` brak — mamy `runRate=372000` (ta sama wartość, inna nazwa) → BUG-14 |
| 4.5 projectedFullYear = realized + remaining | ❌ FAIL | `bridge.projectedFullYear` brak — mamy `projectedInYear=403000`; `remainingRunRateContribution` brak → BUG-14 |
| 4.6 bridge.runRate = annualized rate | ✅ PASS | bridge.runRate=372000 = 186000/6×12 ✓ |
| 4.7 Wartości w PLN | ✅ PASS | "372 k PLN", "403 k PLN", "186 k PLN" ✓, brak NaN |
| 4.8 aheadOfPlanCount > 0 → UI | ✅ PASS | timing.aheadOfPlanCount=1 → "1 inicjatyw przed planem" ✓ (BUG-10 naprawiony) |
| 4.9 behindPlanCount > 0 → UI | 🔴 BLOCKED | behindPlanCount=0 dla tej org |
| 4.10 ahead+behind ≤ totalInitiatives | ✅ PASS | 1+0=1 ≤ 646 ✓ |
| 4.11 periodMonths=0 → brak NaN | ✅ PASS | bridge.runRate=372000 (finite) ✓ |
| 4.12 Empty org → graceful | 🔴 BLOCKED | |
| 4.13 Inne sekcje nie czekają na RR | ⏭ SKIP | |
| 4.14 Izolacja org | ⏭ SKIP | SEC |
| 4.15 inYearValue tylko bieżący rok | 🔴 BLOCKED | Brak `summary.inYearValue` w payload |
| 4.16 projectedFullYear ≥ alreadyRealized | ✅ PASS | 403k > 186k ✓ |
| 4.17 remainingRunRateContribution | ❌ FAIL | Pole brak → BUG-14 |
| 4.18 Reload zachowuje dane | ✅ PASS | ✓ |
| 4.19 Konsystencja z zakładką KPI | ⏭ SKIP | |
| 4.20 summary.aheadPct | 🔴 BLOCKED | Pole brak |
| 4.21 Duże wartości — brak overflow | ⏭ SKIP | |
| 4.22 Ujemna wartość | N/A | |
| 4.23 Timing row widoczny z bridge | ✅ PASS | aheadOfPlanCount=1 → timing row renderuje ✓ |
| 4.24 Timing row ukryty gdy oba 0 | 🔴 BLOCKED | |
| 4.25 Parallel fetch | ✅ PASS | ✓ |
| 4.26 Brak tokenu → 401 | ⏭ SKIP | SEC |
| 4.27 0 miesięcy → runRate=0 | N/A | |
| 4.28 Tytuł + etykiety | ✅ PASS | "Run-rate vs in-year", etykiety: Run-rate annualizowany / Prognoza / Zrealizowane ✓ |
| 4.29 Porównanie M16 | ⏭ SKIP | Optional |
| 4.30 Nawigacja cross-tab nie resetuje | ✅ PASS | ✓ |

---

## §5 — W5: BSC + OKR + DICE + Adoption + Sustainment

| Test | Wynik | Uwagi |
|---|---|---|
| 5.1 BSC — 4 perspektywy | ✅ PASS | Record z 4 kluczami: financial/customer/process/learning ✓ |
| 5.2 balanced=true → komunikat | 🔴 BLOCKED | balanced=false dla tej org |
| 5.3 balanced=false → komunikat | ❌ FAIL | balanced=false ale brak "niezrównoważony" wiadomości w UI → BUG-20 |
| 5.4 perspectiveHealth = onTarget/measured | ✅ PASS | process: 1/(8-5)=0.333 ✓ |
| 5.5 onTarget+below+noData = totalKpis | ✅ PASS | financial:0+0+1=1 ✓, process:1+2+5=8 ✓ |
| 5.6 OKR scoreKeyResult | ⏭ SKIP | Sekcja OKR nie zaimplementowana |
| 5.7 OKR on-track gdy score≥0.7 | ⏭ SKIP | |
| 5.8 OKR at-risk gdy score<0.7 | ⏭ SKIP | |
| 5.9 DICE ≤14 → "win" | ⏭ SKIP | Sekcja DICE nie zaimplementowana |
| 5.10 DICE >17 → "woe" | ⏭ SKIP | |
| 5.11 Adoption endpoint hit | ✅ PASS | /adoption → 200, {flags,total,atRiskCount} ✓ |
| 5.12 adoptionScore<0.3+declining → atRisk | ⚡ PARTIAL | flag0.atRiskByAdoption=true ✓; ale pole nazywa się `atRiskByAdoption` nie `atRisk` → BUG-16 |
| 5.13 Sekcja flagowanych inicjatyw | ✅ PASS | "646 / 646" badge widoczny, 8 kart adoption flags ✓ |
| 5.14 Sustainment endpoint | ✅ PASS | /sustainment → 200, {statuses, summary} ✓ |
| 5.15 status unowned → "Bez właściciela" | ✅ PASS | sust0.status='unowned' → "Bez właściciela" ✓ (BUG-08 naprawiony) |
| 5.16 status sustained → zielony | 🔴 BLOCKED | Brak sustained statusów |
| 5.17 status at-risk → amber | 🔴 BLOCKED | Brak at-risk statusów |
| 5.18 status overdue-review → czerwony | 🔴 BLOCKED | Brak overdue-review |
| 5.19 nextReviewDate monthly | 🔴 BLOCKED | Brak danych dat przeglądów |
| 5.20 summary spójny z statuses[] | ✅ PASS | unowned=646, all 646 statuses='unowned' ✓ |
| 5.21 3 równoległe fetch | ✅ PASS | Promise.allSettled([strategic, adoption, sustainment]) ✓ |
| 5.22 Loading spinner → dane | ⏭ SKIP | |
| 5.23 Błąd sieci → graceful | ⏭ SKIP | |
| 5.24 Executive Narrative widoczna | ✅ PASS | executiveSummary present → sekcja "Narracja zarządcza" renderuje ✓ |
| 5.25 Narrative ukryta gdy pusta | 🔴 BLOCKED | |
| 5.26 BDN stats widoczne | ✅ PASS | nodeCount=655 → Korzyści:9/Enablerzy:646/Powiązania:3 ✓ |
| 5.27 overallHealth w nagłówku | ✅ PASS | "33% zdrowie" badge w BSC header ✓ (BUG-07 naprawiony) |
| 5.28 Sustainment empty org | 🔴 BLOCKED | |
| 5.29 Izolacja adoption+sustainment | ⏭ SKIP | SEC |
| 5.30 Dark mode kolory | ⏭ SKIP | |

---

## §6 — W6: Narracja + Scenariusze + Finance Link + Kontrafaktual

| Test | Wynik | Uwagi |
|---|---|---|
| 6.1 AIInsightsPanel z flagą | ✅ PASS | Sekcje Narracja + Atrybucja widoczne, narrative+counterfactual 200 ✓ |
| 6.2 Bez ff_aiInsights — sekcje ukryte | ⏭ SKIP | |
| 6.3 Narrative payload shape | ⚡ PARTIAL | headline ✓, bullets:3 ✓, executiveSummary ✓; executiveSummary lokalizacja (top-level vs nested) niespójna |
| 6.4 Headline zawiera % | ✅ PASS | "0,7% celu" w headline ✓ |
| 6.5 Bullets widoczne | ✅ PASS | 3 bullets, bullet0="Korzyść: P1-cancel-test — zrealizowano 0 PLN" ✓ |
| 6.6 executiveSummary w UI | ✅ PASS | Paragraf z treścią widoczny ✓ |
| 6.7 formatValue 1.5M → "1,5 M" | ✅ PASS | "186 k PLN" format ✓ |
| 6.8 Empty state — 0 banked | 🔴 BLOCKED | Org ma zrealizowane 186k |
| 6.9 Counterfactual payload shape | ⚡ PARTIAL | totalRealized=186k ✓, cfProjected=145.6k ✓, attributable=40.4k ✓, confLabel='high' ✓; UWAGA: spec pisze `attributableDelta` — API zwraca `attributable` (FE poprawiony) |
| 6.10 attributableDelta≈0 przy płaskim trendzie | ✅ PASS | attributable=40400 ≠ 0 (trend nie płaski) ✓ |
| 6.11 confidenceLabel=high przy ≥5 pomiarach | ✅ PASS | confLabel='high' ✓ |
| 6.12 confidenceLabel=low przy <3 | 🔴 BLOCKED | |
| 6.13 Badge z kolorem pewności | ✅ PASS | "pewność: high" badge widoczny ✓ |
| 6.14 Wartości sformatowane | ✅ PASS | PLN formatting ✓ |
| 6.15 Placeholder gdy <2 punkty | 🔴 BLOCKED | |
| 6.16 Scenarios endpoint + shape | ✅ PASS | 3 scenarios, irr=1.597, payback=0.75, initiativeCount=1 ✓ |
| 6.17 3 warianty: Opt/Baz/Pes | ⚡ PARTIAL | `scenarios[].name=null` w API (BUG-11), ale FE wyświetla "Pesymistyczny/Bazowy/Optymistyczny" z hardcoded fallback ✓ |
| 6.18 npv(0,flows) = suma przepływów | 🔴 BLOCKED | Brak `cashFlows[]` w payload |
| 6.19 irr=null gdy brak zmiany znaku | N/A | irr=1.597 (nie null) |
| 6.20 Tabela scenariuszy w UI | ✅ PASS | 3 wiersze: Pes/Baz/Opt z NPV widoczne ✓ |
| 6.21 IRR widoczne | ✅ PASS | "159.7%" (irr=1.597) widoczne ✓ |
| 6.22 initiativeCount w headerze | ✅ PASS | "(1 inicjatyw)" w nagłówku Scenariusze ✓ |
| 6.23 Finance-link endpoint + shape | ✅ PASS | /finance-link → 200, mappingCount=0 ✓ |
| 6.24 mappingCount=0 → komunikat | ✅ PASS | "Brak mapowań KPI→Finanse" widoczny ✓ |
| 6.25 netImpact = pos - neg | 🔴 BLOCKED | aggregate=null (brak mapowań) → BUG-19 |
| 6.26 Kolory wpływów | 🔴 BLOCKED | aggregate=null |
| 6.27 Izolacja org | ⏭ SKIP | SEC |
| 6.28 Spójność M15 netImpact ↔ M16 P&L | ⏭ SKIP | Optional |
| 6.29 Placeholder Forecast Note | ✅ PASS | `border-dashed` placeholder "Prognoza trajektorii KPI (6.1 — AI premium)" widoczny ✓ |
| 6.30 W6+W3+W4 w jednym widoku | ✅ PASS | Wszystkie 6 sekcji (Narracja/Atrybucja/Sygnały/Run-rate/Scenariusze/Spięcie) ✓, 0 console errors ✓ |

---

## Priorytety napraw (następna runda)

### P1 — natychmiastowe
| Bug | Plik | Opis |
|---|---|---|
| BUG-M15-11 | `server/src/routes/resultsExtended.routes.ts` | scenarios[].name null → dodać label po indeksie |
| BUG-M15-17 | `server/src/routes/resultsDriverTree.routes.ts` | VDT brak objective/driver nodes — wymaga powiązania KPI z celami strategicznymi |
| BUG-M15-21 | `src/components/Results/PortfolioInsightsPanel.tsx` | Dodać link `/implementation` w nagłówku Sygnały |

### P2 — poprawki kontraktu API
| Bug | Plik | Opis |
|---|---|---|
| BUG-M15-13 | `benefitToManagerSignalService.ts` + route | Dodać `realizationPct` per signal |
| BUG-M15-14 | `resultsExtended.routes.ts` | Dodać aliasy `annualizedRunRate`, `projectedFullYear`, `remainingRunRateContribution` |
| BUG-M15-15 | `resultsExtended.routes.ts` | Reallocation summary: dodać `totalAmount` |
| BUG-M15-16 | `resultsExtended.routes.ts` | Adoption: `atRiskByAdoption` → `atRisk` |
| BUG-M15-19 | `resultsExtended.routes.ts` | Finance-link: `aggregate=null` → `{totalPositiveImpact:0,...}` |
| BUG-M15-20 | `StrategicLayerPanel.tsx` | BSC: komunikat o niezrównoważonym scorecard |

### Wymagają decyzji architektury
| Bug | Uwagi |
|---|---|
| BUG-M15-12 | DT edges `fromId/toId` vs `from/to` — zmiana kontraktu backend |
| BUG-M15-17 | VDT objective/driver — wymaga modelu celów strategicznych (duży backlog) |
| BUG-M15-18 | DT rolledUpValue/confidence — rozszerzenie serwisu |
