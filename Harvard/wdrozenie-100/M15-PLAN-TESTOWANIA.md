# M15 Rezultaty — Plan Testowania

> **Wersja:** 1.0 · **Data:** 2026-06-24  
> **Moduł:** M15 Rezultaty (`ResultsHub`, trasa `/benefits`, BetaGate `MODULE_BENEFITS`)  
> **Zasada:** każda fala W1–W6 = własna sekcja z zakresem, metodą i kryteriami odbioru

---

## 1. Filozofia testowania M15

| Warstwa | Metodologia | Cel |
|---------|-------------|-----|
| **Serwisy** (pure functions) | Unit — izolowane, deterministyczne | kontrakt matematyczny (liczby, progi, heurystyki) |
| **Routery** (GET /api/results-*) | Integracja (Supertest + in-memory SQLite) | kształt odpowiedzi, auth, org-isolation |
| **Komponenty FE** | Vitest + React Testing Library | render, stany loading/error, data-testid |
| **E2E** | Playwright lokalny FE → staging-trolley | złota ścieżka: zakładka Initiatives/Strategic/AI+Portfolio widoczna za flagą |
| **Epicki** *(ten plik)* | `m15EpicCoverage.test.ts` (35 testów) | jeden test per epik — meta-check kompletności |

---

## 2. Pokrycie epików (mapa W1–W6)

### EPIC W1 — Benefit Profile & Stage-Gate

| ID testu | Co weryfikuje | Plik |
|----------|---------------|------|
| W1-T01 | Finansowy KPI (revenue) → typ `financial`, kategoria `revenue` | m15EpicCoverage |
| W1-T02 | Nazwa zawierająca "redukcja" → `isDisBenefit = true` | m15EpicCoverage |
| W1-T03 | Inicjatywa `L5_realized` → `banked = value`, `forecast = 0` | m15EpicCoverage |
| W1-T04 | Inicjatywa `L4_inflight` → `forecast = value × 0.85` | m15EpicCoverage |

**Dodatkowe testy w dedicated plikach:**
- `benefitProfileService.test.ts` — 23 testy (typ/kategoria/dis-benefit/owner/realizationPct/summary)
- `valueStageGateService.test.ts` — stage inference, STAGE_DEFAULT_CONFIDENCE, portfolio aggregate

**Progi odbioru:** 100% testów zielone; żaden typ/kategoria nie zwraca `'unknown'` dla standardowych KPI.

---

### EPIC W2 — Value Driver Tree & Value Funnel

| ID testu | Co weryfikuje | Plik |
|----------|---------------|------|
| W2-T05 | `buildTreeFromMappings` tworzy węzły `initiative` + `kpi` | m15EpicCoverage |
| W2-T06 | `rollUpTree` propaguje wartości przez krawędzie z wagami | m15EpicCoverage |
| W2-T07 | `buildFunnel` zwraca 4 etapy nawet przy pustym wejściu | m15EpicCoverage |
| W2-T08 | Leakage = max(0, valueFrom − valueTo) | m15EpicCoverage |

**Dodatkowe testy:**
- `valueDriverTreeService.test.ts` — rollUp multi-level, buildTreeFromMappings, treeStats
- `valueFunnelService.test.ts` — riskAdjustedValue, funnelConversion, valueAtRisk

**Progi odbioru:** drzewo ≥ 1 inicjatywa + ≥ 1 KPI = wynik; funnel 4 etapy zawsze obecne.

---

### EPIC W3 — Manager Signals & Reallocation

| ID testu | Co weryfikuje | Plik |
|----------|---------------|------|
| W3-T09 | `realizationPct < 0.6` → `BENEFIT_AT_RISK warning` | m15EpicCoverage |
| W3-T10 | `realizationPct < 0.4` → severity `critical` | m15EpicCoverage |
| W3-T11 | Niska realizacja (<50%) + niskie confidence (≤0.5) → `fromCandidates` | m15EpicCoverage |
| W3-T12 | Wysoka realizacja (≥70%) + wysokie confidence (≥0.6) → `toCandidates` | m15EpicCoverage |

**Dodatkowe testy:**
- `benefitToManagerSignalService.test.ts` — 14 testów (eskalacja, signalsSummary, high-value threshold)
- `valueReallocationService.test.ts` — 9 testów (moves, reallocationSummary, edge cases)

**Progi odbioru:** signal emitowany gdy realizacja < 0.6; STOP gdy < 0.4; reallocation moves ≥ 1 dla mixed portfolio.

---

### EPIC W4 — Run Rate vs In-Year

| ID testu | Co weryfikuje | Plik |
|----------|---------------|------|
| W4-T13 | `annualizedRunRate = realized / periodMonths × 12` | m15EpicCoverage |
| W4-T14 | `inYearValue` sumuje pomiary tylko z żądanego roku | m15EpicCoverage |
| W4-T15 | `runRateBridge.runRate = realizedToDate / periodMonths × 12` | m15EpicCoverage |

**Dodatkowe testy:**
- `runRateService.test.ts` — 15 testów (edge: 0 miesięcy, NaN, częściowy rok, valueTimingSplit)

**Progi odbioru:** `annualizedRunRate(0, n) = 0`; `inYearValue` nie zalicza lat poza zakresem.

---

### EPIC W5.1–W5.4 — BSC + OKR

| ID testu | Co weryfikuje | Plik |
|----------|---------------|------|
| W5-T16 | `bscOverview` zwraca 4 perspektywy nawet bez KPI | m15EpicCoverage |
| W5-T17 | `perspectiveHealth.healthPct = onTarget / measured` (skala 0..1) | m15EpicCoverage |
| W5-T18 | `scoreKeyResult = (current − baseline) / (target − baseline)` | m15EpicCoverage |
| W5-T19 | Objective `on-track` gdy average score ≥ 0.7 | m15EpicCoverage |

**Dodatkowe testy:**
- `balancedScorecardService.test.ts` — 12 testów (groupByPerspective, inferPerspective, bscOverview.balanced)
- `okrService.test.ts` — 15 testów (scoreKeyResult, scoreObjective, cascadeOkr, okrSummary)
- `benefitsDependencyNetworkService.test.ts` — 9 testów (nodeCount, edgeCount, rootNodes)

**Progi odbioru:** `balanced = true` gdy wszystkie 4 perspektywy mają ≥ 1 KPI; OKR score w [0, 1].

---

### EPIC W5.5–W5.8 — Adoption + DICE + Sustainment + Governance Calendar

| ID testu | Co weryfikuje | Plik |
|----------|---------------|------|
| W5-T20 | DICE "win" zone gdy score ≤ 14 | m15EpicCoverage |
| W5-T21 | `adoptionScore < 0.3 + declining` → risk `high` | m15EpicCoverage |
| W5-T22 | `ownershipTransferred = false` → status `unowned` | m15EpicCoverage |
| W5-T23 | `nextReviewDate` monthly = lastReview + 30 dni | m15EpicCoverage |

**Dodatkowe testy:**
- `adoptionBenefitRiskService.test.ts` — 17 testów (diceScore zones, DICE edge, adoptionRisk levels, flagBenefitAtRiskByAdoption)
- `benefitSustainmentService.test.ts` — 18 testów (sustainmentStatus: sustained/unowned/at-risk/overdue, buildGovernanceCalendar, reviewDue)

**Progi odbioru:** DICE "woe" zone gdy score > 17; `overdue-review` gdy lastReview + cadenceDays < teraz.

---

### EPIC W6.1–W6.2 — KPI Forecast + RCA

| ID testu | Co weryfikuje | Plik |
|----------|---------------|------|
| W6-T24 | `linearTrend` — slope + intercept dla czystej linii | m15EpicCoverage |
| W6-T25 | `projectToTarget.willHitTarget = true` gdy trend wznoszący | m15EpicCoverage |
| W6-T26 | `staleData=true` → hipoteza `data-quality` z confidence 0.8 | m15EpicCoverage |
| W6-T27 | Declining + niska adopcja → ≥2 hipotezy (m.in. `adoption`) | m15EpicCoverage |

**Dodatkowe testy:**
- `kpiForecastService.test.ts` — 15 testów (linearTrend edge, projectToTarget HIGHER/LOWER, leadingAlert)
- `deviationRcaSuggestService.test.ts` — 21 testów (każdy sygnał osobno + kombinacje + rcaActions)

**Progi odbioru:** forecast `willHitTarget` = false gdy flat trend + target > current; RCA ≥ 1 hipoteza zawsze.

---

### EPIC W6.3–W6.8 — Narrative + Scenarios + Finance Link + Counterfactual

| ID testu | Co weryfikuje | Plik |
|----------|---------------|------|
| W6-T28 | `buildNarrative.headline` zawiera procent realizacji | m15EpicCoverage |
| W6-T29 | `formatValue` — 1.5M → "1,5 M", 1k → "1 k", 500 → "500" | m15EpicCoverage |
| W6-T30 | `npv(0, flows) = suma przepływów` (bez dyskontowania) | m15EpicCoverage |
| W6-T31 | `irr` — NPV obliczone przy IRR ≈ 0 (definicja) | m15EpicCoverage |
| W6-T32 | `aggregateKpiFinancialImpact` — dwa KPI do tej samej linii są sumowane | m15EpicCoverage |
| W6-T33 | `financialImpactByStatement` — sumuje per typ (P&L vs CF) | m15EpicCoverage |
| W6-T34 | `attributableDelta ≈ 0` gdy flat trend i obserwacja = projekcja | m15EpicCoverage |
| W6-T35 | `confidenceLabel` — `high` przy ≥5 czystych punktach, `low` przy <3 | m15EpicCoverage |

**Dodatkowe testy:**
- `valueNarrativeService.test.ts` — 14 testów (headline, paragraphs, bullets, topBenefits/topRisks)
- `scenarioSensitivityService.test.ts` — 25 testów (npv/irr/payback/runScenarios/sensitivity)
- `financeLinkService.test.ts` — 12 testów (aggregateKpiFinancialImpact, financialImpactByStatement, bridge)
- `counterfactualBaselineService.test.ts` — 16 testów (projectCounterfactual, attributableDelta, confidenceLabel)

**Progi odbioru:** IRR null gdy brak zmiany znaku przepływów; narrative bullets ≥ 1; counterfactual null przy ≤ 1 punkcie.

---

## 3. Stan testów (2026-06-24)

| Kategoria | Pliki | Testy | Status |
|-----------|-------|-------|--------|
| **Unit serwisów** | 23 pliki | 335 | ✅ 335/335 |
| **Epic Coverage** | 1 plik | 35 | ✅ 35/35 |
| **SUMA** | **24 pliki** | **370** | ✅ **370/370** |
| Integracja (routes) | — | — | ⬜ TODO W2+ |
| Komponenty FE | — | — | ⬜ TODO |
| E2E Playwright | — | — | ⬜ TODO |

---

## 4. Procedura CI

Testy lądują w `tests/unit/results/` (ścieżka w jawnym CI vitest include).  
Nowe pliki: `git add -f tests/unit/results/<plik>.test.ts` (katalog w `.gitignore`).

```bash
# Uruchomienie całego zestawu M15:
npx vitest run tests/unit/results/

# Uruchomienie tylko epickiego pokrycia:
npx vitest run tests/unit/results/m15EpicCoverage.test.ts
```

---

## 5. Priorytety kolejnych fal testów

| Priorytet | Co | Dlaczego |
|-----------|-----|---------|
| P1 | Integracja routerów (`resultsExtended`, `resultsDriverTree`) | endpoint auth + org-isolation, empty-DB graceful |
| P2 | FE komponenty (`ValueDriverTree`, `StrategicLayerPanel`) | loading/error/empty states, data-testid |
| P3 | E2E złota ścieżka (flagi ON → zakładki Strategic + AI+Portfolio) | weryfikacja feature flags end-to-end |
| P4 | Regresja `ResultsHub` (istniejące zakładki nienaruszone) | guard przed regresjami W1–W6 zmian |

---

## 6. Wzorzec dla przyszłych faz (instrukcja)

> "Za każdym razem przy tej fazie — przygotuj 30 testów oraz plan testowania,  
> tak żeby testy odzwierciedlały wszystkie epiki."

**Kroki do powtórzenia:**

1. Zidentyfikuj wszystkie epiki nowej fazy (z STAN-PRACY-ODBIORY)
2. Rozdziel 30 testów proporcjonalnie do liczby epików (4–6 testów per duży epik)
3. Każdy test: jeden asert per kluczowe zachowanie, nie per serwis
4. Uruchom i popraw do 30/30 zielonych przed commitem
5. Dodaj sekcję do tego planu (zaktualizuj tabelę stanu §3)
6. Commit: `git add -f tests/unit/results/<plik>.test.ts && git commit`
