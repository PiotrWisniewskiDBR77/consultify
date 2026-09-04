# R2 — przyczyna źródłowa

## Werdykt

Hipoteza autora instrukcji jest **potwierdzona pomiarem** dla pakietu-świadka `okr.routes.test.ts`.

Oba przebiegi wykonano z katalogu `server/`, na tej samej bazie PostgreSQL po 894 migracjach i idempotentnym drugim przebiegu (0 migracji), z `--config vitest.config.ts`, `--retry=0` i reporterem JSON. Komendy różniły się wyłącznie obecnością `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`.

| Wariant | `numTotalTests` | PASS | FAIL |
| --- | ---: | ---: | ---: |
| `enforce` | 118 | 0 | 118 |
| zmienna nieobecna | 118 | 118 | 0 |

## Gałąź decydująca

`server/src/middleware/resultsInternalBetaVisibility.middleware.ts:27-32` przepuszcza izolowany pakiet testowy tylko wtedy, gdy `NODE_ENV === 'test'` oraz odczyt w linii 29 stwierdza, że `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE !== 'enforce'`. Wariant pomiarowy 336 ustawił `enforce`, więc wyłączył jawny opt-out przeznaczony dla izolowanych testów kontraktu tras; te testy nie tworzą kontekstu członkostwa wymaganego przez realną kopertę.

## Zasięg rodziny

Pełna tabela `r2-rodzina.tsv` obejmuje 19 plików `resultsVnext/__tests__` oraz 28 unikalnych pakietów `10_FINANCE` obecnych w artefakcie serwerowym dyżuru 336. W `09_RESULTS` 3 z 19 plików zawierają lokalne wypisanie się/mok koperty, a 16 z 19 nie. W 28 pakietach `10_FINANCE` nie znaleziono bezpośredniego wypisania po identyfikatorze `resultsInternalBetaVisibility`.

## Pułapki pomiaru

- Pułapka (a): `ENABLE_V8_GLOBAL=true` ustawiono w tej samej linii, więc fałszywe 404 nie zasłoniło trasy.
- Pułapka (b)/(e): przebieg różnicowy jawnie sterował `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE`; 118/118 kontra 0/118 czerwieni dowodzi aktywności gałęzi koperty.
- Pułapka (c): `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres` i jawny `DATABASE_URL` wskazywały wyłącznie `127.0.0.1:6394/cx347`.
- Pułapka (d): `ENABLE_TEST_AUTH_BYPASS=false`, więc uwierzytelnienie nie było samoczynnie wyłączone.
- Ponowienia wyłączono przez `--retry=0`; oba przebiegi wykonały 118 przypadków, więc nie są pustym pomiarem.

