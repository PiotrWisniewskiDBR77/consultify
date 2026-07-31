---
doc_id: MAT-006B
truth_type: operations
status: ACCEPTED_CONTRACT_SLICE
owner: codex
product_owner: piotr
priority: P0
depends_on: MAT-006A
last_reviewed: 2026-08-01
---

# MAT-006B — Presentation lifecycle E2E i history unavailable

## Zakres i werdykt

Wykonano ograniczony slice testowo-dokumentacyjny bez przebudowy generatora, eksportów
ani share. Istniejący runtime pokrywa wszystkie wymagane etapy osobnymi trasami i testami,
ale repozytorium nie zawiera jednego niewakuowego testu łączącego cały przepływ. Stary
`p20-lifecycle.test.ts` jest świadomie `skip` i wymaga działającego stagingu z seedem.

Werdykt: **GO dla kontraktów składowych i jawnego history unavailable; pełny staging E2E
pozostaje wymagany przed uznaniem całego golden flow za odebrany.**

## Inwentarz lifecycle

| Etap                | Runtime / trasa                                      | Dowód automatyczny                                                                      | Stan                  |
| ------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------- |
| wizard → outline    | `PresentationWizard` → `POST /generate/outline`      | acceptance error mapping, artifact-engine browser smoke                                 | działa kontraktowo    |
| outline → deck      | `POST /generate/deck`                                | generate-deck lock route test, artifact-engine smoke                                    | działa kontraktowo    |
| edit → save         | `PUT /decks/:deckId/autosave`, `X-Deck-Version`      | real-SQL round-trip i autosave conflict route                                           | działa                |
| reopen              | `GET /decks/:id`                                     | real-SQL restore/read-back oraz live staging spec                                       | działa kontraktowo    |
| history → restore   | `GET /versions`, `POST /versions/:versionId/restore` | `MAT-006A`: expectedVersion/CAS, canonical read-back, konflikt 409                      | działa                |
| history unavailable | hook/panel Version History                           | hook rozróżnia pustą historię od HTTP/network failure i pokazuje kontrolowany komunikat | działa                |
| export PPTX         | `GET /decks/:id/download`                            | browser download contract, stale-PPTX route test                                        | działa kontraktowo    |
| export PDF          | `POST /decks/:deckId/export/pdf`                     | export resilience/quality tests; pełny live download tylko w skipped staging spec       | częściowa pewność E2E |
| share               | `POST /decks/:id/share`                              | share route contracts i public viewer whitelist                                         | działa kontraktowo    |
| revoke              | `DELETE /decks/:id/share`                            | token działa przed revoke i zwraca 404 po revoke; RBAC                                  | działa                |

## Dodany kontrakt history unavailable

- powodzenie `GET /versions` ustawia `historyStatus=available`, również dla pustej listy;
- odpowiedź non-2xx lub błąd sieci ustawia `historyStatus=unavailable`;
- panel nie przedstawia awarii jako „No versions yet”, tylko pokazuje kontrolowany stan;
- awaria historii nie blokuje dostępu do decku ani jego dalszej edycji.

## Kryteria odbioru slice

- test pozytywnego odczytu historii;
- test non-2xx → `unavailable`;
- regresje CAS restore i real-SQL round-trip pozostają zielone;
- istniejące kontrakty export/share/revoke pozostają zielone;
- brak zmian w generatorze, rendererach PPTX/PDF i share API.

## Pozostała bramka stagingowa

Na stagingu wykonać jednym użytkownikiem i jednym deckiem:

1. wizard → outline → generate;
2. edit → autosave → reopen;
3. restore snapshotu i porównanie canonical read-back;
4. pobranie PPTX i PDF oraz otwarcie obu plików;
5. utworzenie linku, publiczny odczyt, revoke, następnie 404 starego tokenu;
6. wymuszenie niedostępności historii i potwierdzenie komunikatu bez utraty edycji.

Do czasu tego przebiegu status modułu pozostaje `CZĘŚCIOWA+`, a nie `DZIAŁA`.
