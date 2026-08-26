# Inicjatywy dzień 21 — raport dyżuru 2026-08-26

- Baza wykonawcza: `codex/day21-instrukcja-20260826 @ eee030e1da8b195fa5fdd8cc9e20fc449dcfcb12` zgodnie z rozstrzygnięciem nadzorcy DEC-95.
- Aktualny tip referencyjny: `codex/m03-admin-20260824` — rozbieżność poza zakresem; scalenie wykona nadzorca przy odbiorze.
- Marker: `649bd730a6` — nie jest przodkiem aktualnego tipu m03; jawnie uchylone dla tego dyżuru późniejszym rozstrzygnięciem nadzorcy.
- Gałąź: `codex/initiatives-day21-20260826`.
- Worktree: `/private/tmp/consultify-initiatives-day21`.
- Port PG: `5471` · kontener `cx-day21-pg` usunięty: TAK · wolumeny usunięte: TAK.

## Oświadczenie o chronionym checkoutcie (Z5/DEC-86)

Nie czytałem ani nie zmieniałem chronionego checkoutu `/Users/piotrwisniewski/Developer/Consultify`. Jedyny kontakt to dozwolony symlink `node_modules`, używany wyłącznie jako źródło zależności do odczytu.

## ★ Dowód celu połączenia (Z19 / DEC-96)

```text
 current_database | inet_server_port
------------------+------------------
 cx_day21         |
(1 row)
```

`inet_server_port()` jest pusty dla połączenia przez lokalny socket wewnątrz kontenera; mapowanie hosta zostało utworzone jawnie jako `5471:5432`. Każda komenda testowa dotykająca DB ma prefiks w tej samej linii: `DATABASE_URL=postgres://postgres:cx@localhost:5471/cx_day21 DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1`.

## Warunki wstępne — tabela

| Warunek                        | Wynik                                                                                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Dokładna baza instrukcji       | PASS — HEAD = tip `codex/day21-instrukcja-20260826` = `eee030e1da`                                                                           |
| `git fetch --all --prune`      | CZĘŚCIOWO — `icloud-source` wskazuje nieistniejący `/private/tmp/consultify-staging-deploy-e6ca`; `origin` i `github-backup` zostały pobrane |
| Marker względem aktualnego m03 | Rozbieżność zaakceptowana późniejszym rozstrzygnięciem nadzorcy DEC-95; bez rebase/merge                                                     |
| DEC-109                        | PASS — martwy router i `Analysis/` nie istnieją, `PortfolioHealthView.tsx` istnieje                                                          |
| Rdzeń A/B/C                    | PASS — zastany stub `periodFor`, autoryzacja per wiersz, trasy capacity-options i reader istnieją                                            |
| `UNKNOWN != 0`                 | PASS — obie wymagane asercje obecne                                                                                                          |
| Materiały wiążące              | PASS — ledger 164 linii; MODULE_ACCEPTANCE 141; capacity synthesis 176; wszystkie wskazane DEC obecne                                        |
| Migracje lokalne               | PASS — przebieg 1: 846 zastosowanych; przebieg 2: `Applying migrations: 0`; dry: `Pending migrations: 0`                                     |
| Numer migracji                 | PASS — w zakresie widoczny `20261100`; `20261110` wolny                                                                                      |

## Pozycje — tabela zbiorcza

| Pozycja                        | Status          | Commit                              | Dowód                                                                                                      |
| ------------------------------ | --------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| A.1 solver                     | ZROBIONE_WG_DoD | `bfc9a2341e`, `3bcf84c208`          | 8/8 unit + 5/5 HTTP real-PG; domyślne okablowanie; opublikowana zgodna capacity jest automatycznie używana |
| A.2 dowód 50×4                 | ZROBIONE_WG_DoD | `d197a78a05`, `8fcbcb56df`          | `Q1/Q2/Q3/Q4: 1/1/1/47 → 13/13/12/12`; determinizm; niezależny readback 50 zmian                           |
| A.3 typy zależności            | NIE_ZACZĘTE     | —                                   | Opcjonalne; świadomie poza minimalnym zakresem                                                             |
| B.1 autoryzacja raz na projekt | ZROBIONE_WG_DoD | `ae854c7121`                        | 50/1 projekt → 1 authorize; 50/3 → 3; 0 → 0; odmowa filtruje tylko dany projekt                            |
| B.2 paginacja keyset           | ZROBIONE_WG_DoD | `2d93cdd46c`                        | limit 1..200, domyślnie 50, kursor `(updated_at, aggregate_id)`, zły kursor 400, tenant 404                |
| B.3 test liczący zapytania     | ZROBIONE_WG_DoD | `ea3464999c`                        | domyślne okablowanie: 5 wierszy `21→5`; 50 wierszy `201→5` zapytań SQL                                     |
| C.1 proponent opcji            | NIE_ZACZĘTE     | —                                   | —                                                                                                          |
| C.2 trasa + DTO                | NIE_ZACZĘTE     | —                                   | —                                                                                                          |
| D.1 demand z planu             | NIE_ZACZĘTE     | —                                   | —                                                                                                          |
| D.2 przekrój osobowy           | NIE_ZACZĘTE     | —                                   | —                                                                                                          |
| E nasycenie                    | NIE_ZACZĘTE     | —                                   | Próg domyślny z instrukcji będzie oznaczony `DO_POTWIERDZENIA_WŁAŚCICIELA`                                 |
| F inwentarz sekcji             | NIE_ZACZĘTE     | —                                   | —                                                                                                          |
| G.1 martwe agregatory          | NIE_ZACZĘTE     | —                                   | —                                                                                                          |
| G.2 podwójny montaż            | NIE_ZACZĘTE     | —                                   | Są żywi konsumenci testowi `/api/pmo/initiatives`; nie usuwać bez dalszego dowodu                          |
| G.3 podobieństwo               | NIE_ZACZĘTE     | —                                   | —                                                                                                          |
| G.4 placeholder                | NIE_ZACZĘTE     | —                                   | —                                                                                                          |
| T testy                        | CZĘŚCIOWO       | `8fcbcb56df`, testy w commitach A/B | A+B domknięte; pełny zakres ma wyłącznie 37 czerwonych zastanych, 0 wprowadzonych                          |
| R.1 rejestr                    | ZROBIONE_WG_DoD | `e8de1e1df9`                        | Dodano wyłącznie faktyczny techniczny zakres A/B, bez zmiany Owner verdict                                 |

## ★ DOWODY OSIĄGALNOŚCI (Z20 / DEC-104)

| Pozycja     | Realne wejście                                                                               | Montaż                                                        | Router                                       | Domena                                         | Zapis                                                                                                |
| ----------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| A.1/A.2     | `POST /api/initiatives/runtime-v1/plan-scenarios/:scenarioId/analysis-proposals/:proposalId` | `server/src/Gateway.ts:696` → `pmo/initiatives.routes.ts:154` | `initiativesExecutionRuntime.routes.ts:3223` | `planAnalysisProposal.ts:29` → `planSolver.ts` | `ie_aggregate_state.payload_json`, typ `plan_analysis_proposal`; audit/outbox w tej samej transakcji |
| B.1/B.2/B.3 | `GET /api/initiatives/runtime-v1/initiatives?limit=&cursor=`                                 | `server/src/Gateway.ts:696` → `pmo/initiatives.routes.ts:154` | `initiativesExecutionRuntime.routes.ts:1779` | `postgresInitiativeReader.ts:1257`             | Odczyt `ie_aggregate_state`; brak zapisu zgodnie z semantyką GET                                     |

## ★ TESTY DOMYŚLNEGO OKABLOWANIA (Z21 / DEC-107)

| Pozycja | Co wołane bez wstrzykiwania                                                  | Plik testu                                          | Wynik                          |
| ------- | ---------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------ |
| A       | domyślny router, reader, UoW i produkcyjne `authorize`                       | `planSolver50x4.realdb.test.ts`                     | PASS, 201 + readback           |
| B       | domyślny router i `resolveEffectiveAccess` przez istniejące `deps.authorize` | `initiativeListDefaultWiringQueries.realdb.test.ts` | 2/2 PASS; SQL `21→5` i `201→5` |

## Tabele werdyktów

### A — solver

| Okres | Inicjatyw PRZED | Inicjatyw PO |
| ----- | --------------: | -----------: |
| Q1    |               1 |           13 |
| Q2    |               1 |           13 |
| Q3    |               1 |           12 |
| Q4    |              47 |           12 |

Reguły: łańcuch zależności, równoległe następniki, okno bez rozwiązania, capacity `UNKNOWN`, capacity `KNOWN`, cykl, determinizm i payload legacy — 8/8 PASS. Stary stub tworzył 47 wspólnych trójek okresowych w Q4; solver zachowuje indywidualny `target`, więc niezależne wejścia nie dostają jednej sztucznej trójki dat.

### B — wydajność

| Scenariusz     | Wierszy | Projektów | authorize PRZED |  PO | SQL PRZED |  PO |
| -------------- | ------: | --------: | --------------: | --: | --------: | --: |
| mała lista     |       5 |         1 |               5 |   1 |        21 |   5 |
| docelowa lista |      50 |         1 |              50 |   1 |       201 |   5 |
| trzy projekty  |      50 |         3 |              50 |   3 |         — |   — |
| pusta          |       0 |         0 |               0 |   0 |         — |   — |

## ★ KONTRAKT DLA FRONTU (produkt §1.6)

| Trasa                                                                                   | Metoda | Body/query                                                                                 | Odpowiedź                                                                                                  | Kody błędów             |
| --------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------- |
| `/api/initiatives/runtime-v1/plan-scenarios/:scenarioId/analysis-proposals/:proposalId` | POST   | istniejący body: `{expectedVersion:0, clientRequestId, scenarioId, inputAggregateVersion}` | istniejący material-command result z propozycją; solver automatycznie używa zgodnej opublikowanej capacity | 400, 401, 404, 409, 500 |
| `/api/initiatives/runtime-v1/initiatives`                                               | GET    | query `limit?:1..200` (default 50), `cursor?:base64url`                                    | `{initiatives: InitiativeReadModel[], nextCursor:string                                                    | null}`                  | 400 zły limit/kursor, 401 auth, 404 obcy jawny `organizationId` |

Front ma konsumować `nextCursor`; brak zmian w `src/` w tym dyżurze.

## Pozycje otwarte — STOP-y do zatwierdzenia nadzorcy

Brak STOP dla A/B. Pozostałe bloki uczciwie pozostawione jako `NIE_ZACZĘTE` zgodnie z zasadą nadrzędną kolejności.

## Znaleziska (NIE naprawiane przeze mnie)

- Pełny zakres realDB ma zastane błędy czyszczenia przez `TRUNCATE` bez tabel zależnych.
- Legacy `initiatives.test.js` ma zastane błędy kasowania organizacji wskutek FK `users_organization_id_fkey`.
- Frontowy `financialNarrativeBlocks.test.ts` ma zastany brak oczekiwanego angielskiego nagłówka.
- `/api/pmo/initiatives` ma żywych konsumentów w testach; G.2 nie może być wykonane jako ślepe usunięcie.

## Korekty wobec instrukcji

- Stan erraty §1.8 potwierdzony: brak modelu FS/SS/FF/lag w `initiatives-execution`; `createCapacityOptions` ma trasę, ale nie proponenta; martwy router z DEC-109 nie istnieje.
- `grep routes/index` ma trafienia wyłącznie w komentarzach opisujących martwy barrel, nie importy wykonawcze.
- `git fetch --all --prune` nie jest w pełni wykonalny przez zastany, lokalny remote `icloud-source`.
- Aktualny tip m03 nie zawiera już markera jako przodka; zgodnie z późniejszym rozstrzygnięciem nadzorcy pracuję dokładnie z gałęzi instrukcji.

## Migracje

`20261110_initiatives_day21_list_keyset_index.sql`: addytywne `CREATE INDEX IF NOT EXISTS`, bez FK. Przed utworzeniem `20261110` był wolny. Lokalnie: zastosowano 1; drugi przebieg 0; dry-run 0 oczekujących. Status: `MIGRATION_PREPARED / REMOTE_EXECUTION_NOT_AUTHORIZED`.

## Testy

### Baseline (przed pierwszym commitem)

| Zakres                                   | Wynik                                                                                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `vitest.realdb.config.ts`                | 9 plików PASS, 5 FAIL, 27 skipped; 22 testy PASS, 31 FAIL, 43 skipped. Wszystkie 31 FAIL: zastany `cannot truncate a table referenced in a foreign key constraint` |
| domena `initiatives-execution/__tests__` | 1/1 plik, 2/2 testy PASS                                                                                                                                           |
| `pmo.initiatives.fail-closed.contract`   | 1/1 plik, 4/4 testy PASS                                                                                                                                           |
| `initiatives.test.js`                    | 0/1 plik, 0/5 testów PASS; 5 zastanych FAIL przez `users_organization_id_fkey`                                                                                     |
| `initiativeEconomicsLinks`               | 1/1 plik, 3/3 testy PASS                                                                                                                                           |
| `initiatives-gate-readiness-parity`      | 1/1 plik, 2/2 testy PASS                                                                                                                                           |
| `effectiveAccessService`                 | 1/1 plik, 5/5 testów PASS                                                                                                                                          |
| front `Initiatives/__tests__`            | 7/8 plików; 158/159 testów PASS; 1 zastany FAIL w `financialNarrativeBlocks.test.ts`                                                                               |

### Wynik końcowy — ★ PEŁNY ZAKRES §0.4a, BEZ ZAWĘŻANIA (Z23)

`ZASIĘG PEŁNY` dla całego §0.4a.

Zakres §0.4a: `215/252 PASS` w testach wykonanych, dodatkowo 43 skipped przez istniejącą konfigurację.

- czerwone ZASTANE: 31 realDB (`TRUNCATE` kontra FK), 5 `initiatives.test.js` (`users_organization_id_fkey`), 1 front `financialNarrativeBlocks.test.ts`; razem 37;
- czerwone WPROWADZONE: **PUSTE**;
- nowe zielone: +19 testów względem baseline (`196→215` PASS), liczba czerwonych bez zmian (`37→37`).

### Zmiany w testach istniejących — przed/po (T.3)

Jedna własna korekta testu B.1 po addytywnym przejściu readera na stronę: mock `listInitiatives` → `listInitiativesPage`; istniejące asercje zachowane.

### Dowody mutacyjne izolacji tenanta (T.2)

1. B lista: tymczasowe usunięcie guardu `query.organizationId === token.organizationId` → test czerwony `200 != 404`; kod przywrócony, 4/4 PASS.
2. A propozycja: tymczasowe użycie `body.organizationId` i wyłączenie autoryzacji projektu → test czerwony `400 != 404`; kod przywrócony, 5/5 PASS.

### Dziewięć dowodów Bloku 6

Wszystkie kontrole wykonane wobec dokładnej bazy instrukcji `eee030e1da` zgodnie z DEC-95:

1. globalna infrastruktura testowa: PUSTY;
2. `src/`: PUSTY;
3. `effectiveAccessService.ts`: PUSTY;
4. `frameworkEntitlementService.ts` i middleware: PUSTY;
5. migracje: wyłącznie `20261110_initiatives_day21_list_keyset_index.sql`;
6. nowe/zmienione flagi: PUSTY;
7. nowe wywołania LLM: PUSTY;
8. `Gateway.ts`: 0 zmian;
9. kontener/wolumeny: `docker ps -a --filter name=cx-day21-pg` i `docker volume ls | grep -i cx-day21` puste; usunięto kontener i jeden anonimowy wolumen (`134.5 MB`).

## Licznik

Pozycje w zakresie: 18 · domknięte: 6 (A.1, A.2, B.1, B.2, B.3, R.1) · częściowe: 1 (T dla pełnego programu) · STOP: 0 · niezaczęte: 11.

## Czego NIE zrobiłem i dlaczego

- Nie wykonałem deployu, Railway, zdalnej migracji, pushu, merge ani rebase — zakazane przez DEC-65/DEC-95.
- Nie zmieniłem `src/`, modelu uprawnień, globalnej infrastruktury testowej ani flag.
- Nie rozpocząłem C–G ani opcjonalnego A.3: zgodnie z nadrzędną kolejnością przeznaczyłem dyżur na pełne dowody A–B.
- E nie zostało rozpoczęte, więc nie wprowadzono progu; przy późniejszej realizacji obowiązuje wartość domyślna instrukcji i etykieta `DO_POTWIERDZENIA_WŁAŚCICIELA`.
