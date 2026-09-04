# CODEX DAY 325 — komunikaty biznesowe po polsku

Stan bazowy: marker `1c3d3da844ae03c87985a8f5dc74846a073c0220`, gałąź robocza
`codex/day325-komunikaty-pl-20260904`.

## R1 — jedno źródło prawdy komunikatu

Werdykt: **serwer jest jedynym źródłem prawdy tekstu komunikatu biznesowego**.

Uzasadnienie na markerze:

- `AppError.isOperational` jest ustawiane bezwarunkowo na `true`; zmierzono 203 wywołania
  `new AppError(` poza testami. `OPERATIONAL_MESSAGES` ma 4 kody, więc serwer musi centralnie
  rozliczać komunikaty operacyjne zamiast pozostawiać surowy angielski tekst w 203 miejscach.
- przeglądarka nie pozwala wiarygodnie ustawić `Accept-Language`, lecz front już wysyła
  `X-App-Language`, a CORS go dopuszcza. Serwer może więc wybrać język, czytając najpierw
  `X-App-Language`, a potem `Accept-Language`.
- `readAppErrorCode` zna 7 kodów i nieznany kod sprowadza do `INTERNAL`. Dlatego front nie może
  wybierać tekstu `INTERNAL`, gdy koperta zawiera konkretny komunikat serwera.

**W związku z tym po drugiej stronie PRZESTAJEMY zastępować komunikat dostarczony przez serwer
tekstem katalogowym `INTERNAL`; front zachowuje tylko angielski fallback na przypadek, gdy serwer
nie dostarczył żadnego komunikatu.** Nie tworzymy drugiego słownika tych samych komunikatów we
froncie.

### Pomiar wejściowy

```text
1c3d3da844ae03c87985a8f5dc74846a073c0220
status --short: pusty
MARKER OK
mapAppErrorResponse(: 378
mapAppErrorResponse(..., undefined: 106
MESSAGES / OPERATIONAL_MESSAGES: 7 / 4
new AppError( poza __tests__: 203
handleResponse(res, w src/services/api.ts: 1003
```

Tip `github-backup/grafika/m03-20260902` uciekł do przodu wyłącznie o pakiet instrukcji
dyżurów 324–333; zgodnie z `DEC-2026-08-26-95` praca pozostaje na markerze.

## Korekty wobec instrukcji

- `§0.2b(2)` wymaga dowodów przed pierwszym przebiegiem zapisującym, ale dowód z tabeli
  `settings` jest wykonalny dopiero po migracjach, a `§0.2c(A)` nakazuje migracje przed pomiarem.
  Wybrano bezpieczniejszą interpretację: nie ustawiono konfiguracji poczty, uruchomiono wyłącznie
  migracje, a natychmiast po nich potwierdzono brak zmiennych pocztowych, 0 rekordów `smtp%` i brak
  drenów w `Gateway`.
- Dokument odwołuje się do struktury `§R.2`, lecz w odczytanym pliku (1019 linii) nie ma sekcji
  definiującej tę strukturę. Raport zachowuje wszystkie jawnie wymienione obowiązkowe elementy R6.
- Komenda serwerowa z `B.2` uruchomiona z roota i ścieżkami `server/src/...` dała 0 suit,
  `success:false`. Po korekcie rootu (`cd server`, ścieżki `src/...`) runner znalazł 145 testów,
  ale wszystkie były czerwone przez wymuszoną bramkę członkostwa: zastane suity montują goły
  `express()` i atrapę auth, bez realnej bazy członkostwa. Wynik nie został nazwany PASS.

## R2 — przekazanie języka

### STOP — R2

Rodzaj: MERYTORYCZNY

Powód: `handleOkrRouteError(res, err, op)` i `handleScorecardRouteError(res, err, op)` nie mają
parametru `req`; wykonanie zamówionej zamiany `mapAppErrorResponse(err, undefined, ...)` na `req`
wymaga najpierw zmiany sygnatur handlerów i wszystkich ich wywołań, czego wąska licencja B.1
nie dopuszcza.

Licencja, którą sprawdziłem: B.1, trasa (tył) — „WYŁĄCZNIE zamiana `undefined` na `req` w
wywołaniach `mapAppErrorResponse(...)`”; wszystkie inne pliki domyślnie tylko do odczytu, a przy
potrzebie szerszej zmiany produktem jest czerwony kontrakt + brief.

Dowód: `server/src/routes/resultsVnext/okr.routes.ts:360` oraz
`server/src/routes/resultsVnext/kpiScorecard.routes.ts:208`; realny kontrakt
`day325.komunikaty-pl.gateway.pg.test.ts` przez `ApiGateway`, podpisany JWT i PostgreSQL:

| kod | trasa | `X-App-Language: pl` | bez nagłówka | `errorCode` przed/po |
| --- | --- | --- | --- | --- |
| `PROGRAM_NOT_ACTIVE` | `POST /api/vnext/results/okr/cycles` | 409, `The OKR program is not active, so a new cycle cannot be opened.` (CZERWONY) | 409, ten sam tekst angielski (ZIELONY) | `PROGRAM_NOT_ACTIVE` / `PROGRAM_NOT_ACTIVE` |

Readback: liczba cykli przed i po czerwonym żądaniu była identyczna. `DB_TYPE=postgres` zostało
potwierdzone asercją w pierwszym kroku `beforeAll`; `assertRealPostgresTestEnvironment()` wywołano
bez argumentów. `ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false` i
`RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` były w tej samej linii komendy.

Co dostarczyłem ZAMIAST zmiany: dwa nowe przypadki realnego HTTP, z czego polski jest czerwony z
założenia, oraz brief zmiany sygnatury. Nienałożony szkic dla każdego handlera i jego call-site'ów:

```diff
-function handleOkrRouteError(res: Response, err: unknown, op: string): void {
+function handleOkrRouteError(req: AuthenticatedRequest, res: Response, err: unknown, op: string): void {
-  mapAppErrorResponse(err, undefined, 'error')
+  mapAppErrorResponse(err, req, 'error')

-handleOkrRouteError(res, err, 'createCycle')
+handleOkrRouteError(req, res, err, 'createCycle')
```

Analogiczny mechaniczny diff jest wymagany w handlerze scorecard i wszystkich jego call-site'ach.
Promień rażenia: 71 wywołań helpera OKR i 15 wywołań helpera scorecard według `rg` na markerze
(licząc także definicję każdego helpera);
każda zmieniona trasa nadal wymaga własnej pary dowodowej.

Co zrobiłbym, gdyby licencja objęła sygnaturę helperów: przekazałbym `req` do helpera, zmienił
wyłącznie odpowiadające mu wywołania mappera, dodał pary HTTP i wykonał mutację usuwającą odczyt
`X-App-Language`, potem przywrócenie przez `cp`.

Rekomendacja dla nadzorcy: rozszerzyć licencję R2 imiennie o sygnatury obu helperów i ich call-site'y
albo wydać osobny dyżur mechaniczny z parami dowodowymi. Nie zezwalać na masową zmianę 106 miejsc
bez testów tras.

Stan: zacommitowano czerwony kontrakt i raport; kod produkcyjny R2 niezmieniony.

Czy kontynuowałem pozostałe pozycje: TAK — R3 ma niezależną pełną licencję i usuwa mylący tekst
awarii systemu bez zmiany `errorCode`.

### Pułapki środowiska dla kontraktu R2

Pakiet omija (a) przez `ENABLE_V8_GLOBAL=true`, (b) przez
`RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, (c) przez jawne `MOCK_DB=false
DB_TYPE=postgres` i asercję, (d) przez `ENABLE_TEST_AUTH_BYPASS=false`. Pułapka modułu (e.2) jest
rdzeniem testu: kontrakt używa `X-App-Language`, nie polega na możliwym w supertest
`Accept-Language`. `NODE_ENV=test` jest jawne. Test używa portu 5491 i nie uruchamia indexu.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy
konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail
ani zaproszenie kalendarzowe nie zostało wysłane.

## TWIERDZENIA NIEZWERYFIKOWANE

- R2 pozostaje celowo czerwony i kod produkcyjny R2 nie został zmieniony z powodu granicy licencji.
- R3–R6 nie są jeszcze zweryfikowane na etapie commitu R2.
