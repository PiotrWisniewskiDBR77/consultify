# 11 — Kryteria akceptacji i backlog

## Kryteria globalne

1. Każda widoczna akcja ma handler.
2. Handler jest właściwy dla `activeTool`.
3. Każda akcja ma scope.
4. Każde kliknięcie daje efekt, loading, disabled reason albo error.
5. Nie ma cichych no-op.
6. Nie ma `mm_*` poza Mind Map.
7. Nie ma `Create from map`.
8. Prawy panel przełącza realne zakładki.
9. Convert, Export, Import i Templates mają różne znaczenia.
10. AI mutujące dane ma preview.

## Priorytet 0 — integralność danych

1. Naprawić `promote()`, żeby konwersja zaznaczenia nie nadpisywała statusu całej Idea.
2. Dodać model wielu konwersji/source links.
3. Dodać confirm i snapshot przed destrukcyjnym importem.
4. Dodać undo/restore dla importu.

## Priorytet 1 — martwe kliki i root-cause

1. Przestać używać akcji Mind Map w powłoce dla wszystkich narzędzi.
2. Rozgałęzić Menu 3 per `activeTool`.
3. Rozgałęzić popovery lewego raila per `activeTool`.
4. Naprawić prawy panel, żeby aktywna ikona przełączała treść.
5. Usunąć lub obsłużyć martwe eventy.

## Priorytet 2 — prawy panel

1. Zbudować pięć zakładek:
   - Przegląd
   - Inspektor
   - Powiązania
   - Komentarze
   - Historia
2. Usunąć Convert jako zakładkę.
3. Połączyć Problem/Status/Health w Przegląd.
4. Dodać osobne Powiązania.
5. Dodać osobne Komentarze.
6. Dodać Inspektor dla edge, lane/frame, row, column, cell.

## Priorytet 3 — Menu 3 i lewy rail

1. Usunąć przełącznik reprezentacji z lewego raila.
2. Przenieść reprezentacje do prawego dolnego rogu.
3. Ustawić Menu 3 według specyfikacji per narzędzie.
4. Przenieść Undo/Redo do jednego miejsca per widok.
5. Uporządkować `More`.

## Priorytet 4 — menu kontekstowe

1. Dodać menu krawędzi dla Whiteboard i Process Flow.
2. Naprawić `Wklej` w Process Flow.
3. Przenieść `Insert between` na edge albo zmienić jego logikę.
4. Dodać menu komórki Table.
5. Ujednolicić menu kolumny Table.

## Priorytet 5 — AI

1. Jeden standard proposal-review dla AI mutującego dane.
2. Usunąć etykiety AI z funkcji bez LLM.
3. Ujednolicić AI dla zaznaczenia.
4. Dodać historię AI.
5. Table AI bez auto-apply.

## Priorytet 6 — Table

1. Wybrać P15 jako docelowy.
2. Oznaczyć legacy jako deprecated.
3. Usunąć martwy kod platformowy z legacy branch.
4. Przenieść płaski rząd ikon do `More`/`Tools`.
5. Ujednolicić row/cell/column menus.

## Definition of Done

System menu jest gotowy, gdy:

- użytkownik wie, gdzie szukać funkcji,
- ta sama funkcja nie oznacza różnych rzeczy,
- żaden przycisk nie jest martwy,
- prawy panel jest przewidywalny,
- AI nie nadpisuje danych bez zgody,
- Convert i Export są rozdzielone,
- wszystkie cztery narzędzia wyglądają jak reprezentacje jednego systemu,
- tester może przejść checklistę bez odwoływania się do kodu.

