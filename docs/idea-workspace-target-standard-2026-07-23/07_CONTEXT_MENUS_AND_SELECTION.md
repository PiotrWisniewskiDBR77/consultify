# 07 — Menu kontekstowe i floating toolbar

## Zasada

Menu kontekstowe zależy od miejsca kliknięcia. Floating toolbar zależy od zaznaczenia.

Nie wolno mieszać:

- menu tła,
- menu elementu,
- menu krawędzi,
- menu lane/frame,
- menu tabeli,
- floating toolbara.

## Menu tła canvasu

Dotyczy miejsca kliknięcia i aktualnego widoku.

Wspólne minimum:

- Add element here
- Paste, tylko jeśli istnieje realny schowek
- Select all
- Fit view
- Auto-layout / arrange, jeśli dotyczy
- View settings
- AI for current view

Mind Map tło:

- add root topic,
- paste nodes,
- select all,
- fit view,
- auto-layout,
- collapse/expand levels,
- AI suggest nodes.

Whiteboard tło:

- add sticky here,
- paste elements,
- select all,
- fit view,
- background options,
- AI brainstorm here,
- AI find gaps.

Process Flow tło:

- add activity here,
- add decision here,
- paste step, jeśli jest realny schowek,
- fit view,
- auto-layout,
- validate.

Table nie ma menu pustego canvasu. Tabela ma menu wiersza, kolumny i komórki.

## Menu elementu

Kolejność:

1. Open / details
2. Edit
3. Duplicate
4. Copy / Cut / Paste, jeżeli realnie działa
5. Structure / relation
6. AI
7. Convert
8. Appearance / data
9. Delete

Pozycje niedostępne mają być disabled z powodem albo ukryte, jeżeli nie mają sensu dla typu elementu.

Nie wolno pokazywać aktywnej pozycji, która po kliknięciu nic nie robi.

## Menu krawędzi

Każdy canvas z połączeniami musi mieć menu krawędzi.

Pozycje:

- Edit label
- Change relation type
- Reverse direction
- Change line style
- Change arrow
- Insert element on connection
- Delete connection

Process Flow nie może mieć `Insert between` przy węźle, jeśli funkcja wymaga krawędzi.

Whiteboard musi dostać menu dla connectorów.

## Menu lane/frame

Lane/frame/section/area mają własne menu:

- Rename
- Change color
- Lock / unlock
- Collapse / expand
- Move up/down, jeśli ma sens
- Fit to contents
- Add item inside
- Delete, po confirm, jeśli usuwa zawartość

## Floating toolbar

Floating toolbar pojawia się po zaznaczeniu.

Dla jednego elementu:

- Edit
- Duplicate
- Link / relations
- Comment
- AI
- Convert selected item
- Style
- Delete
- More

Dla wielu elementów:

- count selected
- group / ungroup
- align
- distribute
- duplicate
- link
- AI for selection
- convert selection
- delete

Dla krawędzi:

- label,
- relation type,
- style,
- reverse,
- delete.

Floating toolbar nie może zawierać ustawień całego workspace.

## Table context menus

Table ma osobny standard.

Menu wiersza:

- Open record
- Edit row
- Add comment
- Insert row above
- Insert row below
- Duplicate row
- Copy row
- Convert row
- Delete row

Menu komórki:

- Edit cell
- Copy value
- Paste value
- Clear value
- Fill down
- AI fill cell
- View history

Menu nagłówka kolumny:

- Rename field
- Change field type
- Sort ascending/descending
- Filter by this field
- Group by this field
- Hide field
- Freeze field
- Field settings
- Delete field

Menu zaznaczenia wierszy:

- count selected
- convert selected rows
- bulk edit field
- duplicate rows
- export selected rows
- delete selected rows

## Kryteria akceptacji

- Każda powierzchnia menu ma jednoznaczny scope.
- Krawędzie mają własne menu.
- Tabela ma menu wiersza, komórki i kolumny.
- Floating toolbar nie dubluje globalnego Menu 1.
- Prawy klik i floating toolbar nie mają sprzecznych efektów dla tej samej etykiety.

