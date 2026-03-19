# Dynamic SWOT — Benchmarks & source map (v1, PL)

## Pack meta

- **tool_slug**: `dynamic-swot`
- **pack_type**: `benchmarks`
- **pack_version**: `1.0.0`
- **language**: `pl`
- **source_kind**: `tool_pack`

## Provenance (sources)

- `docs/product/DYNAMIC_SWOT_TOOL_SPEC_V1.md`
- `docs/product/DYNAMIC_SWOT_CONTENT_PACK_V1.md`
- `docs/product/TOOLS_SSOT_SOURCES_V3.md`
- `wdrozenia/modules/tools/catalog/strategy/pestel.md`
- `wdrozenia/modules/tools/catalog/strategy/competitive-benchmarking.md`
- `wdrozenia/modules/tools/catalog/strategy/strategic-positioning.md`
- `wdrozenia/modules/tools/catalog/strategy/porter-generic-strategies.md`
- `knowledge/Strategie /Creately.zip :: Creately/creately.com/guides/how-to-use-swot-analysis-effectively/index.html`
- `knowledge/Strategie /Creately.zip :: Creately/creately.com/guides/tows-matrix-guide/index.html`
- `knowledge/Strategie /Creately.zip :: Creately/creately.com/guides/pest-and-swot-analysis/index.html`
- `knowledge/Strategie /Creately.zip :: Creately/creately.com/guides/soar-vs-swot/index.html`
- `knowledge/Strategie /Creately.zip :: Creately/creately.com/lp/swot-analysis-tool-online/index.html`
- `knowledge/Strategie /visual-paradigm..zip :: visual-paradigm./ai.visual-paradigm.com/tools/swot-tows-business-analysis/swot-tows-business-analysis-tool-how-it-works/index.html`
- `knowledge/Strategie /visual-paradigm..zip :: visual-paradigm./ai.visual-paradigm.com/blog/five-forces-vs-swot-key-differences-synergies-and-when-to-use-each/index.html`
- `knowledge/Strategie /nibusinessinfo.zip :: nibusinessinfo/www.nibusinessinfo.co.uk/content/swot-pestle-and-other-models-strategic-analysis.html`
- `knowledge/Strategie /nibusinessinfo.zip :: nibusinessinfo/www.nibusinessinfo.co.uk/content/swot-analysis-example.html`
- `knowledge/Strategie /Busines to you.zip :: Busines to you/www.business-to-you.com/swot-analysis/index.html`
- `knowledge/Strategie /Bscdisine.zip :: Bscdisine/bscdesigner.com/swots-framework.htm`
- `knowledge/Strategie /mural.zip :: mural/www.mural.co/templates/swot-analysis.html`
- `knowledge/Strategie /Quantive.zip :: Quantive/quantive.com/resources/articles/swot-analysis.html`

## Audience + use

- **Used by**: AI + UI + Help
- **Do not use for**: traktowania źródeł z archiwów jako nadrzędnego kanonu produktu Consultify

---

## Sections (chunk-friendly)

### [section_id:overview] Cel tego packa

- Ten pack nie jest benchmarkiem numerycznym typu KPI dataset.
- To uporządkowana mapa źródeł referencyjnych dla:
  - metodologii,
  - porównań frameworków,
  - przykładów,
  - wzorców wizualnych,
  - mostu od analizy do wykonania.
- Ma wspierać AI i redakcję treści, ale nie zastępuje Product SSOT.

### [section_id:application_mapping] Jak używać tego packa w aplikacji

- **Library preview should show**: prosty, decision-oriented obraz SWOT, nie akademicki opis.
- **Main work surface should show**: wiedzę kontekstową tylko jako krótkie hints i examples.
- **Help / AI surface should show**: porównania typu “kiedy SWOT, kiedy PEST, kiedy Five Forces”.
- **Outputs surface should show**: most do execution, np. poprzez wzorce TOWS i strategic priorities.

### [section_id:evidence] Reguły korzystania ze źródeł

- wewnętrzne dokumenty repo są kanonem dla zachowania produktu,
- archiwa webowe są materiałem referencyjnym,
- źródła zewnętrzne należy oznaczać jako:
  - `method`,
  - `comparison`,
  - `example`,
  - `visual`,
  - `execution bridge`.

### [benchmark_id:internal_ssot] Wewnętrzny kanon Consultify

- **Type**: `context`
- **What it is useful for**:
  - definicja flow narzędzia,
  - nazwy etapów,
  - kontrakt outputów,
  - ton i sposób komunikacji.
- **Key takeaway**:
  - Dynamic SWOT ma być drogą `conversation -> evidence -> tension -> move -> output`, a nie statyczną macierzą.
- **How to use in the app / AI**:
  - zawsze priorytetyzuj te źródła przy tworzeniu copy, helpu i promptów.
- **Source note**:
  - `DYNAMIC_SWOT_TOOL_SPEC_V1.md`, `DYNAMIC_SWOT_MVP_V1.md`, `DYNAMIC_SWOT_CONTENT_PACK_V1.md`.

### [benchmark_id:creately_method] Creately jako źródło metodologii i stage logic

- **Type**: `comparison`
- **What it is useful for**:
  - uporządkowanie samego procesu wykonania SWOT,
  - kroków TOWS,
  - pozycjonowania SWOT względem PEST i SOAR.
- **Key takeaway**:
  - dobry SWOT wymaga celu, zespołu, zebrania informacji, klasyfikacji, analizy i przełożenia na plan.
- **How to use in the app / AI**:
  - używaj jako wsparcia dla pytań etapowych,
  - nie kopiuj języka narzędziowego 1:1,
  - wykorzystuj do budowy guidance “co dalej po macierzy”.
- **Source note**:
  - `how-to-use-swot-analysis-effectively`,
  - `tows-matrix-guide`,
  - `pest-and-swot-analysis`,
  - `soar-vs-swot`.

### [benchmark_id:visual_paradigm_method] Visual Paradigm jako źródło “analysis to action”

- **Type**: `comparison`
- **What it is useful for**:
  - łączenie SWOT i TOWS,
  - porównanie SWOT z Five Forces,
  - framing “tool how it works”.
- **Key takeaway**:
  - SWOT i Five Forces się nie wykluczają,
  - SWOT/TOWS jest warstwą syntezy i przełożenia na strategie.
- **How to use in the app / AI**:
  - do krótkich wyjaśnień “dlaczego ten tool, a nie inny”,
  - do guidance międzyframeworkowego.
- **Source note**:
  - `swot-tows-business-analysis-tool-how-it-works`,
  - `five-forces-vs-swot-key-differences-synergies-and-when-to-use-each`.

### [benchmark_id:nibusinessinfo_examples] NI Business Info jako źródło prostych przykładów

- **Type**: `example`
- **What it is useful for**:
  - klarowne biznesowe przykłady SWOT,
  - proste tłumaczenie różnicy między modelami strategicznymi.
- **Key takeaway**:
  - dla użytkownika ważniejsza jest jakość doboru czynników niż długość listy,
  - przykład powinien rozdzielać czynniki wewnętrzne i zewnętrzne.
- **How to use in the app / AI**:
  - jako źródło stylu prostych examples,
  - jako wsparcie helpu “how to interpret the result”.
- **Source note**:
  - `swot-pestle-and-other-models-strategic-analysis`,
  - `swot-analysis-example`.

### [benchmark_id:business_to_you_tows] Business-to-you jako most do TOWS

- **Type**: `example`
- **What it is useful for**:
  - klasyczne połączenia SO, WO, ST, WT,
  - język “bringing internal and external factors together”.
- **Key takeaway**:
  - macierz staje się użyteczna dopiero, gdy prowadzi do kombinacji strategicznych.
- **How to use in the app / AI**:
  - do wyjaśniania, skąd biorą się typy napięć i ruchów,
  - do budowy prostych przykładów strategicznych kombinacji.
- **Source note**:
  - `swot-analysis/index.html`.

### [benchmark_id:bscdesigner_execution] BSC Designer jako most do execution

- **Type**: `execution bridge`
- **What it is useful for**:
  - wyjście poza samą macierz,
  - przełożenie insightów na strategię, inicjatywy i mapę działania.
- **Key takeaway**:
  - klasyczny SWOT jest słaby, jeśli nie ma warstwy strategicznej; dlatego wartościowe jest podejście `SWOT+S`.
- **How to use in the app / AI**:
  - do argumentacji, że outputs są integralną częścią narzędzia,
  - do pisania guidance “nie zatrzymuj się na macierzy”.
- **Source note**:
  - `swots-framework.htm`.

### [benchmark_id:mural_visual] Mural jako wzorzec prostego boardu

- **Type**: `visual`
- **What it is useful for**:
  - prosty, czytelny board SWOT,
  - intuicyjna kompozycja 2x2.
- **Key takeaway**:
  - podstawowy widok SWOT ma być czytelny w 3 sekundy i nie może być przeładowany.
- **How to use in the app / AI**:
  - jako referencja do preview graphic i matrix readability.
- **Source note**:
  - `swot-analysis.html`.

### [benchmark_id:quantive_context] Quantive jako kontekst execution management

- **Type**: `context`
- **What it is useful for**:
  - pokazanie, że wynik SWOT często musi przejść do priorytetów i rytmu wykonawczego.
- **Key takeaway**:
  - strategic insight bez mechanizmu realizacji nie daje wartości.
- **How to use in the app / AI**:
  - do language bridge między `recommended moves` a `initiative/report`.
- **Source note**:
  - `swot-analysis.html` oraz treści okołopriorytetowe w archiwum Quantive.

### [benchmark_id:adjacent_internal_frameworks] Wewnętrzne frameworki sąsiednie

- **Type**: `comparison`
- **What it is useful for**:
  - ustalenie, kiedy Dynamic SWOT ma być narzędziem syntezy, a kiedy warto zacząć gdzie indziej.
- **Key takeaway**:
  - PESTEL, competitive benchmarking, strategic positioning i porter generic strategies są naturalnym inputem do warstwy `external context`.
- **How to use in the app / AI**:
  - sugeruj je jako narzędzia poprzedzające lub uzupełniające.
- **Source note**:
  - `wdrozenia/modules/tools/catalog/strategy/pestel.md`
  - `wdrozenia/modules/tools/catalog/strategy/competitive-benchmarking.md`
  - `wdrozenia/modules/tools/catalog/strategy/strategic-positioning.md`
  - `wdrozenia/modules/tools/catalog/strategy/porter-generic-strategies.md`

### [section_id:framework_positioning] Rekomendowane pozycjonowanie względem innych frameworków

- **SWOT po PEST/PESTLE**:
  - gdy trzeba najpierw nazwać trendy polityczne, ekonomiczne, technologiczne lub regulacyjne.
- **SWOT po Five Forces**:
  - gdy pytanie dotyczy struktury konkurencji i atrakcyjności branży.
- **SWOT zamiast SOAR**:
  - gdy trzeba jawnie pracować także na słabościach i zagrożeniach.
- **SWOT przed initiative/report/presentation**:
  - gdy potrzebna jest synteza z kilku źródeł i wspólna diagnoza.

### [section_id:authoring_priorities] Priorytety authoringu dla kolejnych packów

- Z `internal_ssot` bierzesz:
  - nazwy etapów,
  - output contract,
  - microcopy.
- Z `creately_method` i `visual_paradigm_method` bierzesz:
  - logikę procesu,
  - porównania frameworków,
  - most SWOT -> TOWS.
- Z `nibusinessinfo_examples` i `business_to_you_tows` bierzesz:
  - przykłady i proste narracje biznesowe.
- Z `bscdesigner_execution` bierzesz:
  - argument za warstwą outputs i wykonaniem.
- Z `mural_visual` bierzesz:
  - prostotę kompozycji wizualnej.

### [section_id:risks] Ryzyka użycia źródeł

- Archiwa webowe mogą zawierać marketingowy noise.
- Niektóre źródła są dobre do inspiracji, ale słabe jako kanon produktu.
- Nie wolno kopiować obcego frameworku 1:1 do runtime Consultify.
- Jeśli źródła zewnętrzne różnią się od Product SSOT, wygrywa Product SSOT.

### [section_id:ready_catalog] Krótka mapa “best use”

- **Method**:
  - Creately,
  - Visual Paradigm.
- **Comparison**:
  - Creately `PEST and SWOT`,
  - Visual Paradigm `Five Forces vs SWOT`,
  - Creately `SOAR vs SWOT`.
- **Example**:
  - nibusinessinfo,
  - Business-to-you.
- **Execution bridge**:
  - BSC Designer.
- **Visual**:
  - Mural,
  - Creately tool pages,
  - Visual Paradigm tool pages.
