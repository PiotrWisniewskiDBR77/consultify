# My Work dzień 47B — raport dyżuru 2026-08-27

## Stan wykonania

Raport żywy. Gałąź `codex/mywork-day47b-20260828` została utworzona od markera
`b6c4bcb2eb32eeb17076a9c29460a696bd182796` w izolowanym worktree
`/private/tmp/consultify-mywork-day47b`.

## A.2 — bramka wejściowa przeniesiona do nowej linii

Test z ukończonej pozycji A.2 został przeniesiony bez starego raportu i jest
ponownie wykonany na markerze day47B przez realny `ApiGateway`, realne auth,
membership i PostgreSQL `cx_day47`.

Pierwsze uruchomienie z `vitest.golden-flow.config.ts` uczciwie zakończyło się
`No test files found` (kod 1), ponieważ ten config zawiera twardy `include`
innego pliku. Nie zaliczono go jako PASS. Oba właściwe przebiegi rootowego
configu użyły `--retry=0`:

| Tryb   | Wynik              | Istotny werdykt                                                |
| ------ | ------------------ | -------------------------------------------------------------- |
| V8 OFF | 1 plik, 10/10 PASS | osiem tras legacy 200; inbox `404 V8_DISABLED`; bez tokenu 401 |
| V8 ON  | 1 plik, 10/10 PASS | wszystkie dziewięć zakładek 200; bez tokenu 401                |

Pełny runner migracji zastosował 858 migracji, zakończył się bez błędu, a drugi
przebieg zgłosił `Applying migrations: 0`. Odczyt celu połączenia zwrócił
`cx_day47`; tabela `calendar_events` ma 18 kolumn i cztery indeksy.

## Pozycje

| Pozycja | Status          | Commit             |
| ------- | --------------- | ------------------ |
| A.1     | W TOKU          | —                  |
| A.2     | ZROBIONE_WG_DoD | commit tej pozycji |
| B.1–B.6 | NIEZACZĘTE      | —                  |
