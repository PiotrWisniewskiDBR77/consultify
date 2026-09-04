# Dyżur 360 — R1: ważność dowodu G19

Data pomiaru: `2026-09-04`. Marker: `2a7273e087cbd3e44344725b524f6ddd79d5badc`.

## Linia bazowa

`node scripts/dev/g19-waznosc-dowodu.mjs --snapshot-date 2026-09-04` zbadał dokładnie 16 wierszy G19: 16 × `NIE_DOTYCZY`, podłoga 16 `OK`, kod wyjścia `0`. Log: `r1-baseline.log`.

Test funkcji eksportowanych: `node --test --test-reporter=spec tests/unit/g19-waznosc-dowodu.test.mjs`: 4 testy, 4 PASS, exit 0.

## Dowód mutacyjny

| Zabezpieczenie | GREEN przed | Mutacja | RED po mutacji | GREEN po przywróceniu |
| --- | --- | --- | --- | --- |
| termin ważności | 4/4, exit 0 | `VALIDITY_DAYS: 7 → 3650` | exit 1; actual `WAZNY`, expected `PASS_STALE` | 4/4, exit 0 |
| wymagane data i SHA | 4/4, exit 0 | brak metadanych zwraca `WAZNY` zamiast `BRAK_DATY_POMIARU` | exit 1; actual `WAZNY`, expected `BRAK_DATY_POMIARU` | 4/4, exit 0 |
| kompletność mianownika | 4/4, exit 0 | usunięto warunek `rows.length >= floor` | exit 1; actual `true`, expected `false` dla jednego modułu | 4/4, exit 0 |

Każda mutacja była wykonana po kopii do `/private/tmp/cx-day360-g19-kubelek-a-scratch`, przywrócona przez `cp`; `git diff -- scripts/dev/g19-waznosc-dowodu.mjs` po przywróceniu był pusty.

## Korekta polecenia testowego

Wymagany plik ma rozszerzenie `.test.mjs`, lecz zastany `vitest.config.ts` obejmuje w `tests/unit` tylko `{js,ts,jsx,tsx}`. Próba Vitest dała `No test files found`, `numTotalTests=0`, exit 1 i nie została uznana za pomiar. Bez zmiany nietykalnej konfiguracji użyto zastanego w repo sposobu dla testów `.mjs`: natywnego `node --test`. Pełne nazwy czterech przypadków są w logu runnera.
