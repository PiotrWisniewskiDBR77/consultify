# R3 — dowód mutacyjny

Przyczyna: `server/src/database/PostgresDatabase.ts:1570-1573` (brak serializacji między procesami dla całego `initDb()`; miejsca ujawniające kolizję: `:2666/:2675/:2777/:2804` przed zmianą).

## Mutacja RED

Poprawkę skopiowano do `/private/tmp/cx-day358-scratch/PostgresDatabase.fixed.ts`, usunięto lock, odtworzono kontener `cx-day358-pg`, wykonano pełne migracje dwa razy, a następnie uruchomiono Blok 3 dziesięć razy z `--retry=0`.

Wynik po pełnych nazwach:

- przebieg 01: 12 GREEN / 6 RED;
- przebiegi 02–10: 18 GREEN / 0 RED.

Niestabilność wróciła bez locka.

## Przywrócenie GREEN

Plik przywrócono poleceniem:

`cp /private/tmp/cx-day358-scratch/PostgresDatabase.fixed.ts server/src/database/PostgresDatabase.ts`

Po ponownym odtworzeniu i dwukrotnym zmigrowaniu bazy Blok 3 przeszedł 18/18 GREEN w każdym z 10 kolejnych przebiegów. Każdy JSON zawiera dokładnie 18 przypadków i sześć wpisów `testResults`.

`diff -u evidence/g19/day358/przed-nazwy.txt evidence/g19/day358/po-nazwy.txt` był pusty: nie dodano ani nie zgubiono żadnej pełnej nazwy testu.

