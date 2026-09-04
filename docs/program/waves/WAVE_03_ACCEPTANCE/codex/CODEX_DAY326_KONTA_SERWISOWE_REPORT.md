# CODEX DAY 326 — konta serwisowe

Data: 2026-09-04  
Marker: `1c3d3da844ae03c87985a8f5dc74846a073c0220`  
Gałąź: `codex/day326-konta-serwisowe-20260904`

## Werdykt

Teza „cały moduł przestaje działać” jest **OBALONA**. Na realnym łańcuchu `ApiGateway → verifyToken → router → PostgreSQL` organizacja UUID listuje realny wiersz (`200`), tworzy konto (`201`) i usuwa je (`204`). Defekt dotyczył organizacji spoza UUID: `system` istnieje w świeżej bazie, a zapisy wpadały w błąd typu UUID.

| Pozycja | Werdykt                                                                                                                           | Commit         |
| ------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| R1      | PARTIAL: macierz zmierzona, producent `500` nazwany; niemożliwy realny wiersz dla `system` z powodu `uuid` w tabeli kont          | `179fd2d65d`   |
| R2      | PARTIAL / STOP MERYTORYCZNY: POST/DELETE i błędy wewnątrz routera naprawione; wcześniejsze `401` pozostaje czerwone poza licencją | `a9d23a8215`   |
| R3      | ZROBIONE: strażnik rozpoznaje callbacki i mutacja czerwieni 47→48                                                                 | `d417f1c505`   |
| R4      | ZROBIONE: seed `system` potwierdzony                                                                                              | `169c19f744`   |
| R5      | ZROBIONE: pomiar tekstowy i AST                                                                                                   | `373033c435`   |
| R6      | ZROBIONE: ten raport                                                                                                              | bieżący commit |

Nie wpisuję `FIXED` ani `VERIFIED` dla całego R2, ponieważ pełny kontrakt każdej odpowiedzi błędu pozostaje czerwony.

## Stan wejściowy

Wynik markera, dosłownie:

```text
1c3d3da844 Merge codex/day314 (odbiór adwersaryjny: SCALIC; POKAZAC WLASCICIELOWI — ale parami odbiorcy, nie z raportu)
MARKER OK
```

Sanity worktree, dosłownie:

```text
1c3d3da844ae03c87985a8f5dc74846a073c0220
```

`git status --short | head -3` nie wypisał nic. Marker był przodkiem tipa; start nastąpił dokładnie z markera. Tip zawierał wyłącznie późniejsze dokumenty instrukcji 324–333 i źródła ich generatora, wymienione w `input-verification.txt`.

Wolny dysk przed utworzeniem worktree: 84 GiB. Porty 5492 i 6352 były puste, liczba kontenerów `cx-day326`: 0.

## Migracje i stan świeżej bazy

Obraz: `pgvector/pgvector:pg16`, kontener `cx-day326-pg`, baza `cx326`, loopback `6352`.

```text
Applying migrations: 893
✅ Postgres migrations complete
Applying migrations: 0
✅ Postgres migrations complete
```

Odczyt wykonany przed pierwszym własnym zapisem:

```text
   id   |  name  | status
--------+--------+--------
 system | System | active
(1 row)
```

## R1 — macierz przed zmianą

Każda komórka została wywołana jako para: obcy token z `orgId` celu oraz token właściciela celu. Dla UUID użyto realnych wierszy z SQL readbackiem.

| Metoda | org UUID                                                               | org spoza UUID (`system`)                                             |
| ------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------- |
| GET    | obcy `403`; właściciel `200` z realnym `day326-get-uuid`               | obcy `403`; właściciel `200 data: []`                                 |
| POST   | obcy `403`; właściciel `201`, token i realny `day326-post-uuid`        | obcy `403`; właściciel `500`, parser `{}`, stan bez zmian             |
| DELETE | obcy `403`; właściciel `204`, realny wiersz istniał przed i zniknął po | obcy `403`; właściciel `500`, parser `{}`, chroniony wiersz bez zmian |

Wymaganie „właściciel widzi realny wiersz” dla `system` jest niewykonalne bez zmiany schematu: `organizations.id` ma typ `text`, a `tp_service_accounts.organization_id` ma typ `uuid`. Próba zapisu `system` daje `invalid input syntax for type uuid`. Nie wstawiono atrapy ani zastępczego identyfikatora.

### Kto produkuje `500` z pustym ciałem

Producentem jest domyślny handler błędów Express/finalhandler, nie `server/src/utils/ErrorHandler.ts`. `asyncHandler` przekazuje wyjątek przez `next(error)`. `ApiGateway.initializeRoutes(app)` montuje routery, ale nie globalny `errorHandlerMiddleware`; ten jest montowany dopiero przez `server/src/index.ts`, którego zgodnie z Z30 nie uruchamiano. Finalhandler zwraca HTML z surowym stosem. Supertest dla `text/html` prezentuje `response.body` jako `{}` — stąd pozornie puste ciało.

## R2 — wynik i czerwony kontrakt

W licencjonowanym routerze dodano:

- bramkę `validateUUID` dla POST i DELETE: `400 INVALID_IDENTIFIER` przed SQL;
- lokalne uzupełnianie odpowiedzi błędów o `errorCode` i `correlationId`;
- lokalny awaryjny handler `500` z ogólnym `INTERNAL_ERROR`, bez surowego komunikatu.

RealPG potwierdza ciągłość UUID: GET `200` z realnym wierszem, POST `201` i SQL readback, DELETE `204` i brak w readbacku. RealPG potwierdza blokadę `system`: POST i DELETE `400`, kompletna koperta, brak zmiany bazy.

Pełny próg nie jest osiągnięty. Niezalogowane żądanie jest przechwytywane przez wcześniejszy szeroki router `/api/admin` i odpowiada `401 {"error":"No token provided"}` zanim wejdzie do routera kont serwisowych. Czerwony test `KONTRAKT DLA DYŻURU 326 — wcześniejsza odpowiedź 401 ma pełną kopertę` pozostaje celowo czerwony. Zmiana wymagałaby `Gateway.ts` albo wcześniejszego routera, poza licencją.

### STOP — R2 pełna koperta 401

Rodzaj: MERYTORYCZNY  
Powód: wcześniejszy mount `/api/admin` odpowiada przed licencjonowanym routerem.  
Licencja, którą sprawdziłem: `Gateway.ts` i bramki są TYLKO DO ODCZYTU; produkt zastępczy to czerwony kontrakt + brief.  
Dowód: `final-realpg-full.json`: 9 PASS, 1 FAIL; ciało `{"error":"No token provided"}`.  
Co dostarczyłem ZAMIAST zmiany: czerwony kontrakt oraz działającą naprawę wszystkich osiągalnych gałęzi w routerze kont.  
Co zrobiłbym, gdyby zapadła decyzja X: zamontowałbym path-specific normalizer przed szerokimi routerami admin albo uporządkował kolejność mountów i ponownie zmierzył wszystkie admin routes.  
Rekomendacja dla nadzorcy: osobny dyżur przekrojowy dla kopert błędów wcześniejszych mountów `/api/admin`; promień rażenia obejmuje inne trasy administracyjne.  
Stan: zacommitowano częściowo w `a9d23a8215`.  
Czy kontynuowałem pozostałe pozycje: TAK; R3–R6 są rozłączne.

### Mutacja R2

Kopia została wykonana przez `cp`. Po usunięciu wyłącznie bramki POST:

```text
r2-mutation-red.json: success=false, failed=1
expected 500 to be 400
```

Po przywróceniu przez `cp`:

```text
r2-mutation-green.json: success=true, passed=1, failed=0
diff kopia ↔ przywrócony plik: pusty
```

## R3 — strażnik

`caughtIdentifiers()` rozpoznaje `catch (x)`, `.catch((x) => ...)`, `async`, parametr typowany oraz `.catch(function (x) {...})`. Zakres skanu i progi 44/47 nie zostały zmienione.

```text
r3-final-green.json: 5/5 PASS
r3-mutation-red.json: 4 PASS, 1 FAIL; dług 48 > 47
r3-mutation-green.json: 5/5 PASS
```

Mutacja była dokładnie `.catch((problem) => res.json({ error: problem.message }))`; cofnięto ją przez `cp`, a diff kopii i pliku po cofnięciu był pusty.

## R4 i R5

`system` realnie istnieje po migracjach. Nie ma dziury seeda w badanym markerze; jest za to potwierdzona niespójność typów `text`/`uuid`.

Mianowniki tekstowe: 267 `.catch(` i 251 `.catch((` według grepu instrukcji. Pomiar AST (inna jawna definicja): 264 wywołania `.catch`, 255 callbacków zaczynających się nawiasem; 1 zawiera odpowiedź HTTP, 66 logger, 1 oba, 189 żadne. Surowa treść błędu: 28 wyłącznie do loggera, 0 do HTTP. Jedyny callback z loggerem i odpowiedzią loguje surowy komunikat, ale klientowi daje stały `SCHEMA_CHECK_FAILED`.

## Testy i pułapki §0.2e

| Pakiet                                  | Wynik                 | Pułapki i wyłączenie                                                                                                                                                                                                                                                                                                           |
| --------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| istniejący route unit                   | 5/5 PASS              | czysty mock; nie jest dowodem DB ani auth; właściwy config uruchomiono z cwd `server`                                                                                                                                                                                                                                          |
| Day326 RealPG, bez czerwonego kontraktu | 9 PASS, 1 pominięty   | (a) `ENABLE_V8_GLOBAL=true`; (b) `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`; (c) `MOCK_DB=false DB_TYPE=postgres` plus asercje env i `assertRealPostgresTestEnvironment()` bez argumentów; (d) `ENABLE_TEST_AUTH_BYPASS=false`; (e) para obcy/właściciel, podpisany JWT, realne wiersze/readback; zawsze `--retry=0` |
| Day326 RealPG pełny                     | 9 PASS, 1 celowy FAIL | te same wyłączenia; czerwony kontrakt dowodzi wcześniejszego `401`                                                                                                                                                                                                                                                             |
| strażnik wycieków                       | 5/5 PASS              | czysto statyczny, bez DB/auth; skan pełnego `server/src/routes`, bez zawężenia                                                                                                                                                                                                                                                 |

`npx tsc -p server/tsconfig.json --noEmit --pretty false` zakończył się kodem 0. ESLint dla zmienionego routera i nowego testu RealPG zakończył się kodem 0; plik strażnika jest jawnie ignorowany przez bieżącą konfigurację ESLint, więc jego dowodem jest pakiet 5/5 i TypeScript.

Każda komenda DB miała w tej samej linii `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6352/cx326`; HTTP dodatkowo pełny zestaw flag i `JWT_SECRET`. Żaden przebieg ataku nie miał retry.

## Zasięg testów po pełnych nazwach

Przed: 9 nazw (5 niezmienionych przypadków route unit + 4 strażnika). Po: 20 nazw. Dodano 10 przypadków Day326, w tym jawny czerwony kontrakt, oraz 1 przypadek parsera callbacków. Nie zniknęła żadna nazwa. Pełny diff: `/private/tmp/cx-day326-konta-serwisowe-artefakty/nazwy.diff`.

Pierwsza literalna komenda z `server/vitest.config.ts` wykonana z roota odkryła 0 testów i ma `success:false`; nie została uznana za PASS. Poprawny przebieg wymagał cwd `server`, ścieżki `src/...` i `--config vitest.config.ts`. Plik istniejącego testu nie zmienił się między markerem a HEAD, dlatego jego 5 nazw odtworzono poprawną komendą przy końcowym pomiarze i włączono do mianownika „przed”.

## Z30 — brak wysyłki

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

Dowody: `BRAK ZMIENNYCH POCZTY`, zapytanie `settings WHERE key LIKE 'smtp%'` zwróciło 0 wierszy, grep drenów w `Gateway.ts` zwrócił 0 trafień.

## Korekty wobec instrukcji

1. Komenda §0.2c(B) jest uszkodzona składniowo (zawiera zagnieżdżone komendy i opis prose po `npx vitest run`). Użyto osobnych paste-ready komend z pełnym env.
2. `server/vitest.config.ts` z roota dał 0 testów; poprawna lokalizacja wykonania to cwd `server`.
3. §R.2, do którego odsyła R6, nie występuje w 1008-liniowym dokumencie. Zastosowano wszystkie jawnie wymienione obowiązkowe sekcje R6.
4. Wymóg realnego wiersza dla `system` koliduje z typem `uuid` w `tp_service_accounts`; zapisano pomiar zamiast atrapy.
5. Założenie, że każdą kopertę błędu można naprawić w licencjonowanym routerze, obala wcześniejszy mount `/api/admin`; pozostawiono czerwony kontrakt.
6. Liczba migracji własnego pomiaru to 893, nie przywołane w tekście zlecenia 891.

## Rozłączność i pliki

Zmodyfikowane ścieżki przed raportem:

```text
docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_KONT_SERWISOWYCH_20260904.md
server/src/routes/__tests__/service-accounts.day326.pg.test.ts
server/src/routes/admin/service-accounts.routes.ts
tests/unit/backend/security/noRawErrorMessage.test.ts
```

Po dodaniu raportu dochodzi wyłącznie niniejszy plik. Diff `.env*`, `docker-compose*`, `railway*` jest pusty. Nie zmieniono migracji, frontu, `Gateway.ts`, `ErrorHandler.ts`, walidatora ani middleware bezpieczeństwa. Liście tłumaczeń bez zmian: PL 35198, EN 33065.

## Artefakty i sumy SHA-256

Katalog: `/private/tmp/cx-day326-konta-serwisowe-artefakty`.

- `service-accounts-r1-matrix.json`: `c4ecd4846d1bd9c3e2f1fb8e7c90c9ed067d0d921898d78557f63330a0bf9c86`
- `final-realpg-full.json`: `39bb9ebf500caa58c4b0c695eb77b9505dc282aaa29972d1f9c2b1dc95a88829`
- `final-realpg-green.json`: `c91390d50e173fabeec985d7b3b39edab9708d9d14ea84d03b73687e15c91a8d`
- `final-security.json`: `1b56f90b234ed2304382f238d65275688a2e732ab23bb811199f5e2f2d5e1175`
- `r2-mutation-red.json`: `c05a20132b264edc8d8a1bb9ef989f8b317378790c2d850f8debb39af291117f`
- `r2-mutation-green.json`: `e18dfeadd48d3126b745acba51471e0de882b29ef33f593eaa9477166d3a6496`
- `r3-mutation-red.json`: `d4bbc1a074d162e558aea330e945ceff9923fd8e0de2282fd737f3c4b8833870`
- `r3-mutation-green.json`: `747345391b2e0d3679538d725e1d16d7f227ae5a7396044374d8bdeb71c12292`
- pełna lista: `SHA256SUMS`.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie uruchomiono pełnego `server/src/index.ts`; nie twierdzę, że produkcyjny globalny `ErrorHandler.ts` zachowuje się identycznie jak wymagany harness ApiGateway.
- Nie zmierzono produkcji, demo, stagingu ani Railway; obowiązywał bezwzględny zakaz połączeń.
- Nie zmierzono zachowania wszystkich pozostałych tras pod szerokimi routerami `/api/admin`; czerwony `401` może mieć szerszy promień rażenia.
- Nie wymuszono realnie gałęzi `409` i `503 AUDIT_UNAVAILABLE` w RealPG bez ingerencji w infrastrukturę; normalizer obejmuje je kodowo, ale to nie jest dowód runtime tych dwóch gałęzi.
- Nie ma dowodu UI ani konsumenta frontowego; front był tylko do odczytu i nie był potrzebny do kontraktu HTTP.
- R1 i R2 nie spełniają pełnego DoD z powodów opisanych wyżej; nie należy ich promować jako pełne `VERIFIED`.
