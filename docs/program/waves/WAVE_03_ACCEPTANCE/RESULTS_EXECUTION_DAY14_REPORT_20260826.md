# Results + Execution dzień 14 — raport backendowy 2026-08-26

Baza: `codex/day14-instrukcja-20260825 @ 412715835c`  
Marker: `f0caf6a821` — **POTWIERDZONY także po pracy**  
Gałąź/worktree: `codex/backend-day14-20260826` · `/private/tmp/consultify-backend-day14`  
Port: wyłącznie lokalny PG `127.0.0.1:5442`  
Poziom: **CZĘŚCIOWO / STOP-Y JAWNE**

## Oświadczenia

- Z4/Z5: nie czytano ani nie zmieniano `/Users/piotrwisniewski/Developer/Consultify`; bez cudzych worktree i `codex/preserve-*`.
- Z10: zero `.tsx`, `public/locales`, UI, zrzutów i `dev-render`; końcowy grep pusty.
- DEC-65: zero `fetch/push`, Railway, chmury, deployów i zdalnych baz.
- Flagi, globalne mocki/config Vitest, `atomicWrite.ts`, `visibilityScopedQuery.ts` i `effectiveAccessService.ts` niezmienione.

## Blok 0

| Sprawdzenie                  | Wynik                                          |
| ---------------------------- | ---------------------------------------------- |
| ledger / Results / Execution | 125 / 115 / 308 linii                          |
| DEC-62/63/65/72              | po 1 trafieniu                                 |
| mapa techniczna              | 11774 / 5843 / 460 / 1085 / 311 / 299 — zgodna |
| Day 8 + cont                 | NIE-SCALONE                                    |
| Day 11 + fixes               | ANCESTOR — zamierzone wg nadzorcy              |

Merge dnia 11 `9ac4f407a8` uznano za zamierzony. Namespace
`20260901_day14_*` zatwierdzono. Nie wykonano cherry-picku UI.

### WERYFIKACJA_BRAKÓW

| Zakres                             | Wynik wejściowy                            |
| ---------------------------------- | ------------------------------------------ |
| S search / `q`                     | brak                                       |
| K trend / historia / obligation    | brak endpointów                            |
| O Set attention / check-in summary | brak; tylko org attention i check-in KR    |
| X.1/X.2/X.4                        | brak replay / XLSX / zunifikowanych rodzin |

## Pozycje

| Pozycja | Status              | Commit       | Dowód / granica                                                                                    |
| ------- | ------------------- | ------------ | -------------------------------------------------------------------------------------------------- |
| S.1     | **ZROBIONE_WG_DoD** | `cd83a3e3c0` | `/api/vnext/results/search`; CTE per kind; literalny ILIKE; kursor; 7 testów PASS, RealPG 3 strony |
| S.2     | **CZĘŚCIOWO**       | `d176e7ec4b` | `q` KPI/OKR w SQL przed LIMIT; RealPG KPI; ROI STOP Z17                                            |
| K.1     | **CZĘŚCIOWO**       | `8a5cb824db` | endpoint + 6 geometrii + honest zero, 7/7 PASS; brak kompletnego route/tenant/RealPG packu         |
| K.2/K.3 | NIE ZROBIONO        | —            | zero atrap                                                                                         |
| O.1/O.2 | NIE ZROBIONO        | —            | zero filtrowania klienta i wymyślonej kadencji                                                     |
| X.1/X.2 | NIE ZROBIONO        | —            | zero historycznej atrapy, AI i pozornego XLSX                                                      |
| X.3a    | NIE ZROBIONO        | —            | brak read-modelu sources                                                                           |
| X.3b    | **CZĘŚCIOWO**       | `6a441ca32c` | `sources: []` → `NO_SOURCES`; pełne źródło nadal przechodzi; brak lifecycle/export                 |
| X.4     | NIE ZROBIONO        | —            | zero zaszytych progów/wag/SLA                                                                      |
| R.1     | NIE ZROBIONO        | —            | rejestrów nie podniesiono przy niepełnym zakresie                                                  |

## S.1

| Rodzaj   | Kolumny          | Widoczność                               |
| -------- | ---------------- | ---------------------------------------- |
| KPI      | nazwa, kod, opis | CTE `kpi`                                |
| OKR Set  | tytuł            | CTE `okr_set`                            |
| ROI Case | tytuł            | CTE `roi_case` + istniejące ROI_GOVERNED |

Sort: `updatedAt DESC, id ASC`; kursor base64url pary `updatedAt/id`.
Fraza 1-znakowa daje `200 + []` bez DB. `%`, `_`, `\` są escapowane.

## Testy PRZED/PO

| Katalog                      | PRZED                     | PO                         | Delta                            |
| ---------------------------- | ------------------------- | -------------------------- | -------------------------------- |
| routes Results               | 402 PASS                  | 406 PASS                   | +4 PASS, 0 FAIL                  |
| services Results             | 2 FAIL / 7 PASS / 39 SKIP | 2 FAIL / 16 PASS / 39 SKIP | +9 PASS; te same 2 inventory ROI |
| unit Execution               | 242 PASS / 4 FAIL         | 242 PASS / 4 FAIL          | 0                                |
| unit initiatives-execution   | 166 PASS / 1 FAIL         | 166 PASS / 1 FAIL          | 0                                |
| domain initiatives-execution | brak plików               | 2 PASS                     | +2 PASS                          |

**ZASIĘG CZĘŚCIOWY.** Pięć wymaganych pakietów wykonano PRZED/PO. K.1 nie
ma kompletnego osobnego HTTP/tenant/RealPG packu; pozycje niewykonane nie mają testów.

| Test własny            | Wynik                                     |
| ---------------------- | ----------------------------------------- |
| S.1 HTTP + textMatch   | 6/6 PASS                                  |
| S.1/S.2 RealPG         | 2/2 PASS; utworzono/usunięto 5/5; delta 0 |
| K.1 geometrie + 0≠brak | 7/7 PASS                                  |
| X.3b źródła            | 2/2 PASS                                  |

Negatyw S.1: cofnięte członkostwo → 403, repo niewywołane. Własny test
Results działał z `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`.

## Migracje i KOMPATYBILNOŚĆ_WSTECZ

Nie dodano migracji; `MIGRATION_PREPARED`: **pusto**.

| Obiekt                 | Zamrożone demo                             | Nowy kod bez backfillu                          |
| ---------------------- | ------------------------------------------ | ----------------------------------------------- |
| nowe trasy S.1/K.1     | nie wywołuje                               | istniejące tabele; pustka pozostaje pustką/null |
| opcjonalne `q` KPI/OKR | brak `q` = dotychczasowe filtry/sort/shape | filtr tylko z `q`                               |
| walidacja runu         | bez zmiany schematu                        | pustka jawnie `NO_SOURCES`                      |

Idempotencja: fresh replay `839`, powtórka `0`, dry-run `Pending 0`.
Kanon: `404 / baseline 404`. Po RealPG: 0 wierszy `day14-search-*`.
Kontener `cx-day14-pg` i wolumeny usunięte; końcowe listingi puste.

## STOP-y

### STOP — S.2 ROI validator poza Z17

Powód: wymagany `server/src/validators/resultsVnextRoi.validators.ts` nie
jest w ramce WOLNO, choć przechowuje `ListRoiCasesQuerySchema`.  
Czego brakuje: jawne rozszerzenie Z17.  
Po decyzji: dodać `q`, wspólny `textMatch.ts`, SQL filter i ROI_GOVERNED RealPG.  
Stan: KPI/OKR w `d176e7ec4b`; ROI nietknięte.

### STOP — pozostałe DoD

K.2/K.3/O.1/O.2/X.1/X.2/X.3a/X.3 lifecycle/X.4 i pełny T.2–T.5 nie
powstały w tym przebiegu. Nie oznaczono ich `JEST`; nie dodano atrap ani
domyślnych progów, wag lub SLA.

## Znaleziska nie naprawiane

| Plik                               | Znalezisko                            |
| ---------------------------------- | ------------------------------------- |
| `managementReportsService.ts:1173` | bulk export wskazuje nieutworzony zip |
| `executionControl.routes.ts:1011`  | mismatch capacity alerts              |
| ROI read-surface inventory         | zastane 2 FAIL, m.in. Flow Transform  |

## Git

```text
cd83a3e3c0 feat(results-search): tenant-scoped cross-registry search read model (S.1)
d176e7ec4b feat(results-search): add SQL q filters for KPI and OKR registries (S.2 partial)
8a5cb824db feat(results-kpi): server-side trend read model over measurement series (K.1)
6a441ca32c fix(execution): reject empty source sets on report-run validation (X.3b)
```

`git diff --name-only codex/m03-admin-20260824...HEAD`:

```text
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY14_BACKEND_INSTRUKCJA.md (odziedziczona baza instrukcji)
server/src/Gateway.ts
server/src/domain/initiatives-execution/__tests__/reportRunSources.test.ts
server/src/domain/initiatives-execution/reportRun.ts
server/src/routes/resultsVnext/__tests__/search.routes.test.ts
server/src/routes/resultsVnext/kpi.routes.ts
server/src/routes/resultsVnext/okr.routes.ts
server/src/routes/resultsVnext/search.routes.ts
server/src/services/resultsVnext/kpi/__tests__/kpiTrend.test.ts
server/src/services/resultsVnext/kpi/kpiRepository.ts
server/src/services/resultsVnext/kpi/kpiTrend.ts
server/src/services/resultsVnext/okr/okrSetRepository.ts
server/src/services/resultsVnext/platform/__tests__/textMatch.test.ts
server/src/services/resultsVnext/platform/resultsSearchRepository.ts
server/src/services/resultsVnext/platform/textMatch.ts
server/src/validators/resultsVnextKpi.validators.ts
server/src/validators/resultsVnextOkr.validators.ts
server/src/validators/resultsVnextSearch.validators.ts
tests/integration/day14-results-search.realdb.test.ts
```

## Gotowość

Gotowe do przeglądu przez nadzorcę: **TAK wyłącznie dla S.1, części S.2,
K.1 i X.3b. Cały dyżur NIE jest domknięty.** UI nie budowano; flagi nie zmieniano.
