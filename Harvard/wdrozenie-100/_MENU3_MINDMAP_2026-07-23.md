# Menu 3 (górny pasek akcji) — narzędzie Mind Map (Mapa myśli), Consultify

Dokument dla AI bez kontekstu projektu. Consultify to system realizacji doradztwa; "Mind Map"
to jeden z czterech narzędzi kanwy w module "Moje Prace → Idee" (obok Whiteboard, Process Flow,
Tabela). Ekran ma trzy poziome paski: **Menu 1** (identyfikacja + breadcrumb + "Konwertuj ▾" +
kebab `⋯`), **Menu 3 = "second bar"** (przedmiot tego dokumentu — pasek akcji widoku POD Menu 1),
i płótno (canvas) z węzłami mapy. Menu 3 to CO INNEGO niż lewy rail narzędzi (przełącznik
Mind Map/Whiteboard/Process Flow/Tabela) i CO INNEGO niż pływający pasek kontekstowy węzła — oba
opisane osobno w `_RAIL_LEWY_MINDMAP` i `_KONTEKST_MINDMAP`.

Stan: **działa na żywo**, zweryfikowane wzrokiem na `localhost:3100` (obiekt
`8d97381d-…/workspace/mindmap`, tryb ciemny). Domyślnie WŁĄCZONE od 2026-07-22 (flaga
`ff.mels_canvas` / `VITE_MELS_CANVAS`, patrz `src/utils/melsCanvasFlag.ts`) — legacy pasek
(`IdeaWorkspaceToolbar.tsx`, floating chrome nad płótnem) jest odtąd ścieżką zapasową, osiągalną
tylko przez `?ff_melsCanvas=0`. Bieżący ekran-domyślny renderuje Menu 3 przez
`IdeaCanvasSecondBar.tsx`, karmiony deskryptorami z `buildIdeaMenu3Actions()` w
`ideaCanvasMelsChips.ts` — WSPÓLNY mechanizm dla wszystkich 4 narzędzi kanwy (treść lewej/prawej
strony zależy od `tool`).

Źródła (kotwice):
- `src/components/MyWork/IdeaCanvasSecondBar.tsx` — czysto prezentacyjny komponent paska (70 linii).
- `src/components/MyWork/ideaCanvasMelsChips.ts` — `buildIdeaMenu3Actions()` (builder deskryptorów).
- `src/components/MyWork/IdeaMapWorkspace.tsx` (linie ~2919–2953) — realne handlery wpięte pod
  builder dla trybu mindmap.
- `src/components/MyWork/mindmap/useMindMapQuickActions.ts` — logika akcji (`mm_add_child`,
  `mm_ai_expand`).
- `src/components/MyWork/mindmap/useAutoLayout.ts` — algorytm auto-układu.
- `src/components/MyWork/mindmap/MapHealthScore.tsx` — komponent "Zdrowie mapy".
- `src/components/shared/ExecutiveModuleShell/index.tsx` — powłoka renderująca slot `secondBar`
  bezpośrednio pod Menu 1 (TopBar), przed płótnem.

---

## Lewa strona paska: Dodaj węzeł · Auto-układ · AI rozwiń · Szablony

| element | etykieta PL | co robi | po co | stan |
|---|---|---|---|---|
| `menu3-add` | **Dodaj węzeł** (ikona `Plus`) | Wywołuje `handleQuickAction('mm_add_child')` → `useMindMapQuickActions` → `handlers.addChildNode(targetNodeId)`. Dodaje nowy węzeł-dziecko do aktualnie zaznaczonego węzła (lub do korzenia, jeśli nic nie zaznaczono). | Najszybsza droga rozbudowy mapy ręcznie, bez wchodzenia w menu kontekstowe węzła. | **Działa.** Realny handler, realna mutacja grafu (nodes/edges), autosave po zmianie. |
| `menu3-auto-layout` | **Auto-układ** (ikona `LayoutDashboard`) | Wysyła `CustomEvent('idea-mindmap-node-quick-action', {action:'pane_auto_layout'})`. Nasłuch w `IdeaRecommendationMap.tsx` woła `autoLayout(nodes, edges)` z `useAutoLayout.ts`, podmienia pozycje węzłów, potem `fitView()`. | Porządkuje "rozjechaną" mapę (po ręcznym przeciąganiu, po AI-rozwinięciu) w czytelne drzewo bez ręcznego rozstawiania węzłów. | **Działa.** Algorytm to rekurencyjny układ drzewa poziomego: korzeń po lewej, dzieci wachlarzem w prawo (`H_GAP=220px`, `V_GAP=70px`), rodzic centrowany pionowo względem dzieci, węzły-sieroty (bez rodzica) dokładane siatką pod spodem. Widoczne tylko dla narzędzi `mindmap` i `process_flow` (`supportsAutoLayout`) — Tabela i Whiteboard nie mają tego przycisku. |
| `menu3-ai-expand` | **AI rozwiń** (ikona `Sparkles`) | `handleQuickAction('mm_ai_expand')` → `handlers.handleAIExpand()` → `Api.expandMyIdeaMap(ideaId, {...})` → `POST /api/my-work/my-ideas/:id/map/expand`. Bierze zaznaczony węzeł (albo korzeń) + jego przodków jako kontekst, prosi backend (LLM) o 5 nowych pod-węzłów, wynik trafia do **propozycji do zatwierdzenia** (`aiProposal`, `proposeOnly:true`) — nie wskakuje od razu na mapę. | AI samodzielnie rozbudowuje gałąź myślową (burza mózgów wspomagana AI), użytkownik zatwierdza/odrzuca zanim trafi na mapę (diff-review). | **Działa**, realne wywołanie backendu. Jeśli brak propozycji → toast "Brak nowych propozycji". Jeśli tryb offline/lokalny → toast "AI wymaga działającego backendu." (widoczne na żywym środowisku lokalnym jako baner "Reconnecting collaboration / Single-user mode" — kolaboracja live jest osobną sprawą, AI rozwiń działa niezależnie o ile backend odpowiada). |
| `menu3-templates` | **Szablony** (ikona `LayoutTemplate`) | `setTemplateGalleryOpen(true)` → otwiera modal `<IdeaTemplateGallery>` (osobny plik `IdeaTemplateGallery.tsx`, realny komponent z listą gotowych szkieletów mapy do zaaplikowania na aktualną ideę). | Szybki start z gotowej struktury (np. szablon SWOT / branżowy) zamiast pustej mapy. | **Działa** (komponent realny, podpięty `ideaId`, `activeTool`, `baseVersion`, `existingNodeCount` — a więc świadomy aktualnego stanu mapy przy aplikowaniu szablonu). Nie zweryfikowano zawartości samej galerii (jakie konkretnie szablony są na liście) — poza zakresem tego audytu. |

Uwaga label per-narzędzie: etykieta i ikona przycisku "Dodaj" zależą od `tool` (mapa
`MENU3_ADD_LABEL`/`MENU3_ADD_ICON` w `ideaCanvasMelsChips.ts`) — dla Mind Map to "Dodaj węzeł"
(Plus), dla Process Flow "Dodaj kształt" (Workflow), dla Tabela "Dodaj wiersz" (Table2), dla
Whiteboard "Dodaj karteczkę" (Plus). To ten sam builder, inny wynik.

## Prawa strona paska: Eksport · Utwórz z mapy

| element | etykieta PL | co robi | po co | stan |
|---|---|---|---|---|
| `menu3-export` | **Eksport** (ikona `Download`) | `setExportMenuOpen(true)` → otwiera `<IdeaExportMenu>` z pełnym grafem (`graphNodes`/`graphEdges`) + rozszerzeniami (`extensions`: whiteboard/processFlow/activeTool). Ten sam handler co pozycja "Eksport" w kebabie Menu 1 (`⋯`) — dwa wejścia, jeden mechanizm. | Wyeksportowanie mapy do zewnętrznego formatu (obraz/PDF/PowerPoint itp. — konkretne formaty w `IdeaExportMenu.tsx`, poza zakresem tego audytu). | **Działa.** Wyłączony (`disabled`) gdy mapa pusta (`hasContent=mapHasNodes=false`), z tooltipem "Pusta mapa". |
| `menu3-convert-from-map` | **Utwórz z mapy** (ikona `GitBranch`) | `handlePanelChange('tools')` — ustawia `activePanel='tools'`, co otwiera **prawy panel inspektora** (`IdeaWorkspaceTools`, embedded w rail powłoki). To NIE jest bezpośrednia konwersja — to skrót otwierający panel, w którym sekcja **"3. Convert"** (akordeon, domyślnie zwinięta, ikona `Rocket`) zawiera realne cele konwersji (Initiative / Task / Decision / Report / Deck, …) zdefiniowane w `ideaConvertTargets.ts`, każdy wołający `onConvert(target)`. | "Utwórz z mapy" = otwarcie panelu, z którego user wybiera NA CO przekonwertować mapę (np. utworzyć z niej Inicjatywę, Zadania, Decyzję, Raport) — czyli mapa myśli jako źródło do wygenerowania innego artefaktu Consultify. Nazwa w Menu 3 jest skrótem myślowym dla "otwórz Convert"; sama konwersja dzieje się po kolejnym kliknięciu w panelu. | **Działa** jako otwarcie panelu (wyłączony gdy mapa pusta, tooltip "Pusta mapa"). Panel otwiera się na CAŁYM zestawie 5 sekcji (Problem/Status/Inspector/Convert/Health) w formie akordeonu — "Utwórz z mapy" nie skacze bezpośrednio/nie przewija do sekcji Convert, tylko otwiera panel; sekcja Convert jest domyślnie zwinięta (trzeba ją samemu rozwinąć). To NIE jest błąd runtime, ale UX-niedoróbka warta odnotowania — patrz "Uwagi" niżej. Osobno: przycisk "Konwertuj ▾" w Menu 1 (primary CTA, `IdeaConvertMenu`) to inna, bardziej bezpośrednia droga do tego samego zestawu celów konwersji. |

Uwaga: obie kolumny prawej strony chowają się gdy nie ma podpiętego handlera (np. brak
`onExport` → przycisk w ogóle się nie renderuje) — to jest wzorzec "honest-disabled/hidden"
konsekwentnie stosowany w tym pliku (podobnie jak w Menu 1: `soon`-tooltip "Wkrótce" dla
niepodłączonych handlerów Historia/Duplikuj/Usuń).

## Zdrowie mapy ("Zdrowie mapy 10%")

Nie jest to element DOM Menu 3 (nie renderuje go `IdeaCanvasSecondBar`) — to **osobny, pływający
widget** (`MapHealthScore.tsx`), pozycjonowany `absolute top-14 right-3` **wewnątrz kontenera
płótna**, więc wizualnie ląduje w prawym górnym rogu widoku, tuż pod Menu 3 (stąd naturalne
skojarzenie "róg płótna" / "część górnego paska" — w rzeczywistości to nakładka nad canvasem, nie
wiersz paska).

| co | jak liczone | skąd dane | stan |
|---|---|---|---|
| Wynik ogólny (badge "Zdrowie mapy N%") | Średnia arytmetyczna 5 metryk (każda 0–100, wagi równe: 1/5): **Balance** (równomierność liczby dzieci między gałęziami głównymi), **Depth** (średnia głębokość drzewa × 33, ucięta do 100), **Coverage** (% gałęzi głównych mających ≥2 pomysły), **Maturity** (% węzłów-pomysłów o statusie innym niż domyślny "idea"), **Connectivity** (liczba krawędzi międzygałęziowych × 20, ucięta do 100). | **Liczone lokalnie w przeglądarce** z aktualnego stanu `nodes`/`edges` trzymanego w pamięci komponentu (React state) — **NIE** jest to wartość z backendu ani zapisana w bazie; przelicza się na każdy render (`useMemo`). | **Działa**, potwierdzone na żywo (widget renderuje "Zdrowie mapy / 10%" z kolorowym pierścieniem SVG). Kolor pierścienia/tekstu: zielony ≥70%, żółty 40–69%, czerwony <40% (10% na testowym obiekcie = czerwony, bo mapa ma dużo płaskich, jednopoziomowych gałęzi i mało dojrzałych/powiązanych węzłów). |
| Rozwinięcie (`ChevronDown`/`ChevronUp`) | Klik w kartę przełącza `expanded` — pokazuje pasek postępu per metryka + detal tekstowy (np. "Min: 1, Max: 4", "Avg depth: 1.3", "2/5 branches", "3/12 mature", "1 cross-branch"). | j.w., ten sam `useMemo`. | Nie potwierdzono klikiem na żywo w tej sesji (próby kliknięcia w środowisku testowym trafiły przypadkowo w inne elementy i przełączyły widok — wycofano się bez zapisu niepożądanych zmian, wracając na docelowy obiekt). Logika rozwijania jest jednoznaczna w kodzie (prosty `useState` toggle), więc oznaczam jako **działa wg kodu, niepotwierdzone wzrokiem w tej sesji**. |
| Widoczność | Domyślnie ON (`showHealthScore` state = `true` w `IdeaRecommendationMap.tsx`), da się ukryć programowo (`setShowHealthScore`), ale **nie znaleziono w Menu 3 ani Menu 1 przycisku do przełączenia widoczności** — setter jest przekazywany dalej (do jakiegoś kontekstu/panelu poza zakresem tego audytu), poza Menu 3. | — | Sam widget = działa; przełącznik widoczności = poza zakresem tego dokumentu (nie w Menu 3). |
| Ten sam komponent w prawym panelu | Sekcja "6. Map Health" w `IdeaWorkspaceTools.tsx` (prawy rail, zakładka "Kondycja"/"Health") renderuje TEN SAM `<MapHealthScore>` osadzony inline (nie floating) — więc wynik widać też w panelu bocznym, nie tylko w rogu płótna. | j.w. | Działa, ten sam kod. |

## Menu 1 — dla kontrastu (żeby nie pomylić z Menu 3)

Krótko, bo to NIE jest przedmiot tego dokumentu, ale żeby uniknąć pomyłki: pasek nad Menu 3 to
Menu 1 — breadcrumb (Idee › nazwa), ikona narzędzia, chip etapu ("Iskra"), wskaźnik zapisu
("Draft lokalny" / "Zapisano przed chwilą" / "Zmiany w kolejce"), ghost "Teresa" (czat AI), kebab
`⋯` (Eksport/Historia/Duplikuj/Usuń + "Więcej": Szukaj/Skróty), i primary **"Konwertuj ▾"**
(`IdeaConvertMenu` — ten sam zestaw celów konwersji co sekcja "Convert" w prawym panelu, tylko
osiągalny wprost z Menu 1 zamiast przez "Utwórz z mapy" → panel → rozwiń sekcję).

## Uwagi / plan

1. **"Utwórz z mapy" nie skacze do sekcji Convert.** Klik otwiera cały panel inspektora z 5
   sekcjami w akordeonie, a sekcja "Convert" (3. w kolejności) jest domyślnie zwinięta — user
   musi ją sam rozwinąć. Biorąc pod uwagę, że etykieta obiecuje konkretną akcję ("utwórz"), a nie
   ogólne "otwórz panel", warto rozważyć: albo automatyczne rozwinięcie sekcji Convert przy tym
   wejściu, albo zmianę etykiety na coś w rodzaju "Panel narzędzi" — do decyzji właściciela.
   Skoro obok istnieje też "Konwertuj ▾" w Menu 1 robiący dokładnie to samo bardziej wprost,
   podwójna droga do tego samego efektu może być zamierzoną redundancją (szybki dostęp z dwóch
   miejsc) albo niedopracowanym dubletem — nie rozstrzygam, tylko odnotowuję.
2. **Widget "Zdrowie mapy" nie ma przycisku widoczności w Menu 3** — jest zawsze widoczny
   domyślnie, brak odkrytego sposobu na jego ukrycie z poziomu tego paska.
3. **Rozwinięcie widgetu "Zdrowie mapy" nie zostało potwierdzone klikiem na żywo w tej sesji**
   (opisano dlaczego wyżej — ryzyko przypadkowej nawigacji do innego narzędzia/obiektu). Logika w
   kodzie jest prosta i jednoznaczna (`useState` toggle), ale warto to domknąć wzrokiem przy
   następnej bezpiecznej okazji.
4. Wszystkie 6 elementów Menu 3 (4 lewe + 2 prawe) są **realnie podłączone** — żaden nie jest
   fantomem/martwym kodem. To odróżnia ten pasek od części legacy floating-toolbara, gdzie bywają
   niepodłączone handlery (por. wzorzec "Wkrótce" w Menu 1 dla Historii/Duplikuj/Usuń — te SĄ
   fantomami, ale żyją w Menu 1, nie w Menu 3).
5. Mechanizm `buildIdeaMenu3Actions` jest WSPÓLNY dla 4 narzędzi kanwy — zmiana etykiety/logiki w
   `ideaCanvasMelsChips.ts` odbije się na Mind Map, Process Flow, Tabela i Whiteboard jednocześnie
   (poza `onAutoLayout`, widocznym tylko dla mindmap/process_flow). Przy dalszej pracy nad tym
   paskiem pamiętać o tym sprzężeniu.
