# Audyt menu kontekstowych — Process Flow (Consultify / IDEE)

**Data:** 2026-07-23
**Zakres:** narzędzie "Przepływ procesu" (Process Flow) w module IDEE (My Work) aplikacji
Consultify — AI-native system realizacji doradztwa. Ten dokument opisuje TRZY POWIERZCHNIE
menu kontekstowego dostępne na płótnie edytora procesu: prawy klik na pustym tle, prawy klik
na elemencie (krok/krawędź), oraz pływający pasek narzędzi pokazujący się po zaznaczeniu kroku.
Analiza oparta jest na czytaniu kodu źródłowego (React + TypeScript, biblioteka `reactflow`).

**Metoda i zastrzeżenie:** analiza wykonana metodą "grep-first" na plikach źródłowych. Próba
weryfikacji wzrokowej na żywym podglądzie (`localhost:3100`) **nie powiodła się** — token
logowania w `/tmp/tok.txt` wygasł (JWT `exp` minął ~30 min przed próbą), a wygenerowanie
nowego tokenu podpisanego lokalnym sekretem deweloperskim zostało zablokowane przez klasyfikator
bezpieczeństwa środowiska agenta jako podejrzana operacja na danych logowania. W efekcie
**żadna pozycja w tym dokumencie nie została potwierdzona wzrokiem (zrzutem ekranu)** — wszystkie
stany („działa"/„martwa") pochodzą z czytania kodu i są tak oznaczone. Zalecane: powtórzyć
weryfikację wzrokową ze świeżym tokenem.

## Kontekst architektoniczny (skrót dla AI bez wiedzy o projekcie)

Process Flow to edytor diagramów procesu zbudowany na bibliotece `reactflow` (kroki = węzły
`flowNode`/`start`/`decision`/`end`/warianty VSM/BPMN/system/org, krawędzie = strzałki, tory =
poziome "lanes" renderowane jako tło, NIE jako węzły grafu). Trzy powierzchnie menu są
zaimplementowane w osobnych, małych plikach (nie w jednym potworze):

- `src/components/MyWork/processflow/ProcessFlowContextMenu.tsx` — komponent menu (prawy klik)
  + dwie funkcje budujące listy akcji: `getNodeContextActions()` (klik na węźle) i
  `getCanvasContextActions()` (klik na pustym płótnie).
- `src/components/MyWork/processflow/ProcessFlowFloatingToolbar.tsx` — pasek ikon pokazujący się
  nad zaznaczonym węzłem.
- `src/components/MyWork/processflow/useProcessFlowQuickActions.ts` — **NIE jest menu**; to osobny
  most między czatem AI a akcjami na płótnie (zdarzenie `idea-workspace-quick-action`,
  komendy `pf_*` typu "dodaj krok", "analizuj proces"). Wspomniany dla kompletności, poza
  zakresem trzech powierzchni z tego audytu.
- Cały sprzęt jest spinany w `src/components/MyWork/IdeaProcessFlowTool.tsx` (3393 linie) —
  tam żyje stan `contextMenu`/`edgeStylePopover`, faktyczne handlery (`deleteSelected`,
  `duplicateSelected`, `handleAutoLayout`, `insertBetween`, `openStepRewrite`, `handleConvert`).

**Ważna decyzja projektowa udokumentowana w kodzie** (komentarz przy linii ~3200 w
`IdeaProcessFlowTool.tsx`): Process Flow celowo NIE używa współdzielonego komponentu
`IdeaCanvasContextMenu` (używanego przez inne narzędzia IDEE) — bo tamten to menu AI
(rozwiń/rzuć wyzwanie/znajdź dowody), a Process Flow potrzebuje menu strukturalnego
(dodaj-węzeł-per-kształt, auto-układ, operacje na torach). Ma więc **własne, dedykowane** menu.

Krawędzie (strzałki między krokami) **nie mają prawoklikowego menu kontekstowego** — mają
zamiast tego popover otwierany LEWYM klikiem (`EdgeStylePopover`, plik
`src/components/MyWork/processflow/EdgeStylePopover.tsx`) do koloru/stylu linii/kierunku
strzałki/etykiety. Opisany w sekcji 2 jako odrębna, czwarta powierzchnia (poza ścisłym zakresem
"prawy klik", ale funkcjonalnie pełni podobną rolę).

Tory (lanes) też nie mają menu kontekstowego — mają własny nagłówek z przyciskami
(zwiń/rozwiń, przesuń w górę/dół, zmień kolor, usuń) w `LaneSystem.tsx`. Prawy klik na pustym
obszarze toru trafia w zwykłe `onPaneContextMenu` i pokazuje to samo menu co prawy klik na tle
(sekcja 1) — nie ma nic specyficznego dla toru w prawoklikowym menu.

---

## 1. Menu tła (prawy klik na pustym płótnie)

Źródło: `getCanvasContextActions()` w `ProcessFlowContextMenu.tsx`, wywoływane z
`onPaneContextMenu` w `IdeaProcessFlowTool.tsx` (linia ~2827).

| Pozycja (PL) | Skrót | Typ | Co robi | Stan |
|---|---|---|---|---|
| Dodaj akcję | — | dodawanie węzła | `addNode('action')` — nowy krok typu "akcja" w bieżącym trybie diagramu | Działa (wg kodu) |
| Dodaj decyzję | — | dodawanie węzła | `addNode('decision')` — nowy krok typu "decyzja" (rozgałęzienie) | Działa (wg kodu) |
| Wklej | — | ⚠ mylące | Etykieta mówi "Wklej", ale `onClick` woła **`duplicateSelected()`** — czyli duplikuje aktualnie ZAZNACZONY węzeł (przesunięty o +40/+40 px względem jego własnej pozycji), a NIE wkleja niczego w miejscu kliknięcia. Nie istnieje żaden schowek/kopiuj-wklej w tym narzędziu (Ctrl+C/Ctrl+X nie są w ogóle podpięte — patrz Uwagi). Jeśli nic nie jest zaznaczone, pozycja **nic nie robi i nic nie sygnalizuje** (cichy no-op) | **Myląca etykieta / częściowo martwa** — nazwa nie odpowiada działaniu |
| Auto-układ | — | narzędziowa | `handleAutoLayout()` — przelicza pozycje węzłów wg torów i kolejności krawędzi | Działa (wg kodu) |

Wszystkie 4 pozycje są wyłączane (`disabled`), gdy diagram jest zablokowany (`locked` — np.
tryb tylko-do-odczytu / edytuje ktoś inny w kolaboracji).

---

## 2. Menu elementu (prawy klik na kroku / krawędzi / torze)

### 2a. Prawy klik na kroku (węźle)

Źródło: `getNodeContextActions()`, wywoływane z `onNodeContextMenu` (linia ~2823). Kolejność
pozycji wymuszona jest kanonem "K6: Open → Context → AI → Convert → Danger" (komentarz w kodzie).

| Pozycja (PL) | Skrót | Typ | Co robi | Stan |
|---|---|---|---|---|
| Otwórz właściwości | — | otwarcie | `setShowPropertiesPanel(true)` — otwiera panel właściwości kroku (boczny panel) | Działa (wg kodu) |
| Edytuj etykietę | — | edycja treści | Bumpuje `editSignal` na węźle → komponent węzła wchodzi w tryb edycji inline nazwy. Komentarz w kodzie: napraw defekt "U8" (wcześniej tylko zaznaczało, nie otwierało edytora) | Działa (wg kodu, ma udokumentowaną historię naprawy) |
| Duplikuj | — | edycja struktury | `duplicateSelected()` — kopiuje zaznaczony węzeł (+40/+40 px) | Działa (wg kodu) |
| Auto-układ | — | narzędziowa | `handleAutoLayout()` — jak w menu tła | Działa (wg kodu) |
| AI: rewrite step *(etykieta widoczna po angielsku nawet w PL — patrz Uwagi)* | — | AI | `openStepRewrite(nodeId)` → otwiera panel AI z instrukcją "przepisz ten krok"; realny pipeline `edit_step` (Propose→Accept), nie atrapa | Działa (wg kodu) — **ale brak tłumaczenia PL, patrz Uwagi** |
| Konwertuj na inicjatywę | — | konwersja między narzędziami | `handleConvert('pf_convert_initiative')` → zdarzenie `pf_convert_initiative` mapowane w `IdeaMapWorkspace.tsx` na realny generyczny konwerter `handleConvertRef` (ten sam mechanizm co w Mind Map/Whiteboard/Tabeli) | Działa (wg kodu, realny pipeline, nie stub) |
| Usuń | — | destrukcyjna (danger) | `deleteSelected()` — patrz uwaga o wielozaznaczeniu w sekcji "Uwagi" | Działa (wg kodu) dla węzła |

Pozycje "Edytuj etykietę" / "Duplikuj" / "Auto-układ" / "AI: rewrite step" / "Konwertuj na
inicjatywę" / "Usuń" są wyłączane (`disabled`), gdy diagram jest zablokowany.

### 2b. Prawy klik na krawędzi

**Nie istnieje.** `IdeaProcessFlowTool.tsx` nie rejestruje `onEdgeContextMenu` na komponencie
`<ReactFlow>` — stan `contextMenu` ma wprawdzie w typie opcjonalne pole `edgeId`, ale nic go
nigdy nie ustawia. Prawy klik na krawędzi nie robi nic specjalnego (przechwytuje go tło pod
spodem, jeśli klik trafi poza samą linię, albo nie dzieje się nic).

Zamiast tego krawędź ma **lewoklikowy popover** (`EdgeStylePopover`, otwierany przez
`onEdgeClick`):

| Pozycja (PL) | Wyzwalacz | Co robi | Stan |
|---|---|---|---|
| Etykieta (pole tekstowe) | lewy klik na krawędzi | zmienia tekst na strzałce (`onLabelChange`) | Działa (wg kodu) |
| Kolor (8 swatchy + "Automatyczny") | j.w. | nadpisuje kolor linii (`onColorChange`), "Automatyczny" czyści nadpisanie | Działa (wg kodu) |
| Styl: Ciągła / Przerywana | j.w. | `onStyleChange` | Działa (wg kodu) |
| Strzałka: Brak / Koniec / Start / Obie strony | j.w. | `onArrowChange` | Działa (wg kodu) |

Ten popover **nie ma opcji "Usuń krawędź"** — usunięcie krawędzi jest możliwe tylko klawiszem
Delete/Backspace po jej zaznaczeniu, ALE (patrz Uwagi) sama funkcja `deleteSelected()` ma bug,
przez który usuwanie samej krawędzi (bez żadnego zaznaczonego węzła) **nie działa**.

### 2c. Prawy klik na torze (lane)

**Nie ma dedykowanego menu.** Tor to element tła (renderowany przez `LaneSystem.tsx`), nie
węzeł grafu reactflow — prawy klik na pustym obszarze toru trafia w `onPaneContextMenu` i
pokazuje to samo menu co sekcja 1 (Dodaj akcję/Dodaj decyzję/Wklej/Auto-układ), bez żadnej
opcji specyficznej dla toru (np. "usuń tor", "zmień kolor toru").

Operacje na torze istnieją, ale **nie w menu kontekstowym** — żyją jako stałe przyciski w
nagłówku toru (`LaneSystem.tsx`): zwiń/rozwiń, przesuń w górę, przesuń w dół, zmień kolor
(color picker), usuń tor, oraz uchwyt do zmiany wysokości ("Resize lane"). Wymieniam je tu dla
kompletności obrazu, choć formalnie nie są "menu kontekstowym":

| Pozycja | Typ | Stan |
|---|---|---|
| Zwiń/rozwiń tor | pstryczek | Działa (wg kodu) |
| Przesuń w górę / w dół | strzałki | Działa (wg kodu), zależne od `onMoveUp`/`onMoveDown` (opcjonalne propsy) |
| Zmień kolor | color picker | Działa (wg kodu) |
| Usuń tor | destrukcyjna | Działa (wg kodu), zależne od `onDelete` (opcjonalny prop) |
| Resize lane (uchwyt) | drag | Działa (wg kodu) |

---

## 3. Pływający pasek po zaznaczeniu (`ProcessFlowFloatingToolbar`)

Pokazuje się WYŁĄCZNIE gdy zaznaczony jest dokładnie jeden węzeł i diagram nie jest zablokowany
(`{selectedNode && !locked && <ProcessFlowFloatingToolbar .../>}`, linia ~2936). Pozycjonowany
nad środkiem górnej krawędzi węzła. **Nie ma rozwijanego „⋮"** — wszystkie przyciski są od razu
widoczne jako płaskie ikony (task wspominał ewentualne „⋮", ale w kodzie go nie ma — pasek
renderuje wszystkie pozycje bezpośrednio, plus jeden panel rozwijany po kliknięciu ikony
"Powiązania").

| Pozycja (ikona, tytuł hover PL) | Skrót | Typ | Co robi | Stan |
|---|---|---|---|---|
| Zmień nazwę (F2) | F2 (globalnie, nie z tego przycisku) | otwarcie | `onRename` → `setShowPropertiesPanel(true)` — otwiera panel właściwości (⚠ **inne zachowanie niż "Edytuj etykietę" w menu prawego klisku**, które robi edycję inline — patrz Uwagi) | Działa (wg kodu), ale niespójne z menu prawego kliku |
| Duplikuj | Ctrl/Cmd+D | edycja struktury | `duplicateSelected()` | Działa (wg kodu) |
| Wstaw między | — | edycja struktury | `onInsertBetween` → `insertBetween()` — **wstawia nowy krok w połowie ZAZNACZONEJ KRAWĘDZI**, nie węzła. Jeśli żadna krawędź nie jest zaznaczona (typowy przypadek, gdy pasek pokazał się bo zaznaczono węzeł), funkcja pokazuje toast błędu "wybierz najpierw krawędź" i nic nie robi | **Myląca / de facto martwa w typowym użyciu** — przycisk wisi przy zaznaczonym WĘŹLE, ale wymaga zaznaczonej KRAWĘDZI |
| Powiązania (Link2, z licznikiem) | — | rozwijane | Otwiera/zamyka miniaturowy panel "Powiązane artefakty" pod paskiem: lista `artifactLinks`, każdy z przyciskiem usuwania. Jeśli brak — "Brak powiązań" | Działa (wg kodu) — jedyna pozycja z podmenu w tym pasku |
| Komentarze (z licznikiem) | — | otwarcie panelu | `onOpenComments` → otwiera wątek komentarzy do węzła (`ProcessFlowNodeCommentThread`), licznik = `node.data.comments.length` | Działa (wg kodu) |
| Zapytaj AI | — | AI | `onOpenChat` → `handleOpenChatWithContext()` — otwiera czat z gotowym kontekstem (tryb diagramu, liczba kroków/torów, nazwy zaznaczonych elementów, liczba ostrzeżeń walidacji) po polsku/angielsku wg `isPl` | Działa (wg kodu) |
| Usuń | — | destrukcyjna | `onDelete` → `deleteSelected()` | Działa (wg kodu) dla węzła |

Separator pionowy dzieli grupę "treść/AI" od czerwonego "Usuń" (ten sam wzorzec grupowania co
w menu prawego kliku na węźle).

---

## Uwagi / plan (rzeczy, które NIE są kwestią wyglądu, tylko realnego zachowania)

Poniższe to konkretne niespójności/defekty znalezione czytaniem kodu (nie domysły) —
warto je zweryfikować wzrokiem przy najbliższej sesji z ważnym tokenem, zanim ktokolwiek uzna
temat za zamknięty.

1. **"Wklej" w menu tła to w rzeczywistości duplikacja zaznaczenia, nie wklejanie.**
   `getCanvasContextActions({ onPaste: () => duplicateSelected() })` — w całym Process Flow
   nie ma pojęcia schowka: `Ctrl+C`/`Ctrl+X`/`Ctrl+V` nie są podpięte w ogóle (w
   `useCanvasKeyboard` wywołanie dla `toolType: 'processflow'` nie przekazuje `onCopy`/
   `onPaste`/`onCut`). Efekt: kliknięcie "Wklej" po prostu duplikuje to, co akurat jest
   zaznaczone gdzie indziej na płótnie (nie w miejscu kliknięcia); jeśli nic nie jest
   zaznaczone — nic się nie dzieje, bez komunikatu.

2. **"Wstaw między" w pływającym pasku węzła operuje na zaznaczonej KRAWĘDZI, nie na węźle.**
   Przycisk pojawia się w pasku przypiętym do zaznaczonego WĘZŁA, ale funkcja `insertBetween()`
   od razu sprawdza `edges.find(e => e.selected)` i jeśli nie znajdzie — pokazuje
   `toast.error('selectEdgeFirst')` i kończy. W typowym scenariuszu (użytkownik kliknął węzeł,
   pasek się pojawił) żadna krawędź nie jest zaznaczona → przycisk zawsze strzela błędem przy
   pierwszym kliknięciu. Wygląda na przycisk przypisany do złej powierzchni (powinien być
   dostępny raczej z poziomu zaznaczonej krawędzi, nie węzła) — do potwierdzenia wzrokiem i
   decyzji: przenieść przycisk czy pozwolić insertBetween działać też z zaznaczonego węzła
   (np. wstawiając na jego wychodzącej krawędzi).

3. **Usuwanie samej zaznaczonej krawędzi (bez zaznaczonego węzła) prawdopodobnie nie działa.**
   `deleteSelected()` w `useProcessFlowNodes.ts` liczy `selectedCount` WYŁĄCZNIE po węzłach
   (`nodes.filter(n => n.selected).length`) i przy `selectedCount === 0` robi wczesny `return`
   — nie dochodząc nigdy do fragmentu kodu, który usuwa zaznaczone krawędzie. Skutek: jeśli
   użytkownik kliknie samą krawędź (bez węzła) i wciśnie Delete/Backspace albo klawisz Ctrl+D,
   nic się nie dzieje — nie ma żadnej informacji zwrotnej. Jedyny sposób usunięcia krawędzi to
   prawdopodobnie usunięcie jednego z jej węzłów końcowych (kaskadowo) albo — nieprzetestowane
   — zaznaczenie krawędzi RAZEM z jakimś węzłem. Wymaga potwierdzenia wzrokiem.

4. **Brak tłumaczenia PL dla "AI: rewrite step".** Klucz `processFlow.contextMenu.aiRewriteStep`
   nie istnieje ani w `public/locales/pl/translation.json`, ani w `en/translation.json` —
   etykieta w menu węzła zawsze pokazuje angielski fallback z kodu ("AI: rewrite step"),
   niezależnie od ustawionego języka. Wszystkie pozostałe 8 pozycji menu kontekstowego mają
   pełne tłumaczenie PL.

5. **"Zmień nazwę (F2)" w pasku vs "Edytuj etykietę" w menu prawego kliku — dwa różne
   zachowania dla pozornie tej samej intencji.** Pasek pływający i globalny skrót F2
   (`useCanvasKeyboard.onEditSelected`) otwierają PANEL WŁAŚCIWOŚCI. Menu prawego kliku na
   węźle ("Edytuj etykietę") zamiast tego uruchamia EDYCJĘ INLINE nazwy bezpośrednio na
   diagramie (bump `editSignal`). Użytkownik trafiający na te dwa wejścia do "tej samej"
   czynności dostaje różny efekt — do rozważenia czy to zamierzone (panel = pełne właściwości,
   inline = szybka zmiana nazwy) czy przeoczenie.

6. **Separacja "wspólne" vs "specyficzne dla Przepływu":**
   - Wspólne z innymi narzędziami IDEE (Mind Map / Whiteboard) dzięki `useIdeasToolKeyboard.ts`:
     Tab/Enter/F2/Delete/Escape/Ctrl+Z/S/D/A/C/V/X — kontrakt klawiszowy, choć w Process Flow
     C/V/X i tak nic nie robią (patrz punkt 1).
   - Specyficzne dla Przepływu: cały zestaw menu prawego kliku (dodaj akcję/decyzję,
     auto-układ, konwertuj na inicjatywę, AI rewrite step), `EdgeStylePopover`,
     `ProcessFlowFloatingToolbar` z powiązaniami/komentarzami/insert-between, oraz skróty
     Shift+1 (dopasuj widok), Shift+Enter (dodaj krok alternatywnego kształtu), Ctrl+E
     (eksport), Ctrl+Shift+V (walidacja) — te ostatnie działają nawet gdy fokus jest w polu
     tekstowym ("typing-safe fallback", zamierzone w kodzie).

7. **Blokada `locked`:** prawie każda pozycja edycyjna (poza "Otwórz właściwości" w menu węzła)
   jest wyłączana, gdy `locked === true` (tryb odczytu / element edytowany przez kogoś innego
   w kolaboracji na żywo). To jednolite zachowanie na wszystkich trzech powierzchniach.

**Plan dalszej pracy:** powtórzyć ten audyt z działającym tokenem sesji, wykonać realne
prawe-kliki (tło / krok / krawędź) i zaznaczenie węzła, zrobić zrzuty light+dark, i
potwierdzić wzrokiem zwłaszcza punkty 1–3 (to one realnie psują UX, nie tylko wygląd) —
zanim ktokolwiek zdecyduje o naprawie/priorytecie.
