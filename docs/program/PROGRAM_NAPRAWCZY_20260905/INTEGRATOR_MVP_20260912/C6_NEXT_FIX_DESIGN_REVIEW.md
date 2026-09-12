# Review projektu C6 — poprawki wymagane przed implementacją

Root przeczytał pełny C6_NEXT_FIX_DESIGN.md oraz migracje20261030 i20261034 na0025c1c448. Werdykt: **REVISE**, nie gotowy projekt wykonawczy. Nie zmieniano C6/source/DB.

## Snapshot eksportu

Opis BEGIN REPEATABLE READ → SELECT pg_advisory_xact_lock → snapshot jest niepoprawny: SELECT blokady sam jest pierwszym query. Snapshot może poprzedzać oczekiwanie na writer. Oficjalny PostgreSQL opisuje zamrożenie przy pierwszym SELECT: [Data Consistency Checks](https://www.postgresql.org/docs/16/applevel-consistency.html), [Transaction Isolation](https://www.postgresql.org/docs/15/transaction-iso.html). Wniosek integratora z dokumentacji: samo przesunięcie SELECT advisorylock przed discovery nie usuwa tego ryzyka.

Kandydat do deterministycznego pomiaru: session advisorylock na przydzielonym client przed BEGIN REPEATABLE READ; transakcja i export po uzyskaniu locka; unlock wfinally, kontrola wyniku i niedopuszczenie zablokowanego client z powrotem do pool. Nie jest to runtimePASS. Alternatywa musi zachować spójny snapshot eksportu i udowodnić absent/existinghold oraz release scenariusze. Zwykłe obniżenie izolacji bez dowodu spójności nie zamyka eksportu.

## Niezmienność historii

Migracja20261030 definiuje account_deletion_request_receipts z NOTNULL/FK do gdpr_requests, organizations, users i bezwarunkowym BEFORE UPDATE OR DELETE reject. Migracja20261034 daje taką samą blokadę execution_budget_delete_receipts. Zatem proposedRETAIN_IMMUTABLE_AND_REBIND wymaga zabronionego UPDATE receipt. Nie wystarczy zachować payload/digest przy zmianie FK.

Autor ma przygotować konkretną macierz rzeczywistych tabel, triggers, references i danych identyfikujących oraz ocenić możliwość zachowania tożsamości niezmiennego receipt z anonimizacją nieaktywnych lifecycle anchors. Nie wolno automatycznie uznać takiego tombstone za pełne usunięcie: wymagane są wiążąca polityka retencji, brak dostępu/loginu/odtwarzania danych i zgodność wszystkich readerów. Nie zmieniono kryterium E4 ani prawa do danych shareduserB. Dowód ma dotyczyć pełnego używanego tenantu, nie tylko tych dwóch tabel.

## Następny krok

Uwagi przekazane istniejącemu C6. Przygotowanie wyłącznie read-only; sloty kodowania zajmują IE00 i W05. Po macierzy root rozstrzygnie techniczny wariant w granicach istniejącego kanonu; rzeczywiście brakującą decyzję retencji należy oddzielić od rutynowych wyborów implementacyjnych. Pełny MVP pozostaje aktywny.
