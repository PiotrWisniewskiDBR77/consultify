# R2 — kandydaci

| Kandydat | Komenda / pomiar | Przebiegi | Wynik | Werdykt | Uzasadnienie |
|---|---|---:|---|---|---|
| Równoległy runtime `initDb()` | Blok 3 na świeżej bazie, domyślne `fileParallelism`, reporter verbose | 1 | 12/18; błędy 42701 i 23505 w `PostgresDatabase.ts:2666,2675,2777,2804` | POTWIERDZONY | Równoległe procesy wykonują kolidujące DDL w tym samym katalogu PostgreSQL. |
| Równoległość plików | Blok 3 z `--no-file-parallelism` | 10 | 18/18 w 10/10 | POTWIERDZONY | Serializacja usuwa objaw już na pierwszym przebiegu świeżej bazy. |
| Defekt wewnętrzny day277 | Jeden plik na świeżej bazie | 5 | 2/2 w 5/5 | OBALONY | Bez konkurujących inicjalizatorów day277 nie odtwarza 500. |
| Wyciek połączeń | `pg_stat_activity` co 250 ms podczas równoległego przebiegu; `SHOW max_connections` | 1 | szczyt 16 / limit 100 | OBALONY | Szczyt jest daleko od limitu. |
| Kolejność plików | `server/vitest.config.ts`: brak `sequence.shuffle`; domyślne shuffle=false | 0 dodatkowych | kolejność nie jest losowana | OBALONY | Brak mechanizmu losowania; rozstrzygnięta konfiguracja wskazuje stałą kolejność. |
| Kolejność w beforeEach | `grep -n beforeEach server/src/routes/__tests__/day27*-*.pg.test.ts` | 0 dodatkowych | zero trafień | OBALONY | Badane pliki używają beforeAll, nie beforeEach. |
| Zegar / strefa czasowa | Nie uruchomiono po wskazaniu błędu DDL | 0 | brak pomiaru | NIEROZSTRZYGNIĘTY | R2.1 wskazał przyczynę i nakazał przejście do R3. |

