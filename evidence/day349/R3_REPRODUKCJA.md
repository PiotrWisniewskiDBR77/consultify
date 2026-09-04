# Dyżur 349 — R3: reprodukcja niestabilności

## Migracje i Z30

- Kontener `cx-day349-pg`, `pgvector/pgvector:pg16`, baza `cx349`, host `127.0.0.1:6396`.
- Pierwszy przebieg: `Applying migrations: 894`, `Postgres migrations complete`, exit `0`.
- Drugi przebieg: `Applying migrations: 0`, `Postgres migrations complete`, exit `0` — idempotencja potwierdzona.
- Brak zmiennych `SMTP_`, `RESEND`, `SENDGRID`, `MAIL`; tabela `settings` ma `0 rows` dla `key LIKE 'smtp%'`; `Gateway.ts` nie montuje drenaży.

## Trzy liczby dyżuru 335

- Wiążący surowy `evidence/g19/blok3-marker.json`: `18/11/7`; `day275` zielony.
- Tabela `evidence/g19/day335-r3-maszynowy.md:15`: `18/12/6`.
- Opis `evidence/g19/day335-r4-czerwienie.md:28`: `12/18`, wymienia `day275` jako czerwony.
- `blok3-po.json` nadal istnieje poza repo i ma zgodny cytowany SHA-256 `0df629f348ff0def401a70125a57b59518ce1967096723d822a43bb0d078f0d2`.
- Rozstrzygnięcie: źródła opisują różne przebiegi, a nie jeden wynik. Surowy marker dowodzi `18/11/7` z zielonym `day275`; własna reprodukcja na świeżej bazie dała `18/12/6` z czerwonym `day275`. Dokument `12/18` jest skrótem `12 passed / 18 total`, nie trzecią arytmetyką tego samego JSON-a.

## Własna reprodukcja

Komenda: cwd `server/`, pełny komplet env RealPG/JWT, `--config vitest.config.ts --retry=0`, sześć jawnych plików, JSON `blok3-repro.json`.

Wynik: `18 total / 12 passed / 6 failed`. Czerwone: drugi przypadek `day274`, `day275`, dwa `day276-deck`, dwa `day276-workbook`. `day277` jest `2/2` zielony.

## H1 — równoległość/wyścig

**POTWIERDZONA.** Cztery czerwone pliki uruchomiono osobno na tej samej bazie: `day274 2/2`, `day275 1/1`, `day276-deck 2/2`, `day276-workbook 2/2`. Pełne sześć plików z `--no-file-parallelism` dało `18/18`. Domyślny wspólny przebieg sześciu plików dał `18/12/6`.

## H2 — stan pozostawiony w bazie

**OBALONA dla mierzonego kształtu.** Pliki używają `randomUUID()` lub losowego sufiksu dla organizacji/użytkownika/obiektu i czyszczą własne identyfikatory. Co ważniejsze, wszystkie cztery uruchomienia pojedyncze były zielone na tej samej bazie już po czerwonym przebiegu wspólnym; stan pozostawiony przez poprzedni przebieg nie odtworzył czerwieni. Osobny wariant „drop/recreate i 894 migracje przed każdym plikiem” nie został wykonany, bo nie jest potrzebny do rozróżnienia tego objawu po dodatnim wyniku H1.

## H3 — kolejność plików

**OBALONA jako samodzielna przyczyna.** Kolejność alfabetyczna sekwencyjna (`H1-serial-block.json`) i odwrotna sekwencyjna (`H3-reverse.json`) dały po `18/18`; zmiana kolejności bez współbieżności nie zmienia wyniku.

## H4 — zegar

**OBALONA.** `rg` po sześciu plikach na `Date.now`, `new Date`, `setSystemTime`, `useFakeTimers`, `TZ` zwrócił `H4: BRAK ZALEZNOSCI OD ZEGARA`. Obie sekwencyjne kolejności przeszły bez sterowania czasem.

## Pułapki środowiska

Każdy pomiar miał `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6396/cx349 JWT_SECRET=...` w tej samej linii i `--retry=0`. Każdy JSON ma `numTotalTests > 0`; pomiary nie są wynikiem `No test files found` ani SQLite/mock DB.
