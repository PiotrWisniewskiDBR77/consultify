# EXPORT-1 — P2 z Wpisu 166

Data: 2026-09-17  
Tor: B  
Baza: `1ca425abfa26e92aa1e6f975105ceb62e57884d1`  
Gałąź: `codex/b-pptx-p2-w166-20260916`

## Wynik

Zamknięto siedem mechanicznych uwag P2 z Wpisu 166. Ósma uwaga — dostępność
przycisku eksportu poza `artifactStudioMode` — pozostaje świadomie otwarta, bo
dotyczy ekranu, a bieżące zlecenie Toru B obejmuje Falę 2 bez ekranów.

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

## Walidacja

- czyste `npm ci --ignore-scripts` z lockfile: `@types/node 22.19.3` zgodne z
  `package-lock.json`;
- `npx tsc --build server/tsconfig.build.json --pretty false`: RC=0, 0 błędów;
- focused: 6 plików, 40 testów PASS (quality headers/route, Board Deck,
  renderer, real renderer fail-closed, Share Modal);
- scoped ESLint: 0 błędów;
- locale JSON: EN/PL poprawny, `Export PPTX` i `PPTX` rozdzielone;
- pełny front `tsc --noEmit`: RC=2, 152 zastane błędy, 0 diagnostyk w
  `ShareModal.tsx` i innych zmienionych plikach;
- `git diff --check`: PASS.

## Granice

Nie zmieniono ekranu ani warunku `artifactStudioMode`, nie ustawiono zmiennych,
nie wykonano deployu i nie zmieniono chronionych refów. Paczka nie dotyka Toru A.
