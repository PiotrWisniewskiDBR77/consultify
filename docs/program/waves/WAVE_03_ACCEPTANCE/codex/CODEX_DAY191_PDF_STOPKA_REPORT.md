# CODEX — DYŻUR 191 — PDF STOPKA

Data wykonania: 2026-08-30  
Marker: `b4651675f6`  
Gałąź: `codex/day191-pdf-stopka-20260831`  
Werdykt: **FIXED / VERIFIED** dla R1–R3 na lokalnym środowisku dyżuru.

## 1. Baza pracy i bramki wejściowe

Instrukcję odczytałem w całości z `github-backup/codex/m03-admin-20260824` w bare-vaulcie. Katalog właściciela nie był odczytywany ani modyfikowany; jedyny kontakt to dozwolony symlink `node_modules`.

Wynik komendy markera (§0.1 pkt 2), dosłownie:

```text
b4651675f6 odbior 186: SCALONO (B+/A-) — plik dowodowy REALNY odtworzony niezaleznie; strop PARTIAL uczciwy (zadne wejscie UI nie niesie briefu -> decyzja produktowa); dyzur 193 zbiorcze piny Z31
MARKER OK
```

Tip `github-backup/codex/m03-admin-20260824` wyprzedzał marker o 23 commity. `git diff --name-only b4651675f6..github-backup/codex/m03-admin-20260824` nie wskazał `documentPdfRenderer.ts` ani żadnego z trzech zmienianych testów. Worktree utworzyłem dokładnie z markera, bez rebase.

Wynik sanity (§0.1 pkt 7), dosłownie:

```text
b4651675f6ba0cc880c07fee94d2667a952d92f4
```

`git status --short | head -3` nie zwrócił żadnej linii.

Bramki STOP:

- wolne miejsce `/`: `9.5Gi` — powyżej progu 5 GB;
- porty `6111`, `5054`, `5055`: `WOLNY` przed startem;
- aktywne worktree: zero commitów po markerze dotykających `server/src/services/documentStudio/documentPdfRenderer.ts`;
- baza: wyłącznie `cx-day191-pg`, obraz `pgvector/pgvector:pg16`, bind `127.0.0.1:6111`;
- migracje: pierwszy przebieg zakończony `✅ Postgres migrations complete`; w `schema_migrations` jest 870 rekordów; drugi przebieg: `Applying migrations: 0`, `✅ Postgres migrations complete`.

## 2. Z30 — brak wysyłki

Przed pierwszym zapisem:

```text
BRAK ZMIENNYCH POCZTY
```

`grep -n "startNotificationOutboxDrainCron\|outboxWorker\|platformOutboxDrainCron" server/src/Gateway.ts` zwrócił zero trafień. Po migracjach:

```text
 key | left
-----+-----
(0 rows)
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## 3. Stan wejściowy i przyczyna źródłowa

Pomiar realnych linii na markerze:

- `drawHeaderFooter`: linie 1052–1129;
- `bufferedPageRange`: 1187;
- `switchToPage`: 1190;
- wywołanie `drawHeaderFooter`: 1191.

Obaj konsumenci używają tego samego `DocumentSchema` i renderera:

- Audyty: `reports.routes.ts:135` → `renderDocumentSchemaToPdfBuffer(schema)`;
- Materiały: `documentStudioService.ts:1610` → ten sam renderer; trasa zamontowana w `Gateway.ts:1050–1054`.

W źródle lokalnie zainstalowanego `pdfkit` 0.17.2 (`node_modules/pdfkit/js/pdfkit.js`) wrapper tekstu przed zapisem porównuje `document.y + currentLineHeight` z `maxY`. Przy przekroczeniu wywołuje `nextSection()`, a ta dla kolejnej kolumny wywołuje `document.continueOnNewPage()` i przelicza `document.page.maxY()`.

W rendererze `footerY = doc.page.height - 34`, natomiast dolny margines A4 fixture wynosi 2 cm (około 57 pt). Dwa `.text()` stopki zaczynały więc poniżej `page.maxY()` i każde mogło utworzyć osobną stronę. To potwierdził test R1: trzy krótkie sekcje mieszczące się na jednej stronie dały przed naprawą `info.total = 3`.

## 4. R1 — reprodukcja czerwona

Dodałem osobny test `day191.footerPagination.test.ts`, ponieważ stanowi minimalny, izolowany kontrakt jednej strony i nie miesza regresji mechanizmu z szerokim zestawem parity.

Schemat: trzy krótkie sekcje, bez okładki i TOC, stopka `enabled=true`, `pageNumbering=true`, `confidentialityLabel=true`. Oczekuje jednej strony zawierającej wszystkie trzy sekcje, `restricted` oraz `1 / 1`.

Przed naprawą, po ustawieniu jawnego środowiska Node:

```text
numTotalTests: 1
numPassedTests: 0
numFailedTests: 1
expected 3 to be 1
```

Pierwszy techniczny przebieg w domyślnym JSDOM był czerwony wcześniej, ale z niewłaściwego powodu (`Not a supported font format...`) i nie został uznany za dowód. Jawne `// @vitest-environment node` usuwa tę pułapkę bez zmiany kodu produktu.

## 5. R2 — naprawa

Zmiana jest wyłącznie w `drawHeaderFooter`:

1. zapamiętuje `doc.page.margins.bottom`;
2. ustawia dolny margines na `0` tylko na czas tekstowych elementów stopki;
3. rysuje niezmienione treści i style poufności/numeracji;
4. przywraca margines w `finally`.

Nie zmieniłem pętli stemplowania, treści, stylu bloków, DOCX, tras ani flag. `bufferedPageRange()` nadal jest wołane raz przed pętlą, więc `M` pochodzi z liczby stron treści. Po naprawie R1:

```text
numTotalTests: 1
numPassedTests: 1
numFailedTests: 0
```

Strona zawiera `1 / 1`, więc liczba `M` odpowiada realnemu `info.total = 1`.

## 6. R3 — oba konsumenci i mutacja

### Audyty — realny HTTP / Gateway / JWT / PostgreSQL

Komenda miała w tej samej linii: `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6111/cx191 JWT_SECRET=... --retry=0`.

Pułapki Z33:

- (a) wyłączona przez `ENABLE_V8_GLOBAL=true`;
- (b) wyłączona przez `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`;
- (c) wyłączona przez `MOCK_DB=false DB_TYPE=postgres`; log DB: `127.0.0.1:6111/cx191`;
- (d) wyłączona przez `ENABLE_TEST_AUTH_BYPASS=false`; test używa podpisanego JWT i `ApiGateway.initializeRoutes(app)`;
- (e) asercja liczy strony i treść każdej z nich.

Finalnie:

```text
Day 187 audit report HTTP PDF export exports a real report through authenticated ApiGateway with PDF headers and content — passed
Day 187 audit report HTTP PDF export returns 422 AUDIT_REPORT_INVALID_PAYLOAD for the same malformed shape as DOCX — passed
numTotalTests=2, numPassedTests=2, numFailedTests=0
```

Regresja oczekuje dokładnie 3 stron, numeracji `1 / 3`, `2 / 3`, `3 / 3` i niepustej treści po usunięciu tekstu stopki.

### Materiały — `exportDocumentArtifact`

Usunąłem lokalny mock `documentPdfRenderer`, aby istniejący test PDF rzeczywiście przeszedł przez wspólny renderer. DOCX pozostaje mockowany. Pakiet jest jednostkowy i nie otwiera bazy: `RUN_DB_TESTS=0 MOCK_DB=true --retry=0`.

Pułapki Z33:

- (a)–(d) nie leżą na ścieżce: pakiet wywołuje bezpośrednio `exportDocumentArtifact`, nie Gateway/middleware/PG;
- (e) jest wyłączona przez realny renderer oraz asercję `info.total = 1`, treści, etykiety `internal` i `1 / 1` na jedynej stronie.

Finalny wspólny przebieg R1 + Materiały:

```text
numTotalTests=12, numPassedTests=12, numFailedTests=0
```

### Dowód mutacyjny w obie strony

Poprawiony renderer skopiowałem do scratch. Po lokalnym usunięciu wyłącznie naprawy:

```text
Audyty: expected 9 to be 3; 1 failed, 1 passed
Materiały: expected 3 to be 1; 1 failed, 10 passed
```

Po `cp` poprawionego renderera z powrotem `cmp` zwrócił `FIXTURE RESTORE IDENTICAL`. Następne przebiegi były zielone: Audyty 2/2, R1 + Materiały 12/12.

## 7. Kontrola wzrokowa PDF

Pliki wyrenderowałem przez Poppler do PNG i obejrzałem każdą stronę.

### Audyty — 3 strony

1. Okładka „Łódź — raport jakości”, treść metadanych, stopka `restricted`, numer `1 / 3`.
2. Rzeczywisty Table of Contents z pozycją „1. Streszczenie”, numer `2 / 3`; brak strony składającej się wyłącznie ze stopki.
3. „1. Streszczenie”, marker `DAY187_PDF_REAL_PAYLOAD`, sekcja Sources & traceability, stopka `restricted`, numer `3 / 3`.

Nie ma stron pustych ani stron tylko z `restricted`/`N / M`. Numeracja jest spójna z realną liczbą stron.

### Materiały — 1 strona

Jedna strona z „1. Executive Summary”, trzema akapitami i Sources & traceability; na dole `internal` oraz `1 / 1`. Brak strony-śmiecia, obcięć i nakładania stopki na treść.

## 8. Artefakty i SHA-256

```text
c848c6ad372f877cf88e3d19d0e13efe1f8a1cde9891f02d139cf7364575b6f3  /private/tmp/cx-day191-pdf-stopka-artefakty/audits-final.pdf
3c92be06c4621bde8594350541c0085df89a92e86a2268669b96745ffe1557fe  /private/tmp/cx-day191-pdf-stopka-artefakty/materials-final.pdf
4eefc8890352897606a49997fbbd0e6146cc5379aae3f0d058f39620720c5587  /private/tmp/cx-day191-pdf-stopka-artefakty/day191-r1-red.json
82612c7e29aa4f65985476ef344e27231e6c8b92731b3cb8848feb826110f76e  /private/tmp/cx-day191-pdf-stopka-artefakty/day191-r1-green.json
bc56f5752cbdabd07213cb5f1be76096111601772f1ee8bfabdf0db4a76a2dcd  /private/tmp/cx-day191-pdf-stopka-artefakty/day191-audits-mutation-red.json
3def618bb083a647c6743abf1848e501da786e3b8a6cdea61a2fe0115c6da650  /private/tmp/cx-day191-pdf-stopka-artefakty/day191-materials-mutation-red.json
77db891f5d371e94246161c2cc89ed59feaee7745749ca2f0d94507746b08964  /private/tmp/cx-day191-pdf-stopka-artefakty/day191-audits-final-green.json
420bc8d96148341a10e86c5d8a4699e4df24444b30c12916f9ecdf3c4aa78f27  /private/tmp/cx-day191-pdf-stopka-artefakty/day191-unit-final-green.json
```

## 9. Walidacja statyczna i zasięg

- `npx prettier --check <4 zmienione pliki>`: PASS;
- `git diff --check`: PASS;
- ESLint na czterech plikach: 0 błędów, 52 ostrzeżenia — wszystkie zastane ostrzeżenia `no-restricted-syntax` o hexach w rendererze; nie zmieniałem treści/stylu kolorów poza licencją;
- finalne testy po pełnych nazwach: 14/14 PASS (2 Audyty + 12 R1/Materiały);
- zasięg merytoryczny: minimalna reprodukcja renderera, realna trasa Audytów oraz istniejący serwisowy konsument Materiałów.

## 10. Korekty wobec instrukcji

1. Instrukcja w Z24 mówi: „Pomiar zasięgu testów wg `§0.4a`”, a dokument nie zawiera nagłówka ani treści `§0.4a` (lista nagłówków przechodzi z `§0.2d` do `§0.5`). Bezpieczna interpretacja: zmierzyłem wszystkie zmienione testy i raportuję pełne nazwy, nie przepisałem żadnej liczby z briefu.
2. Oczekiwanie, że istniejące testy PDF przejdą bez dodatkowej konfiguracji środowiska, nie zachodzi w domyślnym JSDOM: realne bufory fontów kończą się `Not a supported font format or standard PDF font`. Dodałem `// @vitest-environment node` wyłącznie w dwóch licencjonowanych testach realnego PDF oraz nowym R1. Bez tej korekty Audyty zwracają 500 z powodu harnessu, zanim dojdą do asercji paginacji.
3. Teza 6 z 9 stron została potwierdzona dokładnie: po mutacji Audyty wygenerowały 9 stron zamiast 3. Materiały wygenerowały 3 zamiast 1.

## 11. Pliki zmienione

```text
server/src/services/documentStudio/documentPdfRenderer.ts
server/src/services/documentStudio/__tests__/day191.footerPagination.test.ts
server/src/routes/audits/__tests__/day187.reportExportPdf.pg.test.ts
server/src/services/documentStudio/__tests__/documentStudioExportQaGate.test.ts
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY191_PDF_STOPKA_REPORT.md
```

Nie zmieniłem `src/**`, tras, `documentStudioService.ts`, `documentDocxRenderer.ts`, middleware, konfiguracji testowej, CI ani flag.

## 12. TWIERDZENIA NIEZWERYFIKOWANE

- Nie uruchamiałem całego repozytoryjnego korpusu testów ani CI; brakujący `§0.4a` nie definiował szerszego selektora, a dowód objął wszystkie pliki zmienione oraz obu wymaganych konsumentów.
- Nie weryfikowałem wdrożenia, demo, stagingu ani produkcji — połączenia do tych środowisk są zakazane.
- Nie wykonywałem odbioru w UI; dyżur nie licencjonuje zmian `src/**`, a oba UI korzystają z naprawionego wspólnego renderera przez istniejące trasy.
