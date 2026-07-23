# Menu 3 / Second Bar — narzędzie Process Flow (Consultify IDEE)

Dokument opisuje **górny pasek akcji pod identyfikacją idei** (Menu 1) dla narzędzia
**Process Flow** wewnątrz modułu „Moja Praca → Pomysły". Odbiorca: zewnętrzne AI bez
kontekstu repo — wszystkie ścieżki plików są bezwzględne względem worktree
`/private/tmp/odbior-4` (kopia robocza repo Consultify, gałąź `odbior/lokalny-2026-07-23`).

Weryfikacja: **kod źródłowy (grep-first) + live render** na `http://localhost:3100`,
idea `55ad699b-44e1-4174-bdca-23e906fe3fec` ("TEST 2026-07-23 — Process Flow"),
zalogowany jako Piotr Wiśniewski (token z `/tmp/tok.txt`), tryb PL, dev server lokalny
(branch `odbior/lokalny-2026-07-23`, sha `2abb4820cc`).

## Ważne zastrzeżenie architektoniczne — DWA stosy pasków, nie jeden

To, co użytkownik widzi jako "górny pasek pod Menu 1", to w rzeczywistości **dwa
oddzielne, ułożone jeden pod drugim komponenty**, budowane przez różny kod:

1. **Menu 3 powłoki (shell-level second bar)** — komponent
   `src/components/MyWork/IdeaCanvasSecondBar.tsx`, zasilany deskryptorami z
   `src/components/MyWork/ideaCanvasMelsChips.ts` (funkcja `buildIdeaMenu3Actions`).
   To jest **wspólny** pasek dla wszystkich 4 narzędzi canvas (Mind Map / Process Flow /
   Tabela / Whiteboard) — dla Process Flow renderuje: **Dodaj kształt · Auto-układ ·
   AI rozwiń · Szablony** (lewy klaster) + **Eksport · Utwórz z mapy** (prawy klaster,
   wyrównany do prawej przez `ml-auto`). To odpowiada punktowi 5 zlecenia.
2. **Wewnętrzny pasek narzędzia Process Flow** — komponent
   `src/components/MyWork/processflow/ProcessFlowToolbar.tsx` (666 linii), renderowany
   przez `src/components/MyWork/IdeaProcessFlowTool.tsx` jako część własnego "canvasu"
   narzędzia (czyli POD paskiem z punktu 1). Zawiera: zakładki trybu, wskaźniki
   Kroki/Lanes/Warnings, przyciski wstawiania (Start/Koniec/Akcja/Decyzja/Lane/Wstaw/
   Rozdziel), Cofnij/Ponów i "Więcej". To odpowiada punktom 1–4 zlecenia.

Ten podział wynika z migracji **EditorShell Wave W-1** ("mels canvas shell",
flaga `src/utils/melsCanvasFlag.ts`, klucz `ff.mels_canvas` / `VITE_MELS_CANVAS` /
`?ff_melsCanvas=`). **Domyślnie flaga jest ON od nocy 2026-07-22** (Piotr zaakceptował
nowy szkielet Menu 1/Menu 3 na wszystkich 4 canvasach) — czyli to, co opisano wyżej,
jest **aktualnym stanem domyślnym na żywym demie/dev**, nie wariantem eksperymentalnym.
Stary układ (bez Menu 3 powłoki, tylko wewnętrzny pasek narzędzia na pełną szerokość)
jest nadal osiągalny przez `?ff_melsCanvas=0` jako "furtka ewakuacyjna", ale to już nie
jest ścieżka domyślna.

Oba paski współistnieją — komponent z punktu 2 (`ProcessFlowToolbar`) NIE zniknął po
włączeniu MELS, jedynie chowa własny przycisk „Zapisz" (bo Menu 1 przejęło wskaźnik
zapisu — prop `hideSaveIndicator={melsCanvasEnabled}`).

Pliki-kotwice:
- `src/components/MyWork/IdeaCanvasSecondBar.tsx` (71 linii) — layout paska powłoki.
- `src/components/MyWork/ideaCanvasMelsChips.ts` (335 linii) — treść/etykiety/handlery paska powłoki (`buildIdeaMenu3Actions`, linie 223–297).
- `src/components/MyWork/processflow/ProcessFlowToolbar.tsx` (666 linii) — wewnętrzny pasek narzędzia.
- `src/components/MyWork/IdeaProcessFlowTool.tsx` (3393 linii) — logika akcji (addLane, insertBetween, splitPath, runValidation, handleAutoLayout, undo/redo) + miejsce montażu toolbara (linie ~2330–2380, ~3610–3650).
- `src/components/MyWork/IdeaMapWorkspace.tsx` (linie 2780–3330) — spinacz: flaga `melsCanvasEnabled`, budowa `melsMenu3Actions`, montaż `IdeaCanvasMelsView`.
- `src/utils/melsCanvasFlag.ts` — definicja i domyślna wartość flagi (ON od 2026-07-22).
- `public/locales/pl/translation.json`, klucz `processFlow.toolbar.*` — etykiety PL wewnętrznego paska.

---

## 1. Pasek powłoki — Menu 3 (shell second bar)

Renderowany tylko gdy canvas ma jakąkolwiek zawartość dla lewego klastra "Dodaj" itp.;
tu opisane działanie specyficzne dla `tool === 'process_flow'`.

| Element | Etykieta PL | Co robi (kod) | Po co | Stan (żywa weryfikacja) |
|---|---|---|---|---|
| Lewy klaster — Dodaj | **Dodaj kształt** | `onClick` dispatchuje `handleQuickAction('add_node')` → zdarzenie globalne `idea-workspace-quick-action` z `detail.action = 'add_node'` | Szybkie dodanie kroku bez sięgania do dolnego paska narzędzia | **MARTWE.** `useProcessFlowQuickActions` (plik `useProcessFlowQuickActions.ts`) nasłuchuje wyłącznie akcji z prefiksem `pf_*` (`pf_add_action`, `pf_add_step`, …) — string `'add_node'` nie jest obsługiwany przez żaden `if`. Klik na żywo (localhost:3100): licznik „Kroki 11" nie zmienił się, brak toastu, brak nowego węzła na canvasie. |
| Lewy klaster | **Auto-układ** | `onClick` dispatchuje custom event **`idea-mindmap-node-quick-action`** (detail `{action:'pane_auto_layout'}`) — nazwa zdarzenia właściwa dla Mind Mapy | Automatyczne rozłożenie diagramu | **MARTWE dla Process Flow.** Process Flow nasłuchuje `idea-workspace-quick-action`, nie `idea-mindmap-node-quick-action` — zdarzenie trafia w próżnię. Klik na żywo: brak toastu „Auto-layout applied", węzły nie zmieniły pozycji. (Realny auto-layout dla Process Flow istnieje, ale jest dostępny wyłącznie z wewnętrznego „Więcej" → „Auto układ", patrz sekcja 3.) |
| Lewy klaster | **AI rozwiń** | `onClick` → `handleQuickAction('mm_ai_expand')` | AI ma dopisać/rozwinąć proces | **MARTWE dla Process Flow.** `mm_ai_expand` jest obsługiwane tylko przez hook Mind Mapy (`useMindMapQuickActions.ts`, linia 761). `useProcessFlowQuickActions` go nie zna. Klik na żywo: brak reakcji, brak spinnera, brak nowych węzłów. |
| Lewy klaster | **Szablony** | `onClick` → `setTemplateGalleryOpen(true)` | Szybki start z gotowego szkieletu procesu | **DZIAŁA.** Otwiera realny modal „Galeria szablonów" z filtrami (all/global/organization/project/private × all/process/system/org/strategy/workshop) i konkretnymi szablonami procesowymi: Pusty proces, Warsztat usprawnienia procesu, Podstawowy proces, Workflow zatwierdzania, Cykl PDCA, Order-to-Cash, Procure-to-Pay, Zarządzanie incydentami, BPMN Approval, Mapa systemów, Przekazania organizacyjne, Roadmapa strategiczna, **Value Stream Mapping (VSM)**, Roadmapa transformacji cyfrowej, Plan zmiany ADKAR. Każdy z przyciskiem „Użyj szablonu" i (część) „AI wypełni". Potwierdzone na żywo. |
| Prawy klaster | **Eksport** | `onClick` → `setExportMenuOpen(true)`, otwiera **wspólny** komponent `IdeaExportMenu` (montowany w `IdeaMapWorkspace.tsx` ~linia 3823) — to NIE jest lokalny `ExportDialog.tsx`/`useProcessFlowExport.ts` narzędzia (te są mniejsze, PNG/JSON/readback only i wyglądają na starszą/równoległą ścieżkę) | Wyeksportować diagram na zewnątrz | **DZIAŁA.** Otwarty na żywo modal pokazał: PNG (obraz), SVG (wektor), PDF, Markdown, Pakiet diagramu, Raport mapowania, Manifest share/embed, Raport, Prezentacja (deck) — oraz sekcję „Import / Interop" (wklej draw.io XML / BPMN XML / diagram package). Przycisk zablokowany (`disabled`), gdy mapa jest pusta (`hasContent`). |
| Prawy klaster | **Utwórz z mapy** | `onClick` → `handlePanelChange('tools')` — otwiera prawą szufladę (right rail) na zakładce „Konwersja" | Przekształcić diagram w inny artefakt (inicjatywę/zadania/raport) | **Prawdopodobnie działa** (kod współdzielony z `onCenterEdit`/`onEditCard`, czyli tą samą ścieżką co realne przyciski edycji karty) — **nie potwierdzone wzrokiem do końca** (otworzyliśmy panel prawy w innym miejscu sesji, nie osobno z tego konkretnego przycisku). Przycisk ma `disabled` gdy `!hasContent`. |

**Uwaga dot. dublowania:** „Eksport" istnieje RÓWNOCZEŚNIE w kebabie Menu 1 (`⋯` →
Eksport/Historia/Duplikuj/Usuń) i w Menu 3 — kod (`ideaCanvasMelsChips.ts`, komentarz
w linii 62) wprost nazywa to „real; also present on Menu 3" — zamierzone dublowanie
skrótu, nie błąd.

---

## 2. Zakładki trybów (wewnątrz paska narzędzia, pod Menu 3 powłoki)

Plik: `ProcessFlowToolbar.tsx` linie 35–76, 258–296. Jeden segmentowany przełącznik
(`role="tablist"`), zastąpił dawne dwa rzędy (komentarz w kodzie: „UI-L13: ONE
segmented mode control — was two redundant rows").

| Zakładka | Etykieta PL | Tekst prowadzący (guidance, PL) | Po co / różnica |
|---|---|---|---|
| `classic` | **Klasyczny przepływ** | „Mapuj bieżący proces, decyzje i odpowiedzialność zanim zaczniesz optymalizację." | Zwykły flowchart: Start/Koniec/Akcja/Decyzja + lane'y. Punkt wyjścia — najpierw opisz stan obecny. |
| `automation` | **Automatyzacja** | „Skup się na triggerach, integracjach i hand-offach, które można bezpiecznie automatyzować." | Paleta kształtów zmienia się na: Start, Koniec, Akcja, **Trigger, API, Warunek automatyzacji** (`AUTOMATION_SHAPES`). Do oznaczania kandydatów pod RPA/automatyzację. |
| `vsm` | **Strumień wartości** | „Pokaż przepływ end-to-end, zapasy i czas oczekiwania, aby ujawnić bottlenecki." | Paleta zmienia się na klasyczne bloki **Value Stream Mapping** (lean): Proces, Zapas/Inventory, Dostawca, Klient, Kaizen, strzałki push/pull, supermarket, FIFO (`VSM_SHAPES`, 9 kształtów). Walidacja dokłada reguły VSM-specyficzne (patrz sekcja 4). |

Każda zakładka ma tooltip = `Etykieta — opis` (potwierdzone w drzewie dostępności na
żywo, np. `tab "Klasyczny przepływ — Mapuj bieżący proces, decyzje i odpowiedzialność
zanim zaczniesz optymalizację."`).

Dodatkowo istnieją 3 **wyspecjalizowane "kity" notacyjne** (`semanticKit`: `bpmn` /
`system` / `org`), ustawiane WYŁĄCZNIE z czatu (komendy `pf_semantic_bpmn` itd. w
`useProcessFlowQuickActions.ts`) — nie mają własnej zakładki w UI, tylko chip z etykietą
(„Notacja BPMN" / „Mapa systemowa" / „Organizacja / RACI") obok zakładek, gdy aktywne.
Zmieniają paletę kształtów i reguły walidacji, ale nie są "czwartym trybem" klikalnym
w toolbarze.

---

## 3. Przyciski wstawiania (wewnętrzny pasek, pod zakładkami trybu)

| Przycisk | Etykieta PL | Co wstawia / robi | Po co | Stan |
|---|---|---|---|---|
| Paleta kształtów (dynamiczna) | **Start / Koniec / Akcja / Decyzja** (dla trybu klasycznego) | `addNode(shape)` w `IdeaProcessFlowTool.tsx` — dodaje węzeł typu `flowNode` z danym `shape` na canvas | Budowa diagramu krok po kroku | Działa (potwierdzone: kod ma pełną implementację `addNode`, wywoływane też z czatu przez `pf_add_start` itd.) |
| — | **+ Lane** | `addLane()` (linia ~1641) — dodaje nowy tor/lane (`Lane {n+1}`, kolor z palety `LANE_COLORS`) | Reprezentacja odpowiedzialności/działu jako osobny "tor pływacki" | Działa. Na żywym obiekcie widoczne 4 lane'y: „Produkcja", „Utrzymanie ruchu", „System AI", „Lane 4" (ostatni — nazwa domyślna, nieprzenazwany). |
| — | **+ Wstaw** (Wstaw krok między) | `insertBetween()` (linia ~1508) — wymaga **zaznaczonej krawędzi** (edge); wstawia nowy węzeł na środku, przecina starą krawędź na dwie | Dopisanie brakującego kroku bez przerysowywania całego diagramu | Działa, ale **warunkowo**: bez zaznaczonej krawędzi pokazuje `toast.error` „Zaznacz najpierw krawędź" (klucz `myWorkIdeas.processFlowTool.selectEdgeFirst`) — czyli wymaga wcześniejszej akcji użytkownika, sam w sobie nie jest samowystarczalny. |
| — | **Rozdziel** (Rozdziel ścieżkę) | `splitPath()` (linia ~1585) — wymaga zaznaczonego węzła typu **Decyzja**; dodaje równoległą gałąź "No" | Dodanie alternatywnej ścieżki z węzła decyzyjnego | Działa, warunkowo: bez zaznaczonego węzła decyzyjnego → `toast.error` „Zaznacz najpierw węzeł decyzji". |

Wszystkie 3 akcje (`addLane`, `insertBetween`, `splitPath`) wołają `pushUndo()` przed
zmianą — czyli są objęte historią cofania — oraz `collab.broadcastOps`/`broadcastLanes`
(replikacja do współpracowników w czasie rzeczywistym, gdy sesja jest wielo-userowa).

---

## 4. Undo / Redo · „… Więcej"

### Cofnij / Ponów
Plik: `useProcessFlowUndoRedo.ts` (100 linii). Stos **lokalny, w pamięci przeglądarki**
(nie w bazie), max **30 kroków** (`MAX_UNDO_STEPS`), głęboka kopia JSON (`nodes`,
`edges`, `lanes`). Każda operacja edycyjna wywołuje `pushUndo()` przed zmianą, co
czyści stos redo. **Nie przetrwa odświeżenia strony** (żyje tylko w stanie komponentu
React tej sesji przeglądarki).

### „… Więcej" (dropdown przepełnienia)
Przycisk `Więcej akcji` (`aria-haspopup="menu"`) — plik `ProcessFlowToolbar.tsx`, linie
440–657. Rozwinięta zawartość (potwierdzone live, drzewo dostępności):

**Sekcja „Analiza i walidacja":**
| Pozycja | Co robi | Stan |
|---|---|---|
| **KPI** | Przełącza panel `ProcessFlowHealthScore`/KPI dashboard (`setShowKPIDashboard`) | Działa (toggle widoczny, podświetla się gdy aktywny) |
| **Waliduj** | `runValidation()` → liczy `validateFlowWarnings(nodes, edges, semanticKit)` (plik `validateFlow.ts`) i pokazuje wynik | Działa — patrz uwaga niżej o wskaźniku „Brak ostrzeżeń" |
| **AI Coach** | `runProcessCoach()` — realne wywołanie AI (pipeline `process_coach`), analiza wąskich gardeł/optymalizacji | Działa (backend AI, nie stub — komentarz w kodzie potwierdza „real `process_coach` AI pipeline") |
| **Podsumuj** | `generateSummary()` — generuje podsumowanie tekstowe procesu | Działa |
| **Odczyt** | Otwiera `ReadbackPanel` — czytelne, języko-podobne odczytanie diagramu (przydatne do audytu/QA) | Działa (warunek: `onOpenReadback` przekazane) |
| **Propozycja AI** | Otwiera `AIProposalPanel` — realny backend `POST /api/my-work/my-ideas/:id/ai-generate` | Działa. Uwaga: cała funkcja ma kill-switch `AI_PROPOSAL_ENABLED` w kodzie (obecnie `true`) — awaryjne wyłączenie bez ruszania okablowania. |

**Sekcja „Zarządzanie canvasem":**
| Pozycja | Co robi | Stan |
|---|---|---|
| **Auto układ** | `handleAutoLayout()` — TU jest prawdziwy, działający auto-layout dla Process Flow (w przeciwieństwie do martwego przycisku „Auto-układ" na pasku powłoki, sekcja 1) | Działa — daje `toast.success` „Auto-layout applied", przelicza pozycje przez `autoLayout(nodes, edges, lanes)`, replikuje do współpracowników (`collab.broadcastSnapshot`) |
| **Duplikuj (Ctrl+D)** | `duplicateSelected()` | Działa, ma też skrót klawiszowy |
| **Usuń zaznaczone** | `deleteSelected()`, stylizowane na czerwono (destrukcyjne) | Działa |

**Sekcja „Zapytaj AI o ten proces"** (jeśli `onOpenChat` przekazane) — otwiera czat z
kontekstem procesu (liczbą kroków/lane'ów/ostrzeżeń wstrzykniętą do promptu).

**Sekcja „Convert"** (Inicjatywa/Zadania/Raport/Analiza) — w kodzie istnieje
(`onConvert` prop, linie 616–656), ale **nie pojawiła się w live dropdownie** — bo
w trybie MELS funkcję konwersji przejął przycisk „Konwertuj" w Menu 1 (`IdeaConvertMenu`,
`primaryActionSlot`), więc `onConvert` prawdopodobnie nie jest przekazywane w tej
konfiguracji. Traktować jako **martwe/nieaktywne w bieżącym trybie renderowania**
(kod istnieje, ale ścieżka wywołania wygląda na wyparte przez nowszy mechanizm).

---

## 5. Wskaźniki po prawej: „Kroki N · Lanes N · Brak ostrzeżeń/Ostrzeżenia N"

Plik: `ProcessFlowToolbar.tsx` linie 298–320; źródło liczb: `IdeaProcessFlowTool.tsx`
linie ~2370–2371.

| Wskaźnik | Skąd liczba | Uwaga |
|---|---|---|
| **Kroki {N}** | `nodes.length` — **wszystkie** węzły na canvasie (nie tylko "prawdziwe", połączone kroki) | Na testowym obiekcie: „Kroki 11", ale tylko **9 nazwanych, sensownych węzłów** (Start zmiany, Maszyna pracuje, Zbiórka telemetrii, Model ocenia ryzyko awarii, Ryzyko>70%?, Alert do utrzymania ruchu, Przegląd prewencyjny, Kontynuuj monitoring, Koniec cyklu). Pozostałe 2 to **węzły-widma bez treści**, dosłownie podpisane „Decision" i „Action" (angielskie etykiety domyślne, niepowiązane strzałkami z resztą diagramu) — prawdopodobnie relikt po wcześniejszym teście/drag. Licznik „Kroki" **nie odróżnia** kompletnego kroku od takiego martwego/osieroconego węzła. |
| **Lanes {N}** | `lanes.length` | Na testowym obiekcie: 4 — „Produkcja", „Utrzymanie ruchu", „System AI", „Lane 4" (ten ostatni nieprzenazwany, nazwa domyślna). Etykieta w UI celowo zostaje po angielsku „Lanes" nawet w PL (komentarz w kodzie: „term kept in EN intentionally in the original code"). |
| **Brak ostrzeżeń / Ostrzeżenia {N}** | Stan `warnings` (React state), **NIE przeliczany automatycznie**. Startuje pusty (`useState([])`) i zmienia się **tylko** gdy użytkownik ręcznie kliknie „Waliduj" (More → Waliduj → `runValidation()`) | **Ważna pułapka interpretacyjna**: napis „Brak ostrzeżeń" na start/po wejściu na ekran **nie oznacza „sprawdziliśmy i jest OK"** — oznacza raczej „jeszcze nikt nie klikał Waliduj w tej sesji" (stan początkowy = pusta lista = wygląda identycznie jak "wszystko czyste"). Reguły walidacji (plik `validateFlow.ts`): brak Start/Koniec, węzeł decyzyjny z <2 wyjściami, węzły bez wejścia/wyjścia ("dangling"), reguły specyficzne dla BPMN/system/org/VSM (np. VSM wymaga węzła Dostawca, Klient, Proces, a proces — Czasu Cyklu). |

---

## Uwagi / plan

1. **Trzy martwe kliknięcia na pasku powłoki dla Process Flow** — potwierdzone na
   żywo (kliknięto, brak jakiejkolwiek reakcji UI): **Dodaj kształt**, **Auto-układ**,
   **AI rozwiń**. Przyczyna: pasek powłoki (`ideaCanvasMelsChips.ts`) używa
   generycznych/mind-mapowych nazw akcji (`add_node`, `pane_auto_layout` przez zły
   kanał zdarzeń, `mm_ai_expand`), a hook Process Flow (`useProcessFlowQuickActions.ts`)
   rozumie tylko akcje z prefiksem `pf_*`. Realne odpowiedniki tych trzech funkcji
   **istnieją i działają** — ale tylko przez inne wejścia: paleta kształtów i „Więcej →
   Auto układ" na wewnętrznym pasku (sekcje 2–4 tego dokumentu), oraz komendy czatu
   (`pf_add_*`, `pf_analyze`). To jest lukratywny, tani fix (dopisać `add_node`/
   `pane_auto_layout`/`mm_ai_expand` jako aliasy w `useProcessFlowQuickActions.ts`, albo
   zmienić nazwy akcji budowane w `buildIdeaMenu3Actions` dla `tool === 'process_flow'`).
2. **Sekcja „Convert" w dropdownie „Więcej"** ma gotowy kod (`onConvert` prop w
   `ProcessFlowToolbar.tsx`), ale nie zaobserwowano jej live — prawdopodobnie
   `onConvert` nie jest już przekazywane w trybie MELS (funkcję przejął przycisk
   „Konwertuj" w Menu 1). Do potwierdzenia grepem wywołania `<ProcessFlowToolbar` w
   `IdeaProcessFlowTool.tsx` czy prop `onConvert` w ogóle dociera z góry w trybie MELS.
3. **Wskaźnik „Brak ostrzeżeń" nie jest live/ciągły** — to częsta pułapka UX: użytkownik
   może przeczytać zielony badge jako "system sprawdził, wszystko OK", podczas gdy w
   rzeczywistości oznacza "nikt jeszcze nie kliknął Waliduj". Wart rozważenia: albo
   automatyczne przeliczanie przy każdej zmianie grafu (debounce), albo zmiana napisu
   początkowego na neutralny ("Niesprawdzone") zamiast zielonego "Brak ostrzeżeń".
4. **Licznik „Kroki" liczy też węzły-widma** (osierocone, bez treści, bez połączeń) —
   na testowym obiekcie dwa takie węzły („Decision", „Action") zawyżają licznik z 9 do
   11 i nie są uwzględniane w żadnym ostrzeżeniu walidacji jako "błąd" (chyba że mają
   zerowe połączenia — wtedy powinny wpaść w regułę `dangling`/`no-exit`, ale to nie
   zostało odrębnie zweryfikowane klikiem „Waliduj" na tym konkretnym obiekcie, żeby
   nie modyfikować danych testowych innych zadań w tym samym środowisku dev-render).
5. **Nie zmodyfikowano żadnych danych** na obiekcie testowym — wszystkie kliknięcia
   weryfikacyjne (Dodaj kształt / Auto-układ / AI rozwiń / Szablony / Eksport) były
   albo bez efektu (martwe), albo otwierały modal bez zapisu (Szablony, Eksport) i
   modale zostały zamknięte bez wyboru żadnej akcji zapisującej.
