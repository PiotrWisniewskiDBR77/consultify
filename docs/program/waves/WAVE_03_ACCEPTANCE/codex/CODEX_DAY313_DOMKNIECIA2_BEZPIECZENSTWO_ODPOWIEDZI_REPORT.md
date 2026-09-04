# Dyżur 313 — domknięcia 2 — raport

Stan: **W TOKU**. Marker `b3052614547b285ef5840d9c7f9729c6b8498d8e`; gałąź `codex/day313-domkniecia2-bezpieczenstwo-odpowiedzi-20260904`.

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

## Bezpieczeństwo wysyłki

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## TWIERDZENIA NIEZWERYFIKOWANE

- Osiem kodów i ciał odpowiedzi przez ApiGateway/JWT/RealPG: oczekują na R5.
- Osiągalność runtime całej rodziny 255 klas: poza czterema klasami R3 pozostaje ratchet/inwentarz, nie twierdzenie o wykonaniu.
- R5-R6: oczekują na kolejne commity i dowody mutacyjne.
