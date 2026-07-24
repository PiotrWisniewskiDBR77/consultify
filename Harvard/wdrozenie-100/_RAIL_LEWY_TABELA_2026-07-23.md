# Lewy pływający pasek narzędzi (rail) — tryb TABELA (Idee)

Data: 2026-07-23 · Worktree: `/private/tmp/odbior-4` (branch `odbior/lokalny-2026-07-23`, HEAD 894dbce2c8)

**Źródło kodu:** `src/components/MyWork/mindmap/CanvasLeftToolbar.tsx` (komponent raila, wspólny
dla 4 narzędzi: Mapa rekomendacji / Tablica / Przepływ / Tabela). Wiring akcji:
`src/components/MyWork/IdeaMapWorkspace.tsx` (`handleQuickAction`, render `CanvasLeftToolbar`) →
event `idea-workspace-quick-action` → `src/components/MyWork/table/useTableQuickActions.ts`
(jedyny odbiorca akcji w trybie Tabela, obsługuje WYŁĄCZNIE akcje z prefiksem `tbl_`).

**Metoda:** czytanie kodu (grep-first) + żywy podgląd `http://localhost:3100` na obiekcie
`5b0000c2-c7aa-4bb2-88bb-7b522627d8b0` (Tabela 8×6) przez Playwright/Browser, zestawione z
drzewem dostępności (`read_page`) dla dokładnych etykiet PL oraz z plikiem tłumaczeń
`public/locales/pl/translation.json`.

⚠ **Zastrzeżenie do sesji live:** obiekt testowy jest współdzielony w czasie rzeczywistym z innymi
równoległymi sesjami roboczymi ("PĘTLA NOCNA" — wiele agentów pracuje jednocześnie nad IDEE).
W trakcie tej sesji aktywne narzędzie obiektu samoczynnie przełączało się (Tabela → Whiteboard →
Process Flow → Mapa myśli) BEZ mojego udziału (żaden klik na przełącznik narzędzia z mojej strony
nie doszedł do skutku — patrz Uwagi, punkt o żywym artefakcie). Zawartość poniżej dla POPOVERÓW
jest w 100% potwierdzona w kodzie źródłowym; struktura/kolejność/etykiety przycisków raila są
dodatkowo potwierdzone wzrokiem i przez `read_page` (prawdziwe etykiety PL z DOM). Tam, gdzie nie
udało się kliknąć popovera na żywym obiekcie Tabela z powodu współbieżnych zmian, jest to wprost
oznaczone.

---

## 1. Przyciski raila od góry do dołu (aktywne narzędzie = Tabela)

Rail renderuje się w stałej kolejności: **przełącznik narzędzi → SHARED_TOP → kontekst narzędzia
→ SHARED_BOTTOM → Cofnij/Ponów**, z separatorami między sekcjami.

| poz. | ikona (lucide) | etykieta PL (żywy DOM) | typ | wspólny/specyficzny | co robi |
|---|---|---|---|---|---|
| 1 | `GitBranch` | Mapa rekomendacji | przełącznik | **wspólny** (4 narzędzia) | `onToolChange('mindmap')` — przełącza całe narzędzie na Mind Map |
| 2 | `StickyNote` | Tablica | przełącznik | **wspólny** | `onToolChange('whiteboard')` |
| 3 | `Workflow` | Przepływ | przełącznik | **wspólny** | `onToolChange('process_flow')` |
| 4 | `Table2` | Tabela | przełącznik (aktywny) | **wspólny** | `onToolChange('table')` — no-op gdy już aktywne |
| — | — | *separator* | | | |
| 5 | `MousePointer2`/`Hand` | „Zaznaczanie — klik zaznacza, kliknij by przełączyć na przesuwanie" | przełącznik trybu | **wspólny** | `mm_select_mode` / `mm_pan_mode` — przełącza tryb kursora (select/pan) na CAŁYM canvasie |
| 6 | `Sparkles` | AI | popover | **wspólny** (ta sama zawartość we wszystkich 4 narzędziach) | otwiera popover generatorów AI — patrz §2 |
| 7 | `LayoutTemplate` | Szablony | popover | **wspólny** (zawartość zmienia się wg `activeTool`) | otwiera popover szablonów — patrz §3 |
| — | — | *separator* | | | |
| 8 | `Plus` | Nowy wiersz | akcja natychmiastowa | **specyficzny (Tabela)** | `tbl_add_row` → `handlers.handleAddRow()` — dodaje pusty wiersz na końcu tabeli |
| 9 | `Columns3` | Kolumny | akcja natychmiastowa | **specyficzny (Tabela)** | `tbl_add_column` → otwiera dialog dodania nowej kolumny |
| 10 | `LayoutGrid` | Widok | akcja natychmiastowa | **specyficzny (Tabela)** | `tbl_grid` → **twardo** ustawia `viewLayout = 'grid'` (zob. Uwagi — nie jest to przełącznik widoków) |
| 11 | `Filter` | Filtruj | akcja natychmiastowa | **specyficzny (Tabela)** | `tbl_filter` → otwiera panel filtrów tabeli |
| 12 | `Frame` | Dashboard | akcja natychmiastowa | **specyficzny (Tabela)** | `tbl_summary` → otwiera dashboard podsumowania (Summary Dashboard) |
| — | — | *separator* | | | |
| 13 | `Upload` | Import / Eksport | popover | **wspólny** (zawartość identyczna we wszystkich narzędziach — patrz §4) | otwiera popover import/eksport |
| 14 | `MoreHorizontal` | Więcej narzędzi | popover | **wspólny** (zawartość identyczna, patrz §5) | otwiera panel „więcej narzędzi" |
| — | — | *separator* | | | |
| 15 | `Undo2` | Cofnij | akcja natychmiastowa | **wspólny mechanizm, osobny handler per narzędzie** | `tbl_undo` → `handlers.onUndo()` (realny undo tabeli, `nodesUndo`) |
| 16 | `Redo2` | Ponów | akcja natychmiastowa | **wspólny mechanizm** | `tbl_redo` → `handlers.onRedo()` |

Kontekstowe sloty dla Tabeli (poz. 8–12) pochodzą z `TBL_CONTEXT_SLOTS` w kodzie — 5 pozycji,
najkrótsza z 4 list kontekstowych (Mind Map ma 6, Whiteboard 5, Process Flow 4).

---

## 2. Popover „AI" (poz. 6, Sparkles)

**Zawartość jest IDENTYCZNA we wszystkich 4 narzędziach** — komponent
`toolbar-popovers/AIActionsPopover.tsx` nie przyjmuje `activeTool` i nie zmienia listy generatorów
w zależności od kontekstu.

1. **Nowa rozmowa AI** (`ideas.mindmap.newAiConversation`) / gdy zaznaczono węzeł: **Zapytaj AI o
   ten węzeł** — wywołuje `onOpenChat()` (prop, nie `onAction`) → otwiera panel czatu Teresy.
   ✅ Działa niezależnie od aktywnego narzędzia (real handler w `IdeaMapWorkspace.tsx`).
2. Sekcja **„Generatory AI"** (zawsze widoczna), 6 pozycji — wszystkie z prefiksem `mm_ai_*`:
   - Rozwiń mapę (AI) — `mm_ai_expand`
   - Zasugeruj gałęzie — `mm_ai_suggest`
   - Analiza luk — `mm_ai_gap_analysis`
   - Auto-klasteryzacja — `mm_ai_cluster` (za flagą `heuristicAiOverlays`; gdy flaga OFF: przycisk
     wyszarzony z etykietą „Wkrótce")
   - Podsumowanie mapy — `mm_ai_summarize`
   - Auto-linki między gałęziami — `mm_ai_auto_connect`
3. Sekcja **„Dla wybranego węzła"** (widoczna tylko gdy jest zaznaczenie typu `node` — w Tabeli
   praktycznie nieosiągalna, bo tabela nie ma pojęcia „zaznaczony węzeł" w tym sensie): Rozwiń ten
   węzeł, Pogłęb temat, Podsumuj gałąź, What-if analiza — wszystkie `mm_ai_*`.

**⚠ ZNALEZISKO (potwierdzone w kodzie, nie zweryfikowane klikiem na żywo z powodu niestabilności
sesji):** `useTableQuickActions.ts` nasłuchuje WYŁĄCZNIE akcji z prefiksem `tbl_` (plus
`tbl_undo`/`tbl_redo`). Hook obsługujący `mm_ai_*` (`useMindMapQuickActions`) montuje się tylko w
`IdeaRecommendationMap.tsx`, czyli tylko gdy aktywne narzędzie to Mind Map. W trybie Tabela ten
komponent nie jest zamontowany. Skutek: **wszystkie 6 pozycji „Generatory AI" w popoverze AI są
martwym klikiem w trybie Tabela** — event `idea-workspace-quick-action` wystrzeliwuje, ale nic go
nie odbiera. Jedyna działająca pozycja w tym popoverze to „Nowa rozmowa AI" (bo idzie przez
`onOpenChat`, nie przez `onAction`).

Dodatkowo: Tabela ma WŁASNY, w pełni działający zestaw akcji AI w swoim natywnym pasku narzędzi
(niezależnym od raila) — `tbl_ai_assistant` („Asystent AI (/)"), `tbl_copilot` („AI Copilot"),
`tbl_categorize` („AI Kategoryzacja"), `tbl_scoring` („Model scoringowy"), `tbl_pipeline`
(„Pipeline pomysłów"), `tbl_framework` („Generator frameworków") — potwierdzone żywo w DOM
(przyciski widoczne w pasku „Framework" tuż pod railem). Powstaje więc **dublet: dwa wejścia
„AI"** — jedno w railu (Sparkles, martwe generatory), drugie natywne w tabeli (działające) — co
myli, który przycisk faktycznie coś robi.

---

## 3. Popover „Szablony" (poz. 7, LayoutTemplate)

Komponent `TemplatesPopover.tsx` — **jedyny popover, który REALNIE dostosowuje treść do
`activeTool`** (mapa `TEMPLATES_BY_TOOL`). Dla Tabeli (`table`):

- Pole wyszukiwania (filtruje zarówno „Punkty startowe" jak i „Szablony")
- Sekcja **„Punkty startowe"** (`IDEA_STARTING_POINTS`, wspólna dla wszystkich narzędzi,
  niezależna od `activeTool`) — kliknięcie wysyła `CustomEvent(APPLY_INTENT_EVENT)` z tekstem
  seed do wygenerowania treści
- Sekcja **„Szablony"** — dla Tabeli 4 pozycje (`TABLE_TEMPLATES`):
  - **Macierz decyzyjna** (`tbl-decision-matrix`)
  - **Rejestr założeń** (`tbl-assumptions-log`)
  - **Plan działania** (`tbl-action-plan`)
  - **Rejestr ryzyk** (`tbl-risk-register`)
  - kliknięcie → `onApplyTemplate(templateId)` → `handleApplyTemplate` w `IdeaMapWorkspace.tsx` →
    `applyIdeaTemplate()` (wywołanie API, respektuje `activeTool`). ✅ **To realnie działający,
    nie martwy mechanizm** — w przeciwieństwie do popoveru AI.
- Stopka „Zobacz więcej" → otwiera pełną galerię szablonów (`onOpenTemplateGallery`).

---

## 4. Popover „Import / Eksport" (poz. 13, Upload)

Komponent `ImportExportPopover.tsx` — **zawartość statyczna, identyczna we wszystkich 4
narzędziach**, wszystkie akcje z prefiksem `mm_`:

**Import:** Mapa JSON (`mm_import_device`), XMind / FreeMind / OPML (`mm_import_external`),
Dokument → Mapa (`mm_doc_to_map`), Mów pomysły / Voice (`mm_voice`), Wywiady → Mapa
(`mm_interview_to_map`).

**Eksport:** Eksport PDF (`mm_export_pdf`), PNG (`mm_export_png`), SVG (`mm_export_svg`), JSON
(`mm_export_json`), Mermaid / PlantUML (`mm_export_diagram`), CSV / Excel (`mm_export_csv`),
Markdown / konspekt (`mm_export_markdown`), Prezentacja HTML (`mm_export_pptx`), Osadź w raporcie
(`mm_embed_report`).

**Historia wersji** (`mm_snapshot_history`, skrót ⌘⇧H).

**⚠ ZNALEZISKO (potwierdzone w kodzie):** wszystkie powyższe pozycje to akcje `mm_*` — z tego
samego powodu co w §2, **żadna z nich nie ma odbiorcy w trybie Tabela** (`useTableQuickActions`
nie zna żadnego z tych identyfikatorów). Cały ten popover jest martwy w Tabeli.

Co gorsza — Tabela ma WŁASNY, realny, działający import/eksport w swoim natywnym pasku
(potwierdzone żywo w DOM): „Importuj dane", „Importuj CSV", „Eksportuj CSV", „Kopiuj do schowka"
(`tbl_export_csv` faktycznie generuje i pobiera plik CSV z realnych danych tabeli — kod w
`useTableQuickActions.ts`). Rail duplikuje etykietę „Import / Eksport", ale prowadzi do
niedziałającej, mindmapowej wersji.

---

## 5. Popover „Więcej narzędzi" (poz. 14, MoreHorizontal)

Komponent `MoreToolsPanel.tsx` — **zawartość statyczna, identyczna we wszystkich 4 narzędziach**,
z polem wyszukiwania i grupowaniem w kategorie. Wszystkie akcje `mm_*`:

- **Tryby widoku:** Zmień układ (`mm_change_layout`), Typ struktury (`mm_structure_picker`),
  Minimap (`mm_toggle_minimap`), Dopasuj widok (`mm_fit_view`), Tryb prezentacji
  (`mm_presentation`), Zwiń do korzenia / Alt+0 (`mm_fold_0`), Pokaż poziom 1/2/3 — Alt+1/2/3
  (`mm_fold_1/2/3`), Rozwiń wszystko / Alt+9 (`mm_expand_all`)
- **Workflow:** Wersje / Snapshoty (`mm_snapshots`), Historia aktywności (`mm_activity`)
- **Współpraca:** Udostępnij (`mm_share`), Osadź zewnętrznie (`mm_embed`)
- **Analityka:** Analiza gałęzi (`mm_branch_analysis`)

**⚠ ZNALEZISKO:** wszystkie 13 pozycji to `mm_*` — pojęcia typowo mindmapowe (fold/level, layout,
branch analysis), **całkowicie bez sensu w kontekście tabeli danych** (nie ma „gałęzi" ani
„poziomów zwijania" w siatce wierszy/kolumn) i, tak jak wyżej, żadna nie ma odbiorcy w
`useTableQuickActions` — **cały popover jest martwy w Tabeli**, a dodatkowo semantycznie
nietrafiony (nawet gdyby ktoś podpiął obsługę, większość pozycji nie ma odpowiednika pojęciowego
w tabeli).

---

## 6. Akcje natychmiastowe specyficzne dla Tabeli (poz. 8–12) — szczegóły działania

| akcja | efekt na tabeli | status |
|---|---|---|
| `tbl_add_row` | dodaje nowy pusty wiersz na końcu widocznych danych | ✅ realny handler (`handleAddRow`) |
| `tbl_add_column` | otwiera dialog „dodaj kolumnę" (wybór typu pola) | ✅ realny (`setShowAddColumn(true)`) |
| `tbl_grid` | **wymusza** `viewLayout = 'grid'` — jednorazowa akcja, NIE cykl/wybór widoku | ✅ działa, ale mylące (patrz Uwagi) |
| `tbl_filter` | otwiera panel filtrów | ✅ realny (`setShowFilterPanel(true)`) |
| `tbl_summary` | otwiera dashboard podsumowania metryk tabeli | ✅ realny (`setShowSummaryDashboard(true)`) |

---

## 7. Wspólne vs specyficzne — podsumowanie

**Wspólne dla 4 narzędzi (identyczny kod/wygląd, czasem identyczna TREŚĆ nawet gdy nie powinna
być):**
- 4 przełączniki narzędzi (poz. 1–4)
- Tryb kursora (poz. 5)
- Popover AI (poz. 6) — treść identyczna, NIEwrażliwa na `activeTool` ⚠
- Popover Szablony (poz. 7) — treść wrażliwa na `activeTool` ✅ (jedyny wyjątek)
- Popover Import/Eksport (poz. 13) — treść identyczna, NIEwrażliwa na `activeTool` ⚠
- Popover Więcej narzędzi (poz. 14) — treść identyczna, NIEwrażliwa na `activeTool` ⚠
- Cofnij/Ponów (poz. 15–16) — mechanizm wspólny, ale każde narzędzie ma własny stos historii

**Specyficzne dla Tabeli:**
- 5 akcji kontekstowych (poz. 8–12): Nowy wiersz, Kolumny, Widok, Filtruj, Dashboard

---

## 8. Czy rail w ogóle ma sens w trybie Tabela?

**Obserwacja: częściowo nie.** Rail został zaprojektowany dla narzędzi typu płótno (Mind Map,
Whiteboard, Process Flow) — stąd tryb kursora (select/pan), popover AI oparty o „węzły” i
„gałęzie”, popover „Więcej narzędzi” pełen pojęć canvasowych (fold-to-level, minimap, fit view,
branch analysis). Tabela to siatka danych (wiersze × kolumny), nie płótno do przesuwania i
zoomowania — a mimo to dostała ten sam rail 1:1:

- **Tryb kursora (poz. 5, select/pan)** — w tabeli nie ma czego „przesuwać” (nie ma canvasu do
  panningu w klasycznym sensie). Nie zweryfikowano wzrokiem efektu przełączenia w Tabeli (sesja
  niestabilna), ale semantycznie to przycisk-sierota.
- **Popover AI i Popover Więcej narzędzi** — patrz §2 i §5: martwe kliki + zero sensu
  merytorycznego (branch analysis, fold-to-level w tabeli danych).
- **Popover Import/Eksport** — martwy i dublujący z realnym, działającym importem/eksportem CSV
  wbudowanym w samą tabelę.
- **`tbl_grid` („Widok”)** — myląca nazwa: sugeruje przełącznik widoków (Tabela ma naprawdę 6
  widoków: Tabela/Kanban/Oś czasu/Kalendarz/Macierz/Galeria — potwierdzone żywo we własnym pasku
  tabeli), ale w railu to twardy reset do jednego konkretnego widoku „grid”, nie selektor.

**Wniosek:** z 16 pozycji raila w trybie Tabela realnie i sensownie działa **7** (4 przełączniki
narzędzi + Cofnij + Ponów + Szablony) plus **5 akcji kontekstowych tabeli** (razem 12/16), a
**martwe lub bez sensu w tym kontekście są: popover AI (6 pozycji generatorów), popover
Import/Eksport (14 pozycji), popover Więcej narzędzi (13 pozycji) oraz semantycznie
wątpliwy tryb kursora** — mimo że wizualnie zajmują dokładnie tyle samo miejsca w railu co
przyciski, które faktycznie działają.

---

## 9. Martwe / nieaktywne pozycje — lista skrócona

| pozycja | dlaczego martwa w Tabeli |
|---|---|
| AI → 6× generator (`mm_ai_expand/suggest/gap_analysis/cluster/summarize/auto_connect`) | brak odbiorcy `mm_*` w Tabeli |
| AI → 4× akcja węzła (`mm_ai_expand_node/deepen/summarize_branch/what_if`) | brak odbiorcy + brak pojęcia „węzeł” w tabeli |
| Import/Eksport → wszystkie 5 pozycji Import | brak odbiorcy `mm_*` |
| Import/Eksport → wszystkich 9 pozycji Eksport | brak odbiorcy `mm_*` |
| Import/Eksport → Historia wersji (`mm_snapshot_history`) | brak odbiorcy `mm_*` |
| Więcej narzędzi → wszystkie 13 pozycji | brak odbiorcy `mm_*`, część dodatkowo bez sensu pojęciowego w tabeli |

**Działa mimo pozoru dublowania:** Nowa rozmowa AI / Zapytaj AI o węzeł (idzie przez `onOpenChat`,
nie przez `onAction` — jedyna „ocalała” pozycja w popoverze AI).

---

## Uwagi / rzeczy nieoczywiste

1. **Znany defekt UI (zgłoszony w zadaniu, nie odtworzony 1:1 pixel-perfect w tej sesji, ale
   strukturalnie potwierdzony w kodzie):** rail jest portalowany (`createPortal` do
   `document.body`) i pozycjonowany `fixed` z wysokim z-index (`z-context-menu`) nad canvasem
   tabeli, zakotwiczony do lewej krawędzi obszaru canvas. Własny pasek narzędzi tabeli (rząd z
   „Framework”, „Import”, kolumnami, Cofnij/Ponów) zaczyna się od tej samej lewej krawędzi co
   rail — więc rail STRUKTURALNIE nakłada się na początek tego paska. W żywej sesji (viewport
   800×563 i 1280×900) nie zaobserwowałem dokładnie opisanego obcięcia „Framework” → „mework”,
   ale przy innej szerokości/skalowaniu jest to prawdopodobne i zgodne z mechanizmem
   pozycjonowania w kodzie. **Traktować jako potwierdzone przez zadanie, nie odtworzone
   samodzielnie 1:1.**

2. **Żywy artefakt zaobserwowany podczas testów (nie spowodowany przeze mnie):** w trakcie sesji
   obiekt testowy (współdzielony w czasie rzeczywistym z inną równoległą sesją roboczą) samoczynnie
   zmieniał aktywne narzędzie kilkukrotnie (Tabela → Whiteboard → Process Flow → Mapa myśli) mimo
   braku moich kliknięć na przełączniki (jeden click na rail zwrócił błąd „no cached screenshot
   dimensions” i się nie wykonał, a mimo to przy kolejnym screenshot narzędzie było już inne). Przy
   jednym z takich przełączeń nagłówek strony pokazywał „TEST 2026-07-23 — Tabela”, podczas gdy
   renderowało się płótno Whiteboard z 8 wierszami tabeli przekształconymi w karteczki (sticky
   notes) o identycznych etykietach co wiersze tabeli. To zgadza się z ostrzeżeniem z zadania o
   „znanym błędzie duplikacji treści przy przełączaniu” — tu zaobserwowanym jako efekt uboczny
   współbieżnej edycji przez inną sesję, nie mojego działania. **Nie zweryfikowano, czy to ten sam
   mechanizm co przy ręcznym kliknięciu przełącznika przez użytkownika — wymaga osobnego testu w
   izolowanym obiekcie.**

3. **Ikona `Frame` używana dwukrotnie w tym samym komponencie z różnym znaczeniem:** w Mind Map
   `Frame` = „Ramka” (dodaj ramkę grupującą), w Tabeli ten sam import `Frame` = „Dashboard”
   (otwórz podsumowanie). Nie jest to błąd funkcjonalny (różne narzędzia, różny kontekst), ale
   przy szybkim przełączaniu między narzędziami użytkownik może błędnie rozpoznać ikonę po
   pamięci mięśniowej.

4. **`tbl_grid` („Widok”) nie jest przełącznikiem widoków, tylko twardym resetem do widoku
   „grid”.** Prawdziwy przełącznik 6 widoków tabeli (Tabela/Kanban/Oś czasu-Gantt/Kalendarz/
   Macierz/Galeria) istnieje i działa — ale we WŁASNYM pasku tabeli (`ref` potwierdzone w DOM:
   „Tabela”, „Kanban”, „Oś czasu / Gantt”, „Kalendarz”, „Macierz”, „Galeria”), nie w railu. Etykieta
   „Widok” w railu sugeruje więcej niż faktycznie robi.

5. **Popover Szablony jest jedynym w pełni „uczciwym” popoverem raila w trybie Tabela** — jedyny,
   który (a) dostosowuje treść do aktywnego narzędzia i (b) faktycznie coś robi po kliknięciu.
   Wszystkie pozostałe trzy popovery (AI, Import/Eksport, Więcej narzędzi) są statyczne
   (mindmapowe) i martwe w tym kontekście.

6. **Realne, działające odpowiedniki funkcji AI/Import/Eksport dla Tabeli już istnieją** — ale nie
   w railu, tylko w natywnym pasku narzędzi samej tabeli (`Framework`, `Import`, `Asystent AI (/)`,
   `AI Copilot`, `AI Kategoryzacja`, `Model scoringowy`, `Pipeline pomysłów`, `Importuj CSV`,
   `Eksportuj CSV`). Efekt: użytkownik ma DWA wizualnie podobne wejścia do „AI” i dwa do
   „Import/Eksport” na tym samym ekranie — jedno w railu (martwe), jedno w pasku tabeli
   (działające) — bez żadnego wizualnego rozróżnienia, które jest które.

7. Etykiety PL w tabeli powyżej pochodzą z realnego drzewa dostępności żywej aplikacji
   (`read_page`) zestawionego z `public/locales/pl/translation.json` — nie są to zgadnięte
   tłumaczenia angielskich fallbacków z kodu.
