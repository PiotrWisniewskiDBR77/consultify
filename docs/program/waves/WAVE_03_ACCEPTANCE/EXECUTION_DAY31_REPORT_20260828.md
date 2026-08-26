# Realizacja dzień 31 (blok B) — raport dyżuru 2026-08-28

Baza związana: `5cfa62470e` (`codex/m03-admin-20260824`); gałąź robocza utworzona zgodnie z poleceniem użytkownika z tipa instrukcji `2d457adaaf`. Marker `5cfa62470e`: POTWIERDZONY (`merge-base --is-ancestor`, exit 0). Gałąź: `codex/execution-day31-20260828`; worktree: `/private/tmp/consultify-execution-day31`. Port PG: 5556; kontener: `cx-day31-pg` (`pgvector/pgvector:pg16`); baza: `cx_day31`.

Poziom ukończenia: CODE_PRESENT (raport w toku).

## Oświadczenie o chronionym checkoutcie (Z5/DEC-86)

Po przeczytaniu instrukcji nie wykonywano odczytu ani zapisu w `/Users/piotrwisniewski/Developer/Consultify` poza dozwolonym, zastanym symlinkiem `node_modules`; przed przeczytaniem instrukcji wykonano w checkoutcie chronionym `pwd`, `git status` i `git worktree list` w celu ustalenia bazy — rozbieżność jawna. Brak połączeń z demo/staging/produkcją/Railway; brak push/merge/rebase; brak kontaktu z cudzymi worktree i kontenerami.

## Dowód celu połączenia (Z20/DEC-96)

```text
docker run -d --name cx-day31-pg -e POSTGRES_PASSWORD=cx -p 5556:5432 pgvector/pgvector:pg16

 current_database | inet_server_port
------------------+------------------
 cx_day31         |
(1 row)
```

Puste `inet_server_port()` przez socket `docker exec` jest oczekiwane; mapowanie hosta dowodzi `-p 5556:5432`.

```text
ie_aggregate_state | ie_command_receipts | ie_audit_events | ie_outbox_events | ie_governance_policies | execution_control_kpi_policies
(1 row; wszystkie sześć to_regclass nie-NULL)
```

## Warunki wstępne

| Kontrola                                               | Oczekiwane               | Faktyczne                         |
| ------------------------------------------------------ | ------------------------ | --------------------------------- |
| A11 / Batch A w markerze                               | SCALONE / SCALONE        | `A11_SCALONE` / `BATCH_A_SCALONE` |
| `GOVERNED_EXECUTION_CONTROL_COMMANDS` / wyjątek DELETE | 2 / dokładnie 1          | 2 / linia 11                      |
| szkielety KPI                                          | `null >= 6`              | 7; `numerator: null` linia 56     |
| as-of odmowa                                           | `reconstructable: false` | linia 57                          |
| tabela polityk / pisarze                               | istnieje / 1 odczyt      | istnieje / 1                      |
| mount runtime-v1                                       | linia 154 / Gateway 697  | linia 154 / Gateway 693           |
| decyzje 128 / 120                                      | >=1 / >=1                | 1 / 1                             |
| migracje 202612                                        | pusto                    | pusto                             |
| najwyższe ID                                           | EXE-PF-006 / EXE-OWN-008 | zgodne                            |

Migracje świeżej bazy: 854 zastosowane, 0 błędów; drugi przebieg: `Applying migrations: 0`. Instrukcja wskazywała nieistniejący runner `server/src/db/migrate.postgres.ts`; wykonano istniejący `server/scripts/migrate.postgres.ts`.

## Bramka wejściowa — dwustronny kontrakt

| Strona  | Żądanie                                                      | Wynik                                      | Werdykt |
| ------- | ------------------------------------------------------------ | ------------------------------------------ | ------- |
| runtime | GET `/api/initiatives/runtime-v1/execution-cases` bez tokenu | 401/403, nie 404                           | PASS    |
| runtime | GET `/control-kpis?weekStart=2026-08-24` jako ACTIVE OWNER   | 200, 8 rodzin                              | PASS    |
| runtime | POST `/management-signals/ingest` jako ACTIVE OWNER          | 201, `APPLIED`, nie kod 409                | PASS    |
| legacy  | POST `/api/v8/execution-control/risk-signals/dismiss`        | 409, `EXECUTION_RUNTIME_V1_WRITE_REQUIRED` | PASS    |
| legacy  | DELETE `/api/v8/execution-control/budget/entries/:id`        | nie 409                                    | PASS    |
| legacy  | GET `/api/v8/execution-control/risk-signals`                 | nie 409                                    | PASS    |

Bramka PRZESZŁA: 6/6 w `day31.canonical-writer-contract.pg.test.ts`, commit `242139eddf`.

## Ustalenie REAL_PG

`REAL_PG = RUN_DB_TESTS === '1' && MOCK_DB === 'false' && DATABASE_URL.startsWith('postgres')` (`initiativeRuntimeExecutionSeam.pg.test.ts:26-29`). Bez `RUN_DB_TESTS=1` dwa jawnie zmierzone pakiety PG pominęły 11 i 2 testy. Pełna tabela różnicowa zostanie domknięta w pomiarze końcowym.

## Inwentarz endpointów i konsumentów

Własny grep: 135 rejestracji tras runtime-v1, 71 mutujących. Instrukcja: 135/70 — liczba mutujących SKORYGOWANA do 71. Legacy `execution-control.routes.ts`: 24 rejestracje routera głównego plus dedykowany `managerRouter`; montaż managera zachowuje tę samą bramkę 409.

Pełny denominator został uzyskany komendami z BLOK 0 pkt 9. Dla B.1 istotne wycinki są w tabeli poniżej; pełną tabelę 135 tras należy generować z `grep -nE '^ *router\.(get|post|put|patch|delete)\(' server/src/routes/pmo/initiativesExecutionRuntime.routes.ts`.

## B.1 — mapa przepięcia

| Grupa                     | Zapis legacy                                                                                            | Skutek/tabela legacy                                        | Komenda runtime-v1                                                                                                      | Trasa odczytu                         | Dowód rozstrzygnięcia                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Dodanie pozycji budżetu   | POST `/api/v8/execution-control/budget/entries`; `execution-control.routes.ts:669`                      | `createBudgetEntry`; kanoniczny rejestr budżetu legacy      | `BRAK_API`; propozycja POST `/initiatives/:initiativeId/budget-entries/:entryId` z `expectedVersion`, `clientRequestId` | propozycja GET `/budget-entries`      | runtime-v1 nie ma ścieżki `/budget`; `finance-reconciliations` i `material-changes` nie są pozycją budżetu                        |
| Zapis realizacji budżetu  | POST `/api/v8/execution-control/realizations`; `execution-control.routes.ts:737`                        | `roi_realized_values` + audit legacy                        | `BRAK_API`; propozycja POST `/initiatives/:initiativeId/realizations/:entryId`                                          | propozycja GET `/realizations`        | `results-observations` jest obserwacją akceptacji Results, a nie wpisem realizacji budżetu                                        |
| Mitygacja RAID            | PATCH `/api/v8/execution-control/raid/:id/mitigation`; `execution-control.routes.ts:253`                | UPDATE `raid_items`                                         | `BRAK_API`; propozycja POST `/initiatives/:initiativeId/raid-mitigations/:raidItemId`                                   | propozycja GET `/raid-mitigations`    | runtime intervention wymaga management signal i opisuje case interwencji, nie aktualizację mitygacji RAID                         |
| Akcja lane kokpitu        | POST `/manager/lanes/:laneId/problem-actions/execute`; `execution-control.routes.ts:1967`               | `executeManagerProblemAction` i jego efekty domenowe legacy | `BRAK_API`; propozycja POST `/initiatives/:initiativeId/manager-actions/:actionId`                                      | propozycja GET `/manager-actions`     | brak `problem-actions`/`lane` w runtime-v1; decision `/execution-cases/.../decide` jest innym przypadkiem                         |
| Approve/Defer sugestii AI | POST `/manager/lanes/:laneId/suggestions/apply` i `/decisions`; `execution-control.routes.ts:1996,2052` | manager suggestions / `v8_lane_decisions`                   | `BRAK_API`; propozycja POST `/initiatives/:initiativeId/manager-suggestions/:suggestionId/review`                       | propozycja GET `/manager-suggestions` | `ai-analysis-proposals/:id/review` publikuje Initiative Card i wymaga niezależnego review; nie jest lane suggestion approve/defer |

Dosłowne grepy braku:

```text
rg "budget|realization|raid.*mitigation|problem-actions|suggestions/apply|manager.*lane" server/src/routes/pmo/initiativesExecutionRuntime.routes.ts
# brak semantycznie równoważnych rejestracji; trafienia opisowe lub inne domeny nie stanowią API tych pięciu zapisów
```

### B.1b — akcje nietknięte

| Akcja                  | Dowód                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------ |
| DELETE budget entry    | jedyny wpis `GOVERNED_EXECUTION_CONTROL_COMMANDS`, test bramki: status nie 409       |
| approve/reject decyzji | `ManagerModuleView.tsx:255-270` nadal woła `Api.decideDecision`; brak zmian w `src/` |

## Pozycje — tabela zbiorcza

| Pozycja  | Status          | Commit             | Dowód              | Poziom         |
| -------- | --------------- | ------------------ | ------------------ | -------------- |
| BLOK 0   | ZROBIONE_WG_DoD | `242139eddf`       | 6/6 real PG        | TECHNICAL_PASS |
| B.1      | ZROBIONE_WG_DoD | oczekuje na commit | tabela pięciu grup | CODE_PRESENT   |
| B.2–B.10 | NIE_ZACZĘTE     | —                  | —                  | —              |
| R.1–R.2  | NIE_ZACZĘTE     | —                  | —                  | —              |

## Decyzje właścicielskie — poza zakresem

E-O3, E-O4 i E-O5 pozostają nierozstrzygnięte; nie przyjęto żadnego progu, wagi, SLA, bufora ani taksonomii.

## Pomiar testów — baseline w toku

Zastane czerwone potwierdzone przed pierwszym commitem: `execution-control.routes.test.ts` nie startuje z powodu niepełnego lokalnego mocka `auth.middleware` (brak `validateOrgMembership`); `src/components/Initiatives/__tests__/financialNarrativeBlocks.test.ts` 1 FAIL / 158 PASS; pakiet `src/services/__tests__ -t execution` trafia także 5 testów `artifactRegistryService.retry.test.ts` i daje 5 FAIL / 22 SKIPPED. Nie naprawiano cudzych testów.

## Znaleziska (nie naprawiane)

- Równoległe serie numeracji migracji trzycyfrowej i ośmiocyfrowej.
- Polski `BRAK_ŹRÓDŁA` obok angielskiego `DECISION_REQUIRED` w `controlKpiReadModel.ts`.
- Brak endpointów archiwizacji/usuwania z kebaba `ExecutionHub.tsx`.
- Zastane N+1 przy otwieraniu raportu.
- Instrukcja podaje 70 tras mutujących; grep na markerze daje 71.
- Komendy vitest z rootem i filtrem `server/src/...` zwracają `No test files found`; działający wariant to cwd `server` i filtr `src/...`.

## Bezpieczniki

Front `src/**`, middleware bramki, Gateway, montaż routerów, flagi i E-O3/E-O4/E-O5 pozostają nietknięte.
