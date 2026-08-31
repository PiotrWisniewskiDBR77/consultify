# CODEX DAY 83 — PPTX EXPORT

Data: 2026-08-29  
Marker: `1e44994196505e0680ce2b1e24468c2300eba75c`  
Gałąź: `codex/day83-pptx-export-20260829`

## Werdykt

**PASS — pętla szablon prezentacji → promocja provenance → deck `201` → PPTX `200` jest domknięta.**

`422 PPTX_CURRENT_RENDER_FAILED` został odtworzony przez realny `ApiGateway`, podpisany JWT i lokalny realny PostgreSQL. Przyczyną nie był brak treści ani biblioteka PPTX, lecz niezgodność persistence: `POST /decks/from-template` zapisywał strukturę tylko do `presentation_cards`, podczas gdy bieżący eksporter normalizuje `deck_json`/`unified_json`. Najmniejsza zmiana zapisuje istniejący kanoniczny `DeckDocument` w tym samym `INSERT`; nie tworzy pustych slajdów i nie osłabia uczciwego błędu dla naprawdę pustego decku.

## §0.1 — wynik dosłowny

`df -h /`:

```text
Filesystem        Size    Used   Avail Capacity iused ifree %iused  Mounted on
/dev/disk3s1s1   1.8Ti    12Gi    75Gi    14%    459k  784M    0%   /
```

Komenda (2), końcówka wiążąca:

```text
65d0f265f7 docs(instrukcje): dyzur 82 (inwentarz kart N) i 83 (eksport PPTX 422)
1e44994196 docs(ledger): DEC-305..308 — Materialy odblokowane, cykl szablonu, grafika 12/18, C.2 domkniete
aa35f13464 merge: dyzur 79 — 6/6 przyczyn, rubryka 7/18 -> 12/18
MARKER OK
```

Krok (4):

```text
[core]
	bare = false
```

Komenda (7):

```text
1e44994196505e0680ce2b1e24468c2300eba75c
```

`git status --short | head -3` nie wypisał linii. Tip był o jeden commit instrukcyjny do przodu (`65d0f265f7`); praca wystartowała dokładnie z markera. Rozjazd zawierał wyłącznie instrukcje dyżurów 82 i 83.

## BLOK 0 i Z30

Porty `5955` i `4770` były wolne. Kontener `cx-day83-pg` używał wyłącznie `127.0.0.1:5955/cx_day83`, obraz `pgvector/pgvector:pg16`. Pierwszy przebieg zastosował pełny łańcuch; niezależny readback `schema_migrations` wykazał **863 migracje**. Drugi przebieg: `Applying migrations: 0`, `Postgres migrations complete`.

Dowody Z30: `BRAK ZMIENNYCH POCZTY`; grep drenów w `server/src/Gateway.ts` zwrócił 0 trafień; zapytanie `settings WHERE key LIKE 'smtp%'` zwróciło `(0 rows)`.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## W1–W3

- W1: kod `PPTX_CURRENT_RENDER_FAILED` występuje w `server/src/routes/presentations.routes.ts:561,2684,2703` oraz w testach/receipt service.
- W2: właściwa ścieżka to `server/src/routes/presentations.routes.ts`.
- W3: `aa35f13464 merge: dyzur 79 — 6/6 przyczyn, rubryka 7/18 -> 12/18` jest w markerze.

## B.1 — odtworzenie

Pakiet: `server/src/routes/__tests__/presentations.templatePptx.day83.pg.test.ts`; realny HTTP przez `ApiGateway.getInstance().initializeRoutes(app)`, realny JWT, realny PostgreSQL, `--retry=0`.

```text
TEMPLATE_CREATE_STATUS 201
PROMOTION_STATUS 201
DECK_GENERATE_STATUS 201
DECK_EXPORT_STATUS 422
DECK_EXPORT_BODY {"success":false,"error":"The current deck has no renderable slides.","code":"PPTX_CURRENT_RENDER_FAILED"}
```

JSON czerwony: `/private/tmp/cx-day83-pptx-export-artefakty/day83-red.json`, SHA-256 `0ff2eed478dcee2793be8ef88a96dee4b6cc697a6a2fcdd01926e85b602004d4`.

## B.2 — przyczyna z plik:linia

Klasyfikacja: **niezgodność schematu/persistence**, nie brak danych, wyjątek biblioteki, zasób ani limit.

- `presentations.routes.ts:2314-2319`: poprawnie rozwiązany szablon ma niepustą tablicę `slides`.
- Stan markerowy `presentations.routes.ts:2333-2347`: `INSERT presentation_decks` nie zawierał `deck_json`; treść trafiała tylko do `presentation_cards` (`:2350-2357`).
- `presentations.routes.ts:651-654`: `ensureCurrentPptxExport` normalizuje dokument z kolumny decku i rzuca dokładnie `The current deck has no renderable slides.` przy braku kart kanonicznych.

Readback wejścia potwierdził uczciwe dane: znacznik znajdował się w `presentation_templates.outline_json` i został zmaterializowany do kart. Nie wolno było zastąpić tego pustym PPTX.

## B.3 — najmniejsza zmiana

`presentations.routes.ts:2321-2347` używa istniejącego `buildDeckDocumentFromStructuredSlides()` i zapisuje wynik do `deck_json` w tym samym `INSERT`. Nie zmieniono warunku `422`, rendererów w `server/src/services/report/pptx/**`, bramek, flag ani wartości domyślnych.

Test dowodowy zapisuje wynikowy bufor dopiero po `200`, sprawdza MIME i niepustą długość. Pakiet końcowy: **1/1 PASS**, JSON `/private/tmp/cx-day83-pptx-export-artefakty/day83-mutation-green.json`, SHA-256 `30bec87cf68dfbe9b412242b4225507e1cf4b84cf9641db37a7edcc6fe2d1eff`.

## B.4 / Z32 — artefakt i dowód mutacyjny

Znacznik: `ZNACZNIK-DAY83-f70e8449-d9db-4bc7-bfa6-c89987b84d3a`.

- PPTX: `/private/tmp/cx-day83-pptx-export-artefakty/day83-template-loop.pptx`
- SHA-256: `fba6377e35e88b30c90250a7436a9bab682f554c76f2d071bcb278d41e3477ba`
- Slajdy: **1**; znacznik jest w OOXML; `unzip -t` nie wykazał błędów.
- PDF: `/private/tmp/cx-day83-pptx-export-artefakty/day83-template-loop.pdf`, SHA-256 `068532cf1272e718a9b3ce0cbacec178fbc9daa46df7c44a7d760c70ac6674c7`, **1 strona**.
- Render poleconym LibreOffice został obejrzany. Slajd jest niepusty: granatowy pas tytułowy, dwa jasne bloki treści i stopka. Pełny znacznik jest widoczny w nagłówku i stopce; powtórzenia w blokach są skrócone wielokropkiem przez layout. Struktura tytułu i hintu z szablonu została zachowana; szablon nie niósł osobnego custom mastera/theme, więc nie twierdzę, że zachowano nieistniejącą własną oprawę wizualną.
- `slides_test.py`: `Test passed. No overflow detected.`

Mutacja przez kopię poza repo:

1. Zielony plik zapisano przez `cp` do `/private/tmp/cx-day83-pptx-export-scratch/presentations.routes.green.ts`.
2. Cofnięto wyłącznie hunk kanonicznego `deck_json`; ten sam test: **FAIL**, `expected 422 to be 200`. JSON `/private/tmp/cx-day83-pptx-export-artefakty/day83-mutation-red.json`, SHA-256 `ad2aed3b672774ac5358c8cb303c21e4d197ebf3c1facfecb14b718941103663`.
3. Zielony plik przywrócono przez `cp`; `cmp` wypisał `GREEN COPY RESTORED: IDENTICAL`; ten sam test: **1/1 PASS**.

## Testy, pułapki Z33 i build

Komenda real-PG używała w jednej linii: `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce DATABASE_URL=postgresql://postgres:cx@127.0.0.1:5955/cx_day83 JWT_SECRET=<lokalny>`, config `server/vitest.config.ts` uruchomiony jako `vitest.config.ts` z katalogu `server`, zawsze `--retry=0`.

Pułapki: (a) wyłączona przez `ENABLE_V8_GLOBAL=true`; (b) wyłączona przez `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`; (c) test asertuje `DB_TYPE=postgres`, `MOCK_DB=false`, a strażnik odczytał `127.0.0.1:5955/cx_day83`; (d) `ENABLE_TEST_AUTH_BYPASS=false`, podpisany JWT przechodzi realny auth; (e) właśnie zmierzono marker z naprawami dyżuru 79 — `422` nadal istniał z innej przyczyny.

Regresja jednostkowa, 3 pliki: 26 przypadków, 22 PASS, 4 zastane FAIL. Porównanie po `(plik, fullName)` przed i po zmianie dało identyczne zbiory po 4 pozycje; oba pliki list mają SHA-256 `bdab051edc675d02c2b5efd767476ccb5e4a5c30223dbdbdf924d32775e986f0`. Lista **zielony przed → czerwony po: PUSTA**. Cztery zastane FAIL leżą wyłącznie w niezmienionym `mapOutlineBlueprintToDeckSlides.test.ts`; nie osłabiono ich.

Build produkcyjny serwera:

```text
Verified 11 server runtime mirror files.
tsc --build tsconfig.build.json --force
build:copy-assets
exit 0
```

## Korekty wobec instrukcji

1. Instrukcja odwołuje się do osobnej „tabeli licencji” i „BLOKU 0”, których jako osobnych sekcji nie zawiera. Bezpieczna interpretacja: §D jest licencją, a §0.2c jest BLOKIEM 0. Zmieniono tylko trasę eksportu/deck creation, jej test i jedyny dozwolony raport.
2. Teza, że naprawy dyżuru 79 mogły usunąć `422`, została obalona pomiarem. Renderer layoutu nie był przyczyną tego `422`; brakowało kanonicznego `deck_json` przed wejściem do renderera.
3. Reporter jednostkowy wykazał 4 FAIL, lecz niezależny przebieg na markerowym hunku wykazał dokładnie te same pełne nazwy. To zastany stan, nie regresja dyżuru 83.

## Kryteria K1–K7

- K1: PASS — `422` odtworzony dosłownie.
- K2: PASS — przyczyna z `plik:linia`, klasyfikacja schemat/persistence.
- K3: PASS — PPTX istnieje, 1 slajd, pełny znacznik w OOXML, SHA powyżej.
- K4: PASS — PDF wyrenderowany i strona obejrzana; opis powyżej.
- K5: PASS — cofnięcie wraca do `422`, przywrócenie daje `200` i plik.
- K6: PASS — uczciwy błąd dla pustego decku pozostał; żadnych pustych atrap.
- K7: PASS — build produkcyjny exit 0; lista nowych czerwonych pełnych nazw pusta.

## Lista plików względem markera

Pierwszy commit i obowiązkowy push po nim: `df3756b087` (`github-backup/codex/day83-pptx-export-20260829`).

```text
server/src/routes/presentations.routes.ts
server/src/routes/__tests__/presentations.templatePptx.day83.pg.test.ts
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY83_PPTX_EXPORT_REPORT.md
```
