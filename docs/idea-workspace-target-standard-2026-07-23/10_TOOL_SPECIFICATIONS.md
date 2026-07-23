# 10 — Specyfikacje narzędzi

## Mind Map

Cel: struktura myślenia, gałęzie, zależności, rozwijanie idei.

Menu 3:

- Add node
- Layout
- Levels
- AI
- Templates
- Export
- More

Lewy rail:

- Select, Hand, Add, Connect, Branch, Collapse, Comment, Link, Attach, AI, More, Undo, Redo.

Prawy panel:

- Przegląd: health mapy, liczba węzłów, relacje, braki.
- Inspektor: node, branch, edge.
- Powiązania: artefakty, źródła, załączniki.
- Komentarze: cała mapa lub węzeł.
- Historia: zmiany mapy i AI.

Menu kontekstowe:

- tło,
- node,
- branch,
- edge.

Zakazy:

- `AI suggest links` nie może być martwe w jednym wejściu i działać w drugim.
- `Convert element` nie może konwertować gałęzi, jeśli etykieta mówi element.

## Whiteboard

Cel: praca warsztatowa, swobodna tablica, grupowanie, głosowanie, handoff.

Menu 3:

- Workshop
- Add
- Arrange
- AI
- Templates
- Save view
- Export
- More

Lewy rail:

- Select, Hand, Sticky, Text, Shape, Draw, Frame, Connect, Comment, Link, Attachment, AI, More, Undo, Redo.

Workshop:

- session mode,
- role,
- phase,
- timer,
- voting,
- follow me,
- participants.

Obecny pływający panel `Session layer` zastąpić przyciskiem `Workshop` i panelem/dropdownem. Na canvasie wolno pokazywać tylko małe wskaźniki aktywnego stanu, np. `Voting open`, `Timer 04:32`.

Prawy panel:

- Przegląd: status boardu i workshopu.
- Inspektor: sticky, shape, frame, connector.
- Powiązania: artefakty, źródła, załączniki.
- Komentarze: board lub element.
- Historia: zmiany, głosowania, fazy.

Zakazy:

- `Dodaj karteczkę` nie może wysyłać `add_node`.
- `AI rozwiń` nie może wysyłać `mm_ai_expand`.
- Connector musi mieć menu krawędzi.

## Process Flow

Cel: modelowanie procesu, decyzji, odpowiedzialności, walidacji i automatyzacji.

Menu 3:

- Flow type
- Add element
- Lane
- Auto-layout
- Validate
- AI
- Templates
- Export
- More

Flow types:

- Classic Flow
- Automation
- Value Stream

Elementy:

- Start
- End
- Activity
- Decision
- Lane
- Connector
- Split / Join

Prawy panel:

- Przegląd: KPI, warnings, liczba kroków/lane'ów, status walidacji.
- Inspektor: step, decision, edge, lane.
- Powiązania: artefakty, źródła procesu.
- Komentarze.
- Historia.

Walidacja:

- start state: `Not validated`,
- po walidacji: `No warnings` albo `Warnings N`,
- nie wolno pokazywać zielonego sukcesu przed walidacją.

Zakazy:

- `Auto-layout` nie może wysyłać eventu Mind Map.
- `Insert between` nie może być przyciskiem węzła, jeśli wymaga edge.
- `Wklej` nie może duplikować zaznaczenia.

## Table

Cel: praca na danych, widokach, polach, rekordach, scoringu i analizie.

Docelowy kierunek: P15/platformowy. Legacy wygasić.

Menu 3:

- Views
- Add row
- Fields
- Organize
- AI
- Templates
- Import
- Export
- More

Views:

- Grid
- Kanban
- Timeline
- Calendar
- Matrix
- Gallery

Organize:

- filter,
- sort,
- group,
- hide fields,
- saved view config.

Prawy panel:

- Przegląd: tabela jako reprezentacja Idea.
- Inspektor: row, column, cell.
- Powiązania: linked records, artifacts, sources.
- Komentarze: table/row/cell.
- Historia: edits, AI changes, imports.

Context menus:

- row,
- cell,
- column header,
- selected rows.

Zakazy:

- Table nie dziedziczy canvasowego raila.
- Nie ma dwóch różnych UX-ów legacy/P15.
- AI Fill nie nadpisuje bez preview.
- Płaski rząd 20 ikon należy zwinąć do `More`/`Tools`.

