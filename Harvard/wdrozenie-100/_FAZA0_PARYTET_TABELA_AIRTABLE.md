# FAZA 0 — Parytet lidera: TABELA (Ideas) vs Airtable/Notion

**Data:** 2026-07-22 · **Rola:** dokumentalista (bez zmian kodu) · **Faza:** 0 planu z `_ANALIZA_IDEE_4_NARZEDZIA_2026-07-22.md` (K1/K8/K9)
**Zakres kodu:** `src/components/MyWork/IdeaTableTool.tsx` (~3830 linii) + `src/components/MyWork/table/*` (PlatformCellRenderer, GridView, KanbanView, CalendarView, TimelineView, GalleryView, RowColoringConfig, InlineAIFill...) + `src/types/tablePlatform.ts` + `tablePlatform` (dane w `extensions.table` grafu `my_idea_maps`).
**Metoda:** grep/czytanie kodu na żywym repo (nie tylko docy/flagi — złota reguła #1), skrzyżowane z dowodem-renderem z `_ANALIZA_IDEE_4_NARZEDZIA_2026-07-22.md` §5.4. To jest CHECKLISTA WYMAGAŃ (do odhaczenia w Fazie 3), nie raport z odbioru.

---

## 1. Lider: Airtable / Notion databases — dlaczego to poprzeczka

Airtable (i analogicznie Notion databases, Rows) wygrały rynek „tabeli jako narzędzia pracy" bo: **(1) każda komórka jest natychmiast edytowalna jak arkusz kalkulacyjny** — klik/dwuklik/Tab/Enter/fill-handle działają bez tarcia, zero „trybu edycji" jako osobnego kroku; **(2) jeden rekord ma wiele twarzy** — ten sam wiersz to komórka w gridzie, karta w kanbanie, wydarzenie w kalendarzu, bez duplikowania danych; **(3) prawy-klik i kolor są pełnoprawnym językiem organizacji danych**, nie dodatkiem — insert/duplicate/delete/color/comment na wierszu i kolumnie są tak samo dostępne jak w Excelu, plus warstwa AI/relacji, której arkusz nie ma. Nasza Tabela ma iść w stronę „Airtable dla doradztwa" — te same prymitywy, plus typy specyficzne dla consultingu (risk_score, priority, ai_generated_summary).

---

## 2. K9 DYNAMIKA — prymitywy pracy z tabelą (mierzalne)

Legenda stanu: ✅ potwierdzone w kodzie · ⚠️ częściowe/inna forma · ❌ brak · ❓ niezweryfikowane (wymaga harnessu interakcji, nie samego grepu)

| # | Prymityw (jak u lidera) | Miara / definicja gotowości | Stan w kodzie (dowód) | MUST/NICE |
|---|---|---|---|---|
| 9.1 | Edycja komórki: klik zaznacza, dwuklik/Enter wchodzi w edycję, wpisywanie natychmiastowe | Brak osobnego „trybu edycji" wymagającego dodatkowego kroku | ⚠️ `CellEditor.tsx` + `CellExpandPopover.tsx` istnieją, `InlineAIFill` na hover — mechanizm jest, płynność (klik-do-edycji bez opóźnień) **niezmierzona** (❓ harness) | **MUST** |
| 9.2 | Tab przechodzi do następnej komórki (bez wychodzenia z wiersza) | Tab = next cell, Shift+Tab = prev, strzałki = nawigacja gridowa | ❌ brak `key === 'Tab'` w `IdeaTableTool.tsx`; jedyne `onKeyDown`/Enter znalezione dotyczą zmiany nazwy widoku i nagłówka kolumny, nie nawigacji po komórkach | **MUST** |
| 9.3 | Dodawanie wiersza: przycisk „+" ORAZ Enter na ostatnim wierszu | `handleAddRow`/`_addRow` — przycisk „Add blank row" + dropdown „Add row with template" (linie ~2479-2496) potwierdzone | ✅ przycisk działa; ❌ brak Enter-na-końcu-gridu jako skrót | Przycisk: gotowe · Enter-skrót: **NICE** |
| 9.4 | Dodawanie kolumny (1 klik + typ z listy) | `AddColumnDialog.tsx` istnieje w `table/` | ⚠️ komponent jest, trzeba potwierdzić że oferuje pełną listę typów z `FieldType` (§3) | **MUST** |
| 9.5 | Drag-reorder kolumn | Przeciągnij nagłówek, kolejność się zapisuje | ✅ potwierdzone: `draggable`, `onDragStart={() => handleColDragStart(col.key)}`, `GripVertical` w nagłówku (linie 2882-2923) | gotowe |
| 9.6 | Drag-reorder wierszy | Uchwyt przeciągania po lewej stronie wiersza | ❌ brak `GripVertical`/draggable na poziomie wiersza w gridzie (tylko `handleReorderNode` istnieje w mind-mapie, nie w tym widoku wg grepu) — do potwierdzenia w Fazie 3 | **MUST** |
| 9.7 | Resize kolumn (przeciągnij krawędź) | Uchwyt na prawej krawędzi nagłówka, żywa szerokość | ✅ potwierdzone: `handleResizeStart(col.key, e)` + uchwyt „Resize handle" (linia ~2941) | gotowe |
| 9.8 | Zaznaczanie zakresu komórek (shift-klik / drag) | Zaznaczenie prostokątne wielu komórek, podświetlone | ❌ brak `selectedCells`/`cellSelection`/`shiftKey` w gridzie — istnieje tylko `copyTableToClipboard` na CAŁĄ tabelę (jeden przycisk „Copy to clipboard"), nie na zakres | **MUST** |
| 9.9 | Kopiuj/wklej zakres (Ctrl+C/V między komórkami, do/z Excela) | Zaznacz zakres → Ctrl+C → wklej w inne komórki lub arkusz | ❌ brak `onCopy`/`onPaste` per-cell; jest tylko całościowy `copyTableToClipboard` | **MUST** |
| 9.10 | Wypełnianie w dół (fill handle, uchwyt w rogu komórki) | Przeciągnij uchwyt → wartość/seria kopiuje się w dół | ❌ brak `fillHandle`/`dragFill` w kodzie. Mamy substytut AI: `InlineAIFill`/`BatchAIFillButton` (wypełnia wartości przez AI, nie przez przeciąganie wzoru) — inna filozofia niż Airtable fill-handle | **MUST** (albo świadoma decyzja: AI-fill zamiast fill-handle — do ustalenia z Piotrem) |
| 9.11 | Sortowanie kolumny | Klik nagłówka / z menu, strzałka kierunku | ✅ `effectiveCycleSort(colContextMenu.colKey)` w menu kontekstowym kolumny | gotowe |
| 9.12 | Filtrowanie | Panel filtrów, warunki AND/OR | ✅ `FilterBuilder.tsx`, `FilterPanel.tsx`, `FilterGroup`/`FilterRule` w typach — infrastruktura jest; UI-dostępność z paska głównego do potwierdzenia w Fazie 3 | gotowe (do potwierdzenia widoczności) |
| 9.13 | Grupowanie (group by pole) | Nagłówki grup, zwijanie/rozwijanie | ✅ `groupBy`/`setGroupBy`, przełącznik w pasku (linia ~1748), `GroupConfig.collapsed` w typach | gotowe |
| 9.14 | Widoki: grid | Domyślny widok tabelaryczny | ✅ | gotowe |
| 9.15 | Widoki: kanban | Kolumny = wartości pola select, karty = rekordy, drag między kolumnami | ✅ `KanbanView.tsx` podłączony (`_vl === 'kanban'`), `groupByColumn` filtruje po `select/multiselect/status` | gotowe (jakość drag-drop do potwierdzenia w Fazie 3) |
| 9.16 | Widoki: kalendarz | Rekordy z polem daty jako wydarzenia | ✅ `CalendarView.tsx` podłączony (`_vl === 'calendar'`) | gotowe |
| 9.17 | Widoki: timeline/gantt | Paski czasowe wg dat start/end | ✅ `TimelineView.tsx` podłączony (`_vl === 'timeline'`), plus osobny `GanttView.tsx` w katalogu — do wyjaśnienia czy dubluje | gotowe (wyjaśnić duplikat w Fazie 3) |
| 9.18 | Widoki: gallery | Karty wizualne z okładką | ⚠️ `GalleryView.tsx` istnieje, ale w `IdeaTableTool.tsx` widok `'grid'` layoutu mapuje na `viewType: 'gallery'` (linia 2708) — nazewnictwo niespójne (nasz „grid" ≠ Airtable „grid"), doprecyzować w Fazie 1/3 | **NICE** (naming) |
| 9.19 | Rozwijany rekord (expand row → panel pełny) | Dwuklik/ikona → panel z wszystkimi polami, komentarzami, historią | ✅ `RecordExpandModal.tsx` podłączony na dwuklik wiersza (`expandedRecordId`, linia ~3591) + `RowDetailPanel.tsx` | gotowe |
| 9.20 | Kolor wiersza / etykiety (select z paletą kolorów) | Ustaw kolor wiersza z presetu lub custom, widoczny jako pasek/tło | ✅ `RowColoringConfig.tsx` — reguły warunkowe z paletą (`PRESET_COLORS`, custom `<input type=color>`), renderowane jako `borderLeftColor` na wierszu (linia 1289) — **ale to reguła WARUNKOWA (jak formatowanie warunkowe), nie ręczny wybór koloru per wiersz z prawego-kliku** jak w Airtable | ⚠️ częściowe — brakuje ręcznego "ustaw kolor tego wiersza" z menu kontekstowego (patrz §4) — **MUST** |

**Podsumowanie K9:** silnik danych (typy, widoki, sort/filter/group, drag kolumn, resize) jest zaskakująco kompletny — bliżej lidera niż sugerowała analiza „surowe". Największe realne luki to warstwa **interakcji komórka-po-komórce jak arkusz kalkulacyjny**: brak Tab-nawigacji, brak zaznaczania zakresu, brak kopiuj/wklej zakresu, brak fill-handle, brak drag-reorder wierszy. To jest rdzeń „czuje się jak Airtable" i dziś go brakuje.

---

## 3. Typy komórek — lider vs my

| Typ komórki | Airtable/Notion ma | `FieldType` w `src/types/tablePlatform.ts` | Renderer w `PlatformCellRenderer.tsx` | MUST/NICE |
|---|:--:|:--:|:--:|---|
| Text (single line) | ✅ | ✅ `singleLineText` | ✅ (domyślny) | gotowe |
| Long text | ✅ | ✅ `longText` | do potwierdzenia (nie w grep renderera) | **MUST** potwierdzić |
| Number | ✅ | ✅ `number` | ✅ (domyślny numeryczny) | gotowe |
| Currency | ✅ | ✅ `currency` | ✅ `currency: (...)` | gotowe |
| Percent | ✅ | ✅ `percent` | ✅ `percent: (...)` | gotowe |
| Date | ✅ | ✅ `date` | do potwierdzenia w renderze (nie w top-level map grepu) | **MUST** potwierdzić |
| Single select (z kolorami) | ✅ | ✅ `singleSelect` | ✅ `singleSelect: (...)` | gotowe |
| Multi-select (z kolorami) | ✅ | ✅ `multiSelect` | ✅ `multiSelect: (...)` | gotowe |
| Checkbox | ✅ | ✅ `checkbox` | ✅ `checkbox: (...)` | gotowe |
| Rating (gwiazdki) | ✅ | ✅ `rating` | ✅ `rating: (...)` → `RatingDisplay` | gotowe |
| User / collaborator | ✅ | ⚠️ tylko `createdBy`/`lastModifiedBy` (auto), **brak** ogólnego pola „przypisz do użytkownika" wybieralnego ręcznie | ✅ `createdBy: (...)` (auto only) | **MUST** — brak pola typu „Assignee"/"Owner" wybieranego ręcznie |
| Attachment | ✅ | ✅ `attachment` | ✅ `attachment: (...)` → `AttachmentDisplay` | gotowe |
| Link (linked record, relacje między tabelami) | ✅ | ✅ `linkedRecord` | ✅ `linkedRecord: (...)` → `LinkedRecordDisplay`/`LinkedRecordPicker` | gotowe |
| Formula | ✅ | ✅ `formula` | ✅ `formula: (...)` + `FormulaEditor.tsx` | gotowe |
| Lookup / Rollup | ✅ | ✅ `lookup`, `rollup` | do potwierdzenia w renderze | **NICE** potwierdzić |
| URL / Email / Phone | ✅ | ✅ `url`, `email`, `phone` | do potwierdzenia | **NICE** potwierdzić |
| Duration / Barcode | ✅ (duration), rzadziej (barcode) | ✅ oba | do potwierdzenia | **NICE** |
| **Specjalne consultingowe** (risk_score, priority, ai_generated_summary, ai_classification, source_reference) | brak u lidera (nasza przewaga) | ✅ zdefiniowane, mają dedykowane komponenty (`RiskScoreCell`, `PriorityCell`, `AiSummaryCell`, `AiClassificationCell`, `SourceReferenceCell`) | ✅ | gotowe — to jest nasz diferencjator, chronić przy standaryzacji |

**Podsumowanie typów:** model danych typów komórek jest praktycznie 1:1 z Airtable + rozszerzony o typy consultingowe. Realna luka MUST to brak pola **„User/Assignee"** wybieranego ręcznie z listy członków zespołu (mamy tylko auto `createdBy`) — to częsty typ w Airtable do przypisywania odpowiedzialności.

---

## 4. K1 — prawy-klik: komplet operacji (wiersz i komórka)

### 4.1 Dziś (potwierdzone w kodzie, `rowContextMenu` w `IdeaTableTool.tsx` ~3178-3240)

| Pozycja menu | Jest dziś? |
|---|:--:|
| Edit (otwiera expand) | ✅ |
| Add note (deep-link do zakładki Comments) | ✅ |
| Duplicate row | ✅ |
| Delete row | ✅ |
| Insert row above | ❌ |
| Insert row below | ❌ |
| Expand record (jako pozycja menu, nie tylko dwuklik) | ❌ (jest dwuklik, brak w menu) |
| Copy (skopiuj wiersz do schowka) | ❌ |
| Kolor wiersza (ręczny wybór z prawego-kliku) | ❌ (kolor istnieje tylko jako reguła warunkowa, §2.20) |
| Komentarz (bezpośrednio, nie przez „Add note") | ⚠️ pokrywa się z „Add note" — do ujednolicenia nazwy |

### 4.2 Wymagany komplet (parytet Airtable) — checklista

- [ ] **[MUST]** Insert row above
- [ ] **[MUST]** Insert row below
- [ ] **[MUST]** Duplicate row *(już jest — utrzymać)*
- [ ] **[MUST]** Delete row *(już jest — utrzymać)*
- [ ] **[MUST]** Expand record *(dodać jako pozycję menu, nie tylko dwuklik/„Edit")*
- [ ] **[MUST]** Copy row / Copy record URL
- [ ] **[MUST]** Kolor wiersza (submenu z paletą — ręczny wybór, nie tylko reguła warunkowa)
- [ ] **[NICE]** Komentarz jako osobna pozycja (jeśli różni się semantycznie od „Add note")
- [ ] **[NICE]** Sekcja AI (Fill with AI / Suggest / Classify) — dziś dostępna przez hover-ikonę per komórka (`InlineAIFill`), nie w menu wiersza — rozważyć dodanie skrótu w menu
- [ ] **[MUST]** Prawy-klik na KOMÓRCE (nie tylko wierszu) z: Copy cell, Paste, Clear cell, Expand cell — dziś brak dedykowanego menu komórki (tylko `CellExpandPopover` na ikonę)

### 4.3 Menu kolumny (`colContextMenu`, ~3128-3170) — dla porównania, już bliżej kompletu

Dziś: Rename (`editingHeaderKey`) · Sort (`effectiveCycleSort`) · Hide (`toggleColumn`) · Delete column. Brakuje: Insert column left/right, Duplicate column, Edit field type/options z menu (dziś pewnie przez `AddColumnDialog`/`FieldManager` osobno — do potwierdzenia). **[NICE]** dopełnić.

---

## 5. K8 ELEGANCJA — wygląd do dorównania Airtable

| Wymiar | Airtable | Nasz stan (wg analizy renderu 2026-07-22 + kodu) | MUST/NICE |
|---|---|---|---|
| Gęstość wiersza | kompaktowa, opcja short/medium/tall | `rowHeight: 'short'\|'medium'\|'tall'` istnieje w `ViewConfig` — sprawdzić czy UI-przełącznik jest widoczny | **NICE** potwierdzić UI |
| Nagłówki kolumn | szare tło, ikona typu przed nazwą, sort-strzałka po prawej | ikona typu per kolumna — do potwierdzenia w renderze (Faza 3 harness wizualny) | **MUST** |
| Hover states | podświetlenie wiersza/komórki na hover, uchwyty pojawiają się na hover | `group/row`, `group/cell`, opacity-0→70/100 na hover potwierdzone w kodzie (`InlineAIFill`) — kierunek dobry | gotowe (jakość wizualna — Faza 4) |
| Empty state | ilustracja + CTA „Add your first record” | do potwierdzenia — `EmptyStateView.tsx` istnieje w katalogu | **MUST** potwierdzić treść/wygląd |
| Kolor „AI Fill” / akcenty | neutralne akcenty produktu, AI ma własny spójny akcent (fioletowy/niebieski), NIGDY czerwień-ostrzegawcza dla akcji pozytywnej | kod używa `text-c-accent`/`bg-c-accent-soft` (token, nie literalny crimson) w `InlineAIFill.tsx`, ALE dowód-render z `_ANALIZA_IDEE_4_NARZEDZIA_2026-07-22.md` §5.4 zgłasza „AI Fill” na czerwono na żywym ekranie — **rozbieżność do wyjaśnienia**: albo token `c-accent` mapuje się dziś na crimson w aktywnym motywie, albo inny element (nie `InlineAIFill`) jest źródłem czerwieni. Wymaga weryfikacji WZROKIEM (zrzut), nie tylko grep kodu | **MUST** — zbadać w Fazie 4 zanim ruszy poprawka |
| Ikony typów pól | spójna ikonografia (Aa dla text, # dla number, ⌄ dla select...) | do potwierdzenia | **MUST** |
| Zero gimmicków | brak animacji/orbów nie-informacyjnych | Tabela nie ma zgłoszonego gimmicku (w przeciwieństwie do orbu Mind Mapy) — czysto | gotowe |

---

## 6. NASZ STAN PRZED vs LIDER — skrót decyzyjny

| Wymaganie | Airtable | My dziś | Luka |
|---|---|---|---|
| Edycja komórki klik/dwuklik | natychmiastowa, bez tarcia | mechanizm jest (`CellEditor`), płynność niezmierzona | ❓ do zmierzenia |
| Nawigacja Tab/Enter/strzałki między komórkami | pełna, jak arkusz | brak (tylko Enter na polach nazw widoku/nagłówka) | 🔴 MUST |
| Zaznaczanie zakresu + kopiuj/wklej zakresu | pełne, kompatybilne z Excelem | tylko copy CAŁEJ tabeli, brak zakresu | 🔴 MUST |
| Fill handle (wypełnianie wzorem w dół) | tak | brak — mamy AI-fill (inna filozofia) | 🔴 MUST (lub decyzja świadoma) |
| Drag-reorder wierszy | tak | brak potwierdzony w gridzie | 🔴 MUST |
| Drag-reorder / resize kolumn | tak | ✅ oba potwierdzone w kodzie | ✅ brak luki |
| Typy komórek | ~15 typów | ~18 typów (+ specjalne consultingowe), brak „User/Assignee” ręcznego | 🟡 1 luka MUST |
| Widoki (grid/kanban/kalendarz/timeline/gallery) | wszystkie | wszystkie podłączone, naming „grid”≠„gallery” do uporządkowania | 🟡 NICE (naming) |
| Prawy-klik wiersza | insert/duplicate/delete/expand/copy/color/comment (7+) | 4 pozycje (Edit/Add note/Duplicate/Delete) | 🔴 MUST — największa luka operacyjna |
| Prawy-klik komórki | copy/paste/clear/expand | brak menu, tylko ikona expand na hover | 🔴 MUST |
| Kolor wiersza ręczny | tak, z prawego-kliku | tylko reguła warunkowa (`RowColoringConfig`), nie ręczny wybór per wiersz | 🔴 MUST |
| Sortowanie/filtrowanie/grupowanie | pełne | wszystkie trzy potwierdzone w kodzie | ✅ brak luki |
| Rozwijany rekord (expand) | panel pełny | `RecordExpandModal` + `RowDetailPanel` potwierdzone | ✅ brak luki |
| Elegancja wizualna (K8) | referencyjna | crimson-leak zgłoszony na „AI Fill” (do zweryfikowania wzrokiem), gęstość/ikony niezweryfikowane | 🟡 do harnessu wizualnego Fazy 4 |

---

## 7. Legenda tagów

- **[MUST]** — brak boli klienta bezpośrednio przy codziennej pracy z tabelą (parytet z liderem, bez tego „nie czuje się jak Airtable”). Wchodzi do Fazy 3.
- **[NICE]** — poprawia dopełnienie/estetykę, nie blokuje podstawowej pracy. Może wejść w Fazie 3 lub później.
- **❓ do zmierzenia** — wymaga harnessu interakcji (nie samego grepu kodu) z `_ANALIZA_IDEE_4_NARZEDZIA_2026-07-22.md` §6 Faza 0.

**Zasada odbioru (przypomnienie z CLAUDE.md):** żadna z tych pozycji nie wchodzi na demo bez prototypu → wstępny OK Piotra → render własny ze zrzutem → dopiero wtedy Piotr ocenia na czysto. Ten dokument to SPECYFIKACJA WYMAGAŃ (Faza 0), nie plan wdrożenia UI (to Faza 3).
