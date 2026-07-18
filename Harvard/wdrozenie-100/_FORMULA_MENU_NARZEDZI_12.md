# FORMUŁA MENU + PRZYCISKÓW — 12 narzędzi Consultify (SSOT standaryzacji)

> **Cel:** jeden dokument, który dla KAŻDEGO narzędzia mówi dokładnie **co jest w którym menu i jakie przyciski/funkcje MAJĄ tam być**. To jest wzorzec docelowy (prescriptive), nie opis stanu.
> **Następny krok (osobny):** kolumna **Stan** wypełniana per przycisk — `✅ JEST` / `🔨 DOROBIĆ` / `❓ DECYZJA` — po czym standaryzujemy (jeden przycisk = jedno miejsce, wszędzie).
> **Kanon źródłowy:** `ARTIFACT_ANATOMY_STANDARD.md` §5 (menu per archetyp) · §6 (alfabet elementów + kebab §6.4) · §13 (instancjacja). Ten plik = instancjacja per-narzędzie tamtego standardu.

---

## 0. INWENTARZ — 12 narzędzi (szybkie liczenie: 5 + 4 + 3 = 12)

| # | Grupa | Narzędzie | Archetyp | Klasa | Centrum ekranu |
|---|-------|-----------|:---:|:---:|----------------|
| 1 | My Work / Ideas | **Mind Map** | A Canvas | L | płótno węzłów |
| 2 | My Work / Ideas | **Process Flow** | A Canvas | L | płótno kroków |
| 3 | My Work / Ideas | **Whiteboard** | A Canvas | L | płótno swobodne |
| 4 | My Work / Ideas | **Idea Table** | D Matryca | L | siatka (canvas-tabela) |
| 5 | My Work | **Notatnik** | B Dokument | S/L | tekst ciągły |
| 6 | Karty N | **Insight** | C Rekord | S | sekcje pól |
| 7 | Karty N | **Initiative** | C Rekord | L | ~10 ekranów wewn. |
| 8 | Karty N | **Task** | C Rekord | S | sekcje pól |
| 9 | Karty N | **Decision** | C Rekord | S | sekcje pól (opcje) |
| 10 | Generatory | **Word / Dokument** | B Dokument | L | tekst ciągły |
| 11 | Generatory | **Excel / Sheet** | D Matryca | L | siatka komórek |
| 12 | Generatory | **PowerPoint / Deck** | E Deck | L | slajdy |

Archetypy: **A Canvas · B Dokument · C Rekord · D Matryca · E Deck**. Klasa **S** = jeden widok (panel/modal, bez M2/M3). **L** = wiele widoków wewn. (M2+M3 aktywne).

---

## 1. FORMUŁA — wspólna powłoka (6 stref, identyczna dla wszystkich; różni się TYLKO centrum)

Każde narzędzie = ta sama powłoka. Standaryzujemy 6 stref:

| Strefa | Kod | Co tu mieszka | Reguła nienaruszalna |
|--------|-----|---------------|----------------------|
| Menu 1 artefaktu | **M1** | ← powrót · ikona-typ + tytuł (edyt. inline) · status lifecycle · stan zapisu · [indeks] · **1× PRIMARY** | Tylko tożsamość + JEDEN primary (neutralny, nie crimson). Nic więcej. |
| Menu 2 artefaktu | **M2** | listwa formatowania (B I U, nagłówki, listy) | TYLKO archetyp B (Dokument). Canvas/Rekord/Matryca/Deck = brak. |
| Menu 3 artefaktu | **M3** | chipy akcji bieżącego widoku + kontrolki (filtr/sort/zoom) + **AI (prawa)** | Slot AI ZAWSZE prawa strona. Klasa S = brak M3. |
| Lewy rail | **RAIL** | narzędzia-CZASOWNIKI (dodaj węzeł, rysuj, sticky) | Znika całkowicie gdy pusty. Głównie archetyp A/E. |
| Prawy panel | **PANEL** | accordion: **Akcje 2rz. · Właściwości · Powiązania · Komentarze · Historia/AI** | Stała kolejność sekcji. Zostaje zawsze. `ArtifactRightPanel`. |
| Prawy klik / kebab | **PPM** | lustro architektury przycisków, przefiltrowane | Stała kolejność §6.4 (niżej). |

**Alfabet elementów (§6 — jedna ikona = jedno znaczenie, wszędzie):** Otwórz `maximize-2` · Podgląd `eye` · Edytuj `pencil` · Zmień nazwę `text-cursor` · Powiel `copy` · Przenieś `folder-input` · Eksport `download` · Udostępnij `share-2` · Kopiuj link `link` · Komentarz `message-square` · Historia `history` · AI `sparkles` · Archiwizuj `archive` · Usuń `trash-2`(danger).

**Kebab / PPM — stała kolejność (§6.4, nienaruszalna):**
`1. Otwórz · Podgląd │ 2. Edytuj · Zmień nazwę · Powiel │ 3. Eksport ▸ · Udostępnij · Kopiuj link · Przenieś ▸ │ 4. AI: uzupełnij · AI: podsumuj │ 5. Archiwizuj · Usuń(danger, koniec)`

**5 reguł przekrojowych:** (1) dokładnie 1 primary w M1; (2) slot AI zawsze prawa M3 + sekcja AI w panelu; (3) „Powiązania" first-class w KAŻDYM narzędziu (indeks linkowania); (4) tryb Read/Edit toggle dla B i C; (5) stany empty/loading/error zaprojektowane per narzędzie („co zrobić by zacząć", nie „No data").

Legenda kolumny **Stan** (wypełniamy w kroku 2): `✅ JEST` · `🔨 DOROBIĆ` · `❓ DECYZJA` · `⬜ do zestawienia`.

---

## 2. GRUPA MY WORK / IDEAS (5) — archetyp A Canvas + D Matryca + B Dokument

### 1 · Mind Map (A Canvas · L)

> **DIFF 07-18 (J12, weryfikacja `src/components/MyWork/IdeaMapWorkspace.tsx` 3645 l. + `mindmap/*`):**
> Wszystkie 4 canvasy Ideas (Mind Map / Process Flow / Whiteboard / Idea Table) żyją w JEDNYM hoście
> `IdeaMapWorkspace` z DWIEMA powłokami: legacy floating-chrome (DEFAULT) vs MELS `IdeaCanvasMelsView`
> (adapter `EditorShell`/`ExecutiveModuleShell`, `centerMode='canvas'`) za flagą `ff.mels_canvas`
> **default OFF** (`src/utils/melsCanvasFlag.ts:27-28` — czeka na odbiór wzorca Mind Map przez Piotra).
> Diagnoza niżej dotyczy Mind Map; strefy wspólne (RAIL/PANEL/PPM) dzielone z №2-4.

| Strefa | Przyciski / funkcje | Stan |
|--------|---------------------|:---:|
| **M1** | MELS: tytuł + ← powrót (`IdeaMapWorkspace.tsx:3019` `onBack→/my-work`) + chipy `group:'primary'`: Dodaj · Auto-układ · **Konwertuj** · Dyskutuj (`ideaCanvasMelsChips.ts:133-173`) — Konwertuj JEST, ale primary są 4 (nie 1×PRIMARY) i całość za flagą OFF. Legacy (default): BRAK formalnego M1 — tylko pływający breadcrumb drill-down (`IdeaMapWorkspace.tsx:3070`); brak statusu lifecycle i wskaźnika zapisu w obu | 🔨 |
| **M2** | — (canvas, zgodnie z formułą) | ✅ |
| **M3** | zoom/dopasuj = `CanvasZoomControls` wewnątrz canvasa (kontekst ReactFlow, nie M3) · minimap toggle ✅ · układ auto ✅ (`RadialTreeLayout`/`ForceDirectedLayout`/`StructureLayouts.ts` + chip `canvas-auto-layout`) · **AI NIE po prawej M3** — żyje w lewym railu (`AIActionsPopover`) i chipie overflow `canvas-ai-expand` (`ideaCanvasMelsChips.ts:183`) | 🔨 |
| **RAIL** | ✅ **bogatszy niż formuła** — `mindmap/CanvasLeftToolbar.tsx`: select/hand · dodaj węzeł (`AddNodePopover`) · połącz · tekst · sticky · kształty · pen · frame · upload · komentarz · AI popover · szablony · import/eksport · undo/redo | ✅ |
| **PANEL** | `IdeaRightPanel` = accordion na `ArtifactRightPanel` (`IdeaMapWorkspace.tsx:3434-3446`), ale sekcje wg decyzji **D16/D17**: Właściwości · Kontekst · **Teresa** (+ Źródła/dowody gdy evidence) — `IdeaRightPanel.tsx:76-118`. NIE kanoniczne 5 (brak sekcji Akcje/Komentarze/Historia; eksport w railu/chipach, komentarze przy węzłach `NodeCommentThread`, historia w `SnapshotHistory`/`ActivityFeed`) | ❓ DECYZJA (D16 zatwierdzona — rozjazd świadomy) |
| **PPM płótno** | ✅ `mindmap/PaneContextMenu.tsx:74-154`: dodaj węzeł · kopiuj/wytnij/wklej · zaznacz wszystko · dopasuj · auto-układ · auto-cluster · zwiń/rozwiń · AI suggest | ✅ |
| **PPM węzeł** | ✅ **ponad formułę** — `mindmap/NodeContextMenu.tsx:125-309`: edytuj · otwórz szczegół · dodaj dziecko/rodzeństwo · powiel · kopiuj/wytnij/wklej · zwiń · fokus · drill-down · połącz · AI (rozbuduj/pogłęb/what-if/streść gałąź) · **konwertuj → inicjatywa/decyzja/taski** · usuń; osobne `EdgeContextMenu` + `FloatingNodeToolbar`. Kolejność ≠ §6.4 | ✅ (kolejność 🔨) |

**Ocena:** silnik i PPM klasy Miro-plus (AI overlays, 3D, prezentacja, kolaboracja), RAIL komplet. Realne gapy: brak M1-identity w default-powłoce (MELS OFF czeka na odbiór), AI nie w prawej M3, panel = D16 (3 sekcje zamiast 5 — zatwierdzone). Droga do ✅ = flip `ff.mels_canvas` po odbiorze zrzutów + ewentualne 1×PRIMARY zamiast 4 chipów.

### 2 · Process Flow (A Canvas · L)
| Strefa | Przyciski / funkcje | Stan |
|--------|---------------------|:---:|
| **M1** | jak Mind Map (wspólny host `IdeaMapWorkspace` + te same chipy MELS z `pf_convert_initiative` mapowanym na konwersję, `IdeaMapWorkspace.tsx:886`) — brak M1-identity w legacy default, MELS OFF | 🔨 |
| **M2** | — (zgodnie z formułą) | ✅ |
| **M3** | `IdeaProcessFlowTool.tsx` (3281 l., „Swimlane-based process flow editor built on React Flow" l.4): MiniMap toggle ✅ (l.378) · zoom/dopasuj ✅ (`CanvasZoomControls` l.66, `fitView` l.2017) — wewnątrz canvasa, nie jako chipy M3 · orientacja poziom/pion — NIE znaleziona · AI nie po prawej (jak №1) | 🔨 |
| **RAIL** | ✅ wspólny `CanvasLeftToolbar` — ma krok, decyzję (ikona `Diamond`), połącz, tekst, komentarz; swimlane ✅ (`processflow/LaneSystem`, `IdeaProcessFlowTool.tsx:259`) | ✅ |
| **PANEL** | jak Mind Map — `IdeaRightPanel` D16 (Właściwości/Kontekst/Teresa), nie kanoniczne 5 | ❓ DECYZJA (D16) |
| **PPM płótno / krok** | ✅ własny `PaneContextMenu`/`CanvasContextMenu` w `IdeaProcessFlowTool.tsx` (grep `ContextMenu` trafia) + `IdeaCanvasContextMenu.tsx`; „Zmień typ kroku ▸" nie zweryfikowany jako pozycja menu — do potwierdzenia wzrokiem | ✅ częściowo |

**Ocena:** ta sama architektura co Mind Map (wspólny host, wspólne gapy M1/M3-AI/panel-D16). Specyfika flow (lanes, romb decyzji, minimapa) JEST w silniku. Brakuje drobnic formuły: orientacja poziom/pion, jawne „Zmień typ kroku" w PPM — weryfikacja wzrokiem przy odbiorze fali A2.

### 3 · Whiteboard (A Canvas · L)
| Strefa | Przyciski / funkcje | Stan |
|--------|---------------------|:---:|
| **M1** | jak Mind Map (wspólny host; konwersja mapowana `wb_convert_initiative`, `IdeaMapWorkspace.tsx:881`) — brak M1-identity w legacy default, MELS OFF | 🔨 |
| **M2** | — (zgodnie z formułą) | ✅ |
| **M3** | zoom/dopasuj/minimapa jak №1 (wewnątrz canvasa) · **AI: uporządkuj** ✅ odpowiednik = `pane_auto_cluster` (PPM) + `mindmap/AIAutoClustering.tsx` · streść ✅ `ctx_summarize_branch`/`BranchSummaryPanel` · facylitacja whiteboardu JEST w silniku (`whiteboardFacilitation`, `IdeaMapWorkspace.tsx:324`) — ale nic z tego nie siedzi jako chip AI po prawej M3 | 🔨 |
| **RAIL** | ✅ wspólny `CanvasLeftToolbar`: select · sticky (`StickyNote`) · kształty (`Square`/`Diamond`) · rysuj (`Pen`) · tekst (`Type`) · upload (`Upload`) · frame (`Frame`) · połącz · komentarz — komplet formuły | ✅ |
| **PANEL** | jak Mind Map — `IdeaRightPanel` D16, nie kanoniczne 5 | ❓ DECYZJA (D16) |
| **PPM płótno / element** | ✅ `IdeaWhiteboardTool.tsx` ma własny context-menu (grep `ContextMenu` trafia) + wspólne `PaneContextMenu`/`NodeContextMenu` (powiel/kolor/usuń JEST); „Warstwa na wierzch/spód" — nie znaleziona jako pozycja menu | ✅ częściowo |

**Ocena:** narzędziowo (RAIL) komplet Miro-formuły; gapy identyczne z resztą grupy A: M1-identity za flagą OFF, AI-slot nie w prawej M3, panel = D16. Specyficzny brak: kontrola warstw (z-order) w PPM. Odbiór razem z falą A2 (flip `ff.mels_canvas` + zrzuty).

### 4 · Idea Table (D Matryca · L — canvas-tabela hybryda)

> **DIFF 07-18 (J12, `src/components/MyWork/IdeaTableTool.tsx` 3819 l. + katalog `table/` ~80 plików):**
> Idea Table to najgłębszy silnik grupy My Work — pełna platforma Airtable-klasy (typy kolumn przez
> `PropertyRegistry`, formuły `FormulaEngineV2`, widoki grid/kanban/kalendarz/oś/macierz przez
> `ViewRouter`/`ViewSwitcher`, automations, forms, sharing, offline, provenance). Host = ten sam
> `IdeaMapWorkspace` co canvasy (powłoka MELS za tą samą flagą OFF).

| Strefa | Przyciski / funkcje | Stan |
|--------|---------------------|:---:|
| **M1** | Legacy (demo-default): 🔨 **BRAK formalnego M1** — narzędzie żyje jako karta tab-stripu `MyWorkHub` (ikona+nazwa+status-dot+X, `MyWorkHub.tsx:2402-2432`), bez ←/tytuł-inline/zapis/PRIMARY. Za flagą MELS: ← i tytuł ✅, ale **3× PRIMARY naraz** (Add row · Convert · Discuss, `ideaCanvasMelsChips.ts:130-178`) i generyczny „Convert" zamiast kontraktowego **„Generuj inicjatywy z zaznaczonych"** — realna logika selekcji JEST (`handleBulkConvert`, `IdeaTableTool.tsx:1118-1155`; pasek warunkowy przy `selectedRowIds.size>0`, l.2427-2465), tylko w innym miejscu | 🔨 / ❓ |
| **M2** | ✅ własny wewnętrzny pasek: wstaw wiersz (`_addRow`) · wstaw kolumnę (`AddColumnDialog`, l.2400) · typ kolumny ▾ bogaty (`PropertyRegistry` + `FormulaEditor` — text/select/date/currency/formula) · format — per-KOLUMNĘ (typ), nie per-komórkę | ✅ częściowo |
| **M3** | ✅ filtr (`FilterBuilder`/`FilterPanel`) · sort (nagłówek + `colContextMenu`) · grupuj (`groupBy`, l.1743-1756) · widoki tabela/kanban/grid/kalendarz (`KanbanView`, `ViewSwitcher`) · konfiguruj kolumny (`Columns3` show/hide, l.2365-2380) · AI uzupełnij/skategoryzuj ✅ (`InlineAIFill`/`BatchAIFillButton`, `AICategorizeTool`) — wszystko działa, ale w wewn. pasku narzędzia, nie w formalnej strefie M3-prawa-AI | ✅ funkcjonalnie / 🔨 lokalizacja |
| **RAIL** | formuła chce „—"; realnie `CanvasLeftToolbar` daje 5 slotów dla `table` (`TBL_CONTEXT_SLOTS`, `mindmap/CanvasLeftToolbar.tsx:231-267`: Add row·Columns·View·Filter·Dashboard) — **duplikacja M2/M3** zamiast zniknięcia | ❓ DECYZJA |
| **PANEL** | ✅ accordion `IdeaRightPanel` (D16/D17: Właściwości·Kontekst·Teresa — 3/5 sekcji kanonu), montowany domyślnie (`IdeaMapWorkspace.tsx:3444-3477`) · Szczegół rekordu ✅ (`RowDetailPanel`/`RecordExpandModal`) · Powiązania ✅ (`CrossTableRelations`, `LinkedRecordPicker`) · eksport TYLKO CSV (`exportToCSV`/`downloadCSV`) i w toolbarze, nie w sekcji Akcje; .xlsx w tym komponencie nie istnieje · komentarze per-rekord — brak (jest `ActivityFeed`/`AuditTrailPanel`) | ✅ 3/5 + ❓ D16 |
| **PPM komórka / wiersz** | trzy menu: `viewContextMenu`/`colContextMenu`/`rowContextMenu` (`IdeaTableTool.tsx:663-694`) — Edytuj ✅ · Powiel wiersz ✅ · Usuń wiersz ✅ · „Ustaw wartość ▸" BRAK · **BUG: „Dodaj notatkę" ma identyczny onClick co Edytuj** (l.3184-3208 — oba `setExpandedRecordId`) · brak osobnego menu per-komórka | 🔨 (1 bug) |

**Ocena:** silnik NAJDALEJ z grupy My Work (Airtable-klasa: formuły, 4+ widoki, automations, audit-trail, presence) — przekracza formułę. Ale powłoka realnie widziana na demo (flaga OFF) **w ogóle nie ma M1** (karta tab-stripu), wersja MELS ma 3×PRIMARY zamiast 1, RAIL dubluje toolbar, a PPM ma bug notatki. PANEL 3-sekcyjny = decyzja D16/D17 do jawnego rozstrzygnięcia względem 5-sekcyjnego kanonu. Zgodnie z decyzją 07-09 ta powłoka niesie też Excel/Sheet (№11).

### 5 · Notatnik (B Dokument · S/L)

> **DIFF 07-09 (vegas/a4-docs, weryfikacja `src/components/MyWork/NotebookContent.tsx` + `notebook/*`):**
> Realny layout = biblioteka (sidebar listy stron) + edytor, wzorzec Notion two-pane — NIE jest to jeszcze
> instancja formalnego M1-identity-header + `ArtifactRightPanel` accordion. Wiele funkcji z Formuły JEST w
> kodzie, ale rozproszone (hamburger ⋯, tabbed rail „Praca/Kontekst" zamiast accordionu w stałej kolejności).

| Strefa | Przyciski / funkcje | Stan |
|--------|---------------------|:---:|
| **M1** | ← powrót (JEST, `onBackToLibrary`) · ikona notatki + tytuł (tytuł edytowalny inline w edytorze, NIE w osobnym pasku identity) · status (brak lifecycle badge w M1 — status żyje tylko jako kropka w liście) · zapis (brak widocznego wskaźnika „Zapisano/Zapisuję" w M1; `isSavingRef` istnieje tylko wewnętrznie) · [indeks] (brak) · **PRIMARY „Udostępnij"** — 🔨 BRAK: `onShare` w `NotebookHamburgerMenu` nigdy nie jest przekazywany z `NotebookContent`, ZERO backendu share-link dla notatek (`grep` nie znalazł `createNotebookShareLink` ani odpowiednika) | 🔨 |
| **M2** | `NotebookToolbar` (B I U, nagłówki, listy) ✅ JEST · brak wyrównania/blok-kodu/cytat jako osobnych przycisków paska (dostępne przez `/` slash-menu, nie M2) | 🔨 częściowo |
| **M3** | brak toggle „tryb czytania" · brak TOC toggle (spis treści nie istnieje w kodzie) · komentarze — brak toggle, komentarze żyją gdzie indziej · **AI slot NIE jest w stałej prawej pozycji M3** — AI wywoływane przez hamburger ⋯ (`onAskAI`) i przez zakładkę „Praca" panelu bocznego (`NotebookRightRail`), nie jako chip „AI: napisz/podsumuj/popraw" | 🔨 |
| **RAIL** | brak outline/lewego railu nawet dla długich notatek (jest tylko wewnętrzny `NotebookBacklinksBar`) | 🔨 |
| **PANEL** | ✅ *treściowo bogaty*, ale NIE jako `ArtifactRightPanel` accordion w kanonicznej kolejności — to tabbed `NotebookRightRail` (zakładki „Praca"/„Kontekst") łączący `AIChatInlinePanel` (ma wbudowany `ShareSection`!) + `NotebookContextPanel`. Eksport JEST (`NotebookExportMenu`, osobny przycisk w toolbarze, nie w panelu). Wersje JEST (`NotebookVersionHistory`, toggle osobny, nie w akordeonie). Powiązania JEST częściowo (`NotebookBacklinksBar` + `NotebookAttachmentsSection`, ale poza sekcją „Powiązania" panelu). Komentarze — NIE znaleziono dedykowanej sekcji komentarzy per-strona w tym pliku. | 🔨 rozjazd struktury vs kanon |
| **PPM zaznaczenie / blok** | `NotebookBubbleToolbar` = tylko formatowanie (B/I/U/link) przy zaznaczeniu — BRAK menu „Kopiuj/Wklej · Komentarz · AI: przepisz/skróć/rozwiń · Duplikuj blok · Zmień typ ▸ · Usuń blok"; brak klasycznego PPM (prawy klik) w ogóle w edytorze | 🔨 |

**Ocena:** Notatnik ma SILNIK bogatszy niż formalna powłoka (backlinks, mentions, AI proposals, quick-capture, wersjonowanie) — ale **nie przeszedł jeszcze adopcji SPEC-A powłoki** (brak M1-identity/`ArtifactRightPanel`/PPM). To NIE jest fantom — funkcje realnie działają, tylko w innym locum niż Formuła każe. Zamiana na formalną powłokę = zadanie architektoniczne (przeniesienie `NotebookRightRail`→`ArtifactRightPanel`), NIE mechaniczne — wymaga decyzji Piotra czy warto rozbierać dojrzały tabbed-rail na accordion, i weryfikacji wzrokiem (nie zrobione w tej turze, brak dostępu do żywego podglądu).

---

## 3. GRUPA KARTY N (4) — archetyp C Rekord

> Klasa **S** (Insight/Task/Decision): prawy PANEL jest GŁÓWNYM nośnikiem treści; brak M2/M3. Klasa **L** (Initiative): pełne M3 (nawigacja wewn.).

### 6 · Insight (C Rekord · S)

> **DIFF 07-18 (J12, `src/components/Interview/InsightViewer.tsx` 8783 l.):** Insight jest DRUGIM (po
> Tasku) żywym SPEC-A — pełny `NModeShell` + `ArtifactRightPanel` z kanonicznymi 5 sekcjami. Jeden
> artefakt, wiele domów ✅ potwierdzone: importowany przez TaskDetailView / DecisionDetailView /
> InitiativeDocumentView / InterviewWorkspace / DiscoveryTools / WorkCanvasDocumentPanel.

| Strefa | Przyciski / funkcje | Stan |
|--------|---------------------|:---:|
| **M1** | ✅ `NModeShell` (`InsightViewer.tsx:8001`) niesie NModeHeader (tytuł inline · [indeks] artifactCode z kopiowaniem · stan zapisu · status-dot · zamknij/czat) · **PRIMARY ✅ = „Konwertuj na inicjatywę"** (`InsightViewer.tsx:8014-8015`, `primaryAction`) | ✅ |
| **M2 / M3** | — (klasa S, zgodnie z formułą; center = NModePropertiesStrip + sekcje kart, l.3064) | ✅ |
| **PANEL** (główny nośnik) | ✅ `ArtifactRightPanel` (`InsightViewer.tsx:8033`) z kanonicznymi 5: `actions` (l.7779) · `properties` (l.7815) · `relations` (l.7903) · `comments` (l.7944) · `history` (l.7970) — pełna zgodność kolejności z formułą | ✅ |
| **PPM (w liście)** | `InterviewHub.tsx:5388-5481` (`StandardTable.rowMenu` §6.4): Download + **Fork**(=Powiel) ✅ · Export→Tools/Assessment ✅ · preview ✅ · archive ✅ · Delete ✅ · edit=`undefined` ŚWIADOMIE (AI-generated read-only, l.5462-5463) · Initiative/Presentation disabled („coming soon backend") · BRAK: Zmień nazwę · Kopiuj link jako pozycja (jest w M1 `ArtifactPermalinkButton`) · AI w kebabie | 🔨 częściowo |

**Ocena:** Insight = drugi wzorzec obok Taska; kod w pełni na SPEC-A (NModeShell + kanoniczny accordion + poprawny primary). Zostaje tylko odbiór wzrokiem per dom (ten sam artefakt otwierany z 5+ miejsc) i weryfikacja treści sekcji AI (formuła kart Insight #57 — osobny tor).

### 7 · Initiative (C Rekord · L — ~10 ekranów wewn.)

> **DIFF 07-18 (J12, `src/components/Initiatives/InitiativeDocumentView.tsx` 10 713 l. — grep
> ukierunkowany, NIE pełny zwiad A3):** Initiative ma poprawne M1 (NModeHeader + primary lifecycle),
> ale treść niesie WŁASNYM wzorcem: N-mode = `NModePropertiesStrip` + `NModeCBoard` z ~28 sekcjami-kartami,
> C-mode = `NModeLeftNav`. ZERO użyć `ArtifactRightPanel` w pliku.

| Strefa | Przyciski / funkcje | Stan |
|--------|---------------------|:---:|
| **M1** | ✅ `NModeHeader` (`InitiativeDocumentView.tsx:9658` i drugi wariant l.9929): tytuł inline · [indeks] buildArtifactCode · zapis (`isMutating`/`hasUnsavedChanges`) · status-dot · **PRIMARY ✅ = przejście lifecycle** (`primaryAction=primaryLifecycleAction`, l.9674-9686 i l.9945; `primaryActions` z `statusActions`, l.1291) | ✅ |
| **M2** | — (zgodnie z formułą) | ✅ |
| **M3** (nawig. wewn.) | formuła chce 8 pilli — realnie ~15-28 sekcji-kart (`tasks/decisions/team/timeline/risk-raid/kpi/financial-analysis/raci/gates/okr/hypothesis/evidence/…`, l.5024-5235) · **pill-tabs ŚWIADOMIE zastąpione dropdown-chipem** `Menu3DropdownChip` z komentarzem w kodzie „#75c: dawny rządek pill-i zamieniony na Menu3DropdownChip (kanon Menu 3)" (l.10032-10035) — 5 grup (Scope·Plan·Timeline·Finance·Gates) · AI slot ✅ na końcu paska („Slot 5 — section-level AI", `ToolbarAISplitButton`, l.10283-10290) · C-mode: `NModeLeftNav` (l.10451) | ❓ DECYZJA udokumentowana (#75c) |
| **RAIL** | — (zgodnie; `NModeLeftNav` pełni rolę nawigatora, nie railu czasowników) | ✅ |
| **PANEL** | ❌ brak `ArtifactRightPanel` — Właściwości = `NModePropertiesStrip` (centrum, l.9692), Powiązania/Komentarze/Historia = karty w `NModeCBoard` (`used-in`, `comments`, `activity-log`, `change-log`), Akcje = header + karty. Migracja na prawy accordion = zadanie architektoniczne w pliku 10,8k linii — **wymaga zwiadu A3 (Opus) przed jakąkolwiek zmianą**, nie dawać robotnikowi „przebuduj" | ❓ DECYZJA |
| **PPM (w liście)** | `InitiativesHub.tsx:1994-2040`: Open ✅ · preview/edit→otwórz dokument ✅ · archive warunkowe (DONE/CANCELLED) ✅ · Delete ✅ · Delay disabled („coming soon backend") · **BRAK vs §6.4: Zmień nazwę · Powiel · Eksport ▸ · Udostępnij · Kopiuj link · AI: uzupełnij · „Konwertuj ▸"** (mimo że formuła go wymaga; eksport tylko wewnątrz dokumentu l.10197-10230) — najuboższy kebab z czwórki N | 🔨 |

**Ocena:** M1 wzorcowe (jedyne narzędzie z poprawnym primary-przejściem-stanu). Treść bogatsza niż formuła (28 sekcji vs 8), ale w architekturze karty-w-centrum zamiast prawego accordionu — czy wyrównywać do SPEC-A, czy uznać Initiative za dojrzałą powłokę (doktryna „WYRÓWNAĆ KONTRAKT, nie accordion") = decyzja Piotra po zwiadzie A3.

### 8 · Task (C Rekord · S) — WZORZEC fali

> **DIFF 07-18 (J12, `src/components/MyWork/TaskDetailView.tsx` 7281 l.):** potwierdzony jako żywy
> SPEC-A (galeria wzorca w skillu fali) — NModeHeader + 10 sekcji treści + kanoniczny accordion.

| Strefa | Przyciski / funkcje | Stan |
|--------|---------------------|:---:|
| **M1** | ✅ `NModeHeader` (`TaskDetailView.tsx:4143-4167`): tytuł inline · kod artefaktu z kopiowaniem (`buildArtifactCode`) · zapis (`isDirty`/`saving` + „Zapisano HH:MM") · status-dot · czat · zamknij · Read/Edit toggle (l.4172) — **brak nr 1: PRIMARY przejścia stanu NIE podpięty** (`NModeHeader` MA prop `primaryAction`, TaskDetailView go nie przekazuje — 0 trafień grep); zamiast tego przejścia (Start/Send to Review/Complete/Block/Reopen) żyją jako pasek 3-5 przycisków RÓWNOCZEŚNIE pod headerem (l.4250-4363) — sprzeczne z „dokładnie 1 primary" · **brak nr 2: crimson-trap** — „Send to Review" i przyciski AI-generate używają `border-primary-400/50 text-primary-600` = crimson #85182F na akcji niekrytycznej (naruszenie Pułapki nr 1) | 🔨 |
| **M2 / M3** | — (klasa S; centrum = sekcje kart: opis-zakres/realizacja/ryzyko-alternatywy/checklist/zależności/dowody/governance/komentarze/załączniki/log, `TaskDetailView.tsx:2011-2065`) | ✅ |
| **PANEL** (główny nośnik) | ✅ `ArtifactRightPanel` (`TaskDetailView.tsx:4588`) z kanonicznymi 5: `actions` (l.3975; komentarz #27/#37 — AI świadomie w nagłówku, nie w sekcji) · `properties` (l.3998) · `relations` (l.4048) · `comments` (l.4081) · `history` (l.4107) | ✅ |
| **PPM (w liście)** | kebab = `StandardTable` §6.4 + oznaczanie statusów (My Work/Execution) — naprawiony 07-15, potwierdzić wzrokiem | ✅ częściowo |

**Ocena:** wzorzec zasłużenie — jedyna realna luka wobec formuły to primary „Rozpocznij/Zakończ/Zablokuj" w M1 (mechanicznie: przekazać `primaryAction` z mapy statusów, jak robi to Decision l.5041 i Initiative l.9674). Reszta = referencja dla fal A1.

### 9 · Decision (C Rekord · S)
| Strefa | Przyciski / funkcje | Stan |
|--------|---------------------|:---:|
| **M1** | ✅ `NModeHeader` (`DecisionDetailView.tsx:5023`) z **PRIMARY ✅ = „Zatwierdź"** (`primaryAction`, l.5041; komentarz w kodzie l.5149: „Approve = M1 primary (NModeHeader.primaryAction) per Formuła §9; workflow keeps secondary actions") · workflow proposed→review→approve→published (l.209, 3457) · `Api.decideDecision(…'approved')` (l.2107) — realny backend | ✅ |
| **M2 / M3** | — (klasa S; centrum = sekcje: kontekst-problem/opcje-tradeoffy/ryzyko-wpływ/konsekwencje/governance-eskalacja/komentarze/zasoby-linki/log, `DecisionDetailView.tsx:1182-1208` — pokrywa treść formuły z naddatkiem) | ✅ |
| **PANEL** (główny nośnik) | ✅ `ArtifactRightPanel` (`DecisionDetailView.tsx:8689`) z kanonicznymi 5: `actions` (l.4767) · `properties` (l.4802) · `relations` (l.4852) · `comments` (l.4949) · `history` (l.4975) | ✅ |
| **PPM (w liście)** | `DecisionsPanelContent.tsx:390-519` (`buildDecisionKebabSections`, wzorzec §6.4 jak Task): Open preview + **Approve/Reject** ✅ (brak „Wstrzymaj") · Edit ✅ · Copy link ✅ · „AI: open & fill" ✅ · Delete ✅ danger na końcu · **Archive = FANTOM** (disabled „Coming soon (backend)", l.505-507 — Task ma to samo już wired przez `onTriageArchive`) · Delay-submenu cały disabled · brak rename/powiel/eksport | 🔨 częściowo |

**Ocena:** Decision jest w kodzie NAJPEŁNIEJSZĄ instancją formuły klasy S — jako jedyny ma i kanoniczny accordion (Powiązania najbogatsze z czwórki: initiative+source+risks+linkedItems, l.4851-4947), i poprawny 1×PRIMARY („Zatwierdź") z komentarzem-cytatem Formuły w kodzie. Luki: „Wstrzymaj" bez odpowiednika (jest Reject/Request-info/Delegate), Archive-fantom w liście, ten sam crimson-trap `primary-400/50` na AI-generate co w Tasku (l.5173-5177).

> **PRZEKROJOWE (cała grupa Karty N — do standaryzacji JEDNYM ruchem, nie per narzędzie):**
> (1) **[indeks] prev/next artefaktu nie istnieje NIGDZIE** (`grep ArtifactIndexNav/prevArtifact/nextArtifact` = 0) — systemowy brak; NModeHeader niesie tylko kod artefaktu z kopiowaniem.
> (2) **„Zmień nazwę" nie istnieje w ŻADNYM z 4 kebabów**; „Powiel" tylko Insight (Fork).
> (3) **Crimson-trap**: `primary-400/50`/`primary-600` na akcjach niekrytycznych (Send-to-Review, AI-generate, workflow-tone) w Task i Decision — naruszenie Pułapki nr 1.
> (4) **Treść żyje w CENTRUM (karty N-mode), panel = meta** — spójnie w Insight/Task/Decision, ale wbrew literze formuły „PANEL=główny nośnik klasy S" → albo przeredagować kanon, albo decyzja Piotra o przebudowie.
> (5) Legacy duplikat: `Discovery/InsightDetailView.tsx` (605 l., pre-SPEC-A, bez NModeHeader/accordionu) — zweryfikować czy jeszcze wpięty w routing.

---

## 4. GRUPA GENERATORY (3) — archetyp B Dokument + D Matryca + E Deck

### 10 · Word / Dokument (B Dokument · L)

> **DIFF 07-09 (vegas/a4-docs, weryfikacja `DocumentStudioView.tsx` + `DocumentStudioDocumentPanel.tsx`,
> 2398 linii):** Word używa **`ExecutiveModuleShell`** (jedna z 3 dojrzałych powłok wg doktryny „WYRÓWNAĆ nie
> scalać" — NIE `ArtifactRightPanel`). To zamierzone (archetypy B/D/E), więc brak `ArtifactRightPanel` tu
> NIE jest gapem samym w sobie — gapem jest niezgodność KOLEJNOŚCI/DOSTĘPNOŚCI z kanonem Formuły.

| Strefa | Przyciski / funkcje | Stan |
|--------|---------------------|:---:|
| **M1** | TopBar z `ExecutiveModuleShell` — ma tab-chips Generate/Plan template w fazie budowy, ale **BRAK jednego jawnego M1 PRIMARY „Udostępnij"** — w fazie `document` primary miejsce zajmuje TopBar chip „Export DOCX" (`topBarChips`, l.~1842-1900), a Share jest schowany w overflow rail (`toolShare`, l.1966) — **DOKŁADNIE ODWROTNIE niż formuła** (chce Udostępnij=primary M1, Eksport=panel) | ❓ DECYZJA (inwersja primary/eksport) |
| **M2** | brak klasycznego paska formatowania w widoku wygenerowanego dokumentu (to widok schema/sekcje, nie wolny tekst) — `DocumentTipTapEditor` istnieje ale nie ma odrębnego M2 toolbara zweryfikowanego w tym pliku | 🔨 do doprecyzowania |
| **M3** | brak trybu czytania / TOC-toggle / komentarze-toggle / śledź-zmiany-toggle jako chipy M3 — funkcjonalnie odpowiedniki istnieją ale jako osobne rail-tools (Comments, Schema diff), nie M3 chipy | 🔨 rozjazd lokalizacji |
| **RAIL** | ✅ JEST — lewy `leftRailTitle="Outline"` (outline dokumentu), zgodnie z formułą | ✅ |
| **PANEL** | ✅ **bogatszy niż kanon** — 13 narzędzi w prawym railu: primary 5 (Sources, Properties, Quality QA, Teresa, Comments) + overflow 8 (Activity, Schema diff, Audience variants, **Share links**, Approvals, Manifest gate, Content library, AI Editor) za jednym `⋯ more`. **Powiązania jako pojęcie Formuły (link do inicjatywy/rodzica) nie istnieje** — „Sources" to źródła-wejścia generacji, nie powiązania-wyjścia. Komentarze ✅ (`DocumentCommentsPanel`, wątki). Historia/AI rozbite: Activity (overflow) + Teresa (primary) + AI Editor (overflow) zamiast jednej sekcji. **Share celowo w overflow, nie w Akcje** — sprzeczne z kanonem „Udostępnij" jako action pierwszej klasy | ❓ DECYZJA (czy spłaszczyć do kanonicznych 5 sekcji, czy 13-tool rail to świadomy wyjątek „wyznacznika rynkowego") |
| **PPM zaznaczenie / blok** | ✅ JEST — `DocumentInlineAIMenu` + `useDocumentInlineAI` mają `acceptProposal`/`rejectProposal` (Zaakceptuj/Odrzuć propozycję AI), zgodnie z formułą | ✅ |

**Ocena:** Word jest NAJBLIŻEJ kanonu z całej dwójki (potwierdza wcześniejszy finding „Word = wyznacznik, blisko" z doktryny G6) — silnik REVIEW/QA/warianty/manifest-gate jest głębszy niż to co Formuła w ogóle przewiduje. Realny gap to **kolejność/widoczność** (Share pogrzebany w overflow zamiast M1 primary) i **brak formalnego „Powiązania"** do rodzica/inicjatywy. Nie jest to fix mechaniczny bez ryzyka: `primaryRightRailTools` ma świadomy komentarz w kodzie „≤5 primary icons" (kanon powłoki Document Studio) — przestawienie Share do primary wymaga decyzji CO wypada (nie luźny dodatek 6. ikony) + weryfikacji wzrokiem. NIE zrobione w tej turze (brak żywego podglądu w tym środowisku).

### 11 · Excel / Sheet (D Matryca · L)

> **DIFF 07-18 (J12):** decyzja Piotra 07-09 („Excel/Sheet = Idea Table jako powłoka + generator/.xlsx
> jako treść, NIE budujemy edytora-grida") jest ZAIMPLEMENTOWANA end-to-end, nie jest fantomem.
> Łańcuch: lista Sheets (`SheetsTabContent.tsx`) → `/my-work/sheets/:wsId/tables/:tableId`
> (`AppRoutes.tsx:1228`) → `MyWorkSheetsDeepLinkRedirect` (`AppRoutes.tsx:522-543`) → ta sama trasa co
> Idea Table (`…/workspace/table?tpTable=:id`, `IdeaMapWorkspace`+`IdeaTableTool`). Generacja =
> `KimiWorkspace/ExceleView.tsx` (czat↔podgląd, pipeline V8 `useKimiArtifactPipeline('excele')`);
> eksport = `downloadSheetArtifactXlsx` → `/api/table-platform/tables/:id/export/xlsx`
> (`sheetArtifactOpen.ts`). **ALE**: powłoka jest ŚLEPA na tożsamość sheet — `IdeaTableTool.tsx` ma
> ZERO wystąpień `xlsx`/`originRuntime`/`isSheet`; plus współistnieje STARY backend `workbook`
> (`server/src/routes/workbook.routes.ts`, `/api/workbook/:id/download`) — jego artefakty nie mają
> ŻADNEGO ekranu (klik w `ExceleView.handlePreviewFile` l.189-209 = surowy download).

| Strefa | Przyciski / funkcje | Stan |
|--------|---------------------|:---:|
| **M1** | odziedziczone gapy №4 (brak M1 w legacy, 3×PRIMARY w MELS) + własny: ikona zawsze `Table2`, zero rozróżnienia wizualnego arkusz-vs-tabela · **PRIMARY „Eksportuj .xlsx" BRAK wewnątrz ekranu** — .xlsx osiągalny tylko z kebaba LISTY (`MyWorkHub.tsx:1248/2168`, `OutputsAggregateTabContent.tsx:197`) | 🔨 |
| **M2** | wstaw wiersz/kolumnę ✅ · format liczba/data/waluta ✅ per-kolumnę (nie per-komórkę) · formuła `fx` ✅ (`FormulaEditor.tsx` — walidacja, cykle) · scal komórki BRAK · obramowanie BRAK — merge/border/freeze żyją tylko w GENEROWANYM .xlsx (prompt `ExceleView.tsx:30-44`) | ✅/🔨 (zgodne z „nie budujemy grida") |
| **M3** | zakładki arkuszy ✅ funkcjonalnie = `TableTabStrip` (tabele w bazie ≈ arkusze) · filtr/sort ✅ · zamroź nagłówek — sticky na stałe, nie przełącznik · AI uzupełnij ✅ / policz ✅ (formuły+agregacje) / **wykres BRAK** | ✅ częściowo |
| **RAIL** | ten sam 5-slotowy rail co №4 (nie nawigator arkuszy) | ❓ jak №4 |
| **PANEL** | ten sam `IdeaRightPanel` (3 sekcje D16) — brak sekcji Akcje z Eksport .xlsx/CSV · brak inspektora „Szczegół komórki (formuła/format)" (`CellExpandPopover` edytuje treść, nie pokazuje meta) | 🔨 |
| **PPM komórka / zakres** | = PPM №4 (wiersz-level): Edytuj/Powiel/Usuń ✅ · Wytnij/Kopiuj/Wklej per-zakres BRAK (copy tylko cało-tabelowy) · Format ▸ / Formuła z PPM BRAK · Wyczyść komórkę BRAK | 🔨 przeważnie |

**Ocena:** decyzja 07-09 dotrzymana (routing+generator+eksport realne), ale realizacja „nieświadoma własnej tożsamości": otwarty Excel/Sheet jest bit-identyczny z Idea Table — bez ikony arkusza, bez PRIMARY eksportu wewnątrz ekranu. Do decyzji Piotra: dorobić `isSheetArtifact` (ikona+primary Eksportuj .xlsx+nazewnictwo arkuszy) czy uznać różnice za kosmetykę. Osobna, poważniejsza luka poza kontraktem: stary backend `workbook` bez żadnego ekranu — migrować do `tp_tables` czy utrzymywać dwa systemy.

### 12 · PowerPoint / Deck (E Deck · L)

> **DIFF 07-18 (J12, `DeckBuilder.tsx` 1648 l. + 15 plików `DeckBuilder/*`):** Deck = trzecia dojrzała
> powłoka obok Word — **`ExecutiveModuleShell`** przez adapter `DeckBuilderMelsView.tsx`, NIE
> `ArtifactRightPanel`. Flaga `melsDeckBuilderFlag.ts:19-22` **domyślnie ON** (WS-A4 / Module 12 gap #4)
> — to realna domyślna powłoka, nie eksperyment; legacy 3-panelowa (custom `DeckBuilderTopBar.tsx`)
> osiągalna tylko `?ff_melsDeckBuilder=0`. Diagnoza dotyczy ścieżki DOMYŚLNEJ (MELS). Silnik bardzo
> bogaty (quality gates, governance card, audit log, share-analytics, komentarze, wersje, agent-edit
> accept/reject) — ale rozproszony w ~6 floating-modalach zamiast prawego accordionu; M2 nie istnieje
> konstrukcyjnie (`ExecutiveModuleShell/TopBar.tsx:10-11` — „No second toolbar below this row").
> ★2 komponenty = martwy kod (0 importerów): `CardFloatingToolbar.tsx` (układ/tło/wyrównanie per-slajd)
> i `EditCardPopup.tsx`.

| Strefa | Przyciski / funkcje | Stan |
|--------|---------------------|:---:|
| **M1** | breadcrumb „Prezentacje ›" + tytuł inline ✅ (`DeckBuilderMelsView.tsx:150-152` → `TopBar.tsx:315-347`) · **← powrót BRAK** — `TopBar.tsx:302-313` renderuje strzałkę tylko gdy `onBack` podany, a `DeckBuilder.tsx` w gałęzi MELS (l.1057-1309) nigdy go nie przekazuje (grep `onBack` = 0) · status+zapis JEST, ale jako `presenceSlot` w prawym rogu (`EntityStatusChip` + „Saving…/Saved", `DeckBuilder.tsx:1092-1104`), nie przy tytule · [indeks] BRAK w M1 („Card X of Y" tylko w dolnym pasku `DeckBuilderBottomBar.tsx:26-29`) · **PRIMARY** = chip `run` „Prezentuj" (`DeckBuilderMelsChips.tsx:243-250`) — pokrywa „Prezentuj", NIE „Eksportuj" (eksport w zakładce modala Share) | 🔨 częściowo |
| **M2** | **BRAK jako pasek** — wyklucza go architektura shella (`TopBar.tsx:10-11`). Substytut wstawiania = `BlockToolbar.tsx:25-32` (tekst/obraz/wykres… jako PANEL prawego railu `blocks`, do wstawiania NOWYCH bloków, nie formatowania aktywnego) · realny per-slajdowy toolbar układ/tło/wyrównanie = **martwy kod** (`CardFloatingToolbar.tsx` — 0 importerów; `CardCanvas.tsx` go nie montuje) · Brand deck-wide w modalu `ThemeSwitcher.tsx` (chip Theme), nie per-slajd | 🔨 brak konstrukcyjny |
| **M3** | dodaj slajd ✅ ale w RAIL (`SlideSorter.tsx:284-291` „New slide") · duplikuj ✅ w kebabie RAIL-a (l.184-193) · **przejścia BRAK** (zero UI; grep trafia tylko CSS/framer per-block) · **tryb prezentera = martwa funkcja** — `PresentMode.tsx:76` ma gałąź `presenterView`, ale `setPresentMode` w `DeckBuilder.tsx` ustawia wyłącznie `'fullscreen'`/`'off'` — żaden przycisk nie ustawia `'presenter'` · AI ✅ Teresa jako `aiEntrySlot` po prawej (`DeckBuilder.tsx:1192-1207`) + per-slide rewrite (`handleRewriteCard`), ale nie jako jawny chip „AI: komponuj/przepisz" | 🔨 rozproszone + 1 martwa funkcja |
| **RAIL** | nawigator miniatur ✅ bogaty (`SlideSorter.tsx`: drag-reorder, widok karty/lista, badge outdated, kebab) · **biblioteka źródeł-artefaktów BRAK** — `MediaLibraryBrowser.tsx` = tylko obrazy; `DeckRelationsPanel`/`SourceTraceability` pokazują źródła już użyte (read-only), nie służą wstawianiu | 🔨 połowa |
| **PANEL** | realna kolejność narzędzi: Blocks → Media → Comments → Activity → Relations (+Evidence za flagą) (`DeckBuilderMelsRightRail.tsx:85-103`) · „Akcje" jako sekcja BRAK — Export/Prezentuj/Udostępnij żyją jako chipy + `ShareModal.tsx:363-380` (Collaborate/Share/Export PDF-PPTX-PNG/Embed) · „Układ slajdu"/„Brand kit" jako sekcje BRAK (layout-picker martwy, Theme w modalu) · **dziura funkcjonalna: narzędzie `media` zadeklarowane (`DeckBuilderMelsRightRail.tsx:85`) ale `rightRailPanels` z `DeckBuilder.tsx:1117-1163` NIE ma klucza `media`** → klik ikony = pusty panel · Powiązania ✅ pełnoprawne (`DeckRelationsPanel.tsx` — agregacja `source_refs`, klik→nawigacja) · Komentarze ✅ (`DeckCommentsPanel.tsx` — Open/Resolved/All, kotwica do slajdu, reply/resolve) · Historia/AI rozbite na 5 modali (VersionHistory/AuditLog/GovernanceCard/QualityGates/ShareAnalytics) z overflow top-bara; `deckBacklinks` pobierane (l.723-767) ale NIGDY nie renderowane w gałęzi MELS (tylko legacy l.1366-1401) | 🔨 rozjazd struktury + dziura Media |
| **PPM slajd** | **brak prawdziwego prawego kliku** (grep `onContextMenu` w folderze = 0) — jest kebab „…" (`SlideSorter.tsx:141-277`): Duplikuj ✅ · Przenieś ▸ (góra/dół/pozycja) ✅ · —— · Usuń(danger) ✅ · **Ukryj BRAK** · **Zmień układ ▸ BRAK** (picker tylko w martwym `CardFloatingToolbar`) | 🔨 częściowo, zły trigger |

**Ocena:** silnik NAJGŁĘBSZY z trójki generatorów (governance, gates P0-P2, audit z saved views, analytics per-card, presence, agent-proposal z diff), ale — inaczej niż Word, gdzie gap to kolejność/widoczność — Deck ma trzy klasy realnych dziur: (1) **strukturalne** — M2 nie istnieje w shellu, a jedyny per-slajdowy layout/tło to martwy kod, więc zmiana układu pojedynczego slajdu jest dziś NIEOSIĄGALNA z UI; (2) **martwe funkcje pod UI** — tryb prezentera zaimplementowany a niewywoływalny, `deckBacklinks` pobierane i wyrzucane; (3) **proste** — brak ← powrót (0 wiring, nie decyzja), pusty panel Media, brak Ukryj/Zmień-układ/przejść. Weryfikacja wzrokiem (dark+light) NIE zrobiona w tej turze — diagnoza czysto grep/read.

---

## 5. NASTĘPNY KROK (osobny) — zestawienie i standaryzacja

1. **Diff per przycisk:** przejść każdą tabelę i wypełnić kolumnę **Stan**: `✅ JEST` (działa na demo) / `🔨 DOROBIĆ` / `❓ DECYZJA` — weryfikując REALNY runtime (nie docy), bo audyty się starzeją.
2. **Wychwycić rozjazdy:** ten sam przycisk w różnych miejscach różnych narzędzi (np. Eksport raz w M1, raz w panelu) → sprowadzić do miejsca kanonicznego (§6).
3. **Standaryzacja falami wg archetypu:** A Canvas (1-3) → C Rekord (6-9) → B Dokument (5,10) → D Matryca (4,11) → E Deck (12). Wspólna powłoka `ArtifactRightPanel` już istnieje — adopcja, nie budowa od zera.
4. **Odbiór wzrokiem (DoD §18.1):** per narzędzie zrzuty dark+light → akceptacja Piotra. Dopiero „tak" = ✅.

**Uwaga o reużyciu:** Task/Decision/Insight/KPI pojawiają się w wielu modułach (My Work, Initiatives, Execution, Results) — to JEDEN artefakt, wiele domów. Standaryzujemy raz, działa wszędzie.
