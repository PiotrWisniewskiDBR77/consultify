# grow-content — proof run (2026-07-05)

Rdzeń wizualny decka (React `CardRenderer` / bloki `KpiWidget` · `MetricStrip` ·
`Chart`), program Prezentacje. Następca W7.

W7 (`docs/qa/deliverables/runs/2026-07-04-w7-fillcanvas/`) usunął „martwy dół"
i „półpustą kolumnę" **redystrybucją** rzadkiej treści (centrowanie przez
`justify-content`). Jego własne README jest wprost: to NIE bije Gammy samodzielnie
— „prawdziwy premium wymaga *powiększania treści* (większy hero-number, bogatsze
kafelki KPI, realne wykresy)… sama redystrybucja centruje pustkę, nie usuwa jej".
To jest ta robota: **powiększenie dominującej treści tak, by realnie zajęła
kanwę**, a nie tylko wyśrodkowała pustkę.

## Co zmieniono (feat, ŻADNEGO deployu na demo)

Nowy kontrakt `BlockDensity` (`blocks/blockDensity.ts`). Gdy blok jest
DOMINUJĄCĄ treścią swojego regionu, `CardRenderer` podaje mu `density: 'hero'`
i blok renderuje się z dużo większą wagą wizualną. Decyzję podejmuje czysta
funkcja `blockDensityFor()` (`LayoutEngine.ts`), bramkowana flagą `_growContent`
(dowód izoluje sam grow ponad W7).

1. **Hero-number** (`KpiWidgetBlock.tsx`): na slajdzie `big_number` /
   `single_insight` liczba rośnie `text-3xl → text-[7rem]` (30 → 112 px zmierzone),
   dochodzi wiersz benchmarku (`benchmark branży: 55%`), strzałka trendu i delta w
   skali. Poza archetypem promocja tylko gdy metryka jest sama w regionie.
2. **Kafelki KPI jako dashboard** (`MetricStripBlock.tsx`): z płaskich centrowanych
   napisów na kafelki z kolorowym paskiem akcentu (zielony/czerwony wg trendu),
   strzałką trendu, deltą i wartością o realnej wadze (`text-3xl`, w hero
   `text-5xl`) w siatce zamiast wąskiego paska.
3. **Wykresy skalowane do regionu** (`ChartBlock.tsx`): wysokość była na sztywno
   150 px niezależnie od kanwy — wykres pływał mały w pustce. Teraz `density:'hero'`
   → 320 px (bar/line/area/pie/waterfall/matrix/marimekko), gdy wykres posiada
   region bez konkurencyjnego bloku „wysokiego" (inny chart/image/table/diagram).
   Krótki metric-strip czy podpis obok nie blokują wzrostu.

Bez flagi (`?mode=before`) / dla `density:'default'` render jest bajt-w-bajt jak
przed grow — wszystkie istniejące wywołania `{ block, theme }` i testy nietknięte.

## Osie dowodu

BEFORE = grow OFF (rytm W7 sam: małe bloki, pływający 150 px wykres, mała liczba)
· AFTER = grow ON. **W7 rytm jest ON w OBU trybach** — izolujemy sam efekt grow.
Ten sam deck VTS (7 slajdów, autentyczna kompozycja B1).

- `png/slide<N>_<before|after>.png` — realny `CardRenderer` (1280×720, DPR 2).
- `fill-geometry.json` — **deterministyczny** pomiar DOM (bez klucza, bez modelu):
  `fill` = ułamek użytkowej wysokości, który treść REALNIE rozpina; `dominant` =
  najwyższy pojedynczy blok / wysokość użytkowa; `chartPx` = wysokość najwyższego
  pola wykresu (łapie wzrost wykresu też w komórce siatki); `heroPx` = px
  największej liczby (hero-number).

## Wynik (fill-geometry.json — deterministyczny)

| metryka | BEFORE | AFTER |
|---|---|---|
| avg fill (rozpięcie treści) | 0.360 | **0.437** (+21%) |
| avg dominant (waga bloku-bohatera) | 0.133 | **0.228** (+71%) |
| avg deadBottom | 0.417 | **0.370** (−11%) |
| avg chartPx (wysokość wykresu) | 43 | **91** (+112%) |
| max heroPx (największa liczba) | 30 | **112** (+273%) |

Per-slajd (fill · dominant · chartPx · heroPx):

| slide | variant | BEFORE | AFTER |
|---|---|---|---|
| 2 | kpi_grid_2x2 | 0.683 · 0.242 · 150 · 30 | **0.801 · 0.478 · 320 · 30** |
| 3 | big_number | 0.402 · 0.151 · — · 30 | **0.593 · 0.342 · — · 112** |
| 4 | split_lr | 0.242 · 0.242 · 150 · 12 | **0.242 · 0.478 · 320 · 12** |
| 0,1,5,6 | cover / two_column / stacked / timeline | — | **identyczne** (brak dominującej metryki/wykresu → słusznie nietknięte) |

Slajd 3: hero „18%" urósł 30→112 px + benchmark; slajd 2: wykres 150→320 px +
kafelki-dashboard; slajd 4: wykres słupkowy 150→320 px obok analizy. Slajdy bez
dominującej treści (cover, rzadkie two-column, narracyjny stacked, timeline) nie
są ruszane — grow celuje TAM, gdzie jest co powiększyć.

## Uczciwa samoocena

To realizuje trzy rzeczy, których W7 wprost NIE zrobił: hero-number, bogate
kafelki KPI, wykresy skalowane do regionu. Kanwa jest teraz FILLED, nie tylko
wyśrodkowana. Slajdy narracyjne (0/1/5/6) dalej są „rzadkie ale skomponowane"
przez rytm W7 — to poprawna decyzja projektowa (nie ma tam pojedynczej
dominującej treści do powiększenia); dalsze zagęszczanie ich to robota generatora
treści (więcej realnych bloków), nie renderera. Rekomendacja: zaakceptować jako
warstwę „grow" nad rytmem W7.

## Odtworzenie

```
node --import tsx scripts/deliverables/grow-content/render-slides.mts   # PNG before/after
node --import tsx scripts/deliverables/grow-content/measure-fill.mts    # geometria (bez klucza)
```

Harness współdzieli fixture VTS z W7 (`scripts/deliverables/w7/fixture.vts.ts`);
oś before/after to `setGrowContent(false|true)` przy stałym `setW7FillCanvas(true)`.
