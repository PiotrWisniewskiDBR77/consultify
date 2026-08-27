# Realizacja dzień 35 — zapis polityki, projekcje odczytu, cykl życia budżetu — raport dyżuru 2026-08-28

Gałąź: `codex/execution-day35-20260828` · baza: `3e707a9d3c` · kontener: `cx-day35-pg`, port `5641`.

## ★ KONTRAKT DLA FRONTU

| Metoda i ścieżka                                                                          | Żądanie                                                                                            | Odpowiedź                                                                                                                        | Błędy                                                                          | Zdolność                          | Kontrakt nie daje                            |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------- | -------------------------------------------- |
| `POST /api/initiatives/runtime-v1/execution-control-kpi-policies/:policyId`               | `expectedVersion: integer >= 0`, `clientRequestId`, `name`, `parameters`; wartości domyślne: żadne | koperta komendy, `response: { policyId, name, parameters, rowVersion }`                                                          | `400` walidacja, `401` brak aktora, `404` brak dostępu, `409` CAS/idempotencja | `initiative.update`               | ekranu polityki, seedu i wartości domyślnych |
| `GET /api/execution-control/budget/entries/:initiativeId`                                 | brak body                                                                                          | `{ entries, count }`; każdy wpis ma `origin: 'LEGACY' \| 'CANONICAL'`, identyfikator `id` (`entryId` dodatkowo dla kanonicznego) | `401` brak aktora                                                              | istniejąca rola odczytu Execution | paginacji i konfigurowalnego sortowania      |
| `POST /api/initiatives/runtime-v1/initiatives/:initiativeId/budget-entries/:entryId/void` | `expectedVersion`, `clientRequestId`; wartości domyślne: żadne                                     | koperta komendy; `response.status='VOIDED'`                                                                                      | `400`, `401`, `404`, `409`                                                     | `initiative.update`               | fizycznego DELETE agregatu                   |
| `GET /api/initiatives/runtime-v1/initiatives/:initiativeId/realizations`                  | brak body                                                                                          | `{ items: [{ realizationId, version, ...payload }] }`                                                                            | `401`; brak widoczności daje pustą listę                                       | `initiative.view`                 | paginacji, filtrów okresu, konsumenta UI     |
| `GET /api/initiatives/runtime-v1/initiatives/:initiativeId/raid-mitigations`              | brak body                                                                                          | `{ items: [{ raidItemId, version, ...payload }] }`                                                                               | `401`; brak widoczności daje pustą listę                                       | `initiative.view`                 | paginacji, filtrów, konsumenta UI            |
| `GET /api/initiatives/runtime-v1/initiatives/:initiativeId/manager-actions`               | brak body                                                                                          | `{ items: [{ managerActionId, version, ...payload }] }`                                                                          | `401`; brak widoczności daje pustą listę                                       | `initiative.view`                 | paginacji, filtrów, konsumenta UI            |
| `GET /api/initiatives/runtime-v1/initiatives/:initiativeId/manager-suggestion-reviews`    | brak body                                                                                          | `{ items: [{ suggestionId, version, ...payload }] }`                                                                             | `401`; brak widoczności daje pustą listę                                       | `initiative.view`                 | paginacji, filtrów, konsumenta UI            |

**„Przyciski w `src/components/Execution/**`pozostają`disabled`.** Backend przyjmuje zapis i zwraca go w odczycie, ale zdjęcie `disabled`wymaga osobnego dyżuru frontowego z prototypem i akceptem właściciela na zrzutach (reguła 7`CLAUDE.md`).”

**„Pozycja budżetu o `origin: 'CANONICAL'` kasuje się przez `POST .../budget-entries/:entryId/void`, a pozycja o `origin: 'LEGACY'` — przez `DELETE /api/execution-control/budget/entries/:entryId`.** To jest jawny stan przejściowy, nie defekt.”

**„Trasa polityki progów nie ma i nie będzie miała wartości domyślnych.** Polityka niekompletna zapisuje się jako niekompletna, a rodziny miar od niej zależne pozostają `DECISION_REQUIRED` z listą `missingParameters`. Wartości początkowe (`E-O3`/`E-O4`/`E-O5`) wpisuje konsultant w ekranie, którego jeszcze nie ma.”

**„Dla realizacji, mitygacji RAID, akcji menedżera i przeglądów sugestii nie ma dziś ŻADNEGO konsumenta w `src/`** — trasy odczytu powstały w tym dyżurze i czekają na dyżur frontowy.”

Jawnie poza kontraktem: paginacja list, filtrowanie po okresie, sortowanie konfigurowalne oraz kasowanie pozycji kanonicznej przez legacy `DELETE`.

### BRAMKA 33 (behawioralna, zastępuje grep „dokładnie 1 trafienie")

1. POST polityki KOMPLETNEJ (pięć parametrów z `REQUIRED_POLICY_PARAMETERS`) dla organizacji A, `policyId = "execution-control"` → `201`.
2. POST polityki KOMPLETNEJ dla organizacji B, ten SAM `policyId` → `201`.
3. GET `/control-kpis?weekStart=<data>&policyId=execution-control` jako aktor A → `policy.resolved === true` ORAZ `policy.missingParameters === []`.
4. To samo jako aktor B → `policy.resolved === true` ORAZ `policy.missingParameters === []`.

Wszystkie cztery kroki przeszły w `day35.kpi-policy-authoring.pg.test.ts` (`6/6 PASS`), wraz z readbackiem dwóch wierszy polityki.

## Decyzje właścicielskie — poza zakresem

`E-O3`, `E-O4` i `E-O5` nie zostały zaszyte ani seedowane. Ten dyżur dostarczył mechanizm przyjmujący dane polityki.

## Wynik bloków w kolejności wiążącej

| Blok | Wynik              | Dowód / ograniczenie                                                                                                                                                                                                                                                                                                                                                      |
| ---- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D.1  | `DONE`             | Migracja `20261240` zmienia PK na `(organization_id, policy_id)`; pierwszy przebieg zastosował migrację, drugi wykazał `0 pending`; ten sam `policy_id` zapisano dla dwóch organizacji. Commit `678f4781e3`.                                                                                                                                                              |
| D.2  | `DONE`             | Tenantowy zapis B.7 wariant A przez kanoniczną transakcję i capability `initiative.update`, bez wartości domyślnych. Commit `1f7316728c`.                                                                                                                                                                                                                                 |
| D.3  | `DONE`             | Real-PG: incomplete policy, CAS, replay/update, rollback, tenant i capability — `6/6 PASS`. Commit `d1bbeea178`.                                                                                                                                                                                                                                                          |
| D.6  | `DONE`             | Wszystkie pięć komend akceptuje jawne `expectedVersion >= 0`; v1→v2, stale CAS i ujemna wersja sprawdzone. Commit `d6687f3e09`.                                                                                                                                                                                                                                           |
| D.4  | `CZĘŚCIOWO`        | Kanoniczny budżet jest widoczny w istniejącym GET, ma pierwszeństwo przy deduplikacji i cykl create→read→update→read→void→read. Nie zmieniono legacy summary `/budget/initiative`: poprawne przeliczenie wymagałoby skopiowania progów z chronionego serwisu, co łamałoby zakaz nowych zaszytych progów. Legacy delete pozostaje osobnym kontraktem. Commit `ac14a98959`. |
| D.5  | `CZĘŚCIOWO`        | Cztery pozostałe rodziny mają tenantowe GET, filtr widoczności i test POST→GET oraz foreign-tenant empty. Brak osobnego testu każdego odczytu bez capability oraz pełnej macierzy dwóch organizacji z tym samym ID, więc nie deklaruję pełnego PASS. Commit `31713203b7`.                                                                                                 |
| D.7  | `CZĘŚCIOWO`        | Okno KPI używa dat biznesowych (`dueAt`, `targetAt`, `verifyBy/slaAt`), a nie `updated_at`; test obejmuje due-date i datę niepoprawną. Nie ma kompletnej, osobnej macierzy inverse/update-stability/no-date dla każdej rodziny. Commit `06caa11857`, korekta fixture `efa8afe11c`.                                                                                        |
| D.8  | `DONE`             | Wybrano ścieżkę A; osiągalny sourced gap ma `NO_EVENT_HISTORY_FOR_RECONSTRUCTED_REPORT`, a brak źródła pozostaje `SOURCE_NOT_EVENT_SOURCED`; `9/9 PASS`. Commit `d1513ac351`.                                                                                                                                                                                             |
| D.9  | `CZĘŚCIOWO / STOP` | `scopeCompleteness` wynika z rodzin KPI. `sourceVersion` nie został sfabrykowany: tabela `initiative_dependencies` nie ma kolumny wersji, więc zgodnie z instrukcją ten podpunkt kończy się STOP. Obecna liczba rodzin nie pozwala też uczciwie dowieść koperty `FULL`. Commit `0cf787df8e`.                                                                              |
| D.10 | `DONE`             | Kontrakt frontowy i cztery wymagane komunikaty są powyżej. Commit `086193ba15`.                                                                                                                                                                                                                                                                                           |
| R.1  | `DONE`             | Dodano EXE-PF-011…014 bez sztucznego podniesienia wyniku akceptacji. Commit `951205bbe7`.                                                                                                                                                                                                                                                                                 |
| R.2  | `DONE`             | Niniejszy raport zawiera dowody, luki i STOP; nie przedstawia częściowego zakresu jako pełnego PASS.                                                                                                                                                                                                                                                                      |

## Dowody techniczne

- Checkout: `/private/tmp/consultify-exec-day35`, branch `codex/execution-day35-20260828`; marker `3e707a9d3c` jest przodkiem. `git fetch --all --prune` zgłosił wyłącznie zepsuty lokalny remote `icloud-source`; marker zweryfikowano niezależnie jako `MARKER OK`.
- Instrukcja wskazuje nieistniejący `server/src/db/migrate.postgres.ts`; rzeczywisty runner to `server/scripts/migrate.postgres.ts`. Runner wymagał jawnego `NODE_ENV=test` dla lokalnego PG.
- Real DB: własny `pgvector/pgvector:pg16`, port `5641`; testy DB uruchamiano wyłącznie z jawnymi `DATABASE_URL`, `RUN_DB_TESTS=1`, `MOCK_DB=false`.
- Pakiety końcowe backend: PMO `34/34`, domain `15/15`, executionControl `4/4`, middleware `24/24` — razem `77/77 PASS`.
- Frontend Execution: `30/30 PASS`. Initiatives: `158/159`; jedyna porażka `financialNarrativeBlocks.test.ts` była obecna w baseline. Próba ponownego uruchomienia ReportsIntelligence przez `npm test -- ...` została przerwana, bo skrypt nadrzędny uruchamiał cały `test:all`; ujawnił niezwiązane awarie testów runtime guard przy braku ich własnego PG.
- Baseline zawierał również niezależne błędy: mock auth bez `validateOrgMembership`, wymagane zmienne środowiskowe w szerokim pakiecie services, JWT/cwd w routes oraz brak aktywnego dopasowania testu acceptance budget.
- Audyt liczb nie wykazał nowych progów biznesowych. Trafienia to daty/identyfikatory fixture, placeholdery SQL oraz techniczna granica tygodnia `INTERVAL '7 days'`; E-O3/E-O4/E-O5 pozostają niezdefiniowane.
- `git diff --check` jest czysty; diff pod `src/` jest pusty; `git stash list` jest pusty; nie wykonano push.

## Pliki chronione

SHA przed i po są identyczne:

- `server/src/domain/initiatives-execution/materialCommand.ts`: `49d9931244951fc5720974614957f63c8ccd93c8c5dc64b233998018301891b4`
- `server/src/services/executionBudgetService.ts`: `d7956195a54b281abde4eb13506458beb9f587146bbbed3f06f30e5289509e20`

## Stan końcowy

Rezultat dyżuru: **PARTIAL**, nie pełny PASS. Rdzeń celu został osiągnięty: pięć zapisów ma odczyt, politykę można tenantowo zapisać, a budżet kanoniczny ma jawny cykl życia. Otwarte pozostają wyszczególnione braki D.4, D.5, D.7 i D.9; żaden nie został zamaskowany wartością domyślną ani zgadywaną wersją źródła.
