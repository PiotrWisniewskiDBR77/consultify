# Consultify — polecenie stabilizacji gridu n-Type

## Cel

Ustabilizować układ sześciu kart n-Type w Consultify:

1. Zadanie
2. Decyzja
3. Insight
4. Inicjatywa
5. Narzędzie
6. Powiadomienie

Zakres obejmuje wyłącznie stabilizację gridu, menu, paneli, szerokości kolumn, hierarchii akcji i podstawowej przewidywalności komponentów. Nie rozszerzać zakresu o nowe funkcje produktowe, nowe typy kart, nowe workflow ani przebudowę logiki biznesowej.

## Zasady ogólne

1. Wszystkie karty n-Type mają wyglądać jak warianty jednego systemu, a nie jak osobne ekrany projektowane niezależnie.
2. Pierwszy poziom menu zarządza całym artefaktem.
3. Drugi poziom menu zarządza aktualną kartą, trybem pracy i pomocniczymi narzędziami.
4. Lewy panel pokazuje listę kart/sekcji danego artefaktu.
5. Centralna część służy do pracy na treści.
6. Prawy panel jest stałym komponentem systemowym dla akcji, właściwości, relacji i historii.
7. Informacje techniczne, pomocnicze lub rzadkie trafiają do menu trzech kropek.
8. Bannery i dodatkowe paski informacyjne należy usunąć, jeśli powielają informacje dostępne w statusie, właściwościach lub prawym panelu.
9. Nie wprowadzać nowych wariantów layoutu bez wyraźnego uzasadnienia w dokumentacji komponentu.

## Zmiany w dokumentacji systemowej

Zaktualizować dokumentację komponentów n-Type o następujące standardy:

- `NTypeShell`
- `NTypeHeader`
- `NTypeSubnav`
- `NTypeSectionList`
- `NTypeContentColumn`
- `NTypeRightPanel`
- `NTypeActionsSection`
- `NTypeEditableField`
- `NTypeAIButton`
- `NTypePreviewMode`

Dokumentacja musi wskazywać:

- obowiązkową kolejność elementów,
- dopuszczalne warianty szerokości,
- zasady ukrywania i zwijania sekcji,
- zasady używania akcji głównych,
- zasady obsługi pustych sekcji,
- różnicę między trybem edycji i podglądu,
- zasady dla alertów i informacji o źródle.

## Wspólny standard gridu

Docelowy desktopowy grid n-Type:

| Obszar | Standard |
|---|---:|
| Lewy panel sekcji | 216 px |
| Odstęp lewy panel — środek | 24 px |
| Centralna kolumna dokumentowa | 720–760 px |
| Centralna kolumna analityczna | 800–900 px |
| Odstęp środek — prawy panel | 24 px |
| Prawy panel | 320 px |

Cały moduł n-Type powinien być wyrównany do wspólnej osi i mieć tę samą szerokość dla:

- pierwszego poziomu menu,
- drugiego poziomu menu,
- układu: lewy panel + środek + prawy panel.

Nie dopuszczać sytuacji, w której nagłówek kończy się w innym miejscu niż panel roboczy albo prawy panel ma inną szerokość na poszczególnych kartach.

## Pierwszy poziom menu

Kolejność elementów:

`← | ikona typu | nazwa artefaktu | status | stan zapisu | AI | główna akcja | ⋯`

Zasady:

- nazwa artefaktu jest nazwą konkretnego obiektu, nie nazwą typu,
- status zawsze znajduje się po nazwie,
- stan zapisu jest spójny we wszystkich kartach,
- przycisk AI otwiera rozmowę w kontekście całego artefaktu,
- jedna oczywista akcja może pozostać w nagłówku,
- jeśli działań jest więcej, trafiają do sekcji `Actions` w prawym panelu,
- menu trzech kropek zawiera działania rzadkie, techniczne i kontekstowe.

Do menu trzech kropek przenieść między innymi:

- kopiowanie linku,
- duplikowanie,
- eksport techniczny,
- archiwizację,
- usuwanie,
- ustawienia obiektu,
- inne działania drugorzędne.

## Drugi poziom menu

Docelowy układ:

- lewa strona: `Sections`,
- geometryczny środek całego paska: `Edit | Preview`,
- prawa strona: `How to / Knowledge base`, jeśli występuje,
- skrajna prawa strona: `Analyze with AI`.

Zasady:

- `Sections` dotyczy wyłącznie widoczności i kolejności kart/sekcji,
- usunąć `Nowa karta`, jeśli sugeruje tworzenie niestandardowych kart spoza katalogu systemowego,
- `Edit | Preview` ma być dokładnie na środku całego paska,
- `Analyze with AI` ma być zawsze najbardziej po prawej,
- wszystkie przyciski AI mają korzystać z jednego fioletowego standardu wizualnego,
- drugi poziom nie zawiera głównych akcji workflow.

## Lewy panel sekcji

Standard:

- szerokość 216 px,
- stałe wcięcia,
- aktywna karta zawsze z tym samym tłem i pionowym wyróżnikiem,
- ikony i tekst na jednej osi,
- liczniki po prawej,
- grupy mogą być zwijane,
- długie listy mają własne przewijanie,
- stan zwinięcia grup może być zapamiętywany.

Lewy panel nie powinien zmieniać szerokości zależnie od liczby kart ani długości nazw.

## Centralna kolumna treści

Standard:

- nagłówki, pola i separatory zaczynają się na jednej osi,
- pole tekstowe automatycznie dopasowuje wysokość do treści,
- użytkownik może ręcznie zwiększyć wysokość pola,
- po ręcznym zwiększeniu automatyczne kurczenie pola jest wyłączone,
- musi istnieć możliwość powrotu do automatycznej wysokości,
- AI przy polu zawsze znajduje się przy prawej krawędzi pola,
- uchwyt zmiany wysokości zawsze znajduje się w prawym dolnym rogu pola,
- tekst nie może rozciągać się na zbyt długą linię tylko dlatego, że ekran ma wolne miejsce.

Dopuszczalne tryby:

- tryb dokumentowy: 720–760 px dla długich opisów,
- tryb analityczny: 800–900 px dla kart, tabel, porównań i wyników.

## Prawy panel

Prawy panel ma być jasnym, zaokrąglonym komponentem systemowym o stałej szerokości 320 px.

Kolejność sekcji:

1. Actions
2. Properties
3. Relations
4. Sources & Assumptions
5. Results / Outcomes, tylko jeśli semantycznie występują
6. Comments
7. History

Zasady:

- `Actions` i `Properties` są domyślnie rozwinięte,
- pozostałe sekcje mogą być domyślnie zwinięte,
- sekcje można niezależnie zwijać i rozwijać,
- puste sekcje mogą być widoczne jako zwinięte z licznikiem `0`,
- nie usuwać losowo `Comments` i `History` z wybranych kart,
- wartości w `Properties` muszą mieć stałe formatowanie,
- długie wartości mogą zawijać się maksymalnie do dwóch wierszy,
- pełna wartość dostępna w tooltipie,
- nie pokazywać technicznych identyfikatorów jako głównej treści chipów.

## Hierarchia akcji

W sekcji `Actions`:

- maksymalnie jedna akcja primary,
- maksymalnie 1–2 akcje secondary widoczne od razu,
- akcje destrukcyjne jako czerwony outline,
- pozostałe działania w `More`.

Nie dublować tej samej akcji w nagłówku i prawym panelu.

## Wymagania dla poszczególnych kart

### Zadanie

Zmiany:

- poszerzyć centralną kolumnę o około 80–120 px względem obecnego widoku, jeśli jest zbyt wąska,
- usunąć szeroki czerwony banner terminu,
- informację o terminie i przekroczeniu pokazać w `Properties`, statusie lub małym alercie przy treści,
- usunąć bannery źródłowe, jeśli powielają dane z prawego panelu,
- zachować standardowy układ `Sections | Edit/Preview | Analyze with AI`,
- dopilnować, aby lista kontrolna i opis używały tego samego gridu pól.

### Decyzja

Zmiany:

- zachować obecną szerokość centralnej treści jako bliską wzorcowej,
- ujednolicić puste pola, np. `Additional Context`, aby wyglądały jak pełnoprawne pola edycyjne,
- ograniczyć liczbę widocznych akcji w prawym panelu,
- usunąć duplikację typu `Submit for review` / `Send to review`,
- ustalić jedną główną akcję, a pozostałe schować w `More`,
- prawy panel utrzymać w standardzie 320 px.

### Insight

Zmiany:

- utrzymać tryb analityczny centralnej kolumny,
- ograniczyć długość linii tekstu wewnątrz kart findings,
- nie rozciągać długich akapitów na pełną szerokość karty,
- usunąć komunikat `Actions are hidden in preview mode`,
- w trybie Preview sekcja `Actions` ma być zwinięta albo ukryta bez komunikatu opisowego,
- zachować `Comments` i `History` w prawym panelu.

### Inicjatywa

Zmiany:

- usunąć banner `initiative working document` i podobne instrukcyjne paski,
- informacje o etapie, draftcie i następnym kroku przenieść do statusu, `Properties` lub `Actions`,
- poszerzyć centralną kolumnę, jeśli obecny układ jest zbyt wąski wobec liczby sekcji,
- długi lewy panel musi mieć własne przewijanie,
- grupy w lewym panelu powinny być zwijane i mieć sticky nagłówki,
- długie źródła w `Properties` skracać czytelnie, bez eksponowania technicznych identyfikatorów.

### Narzędzie

Zmiany:

- zachować czysty, informacyjny charakter ekranu,
- ograniczyć wewnętrzną szerokość tekstu w szerokich boxach,
- jeśli `Edit | Preview` nie występuje, zachować geometrię drugiego menu i nie przesuwać pozostałych przycisków do środka,
- `How to / Knowledge base` pozostawić po prawej jako przycisk pomocniczy,
- `Analyze with AI` zawsze na skraju prawej strony,
- uzupełnić prawy panel o `Comments` i `History`, jeśli ich brakuje.

### Powiadomienie

Zmiany:

- poszerzyć centralny obszar, ponieważ obecny widok zostawia zbyt dużo pustej przestrzeni,
- zachować standardową szerokość lewego panelu mimo małej liczby sekcji,
- nie traktować małej liczby kart jako powodu do zmiany gridu,
- upewnić się, że prawy panel zawiera pełny standard sekcji,
- akcje typu `Przeczytane`, `Odłóż`, `Usuń` uporządkować zgodnie z hierarchią: primary, secondary, destructive,
- destrukcyjne `Usuń` nie może wyglądać jak neutralna akcja.

## Priorytety

### P0 — stabilizacja gridu

- stała szerokość lewego panelu,
- stała szerokość prawego panelu,
- dwa dopuszczalne tryby szerokości centralnej treści,
- identyczna szerokość pierwszego i drugiego poziomu menu,
- wspólne osie wyrównania,
- brak przypadkowego przesuwania elementów między kartami.

### P1 — menu, akcje i prawy panel

- ujednolicić kolejność elementów w nagłówku,
- ustawić `Edit | Preview` geometrycznie na środku drugiego menu,
- przenieść nadmiarowe akcje do `Actions` lub `More`,
- usunąć duplikaty akcji,
- dodać brakujące `Comments` i `History`,
- ustalić zachowanie sekcji `Actions` w trybie Preview.

### P1 — usunięcie bannerów

- usunąć bannery źródłowe i procesowe powielające prawy panel,
- czerwone ostrzeżenia zastąpić właściwością, statusem albo małym alertem,
- nie tworzyć dodatkowych pasków pomiędzy drugim menu a treścią, jeśli nie są krytyczne.

### P2 — dopracowanie treści

- ograniczyć długość linii tekstu,
- poprawić empty states,
- ujednolicić pola edycyjne,
- dopracować auto-height i ręczne resize,
- zawijać długie wartości w `Properties`,
- dodać tooltipy dla przyciętych wartości,
- dodać sticky nagłówki i zwijanie grup w długim lewym panelu.

## Kryteria akceptacji

Zmiana jest ukończona, gdy:

1. Wszystkie sześć kart korzysta ze wspólnego gridu.
2. Lewy panel ma tę samą szerokość na wszystkich kartach.
3. Prawy panel ma tę samą szerokość na wszystkich kartach.
4. Pierwsze i drugie menu mają tę samą szerokość i wspólne osie z układem poniżej.
5. `Edit | Preview` jest geometrycznie na środku drugiego paska.
6. `Analyze with AI` jest zawsze najbardziej po prawej.
7. `Sections` jest zawsze po lewej i dotyczy wyłącznie kart/sekcji.
8. Nie ma przycisku `Nowa karta`, jeśli system nie pozwala tworzyć niestandardowych kart.
9. Prawy panel ma przewidywalną kolejność sekcji.
10. `Comments` i `History` nie znikają losowo z kart.
11. Nie ma szerokich bannerów powielających informacje z prawego panelu.
12. Akcje nie są zdublowane między nagłówkiem i prawym panelem.
13. W `Actions` widoczna jest maksymalnie jedna akcja primary.
14. Długie teksty nie przekraczają czytelnej długości linii.
15. Pola tekstowe dopasowują wysokość do treści.
16. Ręczne powiększenie pola wyłącza automatyczne kurczenie.
17. Tryb Preview nie pokazuje komunikatów typu `Actions are hidden in preview mode`.
18. Długie wartości w `Properties` są skracane czytelnie i mają tooltip.
19. Długie lewostronne listy sekcji przewijają się niezależnie.
20. Nie dodano nowych funkcji poza zakresem stabilizacji gridu.

## Plan wykonania

### Etap 1 — audyt komponentów

Zidentyfikować komponenty odpowiadające za:

- shell n-Type,
- pierwszy poziom menu,
- drugi poziom menu,
- lewy panel sekcji,
- centralną kolumnę,
- prawy panel,
- pola edycyjne,
- sekcję `Actions`,
- tryb Preview.

Nie zmieniać jeszcze logiki biznesowej.

### Etap 2 — tokeny i grid

Wprowadzić wspólne tokeny:

- `--ntype-left-panel-width: 216px`
- `--ntype-right-panel-width: 320px`
- `--ntype-column-gap: 24px`
- `--ntype-content-document-width: 720px`
- `--ntype-content-document-max-width: 760px`
- `--ntype-content-analytics-width: 800px`
- `--ntype-content-analytics-max-width: 900px`

Podłączyć tokeny do wszystkich sześciu kart.

### Etap 3 — menu

Ujednolicić pierwszy i drugi poziom menu:

- stała kolejność elementów,
- stałe wyrównanie,
- środkowy `Edit | Preview`,
- prawy `Analyze with AI`,
- usunięcie zbędnych przycisków.

### Etap 4 — prawy panel

Ustabilizować:

- szerokość,
- tło,
- zaokrąglenie,
- kolejność sekcji,
- empty states,
- hierarchię akcji,
- zachowanie Preview.

### Etap 5 — karta po karcie

Wprowadzić wymagania szczegółowe dla:

1. Zadania
2. Decyzji
3. Insightu
4. Inicjatywy
5. Narzędzia
6. Powiadomienia

Nie dodawać nowych możliwości funkcjonalnych w trakcie tego etapu.

### Etap 6 — QA wizualne

Sprawdzić wszystkie sześć kart na tych samych szerokościach viewportu:

- desktop standardowy,
- szeroki desktop,
- minimalny obsługiwany desktop.

Dla każdej karty wykonać kontrolę:

- wyrównania osi,
- szerokości paneli,
- położenia menu,
- zachowania długich tekstów,
- zachowania pustych wartości,
- trybu Edit,
- trybu Preview.

### Etap 7 — zamknięcie zakresu

Po wykonaniu zmian nie kontynuować prac w kierunku:

- nowych funkcji AI,
- nowych typów kart,
- nowych workflow,
- przebudowy modelu danych,
- redesignu całej aplikacji,
- zmian w module Idea Workspace.

Ten dokument dotyczy wyłącznie stabilizacji gridu i spójności n-Type.
