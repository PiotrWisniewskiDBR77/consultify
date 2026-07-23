# 07 — Duplikaty i konflikty (Idea Workspace)

**Data:** 2026-07-23 · **Metoda:** analiza kodu (grep-first), synteza 12 dokumentów powierzchni +
`06_UI_HANDLER_DATA_CHAINS.md` (ten sam katalog) + grep uzupełniający tej sesji (mechanizm zapisu,
`onAddPrimary`/`onAIExpand` w `IdeaMapWorkspace.tsx`). Tryb kodowy, aplikacja nieuruchamiana.

## 0. Jak czytać ten dokument

Dla każdego duplikatu: **gdzie występuje** (2+ miejsca), **jaki zakres/efekt w każdym**, **czy to
to samo czy różne rzeczy**, **ryzyko dezorientacji** (Niskie/Średnie/Wysokie — subiektywna ocena
na bazie: czy różnica jest niewidoczna z samego UI, czy dotyczy częstej akcji, czy prowadzi do
cichej utraty danych/pracy).

---

## 1. AI expand / Generatory AI

| Gdzie | Zakres | Efekt |
|---|---|---|
| Rail → popover **AI** (Sparkles), 4 narzędzia | Mind Map: pełny zestaw 6 generatorów + 4 akcje węzła, realnie działa dla „Rozwiń mapę"/„Rozwiń ten węzeł" | Whiteboard/Process Flow/Table: **identyczna treść wizualna**, ale wszystkie 6 generatorów martwe (brak odbiorcy `mm_ai_*` poza Mind Mapą) |
| Menu 3 (second bar) → **„AI rozwiń"**, 4 narzędzia | Ten sam literał `mm_ai_expand` niezależnie od `activeTool` | Mind Map: działa (`Api.expandMyIdeaMap`). Whiteboard/Process Flow/Table: **martwe**, potwierdzone klikiem live dla WB i PF |
| Menu węzła (prawy klik) Mind Map → **„Rozbuduj temat"/„Pogłęb"** | Ten sam handler `handleAIExpand(nodeId)` pod dwiema różnymi etykietami | Oba działają identycznie — duplikat funkcjonalny, nie błąd, ale dwie pozycje menu robią to samo |
| Whiteboard: menu węzła → **„AI: Rozbuduj"** (`mindmap_expand`) vs natywne `wb_ai_find_themes`/`wb_ai_name_clusters`/`wb_ai_extract_actions` (dostępne z prawego panelu/skrótów, nie z Menu 3) | Whiteboard MA własny, kompletny zestaw generatorów AI — ale Menu 3 „AI rozwiń" do nich nie sięga | Użytkownik klikający oczywisty przycisk na górze ekranu (Menu 3) dostaje ciszę, podczas gdy prawdziwa funkcja czeka w innym miejscu (menu kontekstowe) |

**Czy to samo czy różne:** Koncepcyjnie ta sama intencja („niech AI rozwinie to, co widzę") ma **4
różne implementacje** rozrzucone po całym ekranie (rail popover, Menu 3, menu węzła, natywny pasek
tabeli/whiteboard), z czego tylko część działa w każdym narzędziu poza Mind Mapą.

**Ryzyko dezorientacji: WYSOKIE.** To najgęściej duplikowana i najbardziej wprowadzająca w błąd
rodzina akcji w całym module — użytkownik na Whiteboardzie/Process Flow/Tabeli widzi DWA
wizualnie identyczne wejścia „AI" (rail + Menu 3), oba wyglądające tak samo jak działający
odpowiednik w Mind Mapie, a oba martwe; prawdziwa funkcja AI istnieje, ale w trzecim, mniej
oczywistym miejscu (menu kontekstowe / natywny pasek narzędzia).

---

## 2. Templates (Szablony)

| Gdzie | Zakres | Efekt |
|---|---|---|
| Rail → popover **Szablony** | `TEMPLATES_BY_TOOL` — **jedyny popover wspólny, który realnie filtruje wg `activeTool`** | Działa poprawnie w 4 narzędziach — jedyny „uczciwy" wspólny popover |
| Menu 3 → **„Szablony"** | Ten sam `setTemplateGalleryOpen(true)` → `<IdeaTemplateGallery>` | Duplikat WEJŚCIA (dwa przyciski, jedna galeria) — nie konflikt, zamierzona redundancja dostępu |
| Popover Szablony → sekcja **„Punkty startowe"** (`IDEA_STARTING_POINTS`) | 6 pozycji, KAŻDA ma `preferredSystem` (mindmap/table/whiteboard/process_flow), ale sekcja **NIE jest filtrowana** wg aktywnego narzędzia — pokazuje się identycznie wszędzie | Klik może zasiać treść w narzędziu INNYM niż to, na którym user aktualnie pracuje (skutek end-to-end nie zweryfikowany wzrokiem w żadnym z 12 dokumentów) |
| Czat → komenda **`mm_apply_framework`** (np. „zastosuj SWOT") | Woła przestarzałe id `mm-swot`/`mm-porter5` | Te id zostały zastąpione przez `cx-swot`/`cx-porter5` (szablony **Tablicy**, nie Mind Mapy) — kończy się honest-fallbackiem (pojedynczy węzeł-placeholder + ostrzeżenie), NIE realnym szablonem |

**Czy to samo czy różne:** rail-popover „Szablony" i Menu-3 „Szablony" to **to samo** (świadomy
skrót). Ale „Punkty startowe" wewnątrz tego samego popovera to coś **innego** — nie filtrują się
mimo posiadania metadanych do tego (`preferredSystem`), i mogą przełączyć user na inne narzędzie
niż zamierzone.

**Ryzyko dezorientacji: Średnie.** Dwa wejścia do galerii są nieszkodliwe. Niefiltrowane „Punkty
startowe" + rozjazd id szablonów SWOT/Porter między czatem a popoverem to realne ryzyko
niespójnego rezultatu, ale dotyczy rzadszej ścieżki (start nowego pomysłu / komenda czatu), nie
codziennej pracy.

---

## 3. Convert (Konwertuj)

| Gdzie | Scope | Efekt |
|---|---|---|
| **Menu 1, primary CTA „Konwertuj ▾"** (`IdeaConvertMenu`) | Cały pomysł, bez wymogu zaznaczenia węzłów | Bezpośrednia, jednoklikowa ścieżka do `Api.convertMyIdea` |
| **Menu 3 → „Utwórz z mapy"** | Otwiera prawy panel, sekcja „Convert" (domyślnie ZWINIĘTA) | Dwuklikowa ścieżka do TEGO SAMEGO zestawu celów (`ideaConvertTargets.ts`) — etykieta obiecuje akcję, wykonuje tylko nawigację |
| **Prawy panel → sekcja „Convert" (akordeon)** | Docelowe miejsce z realnymi przyciskami (Initiative/Task/Decision/Report/Deck) | Ten sam `onConvert(target)` co Menu 1 |
| **Menu węzła Mind Map → „Konwersja"/„Konwertuj gałąź na…"** | Scope = WĘZEŁ/GAŁĄŹ (z `nodeIds` konkretnej gałęzi), nie cała mapa | `convertBranch(target, nodeId)` → ten sam backend `Api.convertMyIdea`, ale z innym `nodeIds` |
| **Menu węzła Process Flow → „Konwertuj na inicjatywę"** | Scope = pojedynczy krok | `handleConvert('pf_convert_initiative')` → ten sam generyczny konwerter |
| **Pasek zaznaczenia Whiteboard → „Promuj do decyzji"/„Promuj do akcji"** | Scope = zaznaczone elementy | `wb_convert_decision`/`wb_convert_action` |
| **Pasek zaznaczenia Table → „Convert" dropdown** | Scope = zaznaczone WIERSZE (bulk) | `handleBulkConvert(target)` |
| **Dropdown „Więcej" Process Flow → sekcja „Convert"** | Kod istnieje (`onConvert` prop), ale **nie pojawia się live w trybie MELS** — prawdopodobnie `onConvert` nie jest już przekazywane, funkcję przejął przycisk Menu 1 | Martwy/nieaktywny fragment kodu w bieżącej konfiguracji domyślnej |

**Czy to samo czy różne:** To NIE jest prosty duplikat — to **jedna funkcja backendowa
(`Api.convertMyIdea`) z co najmniej 7 różnych punktów wejścia UI**, z których każdy różni się
**zakresem** (cała mapa / gałąź / krok / zaznaczenie / wiersze). To jest zamierzona architektura
(ten sam cel, różny scope zależnie od kontekstu), ale przy 7 wejściach ryzyko, że user nie wie
„co dokładnie zostanie skonwertowane" (cała mapa czy tylko to, co ma zaznaczone) jest realne —
zwłaszcza że Menu 1 „Konwertuj ▾" i menu węzła „Konwertuj gałąź" wyglądają jak ten sam koncept, a
mają inny scope.

**Ryzyko dezorientacji: Średnie-Wysokie.** Największe ryzyko: martwa sekcja „Convert" w Process
Flow „Więcej" (kod obecny, nieosiągalny) — ktoś naprawiający UI może „naprawić" coś, co i tak nie
jest wołane w bieżącej konfiguracji.

---

## 4. Export (Eksport)

| Gdzie | Scope | Efekt |
|---|---|---|
| **Menu 1 kebab „⋯" → „Eksport"** | Cały pomysł | `setExportMenuOpen(true)` → `<IdeaExportMenu>` |
| **Menu 3 → „Eksport"** | Ten sam handler | Kod (`ideaCanvasMelsChips.ts`, komentarz w linii 62) wprost nazywa to „real; also present on Menu 3" — **zamierzone** dublowanie skrótu, udokumentowane w samym kodzie |
| **Rail → popover „Import/Eksport"** (4 narzędzia) | Mind Map: 9 formatów realnych | Whiteboard/Process Flow/Table: **cały popover martwy** (akcje `mm_export_*` bez odbiorcy) |
| **Process Flow: „…" More → brak osobnej pozycji eksportu w tym audycie**, ALE własny `ExportDialog.tsx`/`useProcessFlowExport.ts` (PNG/JSON, „starsza/równoległa ścieżka") | Osobny, mniejszy mechanizm eksportu niż wspólny `IdeaExportMenu` z Menu 3 | **Dwa NIEZALEŻNE mechanizmy eksportu współistnieją** dla Process Flow: stary `useProcessFlowExport` (mniejszy zestaw formatów) i nowy `IdeaExportMenu` (PNG/SVG/PDF/Markdown/pakiet diagramu/raport mapowania/manifest/raport/prezentacja) |
| **Table: „Eksportuj CSV" (natywny pasek) vs rail „Import/Eksport" popover** | Natywny pasek: realny, generuje i pobiera CSV z danych tabeli | Rail popover: martwy (te same `mm_export_*` bez odbiorcy) |

**Czy to samo czy różne:** Menu 1 ↔ Menu 3 = **świadomy duplikat, udokumentowany w kodzie** (nie
błąd). Rail popover w WB/PF/Table ↔ natywny eksport tego narzędzia = **martwa kopia obok
działającej wersji** — to samo wzorzec co w AI (sekcja 1). Process Flow ma DODATKOWO trzeci,
osobny, starszy mechanizm eksportu (`useProcessFlowExport`) równolegle z nowym `IdeaExportMenu` —
to nie duplikat interfejsu, ale duplikat KODU/ZAKRESU FORMATÓW, wart konsolidacji.

**Ryzyko dezorientacji: Średnie.** Menu 1/Menu 3 dublowanie jest niegroźne (świadome, ten sam
efekt). Martwy rail-popover w 3/4 narzędzi to ten sam wzorzec dezorientacji co w AI, ale rzadziej
klikany niż „AI rozwiń". Dwa mechanizmy eksportu w Process Flow to ryzyko utrzymaniowe (dwa miejsca
do aktualizacji przy zmianie formatu), niekoniecznie ryzyko dla użytkownika końcowego.

---

## 5. Import

| Gdzie | Scope | Efekt |
|---|---|---|
| **Rail → popover „Import/Eksport" → sekcja Import** (4 narzędzia) | Mind Map: 5 realnych opcji (Mapa JSON/XMind-FreeMind-OPML/Dokument→Mapa/Voice/Wywiady→Mapa) | WB/PF/Table: martwe |
| **Table natywny pasek → „Importuj dane" (Connector Wizard)** | Legacy only — `onShowConnectorWizard` | Działa w legacy; **w P15TableToolbar prop istnieje w interfejsie, ale nigdy nie jest renderowany jako przycisk** — osierocony |
| **Table natywny pasek → „Importuj CSV"** | Oba tryby | Działa |
| **Process Flow: brak dedykowanego importu poza czatem** | — | „Dokument → Mapa"/„Wywiady → Mapa" istnieją tylko jako koncept Mind Mapy w martwym popoverze |

**Czy to samo czy różne:** Podobny wzorzec do Export — jeden zestaw (mindmapowy) realnie działa
tylko w Mind Mapie; Table ma WŁASNY, częściowo martwy w P15 (`onShowConnectorWizard` osierocony).

**Ryzyko dezorientacji: Niskie-Średnie.** Import jest rzadziej używaną akcją niż Add/AI/Export,
więc mniejsza częstotliwość natrafienia na defekt — ale ten sam mechanizm ukrytej martwoty.

---

## 6. Add shape/node/row/Create

| Gdzie | Scope | Efekt |
|---|---|---|
| **Rail → sloty kontekstowe** (`MM_CONTEXT_SLOTS`/`WB_CONTEXT_SLOTS`/PF sloty/`TBL_CONTEXT_SLOTS`) | Per narzędzie, WŁASNE przyciski (Dodaj węzeł / Karteczka-Tekst-Kształt-Rysuj-Ramka / Start-Task-Decyzja-Lane / Nowy wiersz) | **Wszystkie realnie działają** — to jest jedyna warstwa „Dodaj", która jest poprawnie rozgałęziona per narzędzie |
| **Menu 3 → „Dodaj [X]"** (etykieta zmienia się per narzędzie: węzeł/kształt/wiersz/karteczka) | Wygląda identycznie dostosowana, ALE handler (`onAddPrimary`) woła `mm_add_child` TYLKO dla Mind Mapy, `'add_node'` dla pozostałych 3 | **Mind Map: działa. WB/PF/Table: martwe** — potwierdzone klikiem dla WB/PF w dokumentach źródłowych; dla Table wywnioskowane grepem tej sesji (ten sam kod `onAddPrimary`), niepotwierdzone wzrokiem |
| **Rail „Utwórz ▾" (Whiteboard specyficzny, w pasku narzędzia POD Menu 3)** | Pełna lista 8× Notatka + kształty + ramka + obraz + link | Realnie działa, POKRYWA się funkcjonalnie z martwym Menu 3 „Dodaj karteczkę" |
| **Prawy klik tło Mind Map → „Dodaj temat (do korzenia)"** | Scope = root | Działa (osobny handler `pane_add_topic`/klik menu, niezależny od Menu 3) |

**Czy to samo czy różne:** Etykieta w Menu 3 UDAJE, że jest tak samo dostosowana per narzędzie jak
rail (inna ikona, inny tekst: „Dodaj węzeł"/„Dodaj kształt"/„Dodaj wiersz"/„Dodaj karteczkę"), ale
pod spodem 3 z 4 wersji są **identycznym martwym kodem**. To jest najbardziej mylący duplikat w
całym systemie, bo wizualnie wygląda na w pełni tool-aware (inna etykieta, inna ikona), a
funkcjonalnie jest martwe wszędzie poza Mind Mapą.

**Ryzyko dezorientacji: WYSOKIE.** „Dodaj X" to prawdopodobnie najczęściej klikana akcja w całym
workspace (podstawowa czynność budowania treści) — martwy duplikat tej konkretnej akcji w 3 z 4
narzędzi, wizualnie nieodróżnialny od działającej wersji, jest krytycznym ryzykiem UX.

---

## 7. Duplicate (Duplikuj)

| Gdzie | Scope | Efekt |
|---|---|---|
| Menu węzła Mind Map → **„Duplikuj" (⌘D)** | Węzeł | `duplicateSelected()` |
| Pasek zaznaczenia Mind Map/Whiteboard → **„Duplikuj"** | Zaznaczenie | Ten sam handler co w menu kontekstowym |
| Menu tła Process Flow → **„Wklej"** | **W praktyce = Duplikuj** (`duplicateSelected()` pod etykietą „Wklej") | Patrz sekcja „Wklej" niżej — to jest duplikat KONCEPCYJNY, nie duplikat przycisku |
| Menu węzła Process Flow / pływający pasek → **„Duplikuj"** | Węzeł | Ten sam handler w dwóch miejscach (menu kontekstowe + pasek) |
| Menu węzła Mind Map → **„Duplikuj gałąź"** | Gałąź (węzeł + potomkowie) | RÓŻNA funkcja niż zwykłe „Duplikuj" (`duplicateBranch()` vs `duplicateSelected()`) — nazwa podobna, zakres inny |

**Czy to samo czy różne:** „Duplikuj" i „Duplikuj gałąź" w Mind Map to DWIE różne funkcje o
podobnych nazwach (pojedynczy węzeł vs cała gałąź z potomkami) — łatwo pomylić przy szybkim
skanowaniu menu. „Wklej" w Process Flow to inna etykieta dla tej samej funkcji co „Duplikuj" —
odwrotny problem (ta sama funkcja, myląca nazwa).

**Ryzyko dezorientacji: Średnie.** „Duplikuj" vs „Duplikuj gałąź" — ryzyko przypadkowego
zduplikowania całej gałęzi zamiast pojedynczego węzła (lub odwrotnie) jest realne przy pracy pod
presją czasu podczas warsztatu.

---

## 8. Delete (Usuń)

| Gdzie | Scope | Efekt |
|---|---|---|
| Menu węzła / pasek zaznaczenia (wszystkie 3 canvasy) | Zaznaczenie | `deleteSelected()` — spójny wzorzec, czerwony/danger, na dole listy |
| Table: prawy klik wiersz → **„Usuń wiersz"** vs pasek zaznaczenia → **„Usuń" (bulk)** | Pojedynczy wiersz vs wiele zaznaczonych | Dwa różne handlery (`effectiveHandleDeleteRow` vs `effectiveHandleBulkDelete`) dla analogicznej operacji w różnej skali — spójne, nie mylące |
| Process Flow: Delete na zaznaczonej krawędzi (bez węzła) | Krawędź | **NIE działa** (`deleteSelected()` liczy tylko węzły, wczesny return) — patrz `06_UI_HANDLER_DATA_CHAINS.md` PF5. To NIE jest duplikat, ale luka w tej samej rodzinie funkcji „Usuń" |
| Table: usunięcie kolumny (`deleteColumn`) | Kolumna | Jedyna wersja „Usuń" bez potwierdzenia modalnego i bez dedykowanego undo poza ⌘Z |

**Czy to samo czy różne:** Wzorzec „Usuń" jest w większości spójny (czerwony, na dole, disabled
gdy `locked`). Wyjątek: usuwanie krawędzi w Process Flow po prostu nie działa dla samej krawędzi —
luka, nie duplikat.

**Ryzyko dezorientacji: Niskie** dla samego duplikowania (spójne wzorce); **realne ryzyko
funkcjonalne** dla luki PF (użytkownik próbuje usunąć strzałkę, nic się nie dzieje, brak
komunikatu).

---

## 9. Auto-layout (Auto-układ)

| Gdzie | Scope | Efekt |
|---|---|---|
| Rail Mind Map (poz. przez Więcej narzędzi → „Zmień układ") | Mapa myśli | Cykl tree→radial→force |
| Menu tła Mind Map (prawy klik) → **„Automatyczny układ" (⌘L)** | Mapa myśli | `autoLayout()` + `fitView()` |
| Menu 3 → **„Auto-układ"** (widoczne tylko dla mindmap/process_flow) | Mind Map: działa (dispatch `pane_auto_layout` przez event `idea-mindmap-node-quick-action`) | Process Flow: **martwe** — Menu 3 wysyła zdarzenie nazwane dla Mind Mapy (`idea-mindmap-node-quick-action`), Process Flow nasłuchuje innej magistrali (`idea-workspace-quick-action`) — dwuwarstwowy błąd routingu (zła nazwa zdarzenia I zły prefiks akcji) |
| Process Flow: menu tła/węzła (prawy klik) → **„Auto-układ"** | Krok/tło | Działa (`handleAutoLayout()`) |
| Process Flow: „Więcej" → **„Auto układ"** | Cały diagram | **TU jest prawdziwy, działający auto-layout** (`toast.success('Auto-layout applied')`) |

**Czy to samo czy różne:** W Process Flow istnieją **3 wejścia** do (potencjalnie) tej samej
funkcji: Menu 3 (martwe), menu kontekstowe prawego kliku (działa), „Więcej" (działa, z toastem).
Użytkownik klikający najbardziej widoczne miejsce — Menu 3, tuż pod Menu 1 — dostaje ciszę,
podczas gdy identycznie nazwana funkcja działa dwa kliknięcia dalej.

**Ryzyko dezorientacji: Wysokie** dla Process Flow konkretnie — to jest przycisk widoczny na
pierwszym ekranie (Menu 3), a jego dokładny odpowiednik działa tylko w mniej odkrywalnym miejscu.

---

## 10. Validate (Waliduj)

| Gdzie | Scope | Efekt |
|---|---|---|
| Process Flow: „Więcej" → **„Waliduj"** | Diagram | Jedyne miejsce z tą funkcją — brak duplikatu |
| Wskaźnik „Brak ostrzeżeń/Ostrzeżenia N" na pasku narzędzia | Odczyt stanu | **Nie jest to duplikat interfejsu, ale KONFLIKT SEMANTYCZNY**: badge wygląda jak żywy status („sprawdzono — OK"), ale to statyczny stan początkowy, który zmienia się TYLKO po ręcznym kliknięciu „Waliduj" |

**Ryzyko dezorientacji: Średnie-Wysokie** — nie duplikat miejsc, ale fałszywe poczucie
bezpieczeństwa (zielony badge od samego wejścia na ekran, zanim ktokolwiek cokolwiek sprawdził).

---

## 11. Summary (Podsumowanie/Dashboard)

| Gdzie | Scope | Efekt |
|---|---|---|
| Rail Table → **„Dashboard"** (ikona `Frame`) | Tabela | Otwiera Summary Dashboard |
| Rail Mind Map → **„Ramka"** (ta sama ikona `Frame`) | Mapa myśli | Dodaje węzeł typu `group` (funkcja kompletnie inna) |
| Process Flow „Więcej" → **„Podsumuj"** | Diagram | `generateSummary()` — tekstowe podsumowanie procesu |
| Process Flow „Więcej" → **„KPI"** | Diagram | Panel `ProcessFlowHealthScore`/KPI dashboard — koncepcyjnie podobny do „Zdrowie mapy" Mind Mapy |

**Czy to samo czy różne:** Ikona `Frame` reużyta z DWOMA kompletnie różnymi znaczeniami (Ramka w
Mind Map = element canvasu; Dashboard w Table = otwarcie panelu podsumowania) — nie błąd
funkcjonalny (różne narzędzia), ale ryzyko rozpoznania po pamięci mięśniowej przy szybkim
przełączaniu między narzędziami.

**Ryzyko dezorientacji: Niskie-Średnie** (ikona, nie funkcja — mylące tylko przy bardzo szybkim
przełączaniu kontekstu).

---

## 12. Save view / Snapshoty / Historia wersji

| Gdzie | Scope | Efekt |
|---|---|---|
| Rail Mind Map: Import/Eksport → **„Historia wersji" (⌘⇧H)** | `mm_snapshot_history` | **Toggle** — `setShowSnapshots(prev => !prev)` |
| Rail Mind Map: Więcej narzędzi → **„Wersje / Snapshoty"** | `mm_snapshots` | **Zawsze ustawia `true`** (NIE toggle) |
| Menu 1 kebab → **„Historia"** | `onHistory` → `setSnapshotHistoryOpen(true)` | Trzecie wejście do koncepcyjnie tej samej funkcji (`SnapshotHistory.tsx`) |
| Whiteboard: **„Zapisz widok" (Scenes)** | `IdeaScenesManager` | To jest **INNA funkcja** — zapisuje viewport (x/y/zoom) jako „scenę" do prezentacji, NIE snapshot danych. Nazwa podobna do „Zapisz widok" w Table (zakładki widoków), ale zupełnie inny mechanizm i inne dane |
| Table: zakładki widoków → **„+" „Zapisz widok"** | `SavedView` (sort/filtry/grupowanie/layout/kolumny) | Trzecia, kompletnie inna funkcja pod tą samą frazą „Zapisz widok" |

**Czy to samo czy różne:** Trzy RÓŻNE koncepcje dzielą podobne nazwy: (1) **Historia wersji /
Snapshoty** — cofanie do stanu grafu w czasie (Mind Map, 3 wejścia z 2 różnymi zachowaniami:
toggle vs always-open); (2) **Zapisz widok** (Whiteboard/Scenes) — zapamiętany viewport do
prezentacji; (3) **Zapisz widok** (Table) — zapamiętana konfiguracja filtrów/sortowania. Nazwa
„Zapisz widok" powtórzona w (2) i (3) dla dwóch zupełnie różnych operacji jest realnym ryzykiem
nazewniczym, choć oba narzędzia nie współistnieją na tym samym ekranie jednocześnie (przełączane
tool-switcherem), więc kolizja jest głównie w warstwie „user pamięta z innego narzędzia".

**Ryzyko dezorientacji: Średnie** dla nazwy „Zapisz widok" (dwa różne mechanizmy pod tą samą
nazwą, w różnych narzędziach); **Niskie-Średnie** dla niespójności toggle/always-open w
Historia/Snapshoty Mind Mapy (dotyczy tylko power-userów klikających oba wejścia pod rząd).

---

## 13. Undo/Redo

| Gdzie | Silnik | Trwałość |
|---|---|---|
| Mind Map | Lokalny stos w komponencie + zapis stanu po cofnięciu przez wspólny `graphRuntime` | Historia cofania nie przetrwa odświeżenia; ostatni ZAPISANY stan tak |
| Process Flow | `useProcessFlowUndoRedo.ts`, max 30 kroków, w pamięci | Jak wyżej — jawnie udokumentowane w kodzie jako nietrwałe |
| Whiteboard | `handlers.undo()`/`redo()`, ALE stan enabled/disabled przycisku czerpany z `mm-undo-state`/`tbl-undo-state` — **nie istnieje `wb-undo-state`** | Przyciski realnie działają, ale ich wygaszenie wizualne może być „zastałe" z poprzednio odwiedzonego narzędzia w tej samej sesji |
| Table | **Dwa różne silniki**: `nodesUndo` (legacy) vs `onPlatformUndo` (P15) | Zależnie od trybu |

**Czy to samo czy różne:** Wzorzec przycisku (Cofnij/Ponów, ta sama pozycja w rail) jest wspólny,
ale **4 niezależne implementacje silnika** pod spodem, z czego jedna (Whiteboard) ma udokumentowaną
usterkę odczytu stanu `disabled`/`enabled` z cudzego źródła.

**Ryzyko dezorientacji: Średnie** — funkcjonalnie undo/redo działa wszędzie (potwierdzone dla
WB/PF/MM), ale wizualny stan przycisku w Whiteboardzie może kłamać (wyglądać na
zablokowany/aktywny niezgodnie z rzeczywistą dostępnością historii).

---

## 14. More / „…" (przepełnienie)

| Gdzie | Zawartość |
|---|---|
| Process Flow: **„Więcej akcji"** (pasek narzędzia) | Analiza/walidacja (KPI, Waliduj, AI Coach, Podsumuj, Odczyt, Propozycja AI) + Zarządzanie canvasem (Auto układ, Duplikuj, Usuń) + Zapytaj AI + (martwa) Convert |
| Table P15: **„…" (MoreHorizontal)** | Zwija 16 „drugorzędnych narzędzi" (AI Categorize/Scoring/Copilot/itd.) pod jeden przycisk — **w legacy te same 16 stoi płasko, BEZ kolapsu** |
| Rail (4 narzędzia): **„Więcej narzędzi"** (popover) | Tryby widoku/Workflow/Współpraca/Analityka — działa tylko w Mind Mapie, martwe w WB/PF/Table |

**Czy to samo czy różne:** Trzy niezależne „More"/„…" z zupełnie różną zawartością i różnym
mechanizmem (jeden collapsuje płaski rząd P15 vs legacy, jeden to rail-popover częściowo martwy,
jeden to w pełni działający dropdown Process Flow). Nie są to duplikaty tej samej funkcji — to
przypadek trzech niezwiązanych mechanizmów przepełnienia, nazwanych podobnie.

**Ryzyko dezorientacji: Niskie** (różne narzędzia, różne ekrany — mało prawdopodobne pomylenie w
jednej sesji pracy), ale **ryzyko utrzymaniowe: Wysokie** (trzy wzorce „overflow" do utrzymania
zamiast jednego wspólnego komponentu).

---

## 15. (Right-click vs floating toolbar)

| Narzędzie | Right-click (menu kontekstowe) | Floating toolbar (pasek zaznaczenia) | Rozjazd |
|---|---|---|---|
| Mind Map | `NodeContextMenu` — bogate, z pod-menu (Edycja/Struktura/AI/Konwersja/Wygląd) | `FloatingNodeToolbar` — płaskie ikony + „⋮" **otwierające TEN SAM `NodeContextMenu`** | **Brak konfliktu** — „⋮" to świadomy skrót do identycznego menu, potwierdzone wzrokiem. Jedyny rozjazd: `ai_suggest_links` działa z paska (przez event globalny), ale **nie działa** z menu prawego kliku (brak gałęzi w `handleContextAction`) — dokładnie ta sama pozycja, dwa różne rezultaty zależnie od wejścia |
| Process Flow | `ProcessFlowContextMenu` — „Edytuj etykietę" = **edycja INLINE** | `ProcessFlowFloatingToolbar` → „Zmień nazwę (F2)" = **otwiera panel właściwości** | **Realny konflikt zachowania**: dwa różne efekty dla pozornie tej samej intencji „zmień nazwę kroku" zależnie od tego, czy user kliknął prawym przyciskiem czy użył paska/F2 |
| Whiteboard | `IdeaCanvasContextMenu` — pełny zestaw (Edytuj/Duplikuj/Kopiuj/Warstwy/Blokada/Usuń + AI) | `WhiteboardSelectionBar` — inny zestaw (Dołącz/Powiązane/Promuj do decyzji-akcji/Wyrównaj/Rozłóż/Grupuj/Rozgrupuj/Duplikuj/Zablokuj/Usuń) | Częściowe pokrycie (Duplikuj/Zablokuj/Usuń wspólne, reszta unikalna per powierzchnia) — to raczej dopełnianie się niż duplikat, ale „Zablokuj" na pasku NIE zmienia etykiety na „Odblokuj" (statyczna), podczas gdy w menu kontekstowym etykieta się zmienia — drobna niespójność wizualna dla tej samej funkcji |

**Ryzyko dezorientacji: Wysokie dla Process Flow** (dwa różne efekty dla „zmień nazwę" to
realna niespójność funkcjonalna, nie tylko wizualna) — **Niskie dla Mind Map** (świadomy,
przetestowany skrót) — **Niskie-Średnie dla Whiteboard** (głównie kosmetyczne).

---

## 16. (Top bar vs second bar) i (Left rail vs second bar)

To jest w praktyce ten sam problem opisany wielokrotnie wyżej (sekcje 1, 4, 6, 9): **Menu 1 (top
bar)**, **Menu 3 (second bar)** i **lewy rail** wszystkie oferują nakładające się akcje
(Add/AI-expand/Templates/Export/Convert), zbudowane WSPÓLNYM builderem (`ideaCanvasMelsChips.ts`)
dla 4 narzędzi, ale z logiką napisaną pod jedno z nich (Mind Map). Efekt zbiorczy:

| Warstwa | Co oferuje | Stan poza Mind Mapą |
|---|---|---|
| Menu 1 (top bar) | Konwertuj ▾, kebab (Eksport/Historia/Duplikuj/Usuń/Szukaj/Skróty) | W większości działa (uniwersalne, nie zależy od `activeTool`) |
| Menu 3 (second bar) | Dodaj / Auto-układ / AI rozwiń / Szablony / Eksport / Utwórz z mapy | **Dodaj i AI rozwiń martwe** w WB/PF/Table; Auto-układ martwy w PF; Szablony i Eksport działają |
| Lewy rail | Zaznaczanie / AI / Szablony / [kontekst per narzędzie] / Import-Eksport / Więcej narzędzi / Cofnij-Ponów | Popover AI/Import-Eksport/Więcej martwe poza Mind Mapą; kontekst per narzędzie (poz. środkowe) i Cofnij/Ponów działają wszędzie |

**Ryzyko dezorientacji: WYSOKIE i SYSTEMOWE.** To nie jest pojedynczy duplikat do naprawienia
punktowo — to **wzorzec architektoniczny**: trzy poziome/pionowe paski, zbudowane wspólnym kodem,
z których po ~40-60% pozycji jest martwych w 3 z 4 narzędzi. Naprawa punktowa (np. tylko Menu 3)
zostawiłaby ten sam problem w railu. Rekomendacja z `_INPUT_CONTEXT.md` (rozgałęzić handlery per
`activeTool` w jednym miejscu — `ideaCanvasMelsChips.ts`/`IdeaMapWorkspace.tsx` `melsMenu3Actions`)
dotyczy więc PROSTEGO, ale SYSTEMOWEGO fixu obejmującego wszystkie trzy warstwy naraz.

---

## 17. Podsumowanie — ranking ryzyka

| Duplikat/konflikt | Ryzyko | Zasięg |
|---|---|---|
| Add (Dodaj X) w Menu 3 martwe poza Mind Mapą | **Wysokie** | 3/4 narzędzi, akcja najczęstsza |
| AI expand/generatory martwe poza Mind Mapą (rail + Menu 3) | **Wysokie** | 3/4 narzędzi, druga najczęstsza akcja |
| Auto-układ Menu 3 martwe w Process Flow (przy działającym odpowiedniku 2 kliki dalej) | **Wysokie** | 1 narzędzie, ale bardzo widoczny przycisk |
| Right-click vs floating toolbar „zmień nazwę" — dwa różne efekty (Process Flow) | **Wysokie** | 1 narzędzie, akcja częsta |
| Prawy panel: 5 zakładek → 1 identyczny panel | **Wysokie** (osobno opisane w `_PRAWY_PANEL_IDEE`, tu tylko przypomniane jako część wzorca) | 4 narzędzia |
| Convert — 7 punktów wejścia, różny scope, 1 martwa gałąź (PF „Więcej") | Średnie-Wysokie | 4 narzędzia |
| Wskaźnik walidacji „Brak ostrzeżeń" = fałszywe poczucie bezpieczeństwa | Średnie-Wysokie | Process Flow |
| Export: rail popover martwy poza Mind Mapą + PF ma 2 niezależne mechanizmy eksportu | Średnie | 3/4 narzędzi + dług techniczny PF |
| Duplikuj vs Duplikuj gałąź (nazwa myląca różny zasięg) | Średnie | Mind Map |
| „Zapisz widok" — ta sama fraza, 2 różne mechanizmy (Whiteboard/Table) | Średnie | 2 narzędzia |
| Historia wersji/Snapshoty — toggle vs always-open (2 wejścia) | Niskie-Średnie | Mind Map |
| Import: osierocony `onShowConnectorWizard` w P15 | Niskie-Średnie | Table (P15) |
| Ikona `Frame` = Ramka (MM) vs Dashboard (Table) | Niskie-Średnie | kosmetyczne |
| Trzy niezależne mechanizmy „More/…" | Niskie (UX) / Wysokie (dług utrzymaniowy) | 3 narzędzia |
| Undo/Redo — 4 niezależne silniki, 1 z błędnym odczytem stanu (Whiteboard) | Średnie | 4 narzędzia |
| Delete krawędzi w Process Flow nie działa (luka, nie duplikat) | Średnie (opisane też w 06 jako PF5) | Process Flow |

**Wniosek zbiorczy:** większość duplikatów WYSOKIEGO ryzyka ma wspólny root-cause (mechanizm
zbudowany dla Mind Mapy i reużyty 1:1 wizualnie dla pozostałych 3 narzędzi bez rozgałęzienia
handlerów) — naprawa jest skoncentrowana w 2-3 miejscach kodu (`ideaCanvasMelsChips.ts`,
`IdeaMapWorkspace.tsx` sekcja `melsMenu3Actions`/`renderMelsCanvasRightRailPanel`), nie
rozproszona po całym systemie. Pozostałe konflikty (Process Flow „zmień nazwę", walidacja,
undo Whiteboard) są lokalne i niezależne od siebie.
