# Finance dzień 23 — raport dyżuru 2026-08-26

Baza związana: `f560de23683523419a39401a8e8a416afae4c4ca` (`codex/m03-admin-20260824`); tip kontrolny po fetchu: `045085fd02c71fea6b729e9670ab186d0ce21e9f`.
Marker: `f560de2368` — **POTWIERDZONY** (`merge-base --is-ancestor` exit 0).
Gałąź: `codex/finance-day23-20260826` · worktree: `/private/tmp/consultify-finance-day23`.
Port PG: `5483` · kontener: `cx-day23-pg` (`pgvector/pgvector:pg16`).
Poziom ukończenia §7: `CODE_PRESENT`; `TECHNICAL_PASS` nie został osiągnięty.

## Oświadczenie o chronionym checkoutcie

Nie wykonywałem odczytu ani zapisu w `/Users/piotrwisniewski/Developer/Consultify`. Jedyny kontakt to dozwolony symlink `node_modules` używany do odczytu. Nie łączyłem się z żadną bazą `consultify_w3_finance_owner_*`, Railway, stagingiem, demo ani produkcją. Nie było deployu, pushu, merge ani rebase.

## Dowód celu połączenia (Z19)

Dosłowny wynik wymaganej komendy:

```text
 current_database | inet_server_port
------------------+------------------
 cx_day23         |
(1 row)
```

`inet_server_port()` jest pusty, ponieważ polecenie wykonano przez lokalny socket wewnątrz kontenera; mapowanie hosta potwierdza `-p 5483:5432`. Każdy test DB uruchomiono z kompletem `DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=postgresql://postgres:cx@127.0.0.1:5483/cx_day23` w tej samej linii.

## Warunki wstępne

| Warunek                                     |           Wynik | Dowód                                                                                     |
| ------------------------------------------- | --------------: | ----------------------------------------------------------------------------------------- | ----------------------- |
| marker w m03                                |             TAK | exit 0                                                                                    |
| powierzchnia `finance-v2`                   |             TAK | 15 `*.routes.ts` + `index.ts` + `_shared.ts`                                              |
| montaż i strażnicy                          |             TAK | `Gateway.ts:1490-1491`, `routes/v8/index.ts:115`, `finance-v2/index.ts:61-62`             |
| rdzeń capability/freshness/derived-analysis |             TAK | `artifacts.routes.ts:343`, `crosscutting.routes.ts:81`, `lineage-navigator.routes.ts:227` |
| ochrona actuals i tenant-FK                 |             TAK | migracje `20260809...actual_protection.sql`, `20261061...tenant_fks.sql`                  |
| kontrakt / acceptance                       | 284 / 151 linii | zgodne z instrukcją                                                                       |
| migracje                                    | 850 / 0 / dry 0 | świeży lokalny PG                                                                         |
| numer `20261140`                            |           WOLNY | `ls ...                                                                                   | grep '^20261140'` pusty |

`git fetch --all --prune` był częściowy: `origin` i `github-backup` pobrane, zastany remote `icloud-source` wskazuje na nieistniejący `/private/tmp/consultify-staging-deploy-e6ca`. Marker zweryfikowano osobną komendą po tym błędzie.

Rozejście marker → aktualny tip m03 istnieje (commity dni 20–22, Tools, Audits i wpisy ledger). Zgodnie z DEC-95 nie wykonywałem rebase; integrację z tipem pozostawiam nadzorcy.

## §A — inwentarz kontraktu

### A.1 — FIN-REC-001…015

| FIN-REC | Tylna połowa                          | Stan                                                                 | Dowód                                                                         | Pozycja     |
| ------- | ------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------- |
| 001     | trasy, bramki i zapis                 | CZĘŚCIOWO — zinwentaryzowane, lecz powierzchnia zablokowana          | `Gateway.ts:1490-1491`                                                        | A/B         |
| 002     | brak tylnej połowy                    | POZA_ZAKRESEM_TYŁU                                                   | kontrakt §3.3; raport dnia 4 F.2                                              | —           |
| 003     | brak tylnej połowy                    | POZA_ZAKRESEM_TYŁU                                                   | errata §1.8 pkt 2                                                             | —           |
| 004     | Statements API                        | CZĘŚCIOWO — kod istnieje; kanoniczny mount blokuje gate              | `statements.routes.ts:56,105`; test B.1                                       | B–E         |
| 005     | Analysis API                          | CZĘŚCIOWO — kod istnieje; mount blokuje gate                         | `analysis.routes.ts:82`; test B.1                                             | B–E         |
| 006     | Models/Baseline API                   | CZĘŚCIOWO — kod istnieje; mount blokuje gate                         | `models.routes.ts:104,191`; `baseline.routes.ts:65,176,237`                   | B–E         |
| 007     | Prediction API                        | CZĘŚCIOWO — kod istnieje; mount blokuje gate                         | `prediction.routes.ts:68,115,162`                                             | B–E         |
| 008     | Valuation API                         | CZĘŚCIOWO — kod istnieje; mount blokuje gate                         | `valuation.routes.ts:244-875`                                                 | B–E         |
| 009     | retry tworzenia                       | BRAK dowodu na produkcyjnym wejściu                                  | `artifacts.routes.ts:122`; `valuation.routes.ts:244,289`                      | D.2         |
| 010     | tenant, rola, CAS, audit, cold reopen | CZĘŚCIOWO — strażnicy istnieją; audit danych brak; mount OFF         | `index.ts:61-62`; grep audit pusty                                            | C–E         |
| 011     | typowane błędy i retry                | CZĘŚCIOWO — lokalne koperty; statusy ad hoc                          | `_shared.ts:56`; `valuation.routes.ts:153`                                    | C.2/D.2/G.1 |
| 012     | wizual/a11y                           | POZA_ZAKRESEM_TYŁU                                                   | errata §1.8 pkt 2                                                             | —           |
| 013     | staleness/handoff                     | CZĘŚCIOWO — lineage ma staleness, handoff nie porównuje fingerprintu | `lineageFreshnessService.ts:224-300`; `financeCandidateHandoffCore.ts:85-109` | F           |
| 014     | API/PG/tenant tests                   | CZĘŚCIOWO — baseline wykonany, B.1 6/6; pełne suite czerwone         | sekcja Testy                                                                  | T           |
| 015     | owner acceptance                      | POZA_ZAKRESEM_TYŁU                                                   | kontrakt §7 i errata §1.8 pkt 2                                               | R           |

### A.2 — mapa osiągalności pięciu kart

| Karta                | Realne wejście                                    | Bramki / montaż                           | Router → serwis → tabela                                                              | Werdykt                               |
| -------------------- | ------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------- |
| Statements           | `GET /api/v8/finance-v2/statements/:id/lines`     | `Gateway.ts:1491` → `v8FeatureGate:15-18` | `index.ts:115` → `statements.routes.ts:168` → `finance_stmt_lines`                    | ZABLOKOWANE_BRAMKĄ, 404 `V8_DISABLED` |
| Analysis             | `GET /api/v8/finance-v2/analysis/:id/kpi-values`  | jw.                                       | `analysis.routes.ts` → canonical KPI service → `finance_analysis_kpi_values`          | ZABLOKOWANE_BRAMKĄ, 404               |
| Models/Baseline      | `GET /api/v8/finance-v2/baseline/:id/assumptions` | jw.                                       | `baseline.routes.ts` → baseline services → `finance_baseline_assumptions`             | ZABLOKOWANE_BRAMKĄ, 404               |
| Prediction           | `GET /api/v8/finance-v2/prediction/:id/authoring` | jw.                                       | `prediction.routes.ts` → authoring service → `finance_prediction_authoring_revisions` | ZABLOKOWANE_BRAMKĄ, 404               |
| Enterprise Valuation | `GET /api/v8/finance-v2/valuation/cases/:id`      | jw.                                       | `valuation.routes.ts` → valuation services → `finance_valuation_cases`                | ZABLOKOWANE_BRAMKĄ, 404               |

Obejście `mountedFinanceStatementRouter` (`Gateway.ts:1490`) dopuszcza wyłącznie legacy `/finance/statements/*` i nie dopuszcza żadnej ścieżki `/finance-v2/*` (`financeStatementMountedSurface.ts:12-34`). Kontrola behawioralna: legacy Statements bez tokenu dochodzi do auth i zwraca 401, podczas gdy wszystkie pięć wejść kanonicznych kończy się wcześniej na 404.

### A.3 — inwentarz powierzchni zapisu

Poniżej pełny denominator zastany: **58 mutujących handlerów** (w tym dwa generowane PUT legacy valuation). Kolumny CAS/idempotencja/audyt/negatyw tenanta pozostają niezamknięte, ponieważ B.1 wymusił STOP; znane wyjątki zaznaczono.

| Plik                | Metoda + ścieżka (linie)                                                                                                                                                                                                                                                                                     | CAS / idempotencja / audit / tenant-test                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| statements          | POST `/:bv/map` (56), POST `/:bv/reconcile` (105)                                                                                                                                                                                                                                                            | CAS warunkowy / brak / brak / jest częściowo                      |
| analysis            | POST `/:bv/compute` (82)                                                                                                                                                                                                                                                                                     | CAS warunkowy / brak / brak / jest częściowo                      |
| baseline            | PUT `/:bv/context` (65), POST `/:bv/assumptions` (176), POST `/:bv/compute` (237)                                                                                                                                                                                                                            | wyspowo / wyspowo / brak / jest częściowo                         |
| prediction          | PUT `/:bv/authoring` (68), POST `/:bv/preflight` (115), POST `/:bv/calculate` (162)                                                                                                                                                                                                                          | wyspowo / wyspowo / brak / jest częściowo                         |
| artifacts           | POST `/artifacts` (122), POST `/:id/rename` (390)                                                                                                                                                                                                                                                            | brak / brak / brak / jest częściowo                               |
| versions            | POST `/:bv/transitions` (117), POST `/:bv/compute-snapshot` (173)                                                                                                                                                                                                                                            | pierwszy CAS / brak / lifecycle-only / jest częściowo             |
| models              | POST `/:id/approve` (104), POST `/:id/reopen` (191)                                                                                                                                                                                                                                                          | samospełniający CAS / częściowo / lifecycle-only / jest częściowo |
| compute             | POST `/jobs` (76), POST `/jobs/:id/cancel` (203)                                                                                                                                                                                                                                                             | n/d / klucz na create / brak / jest częściowo                     |
| comments            | POST `/comments` (123), `resolve` (169), `reopen` (181), `assign` (193), `search-by-cell` (260), POST `/review-checklist` (300), `check` (327), `uncheck` (339), `required` (351)                                                                                                                            | niezinwentaryzowane do DoD / brak audit / testy zastane           |
| saved views         | POST `/saved-views` (85), PATCH/DELETE `/:viewId` (195/224)                                                                                                                                                                                                                                                  | niezinwentaryzowane do DoD / brak audit / testy zastane           |
| compare             | POST `/periods` (92), `/versions` (126), `/entities` (165), `/scenarios` (201), `/valuation-methods` (235), `/actual-vs-forecast` (264)                                                                                                                                                                      | obliczenia/odczyt semantyczny; brak audit; testy zastane          |
| export/import       | POST `/import/parse` (97), `/preview` (119), `/apply` (211)                                                                                                                                                                                                                                                  | apply ma CAS/idempotencję; audit brak                             |
| lineage             | POST `/:source/derived-analysis` (226), POST `/versions/lineage-edges` (360)                                                                                                                                                                                                                                 | idempotencja częściowa; audit brak                                |
| valuation legacy    | POST `/registrations` (124), DELETE `/:legacyId` (171), POST `compute` (181), `negotiation-pack` (187), `export/pptx` (196), PUT `depth` (205), `assumptions` i `peers` (217)                                                                                                                                | klucze obecne na części; audit brak                               |
| valuation canonical | POST `/cases` (244), POST `/cases/:id/variants` (289), PATCH `/variants/:bv` (335), POST `/compare-variants` (368), POST `/methods` (420), POST `/methods/basket` (456), PUT `/wacc-inputs` (520), POST `/compute/dcf` (582), PUT `/bridge` (717), POST `/sensitivity` (790), POST `/advisor/generate` (874) | CAS brak/wyspowo; create bez klucza; audit brak; testy zastane    |

## Pozycje — tabela zbiorcza

| Pozycja                                          | Status                    | Commit      | Dowód                                                                                                 | Poziom       |
| ------------------------------------------------ | ------------------------- | ----------- | ----------------------------------------------------------------------------------------------------- | ------------ |
| A                                                | CZĘŚCIOWO                 | raportowy   | tabele A.1–A.3                                                                                        | CODE_PRESENT |
| B.1                                              | ZABLOKOWANE_BRAMKĄ / STOP | test+raport | 6/6, pięć razy 404 `V8_DISABLED`                                                                      | CODE_PRESENT |
| B.2                                              | CZĘŚCIOWO                 | test+raport | produkcyjny montaż bez wstrzykiwania dowodzi pre-auth gate; pełna macierz auth niemożliwa za gate OFF | CODE_PRESENT |
| B.3                                              | NIE_ZACZĘTE               | —           | zatrzymane po B.1                                                                                     | —            |
| C.1, C.2, D.1, D.2, E, F.1, F.2, G.1–G.4, H, R.1 | NIE_ZACZĘTE               | —           | STOP B.1                                                                                              | —            |
| T                                                | CZĘŚCIOWO                 | test+raport | baseline + 6/6 B.1                                                                                    | CODE_PRESENT |

## STOP — B.1 osiągalność kanonicznej powierzchni

Powód: **0 z 5** kanonicznych kart Finance jest osiągalnych na domyślnym okablowaniu. Wszystkie kończą się na pre-auth `v8FeatureGate` z HTTP 404 i `code=V8_DISABLED`, ponieważ `ENABLE_V8_GLOBAL !== 'true'`.

Dowód: `server/src/middleware/v8FeatureGate.middleware.ts:14-18`, `Gateway.ts:1491`, test `day23.default-mount-reachability.pg.test.ts` — 6/6 PASS. Wąski bypass `Gateway.ts:1490` obejmuje tylko legacy Statements, nie `finance-v2`.

Co zrobiłbym, gdyby zapadła decyzja właścicielska: właściciel/nadzorca musi rozstrzygnąć kontrolowane otwarcie pięciu kart i właściwy model flag per karta. Dopiero na zaakceptowanym montażu można uczciwie dowodzić capability, CAS, idempotencji i audytu jako produkcyjnie osiągalnych. Nie zmieniłem flagi, wartości domyślnej, `Gateway.ts`, `routes/v8/index.ts` ani middleware.

Stan: zacommitowany wyłącznie test dowodowy i raport; mechanika C–H nie została rozpoczęta.

## Testy

### Baseline przed pierwszym commitem

| Zakres                           | PASS | FAIL | SKIPPED | Uwagi                                                            |
| -------------------------------- | ---: | ---: | ------: | ---------------------------------------------------------------- |
| `finance-v2/__tests__` RealPG    |   99 |  116 |      16 | 12/21 plików czerwonych; dominują zastane 403 po membership wall |
| canonical services RealPG        |  530 |   11 |      44 | 14/56 plików czerwonych                                          |
| `tests/unit/finance`             |  795 |    2 |       0 | znany `financeFallbackGating.test.ts`                            |
| P05 contract                     |   10 |    0 |       0 | PASS                                                             |
| `server/src/routes/v8/__tests__` |  802 |   16 |       2 | czerwone poza Finance day23, zastane                             |

Pierwsze dwie próby filtra z root repo (`server/...` i `src/...`) zwróciły `No test files found`; `server/vitest.config.ts` wymaga uruchomienia z cwd `server`. Nie policzono ich jako PASS ani SKIP.

### Test B.1

`day23.default-mount-reachability.pg.test.ts`: **6 PASS / 0 FAIL / 0 SKIPPED**. Test używa domyślnych `mountedFinanceStatementRouter`, `v8FeatureGate` i `v8Router`, bez wstrzyknięcia auth/context/service.

### Zasięg

`ZASIĘG CZĘŚCIOWY`. Baseline pełnego §0.4a wykonano, ale po wiążącym STOP B.1 nie uruchamiano końcowego pełnego re-run ani testów pozycji C–H. Czerwone wprowadzone: **0 znanych**; jedyny nowy test jest zielony.

## Kontrakt dla frontu

Brak nowej trasy i brak zmiany kontraktu API. Stan wiążący dla frontu: `/api/v8/finance-v2/*` zwraca domyślnie `404 { error: 'V8 features not available', code: 'V8_DISABLED' }`; legacy `/api/v8/finance/statements/*` ma osobny, wąski bypass i dochodzi do auth.

## Pozycje otwarte

1. Decyzja właścicielska o osiągalności pięciu kart — 0/5 przy default-OFF.
2. B.3: drugi tor `/api/v8/finance/*` używa tych samych serwisów kanonicznych; pełna tabela równoważności strażników nie została rozpoczęta po STOP B.1.
3. `financeValueDemoAllowlist` realnie omija `demoWriteGuard` wg wiążącej instrukcji §G.3; nie zmieniano zachowania ani komentarza, bo G nie został rozpoczęty.
4. `icloud-source` jest zastanym zepsutym remote.

## Korekty wobec instrukcji

1. Instrukcja mówi o „czterech z pięciu” potencjalnie blokowanych kartach; pomiar wykazał **pięć z pięciu**, ponieważ bypass dotyczy legacy `/finance/statements`, nie kanonicznego `/finance-v2/statements`.
2. Komendy §0.4a z root repo i filtrem `server/src/...` nie kolekcjonują testów przy zastanym `server/vitest.config.ts`; poprawny przebieg wymaga cwd `server` i filtra `src/...`.
3. `inet_server_port()` wykonany przez `docker exec psql` zwraca NULL (socket), mimo że kontener jest opublikowany na hoście `5483:5432`.

## Migracje

Brak nowej migracji. Wynik H pozostaje `NIE_ZACZĘTE` po STOP B.1. Zakres `20261140–20261149` nietknięty. `REMOTE_EXECUTION_NOT_AUTHORIZED` zachowane.

## Czego nie zrobiłem i dlaczego

Nie implementowałem C–H, nie edytowałem `MODULE_ACCEPTANCE.md`, nie zmieniałem dwóch handlerów G.1 ani komentarzy G.3. Polecenie właścicielskie mówi wprost, że nieosiągalność przez bramkę jest STOP-em i decyzją właścicielską, a nie zaproszeniem do ratowania flagą. Raport i test osiągalności są gotowe do odbioru przez nadzorcę.
