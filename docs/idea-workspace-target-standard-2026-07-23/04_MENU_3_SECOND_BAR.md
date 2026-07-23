# 04 — Menu 3: drugi pasek aktualnego widoku

## Rola

Menu 3 zarządza aktualną reprezentacją. Nie jest globalnym centrum systemu i nie jest floating toolbarem zaznaczenia.

Menu 3 może zawierać:

- najważniejsze działania aktualnego widoku,
- tryby pracy aktualnego widoku,
- widokowe AI,
- templates,
- export pliku,
- `More` dla rzadkich działań widoku.

Menu 3 nie może zawierać:

- Convert całej Idea,
- Delete selected,
- globalnej historii,
- przełącznika reprezentacji,
- akcji innego narzędzia,
- przycisków bez handlera.

## Standard wspólny

Lewa strona:

- tryb / typ widoku, jeżeli widok ma podtryby,
- najważniejsze akcje tworzenia i układu,
- AI aktualnego widoku,
- Templates.

Prawa strona:

- Import, jeżeli naturalny dla widoku,
- Export,
- More.

## Mind Map

Docelowe Menu 3:

`Add node | Layout | Levels | AI | Templates`  
Prawa strona: `Export | More`

Szczegóły:

- `Add node` dodaje child do zaznaczonego węzła albo root-level node, jeśli nic nie zaznaczono.
- `Layout` otwiera menu: auto-layout, radial, tree, compact, fit after layout.
- `Levels` otwiera: collapse all, show level 1, show level 2, expand all.
- `AI` analizuje aktualną mapę albo zaznaczoną gałąź, ale przed wykonaniem pokazuje scope.
- `Templates` otwiera galerię szablonów Mind Map.
- `More` zawiera rzadkie ustawienia widoku mapy.

## Whiteboard

Docelowe Menu 3:

`Workshop | Add | Arrange | AI | Templates`  
Prawa strona: `Save view | Export | More`

Szczegóły:

- `Workshop` zastępuje obecny pływający panel `Session layer`.
- `Add` otwiera typy: sticky, text, shape, frame, image, link.
- `Arrange` zawiera align, distribute, group, ungroup, tidy.
- `AI` działa na aktualny board albo zaznaczenie; musi używać `wb_ai_*`, nie `mm_ai_*`.
- `Templates` pokazuje szablony whiteboardowe.
- `Save view` zapisuje scenę/viewport.
- `More` zawiera background pattern, lock board, workshop settings, shortcuts.

## Process Flow

Docelowe Menu 3:

`Flow type | Add element | Lane | Auto-layout | Validate | AI | Templates`  
Prawa strona: `Export | More`

Szczegóły:

- `Flow type` przełącza podtryby: Classic Flow, Automation, Value Stream.
- `Add element` otwiera: Start, End, Activity, Decision, plus elementy zależne od podtrybu.
- `Lane` dodaje lub zarządza lane'ami.
- `Auto-layout` musi wywoływać procesowy handler `pf_auto_layout`, nie mindmapowy event.
- `Validate` przelicza walidację natychmiast i aktualizuje badge.
- `AI` wywołuje procesowy coach/proposal z preview.
- `Templates` pokazuje szablony processowe.
- `More` zawiera KPI, Readback, process settings, shortcuts.

Wskaźnik walidacji:

- przed pierwszą walidacją pokazuje `Not validated`,
- po walidacji pokazuje `No warnings` albo `Warnings N`,
- nie wolno pokazywać zielonego `No warnings`, jeśli walidacja nie została uruchomiona.

## Table

Docelowe Menu 3:

`Views | Add row | Fields | Organize | AI | Templates`  
Prawa strona: `Import | Export | More`

Szczegóły:

- `Views` pokazuje saved views i layouty: Grid, Kanban, Timeline, Calendar, Matrix, Gallery.
- `Add row` dodaje rekord albo rozwija menu z template row.
- `Fields` zarządza kolumnami, typami pól, widocznością i kolejnością.
- `Organize` łączy filter, sort, group, hide fields.
- `AI` otwiera AI dla tabeli, ale operacje modyfikujące dane wymagają preview.
- `Templates` pokazuje szablony tabel.
- `Import` obejmuje CSV, TSV, clipboard, connectors.
- `Export` eksportuje dane do pliku, nie tworzy raportu ani prezentacji.
- `More` zawiera narzędzia drugorzędne, np. scoring, heatmap, audit, shortcuts.

## More jako standard

`More` jest menu przepełnienia aktualnego widoku. Zawiera funkcje rzadkie, ale działające.

Nie wolno umieszczać w `More`:

- funkcji z innego narzędzia,
- `Delete selected`,
- globalnego Convert,
- akcji bez handlera,
- duplikatów głównych przycisków bez powodu.

## Kryteria akceptacji

- Każdy przycisk w Menu 3 ma handler dla `activeTool`.
- Nie ma `mm_*` poza Mind Map.
- Nie ma `Create from map`.
- `Export` eksportuje plik.
- `Convert` jest poza Menu 3.
- `More` zawiera tylko akcje aktualnego widoku.

