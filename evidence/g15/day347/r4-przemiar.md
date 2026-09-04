# R4 — przemiar po korekcie wariantu pomiarowego

## Wynik główny po pełnych nazwach

| Klasa | Liczba | Pełna lista |
| --- | ---: | --- |
| Nazwy, które zniknęły | 401 | `r4-tabela-trzech-kolumn.tsv`, kolumna 1 |
| Nazwy, które zostały | 141 | `r4-tabela-trzech-kolumn.tsv`, kolumna 2 |
| Nazwy, które się pojawiły | 1 | `r4-tabela-trzech-kolumn.tsv`, kolumna 3 |

Z 542 czerwieni wejściowych zniknęło **401**, zostało **141**. Bieżący przebieg ma dodatkowo jedną nową nazwę, więc raportuje łącznie **142** czerwienie. Pełny diff znajduje się w `r4-przed-po.diff`; porównanie wykonano na dokładnych wierszach `moduł | plik | fullName`.

## Mianowniki per moduł

| Moduł | Total | PASS | FAIL | Pending |
| --- | ---: | ---: | ---: | ---: |
| 01_ORGANIZATION | 18 | 18 | 0 | 0 |
| 02_INTERVIEW | 63 | 50 | 3 | 10 |
| 03_TOOLS | 27 | 21 | 0 | 6 |
| 04_ASSESSMENT | 113 | 113 | 0 | 0 |
| 05_INITIATIVES | 125 | 124 | 1 | 0 |
| 06_EXECUTION | 101 | 101 | 0 | 0 |
| 07_MY_WORK_AGENT | 43 | 41 | 2 | 0 |
| 08_MEETINGS | 33 | 25 | 8 | 0 |
| 09_RESULTS | 567 | 535 | 12 | 20 |
| 10_FINANCE | 277 | 143 | 114 | 20 |
| 11_MATERIALS | 64 | 59 | 1 | 4 |
| 12_AUDITS | 317 | 244 | 1 | 72 |
| 13_CHAT | 67 | 67 | 0 | 0 |
| 14_ADMIN | 3 | 3 | 0 | 0 |
| 16_PARTNER | 7 | 7 | 0 | 0 |
| **Razem** | **1825** | **1551** | **142** | **132** |

Żaden przebieg nie miał zerowego mianownika. `09_RESULTS` zachował 567 przypadków i spadł z 413 do 12 czerwieni. `10_FINANCE` zachował 277 przypadków i pozostał na 114 czerwieniach. Pozostałe 13 modułów zachowały 981 przypadków łącznie.

## Korekta tezy o jednej przyczynie

Jedna przyczyna potwierdzona w R2 usuwa 401 czerwieni w `09_RESULTS`, w tym cały dominujący kształt przedwczesnego 403 w izolowanych kontraktach. Nie usuwa 114 czerwieni `10_FINANCE`. Ich komunikaty wskazują m.in. `ORG_MEMBERSHIP_REVOKED`, więc 59 wystąpień zawierających 403 w artefakcie Finance nie pochodzi z `resultsInternalBetaVisibility`. Teza „415 z 415 ma jedną przyczynę” jest zatem **obalona w części Finance**; wspólna przyczyna obejmuje większość, lecz nie całość kształtu 403.

## Jedna pojawiona nazwa

Pojawił się test `02-interview-serwer.json | interviewAiReviewTimeoutFallback.pg.test.ts | evaluateSessionAnswers server-side timeout — real PostgreSQL HEADLINE: responds within the bound with an explicit, non-fabricated fallback — and the persisted answer is untouched`. Pełny przebieg zmierzył 2005 ms wobec progu `< 2000 ms`. Natychmiastowy diagnostyczny przebieg tego samego pliku, bez zmiany kodu, wykonał 2/2 PASS. Klasyfikacja: niestabilność czasowa poza zakresem zmiany; nie wolno zaliczyć jej do naprawionych ani ukryć. W R5 zostanie `NIEORZECZONA`, jeżeli baza porównawcza nie odtworzy jej stabilnie.

## Pułapki pomiaru

Każdy pakiet miał jawny lokalny `DATABASE_URL`, `RUN_DB_TESTS=1`, `MOCK_DB=false`, `DB_TYPE=postgres`, `NODE_ENV=test`, `ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false`, `JWT_SECRET` i `--retry=0`. Moduły inne niż izolowane kontrakty Results zachowały wariant `enforce` dyżuru 336. `09_RESULTS` i `10_FINANCE` uruchomiono bez `enforce` zgodnie z jedyną świadomą korektą R3; w Finance brak zmiennej nie zmienił wyniku. Reporter JSON dostarczył zarówno `numTotalTests`, jak i pełne `fullName`.

