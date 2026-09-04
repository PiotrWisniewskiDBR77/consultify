# CODEX DAY 312 — domknięcia po odbiorach

Stan: **PARTIAL / prawo zatrzymania po pozycji 296**.

## Baza i marker

`git log --oneline -25 github-backup/grafika/m03-20260902` rozpoczął się od:

```text
3ce22596ed docs: sprostowanie — staging 120bb2db81, 312 na kopii, lancuchy do ponownego startu
5ca52226c3 Merge agent/przekazanie-noc-2-20260903
```

Weryfikacja markera:

```text
MARKER OK
```

Sanity nowego worktree:

```text
763856d76b4f03acba8fe9b3d5a8a375ffe22ebd
```

`git status --short | head -3` był pusty.

## R0

Przeczytano w całości cztery odbiory adwersaryjne wskazane w instrukcji. Istniejące worktree i historie potwierdzone. Liczby commitów ponad wspólnym przodkiem: 292=0, 293=0, 296=2, 297=1. Dysk przy starcie: 32 GiB wolne; po materializacji: 26 GiB. Porty 5302, 5303 i 6319 były wolne; kontenerów `cx-day312` było 0.

Korekta wobec instrukcji: stan roboczy 293 i 296 nie był czysty. 293 zawiera zastany, niecommitowany WIP pięciu plików. 296 zawiera zastany, niecommitowany WIP 73 plików, w tym 71 tras po codemodzie. Nie odrzucono ani nie nadpisano tych zmian.

## Pozycja (a) — 296 wycieki

Własny pomiar bieżącego drzewa 296:

- surowy wzorzec: 1 trafienie, wyłącznie komentarz testu `server/src/routes/__tests__/presentations.error-disclosure.test.ts`;
- wołania `appErrorMapper|mapAppErrorResponse` poza testem i mapperem: 341;
- zmienione trasy: 71; `esbuild`: 71/71 OK;
- `git diff --check`: bez błędów;
- mapper: 5/5 pełnych nazw PASS z właściwego cwd `server/`; wcześniejszy przebieg z roota odkrył 0 testów i nie został uznany za dowód.

Dodano `tests/unit/backend/security/noRawErrorMessage.test.ts`, commit lokalny `89619c1adf`. Dowód mutacyjny: przywrócenie jednej odpowiedzi `error: err.message` dało `rc=1`; po cofnięciu przez kopię pakiet wrócił na GREEN. Mutacja została cofnięta, `git diff --check` pozostaje czysty.

### STOP — (a) 296

Rodzaj: MERYTORYCZNY.

Powód: zastany WIP zamienia rodzinę mechanicznie, ale wszystkie 341 wołań przekazują do mappera `undefined` zamiast `req`; korelacja może pochodzić z `RequestStore`, natomiast dobór polskiego komunikatu z `Accept-Language` nie jest dowiedziony i przy tym kształcie domyślnie wybiera angielski.

Licencja, którą sprawdziłem: R3 pozwala na codemod i zmiany `server/src/routes/**`; R4 pozwala na nowy `tests/unit/backend/security/noRawErrorMessage.test.ts`. Z40 wymaga zachowania kształtu odpowiedzi i nie pozwala osłabiać testów.

Dowód: `appErrorMapper.ts` wybiera język przez `req?.get?.('Accept-Language')`; diff tras zawiera 341 wywołań `mapAppErrorResponse(..., undefined, ...)`.

Co dostarczyłem ZAMIAST zmiany: zweryfikowany guard baseline zero z dowodem mutacyjnym oraz pełny pomiar kompilacji 71 tras. Nie zacommitowałem niezweryfikowanego WIP codemodu.

Co zrobiłbym, gdyby zapadła decyzja X: codemod musi rozróżnić handlery z leksykalnym `req` od helperów bez `req`, przekazać żądanie tam, gdzie istnieje, a helperom dostarczyć jawny kontekst językowy. Następnie wymagany jest realny HTTP `pl/en` przez `ApiGateway` oraz dopiero potem commity grupami po 10 plików.

Rekomendacja dla nadzorcy: nie scalać niecommitowanego WIP 296 i nie zamykać rejestru wycieków. Zachować commit guardu `89619c1adf` jako niezależny bezpiecznik.

Stan: zacommitowano częściowo w `89619c1adf`; 73 pliki WIP pozostają niecommitowane.

Czy kontynuowałem pozostałe pozycje: NIE — skorzystano z prawa zatrzymania po pozycji 296; plik postępu wskazuje pięć pozycji jako nierozpoczęte.

## Pułapki dowodowe

Pakiety były czysto jednostkowe (`RUN_DB_TESTS=0 MOCK_DB=true`), nie dowodzą PostgreSQL ani produkcyjnego HTTP. Nie dotyczyły `ENABLE_V8_GLOBAL`, membership ani auth bypass. Dowód runtime nie został wykonany i nie jest deklarowany. Nie uruchomiono `server/src/index.ts`, drenaży ani jakiejkolwiek wysyłki.

## TWIERDZENIA NIEZWERYFIKOWANE

- Brak realnego HTTP przez `ApiGateway`, JWT i PostgreSQL dla 296.
- Brak par 10 tras PRZED/PO oraz logów korelacji.
- Brak testu kontraktowego ośmiu tras AI.
- Brak commitów grupowych codemodu i aktualizacji kolumny PO rejestru.
- Pozycje 297, 293, 292, 298 i 295 nie zostały rozpoczęte w tym przebiegu.
