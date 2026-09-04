# Dyżur 333 — schemat: domknięcie po 310/319

Stan: ZAKOŃCZONY LOKALNIE I WYPCHNIĘTY. Marker `1c3d3da844ae03c87985a8f5dc74846a073c0220`, gałąź `codex/day333-schemat-domkniecie-20260904`.

## Wejście i rozjazd tipa

Wynik §0.1 (2), dosłownie:

```text
7dca03967d Merge agent/instr-E — instrukcje dyzurow 327, 328, 329
9ab1826c28 docs(dyzury): 328 — warunki wspolne serii (liscie slownikow, trzy bramki kanonu) jako kontrola braku szkody ubocznej
c4fa089b20 docs(dyzury): instrukcja 329 (martwe od korzenia + Biblioteka metodyk) + adnotacje sciezek nieistniejacych na markerze w 327/328
0d67f8f575 Merge agent/instr-F — instrukcje dyzurow 330, 331, 332, 333
db2b277df0 docs(dyzury): instrukcje 330-333 (wywiad menu, mojapraca+silnik, testy puste reszta, schemat domkniecie)
58e22fba09 Merge agent/instr-D — instrukcje dyzurow 324, 325, 326
440b5d8f5c docs(dyzury): instrukcja 328 — domkniecie bramki G20 (dowod fetch-depth para klonow, 17 pozycji, 3 checkpointy)
502782e183 docs(dyzury): instrukcje 324 (szablon tnie karte inicjatywy), 325 (komunikaty PL — jedno zrodlo prawdy), 326 (konta serwisowe — 500 z pustym cialem)
97cf766dae docs(dyzury): instrukcja 327 — bezpieczniki, ktore nie mierza (rodzina + inwentarz R0)
1c3d3da844 Merge codex/day314 (odbiór adwersaryjny: SCALIC; POKAZAC WLASCICIELOWI — ale parami odbiorcy, nie z raportu)
1abcb5deab fix(day315): przywroc canvas-toolbar-md-history do macierzy 13_CHAT
f8ba9dac0d Merge codex/day315 (odbiór adwersaryjny: SCALIC Z ZASTRZEZENIEM; POKAZAC WLASCICIELOWI tylko 3 pary)
d0976f7d90 fix(day317): audyt i18n wycina wnetrze {{...}} z klasyfikacji jezykowej
1d42e78827 fix(ci): fetch-depth 0 dla joba z bramka G20 — przy plytkim klonie nie mogla sie zazielenic nigdy
a19c11c17d Merge codex/day320 (odbiór adwersaryjny: SCALIC Z ZASTRZEZENIEM — bramka NADAL nie zamyka sie sama)
ee5cb420a3 Merge codex/day319 (odbiór adwersaryjny: SCALIC Z ZASTRZEZENIEM)
4d7ef3c968 Merge codex/day321 (odbiór adwersaryjny: SCALIC Z ZASTRZEZENIEM)
fbe7fdf02c Merge codex/day316 (odbiór adwersaryjny: SCALIC Z ZASTRZEZENIEM)
38bd4df30d fix(day317): przywroc placeholder {{nazwa}} w en.closeOpenDocument — regresja z dyzuru 317
49f70ac3d1 Merge codex/day317 (odbiór adwersaryjny: SCALIC Z ZASTRZEZENIEM — po naprawie regresji, osobny commit)
7d5df22197 Merge codex/day322 (odbiór adwersaryjny: SCALIC Z ZASTRZEZENIEM — 0 z 5 pozycji domknietych, ale rejestr nie klamie)
35ce7a8421 Merge codex/day323 (odbiór adwersaryjny: SCALIC)
bffaaa5494 Merge codex/day318 (odbiór adwersaryjny: SCALIC — jedyny z pelnym dowodem, ktory odbiorca odtworzyl sam)
e3b9741f07 Merge agent/konsolidacja — rejestr M13-M27, lekcje 04.09, przekazanie na 05.09
6459b06de0 docs(indeks): dopisz wskazania na REJESTR_ZNALEZISK/LEKCJE/PRZEKAZANIE 04-05.09
MARKER OK
```

Wynik §0.1 (7), dosłownie:

```text
1c3d3da844ae03c87985a8f5dc74846a073c0220
```

Tip `github-backup/grafika/m03-20260902` uciekł do `7dca03967d`; zgodnie z DEC-95 praca startowała dokładnie z markera, bez rebase. Nowsze commity dotyczą instrukcji 324–333 i ich merge'y; integrację wykonuje nadzorca.

## R0 — baza od zera i pomiar A

- Pełny strict runner: `Applying migrations: 893`, zakończony `Postgres migrations complete`.
- Drugi przebieg: `Applying migrations: 0`.
- A = **1802** tabel w `public`.
- `to_regclass('public.conversations') = conversations`; `to_regclass('public.slack_router_dedupe') = NULL`.

Artefakty: `/private/tmp/cx-day333-schemat-domkniecie-artefakty/migracje-r0-1.txt`, `migracje-r0-2.txt`, `a-tabele.txt`.

## R1 — pomiar B przez realny ApiGateway

Harness zamontował `ApiGateway.getInstance().initializeRoutes(app)` na `127.0.0.1:5499`, z `MOCK_DB=false`, `DB_TYPE=postgres`, `DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6359/cx333`, `ENABLE_TEST_AUTH_BYPASS=false` i `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` w tej samej linii.

| Pomiar | Wynik |
|---|---:|
| A — po migracjach | 1802 |
| B — po ApiGateway, rejestracji i próbie Slack | 1803 |
| B−A | 1 |

`POST /api/auth/register` zwrócił **HTTP 200**. Bezpieczna próba `routeToSlack` przy braku tokenu, kanału i webhooka zwróciła `{ ok: false, transport: "none" }`, ale wcześniej uruchomiła trwały dedupe. Jedyną tabelą B−A jest `slack_router_dedupe`, pochodzącą z `server/src/services/slack/slackRouter.ts:147`.

Artefakty: `/private/tmp/cx-day333-schemat-domkniecie-artefakty/r1-api-gateway.txt`, `b-tabele.txt`, `b-minus-a.txt`.

## R2 — klasyfikacja `073_conversations.sql`

Pomiar mutacyjny na kopii migracji poza repo:

- bez `073_conversations.sql`: runner zgłosił 892 migracje, nie utworzył `conversations` i zatrzymał się na `515_team_chat_projects.sql` z `relation "conversations" does not exist`;
- z przywróconym `073_conversations.sql`: runner wykonał 893 migracje, zakończył sukcesem, a `to_regclass('public.conversations')` zwrócił `conversations`.

Wynik jest silniejszy niż samo odczytanie predykatu: plik jest koniecznym, rzeczywiście wykonywanym producentem. W rejestrze zmieniono wyłącznie jego status na `PROMOWANA_URUCHAMIANA`. Artefakty: `r2-bez-073.txt`, `r2-bez-073-result.txt`, `r2-z-073.txt`, `r2-z-073-result.txt`.

## R3 — `slack_router_dedupe`

Istniejąca migracja `20261670_p2_runtime_schema_repairs.sql` była no-op na czystej bazie: R0 po pełnych 893 migracjach zwrócił `to_regclass(...) = NULL`. Dodano addytywną migrację `20262020_day333_slack_router_dedupe.sql` z dokładnym runtime'owym kształtem tabeli. Pełny przebieg od zera wykonał 894 migracje, drugi przebieg wykonał 0, `to_regclass(...)` zwrócił `slack_router_dedupe`, a liczba tabel wyniosła 1803.

DDL w `slackRouter.ts` pozostaje jako kompatybilnościowy strażnik: plik ma w tym dyżurze licencję tylko do odczytu. Usunięcie można wykonać osobno po potwierdzeniu wdrożenia migracji we wszystkich środowiskach. Artefakty: `r3-migracje-1.txt`, `r3-migracje-2.txt`, `r3-result.txt`.

## R4 — 24 wyjątki `__tests__`

Własny mianownik to 24 pliki. Każdy został odczytany i ma teraz obok wyjątku `__tests__` w `noRuntimeDdl.test.ts` wiersz: ścieżka, linia, powód i werdykt `legal`. Klasyfikacje obejmują izolowane fixture SQLite/RealPG, nazewniczo izolowane tabele sond, kontrolowane mutacje odtwarzane w cleanupie oraz asercje tekstu SQL. Kontrola kompletności przeszła z `missing=0`; linia `if (file.includes('/__tests__/')) continue;` nie została zmieniona.

Dowód mutacyjny bezpiecznika:

- RED: tymczasowe `CREATE TABLE IF NOT EXISTS day333_guard_probe` w `server/src/controllers/AssessmentController.ts` dało `mutation_rc=1`; strażnik wykrył 136 plików wobec 135 w allowliście;
- GREEN po odtworzeniu pliku przez `cp`: oba przypadki przeszły;
- `git diff -- server/src/controllers/AssessmentController.ts` był pusty.

Pułapki Z33: pakiet jest statycznym strażnikiem plikowym, nie dotyka bazy, JWT ani bramek V8. Uruchomiono go jawnie z `RUN_DB_TESTS=0 MOCK_DB=true --retry=0`; nie służy jako dowód runtime/HTTP.

## Korekty wobec instrukcji

- Instrukcja podaje A/B `1914→1915`; na markerze dyżuru 333 własny pomiar daje **`1802→1803`**. Różnica nazw pozostaje zgodna: wyłącznie `slack_router_dedupe`.
- R2 nie mógł przejść pełnego łańcucha bez `073_conversations.sql`: zależna migracja `515_team_chat_projects.sql` słusznie zatrzymała runner na braku `conversations`. `to_regclass` przed awarią pozostał `NULL`; po przywróceniu pliku pełny łańcuch przeszedł i zwrócił `conversations`.
- Krok symlinka zwrócił `File exists`, ponieważ worktree już zawierał poprawny symlink `node_modules -> /Users/piotrwisniewski/Developer/Consultify/node_modules`; nie wykonano dodatkowej zmiany.

## Z30 — brak wysyłki zewnętrznej

Przed zapisem środowisko zwróciło `BRAK ZMIENNYCH POCZTY`, tabela `settings` miała 0 kluczy `smtp%`, a `Gateway.ts` nie zawiera uruchomienia drenaży. Log rejestracji pokazuje `Using Host: Mock (Console)`. Slack nie miał skonfigurowanego transportu.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Pomiar zasięgu testów

PRZED zmianami: 2 pełne nazwy w `/private/tmp/cx-day333-schemat-domkniecie-artefakty/przed-nazwy.txt`. PO zmianach: te same 2 pełne nazwy w `po-nazwy.txt`; `diff` jest pusty — 0 dodanych i 0 znikniętych przypadków.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano zachowania produkcji, demo, stagingu ani Railway; kontakt z nimi był zakazany.
- Pomiar B obejmuje rejestrację i kontrolowaną ścieżkę Slack, nie wszystkie możliwe ścieżki DDL-w-locie.

## Commity i zakres

- `88534c3abb` — R1 pomiar A/B;
- `6ca1bf64b0` — R2 klasyfikacja `073_conversations.sql`;
- `ed39969ed6` — R3 addytywna migracja `slack_router_dedupe`;
- `91c1e7f204` — R4 uzasadnienia 24 wyjątków.

Zakres względem markera to dokładnie cztery pliki: rejestr 310/319, ten raport, nowa migracja `20262020_day333_slack_router_dedupe.sql` i `noRuntimeDdl.test.ts`. Pełny manifest hashy leży w `/private/tmp/cx-day333-schemat-domkniecie-artefakty/SHA256SUMS`.
