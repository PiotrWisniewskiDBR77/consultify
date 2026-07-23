# Idea Workspace — pełny docelowy standard UX, menu i zachowania systemu

Data: 2026-07-23  
Produkt: Consultify / Idea Workspace  
Zakres: Mind Map, Whiteboard, Process Flow, Table oraz wspólna powłoka Idea

## 1. Po co istnieje Idea Workspace

Idea Workspace nie jest zestawem czterech osobnych narzędzi. To jedno środowisko pracy nad pomysłem, problemem, hipotezą albo obszarem do opracowania, które użytkownik może oglądać i rozwijać w czterech reprezentacjach:

- Mind Map — do rozbijania problemu na gałęzie, zależności, hipotezy i obszary myślenia.
- Whiteboard — do swobodnej pracy warsztatowej, klastrowania, facylitacji, głosowania i handoffu.
- Process Flow — do opisania przebiegu procesu, decyzji, odpowiedzialności, lane'ów i walidacji.
- Table — do pracy na danych, właściwościach, widokach, scoringu, filtrach i rekordach.

Użytkownik nie powinien mieć poczucia, że przechodzi między czterema aplikacjami. Ma mieć poczucie, że pracuje nad jedną Idea i wybiera najlepszy sposób reprezentowania tej samej treści.

Najważniejsza zasada:

> Jedna Idea, jeden model danych, cztery reprezentacje, jeden spójny system menu.

Jeżeli użytkownik doda element w Mind Map, system powinien potrafić pokazać ten element w Table jako rekord, w Whiteboard jako obiekt roboczy, a w Process Flow jako krok lub kandydat do kroku, o ile semantyka na to pozwala. Nie każda właściwość musi być widoczna w każdej reprezentacji, ale użytkownik nie może mieć poczucia, że dane giną albo że każda reprezentacja żyje własnym, niepołączonym życiem.

## 2. Główny problem obecnego systemu

Obecny system ma dobry kierunek, ale jest rozbity architektonicznie. Największy problem nie polega na tym, że ikony są brzydkie albo że brakuje pojedynczego przycisku. Największy problem polega na tym, że te same słowa i te same powierzchnie UI znaczą różne rzeczy w różnych miejscach.

Przykłady:

- `AI expand` w jednym widoku działa, w innym jest martwe.
- `Convert` raz oznacza konwersję całej Idea, raz gałęzi, raz wiersza, raz wejście do panelu.
- `Export` zawiera czasem prawdziwy eksport pliku, a czasem generowanie raportu lub prezentacji, czyli realnie Convert.
- prawy panel ma ikony, które wyglądają jak zakładki, ale nie przełączają treści.
- Whiteboard ma pływający panel warsztatu, który zawiera ważną funkcjonalność, ale wygląda jak przypadkowy klocek przyklejony do canvasu.
- Table ma dwa światy: legacy i P15, z różnymi zachowaniami, różnymi menu i różnymi możliwościami.

Docelowy standard musi więc najpierw rozdzielić odpowiedzialności. Dopiero potem można mówić o wyglądzie.

## 3. Docelowy model mentalny użytkownika

Użytkownik powinien rozumieć system tak:

1. Na górze widzę, nad jaką Idea pracuję.
2. Drugi pasek mówi mi, co mogę zrobić w aktualnym widoku.
3. Lewy rail służy do tworzenia i edycji elementów.
4. Prawy panel służy do informacji, szczegółów, relacji, komentarzy i historii.
5. Menu po prawym kliknięciu daje działania właściwe dla miejsca, w które kliknąłem.
6. Floating toolbar daje szybkie działania na tym, co zaznaczyłem.
7. Prawy dolny róg służy do nawigacji po przestrzeni: zoom, fit, minimapa i zmiana reprezentacji.
8. Teresa rozmawia o całej Idea.
9. AI w widoku analizuje aktualny widok.
10. AI przy elemencie działa na tym elemencie lub zaznaczeniu.

Jeżeli użytkownik zna tę logikę, może przejść do dowolnej reprezentacji i nadal przewidzieć, gdzie znajdzie funkcję.

## 4. Architektura ekranu

Każdy widok Idea Workspace ma osiem warstw:

1. Menu 1 — pierwszy pasek, czyli tożsamość całej Idea.
2. Menu 3 — drugi pasek, czyli akcje aktualnej reprezentacji.
3. Lewy rail — szybkie narzędzia edycji.
4. Obszar roboczy — canvas albo tabela.
5. Prawy panel — przegląd, inspektor, powiązania, komentarze, historia.
6. Floating toolbar — szybkie akcje na zaznaczeniu.
7. Context menus — prawy klik na tle, elemencie, krawędzi, lane/frame, wierszu, kolumnie, komórce.
8. Prawy dolny narożnik — zoom, fit, minimapa, przełącznik reprezentacji.

Te warstwy nie są zamienne. Każda ma swoje zadanie.

### 4.1. Menu 1 — tożsamość całej Idea

Menu 1 odpowiada na pytanie:

> Nad czym pracuję i co mogę zrobić z całą Idea?

Zawiera:

- powrót do listy Ideas,
- breadcrumb,
- nazwę Idea,
- status/etap,
- stan zapisu,
- Teresę,
- Convert całej Idea,
- kebab globalny.

Nie zawiera:

- dodawania węzłów,
- usuwania zaznaczenia,
- auto-layoutu,
- lokalnych działań na elemencie,
- narzędzi specyficznych dla jednej reprezentacji.

Nazwa w Menu 1 jest nazwą całego obiektu. Nie wolno dopisywać do niej `Mind Map`, `Table`, `Whiteboard` ani `Process Flow`. Aktualna reprezentacja jest pokazywana w prawym dolnym przełączniku.

### 4.2. Menu 3 — akcje aktualnej reprezentacji

Menu 3 odpowiada na pytanie:

> Co mogę zrobić w aktualnym widoku?

To nie jest drugi globalny pasek. To pasek kontekstowy dla aktywnej reprezentacji.

Mind Map ma w nim rzeczy związane z mapą. Whiteboard ma warsztat, tworzenie i porządkowanie tablicy. Process Flow ma typ przepływu, elementy procesu i walidację. Table ma widoki, pola, organizowanie danych i import/eksport danych.

Menu 3 nie może wywoływać handlerów innego narzędzia. Jeżeli użytkownik jest w Whiteboard, przycisk AI nie może dispatchować `mm_ai_expand`. Jeżeli użytkownik jest w Process Flow, Auto-layout nie może wysyłać eventu Mind Map.

### 4.3. Lewy rail — warsztat edycji

Lewy rail odpowiada na pytanie:

> Jak szybko dodać, zaznaczyć, połączyć, skomentować albo edytować elementy w aktualnym widoku?

To jest odpowiednik głównego toolbara w narzędziach typu FigJam/Figma/Miro. Ma być szybki, ikonowy, kontekstowy i bardzo przewidywalny.

Nie wolno tam trzymać:

- przełączania reprezentacji,
- Convert,
- Export,
- globalnej historii,
- ustawień całej Idea.

### 4.4. Prawy panel — system informacji

Prawy panel odpowiada na pytanie:

> Co wiem o całej Idea, aktualnym zaznaczeniu, powiązaniach, komentarzach i historii?

To jest najważniejszy komponent do przebudowy. Obecny panel jest niespójny, częściowo nie działa jako zakładki i miesza kilka poziomów informacji.

Docelowo prawy panel ma pięć modułów:

1. Przegląd
2. Inspektor
3. Powiązania
4. Komentarze
5. Historia

Ten kanon obowiązuje we wszystkich reprezentacjach.

### 4.5. Floating toolbar — szybkie akcje zaznaczenia

Floating toolbar odpowiada na pytanie:

> Co mogę natychmiast zrobić z tym, co zaznaczyłem?

Zawiera szybkie, bezpośrednie działania:

- edit,
- duplicate,
- link,
- comment,
- AI,
- style,
- convert selected,
- delete.

Nie zawiera ustawień całej Idea.

### 4.6. Menu kontekstowe

Menu kontekstowe odpowiada na pytanie:

> Co mogę zrobić z miejscem albo obiektem, na który kliknąłem prawym przyciskiem?

Prawy klik na tle, elemencie, krawędzi, lane, wierszu, kolumnie i komórce to różne sytuacje. Muszą mieć różne menu.

## 5. Prawy panel — pełny standard docelowy

Prawy panel jest krytyczny, bo obecnie wygląda i działa najgorzej. Docelowo ma stać się przewidywalnym centrum informacji o Idea.

### 5.1. Wygląd prawego panelu

Panel ma wyglądać jak komponent systemowy, nie jak techniczny sidebar.

Wymagania wizualne:

- jasne tło,
- delikatne obramowanie,
- radius 8 px,
- stała szerokość około 380 px,
- odstęp od canvasu,
- odstęp od prawej krawędzi,
- własny scroll,
- czytelny aktywny stan zakładki,
- tooltipy przy ikonach,
- brak ciężkich, tabelarycznych bloków bez hierarchii.

Panel powinien być wizualnie spójny z Menu 1 i Menu 3. Lewy/canvasowy obszar może mieć neutralne tło, a prawy panel powinien być jasnym elementem systemowym.

### 5.2. Zakładki prawego panelu

Prawy rail ma pięć ikon:

- Przegląd
- Inspektor
- Powiązania
- Komentarze
- Historia

Kliknięcie ikony:

- otwiera panel, jeśli był zamknięty,
- przełącza treść, jeśli panel był otwarty,
- zamyka panel, jeśli kliknięto aktywną ikonę drugi raz.

Aktywna zakładka jest stanem lokalnym użytkownika. Nie wolno synchronizować jej jako globalnego stanu Idea.

### 5.3. Przegląd

Przegląd opisuje całą Idea.

To jest miejsce na:

- brief/problematykę,
- etap,
- status,
- właściciela,
- kompletność,
- health,
- liczbę elementów,
- liczbę relacji,
- ostatnią aktywność,
- główne źródła,
- rekomendowany kolejny krok.

Przegląd nie służy do edycji pojedynczego węzła, sticky, kroku ani wiersza. To jest poziom całej Idea.

Health nie jest osobną zakładką. Health jest częścią Przeglądu. Jeżeli system pokazuje wynik typu `No warnings`, musi być jasne, czy walidacja została wykonana. W Process Flow stan początkowy nie może brzmieć `No warnings`, bo to sugeruje, że system sprawdził proces. Poprawny stan początkowy to `Not validated`.

### 5.4. Inspektor

Inspektor opisuje to, co jest aktualnie zaznaczone.

Jeżeli nic nie zaznaczono, Inspektor pokazuje ustawienia aktualnego widoku:

- dla Mind Map: layout, levels, map display,
- dla Whiteboard: grid, background, workshop display,
- dla Process Flow: validation rules, lanes, notation,
- dla Table: current view settings.

Jeżeli zaznaczono jeden element, Inspektor pokazuje:

- nazwę,
- typ,
- opis,
- status,
- priorytet,
- właściwości,
- relacje,
- komentarze elementu,
- załączniki,
- akcje lokalne,
- AI lokalne.

Jeżeli zaznaczono wiele elementów, Inspektor pokazuje:

- licznik zaznaczonych,
- wspólne właściwości,
- bulk actions,
- AI dla zaznaczenia,
- align/distribute/group, jeśli dotyczy.

Jeżeli zaznaczono krawędź, Inspektor pokazuje:

- etykietę,
- typ relacji,
- kierunek,
- styl linii,
- source,
- target,
- możliwość usunięcia,
- możliwość wstawienia elementu na połączeniu.

Jeżeli użytkownik pracuje w Tabeli, Inspektor musi obsługiwać:

- rekord,
- kolumnę,
- komórkę,
- zaznaczenie wielu rekordów.

### 5.5. Powiązania

Powiązania muszą być osobną zakładką. Nie wolno ich chować w losowym miejscu Inspektora.

Powiązania pokazują:

- artefakty Consultify,
- backlinks,
- źródła,
- dokumenty,
- notebooki,
- interview,
- załączniki,
- linki zewnętrzne.

Użytkownik powinien móc przełączać zakres:

- cała Idea,
- aktualny widok,
- zaznaczenie.

Każde powiązanie pokazuje:

- typ,
- nazwę,
- status,
- źródło powiązania,
- datę,
- akcję otwarcia,
- akcję odłączenia, jeżeli dostępna.

Jeżeli w UI jest przycisk `Dodaj powiązanie`, musi mieć realny handler. Nie wolno zostawić martwego eventu.

### 5.6. Komentarze

Komentarze muszą być osobną zakładką, bo są osobną funkcją współpracy.

Zakładka Komentarze pokazuje:

- komentarze do całej Idea,
- komentarze do aktualnego widoku,
- komentarze do zaznaczonego elementu.

Przełącznik:

- Whole Idea
- Current view
- Selection

Komentarz zawiera:

- autora,
- datę,
- treść,
- odpowiedzi,
- status resolved/unresolved,
- wzmianki,
- oznaczenie AI, jeżeli komentarz wygenerowała AI.

Komentarze nie są historią zmian. Historia pokazuje zdarzenia systemowe. Komentarze pokazują współpracę.

### 5.7. Historia

Historia pokazuje log działań.

Filtry:

- All
- People
- AI
- System
- Import
- Convert

Wpis historii zawiera:

- kto,
- kiedy,
- co zmienił,
- zakres,
- starą wartość,
- nową wartość,
- link do elementu,
- możliwość porównania albo przywrócenia, jeśli dotyczy.

Zakładka nazywa się `Historia`. Nie `Historia / AI`. AI jest typem zdarzenia w historii.

### 5.8. Czego prawy panel nie może zawierać

Prawy panel nie może zawierać:

- globalnej zakładki Convert,
- Export,
- przełącznika reprezentacji,
- martwych ikon,
- Problem/Status/Health jako osobnych zakładek,
- AI jako zakładki bez jasnego scope.

Convert jest akcją, nie kategorią informacji. Jeżeli konwersja dotyczy całej Idea, mieszka w Menu 1. Jeżeli dotyczy zaznaczenia, mieszka w floating toolbarze, menu kontekstowym albo Inspektorze.

## 6. Menu 1 — szczegółowy standard

Menu 1 to najwyższa warstwa obiektu Idea.

Układ:

`Back | Ideas | Idea name | Stage | Save state`  
`Teresa | Convert | ...`

### 6.1. Nazwa Idea

Nazwa jest edytowalna. Klik w nazwę pozwala zmienić nazwę całego obiektu.

Nie wolno używać nazwy aktualnego widoku jako części nazwy.

### 6.2. Status zapisu

System musi pokazywać prawdziwy stan:

- Saved
- Saving
- Queued
- Local draft
- Offline
- Conflict

Konflikt nie może automatycznie odświeżać i gubić lokalnych zmian. Minimalny standard konfliktu to porównanie lokalnej i serwerowej wersji oraz możliwość zachowania kopii.

### 6.3. Teresa

Teresa w Menu 1 otwiera rozmowę o całej Idea.

To nie jest AI do pojedynczego pola. To nie jest AI do zaznaczenia. To asystent kontekstowy całego workspace.

Po otwarciu Teresa otrzymuje:

- nazwę Idea,
- brief,
- aktualny widok,
- wszystkie elementy,
- relacje,
- komentarze,
- powiązania,
- historię istotnych zdarzeń,
- aktualne zaznaczenie jako dodatkowy kontekst.

### 6.4. Convert

Convert w Menu 1 oznacza:

> Utwórz trwały artefakt z całej Idea.

Możliwe targety:

- Initiative
- Decision
- Task set
- Report
- Presentation

Convert musi mieć preview. Nie wolno tworzyć rekordu bez podglądu tego, co powstanie.

Convert musi zapisać:

- source Idea,
- zakres,
- target,
- autora,
- datę,
- wynik,
- link zwrotny.

Konwersja części Idea nie może oznaczać całej Idea jako promowanej.

## 7. Menu 3 — szczegółowy standard

Menu 3 jest inne dla każdego widoku, ale ma tę samą logikę.

### 7.1. Mind Map

Menu 3:

`Add node | Layout | Levels | AI | Templates | Export | More`

`Add node` dodaje nowy węzeł do aktualnego kontekstu.

`Layout` porządkuje mapę. To nie jest globalna funkcja systemu. To widokowa funkcja mapy.

`Levels` pozwala zarządzać głębokością widocznych gałęzi.

`AI` analizuje mapę lub gałąź. Musi zapytać albo pokazać scope.

`Templates` pokazuje szablony mapy.

`More` trzyma rzadkie ustawienia mapy.

### 7.2. Whiteboard

Menu 3:

`Workshop | Add | Arrange | AI | Templates | Save view | Export | More`

`Workshop` jest ważny. Obecny panel Session layer zawiera realne funkcje facylitacji, ale jest źle podany. Docelowo użytkownik klika `Workshop`, a system otwiera panel warsztatu.

Workshop obejmuje:

- rolę: facilitator, participant, observer,
- fazę: capture, organize, converge, handoff,
- timer,
- voting,
- follow me,
- lock board,
- participants.

Na canvasie zostają tylko małe wskaźniki aktywnego stanu:

- Voting open,
- Timer 04:32,
- Following facilitator.

`Add` dodaje sticky, text, shape, frame, image, link.

`Arrange` porządkuje zaznaczenie.

`AI` używa whiteboardowych akcji, np. find themes, name clusters, extract actions. Nie wolno używać `mm_ai_expand`.

### 7.3. Process Flow

Menu 3:

`Flow type | Add element | Lane | Auto-layout | Validate | AI | Templates | Export | More`

`Flow type` wybiera tryb:

- Classic Flow,
- Automation,
- Value Stream.

`Add element` pokazuje semantyczne elementy procesu.

`Lane` zarządza odpowiedzialnością.

`Auto-layout` musi działać procesowo.

`Validate` uruchamia walidację. Dopóki walidacja nie została uruchomiona, badge mówi `Not validated`.

`AI` uruchamia process coach albo proposal z podglądem.

`More` zawiera KPI, readback, process settings i shortcuts.

### 7.4. Table

Menu 3:

`Views | Add row | Fields | Organize | AI | Templates | Import | Export | More`

Tabela jest produktem danych, nie canvasem.

`Views` obsługuje saved views i layouty.

`Fields` zarządza kolumnami i typami pól.

`Organize` łączy filter, sort, group, hide fields.

`AI` pracuje na danych tabeli, ale każda zmiana danych wymaga preview.

`Import` importuje dane.

`Export` eksportuje dane do pliku.

`More` trzyma narzędzia drugorzędne, np. scoring, heatmap, audit, shortcuts.

Docelowo wybieramy kierunek P15/platformowy. Legacy nie może być równoległym docelowym UX.

## 8. Lewy rail — głęboki opis

Lewy rail powinien być szybkim, przewidywalnym warsztatem. Użytkownik powinien wiedzieć:

- góra raila = wybór i poruszanie,
- środek = tworzenie i relacje,
- niżej = komentarze, linki, AI,
- dół = więcej, undo, redo.

### 8.1. Mind Map rail

Mind Map rail służy do rozbudowy mapy:

- dodaj child,
- dodaj sibling,
- połącz węzły,
- dodaj komentarz,
- dołącz artefakt,
- AI dla gałęzi,
- zmień układ,
- cofnij.

Nie służy do eksportu ani konwersji całej Idea.

### 8.2. Whiteboard rail

Whiteboard rail służy do pracy przestrzennej:

- sticky,
- text,
- shape,
- draw,
- frame,
- connector,
- comment,
- link,
- AI for selection.

Draw nie powinien mieszkać jako osobny lokalny pasek nad canvasem, jeśli rail już jest narzędziem edycji.

### 8.3. Process Flow rail

Process Flow rail służy do diagramowania:

- start,
- end,
- activity,
- decision,
- connector,
- lane,
- split/join,
- comment,
- AI for step.

Przyciski muszą odpowiadać semantyce procesu. Nie może być sytuacji, że `Start/End` dodaje tylko Start.

### 8.4. Table rail

Table nie dostaje canvasowego raila. Jeżeli rail zostaje, ma być data-railem:

- AI,
- add row,
- fields,
- filter,
- sort,
- group,
- views,
- undo/redo.

Nie ma Hand, Connect, Minimap, Branch.

## 9. Menu kontekstowe

Menu kontekstowe ma być bardzo mocne, bo użytkownicy zaawansowani będą z niego korzystać stale.

### 9.1. Tło

Prawy klik na tle działa na miejsce kliknięcia albo aktualny widok.

Canvas:

- add here,
- paste,
- select all,
- fit view,
- auto-layout,
- AI for this area/view.

Whiteboard powinien mieć więcej niż tylko AI. Brak `Paste`, `Select all`, `Fit view` to luka.

### 9.2. Element

Prawy klik na elemencie działa na ten element.

Kolejność:

1. open/details,
2. edit,
3. duplicate,
4. copy/cut/paste,
5. structure,
6. AI,
7. convert,
8. appearance/data,
9. delete.

Jeżeli pozycja działa tylko dla typu `idea`, a kliknięty element nie jest tego typu, pozycja ma być disabled albo ukryta. Nie może klikać w pustkę.

### 9.3. Krawędź

Każde narzędzie z połączeniami musi mieć menu krawędzi.

Menu krawędzi:

- edit label,
- change relation type,
- reverse direction,
- line style,
- arrow,
- insert node on connection,
- delete.

### 9.4. Table

Tabela musi mieć:

- menu wiersza,
- menu komórki,
- menu nagłówka kolumny,
- menu zaznaczenia.

Brak menu komórki to luka w standardzie docelowym.

## 10. Floating toolbar

Floating toolbar ma być szybki, nie pełny.

Dla jednego elementu:

- edit,
- duplicate,
- comment,
- link,
- AI,
- style,
- convert selected,
- delete.

Dla wielu:

- count,
- group,
- align,
- distribute,
- duplicate,
- AI,
- convert,
- delete.

Floating toolbar nie może robić rzeczy o scope całej Idea.

## 11. AI — pełny standard

AI musi być rozdzielone według scope.

### 11.1. Teresa

Teresa jest rozmową o całej Idea. Może analizować, tłumaczyć, proponować. Nie modyfikuje danych bez preview.

### 11.2. AI w Menu 3

AI w Menu 3 działa na aktualny widok:

- mapa,
- tablica,
- proces,
- tabela.

Musi używać handlerów właściwych dla narzędzia.

### 11.3. AI zaznaczenia

AI z raila albo floating toolbara działa na zaznaczenie. Jeżeli nic nie zaznaczono, system musi powiedzieć, że działa na cały widok albo poprosić o zaznaczenie.

### 11.4. AI tabeli

AI tabeli jest ryzykowne, bo może nadpisać dane. Dlatego AI Fill, Categorize, Refresh, Scoring i Generate Fields muszą mieć preview.

### 11.5. Proposal review

Każda AI zmieniająca dane:

1. generuje propozycję,
2. pokazuje diff,
3. pozwala zastosować,
4. pozwala odrzucić,
5. zapisuje historię,
6. daje undo.

## 12. Convert, Export, Import, Templates

### 12.1. Convert

Convert tworzy trwały artefakt w Consultify.

Nie jest eksportem. Nie jest przełączeniem widoku.

Każdy Convert musi pokazać:

- co konwertuje,
- jaki scope,
- jaki target,
- co powstanie,
- link do źródła,
- preview.

### 12.2. Export

Export tworzy plik.

Jeżeli funkcja tworzy raport albo prezentację jako rekord w Consultify, to nie jest Export, tylko Convert.

### 12.3. Import

Import może być destrukcyjny, więc wymaga:

- preview,
- mapowania,
- confirm,
- snapshotu przed zmianą,
- undo.

### 12.4. Templates

Templates są bezpieczniejsze niż import, bo mają confirm. Ten wzorzec należy zachować i rozciągnąć na wszystkie destrukcyjne operacje.

## 13. Narzędzia — docelowe zachowanie

### 13.1. Mind Map

Mind Map to narzędzie myślenia strukturalnego. Wszystko w tym widoku powinno wzmacniać hierarchię, gałęzie i relacje.

Najważniejsze funkcje:

- dodawanie węzłów,
- dodawanie child/sibling,
- rozwijanie gałęzi,
- zwijanie poziomów,
- relacje między węzłami,
- AI do rozwijania i porządkowania,
- konwersja gałęzi do artefaktów.

### 13.2. Whiteboard

Whiteboard to narzędzie warsztatowe. Musi obsługiwać zarówno swobodną tablicę, jak i prowadzenie sesji.

Najważniejsze funkcje:

- sticky,
- shapes,
- frames,
- connectors,
- draw,
- clustering,
- voting,
- timer,
- follow me,
- workshop phases,
- save view/scenes,
- handoff.

Tryb warsztatowy jest ważną funkcją produktu, ale nie może stale zasłaniać canvasu jako wielki panel.

### 13.3. Process Flow

Process Flow to narzędzie modelowania procesu. Musi eksponować semantykę procesu.

Najważniejsze funkcje:

- Start,
- End,
- Activity,
- Decision,
- Lane,
- Connector,
- Split/Join,
- Auto-layout,
- Validate,
- KPI,
- Process Coach,
- Readback.

Nie wolno traktować procesu jak zwykłej mapy z prostokątami.

### 13.4. Table

Table to narzędzie danych. Musi działać jak uporządkowany data grid.

Najważniejsze funkcje:

- rows,
- fields,
- field types,
- saved views,
- filter,
- sort,
- group,
- layouts,
- AI fill/categorize/score,
- import/export,
- row/cell/column menus.

Table nie jest canvasem i nie dostaje canvasowych metafor.

## 14. Backlog naprawczy — kolejność

### Priorytet 0: integralność danych

- naprawić promote,
- nie nadpisywać całej Idea przy konwersji części,
- dodać historię wielu konwersji,
- zabezpieczyć import destrukcyjny.

### Priorytet 1: martwe kliki

- rozgałęzić akcje per activeTool,
- usunąć mindmapowe handlery z innych narzędzi,
- naprawić Menu 3,
- naprawić lewy rail,
- naprawić prawy panel.

### Priorytet 2: prawy panel

- zbudować pięć prawdziwych zakładek,
- dodać Powiązania,
- dodać Komentarze,
- usunąć Convert jako zakładkę,
- połączyć Problem/Status/Health w Przegląd.

### Priorytet 3: Table

- wybrać P15,
- wygasić legacy,
- zwinąć nadmiar ikon,
- dodać menu komórki,
- ujednolicić menu kolumn.

### Priorytet 4: AI

- proposal review dla każdej mutacji,
- usunąć AI bez LLM,
- ujednolicić scope,
- historia AI.

## 15. Definition of Done

System jest gotowy, gdy:

- użytkownik zawsze wie, gdzie czego szukać,
- prawy panel działa jako prawdziwy panel informacji,
- każda akcja ma scope,
- każda akcja ma handler,
- nie ma martwych klików,
- Convert, Export, Import i Templates są rozdzielone,
- AI nie nadpisuje danych bez zgody,
- Table nie ma dwóch równoległych UX-ów,
- przełączanie reprezentacji nie jest konwersją,
- cztery narzędzia wyglądają jak części jednego systemu.

