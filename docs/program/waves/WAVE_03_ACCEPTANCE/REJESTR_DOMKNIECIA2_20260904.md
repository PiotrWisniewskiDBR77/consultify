# Rejestr domknięcia 2 — dyżur 313

Stan bazowy: `b3052614547b285ef5840d9c7f9729c6b8498d8e`, pomiar 2026-09-04 na świeżym PostgreSQL `cx313` po 888 migracjach; drugi przebieg zastosował 0 migracji.

## A. Surowe błędy w odpowiedziach HTTP

Własny mianownik guardu: **35** odpowiedzi, w tym `table-platform.routes.ts` **28** i `data-collection.routes.ts` **7**. Wszystkie są odpowiedziami HTTP, nie logami. Pełna lista `plik:linia:kod` leży w `/private/tmp/cx-day313-domkniecia2-artefakty/r1-wycieki.txt` (SHA-256 `b946cdb788a16d24b53c081174a0b15c444201c81a4a7886f6f3aa5e86099b93`).

| Plik | Linie | Wariant | Możliwa treść |
| --- | --- | --- | --- |
| `server/src/routes/table-platform.routes.ts` | 392, 443 | `(e as Error).message` w `error` | dowolny błąd zależności: SQL, URL, ścieżka lub identyfikator |
| jw. | 969, 1577, 1601, 1634, 1674, 1712, 1791, 1815, 1834, 1857, 1882, 1907, 1924, 1942, 1960, 2206, 2324, 2371, 2490, 2545, 2567, 2584, 2608, 2627 | `(e as Error).message` w `details` | dowolny błąd zależności: SQL, URL, ścieżka lub identyfikator |
| jw. | 2074, 2112 | `(e as Error).message` w elemencie wyniku odpowiedzi | surowy błąd operacji rekordowej |
| `server/src/routes/data-collection.routes.ts` | 141, 263, 312, 335, 418, 450, 505 | `(e as Error).message` w `details` | SQL, URL lub sekret dostawcy konektora |

Szeroki grep dał 106 trafień, z czego poza loggerem najwięcej: 31 i 7 w powyższych plikach. To inny mianownik niż guard.

## B. Klasy domenowe

Pomiar: 267 linii `extends Error` poza testami, **255 unikalnych nazw klas**. Pełny eksport z lokalizacją i statycznym wystąpieniem nazwy w trasach: `/private/tmp/cx-day313-domkniecia2-artefakty/r1-klasy.csv` (SHA-256 `decb10d81e22c75a565bd4c3092535f710098962f869cfba984f347736d6d81b`). Statyczne wystąpienie jest przesłanką osiągalności, nie dowodem runtime.

| Klasa | Lokalizacja wejściowa | AppError/status/code przed R3 | Osiągalność |
| --- | --- | --- | --- |
| `OkrCycleProgramNotActiveError` | `okrCycleCommands.ts:62` | TAK/409/`PROGRAM_NOT_ACTIVE` | test kontraktu R3 |
| `FinanceSettingsCommandError` | `financeSettingsCommandService.ts:22` | TAK/własny status/wniesiony kod | test kontraktu R3 |
| `TemplateNotFoundError` | `deliverableTemplateService.ts:586` | TAK/404/`NOT_FOUND` | test mappera: HTTP 404 i `errorCode != INTERNAL` |
| `CommandCapabilityDeniedError` | `commandCapabilityGuard.ts:96` | TAK/403/`COMMAND_CAPABILITY_DENIED` | test kontraktu R3 |

Po R3 ratchet pozostałych unikalnych eksportowanych klas `extends Error` wynosi **251** i nie może rosnąć.

## C. Osiem tras z odbioru 312

| Trasa | Stan własnego R1 | Znana hipoteza wejściowa |
| --- | --- | --- |
| `/api/admin/service-accounts` | `NOT_PROVEN` — przelot własny w R5 | brak walidacji UUID przed SQL |
| `/api/knowledge-graph/freshness/duplicates` | `NOT_PROVEN` — przelot własny w R5 | `GROUP_CONCAT` na PostgreSQL |
| `/api/report-builder/sources/upload_bundle` | `NOT_PROVEN` — przelot własny w R5 | brak `coverage_percent` w migracjach |
| `/api/billing/webhook-events` | `NOT_PROVEN` — przelot własny w R5 | do pomiaru |
| `/api/billing/webhook-events/stats` | `NOT_PROVEN` — przelot własny w R5 | do pomiaru |
| `/api/report-builder/definitions` | `NOT_PROVEN` — przelot własny w R5 | do pomiaru |
| `/api/table-platform/admin/service-accounts` | `NOT_PROVEN` — przelot własny w R5 | do pomiaru |
| `/api/table-platform/admin/sso` | `NOT_PROVEN` — przelot własny w R5 | do pomiaru |

Stan R5: centralna adaptacja trzech znalezionych kształtów `GROUP_CONCAT` i addytywna migracja `coverage_percent` są zaimplementowane; walidacja UUID przed zapytaniem jest zaimplementowana dla `/api/admin/service-accounts`. Żaden wiersz tabeli C nie zostaje podniesiony do `VERIFIED`, ponieważ pełny przelot ośmiu tras nie został wykonany.

## Zmienione kody

| Trasa | Było | Jest | Warunek |
| --- | --- | --- | --- |
| `/api/admin/service-accounts` | 500 z PostgreSQL dla nie-UUID organizacji/użytkownika | 400 `INVALID_IDENTIFIER` | wyłącznie nieprawidłowy UUID wykryty przed zapytaniem; runtime `NOT_PROVEN` |

Pozostałych kodów nie zmieniono.

## D. Front i kody do decyzji

`src/utils/apiError.ts` czyta `details`, ale `flattenValidationDetails` zwraca `null` dla stringa; obsługuje obiekty i tablice błędów pól. Wszystkie 35 miejsc przekazują string `.message`, więc surowe `details` można usunąć bez utraty strukturalnej walidacji. Pole `error` pozostaje. Pomiar `.details`: wadliwy grep z `\b` = 0, kontrolny grep = 125.

Trasy `200` z polem `error`: **DO DECYZJI WŁAŚCICIELA**, bez zmian kodu w tym dyżurze. Pełna klasyfikacja wymaga osobnego parsera odpowiedzi; sam grep nie rozstrzyga statusu wynikającego z wcześniejszego łańcucha.

## Korekty wobec instrukcji

- Tip `github-backup/grafika/m03-20260902` uciekł przed marker; zgodnie z DEC-95 praca pozostaje na markerze, bez rebase.
- Pierwsza migracja zastosowała 888, druga 0. Liczby pochodzą z własnego kontenera.
- R1 nie nazywa ośmiu tras „odtworzonymi”: przelot odbiorcy jest źródłem hipotez, a własny przelot należy do R5.
