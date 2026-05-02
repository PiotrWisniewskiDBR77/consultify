# View Modes Standard (Table / Cards / Kanban / Timeline(Gantt) / Calendar)

> **Status:** Canonical, subordinate to `CONSULTIFY_UI_UX_GOLDEN_STANDARD.md`  
> **Cel:** Jeden kanon przełącznika “układ zestawień” w całej aplikacji.  
> **SSOT w kodzie:** `src/components/shared/ModuleHub/types.ts` (`ViewMode`) + `src/components/shared/ModuleHub/ModuleNavBar.tsx` (UI toggle)

## 1) Definicja

**View mode** to sposób prezentowania *tej samej kolekcji danych* (np. Initiatives, Tasks, Reports, Sessions) w alternatywnych układach.

Kanon v3 zakłada, że:

- view modes są dostępne w prawym górnym rogu topbara modułu (obok CTA “Dodaj …”)
- zmiana view mode **nie zmienia danych**, tylko ich wizualną reprezentację i interakcje
- każdy tryb ma spójne: typografię, kontrast, spacing, semantykę statusów oraz akcje wiersza/karty
- przełącznik view modes jest widocznym segmented icon control, nie dropdown/select

## 2) Kanoniczny zestaw trybów (zamknięta lista)

Zgodnie z kodem:

- `table`
- `grid` (cards)
- `kanban`
- `timeline` (Gantt-style)
- `calendar`
- `matrix`

> W module, który nie ma sensownej implementacji danego trybu, tryb jest ukryty przez `availableViewModes`.

### 2.1 Kanoniczna kolejność ikon (MUST)

Żeby user uczył się aplikacji, przełącznik trybów ma stałą kolejność (pokazujemy tylko te tryby, które są dostępne, ale **kolejność jest zawsze ta sama**):

1. `table` (list) — domyślny i pierwszy
2. `kanban`
3. `timeline`
4. `calendar`
5. `matrix`
6. `grid` (cards)

Reguła: nie wprowadzamy “custom view types” (np. kolejki/review-next) jako elementów view modes. Jeśli istnieją, to są osobnym flow / osobną surface’ą, a nie 4. ikoną obok table/kanban/timeline.

### 2.2 Dwutryb list/cards (MUST)

Jeśli ekran ma tylko dwa tryby `Lista` i `Karty/Grid`, kolejność jest zawsze:

1. `Lista` po lewej.
2. `Karty` / `Grid` po prawej.

Nie używamy dropdownu `Table v` z opcją `Grid`. User ma widzieć oba tryby jako przełączniki.

## 3) Table — kanon (Golden Standard)

Źródło prawdy: `docs/ui-standards/03-modules/app-table-standard.md`.

### 3.1 Minimalny kontrakt tabeli

- **Kompletność**: tabela ma pokazywać wszystkie kluczowe informacje w kolumnach (bez “pustych” widoków).
- **Kontrolki**: topbar ma spójne wysokości (kanon `h-9`).
- **Filtry i sortowanie**:
  - filtry w headerze kolumn (multiselect)
  - resizable columns
- **Akcje wiersza**:
  - max 2 szybkie ikonki + menu (`...`) na resztę
- **Semantyka statusu**:
  - status nie jest “kolorem tekstu”; jest badge/dot + label (wzór jak w `FilterableTable` / `GridView`)

## 4) Cards (Grid) — kanon (kafle/karty)

SSOT w kodzie: `src/components/shared/ModuleHub/GridView.tsx`.

### 4.1 Kiedy używać

- użytkownik chce “przeglądu” i szybkiego skanowania
- elementy są z natury “package’ami” (np. raporty, prezentacje, tool sessions)
- ważna jest okładka / typ / status / progress, mniej ważna pełna tabela

### 4.2 Minimalny kontrakt karty

Każda karta musi mieć 4 strefy:

1. **Meta**: typ (short), kategoria i/lub badge
2. **Title**: jednoznaczna nazwa (1–2 linie)
3. **Signals**: status + progress + “updated”
4. **Actions**: menu (`...`) na hover + opcjonalny primary (np. Open)

Reguły:

- hover zmienia **tło** (nie kolor tekstu) i może dodać subtelny cień (floating)
- status i progress zawsze w tym samym miejscu w karcie (stabilna anatomia)

### 4.3 Card Standard v3 (MUST) — “jeden standard kart w całej aplikacji”

W v3 wprowadzamy **jeden** standard kart (Grid/Cards) dla wszystkich modułów.
To zastępuje “dziwne” karty (np. Inbox Cards) i eliminuje lokalną “twórczość”.

**MUST (anatomia compact):**

- **Header (1 rząd)**:
  - po lewej: typ/ikonka artefaktu (identity)
  - po prawej: status badge/dot (bez kolorowych teł na całą kartę)
- **Title**: 1–2 linie, bez drugiej “duplikującej” linijki
- **Signals (max 1–2)**: np. priority + due, albo progress + updated
- **Actions**:
  - **MUST:** kebab (⋮) jako główne menu akcji (spójne z tabelami)
  - **SHOULD:** 1 szybka akcja (np. Open) tylko jeśli to realnie przyspiesza pracę

**MUST (spójność z hubem):**

- Cards view nie dodaje własnych toolbarów/mini‑pasków (Columns/Views/Start…) — obowiązuje Module Topbar + Filters…
- Cards view respektuje te same filtry/sortowanie co Table
- Klik w kartę nie powinien “gubić” użytkownika: preview/open zachowuje się spójnie z modułem (jeśli w module jest preview pane, selection może sterować preview)

SSOT: `docs/ui-standards/03-modules/app-table-standard.md` (kebab/actions i zakaz duplikacji kontrolek) + `docs/ui-standards/03-modules/table-preview-pane-standard.md` (preview contract)

## 5) Kanban — kanon (tablica)

### 5.1 Kiedy używać

- gdy dane mają naturalny “flow” przez statusy/kolumny
- gdy przenoszenie elementów między kolumnami ma znaczenie operacyjne

### 5.2 Minimalny kontrakt

- stałe kolumny (konfigurowalne per moduł), zawsze czytelne nagłówki
- karta w kanbanie używa tej samej anatomii co `grid`, ale w wersji “compact”
- drag&drop jest funkcją produktywną (nie bajerem):
  - przeniesienie = realna zmiana statusu/kolumny
  - rollback/feedback na błędy zapisu

> UI/UX szczegółowy kanban jest rozwijany per moduł, ale musi trzymać wspólną typografię i semantykę sygnałów.

### 5.3 Drag & drop + uprawnienia (MUST) — “czy mogę przesunąć?”

Kanban wraca w wielu miejscach (Tasks, Focus, Initiatives lifecycle). Musimy mieć jeden, czytelny kontrakt:

#### A) Gdy **można** przenosić (editable)

- karta ma subtelny, ale czytelny “editable affordance”
- **SHOULD:** delikatniejsza/jasna ramka (lub jaśniejszy surface) jako sygnał “można przesuwać”
- drag start ma działać przewidywalnie (bez “złapania przypadkowo” przy scroll)

#### B) Gdy **nie można** przenosić (read-only / brak uprawnień / gate)

- karta wygląda “locked” bez psucia czytelności:
  - **MUST:** ciemniejsza / bardziej neutralna ramka (lub brak editable affordance)
  - **MUST NOT:** nie robimy agresywnych ikon “lock” na każdej karcie (clutter)

#### C) Próba przesunięcia bez uprawnień (MUST)

- **MUST:** natychmiastowy feedback w UI (toast/snackbar) typu:
  - PL: `Nie masz uprawnień do zmiany statusu tego elementu.`
  - EN: `You don’t have permission to move this item.`
- **SHOULD:** jeśli panel czatu “AI w kontekście” jest otwarty, można dodać 1-liniową notkę w czacie
  (ale toast jest obowiązkowy — czat jest opcjonalny).

### 5.4 Ruchy w obrębie kolumny (MUST/SHOULD)

- **MUST (Tasks/Focus):** user może zmieniać kolejność w obrębie kolumny (priorytetyzacja pracy).
- **SHOULD (Inicjatywy):** jeśli lifecycle jest “governance-driven”, reorder i move mogą być ograniczone — wtedy wracamy do reguł 5.3B/5.3C.

### 5.5 Minimalna karta kanban (MUST)

Żeby kanban był “sprzedawalny” i szybki:

- **mała, czytelna karta** (compact)
- pokazuje minimum: `type` + `title` + 1–2 sygnały (np. priority/status/due)
- akcje rozszerzone zawsze w menu (Actions)
- kolor używany jako sygnał (badge/dot), nie jako “kolorowy klocek” całej karty

## 6) Timeline (Gantt) — kanon (timeline/gantt)

### 6.1 Cel

Pokazać zależności czasowe (start/end), obciążenie i konflikt w czasie.

### 6.2 Minimalny kontrakt (v3)

- typografia i semantyka (status/progress) **kopiują** kanon table/cards:
  - te same rozmiary fontów dla nazw
  - te same status badge/dot semantics
- widok ma:
  - oś czasu (dni/tygodnie/miesiące)
  - paski (bars) dla elementów z datami
  - dziś (vertical “today” marker)
- interakcje:
  - klik na bar otwiera element
  - tooltip pokazuje: status, owner, start/end, progress

> W v3 dopuszczamy “timeline minimal” (bez zależności między elementami). Zależności i krytyczna ścieżka to v4+.

### 6.3 Zoom / agregacja (MUST)

Timeline musi wspierać zmianę skali czasu (zoom), minimum:

- **day**
- **week**
- **month**
- **quarter**

To jest kanoniczny “gigant”: user ma w jednym spojrzeniu zobaczyć *kiedy* ma dowieźć zadania/inicjatywy.

**Reguła:** wybór zoom jest częścią **Module Topbar** (view modes / filters), a nie osobnym, dodatkowym paskiem w samym widoku.

### 6.4 Filtry w timeline (MUST)

- **MUST:** filtry priorytetu muszą być **multiselect** (np. medium + critical).
- **MUST:** filtry nie mogą być dublowane w kilku miejscach UI — trzymamy je w `Filters…` + (opcjonalnie) “counter chips” w Command Row.

### 6.5 Lewa kolumna “Task list” (MUST)

Timeline jest czytelny tylko wtedy, gdy ma “nawigację po wierszach”:

- po lewej: **lista elementów** (np. zadania) z tytułem + minimalnymi sygnałami (type/priority/status/due)
- po prawej: oś czasu + bary

Nie budujemy timeline bez lewej listy (bo user nie wie “co to jest”).

### 6.6 Preview (MUST/SHOULD)

- **MUST:** selection w timeline (klik w wiersz lub bar) nie otwiera od razu full detail; otwiera kontekst (preview / selection).
- **SHOULD:** jeśli moduł używa preview pane, timeline wspiera ten sam wzorzec “Open full” + quick actions (spójny z `table-preview-pane-standard.md`).

## 7) Calendar — kanon

### 7.1 Cel

Pokazać elementy jako wydarzenia (due date, meeting, deadline) i planować tydzień/dzień.

### 7.2 Minimalny kontrakt

- event ma:
  - tytuł
  - typ (badge)
  - status (dot/badge)
- interakcje:
  - klik event otwiera element
  - drag event przesuwa datę (jeśli moduł na to pozwala)

## 8) Matrix — kanon

Matrix jest dopuszczalny tylko, jeśli ma klarowną oś X/Y (np. impact × effort).

Minimalny kontrakt:

- osie i legenda są zawsze widoczne
- elementy są klikalne i otwierają detail
- filtr/segregacja elementów jest spójna z table/cards

## 9) Wspólne reguły dla wszystkich trybów

1. **Jedna semantyka statusów** w całej aplikacji (dot/badge + label).
2. **Jedna typografia**: te same skale fontów dla title/meta/helper.
3. **Jedno miejsce akcji**: szybkie akcje + overflow menu.
4. **Dark mode parity**: kontrast i czytelność nie mogą “siąść” w dark mode.
5. **Nie mieszamy** view modes z detail views:
   - view modes = list/collection surfaces (ModuleHub)
   - detail views = N-mode/Workspace/Wizard

  6. **Artifact identity (v3):** kolekcje (tabela/karty/kanban/timeline/calendar) MUSZĄ pokazywać artefakty z tą samą “tożsamością” (ikona + akcent),
     zgodnie z: `docs/ui-standards/00-foundation/artifact-identity-map.md`.

  7. **Light mode readability (MUST):** w light mode zakazane jest zestawienie “jasne tło semantyczne + jasny tekst tego samego koloru”.
     Jeśli używasz semantycznego tła (badge/chip/pill) — tekst musi mieć wystarczający kontrast (WCAG AA) albo musi być neutralny (`text-slate-900`)
     + sygnał (kolor) przeniesiony na ikonę/dot/border.

