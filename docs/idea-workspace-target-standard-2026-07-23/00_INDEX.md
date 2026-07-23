# Idea Workspace — docelowy standard systemu menu

Data: 2026-07-23  
Zakres: Idea Workspace w Consultify: Mind Map, Whiteboard, Process Flow, Table oraz wspólna powłoka.

## Cel dokumentacji

Ten pakiet opisuje docelowy system menu, paneli i akcji dla Idea Workspace. Ma być dokumentem wykonawczym dla Claude'a/developera: po przeczytaniu nie powinno być wątpliwości, gdzie dana funkcja ma się znajdować, jaki ma zakres działania, jak ma wyglądać i co ma się wydarzyć po kliknięciu.

## Pliki

0. `00_MASTER_DEEP_STANDARD.md` — główny, pełny opis docelowego systemu: sens funkcji, role powierzchni, prawy panel, AI, Convert/Export/Import i narzędzia.
1. `01_PRODUCT_MODEL_AND_SCOPE.md` — model produktu, cztery reprezentacje i macierz zakresu akcji.
2. `02_SCREEN_ARCHITECTURE.md` — pełna architektura ekranu i odpowiedzialność każdej warstwy.
3. `03_MENU_1_TOP_BAR.md` — pierwszy pasek: obiekt Idea, status, Teresa, Convert i kebab.
4. `04_MENU_3_SECOND_BAR.md` — drugi pasek: akcje aktualnego widoku.
5. `05_LEFT_RAIL_STANDARD.md` — lewy rail edycyjny dla Mind Map, Whiteboard, Process Flow i Table.
6. `06_RIGHT_PANEL_STANDARD.md` — prawy panel: najważniejszy rozdział, pełny kanon docelowy.
7. `07_CONTEXT_MENUS_AND_SELECTION.md` — prawy klik, menu elementu, menu krawędzi i floating toolbar.
8. `08_AI_STANDARD.md` — AI w całym systemie: poziomy, scope, preview, undo i historia.
9. `09_CONVERT_EXPORT_IMPORT_TEMPLATES.md` — Convert, Create, Export, Import i Templates.
10. `10_TOOL_SPECIFICATIONS.md` — specyfikacje per narzędzie.
11. `11_TECHNICAL_ACCEPTANCE_AND_BACKLOG.md` — kryteria akceptacji i backlog naprawczy.
12. `12_AUTONOMOUS_IMPLEMENTATION_AND_VISUAL_QA_LOOP.md` — kontrakt pracy dla Claude Code: autonomiczna pętla implementacji, Playwright, screenshoty, agenci-sceptycy, bramki jakości i raport dowodowy.

## Decyzje kierunkowe

1. Idea jest jednym obiektem danych oglądanym i edytowanym w czterech reprezentacjach: Mind Map, Whiteboard, Process Flow, Table.
2. Przełączanie reprezentacji nie jest konwersją i nie tworzy nowego obiektu.
3. Docelowy standard Tabeli opiera się na kierunku P15/platformowym. Legacy jest ścieżką do wygaszenia.
4. Prawy panel Idea nie zostaje przy obecnym układzie `Problem / Status / Inspector / Convert / Health`. Zostaje zastąpiony kanonem:
   `Przegląd / Inspektor / Powiązania / Komentarze / Historia`.
5. `Convert` nie jest zakładką prawego panelu. Jest akcją tworzenia artefaktu i należy do Menu 1 lub menu zaznaczenia.
6. `Export` oznacza wyłącznie eksport pliku. Tworzenie raportu lub prezentacji jest konwersją, nie eksportem.
7. Każda widoczna akcja musi mieć handler dla aktywnego narzędzia. Nie wolno wywoływać akcji `mm_*` poza Mind Map.

## Benchmark rynkowy użyty w decyzjach

Wzorzec opiera się na sprawdzonych podziałach odpowiedzialności:

- Miro rozdziela menu boardu, narzędzia tworzenia/edycji, współpracę i prezentację.
- FigJam rozdziela toolbar na nawigację, obiekty, narzędzia i inserty.
- Figma traktuje toolbar jako hub interakcji z canvasem oraz dodawania obiektów.
- Airtable trzyma sortowanie, grupowanie i filtrowanie w konfiguracji widoku, a nie jako dowolne akcje canvasowe.
- Lucidchart traktuje lane'y i procesowe kształty jako semantyczne elementy diagramu, nie zwykłe dekoracje.

## Słownik

- `Menu 1` — pierwszy pasek, dotyczy całej Idea.
- `Menu 3` — drugi pasek, dotyczy aktualnej reprezentacji.
- `Lewy rail` — pionowy pasek narzędzi edycji.
- `Prawy panel` — panel informacji, inspekcji, powiązań, komentarzy i historii.
- `Floating toolbar` — pasek po zaznaczeniu elementu lub grupy.
- `Context menu` — menu prawego kliknięcia.
- `Scope` — zakres działania akcji: workspace, view, selection, item, edge, lane/frame, table row, table column, table cell.
