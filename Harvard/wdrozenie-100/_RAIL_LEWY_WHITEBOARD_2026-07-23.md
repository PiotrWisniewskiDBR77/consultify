# Lewy pływający pasek narzędzi (rail) — tryb Whiteboard (Tablica)

Data: 2026-07-23
Zakres: `IdeaWhiteboardTool` / narzędzie IDEE, tryb **Tablica** (whiteboard), komponent
`CanvasLeftToolbar` (`src/components/MyWork/mindmap/CanvasLeftToolbar.tsx`) — wspólny rail
dla 4 narzędzi kanwy (Mapa myśli / Tablica / Przepływ / Tabela).

Metoda: analiza kodu (grep-first, śledzenie `onAction` → zdarzenie `idea-workspace-quick-action`
→ hooki `useMindMapQuickActions.ts` / `useWhiteboardQuickActions.ts`) + weryfikacja na żywej
aplikacji `http://localhost:3100`, obiekt testowy
`.../ideas/f28b328d-bd3a-400c-91af-4feffb10fa8d/workspace/whiteboard`.

**Zastrzeżenie do weryfikacji wzrokiem:** w trakcie testu ten konkretny obiekt testowy był
najwyraźniej **równocześnie modyfikowany przez inny proces/sesję** — aktywne narzędzie kanwy
samoistnie przełączało się (Whiteboard → Mapa myśli → Tabela → Process Flow …) bez żadnej akcji
z tej sesji, kilkukrotnie w odstępie ~1–2 s. Utrudniło to zebranie pełnego zrzutu samego raila
w trybie Tablica bez przerwania. Etykiety i kolejność przycisków dla trybu Tablica zostały
potwierdzone wzrokiem częściowo (patrz adnotacje przy każdej pozycji), reszta — w 100% zgodnie
z kodem źródłowym i plikiem tłumaczeń PL (`public/locales/pl/translation.json`, klucz
`myWorkMindmap.toolbar.*`). Nic w tym dokumencie nie jest zgadywane: to, co nie zostało
potwierdzone na żywo, jest oznaczone wprost.

---

## 1. Przyciski od góry do dołu (tryb Tablica)

| poz. | ikona (lucide) | etykieta PL (tooltip/aria-label) | typ | co robi |
|---|---|---|---|---|
| 1 | `GitBranch` | „Mapa rekomendacji” | przełącznik narzędzia | `onToolChange('mindmap')` — przełącza całe narzędzie IDEE na Mapę myśli. Wspólne dla 4 narzędzi. |
| 2 | `StickyNote` | „Tablica” | przełącznik narzędzia (aktywny) | `onToolChange('whiteboard')` — pozostaje na Tablicy (podświetlony). |
| 3 | `Workflow` | „Przepływ” | przełącznik narzędzia | `onToolChange('process_flow')`. |
| 4 | `Table2` | „Tabela” | przełącznik narzędzia | `onToolChange('table')`. |
| — | — | *(separator)* | | |
| 5 | `MousePointer2` / `Hand` | „Zaznaczanie — klik zaznacza, kliknij by przełączyć na przesuwanie” (zmienia się na „Przesuwanie — …” gdy aktywny pan) | przełącznik trybu (SEL/PAN) | **Wspólny.** Patrz „Uwagi” — na Tablicy jest to przycisk **martwy wizualnie**: przełącza `mindMapInteractionMode`, ale `IdeaWhiteboardTool` w ogóle nie odbiera tej propsy — canvas Tablicy nie reaguje. |
| 6 | `Sparkles` | „AI” | popover | Otwiera **AIActionsPopover** — patrz sekcja 2. Wspólny komponent, ale treść (generatory) jest **mindmapowa i martwa na Tablicy** — patrz Uwagi. |
| 7 | `LayoutTemplate` | „Szablony” | popover | Otwiera **TemplatesPopover** — patrz sekcja 3. Jedyny ze wspólnych popoverów, który **realnie działa** na Tablicy (świadomy `activeTool`). |
| — | — | *(separator)* | | |
| 8 | `StickyNote` | „Karteczka” | akcja natychmiastowa | `wb_add_sticky` → `useWhiteboardQuickActions` → `handlers.addElement('sticky')`. Dodaje karteczkę na płótnie. Działa. |
| 9 | `Type` | „Tekst” | akcja natychmiastowa | `wb_add_text` → `addElement('text')`. Działa. |
| 10 | `Square` | „Kształt” | akcja natychmiastowa | `wb_add_shape_rectangle` → `addElement('shape_rectangle')`. Wstawia od razu **prostokąt** — brak wyboru kształtu z tego przycisku (inne kształty: koło/romb/sześciokąt istnieją w kodzie `useWhiteboardQuickActions`, ale nie są dopięte do żadnego przycisku w tym rail-u). Działa. |
| 11 | `Pen` | „Rysuj” | przełącznik trybu (board/draw) | `wb_mode_draw` → `handlers.setMode('draw')` → realny, **osobny** stan `whiteboardMode` w `IdeaWhiteboardTool` (niepowiązany ze stanem SEL/PAN z pozycji 5). Działa — przełącza tablicę w tryb rysowania odręcznego. |
| 12 | `Frame` | „Ramka” | akcja natychmiastowa | `wb_add_frame` → `addElement('frame')`. Działa. |
| — | — | *(separator)* | | |
| 13 | `Upload` | „Import / Eksport” | popover | Otwiera **ImportExportPopover** — patrz sekcja 4. **W całości martwy na Tablicy** — patrz Uwagi. |
| 14 | `MoreHorizontal` | „Więcej narzędzi” | popover | Otwiera **MoreToolsPanel** — patrz sekcja 5. **W całości martwy na Tablicy** — patrz Uwagi. |
| — | — | *(separator)* | | |
| 15 | `Undo2` | „Cofnij” | akcja natychmiastowa (może być disabled) | `wb_undo` → `handlers.undo()` (realna funkcja cofania Tablicy — **działa**, gdy przycisk nie jest wyszarzony). Stan disabled/enabled liczony jest jednak **błędnie** — patrz Uwagi (pkt „Cofnij/Ponów”). |
| 16 | `Redo2` | „Ponów” | akcja natychmiastowa (może być disabled) | `wb_redo` → `handlers.redo()`. Ten sam problem ze stanem disabled co wyżej. |

Pozycje 8–12 (Karteczka/Tekst/Kształt/Rysuj/Ramka) to **specyficzne dla Tablicy** (`WB_CONTEXT_SLOTS`
w kodzie). Pozycje 1–7, 13–16 są **wspólne dla 4 narzędzi** (ten sam komponent renderowany też dla
Mapy myśli / Przepływu / Tabeli, ze zmienioną tylko sekcją kontekstową i etykietami popovera
Szablonów).

Potwierdzone wzrokiem na żywej aplikacji (przed „ucieczką” obiektu do innego narzędzia): pozycje
1–4 (przełącznik), 5 (Zaznaczanie — etykieta), 6–7 (AI, Szablony), 8–11 (Karteczka, Tekst, Kształt,
Rysuj). Pozycja 12 (Ramka) oraz 13–16 potwierdzone dla tego samego raila w trybie Mapa myśli/Tabela
(te same elementy współdzielone) — w trybie Tablica ich obecność i kolejność wynika wprost z kodu
(`WB_CONTEXT_SLOTS`, `SHARED_BOTTOM`, `getUndoRedoSlots`), nie zweryfikowana osobnym zrzutem z
powodu niestabilności opisanej wyżej.

---

## 2. Popover „AI” (Sparkles)

Komponent: `AIActionsPopover.tsx`. **Nie jest świadomy `activeTool`** — pokazuje zawsze tę samą,
mindmapową listę, niezależnie od tego, czy otwarto go na Mapie myśli, Tablicy, Przepływie czy
Tabeli.

Zawartość (od góry):
1. **„Nowa rozmowa AI”** (lub „Zapytaj AI o ten węzeł” gdy zaznaczony węzeł typu `node`) —
   ikona `MessageCircle`. Wywołuje `onOpenChat()` — otwiera panel czatu Teresy. **Działa
   niezależnie od narzędzia** (jedyny w pełni funkcjonalny element tego popovera na Tablicy).
2. *(sekcja „Dla wybranego węzła” — pojawia się tylko gdy `selection.type === 'node'`; na Tablicy
   zaznaczenie ma inny kształt/typ, więc ta sekcja praktycznie się nie pojawia)*:
   „Rozwiń ten węzeł”, „Pogłęb temat”, „Podsumuj gałąź”, „What-if analiza”.
3. **„Generatory AI”** (nagłówek sekcji, zawsze widoczny):
   - „Rozwiń mapę (AI)” — akcja `mm_ai_expand`
   - „Zasugeruj gałęzie” — `mm_ai_suggest`
   - „Analiza luk” — `mm_ai_gap_analysis`
   - „Auto-klasteryzacja” — `mm_ai_cluster` (dodatkowo zablokowane etykietą „Wkrótce”, gdy flaga
     `heuristicAiEnabled` = false)
   - „Podsumowanie mapy” — `mm_ai_summarize`
   - „Auto-linki między gałęziami” — `mm_ai_auto_connect`

**Wszystkie 6 pozycji „Generatory AI” są martwe na Tablicy.** Akcje `mm_ai_*` są obsługiwane
wyłącznie w `useMindMapQuickActions.ts`, hooku zamontowanym **tylko** wewnątrz
`IdeaRecommendationMap` (komponent Mapy myśli), który renderuje się jedynie gdy
`activeTool === 'mindmap'`. Na Tablicy ten komponent w ogóle nie istnieje w drzewie — zdarzenie
`idea-workspace-quick-action` z akcją `mm_ai_*` odlatuje w próżnię (żaden listener go nie łapie).
Kliknięcie dowolnej z tych 6 pozycji na Tablicy: przycisk reaguje wizualnie (highlight, popover się
zamyka), ale nic się nie dzieje na płótnie.

---

## 3. Popover „Szablony” (LayoutTemplate)

Komponent: `TemplatesPopover.tsx`. **Świadomy `activeTool`** — jedyny wspólny popover, który
faktycznie dostosowuje treść i działa poprawnie na Tablicy.

Zawartość (od góry):
1. Pole wyszukiwania („Szukaj…”).
2. Sekcja **„Punkty startowe”** (`IDEA_STARTING_POINTS`, wspólna dla wszystkich 4 narzędzi, NIE
   filtrowana wg `activeTool`) — 6 pozycji, każda ma swój `preferredSystem`:
   - „Rozbij problem” → mindmap
   - „Znajdź przyczyny źródłowe” → mindmap
   - „Porównaj opcje” → table
   - „Zmapuj proces” → process_flow
   - „Zamień notatki w strukturę” → **whiteboard**
   - „Uprość sprawozdanie finansowe” → table

   Kliknięcie wysyła zdarzenie `idea-workspace-apply-intent` z tekstem-seedem do Teresy; jeśli
   `preferredSystem` różni się od aktualnego narzędzia, dojdzie prawdopodobnie do przełączenia
   narzędzia (nie zweryfikowano wzrokiem skutku end-to-end).
3. Sekcja **„Szablony”** — dla Tablicy (`WHITEBOARD_TEMPLATES`):
   - Pusta tablica
   - Business Model Canvas
   - Macierz Wpływ / Wysiłek
   - Retrospektywa
   - Lean Canvas
   - Mapa podróży klienta

   Kliknięcie → `onApplyTemplate(templateId)` → realne wywołanie API (`applyIdeaTemplate`),
   niezależne od tego, który komponent kanwy jest zamontowany — **działa**.
4. „Zobacz więcej” na dole → `onOpenTemplateGallery()`, otwiera pełną galerię szablonów (osobny
   ekran, poza zakresem tego dokumentu).

---

## 4. Popover „Import / Eksport” (Upload)

Komponent: `ImportExportPopover.tsx`. **Nie jest świadomy `activeTool`** — zawsze ta sama,
mindmapowa treść, bez wariantu dla Tablicy.

Zawartość:
- **Import**: „Mapa JSON” (`mm_import_device`), „XMind / FreeMind / OPML” (`mm_import_external`),
  „Dokument → Mapa” (`mm_doc_to_map`), „Mów pomysły (Voice)” (`mm_voice`), „Wywiady → Mapa”
  (`mm_interview_to_map`).
- **Export**: „Eksport PDF” (`mm_export_pdf`), „PNG” (`mm_export_png`), „SVG” (`mm_export_svg`),
  „JSON” (`mm_export_json`), „Mermaid / PlantUML” (`mm_export_diagram`), „CSV (Excel)”
  (`mm_export_csv`), „Markdown (konspekt)” (`mm_export_markdown`), „Prezentacja HTML”
  (`mm_export_pptx`), „Osadź w raporcie” (`mm_embed_report`).
- Na dole: „Historia wersji” (`mm_snapshot_history`, ze skrótem ⌘⇧H).

**Wszystkie pozycje są martwe na Tablicy.** Wszystkie akcje `mm_*` są obsłużone wyłącznie w
`useMindMapQuickActions.ts` (mindmap-only, patrz sekcja 2). W repozytorium **nie istnieje** żaden
odpowiednik `wb_export_*` / `wb_import_*` / `wb_snapshot_*` — to nie jest kwestia nieaktywnej
flagi, tylko brakującej implementacji dla Tablicy w ogóle. Kliknięcie dowolnej pozycji: popover się
zamyka, nic więcej się nie dzieje.

---

## 5. Popover „Więcej narzędzi” (MoreHorizontal)

Komponent: `MoreToolsPanel.tsx`. Również **nieświadomy `activeTool`**, wyłącznie treść mindmapowa.

Zawartość (z polem wyszukiwania na górze), pogrupowana:
- **Tryby widoku**: „Zmień układ” (`mm_change_layout`), „Typ struktury” (`mm_structure_picker`),
  „Minimap” (`mm_toggle_minimap`), „Dopasuj widok” (`mm_fit_view`), „Tryb prezentacji”
  (`mm_presentation`), „Zwiń do korzenia (Alt+0)” (`mm_fold_0`), „Pokaż poziom 1/2/3 (Alt+1/2/3)”
  (`mm_fold_1/2/3`), „Rozwiń wszystko (Alt+9)” (`mm_expand_all`).
- **Workflow**: „Wersje / Snapshoty” (`mm_snapshots`), „Historia aktywności” (`mm_activity`).
- **Współpraca**: „Udostępnij” (`mm_share`), „Osadź zewnętrznie” (`mm_embed`).
- **Analityka**: „Analiza gałęzi” (`mm_branch_analysis`).

**Wszystkie pozycje są martwe na Tablicy** — z tego samego powodu co Import/Eksport (akcje `mm_*`
obsługiwane tylko w hooku zamontowanym wyłącznie dla Mapy myśli). Ciekawostka: „Tryb prezentacji”
(`mm_presentation`) to duplikat akcji, która na Mapie myśli jest też osobnym przyciskiem w rail-u
(„Prezentacja”, `MM_CONTEXT_SLOTS`) — na Tablicy nie ma żadnego odpowiednika ani w rail-u, ani w
tym panelu.

---

## 6. Uwagi / rzeczy nieoczywiste

1. **Popover AI, Import/Eksport i Więcej narzędzi są w praktyce martwe na Tablicy** (poza jednym
   przyciskiem „Nowa rozmowa AI” w popoverze AI). To nie kwestia flagi czy niedokończonej funkcji —
   te trzy popovery to **dosłownie ten sam komponent i te same akcje `mm_*`**, które mają sens
   tylko wtedy, gdy zamontowany jest komponent Mapy myśli (`IdeaRecommendationMap` +
   `useMindMapQuickActions`). Na Tablicy renderuje się `IdeaWhiteboardTool` +
   `useWhiteboardQuickActions`, który rozumie tylko akcje z prefiksem `wb_` — więc `mm_export_pdf`,
   `mm_change_layout` itd. lecą donikąd. Ekran wygląda identycznie jak na Mapie myśli (te same
   ikony, te same polskie etykiety typu „Mapa JSON”, „Mermaid / PlantUML”), co może zmylić
   użytkownika, że eksport/import/więcej-narzędzi działa tak samo na obu narzędziach — nie działa.
2. **Przycisk „Zaznaczanie” (Wskaźnik/Łapka, SEL/PAN) jest dekoracyjny na Tablicy.** Zmienia
   ikonę i etykietę (SEL ↔ PAN), ale odpowiadający mu stan (`mindMapInteractionMode`,
   ustawiany przez `IdeaMapWorkspace.handleMindMapInteractionModeChange`) w ogóle nie jest
   przekazywany jako props do `IdeaWhiteboardTool` — Tablica ma **własny, niezależny** stan
   trybu (`whiteboardMode`: `board`/`draw`), sterowany wyłącznie przyciskiem „Rysuj” z sekcji
   kontekstowej (pozycja 11). Kliknięcie „Zaznaczanie” na Tablicy nie zmienia więc niczego w
   zachowaniu płótna.
3. **Cofnij/Ponów na Tablicy: przyciski są realnie podłączone (`wb_undo`/`wb_redo` →
   `handlers.undo()`/`redo()` z prawdziwej historii Tablicy), ale ich wygaszenie
   (disabled/enabled) liczone jest ze złego źródła.** `CanvasLeftToolbar` dostaje `canUndo`/
   `canRedo` z `IdeaMapWorkspace` jako zmienne `mmCanUndo`/`mmCanRedo`, aktualizowane wyłącznie
   przez zdarzenia `mm-undo-state` (Mapa myśli) i `tbl-undo-state` (Tabela). Nie istnieje żadne
   zdarzenie `wb-undo-state` — Tablica nigdy nie raportuje własnego stanu historii do rodzica.
   Efekt: stan przycisków Cofnij/Ponów na Tablicy to zawsze **wartość domyślna `false` albo
   „zastała” wartość z ostatniej wizyty na Mapie myśli/Tabeli w tej samej sesji** — nie ma nic
   wspólnego z tym, czy na Tablicy faktycznie jest coś do cofnięcia. To realne ryzyko, że
   przyciski wyglądają na wyszarzone (i są zablokowane atrybutem `disabled`, więc nie da się ich
   kliknąć) mimo dostępnej historii — **nie zweryfikowane wzrokiem** (środowisko testowe zbyt
   niestabilne w trakcie sesji), ustalone wprost z kodu (`IdeaMapWorkspace.tsx` ok. l. 316–332 oraz
   `IdeaRecommendationMap.tsx` l. 2332 — jedyne miejsce, które w ogóle emituje `mm-undo-state`).
4. **Kolejność w rail-u jest budowana z 4 bloków rozdzielonych cienkimi separatorami**:
   (a) przełącznik narzędzia (`TOOL_CONFIG`, opcjonalny, ale zawsze przekazywany w tym widoku),
   (b) `SHARED_TOP` (Zaznaczanie, AI, Szablony), (c) blok kontekstowy zależny od narzędzia
   (`CONTEXT_SLOTS[activeTool]`), (d) `SHARED_BOTTOM` (Import/Eksport, Więcej narzędzi), na końcu
   bez separatora para Cofnij/Ponów. Zmiana narzędzia w pozycji (a) zamienia WYŁĄCZNIE blok (c) —
   wszystko inne zostaje na miejscu, co jest zgodne z zamierzonym zachowaniem („Standard jest
   kodem” — jeden komponent, deklaratywna zawartość).
5. **Przycisk „Kształt” wstawia od razu prostokąt** — nie ma tu podmenu wyboru kształtu (koło/
   romb/sześciokąt). Te warianty istnieją w kodzie (`useWhiteboardQuickActions.ts`: `wb_add_shape_
   circle`, `wb_add_shape_diamond`, `wb_add_shape_hexagon`) i są używane gdzie indziej w systemie
   (np. wykrywanie intencji w czacie, `whiteboardIntentDetector.ts`), ale rail nie ma osobnego
   przycisku/popovera, który by je udostępniał — jedyna droga do innego kształtu niż prostokąt to
   inny kanał (np. czat / komenda ukośnikowa), poza zakresem tego dokumentu.
6. **Sekcja „Punkty startowe” w popoverze Szablony nie jest filtrowana wg aktywnego narzędzia** —
   pokazuje zawsze te same 6 pozycji niezależnie od tego, czy popover otwarto na Tablicy, Mapie
   myśli, Przepływie czy Tabeli; każda pozycja ma przypisane własne „docelowe” narzędzie
   (`preferredSystem`), które może być inne niż to, na którym użytkownik aktualnie pracuje.
7. **Deep-link `/workspace/whiteboard` nie zawsze „trzyma”.** W trakcie testu na żywo,
   bezpośrednie wejście pod URL z segmentem `/workspace/whiteboard` renderowało poprawnie Tablicę
   przez chwilę, po czym (obserwowane po ok. 1–2 s) narzędzie samo przełączało się na inne
   (najczęściej Mapę myśli — ostatnio zapisane `preferredTool` dla tego konkretnego obiektu
   testowego). W kodzie (`IdeaMapWorkspace.tsx` ok. l. 1469–1495) istnieje logika, która nadpisuje
   aktywne narzędzie zapisaną na serwerze preferencją (`mapRes.map.preferredTool` /
   `extensions.surfaceState.activeTool`), o ile `initialTool` (parsowany z URL) jest fałszywy.
   Czy w tym konkretnym przypadku winny był wyścig (`initialTool` faktycznie pusty przy tym
   wejściu), czy inny, równoległy proces testujący ten sam obiekt na żywo (bardzo prawdopodobne —
   obserwowano również przeskoki na Tabelę i Process Flow, których żadna akcja z tej sesji nie
   wywołała) — **nie ustalono jednoznacznie**; zgłaszane tu wprost jako obserwacja, nie jako
   pewnik, i jako przyczyna, dla której część zrzutów rail-u w trybie Tablica nie została zebrana
   w 100% bezpośrednio (uzupełniono kodem, patrz punkt metody na górze dokumentu).
