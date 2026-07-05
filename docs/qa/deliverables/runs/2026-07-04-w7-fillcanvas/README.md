# W7 fill-canvas + guard-split — proof run (2026-07-04)

Rdzeń wizualny decka (React `CardRenderer` / `LayoutEngine`), program Prezentacje.
Decyzja Piotra na gate P1.2: „guard + W7 fill-canvas, potem re-ocena". To jest
dowód do re-oceny.

## Co zmieniono (feat, ŻADNEGO deployu na demo)

1. **Guard-split** (`LayoutEngine.ts`): gdy composition/archetyp wybiera układ
   split/two-column ALE treść jest rzadka (rzuca półpustą drugą kolumnę), układ
   jest degradowany do stacked/full-width. Reguła w `shouldAvoidSplit()`:
   - pusta kolumna, LUB
   - najlżejsza kolumna < 35% najcięższej, LUB
   - łączna „waga" < 5, LUB
   - obie kolumny to sam krótki tekst (brak tall-fill: chart/image/…) a najfuller
     kolumna < ~6 wagi → dwie krótkie kolumny z martwym dołem (regresja slide1).
2. **Fill-canvas / rytm pionowy** (`CardRenderer.tsx` + `verticalFillMode()`):
   rzadka treść jest CENTROWANA jako spójna grupa (zbalansowane marginesy góra/dół)
   zamiast przyklejona do góry z martwym dołem. Cover/section-intro WYŁĄCZONE
   (grupują tytuł — nie ruszamy). Gęsta treść zostaje `top` (nie rozciągamy pełnego
   slajdu).

## Osie dowodu

BEFORE = W7 OFF (dzisiejszy top-glue, martwy dół) · AFTER = W7 ON.
Composition B1 obecna w OBU (izolujemy sam efekt W7). Ten sam deck VTS (7 slajdów).

- `png/slide<N>_<before|after>.png` — realny `CardRenderer` (1280×720, DPR 2).
- `fill-geometry.json` — **deterministyczny** pomiar DOM (bez klucza, bez modelu):
  `deadBottom` = ułamek użytkowej wysokości pusty pod treścią; `asymmetry` =
  `|deadTop − deadBottom|` (0 = idealnie wyśrodkowane).
- `visionqa-results.json` — VisionQA (sonnet-4-6, klucz staging). **UWAGA:** na tym
  harnessie placeholder-block (wykresy = cienkie paski, brak premium-stylu) scorer
  jest ZBYT SZUMIĄCY dla zmiany *layoutu* — slide0 (identyczny before==after)
  wahnął ±0.06. Dlatego arbitrem dead-bottom jest geometria, nie VisionQA.

## Wynik (fill-geometry.json — deterministyczny)

| metryka | BEFORE | AFTER |
|---|---|---|
| avg deadBottom | **0.709** | **0.433** (−39%) |
| avg asymmetry \|deadTop−deadBottom\| | **0.665** | **0.204** |
| slide0 cover (regresja?) | 0.044/0.828 | **0.044/0.828 — identyczne** |
| slide1 two_column (guard) | 0.044/0.660 | **0.352/0.352 — wyśrodkowane, kolumna nie półpusta** |
| slide3 big_number | 0.044/0.582 | **0.313/0.313** |
| slide5 stacked | 0.044/0.759 | **0.396/0.407** |

Martwy dół zlikwidowany (centrowanie), zero regresji na coverze (pixel-identyczny),
guard-split zbił półpustą kolumnę slide1. Legalny split slide4 (chart|tekst)
ZACHOWANY (nie zdegradowany).

## Uczciwa samoocena

To likwiduje „martwy dół" i „półpustą kolumnę" — dwa konkretne defekty P1.2. NIE
bije jeszcze Gammy samodzielnie: prawdziwy premium wymaga *powiększania treści*
(większy hero-number, bogatsze kafelki KPI, realne wykresy) — sama redystrybucja
przez `justify-content` centruje pustkę, nie usuwa jej. To robota bloków
(KpiWidget/Chart scaling) i kolejnych rund (W7.2–7.5, W10 wykresy). Rekomendacja:
zaakceptować jako fundament rytmu pionowego, zaplanować „grow-content" jako next.

## Odtworzenie

```
node --import tsx scripts/deliverables/w7/render-slides.mts     # PNG before/after
node --import tsx scripts/deliverables/w7/measure-fill.mts       # geometria (bez klucza)
export ANTHROPIC_API_KEY=$(railway variables --environment staging --service consultify --kv \
  | grep -E '^ANTHROPIC_API_KEY=' | sed 's/^ANTHROPIC_API_KEY=//' | tr -d ' "')
node --import tsx scripts/deliverables/w7/visionqa-deck.mts       # VisionQA (opcjonalnie)
```
