# 05 — Lewy rail

## Rola

Lewy rail jest szybkim paskiem tworzenia i edycji aktualnego widoku. Jest ikonowy, pionowy i kontekstowy.

Nie służy do:

- przełączania Mind Map / Whiteboard / Process Flow / Table,
- globalnego Convert,
- Export,
- historii wersji,
- ustawień całej Idea.

## Wspólny rdzeń dla canvasów

Dla Mind Map, Whiteboard i Process Flow rail ma wspólną strukturę:

1. Select
2. Hand / Pan
3. Add
4. Connect
5. Structure / Group / Lane / Frame
6. Text / Content
7. Comment
8. Link / Relation
9. Attachment / Knowledge
10. AI for selection
11. More
12. Undo
13. Redo

Każdy element zna:

- `activeTool`,
- scope,
- zaznaczenie,
- dostępne handlery,
- disabled reason.

## Mind Map rail

Elementy:

- Select
- Hand
- Add node
- Add child / sibling
- Connect
- Branch / frame
- Collapse / expand
- Comment
- Link artifact
- Attach knowledge
- AI for node / branch
- More
- Undo / Redo

`More` Mind Map:

- duplicate branch,
- detach branch,
- copy style,
- paste style,
- change shape,
- show levels,
- keyboard shortcuts.

## Whiteboard rail

Elementy:

- Select
- Hand
- Sticky
- Text
- Shape
- Draw
- Frame
- Connect
- Comment
- Link
- Attachment / image
- AI for selection
- More
- Undo / Redo

Shape otwiera popover:

- rectangle,
- circle,
- diamond,
- hexagon,
- line,
- arrow.

`Draw` należy do raila, nie do górnego lokalnego paska.

## Process Flow rail

Elementy:

- Select
- Hand
- Add element
- Connector
- Lane
- Split / Join
- Comment
- Link artifact
- AI for selected step
- More
- Undo / Redo

`Add element` otwiera:

- Start
- End
- Activity
- Decision
- podtypy zależne od Flow type.

`Insert between` nie może wisieć przy zaznaczonym węźle, jeśli wymaga zaznaczonej krawędzi. Musi być:

- w menu krawędzi,
- albo działać inteligentnie na wybranym węźle i jego jednoznacznej krawędzi.

## Table rail

Table nie jest canvasem. Rail tabeli jest opcjonalny i nie dziedziczy Select/Hand.

Jeżeli zostaje rail tabeli, zawiera:

- AI
- Add row
- Fields
- Filter
- Sort
- Group
- Views
- More
- Undo / Redo

Nie wolno pokazywać:

- Hand,
- Connect,
- minimap,
- canvas-fit,
- branch,
- lane.

## Popovery raila

Każdy popover musi być świadomy `activeTool`.

Nie wolno:

- pokazywać akcji `mm_*` w Whiteboard, Process Flow ani Table,
- pokazywać martwych pozycji,
- zostawiać kliknięcia bez toastu lub efektu,
- mieszać importu/eksportu globalnego z lokalnymi narzędziami edycji.

## Kryteria akceptacji

- Przełącznik reprezentacji nie znajduje się w railu.
- Każdy przycisk raila działa w swoim widoku.
- Table nie dostaje canvasowego raila.
- Undo/Redo odpowiada aktywnemu widokowi.
- Wszystkie ikony mają tooltipy.
- Brak cichych no-op.

