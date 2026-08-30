# CODEX DAY 152 — raport Word dla zarządu — pomiar

Data pomiaru: 2026-08-30  
Marker: `cefa960d00`  
Gałąź: `codex/day152-raport-word-20260830`  
Zakres: pomiar realnej generacji i eksportu DOCX, bez zmian produktu.

## Stan wejściowy

Instrukcję `/private/tmp/cx-day152-raport-word-scratch/INSTRUKCJA_DYZUR_152.md`
przeczytano w całości. Zastosowano `§0.1-BIS`, które nadpisuje `§0.1`.

```text
$ git merge-base --is-ancestor cefa960d00 HEAD && echo "BAZA OK" || echo "MARKER BRAK — STOP"
BAZA OK
$ git status --short
[brak wyjścia]
$ git branch --show-current
codex/day152-raport-word-20260830
$ ls -la node_modules
lrwxr-xr-x@ 1 piotrwisniewski wheel 56 Aug 30 11:02 node_modules -> /Users/piotrwisniewski/Developer/Consultify/node_modules
$ df -h /
Filesystem        Size    Used   Avail Capacity iused ifree %iused  Mounted on
/dev/disk3s1s1   1.8Ti    12Gi    15Gi    44%    459k  161M    0%   /
```

Kontrola zasobów przed startem:

```text
PORT 6038
PORT 4970
PORT 4971
CONTAINER cx-day152-pg
[brak listenerów i brak kontenera]
```

Migracje na `pgvector/pgvector:pg16`, wyłącznie
`postgresql://postgres:cx@127.0.0.1:6038/cx152`:

```text
Pierwszy przebieg: ✅ Postgres migrations complete
Drugi przebieg: Applying migrations: 0
✅ Postgres migrations complete
```

## Korekty wobec instrukcji

1. `§0.1` zawiera weryfikację stanu wejściowego dyżuru 144 w cudzym katalogu
   `/private/tmp/cx-day144-wskaznik-rozlaczenie`, a tabela licencji dyżuru 152
   zabrania dotykania cudzych worktree. Nie wykonano tych komend. Bezpieczniejsza
   interpretacja: stan dyżuru 152 sprawdzono wyłącznie w jego worktree.
2. `Z15`: „Zero modelu językowego w tym dyżurze” koliduje z R1: „`useLlm` musi
   być ON”. Nie było żadnej nazwy zmiennej dostawcy modelu w środowisku. Wysłano
   realne żądanie produktu z `useLlm:true`, lecz nie konfigurowano dostawcy i nie
   wykonywano zewnętrznego wywołania. Produkt zwrócił fail-soft
   `llm_prose_fallback`; wynik oceniono bez poprawiania i bez atrapy.
3. `Z24` odsyła do nieistniejącego `§0.4a`; zgodnie z `§0.1-BIS` odwołanie
   pominięto.
4. Pierwszy eksport zwrócił `403 TRIAL_EXPORT_DISABLED`, bo fixture miał
   nieokreślony `organization_type`. To wynik poprawnej bramki, nie defekt.
   Fixture testu ustawiono na legalne `organization_type='PAID'`; drugi przebieg
   przeszedł tą samą realną trasą bez zmiany bramki i zwrócił 200.

## Z30 — zero wysyłki

```text
$ env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL|ENABLE_LIVE_EMAIL)" || echo "BRAK ZMIENNYCH POCZTY"
BRAK ZMIENNYCH POCZTY
$ docker exec cx-day152-pg psql -U postgres -d cx152 -c "SELECT key, left(coalesce(value,''),8) FROM settings WHERE key LIKE 'smtp%';"
 key | left
-----+------
(0 rows)
$ grep -n "startNotificationOutboxDrainCron\|outboxWorker\|platformOutboxDrainCron" server/src/Gateway.ts
[brak trafień]
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane.

## R1 — realny dokument

Temat właściciela: „analiza transformacji cyfrowej firmy farmaceutycznej”,
raport dla zarządu. Harness użył podpisanego JWT, realnego
`ApiGateway.getInstance().initializeRoutes(app)`, realnego PostgreSQL i realnych
tras:

- `POST /api/document-studio/generate`, `useLlm:true` → HTTP 200;
- readback `wave5_artifacts` w lokalnej bazie → wiersz był obecny;
- `GET /api/document-studio/:artifactId/export/docx` → HTTP 200;
- cleanup usunął należące do testu rekordy.

Wynik:

```text
Ścieżka: /private/tmp/cx-day152-raport-word-artefakty/day152-pharma-board-report.docx
Rozmiar: 11278 B
Sygnatura: PK / Microsoft Word 2007+
unzip -t: No errors detected in compressed data
SHA-256: 4cfd84ee2898a6e6fc614e60c69e7ca1ad0ff62abbb293d1d43981701b7f5bb4
POST generate: 200
GET export/docx: 200
generationWarnings: llm_prose_fallback
```

Realna treść: dokument ma okładkę, spis treści i 5 sekcji, ale tylko
„Podsumowanie zarządcze” zawiera jedno zdanie z briefu; `Context`, `Findings` i
`Recommendations` są angielskimi placeholderami, a reszta zawiera redakcje
„Treść usunięta — niepoparte twierdzenie”. To jest realny plik, ale nie realnie
wypełniony raport zarządczy.

### STOP — R1 (jakość treści przy `useLlm:true`)

Rodzaj: MERYTORYCZNY  
Powód: bez skonfigurowanego dostawcy ścieżka `useLlm:true` zwróciła 200 z
`llm_prose_fallback` i utrwaliła placeholdery.  
Licencja, którą sprawdziłem: „zapis TYLKO testy
`server/src/services/documentStudio/__tests__/day152.*` i raport. Produktu nie
zmienia.” — nie zmieniono produktu.  
Dowód: `day152-http-result.json`; render stron 1–2; 13 trafień placeholderów /
redakcji w ekstrakcji tekstu.  
Co dostarczyłem ZAMIAST zmiany: realny DOCX, pełny HTTP/DB harness, render i
formalna rubryka FAIL.  
Co zrobiłbym, gdyby zapadła decyzja X: przy jawnie przydzielonym lokalnym lub
testowym dostawcy powtórzyłbym identyczny przebieg z `useLlm:true`, bez zmian
produktu.  
Rekomendacja dla nadzorcy: przy odbiorze dostarczyć zatwierdzone współrzędne
dostawcy testowego albo zaakceptować ten wynik jako dowód fail-soft.  
Stan: test zacommitowano w `f014e89006`; produktu nie zmieniono.  
Czy kontynuowałem pozostałe pozycje: TAK.

## R2 — karta odbioru rubryką §3 RAPORT

### 3A Kompletność — 6/16 = 37,5% — FAIL

| Wymiar | Ocena | Uzasadnienie |
|---|:---:|---|
| K1 Okładka + tytuł | 1 | Okładka, tytuł i data są; brak logo. |
| K2 Spis treści | 2 | TOC obecny i zgodny z pięcioma nagłówkami. |
| K3 Wszystkie sekcje | 0 | Trzy sekcje to jawne placeholdery; następne kroki są zredagowane. |
| K4 Brak placeholderów | 0 | `awaiting content` 3× i liczne „Treść usunięta”. |
| K5 Tabele zasilone | 0 | OOXML: 0 tabel. |
| K6 Wykresy/KPI | 0 | OOXML: 0 drawing, 0 media. |
| K7 Cytaty/źródła | 1 | Jest jedna pozycja identyfikowalności briefu, brak cytowań tez. |
| K8 Stopka/numeracja | 2 | Stopka i „Strona X / Y” widoczne na obu stronach. |

Próg 14,4/16 i brak zer nie są spełnione.

### 3B Merytoryka — 1/10 = 10% — FAIL

| Wymiar | Ocena | Uzasadnienie |
|---|:---:|---|
| M1 Grounding (krytyczny) | 0 | Brak analizy i źródeł; treść została zredagowana przez boundary. |
| M2 Język PL/EN (krytyczny) | 0 | Widoczny miks PL/EN: Context, Findings, Recommendations i placeholdery EN. |
| M3 Struktura logiczna | 1 | Kolejność summary→context→findings→recommendations→next steps jest logiczna, ale pusta. |
| M4 Brak filler | 0 | Placeholdery i komunikaty techniczne dominują. |
| M5 Spójność rejestru | 0 | To szkielet techniczny, nie rejestr raportu zarządczego. |

Próg 8/10 oraz krytyczne M1/M2 ≠ 0 nie są spełnione.

### 3C Grafika — 10/16 = 62,5% — FAIL

| Wymiar | Ocena | Uzasadnienie |
|---|:---:|---|
| G1 Hierarchia typografii | 2 | Wyraźna okładka i spójne H1/body. |
| G2 Odstępy/akapity | 2 | Brak clippingu i overlapu; marginesy spójne. |
| G3 Styl tabel | 0 | Brak tabel w realnym pliku. |
| G4 Wykresy | 0 | Brak wykresów i obrazów. |
| G5 Callouty/cytaty | 2 | Callout ma tło i akcentowy lewy pasek. |
| G6 Okładka/branding | 1 | Okładka estetyczna, ale bez logo i brandingu klienta. |
| G7 Listy | 2 | OOXML ma 3× `w:numPr`; punkty są natywnymi listami Word. |
| G8 Wierność export | 1 | DOCX renderuje poprawnie, lecz nie wykonano parytetu z ekranem/PDF. |

Próg 12,8/16 i brak zer nie są spełnione.

### Werdykt koniunkcyjny

**FAIL / DO POPRAWY** — 3A FAIL ∧ 3B FAIL ∧ 3C FAIL. Żadna z trzech osi nie
przeszła progu.

### Lista odbioru eksportu — 10 punktów

| # | Wynik | Dowód |
|---:|:---:|---|
| 1 | PASS | Realny `ApiGateway`, JWT, PostgreSQL; generate 200 i export 200. |
| 2 | FAIL | DOCX ma 11278 B, ale HTTP `Content-Length=21761` dotyczy koperty JSON/base64, więc nie jest równy rozmiarowi pliku. |
| 3 | PASS | Sygnatura `PK`, `file`: Microsoft Word 2007+. |
| 4 | PASS | `unzip -t`: bez błędów. |
| 5 | PASS | SHA-256 zapisany i powtórzony: `4cfd84…5bb4`. |
| 6 | FAIL | 3× `awaiting content`, 9× „Treść usunięta”, 1× `Assumption — needs source`. |
| 7 | FAIL | 0 tabel; warunek realnych ramek/stylu nie został spełniony. |
| 8 | FAIL | 0 drawings i 0 plików media; brak wykresu. |
| 9 | PASS | 3 natywne `w:numPr`; brak ręcznych prefiksów list w tych akapitach. |
| 10 | FAIL | Render 2 stron jest technicznie czysty, ale strona 2 pokazuje placeholdery, miks języków i brak treści zarządczej. |

## R3 — spadek objętości

Pomiar własny z `word/document.xml` (tekst OOXML, nie przepisana liczba):

| Plik | Słowa | Akapity | Heading1 | Tabele | Drawing |
|---|---:|---:|---:|---:|---:|
| 2026-06-24 AI-readiness PREMIUM | 3705 | 235 | 31 | 8 | 2 |
| 2026-06-28 AI Transformation Solutions | 1539 | 157 | 31 | 7 | 2 |
| 2026-07-05 D2 | 1598 | 171 | 21 | 6 | 1 |
| Day 152 | 199 | — | 5 | 0 | 0 |

24→28 czerwca: `-2166` słów (`-58,5%`), mimo identycznej liczby Heading1 i
niemal identycznej liczby tabel/rysunków. Średnia wynosi ok. 15,8 słowa/akapit
w starym pliku wobec 9,8 w nowszym, a liczba akapitów spada o 78 (`-33,2%`).

Historia `documentBlockProseGenerator.ts` nie zawiera commitu między 24 a 28
czerwca. Commit `e154bfd73aa` z 19 lipca dopiero później zmienił pojedynczy
budżet `max(targets×550,4096)` na partie po 2 bloki, cap 4096 i 700 tokenów na
blok. Nie może on wyjaśniać różnicy plików z czerwca. Domyślna gęstość UI
pozostaje `standard`; Day 152 jawnie użył `detailed` i mimo to po fallbacku ma
199 słów.

**Wynik R3: przyczyna pozostaje NOT_PROVEN.** Pomiar wyklucza prostą przyczynę
„mniej sekcji” i commit lipcowego chunkingu. Różnica jest zlokalizowana w
liczbie oraz długości akapitów, ale repo nie zawiera zachowanych schematów,
promptów, model/tier ani logów generacji obu porównywanych plików, więc nie ma
dowodu pozwalającego rozdzielić wpływ modelu od wejścia/promptu.

### STOP — R3

Rodzaj: MERYTORYCZNY  
Powód: brak zachowanych współrzędnych generacji plików z 24 i 28 czerwca
uniemożliwia przypisanie spadku jednemu parametrowi lub commitowi.  
Licencja, którą sprawdziłem: generatory są „do czytania, nie do zmiany”; wykonano
wyłącznie pomiar i historię.  
Dowód: tabela 3705/1539 słów, 31/31 Heading1, 235/157 akapitów; brak commitu
generatora między datami.  
Co dostarczyłem ZAMIAST zmiany: zawężenie przyczyny do gęstości prozy i
wykluczenie zmiany struktury oraz lipcowego budżetu.  
Co zrobiłbym, gdyby zapadła decyzja X: powtórzyłbym A/B z tym samym schema,
modelem, tierem i promptem, zapisując genreport dla obu wariantów.  
Rekomendacja dla nadzorcy: wymagać przy każdym runie sidecar JSON z modelem,
tierem, prompt-hash, outline/block count, density i słowami per blok.  
Stan: raport pomiarowy; produktu nie zmieniono.  
Czy kontynuowałem pozostałe pozycje: TAK.

## R4 — system stylowania i luki realnego pliku

Realny tor:

```text
document-studio.routes.ts
→ documentStudioService.exportDocumentArtifact
→ renderDocumentSchemaToDocxBuffer (documentDocxRenderer.ts)
→ importy z documentDocxStyles.ts
```

Według `BRAND_EXPORT_CANON.md §0` jest to **system #1 — Deliverables
(Materiały/M17), gałąź DOCX Document Studio**. Nie jest to system #3, który
dotyczy wyłącznie PDF Document Studio.

Luki sprawdzone na tym pliku:

- 0 osadzonych fontów (`word/fonts` nie istnieje); użyte nazwy Aptos/Aptos
  Display zależą od środowiska odbiorcy;
- 0 plików media i brak logo klienta/Consultify;
- 0 drawings i brak wykresów, więc brak możliwej do oceny palety serii;
- 0 tabel, więc styl tabel nie materializuje się w artefakcie;
- 3 natywne listy (`w:numPr`) — ten element kanonu jest obecny;
- header i footer istnieją; numeracja stron renderuje się poprawnie;
- plik używa palety navy/teal z `documentDocxStyles.ts`, ale nie ma dowodu
  mapowania do tokenów UI `--c-*` / `src/styles/typography.ts`.

## Testy i pułapki środowiska

### Przebieg 1 — realna bramka trial

Pełna nazwa przypadku:
`Day 152 real pharma board report through ApiGateway and PostgreSQL generates with useLlm ON and exports a real DOCX`.

```text
1 total, 0 passed, 1 failed, 0 pending
generate: HTTP 200
export: HTTP 403 TRIAL_EXPORT_DISABLED
```

### Przebieg 2 — fixture PAID

Ta sama pełna nazwa przypadku:

```text
1 total, 1 passed, 0 failed, 0 pending
generate: HTTP 200
export: HTTP 200
```

Komenda uruchomiona z `server/`, config poza repo bez przypięcia
`DB_TYPE=sqlite`:

```bash
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6038/cx152 \
JWT_SECRET=cx152-test-secret-do-not-reuse \
npx vitest run src/services/documentStudio/__tests__/day152.reportWord.pg.test.ts \
  --config /private/tmp/cx-day152-raport-word-scratch/day152.vitest.config.ts \
  --retry=0 --reporter=json \
  --outputFile=/private/tmp/cx-day152-raport-word-artefakty/day152-vitest-paid.json
```

Pułapki `(a)`–`(e)`:

- (a) `ENABLE_V8_GLOBAL=true` w tej samej linii; żądania dotarły do handlerów
  generate/export i nie zakończyły się fałszywym 404.
- (b) `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`; strażnik Results nie
  leży na ścieżce Document Studio, ale pozostał fail-closed.
- (c) zewnętrzny config nie ma `test.env.DB_TYPE`; pierwszy `it` asertuje
  `process.env.DB_TYPE === 'postgres'`, a realny readback potwierdza wiersz PG.
- (d) `ENABLE_TEST_AUTH_BYPASS=false`; JWT jest podpisany i przechodzi realny
  `verifyToken`.
- (e) nie dotyczy: pakiet nie dotyka `initiative_kpis` ani ich migracji; zapytania
  dotyczą `organizations`, `users`, `organization_members`, `wave5_artifacts`.

`W-A`: nie ma zastosowania — dyżur jest czysto pomiarowy, bez naprawy produktu i
bez mutacji kodu produkcyjnego.  
`W-B`: spełnione — test nie czyta źródła; wywołuje realne HTTP, DB i render.  
`W-C`: nie ma zmiany produktu, więc nie ma regresji marker→po zmianie do
porównania. Dwa przebiegi różnią wyłącznie poprawnym typem fixture, a pełna nazwa
przypadku pozostaje identyczna.  
`W-D`: granica rozłączności poniżej.

## Granica rozłączności

Po commicie testu, przed commitem raportu:

```text
$ git diff --name-only cefa960d00..HEAD
server/src/services/documentStudio/__tests__/day152.reportWord.pg.test.ts
```

Docelowo dojdzie wyłącznie:
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY152_RAPORT_WORD_REPORT.md`.
Zero zmian produktu, generatorów, rendererów, migracji i plików dyżurów
148/150/151.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano pełnej generacji prozy przez dostawcę LLM; brak
  skonfigurowanego dostawcy i Z15 zabraniał zewnętrznego wywołania.
- Nie udowodniono przyczyny spadku 3705→1539 słów; udowodniono tylko, gdzie
  różnica się materializuje i które hipotezy nie pasują do danych.
- Nie wykonano parytetu DOCX względem ekranu ani PDF tego samego schematu.
- Nie wykonano head-to-head z żywym Kimi/Claude; nie jest wymagany w R2, ale
  pozostaje szerszą bramką rubryki.
- `Content-Length` realnej trasy dotyczy koperty JSON/base64, nie surowych bajtów
  DOCX; zgodności 1:1 z 11278 B nie da się potwierdzić na obecnym kontrakcie.

## Podsumowanie bramek

| Bramka | Stan |
|---|---|
| B1 realny DOCX + rozmiar + SHA | PASS |
| B2 generate 200 + export 200 + PK | PASS |
| B3 trzy osie punkt po punkcie | PASS (wykonano ocenę) |
| B4 koniunkcja | PASS (zastosowano; werdykt FAIL) |
| B5 lista 10 punktów | PASS (wypełniono; 5 punktów FAIL) |
| B6 wyjaśnienie spadku | FAIL / NOT_PROVEN |
| B7 system stylowania i realne luki | PASS |
| B8 rozłączność | PASS |

**Końcowy wynik dyżuru: FAIL / NOT READY jako dokument dla klienta.** Techniczna
ścieżka generacji, persystencji i eksportu działa, lecz `useLlm:true` bez
dostawcy fail-softuje do dwustronicowego szkieletu z placeholderami. Nie wolno
mylić HTTP 200 i poprawnego ZIP-a z jakością raportu zarządczego.
