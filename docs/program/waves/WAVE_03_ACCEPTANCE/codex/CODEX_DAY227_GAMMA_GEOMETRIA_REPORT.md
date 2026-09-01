# CODEX — DYŻUR 227 — GAMMA / GEOMETRIA PPTX

Data: 2026-09-01  
Gałąź: `codex/day227-gamma-geometria-20260901`  
Marker wiążący z wklejki: `30a6575f7a`  
Commit produktu i testów: `2c487379e8`

## Wynik

R1, R2 i R3 wykonane. Flaga `ENABLE_PPTX_CANONICAL_GEOMETRY` ma default `false` i
steruje razem geometrią `DeckStyler` oraz wpisem `harvard`. Przy OFF zachowane są
wartości historyczne (`0.6`, `1.7`, `A41034`). Przy ON `DeckStyler` czyta
`contentX`/`contentY` z `designTokens.ts`, a `harvard` czyta most marki
`PRODUCT_BRAND_PRIMARY = '#85182F'`.

Test R3 generuje realne bufory obiema drogami, rozpakowuje PPTX/OOXML i mierzy
`a:off` pierwszego elementu treści. Wynik zmierzony:

- OFF: kanoniczny `(0.5, 1.0)`, zapasowy `(0.6, 1.7)`, delta `(0.1, 0.7)` cala;
- ON: oba `(0.5, 1.0)`, delta `(0, 0)` cala.

Renderer geometrii nie wymagał bazy ani LLM. Efemeryczny RealPG został mimo to
uruchomiony i zmigrowany zgodnie z obowiązkowym blokiem wejściowym instrukcji.

## Blok wejściowy — wynik dosłowny

```text
MARKER OK
PORT 6171 WOLNY
PORT 5130 WOLNY
PORT 5131 WOLNY
30a6575f7a9945a756d9ae8e1011f567e48bedad
```

Wolne miejsce przed startem: `7.3Gi` (>5 GB). Pierwsza migracja zastosowała
`879` migracji i zakończyła się `✅ Postgres migrations complete`. Drugi przebieg:

```text
Applying migrations: 0
✅ Postgres migrations complete
```

SMTP po migracjach:

```text
BRAK ZMIENNYCH POCZTY
 key | left
-----+------
(0 rows)
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane.

## Korekty wobec instrukcji

1. Marker `9fb7942a01` z dokumentu został zastąpiony przez wiążący marker
   `30a6575f7a` z wklejki użytkownika. Marker jest przodkiem aktualnego tipa.
2. Lokalny ref gałęzi istniał na starym markerze `9fb7942a01`, bez zdalnej
   gałęzi, bez worktree i bez commitów unikalnych względem nowego markera.
   Usunięto wyłącznie ten pusty ref i odtworzono zamówioną gałąź z
   `30a6575f7a`.
3. Pomiar hexów na nowej bazie dał `designTokens.ts = 0`, nie `53`.
   `DeckStyler.ts = 10`, zgodnie z instrukcją. Przyczyna różnicy pierwszej
   liczby: kolory w `designTokens.ts` są zapisane bez prefiksu `#`, więc podany
   grep `#[0-9A-Fa-f]{6}` ich nie liczy. Nie przepisywano tej liczby z briefu.
4. `themeRegistry.ts` nadal nie ma geometrii. Geometria zapasowa pozostaje w
   `DeckStyler.ts`.
5. `initiativeMaterializeService.ts:488` nadal woła
   `deckPlansToPptxBuffer` bez flagi i bez fallbacku. Nie zmieniano wyboru
   renderera.
6. Aktualny pomiar wykazał dziewięć plików callerów i dziesięć instancjacji
   `PptxPipelineService` (dwie w `report-builder.routes.ts`), jeden importer
   `DeckStyler` i dwa moduły wołające `deckPlansToPptxBuffer`.
7. Tip po markerze dotyka `server/src/config/FeatureFlags.ts` (dyżur 221).
   Zgodnie z instrukcją nie wykonano rebase; scalenie wykonuje nadzorca.

## Testy i pełne nazwy

Komenda rdzenia (bez DB, bez retry):

```bash
RUN_DB_TESTS=0 MOCK_DB=true DAY227_ARTIFACT_DIR=/private/tmp/cx-day227-gamma-geometria-artefakty \
npx vitest run server/src/services/report/pptx/__tests__/day227.gammaGeometry.test.ts \
  --retry=0 --reporter=json \
  --outputFile=/private/tmp/cx-day227-gamma-geometria-artefakty/day227-targeted-final.json
```

Wynik: 4/4 pełne przypadki PASS:

```text
Day 227 canonical PPTX geometry measures legacy OFF output as 0.1in wider margin and 0.7in lower content
Day 227 canonical PPTX geometry measures flag ON output from both real PPTX files at the same content coordinates
Day 227 canonical PPTX geometry keeps the server brand bridge synchronized with the frontend canonical token
Day 227 canonical PPTX geometry keeps Harvard legacy color OFF and resolves the product brand bridge ON
```

Pomiar zasięgu całych dwóch licencjonowanych katalogów:

- przed: 23 suites, 22 passed, 1 loader failure; 41/41 wykonanych asercji PASS;
- po: 25 suites, 24 passed, 1 ten sam loader failure; 45/45 wykonanych asercji PASS;
- dodane: dokładnie cztery pełne nazwy powyżej;
- zniknięte: zero.

Artefakty nazw:

- `/private/tmp/cx-day227-gamma-geometria-artefakty/przed-nazwy.txt`
- `/private/tmp/cx-day227-gamma-geometria-artefakty/po-nazwy.txt`
- `/private/tmp/cx-day227-gamma-geometria-artefakty/nazwy.diff`

Zastany loader failure przed i po zmianie:

```text
pptxPipelineGenerateDownload.test.ts: Failed to resolve import "tesseract.js"
from server/src/services/ai/deckImageSafetyGates.ts
```

`node_modules` jest zgodnie z instrukcją wyłącznie symlinkiem do checkoutu
właściciela; nie instalowano ani nie dopisywano tam zależności. Dlatego pełnej
suity nie nazywam zieloną. Target dyżuru jest zielony i nie importuje tej
nieosiągalnej zależności.

`tsc -p server/tsconfig.json --noEmit` kończy się jednym zastanym błędem z tego
samego łańcucha: `deckImageSafetyGates.ts(9,34): Property 'recognize' does not
exist ...`. ESLint pięciu zmienionych plików: 0 errors; trzy ostrzeżenia (dwa
zastane `no-explicit-any` w visual directorze oraz zamówiony literal mostu
marki). `git diff --check`: czysto. Hook commita przeszedł.

### Pułapki §0.2d dla pakietu dowodowego

- (a), (b), (d): nie leżą na ścieżce — test nie montuje HTTP, Gateway ani
  middleware; mierzy lokalne, deterministyczne renderery PPTX.
- (c): pakiet ma `RUN_DB_TESTS=0 MOCK_DB=true`; oba renderery wykonują się bez
  zapytań DB. RealPG nie jest używany jako dowód R3.
- (e): dotyczy bezpośrednio. Test nie zakłada lokalizacji geometrii, tylko
  rozpakowuje dwa realne pliki i czyta współrzędne OOXML; osobny test zachowania
  premium z mockowanym planistą (zero LLM) mierzy wynik `harvard` OFF/ON.

## Dowody mutacyjne RED → GREEN

R1 — cofnięto tylko wiązanie `DeckStyler` do kanonicznego gridu:

```text
RED: expected 0.09999999999999998 to be close to 0
GREEN: measures flag ON output ... passed
```

R2 most — zmieniono tymczasowo most z `#85182F` na `#A41034`:

```text
RED: tailwind.config.js nie zawierał DEFAULT: '#A41034'
GREEN: keeps the server brand bridge ... passed
```

R2 Harvard — wymuszono tymczasowo legacy także przy ON:

```text
RED: expected 'A41034' to be '85182F'
GREEN: keeps Harvard legacy color OFF ... passed
```

Każda mutacja była odkładana/przywracana przez `cp` w katalogu scratch; nie
użyto `git stash`. Po przywróceniu diff zawiera wyłącznie docelowe zmiany.

## Realne eksporty i kontrola wizualna

Pliki (realne eksporty, nie atrapy):

```text
1b519307f69ce82c2a5a3da494956c11334ca0e3de80a3485601d2304c452b97  /private/tmp/cx-day227-gamma-geometria-artefakty/day227-canonical-on.pptx
a2041f3e2e510a0760771fec75d21c1b02a5086feabf4c9134f0cef363be5e2f  /private/tmp/cx-day227-gamma-geometria-artefakty/day227-fallback-on.pptx
```

Oba PPTX wyrenderowano narzędziem prezentacyjnym do PNG. `slides_test.py`:
`Test passed. No overflow detected.` dla obu. Obejrzano każdy slajd w pełnym
rozmiarze: kanoniczny 1/1, zapasowy 3/3. Nie stwierdzono clippingu, overlapu ani
zawijania tytułu. Na slajdach treści lewy margines i góra treści są zgodne ON.

`mean_luma`: kanoniczny content `223.768`; fallback dark cover `60.121`, content
`249.076`, dark closing `59.222`. Różnica fallback content/cover = `188.955`
(>150).

PNG porównawcze:

```text
6c78a96995b2f0f077ff4fb3f65dd01fbfde17b98b7773ab49d2b071b8f7e26b  /private/tmp/cx-day227-gamma-geometria-artefakty/day227-canonical-on/slide-1.png
335da55b5d46e4ddca9189e105db61fa66a5ffa10aebb3593ca042411a275f8e  /private/tmp/cx-day227-gamma-geometria-artefakty/day227-fallback-on/slide-2.png
```

## TWIERDZENIA NIEZWERYFIKOWANE

Wymagane twierdzenia z instrukcji zostały zweryfikowane następująco:

- `themeRegistry.ts` bez geometrii: POTWIERDZONE pomiarem;
- inicjatywy nadal wołają zapasowy renderer bez flagi/fallbacku: POTWIERDZONE;
- hexy `designTokens.ts` / `DeckStyler.ts`: ZMIERZONE `0 / 10`, teza `53 / 10`
  obalona dla podanej komendy;
- `harvard` różny przed i zgodny ON po zmianie: POTWIERDZONE zachowaniem oraz
  mutacją RED → GREEN;
- R3 czyta bajty wygenerowanych plików: POTWIERDZONE, nie jest to grep kodu;
- renderer wymaga DB: OBALONE — test działa z `RUN_DB_TESTS=0`;
- zrzuty z realnego eksportu: POTWIERDZONE renderem obu buforów i SHA-256.

Nie zweryfikowano zachowania w pełnym runtime `server/src/index.ts`, bo R3 jest
bramką rendererów bez HTTP/DB, a instrukcja zabrania uruchamiania pełnego
serwera dla testów. Nie wykonano żadnego połączenia do Railway/demo/staging/
produkcji.
