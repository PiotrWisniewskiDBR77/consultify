# EXPORT-1 — P2 z Wpisów 166 i 178

Data: 2026-09-17
Tor: B
Baza v2 po finalnym rebase: `1b662df8cd2cac255f008d40a6dd13d3718d879d`
Gałąź v2: `codex/b-pptx-p2-v2-w198-20260917`

## Wynik

Zamknięto siedem mechanicznych uwag P2 z Wpisu 166. Ósma uwaga — dostępność
przycisku eksportu poza `artifactStudioMode` — pozostaje świadomie otwarta, bo
dotyczy ekranu, a bieżące zlecenie Toru B obejmuje Falę 2 bez ekranów.

Poprawka v2 zamyka jedyny P1 z odbioru W178: slajd `risk_management` zachowuje
bloki heading/callout i pas `SO WHAT` równocześnie z natywną tabelą. Karta
`decision|recommend` z tabelą zachowuje ramę decyzyjną.

## Zmiany

1. `X-Presentation-Quality-Warnings` jest ograniczony do 20 pozycji i 4096
   znaków po zakodowaniu. `X-Presentation-Quality-Warning-Count` nadal podaje
   pełną liczbę uwag.
2. `Access-Control-Expose-Headers` zachowuje wcześniejsze wartości i dopisuje
   trzy nagłówki jakości bez duplikatów.
3. Usunięto martwy `allowOverride` z kontraktu jakości i czterech wołaczy.
   Jawny override dla final-export governance pozostaje osobnym kontraktem
   audytowym i nie wpływa na ostrzeżenia DEC-543.
4. Lista formatów Share używa osobnego klucza `pptxFormat = PPTX`; akcja w
   nagłówku zachowuje `Export PPTX`.
5. Flaga serwerowa ma nazwę `ENABLE_EXPORT_PPTX_V2`. Dotychczasowe
   `VITE_EXPORT_PPTX_V2` pozostaje czasowo zgodne wstecz, aby obecny staging nie
   stracił cutoveru przed zmianą konfiguracji.
6. Blok `table` w Board Deck jest mapowany na rolę `table`, nagłówki i wiersze;
   wynikowy OOXML zawiera natywny, edytowalny `<a:tbl>`.
7. Test fail-closed używa prawdziwego `PptxPipelineService`, bez wstrzykniętego
   `generate`. Realny błąd renderera blokuje zapis i persist oraz zachowuje
   poprzednie bajty pliku.
8. Renderer tabeli pokazuje treść bloków nietabelowych nad tabelą, skaluje
   wysokości wierszy do przestrzeni przed pasem wniosku i używa tego samego
   komponentu `SO WHAT` co slajd `content-one`.

## Walidacja

- czyste `npm ci --ignore-scripts` z lockfile: `@types/node 22.19.3` zgodne z
  `package-lock.json`;
- `npx tsc --build server/tsconfig.build.json --pretty false`: RC=0, 0 błędów;
- focused: 5 plików, 35 testów PASS; opcjonalny szósty plik RealPG pominięty
  bez `RUN_DB_TESTS=1` i nie jest liczony do wyniku;
- scoped ESLint: 0 błędów;
- locale JSON: EN/PL poprawny, `Export PPTX` i `PPTX` rozdzielone;
- pełny front `tsc --noEmit` z limitem 8 GB: linia 152 = kandydat 152,
  logi byte-identical; 0 diagnostyk w zmienionych plikach;
- mutacja usuwająca pas `SO WHAT` z `renderTable`: RED 1/1;
- `git diff --check`: PASS.

Dowód binarny v2: `docs/program/EXPORT_1_PPTX_P2_W198_20260917/dowody/`.
PPTX ma SHA-256 `04b0dd54aa3f49d8566dcfa0fa16c939d8ccd952fe8039fe549f82464a9b651d`;
LibreOffice render slajdu 2 pokazuje heading, headline, tabelę i pas `SO WHAT`
bez kolizji ani pustej połowy.

## Granice

Nie zmieniono ekranu ani warunku `artifactStudioMode`, nie ustawiono zmiennych,
nie wykonano deployu i nie zmieniono chronionych refów. Paczka nie dotyka Toru A.
