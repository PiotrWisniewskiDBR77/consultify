# Realizacja dzień 35 — zapis polityki, projekcje odczytu, cykl życia budżetu — raport dyżuru 2026-08-27

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

**„Przyciski w `src/components/Execution/**`pozostają`disabled`.** Backend przyjmuje zapis i zwraca go w odczycie, ale zdjęcie `disabled`wymaga osobnego dyżuru frontowego z prototypem i akceptem właściciela na zrzutach (reguła 7`CLAUDE.md`)."

**„Pozycja budżetu o `origin: 'CANONICAL'` kasuje się przez `POST .../budget-entries/:entryId/void`, a pozycja o `origin: 'LEGACY'` — przez `DELETE /api/execution-control/budget/entries/:entryId`.** To jest jawny stan przejściowy, nie defekt."

**„Trasa polityki progów nie ma i nie będzie miała wartości domyślnych.** Polityka niekompletna zapisuje się jako niekompletna, a rodziny miar od niej zależne pozostają `DECISION_REQUIRED` z listą `missingParameters`. Wartości początkowe (`E-O3`/`E-O4`/`E-O5`) wpisuje konsultant w ekranie, którego jeszcze nie ma."

**„Dla realizacji, mitygacji RAID, akcji menedżera i przeglądów sugestii nie ma dziś ŻADNEGO konsumenta w `src/`** — trasy odczytu powstały w tym dyżurze i czekają na dyżur frontowy."

Jawnie poza kontraktem: paginacja list, filtrowanie po okresie, sortowanie konfigurowalne oraz kasowanie pozycji kanonicznej przez legacy `DELETE`.

### BRAMKA 33 (behawioralna, zastępuje grep „dokładnie 1 trafienie")

1. POST polityki KOMPLETNEJ (pięć parametrów z `REQUIRED_POLICY_PARAMETERS`) dla organizacji A, `policyId = "execution-control"` → `201`.
2. POST polityki KOMPLETNEJ dla organizacji B, ten SAM `policyId` → `201`.
3. GET `/control-kpis?weekStart=<data>&policyId=execution-control` jako aktor A → `policy.resolved === true` ORAZ `policy.missingParameters === []`.
4. To samo jako aktor B → `policy.resolved === true` ORAZ `policy.missingParameters === []`.

Wszystkie cztery kroki przeszły w `day35.kpi-policy-authoring.pg.test.ts` (`6/6 PASS`), wraz z readbackiem dwóch wierszy polityki.

## Decyzje właścicielskie — poza zakresem

`E-O3`, `E-O4` i `E-O5` nie zostały zaszyte ani seedowane. Ten dyżur dostarczył mechanizm przyjmujący dane polityki.
