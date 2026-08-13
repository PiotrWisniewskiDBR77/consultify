# Ideas — macierz funkcji menu i ocena użyteczności

Status: **DO WSPÓLNEGO PRZEGLĄDU Z WŁAŚCICIELEM**
Zakres: Mind Map, Process Flow, Whiteboard, Table
Zasada: każda akcja musi odpowiadać na pytanie „jaki rezultat pracy uzyskuje użytkownik?”.

## 1. Powierzchnie wspólne

| Powierzchnia | Funkcja | Narzędzia | Rezultat użytkownika | Ocena | Decyzja |
|---|---|---|---|---|---|
| Menu 1 | Status Spark/Promoted | wszystkie | rozumie etap dojrzałości pomysłu | sensowna, jeśli status jest objaśniony | zostawić jako status; nie udawać CTA |
| Menu 1 | Stan zapisu | wszystkie | wie, czy praca została utrwalona | konieczna | jedna etykieta: zapisuje / zapisano / offline / błąd |
| Menu 1 | Save | wszystkie | wymusza zapis | dubluje autosave | ukrywać przy sprawnym autosave; pokazać przy retry/manual-save |
| Menu 1 | Teresa | wszystkie | omawia całą ideę lub zaznaczenie | sensowna | jedno globalne wejście, bez dubli |
| Menu 1 | Convert | wszystkie | tworzy dalszy artefakt pracy | podstawowy rezultat | zostawić jako jedyne główne CTA; nazwy rezultatów w rozwinięciu |
| Kebab Menu 1 | Duplikuj pomysł | wszystkie | tworzy niezależną kopię | sensowna | Organizacja |
| Kebab Menu 1 | Eksportuj | wszystkie | wynosi pracę do pliku | sensowna, ale była zdublowana | tylko tutaj; usunięte z Menu 3 |
| Kebab Menu 1 | Historia | wszystkie | przegląda/przywraca wersję | sensowna | Wersje |
| Kebab Menu 1 | Szukaj | wszystkie | znajduje element w artefakcie | sensowna przy dużej pracy | Więcej |
| Kebab Menu 1 | Skróty | wszystkie | poznaje sterowanie klawiaturą | sensowna, rzadka | Więcej |
| Kebab Menu 1 | Usuń pomysł | wszystkie | trwale usuwa artefakt | konieczna administracyjnie | ostatnia sekcja, potwierdzenie |
| Dolny pasek | Zmień reprezentację | wszystkie | przechodzi między 4 widokami tej samej idei | konieczna | wspólna geometria i stan aktywny |
| Dolny pasek | − / procent / + | 3 canvasy | kontroluje skalę pracy | konieczna | stale widoczne jako zwarta grupa |
| Dolny pasek `…` | Dopasuj, fullscreen, zaznaczenie, zapisany widok, snap, minimapa | zależnie od możliwości | zarządza rzadszymi ustawieniami widoku | sensowne, ale drugorzędne | schowane w jednym menu; bez wydłużania paska |
| PPM | akcje obiektu/tła/krawędzi/komórki | wszystkie | działa bez podróży do panelu | konieczne dla pracy eksperckiej | jeden komponent wizualny i klawiaturowy, osobne registry semantyczne |

## 2. Menu 3 — dynamiczny rząd pracy

| Narzędzie | Funkcje | Cel | Ocena / decyzja |
|---|---|---|---|
| Mind Map | Dodaj węzeł, Auto-układ, AI: rozwiń mapę, Szablony | budowa i porządkowanie mapy | wszystkie uzasadnione; AI musi pokazywać preview/undo |
| Process Flow | Dodaj element, Auto-układ, Szablony | budowa i porządkowanie procesu | uzasadnione; typ elementu wybierany po wejściu w Dodaj |
| Whiteboard | Dodaj karteczkę, Szablony | szybkie rozpoczęcie pracy | uzasadnione; szczegółowe typy elementów pozostają w railu |
| Table | Dodaj wiersz, Szablony | rozszerzenie danych lub start ze struktury | uzasadnione; nie używać pojęć canvasowych |
| wszystkie po zaznaczeniu | pasek edycji zaznaczenia zastępuje Menu 3 | edycja aktualnego obiektu | właściwy model; dokładnie jeden fizyczny rząd, zero nakładania |

Eksport nie należy do Menu 3: nie zmienia widoku ani bieżącego obiektu, tylko cały artefakt.

## 3. Prawy pływający rail narzędzi

| Narzędzie | Funkcje podstawowe | Funkcje dodatkowe | Ocena |
|---|---|---|---|
| Mind Map | wybór/pan, dodaj węzeł, połącz, ramka | AI, szablony, wiedza, komentarz, prezentacja, undo/redo | logika spójna; import/eksport nie powinien dublować kebaba dokumentu |
| Whiteboard | wybór/pan, karteczka, tekst, kształt, rysowanie, ramka | AI, szablony, undo/redo | spójny rail tworzenia; każdy tryb musi mieć widoczny stan aktywny |
| Process Flow | wybór/pan, start/koniec, akcja, decyzja, lane, połączenie | AI, szablony, grid, snap, undo/redo | spójny z modelowaniem procesu; grid/snap są stanami, nie akcjami jednorazowymi |
| Table | dodaj wiersz/kolumnę, widoki, filtr, układ danych | AI, undo/redo | wymaga języka danych; bez kursora/pan/kształtów |

Rail jest overlayem nad pełnowymiarowym obszarem roboczym. Startuje przy prawej krawędzi, wyśrodkowany pionowo; można go przeciągnąć uchwytem, pozycja jest zapamiętana osobno dla każdego narzędzia, a dwuklik uchwytu przywraca pozycję systemową.

## 4. Menu kontekstowe PPM

| Narzędzie / cel | Funkcje, które mają sens | Kandydaci do ograniczenia lub zgrupowania |
|---|---|---|
| Mind Map — węzeł | edytuj, dodaj potomka, połącz, kopiuj, duplikuj, usuń, komentarz | wiele akcji AI zwinąć do grupy AI, jeżeli lista przekracza wysokość canvasa |
| Mind Map — tło | dodaj, wklej, zaznacz wszystko, dopasuj widok | funkcje administracyjne przenieść do kebaba dokumentu |
| Mind Map — krawędź | etykieta/styl, odwróć kierunek, usuń | bez akcji całego dokumentu |
| Process Flow — krok | właściwości, etykieta, kopiuj, duplikuj, auto-layout, konwertuj, usuń | pojedyncza akcja AI ma jasny rezultat; nie mnożyć generatorów |
| Process Flow — tło/krawędź | dodaj element, wklej, właściwości połączenia, usuń | zachować semantykę procesu, nie kopiować nazw Whiteboardu |
| Whiteboard — element | edytuj, duplikuj, kopiuj, warstwa, blokada, komentarz, usuń | akcje AI zgrupować; Attach knowledge tylko przy realnym rezultacie |
| Whiteboard — tło/krawędź | wklej/dodaj, zaznacz, właściwości połączenia, usuń | bez działań dokumentowych |
| Table — komórka | kopiuj wartość, wklej, rozwiń, wyczyść | komplet uzasadniony |
| Table — wiersz | duplikuj, przenieś, konwertuj, usuń | ukryć pozycje nieobsługiwane przez typ danych |
| Table — kolumna | sortuj, filtruj, typ/format, ukryj, usuń | rozdzielić zmianę danych od ustawień widoku |
| Table — widok | duplikuj/zmień nazwę/usuń widok | nie mieszać z akcjami wiersza lub komórki |

## 5. Reguła akceptacji funkcji

Funkcja zostaje tylko wtedy, gdy spełnia wszystkie warunki:

1. ma rozpoznawalny cel użytkownika;
2. jest umieszczona w powierzchni odpowiadającej zakresowi: dokument, widok albo zaznaczenie;
3. nie dubluje innego wejścia o tym samym priorytecie;
4. wykonuje realny handler albo ma jawny `disabledReason`;
5. rezultat jest widoczny, możliwy do cofnięcia tam, gdzie to właściwe, oraz utrzymuje się po odświeżeniu;
6. mysz, klawiatura i PPM wywołują ten sam kontrakt akcji.

Po wspólnym przeglądzie tej macierzy powstaje finalny scenariusz testów manualnych. Pozycja bez zatwierdzonego celu nie przechodzi do testów jako funkcja zaakceptowana.
