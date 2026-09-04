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

## R3 — kod spoza siedmiu nie udaje awarii systemu

Werdykt: ZROBIONE w zakresie licencji. `ApiError` zachowuje niepusty `message`/`error` z koperty
serwera zamiast twardego `defaultError`. `getAppErrorCopy` dla niekanonicznego kodu pokazuje ten
komunikat, ale nadal zwraca `INTERNAL` jako ostateczny kod prezentacyjny i zachowuje angielski
fallback, gdy serwer nie poda tekstu. Pole `errorCode` w źródłowej kopercie nie jest zmieniane.

Dowód zielony: `r3-mutation-restored-green.json` — 16/16. Nowe przypadki:

- `COMMAND_CAPABILITY_DENIED zachowuje komunikat serwera zamiast udawać INTERNAL`;
- `nieznany kod bez komunikatu serwera zachowuje angielski fallback INTERNAL`.

Dowód mutacyjny: skopiowano zielony `appErrorCopy.ts` do scratch, usunięto wybór
`serverMessage`, uruchomiono tę samą suitę i uzyskano 15/16: nowy przypadek zobaczył
`Coś poszło nie tak po naszej stronie.` zamiast komunikatu o braku uprawnień. Plik przywrócono
przez `cp`; `diff -u` kopii i przywróconego pliku był pusty; ponowny przebieg dał 16/16.

Pułapka `react-i18next`: istniejąca suita jawnie wykonuje
`vi.mock('react-i18next', async () => await vi.importActual('react-i18next'))`, ładuje realne
pliki PL/EN i inicjuje realne i18n. Nowe przypadki biegną w tej samej suicie, więc nie korzystają
z globalnej atrapy `tests/setup.ts`. Dodatkowo test fallbacku podaje funkcję zwracającą dokładnie
wartość domyślną, co niezależnie dowodzi zachowania angielskiej ostatniej deski ratunku.

Pakiet R3 jest czysto jednostkowy: nie leżą na jego ścieżce bramki (a), (b) ani (d), nie otwiera
bazy (c) i został uruchomiony z `RUN_DB_TESTS=0 MOCK_DB=true`. Dowodzi selekcji komunikatu i
renderowania przez realne i18n, nie dowodzi produkcyjnego HTTP. Dowód HTTP pozostaje w R2 i jest
celowo czerwony z powodu granicy licencji.

Typecheck: `npx tsc --noEmit --pretty false` nie jest PASS — proces Node zakończył się awarią
pamięci i stackiem V8. Kod wyjścia potoku `tee | tail` był 0, lecz nie został uznany za wynik
kompilatora. Artefakt: `r3-tsc.log`.

## Pomiar nazw testów przed/po

Przed: 159 pełnych nazw (145 czerwonych zastanych testów tras + 14 zielonych frontu). Po: 164
pełne nazwy. `nazwy.diff` zawiera dokładnie pięć nazw dodanych: dwa przypadki R2, dwa przypadki
R3 i jeden przypadek R4; nazw znikniętych: 0. Zastane 145 testów tras pozostało czerwone przed i po z tego samego
powodu — wymuszona realna bramka członkostwa wobec atrap auth w minimalnym routerze.

Liście słowników po zmianie: PL 35198, EN 33065 — bez spadku i bez modyfikacji słowników.

Artefakty i sumy SHA-256 znajdują się w
`/private/tmp/cx-day325-komunikaty-pl-artefakty/SHA256SUMS`.

## R4 — 203 konstrukcje `new AppError`

Parser zbilansowanych nawiasów odczytał trzeci argument każdej z 203 konstrukcji poza
`__tests__`. Wynik statycznie rozstrzygalny względem czterech kodów `OPERATIONAL_MESSAGES`:

- 1 wywołanie: kod słownikowy `ERROR_CODES.NOT_FOUND`;
- 202 wywołania: brak kodu słownikowego albo kod spoza słownika;
- największa rodzina: 138 wywołań bez jawnego trzeciego argumentu (domyślny
  `INTERNAL_ERROR`), reprezentant `server/src/controllers/SuperAdminController.ts:199`;
- następna rodzina: 29 literalnych `FEATURE_UNAVAILABLE` i 5 przez stałą
  `FEATURE_UNAVAILABLE_CODE`.

Werdykt: centralna zmiana R3 chroni front przed zamianą dostarczonego tekstu na komunikat awarii,
ale nie tłumaczy 202 komunikatów serwera. R1 pozostaje kierunkiem docelowym, lecz słownik serwera
ma policzony dług. Test `DAY325 pomiar AppError bez kodu słownika` jest zielony i dowodzi aktualnego
zachowania: `Accept-Language: pl` + `new AppError('Failed to fetch organizations', 500)` daje
`errorCode=INTERNAL_ERROR` oraz surowy angielski tekst.

Gotowy diff nienałożony dla reprezentanta największej rodziny (wymaga osobnej licencji na
kontroler oraz rozszerzenia słownika mappera w jednym commicie):

```diff
-return next(new AppError('Failed to fetch organizations', 500));
+return next(new AppError('Failed to fetch organizations', 500, 'ORGANIZATIONS_FETCH_FAILED'));

 const OPERATIONAL_MESSAGES = {
   pl: {
+    ORGANIZATIONS_FETCH_FAILED: 'Nie udało się pobrać listy organizacji.',
   },
   en: {
+    ORGANIZATIONS_FETCH_FAILED: 'Failed to fetch organizations.',
   },
 };
```

Pakiet R4 jest czysto jednostkowy (`RUN_DB_TESTS=0 MOCK_DB=true`), nie przechodzi przez bramki
(a)–(d) ani przez HTTP; mierzy wyłącznie gałąź mappera dla operacyjnego AppError bez kodu.

## R5 — wolumen ogona `defaultError`

Definicja podstawowa z instrukcji: liczba pojedynczych linii `src/services/api.ts` zawierających
`handleResponse(res, ` wynosi **1003**. Z nich 1002 rozpoczynają drugi argument literałem
łańcuchowym w tej samej linii. To liczba call-site'ów, nie liczba sytuacji, w których użytkownik
realnie zobaczy literal.

Centralne miejsce nadpisania było jedno: `createApiError(data, defaultError, res.status)`.
R3 pokrywa wszystkie 1003 call-site'y wtedy, gdy odpowiedź JSON zawiera niepuste `message` albo
`error`: konstruktor `ApiError` zachowuje tekst serwera. Dług pozostaje dla odpowiedzi bez tych pól,
odpowiedzi tekstowych/nieparsowalnych i bezpośrednich wywołań `createApiError` poza centralnym
`handleResponse`; dla nich angielski fallback pozostaje świadomie ostatnią deską ratunku. Nie
udowodniono, ile z 1003 ścieżek realnie wpada w każdą kategorię.

## R6 — raport końcowy

Werdykt dyżuru: **PARTIAL / rdzeń R3 naprawiony, R2 uczciwie czerwony z powodu granicy licencji**.
Nie ogłaszam pełnej lokalizacji PL: realny kontrakt nadal dowodzi angielskiego tekstu dla
`PROGRAM_NOT_ACTIVE` przy `X-App-Language: pl`. Nie zmieniono żadnego `errorCode`.

Migracje: pierwszy przebieg zastosował 893 migracje i zakończył się komunikatem
`Postgres migrations complete`; drugi zastosował 0 i zakończył się tym samym komunikatem.

Końcowe sprawdzenia:

- front `appErrorCopy.test.ts`: 16/16 PASS, `--retry=0`;
- test inwentarza R4: 1/1 PASS, `--retry=0`;
- realny kontrakt R2: 1/2 PASS, 1/2 RED z założenia; status 409 i `errorCode` zachowany;
- zastane suity tras z wymuszoną produkcyjną bramką: 0/145, czerwone przed i po; nie są
  dowodem produktu i nie zostały osłabione;
- ESLint dla trzech zmienionych plików frontu z `--quiet`: 0 błędów;
- typecheck: `NOT_PROVEN` z powodu awarii pamięci Node;
- liczba liści i18n: PL 35198 / EN 33065;
- diff `.env*`, `docker-compose*`, `railway*`: pusty;
- pliki zmienione względem markera: wyłącznie raport, rejestr, dwa nowe testy i trzy pliki
  frontowego rdzenia wymienione w licencji.

Commity pozycji: R1 `135878c240`, R2 `70e93a9f4a`, R3 `4424780b99`, R4 `e469097d84`,
R5 `fa5a7fb7dd`; każdy został wypchnięty na `github-backup` natychmiast po pozycji. R6 zamyka
raport i korektę formatowania pliku R3 bez zmiany zachowania.

## TWIERDZENIA NIEZWERYFIKOWANE

- R2 pozostaje celowo czerwony i kod produkcyjny R2 nie został zmieniony z powodu granicy licencji.
- Pełny typecheck jest `NOT_PROVEN`: proces Node rozbił się z braku pamięci.
- Nie rozstrzygnięto dynamicznie wszystkich kodów przekazywanych w trzecim argumencie `AppError`;
  klasyfikacja R4 jest statyczna i jawnie wydziela wyrażenia dynamiczne.
- Nie zmierzono realnej częstości użycia fallbacku w 1003 call-site'ach `handleResponse`.
- Nie wykonano niezależnego odbioru przez nadzorcę ani integracji z nowszym tipem gałęzi bazowej.
