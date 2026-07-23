# 11 — Specyfikacje narzędzi

Cztery reprezentacje działają analogicznie (Z1) — ta sama akcja ma tę samą nazwę, ikonę, miejsce i zachowanie wszędzie, poza różnicami jawnie wymienionymi tu jako specyficzne. Ten rozdział opisuje Mind Map, Whiteboard, Process Flow i Table: cel, Menu 3, lewy rail, prawy panel, menu kontekstowe, elementy specyficzne i zakazy konkretne — każdy oparty na audycie kodu, nie na domysłach.

Wspólny szkielet, obowiązujący we wszystkich czterech (patrz `_RDZEN_STANDARDU_4_ZASADY_2026-07-23.md`), nie jest powtarzany w każdej sekcji:
- **Prawy panel** — zawsze 5 zakładek w tej kolejności: **Przegląd · Właściwości · Powiązania · Komentarze · Historia** (D1, kanon wspólny z kartami N). Sekcje niżej opisują TYLKO treść pod każdą zakładką specyficzną dla narzędzia.
- **Rail — szkielet:** góra = przełącznik 4 narzędzi (Mapa/Tablica/Przepływ/Tabela, wspólne) → SHARED_TOP (Zaznaczanie/Pan, AI, Szablony, wspólne) → kontekst narzędzia (specyficzny, opisany niżej) → SHARED_BOTTOM (Import/Eksport, Więcej, wspólne) → Cofnij/Ponów (wspólne).
- **Menu 3 — szkielet:** lewy klaster = tworzenie → układ → AI → Szablony; prawy klaster = Eksport → Więcej. „Utwórz z mapy" zniesione wszędzie (rozdział 10 §6).

---

## Mind Map

**Cel:** struktura myślenia — hierarchia, gałęzie, poziomy, relacje. Wszystko w tym narzędziu wzmacnia drzewo, nie płaską listę.

### Menu 3 (docelowe)

| Klaster | Pozycja | Zmiana vs dziś |
|---|---|---|
| lewy | Dodaj węzeł | bez zmian, działa |
| lewy | Auto-układ | bez zmian, działa |
| lewy | AI rozwiń | bez zmian, działa |
| lewy | Szablony | bez zmian, działa (tool-aware) |
| prawy | Eksport | bez zmian, ale bez „Raport"/„Prezentacja" (rozdział 10 §3) |
| prawy | ~~Utwórz z mapy~~ | **USUNIĘTE** — zastąpione „Konwertuj ▾" w Menu 1 + pozycjami w menu kontekstowym |

„Zdrowie mapy" (dziś osobny widget w Menu 3) przenosi się do prawego panelu, zakładka **Przegląd** — nie jest akcją, więc nie należy do paska akcji.

### Lewy rail

Docelowa lista (kontekst specyficzny Mind Map, pozycje 8–13 poniżej; reszta to wspólny szkielet):

| Pozycja | Etykieta | Typ | Uwaga |
|---|---|---|---|
| Zaznaczanie/Przesuwanie | — | pstryczek (wspólny) | jedyne narzędzie, gdzie ten toggle realnie steruje canvasem (`IdeaRecommendationMap.tsx` konsumuje `interactionMode` intensywnie) |
| AI, Szablony | — | popover (wspólny) | działa |
| **Ramka** | Ramka | akcja natychmiastowa | grupowanie wizualne węzłów |
| **Dodaj węzeł** | Dodaj węzeł | popover | dziecko/sąsiad |
| **Wiedza** | Wiedza | popover | dołączanie materiału źródłowego |
| **Komentarze** | Komentarze | akcja natychmiastowa | wymaga zaznaczonego węzła typu `idea`; brak zaznaczenia → komunikat, nie cichy no-op |
| **Połącz** | Połącz | pstryczek trybu | rysowanie relacji przeciąganiem |
| **Prezentacja** | Prezentacja | akcja natychmiastowa | tryb prezentacji mapy — jedno wejście, nie duplikować z „Więcej narzędzi" |
| Import/Eksport, Więcej, Cofnij/Ponów | — | wspólny szkielet | działa |

### Prawy panel — treść w Mind Map

| Zakładka | Zawartość |
|---|---|
| **Przegląd** | Brief pomysłu (dzisiejsza sekcja „Problem"), etap (SPARK→…), „Zdrowie mapy" (liczba węzłów, relacje, braki), rekomendowany następny krok |
| **Właściwości** | Zaznaczenie = węzeł/gałąź/krawędź → inspektor: kształt, kolor, styl, poziom zwinięcia, przypisana osoba, głosy. Brak zaznaczenia → ustawienia widoku mapy (poziomy foldowania, motyw układu) |
| **Powiązania** | Artefakty dołączone do węzła/mapy, źródła wiedzy, backlinki z konwersji (`outputLinks`), załączniki |
| **Komentarze** | Wątek całej mapy LUB węzła (`NodeCommentThread`) — przełącza się zależnie od zaznaczenia |
| **Historia** | Log zmian mapy, zdarzenia AI, snapshoty, historia konwersji (`conversions[]`, rozdział 10 §2.3) |

### Menu kontekstowe

**Tło (`PaneContextMenu`):** Dodaj temat · Kopiuj/Wytnij/Wklej węzły · Zaznacz wszystko · Dopasuj widok · Automatyczny układ · Auto-grupowanie · Zwiń wszystko/Pokaż poziom 1/2/Rozwiń wszystko · AI: Zasugeruj węzły. Działa bez zmian.

**Węzeł (`NodeContextMenu`):** grupy Edycja · Struktura · AI · Konwersja · Wygląd i dane · Usuń. Zmiany wymagane vs dziś:

| Dziś | Defekt | Docelowo |
|---|---|---|
| „→ Inicjatywa"/„→ Decyzja"/„→ Zadania" (bez sufiksu „gałąź") | Zawsze konwertuje CAŁĄ gałąź (`convertBranch`+`collectDescendants`), mimo że etykieta sugeruje pojedynczy węzeł | „Konwertuj węzeł" — realnie tylko ten węzeł, BEZ potomków (rozdział 10 §7) |
| „Drill down" i „Skup poddrzewo" | Identyczny handler (`handleDrillDown`) — duplikat | Usunąć jedną z dwóch pozycji |
| „Rozbuduj temat" i „Pogłęb" | Identyczny handler (`handleAIExpand`) — duplikat | Usunąć jedną z dwóch pozycji |
| „Notatki" i „Tagi" | Obie otwierają ten sam `NodeDetailDrawer` — duplikat funkcjonalny | Usunąć duplikat albo rozdzielić na faktycznie różne zakładki drawera |
| „→ Zadania (gałąź)" i „→ Zestaw zadań (gałąź)" | Identyczny handler — duplikat | Usunąć jedną z dwóch pozycji |
| „AI: Zasuguruj powiązania" w menu węzła | Martwe — `handleContextAction` nie ma gałęzi dla `ai_suggest_links`, mimo że TA SAMA akcja działa poprawnie z paska zaznaczenia | Jeden handler dla obu wejść (Z1 — ta sama akcja, jedna implementacja) |

**Krawędź (`EdgeContextMenu`):** Dodaj/edytuj etykietę · Wstaw węzeł na połączeniu · Odwróć kierunek · Zmień styl linii · Edytuj relację · Usuń połączenie. Bez zmian — brak martwych pozycji.

### Elementy specyficzne (Z1 — jawnie dozwolone różnice)

Poziomy (collapse/expand: Alt+0/1/2/9), gałąź jako jednostka konwersji, auto-układ drzewa, drill-down, tryb Połącz (rysowanie relacji), tryb Prezentacji mapy.

### Zakazy

- `AI suggest links` nie może być martwe w menu węzła, skoro działa z paska zaznaczenia — jeden handler, wszędzie działający (patrz tabela wyżej).
- `Convert element`/„Konwertuj węzeł" nie może konwertować gałęzi, jeśli etykieta mówi „węzeł" — musi istnieć osobny handler bez `collectDescendants`.
- Zakaz duplikatów funkcjonalnych w jednym menu (Drill down/Skup poddrzewo, Rozbuduj/Pogłęb, Notatki/Tagi, Zadania/Zestaw zadań) — każda pozycja menu ma jednoznaczny, niepowtórzony efekt.

---

## Whiteboard

**Cel:** praca warsztatowa — swobodna tablica, grupowanie, głosowanie, prowadzenie sesji z klientem (facylitacja). Backend `facilitationPhaseMachine.ts` i `facilitationRealtime.ts` są realne, zsynchronizowane między uczestnikami — to nie jest kosmetyka frontendu.

### Menu 3 (docelowe)

| Klaster | Pozycja | Zmiana vs dziś |
|---|---|---|
| lewy | **Warsztat** (nowy przycisk) | Zastępuje pływający panel „Warstwa sesji" — patrz niżej |
| lewy | Dodaj (karteczka/tekst/kształt) | bez zmian |
| lewy | AI rozwiń | dziś martwe (dispatchuje handler mapowy) → musi wołać `wb_*` |
| lewy | Szablony | bez zmian, działa (tool-aware) |
| lewy | Zapisz widok | bez zmian, działa (`IdeaScenesManager`, sceny + tryb Prezentuj) |
| prawy | Eksport | bez zmian, bez Raport/Prezentacja (rozdział 10) |
| prawy | ~~Utwórz z mapy~~ | **USUNIĘTE** |

### ★ Panel warsztatu (Workshop) — przeniesienie z pływającego panelu do Menu 3

**Dziś:** „Warstwa sesji" to pływający panel w lewym górnym rogu płótna (`WhiteboardSessionPanel.tsx` + `WhiteboardPhaseBar.tsx`), zawsze widoczny, zasłaniający canvas kartą z rolą/timerem/fazami.

**Docelowo:** panel przenosi się pod przycisk **„Warsztat"** w Menu 3 (dropdown/panel otwierany na żądanie). Na płótnie zostają WYŁĄCZNIE małe wskaźniki aktywnego stanu — nie cała karta:
- „Głosowanie otwarte" (gdy `votingOpen`),
- „Timer 04:32" (odliczanie, gdy aktywny),
- rola bieżącego użytkownika jako mały chip, nie karta.

Zawartość panelu Warsztat (bez zmiany funkcji, tylko miejsca):

| Element | Co robi |
|---|---|
| Rola | Facylitator / Uczestnik / Obserwator — cykl `onCycleRole`, Obserwator blokuje edycję |
| Faza | Start → Organizacja → Konwergencja → Przekazanie (`WhiteboardPhaseBar`), przejścia ograniczone `FACILITATION_TRANSITIONS`, każda faza ma podpowiedź |
| Timer | Odliczanie zsynchronizowane (`Api.facilitationUpdateTimer`), wpis do dziennika po zakończeniu |
| Głosowanie | `IdeaVotingMode`, dot-voting, max 5 głosów/osobę, trwałe wyniki |
| Follow-me | Viewport facylitatora wymuszony u uczestników |
| Uczestnicy | Lista + awatary |
| Ops + governance | Klasyfikacja poufności (`internal→confidential→restricted`), biblioteka fragmentów, przywracanie snapshotu |

### Lewy rail

Kontekst specyficzny (Karteczka, Tekst, Kształt, Rysuj, Ramka) + wspólny szkielet:

| Pozycja | Uwaga |
|---|---|
| Karteczka, Tekst, Kształt, Rysuj, Ramka | działają, specyficzne dla Whiteboard |
| Zaznaczanie/Przesuwanie | **dziś martwe wizualnie na Tablicy** — `IdeaWhiteboardTool` nie odbiera propsa `interactionMode` → docelowo: albo podłączyć realnie, albo nie pokazywać tego pstryczka w kontekście Whiteboard (Z3 — zakaz martwych kontrolek) |
| AI (popover) | **dziś treść mapowa (mindmapowe generatory), martwa na Tablicy** → docelowo: generatory whiteboardowe (`wb_find_themes`, `wb_name_clusters`, `wb_extract_actions` itd.) |
| Import/Eksport, Więcej narzędzi | **dziś całkowicie martwe na Tablicy** (dispatch trafia w handler zarezerwowany dla Mind Map) → docelowo: `wb_*` handlery za tymi samymi ikonami |

### Prawy panel — treść w Whiteboard

| Zakładka | Zawartość |
|---|---|
| **Przegląd** | Status boardu, status warsztatu (faza aktywna, rola, liczba uczestników), zdrowie/kompletność tablicy |
| **Właściwości** | Zaznaczenie = sticky/shape/frame/connector → styl (kolor, rozmiar czcionki, pogrubienie — dziś `WhiteboardStyleBar` pływający, docelowo dostępny też tu). Brak zaznaczenia → ustawienia widoku/scen |
| **Powiązania** | Artefakty, źródła, załączniki — identycznie jak Mind Map |
| **Komentarze** | Board lub element (`WhiteboardNodeCommentThread`) |
| **Historia** | Zmiany + fazy warsztatu (przejścia, głosowania, zdarzenia timera) — facylitacja MUSI być widoczna tu, nie tylko w dzienniku aktywności panelu Warsztat |

### Menu kontekstowe

**Tło:** AI: Wypełnij luki · AI: Brainstorm tutaj · AI: Przekształć w mapę myśli · AI: Przekształć w tabelę. Wszystkie przez Propose→Accept (`generateAIProposal`), zero cichego zastosowania. Działa.

**Element (karteczka/ramka/kształt/link — jeden zestaw dla wszystkich typów, zgodnie z Z1):** Edytuj · Duplikuj · Kopiuj · Warstwa na wierzch/pod spód · Zablokuj/Odblokuj · Usuń · (sekcja AI) AI: Rozbuduj · Kwestionuj · Znajdź dowody · Sugeruj połączenia · Dołącz wiedzę · Komentarze · AI: Znajdź tematy · Nazwij klastry · Wyodrębnij akcje.

| Dziś | Defekt | Docelowo |
|---|---|---|
| Nagłówek menu pokazuje „Node" | Angielski string mimo polskiego UI | Przetłumaczyć na typ elementu po polsku |
| „Kopiuj" | Kopiuje TYLKO tekst etykiety do schowka systemowego, nie cały węzeł | Prawdziwe kopiuj-wklej elementu (parytet z Miro, K1) |
| Skróty (F2/⌘D/⌘C/Del) zadeklarowane w `useIdeasToolContextMenu.ts` | Nie wyświetlają się w realnym menu | Pokazać realne skróty przy pozycjach albo usunąć martwą deklarację |
| Krawędź/łącznik (connector) | **Brak menu kontekstowego w ogóle** — `onEdgeContextMenu` nie istnieje | Dodać menu krawędzi (etykieta, styl, kolor, usuń — parytet z Mind Map `EdgeContextMenu`) |

**Pasek zaznaczenia (`WhiteboardSelectionBar`):** Dołącz · Powiązane · Promuj do decyzji · Promuj do akcji · Wyrównaj (dropdown, ≥2) · Rozłóż (dropdown, ≥3) · Grupuj (≥2) · Rozgrupuj · Duplikuj · Zablokuj · Usuń. Działa, stany disabled poprawnie zweryfikowane.

### Elementy specyficzne

Tryb warsztatowy (rola/fazy/timer/głosowanie/follow-me), rysowanie odręczne, sceny + „Zapisz widok" + tryb Prezentuj, grupowanie/rozgrupowanie/wyrównanie/rozłożenie, pasek stylu (kolor/czcionka/pogrubienie).

### Zakazy

- „Dodaj karteczkę" nie może wysyłać `add_node` (event Mind Map) — musi wołać `wb_add_sticky`.
- „AI rozwiń" nie może wysyłać `mm_ai_expand` — musi wołać generator whiteboardowy właściwy kontekstowi kliknięcia.
- Connector musi mieć menu krawędzi — dziś nie ma żadnego.
- Zaznaczanie/Przesuwanie na railu nie może być martwym pstryczkiem — albo działa, albo znika z kontekstu Whiteboard.
- Import/Eksport i Więcej narzędzi na railu nie mogą być całkowicie martwe — to root-cause #1 (akcje innego narzędzia podpięte pod wspólną ikonę).

---

## Process Flow

**Cel:** modelowanie procesu — semantyka BPMN, decyzje, odpowiedzialność (lane'y), walidacja, automatyzacja. Nie wolno traktować procesu jak zwykłej mapy z prostokątami.

### Menu 3 (docelowe)

| Klaster | Pozycja | Zmiana vs dziś |
|---|---|---|
| lewy | Dodaj kształt | **dziś martwe** — dispatchuje `add_node`, którego `useProcessFlowQuickActions` nie obsługuje → docelowo: `pf_add_action`/`pf_add_step` |
| lewy | Auto-układ | **dziś martwe** — dispatchuje event Mind Map (`idea-mindmap-node-quick-action`), Process Flow nasłuchuje `idea-workspace-quick-action` → docelowo: właściwe zdarzenie, handler już istnieje (dostępny dziś tylko z wewnętrznego „Więcej") |
| lewy | AI rozwiń | **dziś martwe** — `mm_ai_expand` obsługiwane tylko przez Mind Map → docelowo: generator procesowy |
| lewy | Szablony | działa — galeria z filtrami, szablony procesowe (Order-to-Cash, PDCA, VSM, BPMN Approval, itd.) |
| prawy | Eksport | działa — wspólny `IdeaExportMenu`, bez Raport/Prezentacja (rozdział 10) |
| prawy | ~~Utwórz z mapy~~ | **USUNIĘTE** |

**Zakładki trybów** (segmentowany przełącznik, pod Menu 3): **Klasyczny przepływ · Automatyzacja · Strumień wartości (VSM)**. Każdy tryb zmienia paletę kształtów (klasyczny: Start/Koniec/Akcja/Decyzja; automatyzacja: +Trigger/API/Warunek; VSM: Proces/Zapas/Dostawca/Klient/Kaizen/push-pull/supermarket/FIFO) i reguły walidacji. Trzy dodatkowe „kity" notacyjne (BPMN/System/Organizacja-RACI) ustawiane wyłącznie z czatu — nie mają własnej zakładki klikalnej.

**Przyciski wstawiania:** paleta kształtów zależna od trybu · **+ Lane** · **+ Wstaw** (wymaga zaznaczonej krawędzi) · **Rozdziel** (wymaga zaznaczonego węzła Decyzja). Wszystkie objęte undo i replikacją realtime.

### Lewy rail

Kontekst specyficzny (Start/End, Task, Decyzja, Lane) + wspólny szkielet:

| Pozycja | Uwaga |
|---|---|
| Start/End | Etykieta sugeruje oba typy, ale przycisk **dziś dodaje wyłącznie `start`** — `pf_add_end` istnieje w handlerze, ale nic w rail go nie wywołuje → docelowo: przycisk musi dodawać oba typy (np. dwa osobne przyciski albo dropdown) albo etykieta musi mówić tylko „Start" |
| Task, Decyzja, Lane | działają |
| Zaznaczanie/Przesuwanie | **dziś kosmetyczne** — `IdeaProcessFlowTool.tsx` nie odczytuje `interactionMode`, ReactFlow ma własny pan/select → docelowo: podłączyć realnie albo usunąć z kontekstu Process Flow |
| AI (popover) | **dziś martwe** w Przepływie (generatory mapowe) → docelowo: generatory procesowe |
| Import/Eksport, Więcej narzędzi | **dziś całkowicie martwe** w Przepływie → docelowo: `pf_*` handlery |

### Prawy panel — treść w Process Flow

| Zakładka | Zawartość |
|---|---|
| **Przegląd** | KPI diagramu, liczba kroków/lane'ów, status walidacji, aktywny tryb (Klasyczny/Automatyzacja/VSM) |
| **Właściwości** | Zaznaczenie = krok/decyzja/krawędź/lane → pola specyficzne (etykieta, właściciel/rola, czas trwania dla VSM, warunek dla Decision, kolor/nazwa lane). Brak zaznaczenia → ustawienia diagramu (typ przepływu, semantic kit) |
| **Powiązania** | Artefakty źródłowe procesu, backlinki konwersji |
| **Komentarze** | Diagram lub krok (`ProcessFlowNodeCommentThread`) |
| **Historia** | Zmiany + wyniki walidacji w czasie + historia konwersji |

### Menu kontekstowe

**Krok (węzeł), kolejność K6 „Open → Context → AI → Convert → Danger":** Otwórz właściwości · Edytuj etykietę · Duplikuj · Auto-układ · AI: rewrite step · Konwertuj na inicjatywę · Usuń.

| Dziś | Defekt | Docelowo |
|---|---|---|
| „AI: rewrite step" | Etykieta po angielsku mimo polskiego UI | Przetłumaczyć |
| „Zmień nazwę" (pasek zaznaczenia, F2) otwiera panel właściwości; „Edytuj etykietę" (menu prawego kliku) robi edycję inline | Dwa różne zachowania dla tej samej intencji | Ujednolicić na JEDNO zachowanie (Z1) |

**Krawędź:** **brak menu kontekstowego** (`onEdgeContextMenu` nie istnieje) — zamiast tego lewoklikowy `EdgeStylePopover` (etykieta, kolor, styl, strzałka). **Brak pozycji „Usuń krawędź"** w popoverze — usunięcie tylko przez Delete/Backspace po zaznaczeniu, gdzie `deleteSelected()` ma udokumentowany bug dla samej krawędzi bez zaznaczonego węzła. Docelowo: dodać prawy klik z „Usuń krawędź" jawną pozycją.

**Lane (tor):** brak dedykowanego menu kontekstowego — świadomie odmienne (Z1, tabela specyficzna): operacje żyją jako stałe przyciski nagłówka toru (zwiń/rozwiń, przesuń góra/dół, zmień kolor, usuń, resize). Prawy klik na pustym obszarze toru = menu tła.

**Pasek zaznaczenia (`ProcessFlowFloatingToolbar`, tylko 1 węzeł):** Zmień nazwę · Duplikuj · Wstaw między · Powiązania · Komentarze · Zapytaj AI · Usuń.

| Dziś | Defekt | Docelowo |
|---|---|---|
| „Wstaw między" widoczny przy zaznaczonym WĘŹLE | Wymaga zaznaczonej KRAWĘDZI — w typowym użyciu pokazuje błąd i nic nie robi | Nie pokazywać przycisku w kontekście, gdzie nie może zadziałać, albo dać `disabledReason` jawnie tłumaczący warunek |

### Elementy specyficzne

Semantyka BPMN (Start/End/Activity/Decision/Lane/Connector/Split-Join), 3 tryby (Classic/Automation/VSM), 3 semantic kity (BPMN/System/Organizacja, tylko z czatu), walidacja ze stanem początkowym **„Niezwalidowane"** (po walidacji: „Brak ostrzeżeń" albo „Ostrzeżenia N" — nigdy zielony sukces PRZED walidacją).

### Zakazy

- „Auto-układ" nie może wysyłać eventu Mind Map (`idea-mindmap-node-quick-action`) — musi wołać handler Process Flow.
- „Insert between"/„Wstaw między" nie może być przyciskiem przy zaznaczonym węźle, jeśli realnie wymaga zaznaczonej krawędzi — kontekst przycisku musi pasować do jego warunku działania.
- „Wklej" nie może duplikować zaznaczenia (musi wklejać z bufora kopiowania, nie klonować to, co już jest zaznaczone).
- Diagram nie pokazuje zielonego stanu walidacji przed pierwszym uruchomieniem walidacji — start zawsze „Niezwalidowane".
- Krawędź musi mieć jawną pozycję „Usuń krawędź" — nie tylko klawisz Delete z buggym handlerem.

---

## Table

**Cel:** praca na danych — rekordy, pola, widoki, scoring, analiza. Table NIE jest canvasem i nie dostaje canvasowych metafor.

**Docelowy kierunek (D5):** implementacja **P15/platformowa**. Legacy wygaszany — standard opisuje docelowe zachowanie P15; różnice legacy odnotowane tylko tam, gdzie dziś P15 ma lukę, którą trzeba domknąć przed wygaszeniem legacy.

### Menu 3 (docelowe)

| Klaster | Pozycja | Uwaga |
|---|---|---|
| Zakładki widoków | Domyślny · Triażowanie · Scoring · Log decyzji · Timeline · **+** (zapisz nowy widok) | działa, presety sort/filtr/grupowanie/layout |
| Views (przełącznik layoutu) | Grid · Kanban · Timeline · Calendar · Matrix · Gallery | kolejność „FROZEN — nie zmieniać" |
| Add row | + Wiersz, + z szablonu | działa |
| Fields | Kolumny (show/hide/nowa), Field Manager (typy pól) | działa |
| Organize | Filtr (szybki + zaawansowany), Grupuj, zapisany widok | działa |
| AI | Asystent AI schematu, AI Fill (tylko gdy są puste komórki), AI Kategoryzacja, Model scoringowy, AI Copilot | działa; AI Fill nie nadpisuje bez podglądu (patrz Zakazy) |
| Templates | Szablony wierszy/tabel | działa |
| Import | Importuj CSV, Connector Wizard (zewnętrzne źródła danych) | CSV: patrz rozdział 10 §4.2 |
| Export | Eksportuj CSV, Kopiuj do schowka | plik, zgodnie z rozdziałem 10 |
| **More/Tools** | Zwija **~16 drugorzędnych narzędzi** dziś stojących płasko w legacy (AI Copilot, Heatmapa, Pipeline, Relacje między tabelami, Formatowanie warunkowe, Paleta kolorów, Historia zmian, Aktywność, Skróty klawiszowe, Dystrybucja, Generator frameworków, Webhook Relay, itd.) | **wymagane** — zakaz płaskiego rzędu ikon (patrz Zakazy) |

**Moduły platformowe (tylko P15):** zakładki **Data · Forms · Interfaces · Models · Workflow** — jedna „baza" tabelaryczna z kilkoma trybami pracy nad nią (wzorzec Airtable): Dane (siatka), Formularze (zbieranie danych z zewnątrz), Interfejsy (mini-dashboardy), Modele (governed KPI/wymiary), Workflow (automatyzacje/sync/webhooks/sharing/dystrybucja w jednym miejscu).

### Lewy rail

Table NIE dziedziczy canvasowego raila (Hand/Connect/minimapa nie mają zastosowania do danych). Kontekst specyficzny: **Nowy wiersz · Kolumny · Widok · Filtruj · Dashboard**.

| Pozycja | Uwaga |
|---|---|
| „Widok" | **dziś twardo ustawia `viewLayout='grid'`** zamiast przełączać między widokami → docelowo: albo realny przełącznik (duplikuje pigułkę Menu 3 — zbędne), albo usunąć z raila i zostawić przełączanie WYŁĄCZNIE w Menu 3 |
| Zaznaczanie/Przesuwanie, AI, Szablony (wspólne pozycje odziedziczone z raila canvasowego) | `⟦DO USTALENIA⟧` — czy w ogóle mają sens w Tabeli; kierunek: Table nie powinna pokazywać pstryczka Pan/Select ani ikon canvasowych bez realnego zastosowania (patrz Zakazy) |

### Prawy panel — treść w Table

| Zakładka | Zawartość |
|---|---|
| **Przegląd** | Tabela jako reprezentacja Idei — liczba wierszy/kolumn, aktywny zapisany widok, kompletność danych |
| **Właściwości** | Zaznaczenie = wiersz → pola rekordu (wzorzec `ArtifactPropertiesTable`, już odebrany komponent). Zaznaczenie = kolumna → definicja pola (typ, walidacja). Brak zaznaczenia → ustawienia bieżącego widoku (sort/filtr/grupowanie) |
| **Powiązania** | Linked records (relacje międzytabelowe), artefakty, źródła |
| **Komentarze** | Tabela / wiersz / komórka |
| **Historia** | Edycje, zmiany AI, importy (log append/update/replace) |

### Menu kontekstowe

**Wiersz (docelowo — kierunek P15, 8 pozycji, szerszy niż legacy):** Edytuj · Dodaj notatkę · Wstaw wiersz nad · Wstaw wiersz pod · Duplikuj wiersz · Kopiuj wiersz · Rozwiń rekord · Usuń wiersz.

| Dziś | Stan | Docelowo |
|---|---|---|
| Legacy: 4 pozycje (Edytuj, Dodaj notatkę, Duplikuj, Usuń) | żywe dla obiektu testowego | wygaszane wraz z legacy (D5) |
| P15: 8 pozycji (jw. + Wstaw nad/pod, Kopiuj wiersz, Rozwiń rekord) | kod istnieje, nie zweryfikowany wzrokiem | **to jest docelowy standard** |

**Komórka:** **dziś brak menu kontekstowego w OBU trybach** — luka realna, nie kwestia wyboru legacy/P15. Docelowo minimalny zestaw: Kopiuj · Wklej · Wyczyść zawartość · Rozwiń (podłączyć istniejący `CellExpandPopover`). `⟦DO USTALENIA⟧` — dalsze pozycje (np. wklej specjalnie, ustaw wartość dla zakresu) nie są opisane w żadnym źródle.

**Nagłówek kolumny:**

| Dziś | Stan | Docelowo |
|---|---|---|
| Legacy: prawy klik działa, 4 pozycje (Rename, Sort, Hide, Delete) | żywe | Zachować jako bazę |
| P15: **brak prawego kliku na nagłówku w ogóle** — wszystko przez toolbar + `FieldManager` | kod potwierdzony | **Dodać** prawy klik z tymi samymi 4 pozycjami + **Zmień typ pola** + **Zamroź kolumnę** (obie dziś nieobecne w ŻADNYM trybie — kierunek Airtable-parity, `⟦DO USTALENIA⟧` szczegóły semantyki zamrażania wielu kolumn) |

**Pasek po zaznaczeniu wierszy:** licznik „N selected" · Convert ▾ (Initiative/Task/Decision) · Usuń. Identyczny w legacy i P15 (rzadki przypadek zgodności) — utrzymać jeden kod współdzielony zamiast dwóch kopii przy migracji na P15.

### Elementy specyficzne

Widoki (Grid/Kanban/Timeline/Calendar/Matrix/Gallery), pola i typy, saved views, filtr/sort/grupowanie, AI Fill/Kategoryzacja/Model scoringowy, moduły platformowe (Forms/Interfaces/Models/Workflow — tylko P15), heatmapa, formatowanie warunkowe, relacje międzytabelowe, dystrybucja (email/Slack/Teams/webhook wg harmonogramu).

### Zakazy

- Table nie dziedziczy canvasowego raila ani metafor płótna (Hand/Connect/minimapa) — dane to nie płótno.
- Nie może istnieć jednocześnie dwa różne UX-y (legacy/P15) na docelowym ekranie — jeden, zgodnie z D5.
- AI Fill nie nadpisuje komórek bez podglądu (proposal-first, zgodnie z modelem AI wspólnym dla całego produktu).
- Płaski rząd ~16 ikon drugorzędnych narzędzi (dziś tak w legacy) musi być zwinięty pod „More"/„Tools" — zakaz ściany ikon.
- Brak menu na komórce nie może zostać jako trwały stan — minimalny zestaw wymagany (patrz wyżej).
- Rozjazd legacy/P15 (osobno utrzymywany kod dla tych samych akcji, np. menu wiersza, undo) nie może się pogłębiać — każda nowa funkcja idzie WYŁĄCZNIE do P15.

---

## Kryteria odbioru

- [ ] Każde z 4 narzędzi ma prawy panel z dokładnie 5 zakładkami w kolejności: Przegląd · Właściwości · Powiązania · Komentarze · Historia.
- [ ] Żadna pozycja Menu 3/rail/menu kontekstowe nie dispatchuje zdarzenia innego narzędzia (root-cause #1: zero `mm_*` poza Mind Mapą, zero zdarzeń trafiających w próżnię).
- [ ] Mind Map: „Konwertuj węzeł" i „Konwertuj gałąź" to dwie odrębne, poprawnie działające akcje; zero duplikatów funkcjonalnych w menu węzła.
- [ ] Whiteboard: panel Warsztat dostępny z przycisku Menu 3, na płótnie tylko małe wskaźniki stanu (Głosowanie/Timer), nie cała karta sesji.
- [ ] Whiteboard: rail (Zaznaczanie, AI, Import/Eksport, Więcej) realnie działa w kontekście Tablicy, nie tylko w Mind Mapie.
- [ ] Whiteboard: menu krawędzi/connectora istnieje.
- [ ] Process Flow: Menu 3 (Dodaj kształt, Auto-układ, AI rozwiń) realnie tworzy/układa/rozwija diagram Process Flow, nie milczy.
- [ ] Process Flow: walidacja startuje zawsze od stanu „Niezwalidowane", nigdy nie pokazuje sukcesu przed uruchomieniem.
- [ ] Process Flow: krawędź ma jawną pozycję „Usuń krawędź" w menu, nie tylko klawisz Delete.
- [ ] Table: jeden UX (P15), zero canvasowego raila/metafor płótna.
- [ ] Table: menu komórki istnieje (Kopiuj/Wklej/Wyczyść/Rozwiń) w obu miejscach, gdzie dziś go nie ma.
- [ ] Table: nagłówek kolumny ma prawy klik w P15 (nie tylko toolbar/FieldManager).
- [ ] Table: ~16 drugorzędnych ikon zwinięte pod „More"/„Tools", zero ściany ikon.
- [ ] Weryfikacja wzrokiem (zrzuty), oba motywy (jasny/ciemny), każde z 4 narzędzi osobno — zgodnie z regułą #7 (właściciel nie jest pierwszym testerem wizualnym).
