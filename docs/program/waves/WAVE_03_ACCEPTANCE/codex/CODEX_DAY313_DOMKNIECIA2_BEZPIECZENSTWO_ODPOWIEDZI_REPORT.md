# Dyżur 313 — domknięcia 2 — raport

Stan: **PARTIAL — R1-R4 wykonane, R5 bez pełnego przelotu runtime**. Marker `b3052614547b285ef5840d9c7f9729c6b8498d8e`; gałąź `codex/day313-domkniecia2-bezpieczenstwo-odpowiedzi-20260904`.

## Wejście dosłowne

`MARKER OK`

`b3052614547b285ef5840d9c7f9729c6b8498d8e`

`git status --short` nie zwrócił żadnego wiersza. Dysk: 67 GiB przed utworzeniem worktree. Porty 5304, 5305 i 6323 były wolne. Tip bazowy był przed markerem o commity wypisane w artefakcie sesji; nie wykonano rebase.

## R1

Własne liczby: guard 35 (28+7), szeroki grep 106, mapper 406 wywołań/71 plików, 335 z `undefined`, 0 z `req`; 267 linii i 255 unikalnych klas domenowych. Szczegóły: `../REJESTR_DOMKNIECIA2_20260904.md`.

Pakiet bazowy `RUN_DB_TESTS=0 MOCK_DB=true ... --retry=0 --reporter=json`: 7/7, pełne nazwy w `/private/tmp/cx-day313-domkniecia2-artefakty/przed-nazwy.txt`. Pułapki (a)-(d) nie leżą na ścieżce, bo oba testy są tekstowym/jednostkowym odczytem bez Gateway i DB; pułapka (e) dotyczy mianownika i została wyłączona przez niezależny kontrolny grep oraz reprodukcję algorytmu guardu.

## R2

Codemod `scripts/dev/codemod-day313-raw-response-leaks.mjs` zmienił dokładnie 35 odpowiedzi w dwóch licencjonowanych plikach; logi pozostały nietknięte. `REMAINING_LEAK_BASELINE` zmalał 35 → 0. `details` ze stringiem usunięto, a `error`, `errorCode` i `correlationId` daje mapper. Oba pliki przeszły esbuild.

Guard końcowy: 3/3. Niezależny ratchet innych zapisów ma zmierzony zastany baseline 44; nie jest deklarowany jako dług zamknięty.

Dowody mutacyjne, każdy `--retry=0`:

| Mutacja innego kształtu | RED | Artefakt |
| --- | --- | --- |
| `error: String(e)` | 2 pass / 1 fail | `r2-mutation-string-e-red.json` |
| `res.send(err.stack)` | 2 pass / 1 fail | `r2-mutation-stack-red.json` |
| `details: e?.message` | 2 pass / 1 fail | `r2-mutation-optional-red.json` |
| cofnięcie mutacji | 3 pass / 0 fail | `r2-final-green.json` |

Pułapki (a)-(d) nie dotyczą tekstowego guardu bez Gateway/DB. Pułapki (e1-e4) wyłączono przez: własny mianownik, trzy różne od naprawianego zapisy, kontrolny grep i zachowanie logów. Po każdym cofnięciu produkt odtwarzano przez `cp` z kopii w scratchu; nie użyto stash/reset.

## R3

Cztery imienne klasy dziedziczą teraz `AppError`, mają `isOperational`, `statusCode` i jawny kod. Statusy pozostają: OKR 409, Finance status konstruktora, Template 404, capability denial 403. Dla `TemplateNotFoundError` mapper zwraca biznesowy komunikat i `errorCode: NOT_FOUND`, nie `INTERNAL`.

Testy R3 + mapper: 10/10. Ratchet pozostałej rodziny: 251 unikalnych eksportowanych klas `extends Error`. Mutacja usuwająca dziedziczenie/status z `TemplateNotFoundError`: 3 pass / 1 fail (`r3-mutation-no-status-red.json`); po cofnięciu 4/4 (`r3-final-green.json`).

Pakiet jest czysto jednostkowy (`RUN_DB_TESTS=0 MOCK_DB=true`), zatem pułapki Gateway/DB/auth (a)-(d) nie leżą na ścieżce. Pułapka (e6) jest sednem testu: operacyjność i kod są asertowane per klasa, a pozostała rodzina jest spięta osobnym ratchetem zamiast masowej zmiany.

## R4

AST-owy `scripts/dev/codemod-error-mapper-req.mjs` zmierzył 255 kwalifikujących się wywołań w 43 plikach oraz 112 wywołań bez parametru `req` w najbliższym zakresie funkcji. Zmiany wykonano w pięciu grupach: 10+10+10+10+3 pliki, z esbuildem każdego pliku i osobnym commitem. Po zmianie AST: kwalifikujące się 0, bez `req` 112. Pełna lista pozostawionych: `/private/tmp/cx-day313-domkniecia2-artefakty/r4-bez-req.txt`, SHA-256 `f3dcc3e8c52fd04f007df3b979d179899ca29b07ed745cbc3b202dd6f75d9687`.

Test R4 + mapper: 7/7. Żądanie z `Accept-Language: pl-PL` daje polski bezpieczny komunikat, bez nagłówka angielski. Mutacja jednego wywołania `req → undefined`: 1 pass / 1 fail (`r4-mutation-undefined-red.json`); po cofnięciu 2/2 (`r4-final-green.json`).

Pułapki (a)-(d) nie leżą na ścieżce tego czysto jednostkowego/statycznego pakietu; nie jest on dowodem Gateway/RealPG. Pułapka (e) jest wyłączona analizą AST zakresu, listą 112 wyjątków i mutacją pojedynczego wywołania.

## R5 — PARTIAL / NOT_PROVEN runtime

Zaimplementowano trzy bezpiecznie rozstrzygnięte zmiany:

- `adaptQuery()` tłumaczy znalezione kształty: zwykły, separator i `DISTINCT`; test 3/3;
- migracja `20261913_imported_reports_coverage_percent.sql` dodaje istniejącej tabeli wyłącznie brakującą kolumnę; przebiegi po dodaniu: 1, następnie 0; readback potwierdził `real DEFAULT 0`;
- `/api/admin/service-accounts` odrzuca nie-UUID organizacji/użytkownika kodem 400 przed pierwszym SQL. To jedyna zadeklarowana zmiana HTTP 500→400.

Nie wykonano wymaganego pełnego przelotu ośmiu tras przez realny ApiGateway, podpisany JWT i RealPG ani mutacji walidacji identyfikatora. Dlatego żadnej z ośmiu tras nie oznaczam `VERIFIED`, a pięć nienazwanych przyczyn pozostaje `UNKNOWN`. Test adaptacji jest jednostkowy; pułapki (a)-(d) nie dotyczą go, ale właśnie dlatego nie dowodzi runtime. Migracje użyły jawnego `DATABASE_URL` 127.0.0.1:6323/cx313 i kompletnego env; nie użyto mocka.

### STOP — R5 pełny przelot

Rodzaj: MERYTORYCZNY

Powód: bez ukończenia nowego ośmiotrasowego pakietu `.pg.test.ts` nie ma dowodu, że trzy zmiany usuwają 500 ani diagnozy pozostałych pięciu.

Licencja, którą sprawdziłem: nowe `.pg.test.ts` są dozwolone, lecz dowód wymaga pełnej ścieżki ApiGateway/JWT/PG i mutacji; nie zastępuję jej gołym routerem.

Dowód: sekcja R5 instrukcji oraz brak nowego pakietu `.pg.test.ts` w diffie.

Co dostarczyłem ZAMIAST zmiany: trzy ograniczone poprawki, test kształtów SQL, dwa przebiegi migracji i jawny status `NOT_PROVEN` dla tras.

Co zrobiłbym dalej: zbudował jeden pakiet Gateway z fixture użytkownika/organizacji UUID, zapisał kody i ciała PRZED/PO wszystkich ośmiu tras, a następnie wykonał mutację walidacji UUID.

Rekomendacja dla nadzorcy: nie scalać R5 jako zamknięcia ośmiu 500 bez brakującego przelotu; R2-R4 można oceniać niezależnie.

Stan: zacommitowano częściowo w commicie R5.

Czy kontynuowałem pozostałe pozycje: TAK — R6 raport i porównanie nazw.

## R6 — wynik i zasięg

Pakiet końcowy czysto jednostkowy/statyczny: **18/18**, 0 failed. Pakiet regresji serwerowych uruchomiony z cwd `server/`: 151 przypadków, 134 passed, 17 skipped, 0 failed. Skipped nie są liczone jako dowód runtime.

Porównanie pełnych nazw bazowych testów dało 11 nazw dodanych i **0 nazw znikniętych**. Diff: `/private/tmp/cx-day313-domkniecia2-artefakty/przed-po-nazwy.diff`, SHA-256 `60cdb41d50bf34053f3bc19d3236b70656912673af42052a8f5a99dbb3438d7b`; `po-nazwy.txt` SHA-256 `d7ec9ba0ab85e3b62776c9d447068903a4314eb091f9a4058049bd082073716e`.

### Bilans

| Pozycja | Stan | Dowód |
| --- | --- | --- |
| R1 | WYKONANE z jawnym ograniczeniem runtime | własne mianowniki, rejestr i artefakty |
| R2 | WYKONANE | 35→0, trzy mutacje RED, final GREEN |
| R3 | WYKONANE | cztery klasy, ratchet 251, mutacja RED→GREEN |
| R4 | WYKONANE | 255 zmian/43 pliki, 112 wyjątków, 5 grup, mutacja RED→GREEN |
| R5 | PARTIAL / NOT_PROVEN | trzy poprawki; brak ośmiotrasowego Gateway/JWT/PG i mutacji UUID |
| R6 | WYKONANE | raport, D14 dopisany, nazwy testów porównane |

Łącznie gałąź zawiera 10 commitów R1-R5 przed finalnym commitem raportu. Nie wykonano pushu do `origin`, rebase, stash, reset, Railway ani połączenia z bazą inną niż lokalny kontener `cx-day313-pg`.

## Bezpieczeństwo wysyłki

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## TWIERDZENIA NIEZWERYFIKOWANE

- Osiem kodów i ciał odpowiedzi przez ApiGateway/JWT/RealPG: oczekują na R5.
- Osiągalność runtime całej rodziny 255 klas: poza czterema klasami R3 pozostaje ratchet/inwentarz, nie twierdzenie o wykonaniu.
- R5 pozostaje `PARTIAL`; R6 kończy raport i dowody nazw testów.
