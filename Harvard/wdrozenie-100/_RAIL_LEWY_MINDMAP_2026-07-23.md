# Lewy pływający pasek narzędzi (rail) — tryb MIND MAP

Data: 2026-07-23. Worktree: `/private/tmp/odbior-4`. Gałąź: `odbior/lokalny-2026-07-23`.

## Źródła

- Komponent raila: `src/components/MyWork/mindmap/CanvasLeftToolbar.tsx`
  (`TOOL_CONFIG`, `SHARED_TOP`, `MM_CONTEXT_SLOTS`, `SHARED_BOTTOM`, `getUndoRedoSlots`).
- Popovery: `src/components/MyWork/mindmap/toolbar-popovers/{AddNodePopover,AIActionsPopover,
  ImportExportPopover,KnowledgePopover,MoreToolsPanel,TemplatesPopover}.tsx`.
- Dispatch realnych akcji `mm_*`: `src/components/MyWork/mindmap/useMindMapQuickActions.ts`
  (nasłuchuje zdarzenia `idea-workspace-quick-action` wysyłanego przez `onAction` z raila).
- Tłumaczenia PL faktycznie ładowane przez appkę: `public/locales/pl/translation.json`
  (klucze `myWorkMindmap.*` i `ideas.mindmap.*`).

## Metoda weryfikacji na żywo

Aplikacja uruchomiona lokalnie (`http://localhost:3100`), zalogowana tokenem z `/tmp/tok.txt`,
otwarty obiekt testowy Mind Map (`8d97381d-5837-425a-a0d8-30d43c89f247`).

- **Potwierdzone wzrokiem/klikiem**: kolejność i etykiety wszystkich 17 przycisków raila
  (odczyt drzewa dostępności `aria-label`/`title` na żywej stronie), oraz pełna zawartość
  dwóch popoverów: **Dodaj węzeł** i **Wiedza** (kliknięte na żywo, treść 1:1 zgodna z kodem).
- **Nie kliknięte na żywo, ale potwierdzone z kodu + realnego pliku tłumaczeń PL** (ten sam
  plik, który appka faktycznie ładuje): popovery **AI**, **Szablony**, **Import/Eksport**,
  **Więcej narzędzi**. Powód: w tej sesji przeglądarkowej (headless, worktree devserver) klik
  po współrzędnych/`ref` na dalsze pozycje raila okazał się niestabilny — zamiast otwierać
  popover, po kilku próbach klik trafiał w przełącznik narzędzia (Mind Map/Tablica/Przepływ/
  Tabela) i przełączał cały workspace na inny archetyp (raz nawet na inną ideę-zakładkę
  „Pomysł" w pasku aplikacji). To wygląda na wyścig między portalowym pozycjonowaniem raila
  (`createPortal` + `ResizeObserver` w `CanvasLeftToolbar.tsx`, linie 342–372) a klikiem
  automatyzacji, nie na błąd samego UI dla użytkownika myszką. Nie zgaduję treści tych 4
  popoverów — poniżej są przepisane literalnie z komponentu i z `translation.json`.

## A. Lista przycisków od góry do dołu (kolejność faktyczna)

| poz. | ikona (lucide) | etykieta PL (tooltip/aria-label) | typ | co robi |
|---|---|---|---|---|
| 1 | `GitBranch` | **Mapa rekomendacji** | przełącznik narzędzia | `onToolChange('mindmap')` — przełącza cały workspace na Mind Mapę. Aktywny = podświetlony. |
| 2 | `StickyNote` | **Tablica** | przełącznik narzędzia | `onToolChange('whiteboard')`. Kropka (`•`) obok ikony gdy narzędzie ma już treść (`familyCounts`) i nie jest aktywne. |
| 3 | `Workflow` | **Przepływ** | przełącznik narzędzia | `onToolChange('process_flow')`. |
| 4 | `Table2` | **Tabela** | przełącznik narzędzia | `onToolChange('table')`. |
| — | — | *(separator)* | | |
| 5 | `MousePointer2` / `Hand` | **Zaznaczanie — klik zaznacza, kliknij by przełączyć na przesuwanie** (treść zmienia się z trybem: „Przesuwanie…” / „Łączenie — kliknij Connect lub pusty canvas, aby wrócić do zaznaczania”) | przełącznik (toggle) | `mm_select_mode` ⇄ `mm_pan_mode`. Ikona zmienia się na dłoń w trybie pan. Obok przycisku mały odznaka **SEL** / **PAN** / **LNK** pokazująca aktywny tryb interakcji (potwierdzone na żywo: badge „SEL”). |
| 6 | `Sparkles` | **AI** | popover | Otwiera `AIActionsPopover` — patrz sekcja B. |
| 7 | `LayoutTemplate` | **Szablony** | popover | Otwiera `TemplatesPopover` — patrz sekcja C. |
| — | — | *(separator)* | | |
| 8 | `Frame` | **Ramka** | akcja natychmiastowa | `mm_add_frame` — dodaje węzeł typu `group` (ramka 300×200, obwódka przerywana) obok zaznaczonego węzła (albo w domyślnym miejscu 200,100 gdy nic nie zaznaczono). Wywołuje `pushUndo()` wcześniej. |
| 9 | `GitBranch` | **Dodaj węzeł** | popover | Otwiera `AddNodePopover` — patrz sekcja D. **Potwierdzone na żywo.** |
| 10 | `FileText` | **Wiedza** | popover | Otwiera `KnowledgePopover` — patrz sekcja E. **Potwierdzone na żywo.** |
| 11 | `MessageSquare` | **Komentarze** | akcja natychmiastowa | `mm_comments` — wymaga zaznaczonego węzła **typu `idea`** (nie działa na branch/frame/knowledge-card); jeśli jest → `setCommentNodeId(node.id)` (otwiera panel komentarzy do węzła). Jeśli nic nie zaznaczono → toast „zaznacz węzeł” zamiast cichego no-op. |
| 12 | `Link2` | **Połącz — przeciągnij z uchwytu jednego węzła do drugiego** (gdy aktywny: „Zakończ łączenie i wróć do zaznaczania”) | przełącznik trybu | `mm_connect_mode` ⇄ `mm_select_mode` (przez `getMindmapConnectToolbarAction`). Wchodzi w tryb rysowania połączeń przeciąganiem między uchwytami węzłów. |
| 13 | `Play` | **Prezentacja** | akcja natychmiastowa | `mm_presentation` → `setShowPresentation(true)` — otwiera overlay trybu prezentacji mapy. Ta sama akcja dostępna też z „Więcej narzędzi” → „Tryb prezentacji” (duplikat wejścia, patrz Uwagi). |
| — | — | *(separator)* | | |
| 14 | `Upload` | **Import / Eksport** | popover | Otwiera `ImportExportPopover` — patrz sekcja F. |
| 15 | `MoreHorizontal` | **Więcej narzędzi** | popover | Otwiera `MoreToolsPanel` — patrz sekcja G. |
| — | — | *(separator)* | | |
| 16 | `Undo2` | **Cofnij** | akcja natychmiastowa | `mm_undo`. Wyszarzony (disabled) gdy `canUndo === false`. |
| 17 | `Redo2` | **Ponów** | akcja natychmiastowa | `mm_redo`. Wyszarzony gdy `canRedo === false`. |

Kolejność (1–17) potwierdzona na żywo poprzez odczyt drzewa dostępności działającej strony —
dokładnie taka jak w kodzie (`TOOL_CONFIG` → `SHARED_TOP` → `MM_CONTEXT_SLOTS` → `SHARED_BOTTOM`
→ undo/redo).

## B. Popover „AI” (Sparkles) — *nie klikany na żywo, treść z kodu + PL translation.json*

Nagłówek z podpowiedzią kontekstową (opcjonalny, z eventu `idea-mindmap-sidekick-context`) —
pomijalny w standardowym przebiegu.

1. **Nowa rozmowa AI** (gdy nic nie zaznaczono) / **Zapytaj AI o ten węzeł** (gdy zaznaczono
   węzeł) — otwiera czat z Teresą (`onOpenChat`).
2. Sekcja **„Dla wybranego węzła”** (widoczna tylko gdy zaznaczono ≥1 węzeł):
   - **Rozwiń ten węzeł** (`mm_ai_expand_node`) — realne wywołanie AI-expand na danym węźle.
   - **Pogłęb temat** (`mm_ai_deepen`) — jeśli jest `onOpenChat`, otwiera czat z gotowym
     promptem (nie generuje nic automatycznie na canvasie); fallback: `handleAIExpand()`.
   - **Podsumuj gałąź** (`mm_ai_summarize_branch`) — wymaga zaznaczenia; wysyła zdarzenie
     `idea-mindmap-summarize-branch` do zewnętrznego handlera w `IdeaMapWorkspace`.
   - **What-if analiza** (`mm_ai_what_if`) → `setShowWhatIf(true)`.
3. Sekcja **„Generatory AI”** (nagłówek z ikoną Sparkles):
   - **Rozwiń mapę (AI)** (`mm_ai_expand`) — jedyna pozycja, która realnie woła
     `handlers.handleAIExpand()` (prawdziwe zapytanie do backendu/LLM) bez pośrednictwa czatu.
   - **Zasugeruj gałęzie** (`mm_ai_suggest`) — otwiera czat z promptem (nie działa bez `onOpenChat`).
   - **Analiza luk** (`mm_ai_gap_analysis`) — otwiera czat z promptem zawierającym do 20 etykiet
     istniejących węzłów.
   - **Auto-klasteryzacja** (`mm_ai_cluster`) → `setShowAutoClustering(true)`. **Domyślnie
     WYŁĄCZONE i wyszarzone z odznaką „Wkrótce”** — sterowane flagą `mindmapHeuristicAiOverlays`
     (`defaultValue: false` w `src/hooks/useFeatureFlags.tsx`, DP-5 „honesty gate”: ta nakładka
     to heurystyka po stronie klienta — dopasowanie substringów tagów/etykiet — nie realna
     analiza AI, stąd domyślnie schowana za flagą).
   - **Podsumowanie mapy** (`mm_ai_summarize`) — czat z promptem (do 30 etykiet węzłów).
   - **Auto-linki między gałęziami** (`mm_ai_auto_connect`) — czat z promptem.

   → **Ważna obserwacja**: poza „Rozwiń mapę (AI)” i „Rozwiń ten węzeł”, prawie wszystkie
   pozycje w „Generatorach AI” nie generują nic bezpośrednio na płótnie — tylko otwierają czat
   Teresy z gotowym promptem do wysłania. To nie jest oczywiste z samych etykiet w UI.

## C. Popover „Szablony” (LayoutTemplate) — *nie klikany na żywo*

1. Pole wyszukiwania („Szukaj…”).
2. Sekcja **„Punkty startowe”** (`IDEA_STARTING_POINTS`, wspólna dla wszystkich narzędzi) —
   m.in. „Rozbij problem”, „Znajdź przyczyny źródłowe”, „Porównaj opcje”, „Zmapuj proces”,
   „Zamień notatki w strukturę”, „Uprość sprawozdanie finansowe”. Klik wysyła zdarzenie
   `idea-workspace-apply-intent` z promptem zasiewającym czat/mapę (`preferredSystem`).
3. Sekcja **„Szablony”** — dla Mind Mapy (`MIND_MAP_TEMPLATES`): **Pusta mapa myśli**,
   **Analiza SWOT**, **5 Dlaczego**, **Diagram Ishikawy**, **Mapa interesariuszy**,
   **Kaskada OKR**. Klik → `onApplyTemplate(templateId)`.
4. Stopka: **„Zobacz więcej”** → `onOpenTemplateGallery()` (otwiera pełną galerię szablonów).

Uwaga z kodu (`useMindMapQuickActions.ts`, funkcja `mm_apply_framework`, wywoływana z czatu a
nie z tego popovera): katalog szablonów bywa niespójny między narzędziami — np. `mm-swot` i
`mm-porter5` (użyte tu, w Szablonach Mind Mapy) zostały gdzie indziej zastąpione wariantami
`cx-swot`/`cx-porter5`, które są jednak szablonami **Tablicy**, nie Mind Mapy. Sam popover
Szablonów wskazuje bezpośrednio `mm-swot`/`mm-fishbone`/... więc z tego miejsca działa
poprawnie; problem dotyczy tylko ścieżki „zastosuj framework z czatu”.

## D. Popover „Dodaj węzeł” (GitBranch) — **potwierdzone na żywo**

Kliknięte na żywo — pokazało się dokładnie:

- Sekcja **„Dodaj”**:
  - **Gałąź dziecko (Tab)** (`mm_add_child`) — wyszarzone, gdy nic nie zaznaczono.
  - **Gałąź sąsiad (Enter)** (`mm_add_sibling`) — wyszarzone, gdy nic nie zaznaczono.
  - **Nowy root topic** (`mm_add_root`).
- Sekcja **„Wstaw specjalny”** (zawsze aktywne, dodają węzeł typu `idea` z `semanticType`):
  - **Temat** (`mm_insert_topic`), **Hipoteza** (`mm_insert_hypothesis`), **Ryzyko**
    (`mm_insert_risk`), **Akcja** (`mm_insert_action`), **Punkt decyzyjny**
    (`mm_insert_decision`), **Opcja** (`mm_insert_option`).

Każdy z sześciu wstawia węzeł jako dziecko zaznaczonego węzła (albo root, gdy nic nie
zaznaczono) w pozycji przesuniętej o (+220, +20), z natychmiastowym trybem edycji etykiety
(`_startEditing: true`).

## E. Popover „Wiedza” (FileText) — **potwierdzone na żywo**

Kliknięte na żywo — pokazało się dokładnie:

- Sekcja **„Karty wiedzy”**: **Karta wiedzy** (`mm_add_knowledge`), **Notatka**
  (`mm_add_note`), **Dowód / Evidence** (`mm_add_evidence`). Każda wymaga zaznaczonego węzła
  (inaczej toast „zaznacz węzeł, aby dołączyć”); dodaje kartę jako dziecko zaznaczenia.
- Sekcja **„Z platformy”**: **Wstaw z Notebook** (`mm_insert_from_notebook` — realny call
  `Api.getNotebookPages`, wstawia do 8 stron notatnika jako węzły `idea`/`knowledge` obok
  zaznaczenia/root), **Wstaw z Interview** (`mm_insert_from_interview` → otwiera osobny modal
  `setShowInterviewToMap(true)`, nie wstawia nic bezpośrednio z tego miejsca).

## F. Popover „Import / Eksport” (Upload) — *nie klikany na żywo*

- Nagłówek **„Import”**: **Mapa JSON** (`mm_import_device` — prawdziwy file-picker `.json`,
  parsuje i domergowuje węzły/krawędzie), **XMind / FreeMind / OPML**
  (`mm_import_external` → otwiera modal importu zewnętrznego), **Dokument → Mapa**
  (`mm_doc_to_map` → modal), **Mów pomysły (Voice)** (`mm_voice` → modal
  Voice-to-Node), **Wywiady → Mapa** (`mm_interview_to_map` → modal).
- Nagłówek **„Eksport”**: **Eksport PDF** (`mm_export_pdf` — wysyła zdarzenie
  `idea-mindmap-export-pdf` do zewnętrznego handlera), **PNG** (`mm_export_png` — realny
  `exportAsPNG`), **SVG** (`mm_export_svg`), **JSON** (`mm_export_json`), **Mermaid /
  PlantUML** (`mm_export_diagram` → modal generujący kod diagramu), **CSV (Excel)**
  (`mm_export_csv` — realny eksport, ma wbudowany fallback CSV nawet bez `handlers.exportAsCSV`),
  **Markdown (konspekt)** (`mm_export_markdown`), **Prezentacja HTML**
  (`mm_export_pptx` → modal eksportu do PPTX/HTML), **Osadź w raporcie**
  (`mm_embed_report` → modal).
- Stopka (osobna sekcja, poza Import/Eksport): **Historia wersji** (`mm_snapshot_history`,
  skrót **⌘⇧H**) — **toggle** (`setShowSnapshots(prev => !prev)`) panelu snapshotów.

## G. Popover „Więcej narzędzi” (MoreHorizontal) — *nie klikany na żywo*

Ma własne pole wyszukiwania (filtruje po widocznej etykiecie) i grupuje pozycje w kategorie:

- **Tryby widoku**: Zmień układ (`mm_change_layout` — cykl tree→radial→force), Typ struktury
  (`mm_structure_picker` → otwiera osobny `StructurePickerPopover`: Mind Map / Org Chart /
  Tree (Right) / Fishbone / Timeline), Minimap (`mm_toggle_minimap`), Dopasuj widok
  (`mm_fit_view`), Tryb prezentacji (`mm_presentation` — **duplikat** przycisku raila „Prezentacja”,
  patrz Uwagi), Zwiń do korzenia (Alt+0), Pokaż poziom 1/2/3 (Alt+1/2/3), Rozwiń wszystko (Alt+9).
- **Workflow**: Wersje / Snapshoty (`mm_snapshots` — **ustawia zawsze `true`**, inaczej niż
  toggle w Import/Eksport, patrz Uwagi), Historia aktywności (`mm_activity`).
- **Współpraca**: Udostępnij (`mm_share` — kopiuje link do schowka), Osadź zewnętrznie
  (`mm_embed` — kopiuje kod `<iframe>` do schowka).
- **Analityka**: Analiza gałęzi (`mm_branch_analysis` → `setShowBranchComparison(true)`).

## Wspólne vs specyficzne dla Mind Map

**Wspólne dla wszystkich 4 narzędzi** (Mind Map / Tablica / Przepływ / Tabela) — ten sam
komponent `CanvasLeftToolbar`, ta sama pozycja w rail:
- 4 przełączniki narzędzi na górze (poz. 1–4).
- Zaznaczanie (poz. 5), AI (poz. 6), Szablony (poz. 7) — `SHARED_TOP`.
- Import / Eksport (poz. 14), Więcej narzędzi (poz. 15) — `SHARED_BOTTOM`.
- Cofnij / Ponów (poz. 16–17) — akcja prefiksowana per narzędzie (`mm_`/`wb_`/`pf_`/`tbl_`),
  ale pozycja i wygląd identyczne.

**Specyficzne dla Mind Mapy** (poz. 8–13, `MM_CONTEXT_SLOTS`): Ramka, Dodaj węzeł, Wiedza,
Komentarze, Połącz, Prezentacja. Każde inne narzędzie ma własny zestaw w tym samym miejscu
(np. Whiteboard: Sticky/Text/Shape/Draw/Frame; Process Flow: Start/End/Task/Decyzja/Lane;
Tabela: Add row/Columns/View/Filter/Dashboard) — potwierdzone żywo dla Process Flow i Tabeli
przy okazji nawigacji między narzędziami w tej samej sesji.

## Uwagi / rzeczy nieoczywiste

1. **Zawartość popoverów AI/Szablony/Import-Eksport/Więcej narzędzi nie została kliknięta na
   żywo w tej sesji** — automatyzacja przeglądarki (klik po współrzędnych/`ref`) okazała się
   niestabilna w tym środowisku (worktree dev-server + portal raila), klik konsekwentnie
   przełączał narzędzie zamiast otwierać popover niższych pozycji. Treść tych czterech sekcji
   pochodzi z kodu źródłowego i z faktycznego pliku `public/locales/pl/translation.json` — nie
   jest zgadywana, ale nie jest też potwierdzona wzrokiem na ekranie. **Dwa pozostałe popovery
   (Dodaj węzeł, Wiedza) zostały kliknięte i potwierdzone 1:1.**
2. **Persystencja aktywnego narzędzia per idea/zakładka.** Przełączenie narzędzia (np. na
   Przepływ lub Tabelę) i powrót na URL `/workspace/mindmap` **nie** wraca automatycznie do
   Mind Mapy — appka pamięta ostatnio wybrane narzędzie dla otwartej „zakładki” idei
   (widoczne w pasku „Pomysł” nad breadcrumbem) i po odświeżeniu strony ląduje z powrotem na
   ostatnio wybranym narzędziu, mimo że URL wskazuje `/mindmap`. Trzeba kliknąć przełącznik
   „Mapa rekomendacji” ręcznie, żeby wrócić.
3. **„Auto-klasteryzacja” w popoverze AI jest domyślnie wyłączona** (odznaka „Wkrótce”,
   przycisk disabled) — flaga `mindmapHeuristicAiOverlays` ma `defaultValue: false`
   (`src/hooks/useFeatureFlags.tsx`). Powód udokumentowany w kodzie (DP-5 „honesty gate”):
   ta nakładka nie robi realnej analizy AI, tylko dopasowanie substringów po stronie klienta.
4. **Prawie wszystkie „Generatory AI”** poza „Rozwiń mapę (AI)” i „Rozwiń ten węzeł” **nie
   generują nic bezpośrednio na mapie** — tylko otwierają czat Teresy z gotowym promptem
   (Zasugeruj gałęzie / Analiza luk / Podsumowanie mapy / Auto-linki / Pogłęb temat /
   Podsumuj gałąź). Użytkownik musi jeszcze wysłać wiadomość w czacie.
5. **Duplikat „Prezentacja”**: dostępna zarówno bezpośrednio w rail (poz. 13) jak i w
   „Więcej narzędzi” → „Tryb prezentacji” — ta sama akcja `mm_presentation` pod dwoma
   przyciskami w dwóch różnych miejscach.
6. **Niespójność „historia wersji” vs „snapshoty”**: przycisk w stopce Import/Eksport
   (`mm_snapshot_history`, ⌘⇧H) **przełącza** (toggle) panel snapshotów, a niemal identyczny
   „Wersje / Snapshoty” w Więcej narzędzi (`mm_snapshots`) **zawsze go otwiera** (nie zamyka
   przy ponownym kliku) — dwa różne zachowania dla koncepcyjnie tej samej funkcji.
7. **„Komentarze” działa tylko dla węzłów typu `idea`** — jeśli zaznaczony jest np. węzeł
   Frame/Knowledge-card/branch, przycisk pokaże toast „zaznacz węzeł” zamiast otworzyć panel
   komentarzy do zaznaczonego elementu (kod sprawdza `sel.type === 'idea'` explicite).
8. **Martwy handler bez wejścia w UI**: `useMindMapQuickActions.ts` obsługuje akcję
   `mm_import_url` (toast „import z URL niedostępny”), ale **żaden przycisk w
   `ImportExportPopover` ani gdziekolwiek indziej w Mind Mapie jej nie wysyła** — to osierocony
   case, prawdopodobnie pozostałość po usuniętym wcześniej przycisku.
9. **Katalog szablonów zależny od ścieżki wejścia**: popover „Szablony” (ten w rail) pokazuje
   dla Mind Mapy `mm-swot`/`mm-fishbone`/... i to działa; ale wywołanie tego samego frameworku
   z czatu (`mm_apply_framework`, np. „zastosuj SWOT”) dla SWOT/Porter's 5 trafia na
   przestarzałe id (`mm-swot`/`mm-porter5` zastąpione przez `cx-swot`/`cx-porter5`, które są
   szablonami **Tablicy**, nie Mind Mapy) i kończy się honest-fallbackiem (dodaje pojedynczy
   węzeł-placeholder z ostrzeżeniem), a nie realnym szablonem. Nie dotyczy bezpośrednio raila,
   ale warto wiedzieć przy dalszych testach „Szablonów”.
10. **Odznaka trybu obok „Zaznaczanie”** (SEL/PAN/LNK) potwierdzona na żywo tylko dla stanu
    domyślnego „SEL”; PAN i LNK potwierdzone wyłącznie z kodu (`getMindmapPointerToggleTooltip`,
    linia z `interactionMode === 'pan' ? 'PAN' : ...`).
