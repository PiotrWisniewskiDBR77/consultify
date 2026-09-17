# [A] Wpis 15 zadanie 2 — segfault rendererów w vitest: pomiar przyczyny

Data pomiaru: 2026-09-16 23:39 → 2026-09-17 00:20 (czas lokalny).
Stanowisko: `~/Developer/qoder-wt/consultify-vitest-render`, gałąź `qoder/vitest-render-20260917`,
baza `8ca34fb518` (= `origin/integracja/20260911` po fetchu 2026-09-16 23:35).
Zakres pomiaru: wyłącznie sondy i tymczasowe konfiguracje (nieśledzone). **Zero zmian w plikach śledzonych** —
`git status --porcelain | rg -v '^\?\?'` = pusty.

## Werdykt pomiaru

To NIE jest defekt konfiguracji vitest. Ten sam kod pada poza vitest: `npx tsx` → **EXIT=139 (SIGSEGV) 3/3**.
Przyczyna: w jednym procesie Node ładowane są **dwie różne fizyczne binarki Skii** (`@napi-rs/canvas`):

- `0.1.80` — ładowana przy **samym imporcie** `pdf-parse` (pdfjs-dist robi `require("@napi-rs/canvas")`
  na poziomie modułu, gdy `isNodeJS`): `pdfjs-dist/legacy/build/pdf.mjs:14341` (init) i `:14386`
  (`NodeCanvasFactory._createCanvas`);
- `1.0.9` — ładowana przez rasteryzator wykresów: `server/src/services/documentStudio/documentChartRasterizer.ts:53`
  (`await import('@napi-rs/canvas')`), wołany z `documentDocxRenderer.ts:359` (wykresy DRD 2100×1212).

Po załadowaniu obu, następne rysowanie przez Chart.js/Skia zabija proces natywnie (SIGTRAP/SIGSEGV w
`skia.darwin-arm64.node`), probabilistycznie — nie każdym razem, dlatego objaw wygląda na „flaky".

## Dowód: ile Skii ładuje każda ścieżka (`process.report.getReport().sharedObjects`)

| sonda | ścieżka | załadowane binarki Skii | EXIT |
|---|---|---|---|
| probe20 | tylko pdf-parse/PDFParse (parse PDF) | **1** → `.pnpm/@napi-rs+canvas-darwin-arm64@0.1.80/.../skia.darwin-arm64.node` | 0 (3/3) |
| probe21 | tylko render wykresu (chart rasterizer) | **1** → `.pnpm/@napi-rs+canvas-darwin-arm64@1.0.9/.../skia.darwin-arm64.node` | 0 |
| g1 (plik) | import pdf-parse + rendery DOCX/PPTX/PDF | **2** (obie naraz) | 1 / 139 |
| probe22 (`tsx`) | chart + PDFParse, 3 rundy | round 1: before=1 (0.1.80) → after=**2** | **139** (3/3), śmierć w rundzie 2 |

Raporty crasha macOS (oba pokazują **DWIE** pozycje `skia.darwin-arm64.node` w `usedImages`):
- `node-2026-09-16-234246.ips` — `EXC_BREAKPOINT / SIGTRAP`, faulting thread 0 (main), 4 górne ramki w `skia.darwin-arm64.node`, wywołane z `v8impl::FunctionCallbackWrapper::Invoke` przez `Builtins_ConstructHandler` w `AsyncFunctionAwaitResolveClosure` (konstruktor wołany z `await`);
- `node-2026-09-16-234700.ips` — `EXC_BAD_ACCESS / SIGSEGV`, ten sam kształt stosu.

## Minimalne repro (2.1)

Jeden `it`, bez żadnego rendera PDF — wystarczy **import** `pdf-parse` obok rendera wykresu:

```ts
import { PDFParse } from 'pdf-parse';            // ładuje Skia 0.1.80 (init modułu pdfjs)
import { renderChartBlockToPng } from '.../documentChartRasterizer.js';  // ładuje Skia 1.0.9
it('crash', async () => { await renderChartBlockToPng(chartBlock, { width: 2100, height: 1212, drdProfile: true }); });
```

Wynik: **1/3 EXIT=0, 2/3 „Worker exited unexpectedly"** (sonda probe16). Kontrola: ten sam render BEZ
importu `pdf-parse` = **3/3 EXIT=0** (probe11), a render wykresu w pętli = EXIT=0 (probe12, 1 blok wykresu,
213723 B dla fixture z findingami / 154283 B dla fixture pustej). Sam `PDFParse` bez wykresu = **3/3 EXIT=0**
(probe15, textLen 4620).

Porównanie środowisk (2.1): `tsx` vs vitest — **oba padają** (tsx 139, vitest forks „Worker exited
unexpectedly" / threads 139). Różnica ESM/CJS, `isolate`, `environment` nie ma znaczenia: decyduje liczba
załadowanych binarek Skii w procesie, nie runner.

## Pełny plik g1 na bazie (12 testów) — wszystkie warianty poola

| przebieg | EXIT | wynik |
|---|---|---|
| domyślny pool, run 1 | 1 | 0/12, `Worker forks emitted error` / `Worker exited unexpectedly`, import 757 ms, tests 0 ms |
| domyślny pool, run 2–4 | 1, 1, 1 | run 3: `Tests 1 passed (12)` — padł po pierwszym teście |
| `--pool=forks`, run 1 | 0 | `12 passed (12)` ← **jedyny zielony przebieg, nieodtwarzalny** |
| `--pool=forks`, run 2–4 | 1, 1, 1 | run 3: `1 passed (12)` |
| `--pool=threads` | **139** | SIGSEGV |

Czyli `pool: 'forks'` **nie jest naprawą**: 1/4 przebiegów zielony.

## Bisekcja po nazwie testu (`-t`, konfiguracja bazowa, 2 przebiegi na filtr)

| filtr `-t` | EXIT run 1 | EXIT run 2 | co robi test |
|---|---|---|---|
| `fixture Northwind-like` | 1 | 1 | render DOCX → rasteryzacja wykresu (Skia 1.0.9) |
| `okładka EN` | 1 | 0 | render DOCX → rasteryzacja wykresu |
| `DOCX EN z findingami` | 1 | 0 | render DOCX → rasteryzacja wykresu |
| `PPTX i PDF EN z findingami` | 0 | 0 | PPTX + PDF (pdfkit) + `PDFParse` — **bez** rasteryzacji wykresu |

Padają wyłącznie filtry, które uruchamiają rasteryzację wykresu; filtr bez wykresu jest stabilny
(logi tego przebiegu zachowane: `logs/qoder-a-bisect-*.log`, `Tests 1 passed | 11 skipped (12)`).
Uwaga uczciwościowa: pętla zapisująca logi bisekcji nadpisywała te same dwa pliki, więc dla trzech
pierwszych filtrów zostały tylko kody EXIT zmierzone na terminalu, bez pełnych logów.

## Zmierzone warianty KONFIGURACYJNE (żaden nie daje stabilności)

| wariant | zmiana | wynik |
|---|---|---|
| base | — | g1: 0/4 EXIT=0 |
| forks | `--pool=forks` | g1: 1/4 EXIT=0 |
| A | `server.deps.inline: ['pdf-parse']` + alias `@napi-rs/canvas` → repo 1.0.9 | probe16: 3/3 OK (poprawa), probe15 OK (textLen 4620), ale probe14 1/3 i probe17 0/2 → g1 nadal pada |
| A2 | `inline: ['pdf-parse','pdfjs-dist']` + alias → repo 1.0.9 | g1: 0/3 EXIT=1 |
| H | alias `@napi-rs/canvas` → katalog canvas widziany z `pdfjs-dist` | probe21: 1 Skia (ale inna kopia fizyczna), g1: 0/3 EXIT=1 |
| H2/H3 | alias JS + binarki platformy na realpath | probe17: 0/1, g1 nie testowane dalej — alias i tak nie trafia w plik, który `dlopen`-uje natywny `require` pdfjs |

Dlaczego alias nie wystarcza: `require` w pdfjs jest **natywny** (`createRequire(import.meta.url)`), więc
nie przechodzi przez resolver Vite; a w drzewie `node_modules` jest kilka fizycznych kopii tej samej
wersji — alias nie jest w stanie zrównać ścieżki `dlopen` z tą, którą wybierze Node.

## Topologia `node_modules` (współdzielone z głównym repo — poza moim zasięgiem)

`find node_modules -name 'skia.darwin-arm64.node'` → **4 różne sumy sha256**:

| sha256 (16) | rozmiar | ścieżka względem `node_modules/` |
|---|---|---|
| `d88cb94e049adb94` | 27M | `.pnpm/@napi-rs+canvas-darwin-arm64@1.0.9/.../skia.darwin-arm64.node` ← ścieżka wykresów (produkcyjna) |
| `b6b2f5cc20d4d536` | 23M | `.pnpm/@napi-rs+canvas-darwin-arm64@0.1.80/.../skia.darwin-arm64.node` ← ładowana przez natywny `require` pdfjs |
| `b6b2f5cc20d4d536` | 23M | `.ignored_pdf-parse/node_modules/@napi-rs/canvas-darwin-arm64/skia.darwin-arm64.node` ← katalog `.ignored_pdf-parse` = ślad wcześniejszej ręcznej interwencji |
| `a9c429727b4a133e` | 25M | `pdfjs-dist/node_modules/@napi-rs/canvas-darwin-arm64/skia.darwin-arm64.node` ← realny katalog (data 20.08), nie symlink pnpm |
| `46a56e1fc158919d` | 25M | `@napi-rs/canvas-darwin-arm64/skia.darwin-arm64.node` ← realny katalog na korzeniu (data 20.08) |

`node_modules/pdfjs-dist` jest **realnym katalogiem** (20.08 22:39), nie symlinkiem pnpm → drzewo jest
mieszaniną instalacji npm i pnpm z pozostałościami. Wersje deklaratywne: root `package.json:324`
`@napi-rs/canvas ^1.0.1` (zainstalowane 1.0.9); `pdf-parse@2.4.5` deps `@napi-rs/canvas 0.1.80`;
`pdfjs-dist@5.4.296` optionalDeps `@napi-rs/canvas ^0.1.80`.

## Zasięg (kto jest narażony)

Testy, które w jednym pliku ładują obie ścieżki (6):
`server/src/services/assessment/__tests__/g1.reportLanguage.test.ts`,
`server/src/services/documentStudio/__tests__/documentChartRenderQa.test.ts`,
`.../documentCoverLogoRender.test.ts`, `.../documentRendererE15FormattingRender.test.ts`,
`.../documentStudioExportQaGate.test.ts`, `tests/unit/deliverables/documentPdfGolden.test.ts`.

**Produkcja (ryzyko poza testami):** `server/src/services/pdfParserService.ts:46` (`await import('pdf-parse')`)
i `server/src/services/ai/knowledgeIndexer.ts:122` działają w tym samym procesie serwera co eksport
DOCX z wykresem (`documentDocxRenderer.ts:359` → `documentChartRasterizer.ts:53`). Kolejność
„najpierw ekstrakcja tekstu z PDF, potem render raportu z wykresem" = śmierć procesu Node (zmierzone
w `tsx`: EXIT=139, 3/3).

## Opcje naprawy (wymagają decyzji CTO — poza zakresem „tylko konfiguracja testów")

1. **Dependeny-level (rekomendowana):** jedna binarka `@napi-rs/canvas` w procesie — dedupe/override
   (np. pnpm `overrides` na `@napi-rs/canvas` do jednej wersji, albo usunięcie optional-dep pdfjs, skoro
   `getText()` nie potrzebuje canvasa). Wymaga czystej reinstalacji `node_modules` głównego repo
   (tam dziś leżą 4 fizyczne kopie + `.ignored_pdf-parse`) — a to katalog, do którego nie wolno mi wchodzić.
   Naprawia i testy, i produkcję.
2. **Product-level:** izolacja procesowa jednej ze ścieżek (ekstrakcja PDF w workerze/procesie potomnym).
3. **Test-level (w moim zakresie, mierzona jako działająca, ale NIE naprawia produkcji):** rozdzielenie
   plików tak, by żaden proces nie ładował obu binarek — udowodnione sondami: pliki „tylko wykres" 3/3 EXIT=0,
   pliki „tylko pdf-parse" 3/3 EXIT=0. Koszt: podział `g1.reportLanguage.test.ts` koliduje z gałęzią
   `qoder/narracja-en-20260916` (17 testów, w odbiorze) i daje fałszywy spokój, bo production landmine zostaje.
4. **Test-level mock (w moim zakresie, odradzam):** globalny setup wstrzykujący fake ctor przez istniejący
   seam `__setChartCanvasCtorForTest` (`documentChartRasterizer.ts:28`, wzorzec:
   `documentStudio/__tests__/day32.radarChart.test.ts`) — wyłącza realną rasteryzację w 6 plikach,
   czyli przestaje mierzyć to, co ma mierzyć.

## Pliki dowodowe w tym katalogu

Logi (kopie z `/tmp`, pełne wyjścia runnerów) + jeden raport crasha macOS. Sumy sha256: `SUMY.md`.
