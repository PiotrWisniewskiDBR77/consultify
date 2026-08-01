---
doc_id: vertical-integration-gate
truth_type: delivery-status
status: canonical
owner: codex
last_reviewed: 2026-07-30
---

# Bramka integracji pionowej

## Karta funkcji

| Warstwa | Pytanie | Dowód |
| --- | --- | --- |
| wejście | czy użytkownik ma jedno kanoniczne wejście? | menu/route smoke |
| frontend | czy UI realizuje pełną pracę, nie demo? | test komponentu + runtime |
| stan | czy loading/empty/error/success są jawne? | test stanów |
| API | czy frontend używa realnego kontraktu? | network/API test |
| bezpieczeństwo | czy backend egzekwuje tenant i capability? | test negatywny |
| właściciel | czy zapis wykonuje owner-lane service? | code/API trace |
| dane | czy zapis jest trwały i zgodny ze schematem? | write/read test |
| read-back | czy użytkownik widzi rzeczywisty wynik? | E2E |
| audit | czy można ustalić kto/co/kiedy? | audit record |
| rollback | czy można bezpiecznie cofnąć zmianę? | instrukcja/test |

Funkcja przechodzi dopiero przy 10/10 albo przy jawnym `N/A` zaakceptowanym
przez Process Managera.

## Werdykty fragmentu

- `INTEGRATED` — pełny pionowy slice;
- `PARTIAL_FRONT` — brak zaplecza lub trwałości;
- `PARTIAL_BACK` — brak użytkowego wejścia;
- `PARALLEL_RUNTIME` — więcej niż jedna aktywna implementacja;
- `LEGACY_PROTECTED` — alias potrzebny dla zgodności;
- `CONCEPT_BLOCKED` — nie ma zatwierdzonego rezultatu;
- `REMOVE_CANDIDATE` — brak użycia i właściciela, wymaga okresu ochronnego.

## Warunek zamknięcia pakietu scalającego

Pakiet nie kończy się na „połączeniu endpointu”. Musi:

1. wskazać kanon;
2. uruchomić pełny przepływ;
3. przełączyć wejście;
4. obsłużyć błąd i uprawnienia;
5. udowodnić trwały read-back;
6. opisać los poprzedniej implementacji.
