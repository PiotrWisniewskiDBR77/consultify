# 01 — Model produktu i scope akcji

## Zasada nadrzędna

Idea Workspace jest jednym obiektem danych z czterema reprezentacjami:

1. Mind Map — reprezentacja hierarchii, gałęzi, relacji i struktury myślenia.
2. Whiteboard — reprezentacja przestrzenna, warsztatowa i swobodna.
3. Process Flow — reprezentacja procesu, decyzji, lane'ów, przepływu i walidacji.
4. Table — reprezentacja danych, właściwości, widoków, filtrów i scoringu.

Zmiana reprezentacji nie tworzy nowego obiektu. Pokazuje te same dane w innym trybie pracy. Jeżeli funkcja tworzy nowy artefakt, nowy raport albo nową reprezentację niesynchronizowaną, musi być nazwana inaczej niż zwykłe przełączenie widoku.

## Wspólny model danych

Każda Idea musi mieć wspólne pola:

- `ideaId`
- nazwa
- opis problemu / brief
- etap
- status zapisu
- właściciel
- elementy
- relacje
- komentarze
- powiązania
- załączniki / źródła
- historia
- metadane AI
- reprezentacje widoku

Każdy element powinien mieć:

- `elementId`
- typ
- nazwa / etykieta
- opis
- status
- priorytet
- właściciel, jeżeli dotyczy
- pozycja przestrzenna, jeżeli dotyczy canvasu
- właściwości specyficzne dla narzędzia
- relacje
- komentarze
- załączniki
- historia zmian

## Macierz scope

Każda akcja musi mieć dokładnie jeden scope podstawowy.

| Scope | Co oznacza | Gdzie akcja powinna mieszkać |
|---|---|---|
| `workspace` | cała Idea | Menu 1, Teresa, Convert, prawy panel Przegląd |
| `current_view` | aktualna reprezentacja | Menu 3, view More, prawy dolny przełącznik widoku |
| `selected_items` | wiele zaznaczonych elementów | floating toolbar, menu zaznaczenia |
| `single_item` | jeden element | Inspektor, menu elementu, floating toolbar |
| `edge` | połączenie/krawędź | menu krawędzi, floating edge toolbar |
| `lane_frame` | lane, frame, area, section | menu lane/frame, Inspektor |
| `table_row` | jeden rekord tabeli | menu wiersza, Inspektor |
| `table_column` | pole/kolumna | menu nagłówka, Fields manager |
| `table_cell` | pojedyncza komórka | menu komórki, inline editor |
| `external_artifact` | decyzja, zadanie, inicjatywa, dokument | Powiązania, Convert, link graph |

## Twarde zakazy scope

1. Akcja globalna nie może mieszkać w lewym railu.
2. Akcja zaznaczenia nie może mieszkać w globalnym `More`.
3. Akcja `Delete selected` nie może być pokazywana, gdy nie ma zaznaczenia.
4. `Convert` całej Idea nie może wyglądać tak samo jak `Convert selected`.
5. `Export` nie może tworzyć trwałego artefaktu w systemie.
6. `Create from map` nie może oznaczać jednocześnie przełączenia widoku, konwersji i otwarcia panelu.
7. AI bez LLM nie może być etykietowane jako AI.
8. Akcja dostępna w UI nie może być cichym no-op.

## Przełączanie reprezentacji

Przełącznik czterech reprezentacji znajduje się w prawym dolnym rogu obok zoomu i minimapy.

Układ:

`- 100% + | Fit | Minimap icon | View: Mind Map dropdown`

Dropdown widoku:

- Mind Map
- Process Flow
- Table
- Whiteboard

Zasady:

- Aktywny widok jest zaznaczony.
- Przełączenie widoku nie zmienia danych.
- Przełączenie widoku nie przełącza ekranu innym użytkownikom.
- Stan aktywnego widoku jest preferencją lokalną użytkownika, nie globalnym stanem Idea.
- Minimap jest osobną ikoną. Nie wolno używać tekstu `Mindmap` jako kontrolki minimapy.

