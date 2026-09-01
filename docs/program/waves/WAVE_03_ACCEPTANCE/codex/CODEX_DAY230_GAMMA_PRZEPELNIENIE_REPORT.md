# CODEX DAY 230 — GAMMA / PRZEPEŁNIENIE — RAPORT

Data: 2026-09-01  
Marker: `0a35699021`  
Gałąź: `codex/day230-gamma-przepelnienie-20260901`  
Commity: `3f08d78a1a`, `22446291e4`

## Werdykt

Rdzeń R1–R3/R5/R6 wykonany za jedną flagą `ENABLE_DECK_OVERFLOW_WARNING`, domyślnie OFF.
Przed pobraniem PPTX/PDF produkt wykonuje uwierzytelniony preflight, zwraca nieblokującą listę
ostrzeżeń, wskazuje slajd 1-based i pozwala świadomie kontynuować. Deck poprawny daje ciszę.
Przy fladze ON kanoniczny `PptxPipelineService` nie emituje pięciu `fit:'shrink'` objętych
licencją; OFF zachowuje dzisiejsze opcje.

Detektor jest celowo heurystyczny. W próbie pięciu slajdów ostrzegł 3/5, realny render
LibreOffice wykazał widoczne przepełnienie 1/5: 2 false positive, 0 false negative. Ostrzeżenie
nie może być blokadą.

## Stan wejściowy — wyniki dosłowne

```text
Filesystem        Size    Used   Avail Capacity iused ifree %iused  Mounted on
/dev/disk3s1s1   1.8Ti    12Gi    11Gi    53%    459k  113M    0%   /
MARKER OK
```

```text
0a3569902119880841d30e0e5fac57879d1e5be0
```

`git status --short | head -3` nie wypisał żadnej linii. Po utworzeniu worktree pozostało
7,4 GiB. Porty `6174`, `5136`, `5137` były wolne. Kontener: `cx-day230-pg`, wyłącznie
`127.0.0.1:6174`.

Tip wyprzedzał marker wyłącznie commitem instrukcji `a052ae1f7f`; diff nie zawierał kodu.
Pomiar kolizji na `pptx/` i `presentations.routes.ts` był pusty.

## Korekty wobec instrukcji

1. T1: komenda z instrukcji nie liczy „realnych emisji”. Dała `20` i `11`, ponieważ policzyła
   cztery komentarze. Pomiar linii składniowych na markerze wykazał **16 realnych emisji**,
   w tym 10 w `DeckStyler`, nie 17/10.
2. T5: grep nie zwrócił zera, tylko siedem plików. Testują limity, flagi audytu i marker
   truncation, ale nie mierzą przepełnienia po wygenerowaniu bajtów w rendererze docelowym.
   Teza „zero testów zawierających overflow” jest fałszywa; węższa teza „zero testu realnego
   renderu overflow” była prawdziwa na wejściu.
3. T6: `new PDFDocument` przesunął się z ok. 2973 na 3012.
4. T7: zakres `3768:3800` trafił po scaleniach w eksport HTML. Trasa jest na 3808. Faktycznie
   porównuje manifesty rekordów eksportu: page count, header/footer, watermark, sekcje i status.
   Nie renderuje plików, nie mierzy geometrii ani przepełnienia. Nie rozszerzałem jej: rdzeń
   wymaga pomiaru przed eksportem, a `export-parity` działa po zapisaniu rekordów.
5. Pierwszy przebieg realdb z roota i `--config server/vitest.config.ts` dał uczciwe
   `No test files found`, exit 1. Poprawny przebieg wykonano z katalogu `server/`, plikiem
   `src/routes/__tests__/day230.overflow-preflight.pg.test.ts` i `--config vitest.config.ts`.

## Tabela 1 — realne emisje `fit:'shrink'` na markerze

| # | Plik:linia | Tor / ochrona | Wynik decyzji |
|---:|---|---|---|
| 1 | `DeckStyler.ts:425` | zapasowy; tekst layoutu | tylko pomiar, plik nietykalny |
| 2 | `DeckStyler.ts:545` | zapasowy; tekst layoutu | tylko pomiar |
| 3 | `DeckStyler.ts:592` | zapasowy; tekst layoutu | tylko pomiar |
| 4 | `DeckStyler.ts:680` | zapasowy; tekst layoutu | tylko pomiar |
| 5 | `DeckStyler.ts:756` | zapasowy; tekst layoutu | tylko pomiar |
| 6 | `DeckStyler.ts:781` | zapasowy; tekst layoutu | tylko pomiar |
| 7 | `DeckStyler.ts:902` | zapasowy; tekst layoutu | tylko pomiar |
| 8 | `DeckStyler.ts:994` | zapasowy; tekst layoutu | tylko pomiar |
| 9 | `DeckStyler.ts:1017` | zapasowy; tekst layoutu | tylko pomiar |
| 10 | `DeckStyler.ts:1091` | zapasowy; tekst layoutu | tylko pomiar |
| 11 | `UnifiedExportService.ts:693` | osobny eksport partner/certyfikat; body | poza licencją, czerwony brief zamiast zmiany |
| 12 | `PptxPipelineService.ts:490` | kanoniczny PPTX; stopka | usunięte przy ON, OFF bez zmiany |
| 13 | `Badge.ts:42` | kanoniczny PPTX; etykieta | usunięte przy ON, OFF bez zmiany |
| 14 | `Highlight.ts:43` | kanoniczny PPTX; wyróżnienie | usunięte przy ON, OFF bez zmiany |
| 15 | `KpiValue.ts:66` | kanoniczny PPTX; liczba w kaflu | usunięte przy ON, OFF bez zmiany |
| 16 | `SlideTitle.ts:143` | kanoniczny PPTX; tytuł | usunięte przy ON, OFF bez zmiany |

Rozstrzygnięcie: droga A dla kanonicznego toru pobrania prezentacji. Usunięcie pięciu emisji
jest warunkowe. Nie zmieniono stopni, wag, interlinii, kolorów, layoutów ani `DeckStyler`.
Wpływ wizualny zmierzono na realnym PPTX: bez shrink długie treści pozostają widocznie
przepełnione zamiast być cicho kurczone; slajd 5 nachodzi na tytuł i wychodzi z pola.

## Detektor i kontrakt

`wykryjPrzepelnienie` zwraca `slideIndex`, `slideTitle`, `powod`, `zmierzone`, `budzet`,
`pewnosc`. Używa istniejącego `resolveSlotCapacity`; rejestr pojemności pozostał tylko do
odczytu. Priorytet na slajdzie: tytuł, treść, lista; najwyżej jedno ostrzeżenie na slajd.
`pewnosc=wysoka` dopiero od 1,5× budżetu.

UI używa realnego komponentu `DeckOverflowWarning`, wyłącznie tokenów `c-*`, bez `primary-*`.
Komunikat jest przed pobraniem, nie zwraca 422 i ma działające przejście do slajdu.

## Pomiar pięciu realnych renderów

Wejście miało długości 120, 220, 241, 360, 721 znaków. Detektor ostrzegł slajdy 3, 4, 5.
Po `soffice -> PDF -> pdftoppm -> PNG`:

| slajd | długość wejściowa | detektor | realny render |
|---:|---:|---|---|
| 1 | 120 | cisza | mieści się |
| 2 | 220 | cisza | mieści się |
| 3 | 241 | niska | mieści się — false positive |
| 4 | 360 | wysoka | mieści się na granicy — false positive |
| 5 | 721 | wysoka | widoczne nachodzenie i wyjście z pola — true positive |

Na tej małej próbce próg znakowy 240 był co najmniej 129 znaków bardziej konserwatywny niż
granica widocznego błędu (>369). Nie wyznacza to pełnego błędu dla innych layoutów i krojów.

## Dowód HTTP / PostgreSQL

Komenda miała w tej samej linii: `RUN_DB_TESTS=1`, `MOCK_DB=false`, `DB_TYPE=postgres`,
`NODE_ENV=test`, `ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false`,
`RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, lokalny `DATABASE_URL`, lokalny
`JWT_SECRET`, `--retry=0`.

Wynik: realny `ApiGateway`, podpisany JWT OWNER, tenant fixture i PostgreSQL `cx230`:

```text
DB_IDENTITY role=app identity=127.0.0.1:6174/cx230
ON ... slideIndex 3 — PASS, HTTP 200
OFF zachowuje ciszę — PASS, HTTP 200
Test Files 1 passed; Tests 2 passed
```

Pułapki Z33: V8 jawnie ON, auth bypass jawnie false, visibility mode enforce, DB identity
potwierdzona. Quality gate nie odciął preflightu, bo preflight jest po autoryzacji i odczycie
decku, ale przed bramką eksportową; nie zmienia semantyki 422.

## Mutacje w obie strony

1. Detektor zawsze pusty: przypadek przepełniony czerwony (`expected [] to have length 1`).
2. Detektor ostrzega zawsze: przypadek czysty czerwony (`expected [...] to deeply equal []`),
   a przypadek przepełniony czerwony także na błędnym `slideIndex: 1` zamiast 3.
3. Po cofnięciu: 2/2 PASS i `cmp` potwierdził identyczny plik produkcyjny.

## Zrzuty

Dane ekranów pochodzą z propsów harnessu, nie z realnego przebiegu HTTP. To dowód renderu
realnego komponentu i montażu w harnessie, nie dowód danych. Dowodem danych jest test Gateway/PG.

| stan | motyw | mean_luma | SHA-256 |
|---|---|---:|---|
| overflow | jasny | 245.0 | `3a7e19dc1fa9ccfee3e570ebd09835832cc2097e433bd89ce17b5e7881d98e66` |
| overflow | ciemny | 28.4 | `0bff56208ef2163f4e3077aed5012c29471a96dbe0d2d4464057bfdcac66bce3` |
| clean | jasny | 247.1 | `fea3bb4307f3e9d9a47dd1f89da547f36dfc93f7cc29e7e6575ad6884f343464` |
| clean | ciemny | 25.4 | `3a763e4e1e9ab6d6ac4765a9ff18a7e1d892739bfed04bab81aa400b7fb7eb52` |

Różnice luma: overflow 216,6; clean 221,7. Obie >150. Stan clean nie renderuje pustej ramki.

## R4 — stopnie jakości i format

Pomiar T8: brak `basic/standard/detailed/exportQuality`. Dzisiejszy PPTX jest głównie OOXML;
nie znaleziono wiarygodnego parametru, który dawałby trzy mierzalnie różne pliki bez wejścia
w cudze layouty/obrazy. Nie wdrożono fantomowych stopni jakości.

Rozstrzygnięcie pozostaje: PDF dla dystrybucji, PPTX dla edytujących, ale PDF nie jest dziś
wiernym obrazem PPTX. PDF używa osobnego `pdfkit` i deklaruje `X-Consultify-Visual-Parity:
not-claimed`; `export-parity` sprawdza manifest, nie wygląd.

## Zasięg testów po pełnych nazwach

Przed: 2361 nazw. Po: 2370 nazw. Dodano 9 nazw Day230, zniknęło 0. Zastany szeroki pakiet:

| etap | suites PASS/FAIL | tests PASS/FAIL/PENDING |
|---|---|---|
| przed | 658 / 123 | 1927 / 208 / 226 |
| po | 664 / 125 | 1934 / 208 / 228 |

Szeroki pakiet nie jest zielony. Liczba zastanych failure pozostała 208. Targetowane Day230:
detektor 2/2 PASS, shrink 2/2 PASS, UI/preflight 3/3 PASS, Gateway/PG 2/2 PASS.

## Artefakty poza repo

Katalog: `/private/tmp/cx-day230-gamma-przepelnienie-artefakty`.

- `migracje-1.log` — `8aeb8fa3748368e9ecbc62d4750692e4fe853403f107818c7bf232102bf7e999`
- `migracje-2.log` — `f1d1f67570ac2abc418ba6eb4b508e975b11943126f58a8d78474372b89be3ae`
- `przed-pakiet.json` — `3ed126d04bcf6002da737e5d4ce15d45974b2a2b637cc1ca5d013fe6dac7fab1`
- `po-pakiet.json` — `cca35200b191c48ecad6d4bc17aa83a03fce0dd34c74a7f60d851aee0ae2d69d`
- `nazwy-diff.txt` — `12c15ba9d51c75d85db95b701fd3328d81a29925762eca361268d77c04a669a6`
- `mutacja-detektor-pusty.log` — `4e749812215e0501f3f2f598a7cace119c9148653c9831dad63b628eff06bd52`
- `mutacja-detektor-zawsze.log` — `0805366eb9b52bc5de408913820036a5d5f2083889c125723f354873a0cf24d7`
- `detektor-green.log` — `3bb20ab96570c452758b7918babfa7fca2d6311d76244737c4b7eff65a790ac5`
- `day230-five-slides.pptx` — `cc0494378bc1409fff8a54d74c992000b6e89cbfc071d580fd1215a6cd7e4711`
- `rendered/day230-five-slides.pdf` — `6d009b17a442a33a5b9273ad1a8137c47b3dc63ab5367953fe3cb11a7878d435`

## Z30

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy
konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden
e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## TWIERDZENIA NIEZWERYFIKOWANE

1. Nie zweryfikowano marginesu błędu na wszystkich 17 intencjach, krojach PowerPoint/Keynote
   ani Google Slides; próbka obejmuje pięć slajdów jednego layoutu i LibreOffice.
2. Nie udowodniono, że próg 1,5× optymalnie rozdziela `wysoka/niska`; to jawna konserwatywna
   heurystyka do dalszej kalibracji.
3. Nie wykonano trzech stopni jakości, ponieważ brak mierzalnego parametru zmieniającego plik
   bez wejścia w cudzy zakres obrazów/layoutów.
4. `UnifiedExportService.ts:693` pozostaje z `fit:'shrink'`, bo plik nie był licencjonowany;
   nie jest konsumentem trasy pobrania decku.
5. Zrzuty są harnessowe. Pełny runtime produktowy nie był uruchamiany; realny przewód danych
   potwierdzono osobno przez Gateway/PG.
