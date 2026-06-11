# M15 — Rezultaty — FAZA 2 (TESTY) — Raport

**Data:** 2026-06-11 · **Branch:** `feat/deliverables-light` · **Commit:** `6b12f5c38c` · **Agent:** TESTY
**Log:** `evidence/f2_tests.log`

## Werdykt jednym akapitem
Moduł ma **gęste pokrycie BE** (resultsROIService + resultsRuntime + v8 routes + kpiWorkflow canon + finalization guard = 231 testów) i **lekkie smoki FE** (13 testów). Wszystkie FE PASS. Po stronie BE **5 FAILów to czysty test-drift** (stary mock + stara asercja kontra ewoluujący serwis), **nie błędy produktu**. Krytyczne luki jakościowe: (1) **izolacja showcase-data jest testowana tylko częściowo** — gate `shouldUseResultsShowcaseData()` ma ścieżkę `MODE==='test' → false`, ale **żaden test nie weryfikuje, że przy włączonym demo dane showcase NIE przeciekają do realnych endpointów** (poz. 6); (2) **brak jakiegokolwiek PR-gated E2E** dla żywej powierzchni v8 Results — jedyny spec dotykający benefitów (`deploy-gate-...benefits-finance.spec.ts`) testuje wyłącznie *legacy* `/api/benefits/*` i nie jest wpięty w żaden tier CI; (3) **cały moduł jest za flagą** (beta + v8), a testy uruchamiają router z `v8_enabled:true` na sztywno — ścieżka V8-OFF→legacy fallback (poz. 7) **nie jest testowana**.

---

## 1. INWENTARZ testów

### FE (vitest, jsdom)
| Plik | Czego dotyczy | Liczba | Wynik |
|---|---|---|---|
| `src/components/Results/__tests__/ResultsHub.smoke.test.tsx` | Hub montuje shell ModuleHub z niepustą konfiguracją tabów (KPI runtime + store zamockowane) | 1 | PASS |
| `src/components/Results/__tests__/ResultsKpiReportsView.smoke.test.tsx` | Tryb Reports — pusty stan + render 1 wiersza raportu z API; jawnie mockuje `resultsShowcaseData` (showcase OFF) | 2 | PASS |
| `src/components/Results/__tests__/ROIAnalysisView.smoke.test.tsx` | ROI Analysis — empty/populated/locked badge + governance banner + error; `deriveROILockState` (terminal→locked, approved/tracking→approved, active→open) | 7 | PASS |
| `src/views/__tests__/FullROIView.smoke.test.tsx` | FullROIView (M05/portfolio ROI) — usunięty stub „Under Construction", empty CTA, render ROI%/NPV/payback, error+retry; `shouldAllowDemoData()→false` zamockowane | 3 | PASS |

### BE (vitest, repo-root)
| Plik | Czego dotyczy | Liczba | Wynik |
|---|---|---|---|
| `server/src/services/v8/__tests__/resultsROIService.test.ts` | Rdzeń: createKPI (dual-mode), lifecycle KPI (transitions + terminal), deviation governance, ROI realization, executive review pack, KPI↔Finance reconciliation, izolacja org, schematy Zod | 93 | **4 FAIL** / 89 PASS |
| `server/src/services/v8/__tests__/resultsRuntime.test.ts` | Read-side runtime: scorecard, trend, active deviations, ROI dashboard, **portfolio summary**, initiative detail, **KPI catalog**, drawer detail, reconciliation health, results dashboard composite | 21 | **1 FAIL** / 20 PASS |
| `server/src/routes/v8/__tests__/results.routes.test.ts` | HTTP round-trip `/api/v8/results/*`: dashboard, roi/portfolio-summary, kpis/catalog, drawer-detail, CRUD KPI/mappings, deviation cases (ack/rca/actions/resolve/close), kpi-reports, time-series, ROI assumptions/realized, reconciliations, signals, next-actions, workflow-status; org-scope 404, envelope contract, 500-kody | 55 | PASS |
| `server/src/routes/v8/__tests__/p04-kpi-workflow.test.ts` | P04 KPI Workflow Canon: closed-loop, degraded posture, linkage, permissions, anti-duplicate, acceptance checklist (21 poz.) | 56 | PASS |
| `server/src/routes/v8/__tests__/results-finalization-guard.test.ts` | **Approval/finalization gating** — `findKpiReportFinalizationViolation`: blokada raportu na zablokowanym KPI-set (`benefits_realization`) i przy istniejącym finalized/approved snapshot (regresja ukrytej finalizacji); degradacja na schema-error | 6 | PASS |

**Pominięte z zakresu (powiązane, ale nie M15-core):** `finance.routes.test.ts`, `p05-finance-lane.test.ts`, `reportsOutputRuntime.test.ts`, `reportsPresModelService.test.ts` (M16/M17/M19 — most do finansów/outputów, nie audytowane tu).

## 2. URUCHOMIENIE

**FE:** `npx vitest run <4 pliki>` → **PASS 13 / FAIL 0 / SKIP 0** · 3.23 s
**BE:** `npx vitest run <5 plików>` (cwd=repo-root, aliasy z `vitest.config.ts`) → **PASS 226 / FAIL 5 / SKIP 0** · 2.77 s
**RAZEM: PASS 239 / FAIL 5 / SKIP 0** (244 testów)

### Root-cause 5 FAILów (oba = test-drift, NIE bug produktu)

**A. `resultsROIService.test.ts` — 4 FAIL (`resolveReconciliation` ×3 + `org isolation/resolveReconciliation` ×1)**
Błąd: `No "send" export is defined on the "../server/services/notificationService.js" mock`.
Przyczyna: serwis dodał `import { send as sendNotification } from '../notificationService.js'` (`resultsROIService.ts:56`) i wywołuje go w `resolveReconciliation` (`:678`). Test **nie mockuje** `notificationService` → vitest rzuca przy próbie odpalenia powiadomienia. To **stale-mock drift**: notyfikacja dodana po napisaniu testu. Fix: dodać `vi.mock('../../notificationService.js', () => ({ send: vi.fn() }))`.

**B. `resultsRuntime.test.ts` — 1 FAIL (`getResultsKpiCatalog > bridges KPI rows and mappings`)**
Błąd: `expected [...11 pól] to deeply equal [...5 pól]`. Mapping w runtime urósł o pola obserwacji/realizacji: `definitionSource`, `initiativeStatus`, `observationPhase`, `observationStatus`, `trackedInRealization`, `trackedPostImplementation` (`resultsROIService.ts:1657-1728`). Test używa `toEqual` (exact match) na starym kształcie 5-polowym. To **stale-assertion drift**: kolumny S1 (tracked post-implementation) dodane po napisaniu asercji. Fix: `toMatchObject` zamiast `toEqual`, lub uzupełnić oczekiwany kształt.

Pozostałe pułapki z briefu odrzucone jako przyczyny: i18next mock OK (FE zielone), brak Routera — nie (MemoryRouter obecny), rola iris/PG schema-drift — nie (mock-DB), fałszywa zieleń fetch — nie (serwisy mockowane deterministycznie).

## 3. MAPA POKRYCIA S1–S7

| Scenariusz | FE | BE | E2E | PR-gate¹ | Luka |
|---|---|---|---|---|---|
| **S1** Initiatives tracked + filtry | ⚠️ pośrednio (ResultsHub mount) | ✅ `getResultsKpiCatalog` + tracked* pola (ale asercja FAIL) | ❌ | ❌ | brak FE testu filtrów; asercja S1 zdryfowała (FAIL B) |
| **S2** KPI 4 tryby (overview/queue/catalog/scorecards) | ⚠️ tylko Reports-tryb + ROI; brak scorecards/queue/catalog UI | ✅ catalog/scorecard/drawer/workflow-status | ❌ | ❌ | 2 z 4 trybów KPI bez testu FE |
| **S3** Reports 5 trybów + cron + approval gating | ⚠️ Reports empty/1-wiersz | ✅ kpi-reports create + **finalization guard** (approval gating ✅) | ❌ | ❌ | **cron schedules BEZ testu** (FE i BE); 5 trybów reports nie rozróżnione |
| **S4** ROI portfolio summary | ✅ ROIAnalysisView (empty/populated/locked/error) | ✅ `getROIPortfolioSummary` + route + 404-scope | ❌ | ❌ | brak E2E |
| **S5** ROI Analysis | ✅ ROIAnalysisView + FullROIView + `deriveROILockState` | ✅ `getROIInitiativeDetail` + assumptions/realized routes | ❌ | ❌ | brak E2E |
| **S6** showcase/demo-data fallback | ⚠️ mockowany jako OFF (`shouldUseResultsShowcaseData→false`) | n/d (FE-only gate) | ❌ | ❌ | **izolacja przecieku NIE testowana** (patrz §4) |
| **S7** dual-runtime V8→legacy | ❌ | ⚠️ routy testowane tylko z `v8_enabled:true` (hardcoded mock) | ⚠️ legacy `/api/benefits/*` w deploy-gate spec (niewpięty) | ❌ | **fallback V8-OFF nie testowany**; `shouldFallbackToLegacyResults` mockowany na `false` |

¹ **PR-gate** = `test-suite.yml` (trigger tylko `main`/`develop`; domyślny branch repo = `Londyn`). CI shardy: `tests/unit`, `tests/integration`, `test:component`=`tests/components`. **Testy M15 NIE leżą w tych ścieżkach** (`src/components/Results/__tests__/`, `server/src/**/__tests__/`) → **żaden test M15 nie jest PR-gated w test-suite.yml** dopóki ktoś ich ręcznie nie odpali. (Serwerowe `__tests__` mogą łapać się pod `server` `npm test`=`vitest run`, ale to nie jest w gałęzi PR-gate workflow dla M15-ścieżek.)

## 4. PUŁAPKI

1. **Izolacja showcase-data (poz. 6) — NIE w pełni testowana.** Gate `shouldUseResultsShowcaseData()` (`resultsShowcaseData.ts:85`) ma twardą ścieżkę `MODE==='test' → false` oraz `shouldAllowDemoData()` (demo wymaga jawnego włączenia sesji, brak auto-triggera na localhost/DEV — `api.ts:623`). **Ale:** żaden test nie udowadnia, że **przy demo=ON** dane showcase trafiają TYLKO do widoku i NIE są zapisywane przez realne `POST /api/v8/results/*`. FE smoki mockują gate na `false`, więc testują wyłącznie ścieżkę „demo wyłączone". Brak testu pozytywnego (demo=ON → showcase widoczne) i brak testu szczelności (showcase ≠ realny zapis). **To dokładnie luka z briefu.**
2. **Approval gating serwerowy (poz. 3) — TESTOWANY** ✅. `results-finalization-guard.test.ts` (6 testów) pokrywa blokadę raportu na locked KPI-set i na istniejącym finalized/approved snapshot — to najmocniejszy punkt modułu.
3. **Fałszywa zieleń** — niska. FE i BE deterministycznie mockują serwisy/DB; brak fetchy bez serwera. Ryzyko odwrotne: **5 FAILów to prawdziwa erozja green-bara** (mock/asercja nie nadążyły za kodem) — nie maskowane, jawne.
4. **Testy za flagą OFF** — **cały moduł za beta+v8**, a testy montują router z `v8_enabled:true` na sztywno i `shouldFallbackToLegacyResults()→false`. Ścieżka **degradacji do legacy** (poz. 7) jest niewykonalna w obecnych testach → realny ruch przy v8-OFF jest nieobserwowany przez testy.
5. **Mockowanie serwisu w routach** — `results.routes.test.ts` mockuje cały `resultsROIService` → testuje kontrakt HTTP/envelope/scope, **nie integrację z realnym SQL**. To celowe (round-trip), ale oznacza, że schema-drift PG (np. brak kolumny `observation_phase` na prod) **nie zostałby złapany** przez te testy — tylko przez `resultsRuntime.test.ts`, który też używa mock-DB.

## 5. BACKLOG TESTOWY

| # | Typ | Plik (do utworzenia/edycji) | Scenariusz | Priorytet |
|---|---|---|---|---|
| B1 | fix-mock | `server/src/services/v8/__tests__/resultsROIService.test.ts` | Dodać `vi.mock('../../notificationService.js', () => ({ send: vi.fn() }))` → odblokować 4 FAILe `resolveReconciliation` | **P0** (czerwony build) |
| B2 | fix-assertion | `server/src/services/v8/__tests__/resultsRuntime.test.ts:429` | `toEqual`→`toMatchObject` lub uzupełnić 6 nowych pól mapping (definitionSource/observation*/tracked*) → odblokować FAIL B | **P0** |
| B3 | nowy (izolacja) | `src/components/Results/__tests__/resultsShowcaseIsolation.test.ts` | demo=ON → showcase renderuje się; **showcase NIE wywołuje** `Api.post`/`V8ResultsApi.*write*` (spy = 0 wywołań) → dowód braku przecieku (poz. 6) | **P0** |
| B4 | nowy (fallback) | `server/src/routes/v8/__tests__/results.routes.legacy-fallback.test.ts` | `v8_enabled:false` → route 404/passthrough; FE `shouldFallbackToLegacyResults()→true` → uderza legacy `/api/benefits/*` (poz. 7, S7) | **P1** |
| B5 | nowy (cron) | `server/.../__tests__/resultsReportSchedule.test.ts` + FE | Reports cron schedules: utworzenie/edycja/`nextRunAt`, approval-gated wysyłka (poz. 3 rozszerzony o harmonogram, obecnie 0 pokrycia) | **P1** |
| B6 | nowy (FE tryby KPI) | `src/components/Results/__tests__/ResultsKpiView.modes.test.tsx` | 4 tryby KPI (overview/queue/catalog/scorecards) — render + przełączanie (S2, dziś tylko Reports+ROI) | **P2** |
| B7 | E2E | `tests/e2e/smoke/results-v8-hub.spec.ts` + wpięcie w tier CI | Happy-path Results na **v8** (dashboard→KPI→ROI→report), no-5xx; dziś jedyny benefits-spec dotyczy legacy i jest niewpięty | **P2** |
| B8 | CI-wiring | `.github/workflows/test-suite.yml` lub glob component | Dopiąć `src/components/Results/__tests__/**` i serwerowe `__tests__` do PR-gate (dziś poza shardami `tests/unit|integration|components`) | **P2** |
