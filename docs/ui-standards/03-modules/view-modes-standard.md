# View Modes Standard (Table / Cards / Kanban / Timeline(Gantt) / Calendar)

> **Status:** Draft (v3)  
> **Cel:** Jeden kanon przełącznika “układ zestawień” w całej aplikacji.  
> **SSOT w kodzie:** `src/components/shared/ModuleHub/types.ts` (`ViewMode`) + `src/components/shared/ModuleHub/ModuleNavBar.tsx` (UI toggle)

## 1) Definicja

**View mode** to sposób prezentowania *tej samej kolekcji danych* (np. Initiatives, Tasks, Reports, Sessions) w alternatywnych układach.

Kanon v3 zakłada, że:

- view modes są dostępne w prawym górnym rogu topbara modułu (obok CTA “Dodaj …”)
- zmiana view mode **nie zmienia danych**, tylko ich wizualną reprezentację i interakcje
- każdy tryb ma spójne: typografię, kontrast, spacing, semantykę statusów oraz akcje wiersza/karty

## 2) Kanoniczny zestaw trybów (zamknięta lista)

Zgodnie z kodem:

- `table`
- `grid` (cards)
- `kanban`
- `timeline` (Gantt-style)
- `calendar`
- `matrix`

> W module, który nie ma sensownej implementacji danego trybu, tryb jest ukryty przez `availableViewModes`.

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

