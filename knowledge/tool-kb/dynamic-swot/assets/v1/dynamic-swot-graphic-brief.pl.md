# Dynamic SWOT — brief do grafiki preview (v1, PL)

## Asset meta

- **tool_slug**: `dynamic-swot`
- **asset_type**: `preview_graphic`
- **asset_version**: `1.0.0`
- **language**: `pl`
- **source_kind**: `tool_asset`

## Provenance (sources)

- `docs/product/DYNAMIC_SWOT_CONTENT_PACK_V1.md`
- `docs/product/DYNAMIC_SWOT_TOOL_SPEC_V1.md`
- `knowledge/tool-kb/dynamic-swot/methodology/v1/dynamic-swot-methodology.pl.md`
- `knowledge/tool-kb/dynamic-swot/help/v1/dynamic-swot-help.pl.md`
- `knowledge/Strategie /mural.zip :: mural/www.mural.co/templates/swot-analysis.html`
- `knowledge/Strategie /Creately.zip :: Creately/creately.com/lp/swot-analysis-tool-online/index.html`
- `knowledge/Strategie /visual-paradigm..zip :: visual-paradigm./ai.visual-paradigm.com/tool/swot-tows-business-analysis/index.html`

## Audience + use

- **Used by**: Library + Help Center + AI support surfaces
- **Do not use for**: akademickiego wykresu bez pokazania przejścia do napięć, ruchów i outputów

---

## Communication goal

- **Primary message**: Dynamic SWOT to nie jest bierna macierz, tylko narzędzie decyzji i outputów.
- **Secondary message**: z sygnałów powstają napięcia strategiczne, rekomendowane ruchy i kolejne artefakty.
- **What the user should understand in 3 seconds**:
  - jest klasyczna struktura SWOT,
  - ale widać połączenia między kartami,
  - jest wyróżnione jedno napięcie i jeden ruch,
  - na końcu są outputy.

## Composition

- **Layout**:
  - centralnie nowoczesna macierz 2x2,
  - po prawej węższy rail outputów,
  - nad lub między ćwiartkami subtelne linie połączeń,
  - na pierwszym planie jedna karta napięcia i jedna karta ruchu.
- **Main objects**:
  - 4 ćwiartki SWOT,
  - 6-8 kart,
  - 2-3 linie łączące,
  - karta `Strategic Tension`,
  - karta `Recommended Move`,
  - mini rail: `Initiative`, `Report`, `Presentation`, `Idea`.
- **Highlighted object**:
  - jedno napięcie strategiczne,
  - jeden rekomendowany ruch wynikający z napięcia.
- **Connection logic**:
  - co najmniej jedna linia powinna łączyć kartę z `Strengths` z kartą z `Opportunities`,
  - druga może łączyć `Weaknesses` z `Threats`,
  - linie mają prowadzić wzrok do karty napięcia.
- **Depth / emphasis**:
  - matrix jako baza,
  - tension i move jako najważniejsze warstwy,
  - output rail czytelny, ale wtórny.

## Visual language

- **Palette**:
  - strengths: green,
  - weaknesses: amber,
  - opportunities: blue/cyan,
  - threats: red/rose,
  - tension: violet/slate accent,
  - move: emerald or teal emphasis,
  - outputs rail: neutral slate with colored badges.
- **Meaning of each color**:
  - green = przewaga wewnętrzna,
  - amber = ograniczenie wewnętrzne,
  - blue = upside zewnętrzny,
  - red = ryzyko zewnętrzne,
  - violet = synteza / insight,
  - teal/emerald = ruch / next step.
- **Typography / label style**:
  - krótkie, czytelne labelki,
  - bez długich akapitów,
  - nacisk na 1-3 słowa na kartę.
- **Icon / badge rules**:
  - subtelne badge na output rail,
  - żadnych ciężkich ikon dominujących nad kartami.

## Content elements

- **Labels that must appear**:
  - `Strengths`
  - `Weaknesses`
  - `Opportunities`
  - `Threats`
  - `Strategic Tension`
  - `Recommended Move`
  - `Initiative`
  - `Report`
  - `Presentation`
  - `Idea`
- **Legend**:
  - 4 kolory ćwiartek,
  - linie = logiczne połączenia między kartami,
  - wyróżniona karta = insight / move.
- **Caption / short description**:
  - `Dynamic SWOT zamienia sygnały w napięcia strategiczne, rekomendowane ruchy i traceable outputy.`
- **Alt text**:
  - `Nowoczesna macierz Dynamic SWOT z czterema kolorowymi ćwiartkami, połączonymi kartami, wyróżnionym napięciem strategicznym, rekomendowanym ruchem i listą outputów: initiative, report, presentation, idea.`

## Usage notes

- **Where it appears**:
  - preview w bibliotece narzędzi,
  - help center / artykuł,
  - ewentualny teaser w materiałach onboardingowych.
- **Generated asset**:
  - `knowledge/tool-kb/dynamic-swot/assets/v1/dynamic-swot-preview.png`
- **Responsive / crop rule**:
  - przy ciaśniejszym kadrze najpierw zachować:
    - tension card,
    - move card,
    - przynajmniej 3 ćwiartki czytelne,
    - output rail.
- **What must stay visible**:
  - 4-kolorowy charakter SWOT,
  - połączenia,
  - insight -> move -> outputs.
- **What must be avoided**:
  - płaska tabelka bez ruchu,
  - zbyt dużo tekstu,
  - brak output rail,
  - styl “szkolnego diagramu”,
  - agresywnie marketingowy look bez czytelności.

## Opis gotowej grafiki

Grafika ma wyglądać jak strategiczne płótno pracy, a nie jak slajd z podręcznika. W centrum powinna być czytelna macierz SWOT z kilkoma konkretnymi kartami. Co najmniej jedno połączenie między kartami powinno prowadzić do wyróżnionego `Strategic Tension`, a stamtąd do `Recommended Move`. Po prawej stronie powinien być mały, nowoczesny rail outputów pokazujący, że wynik sesji może od razu przejść do `Initiative`, `Report`, `Presentation` lub `Idea`.
