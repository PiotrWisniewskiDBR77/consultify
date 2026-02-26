# Table Preview Pane Standard (Table + Preview)

> **Status:** Draft (v3)  
> **Cel:** Jeden kanoniczny wzorzec “tabela + podgląd po prawej” dla wszystkich kolekcji (Decisions, Inbox, Tasks, Initiatives, Reports…).  
> **SSOT (as‑is):** Decisions preview: `src/components/MyWork/DecisionPreviewPanel.tsx` + table: `src/components/MyWork/DecisionsPanelContent.tsx`  
> **Powiązane standardy:** `app-table-standard.md`, `module-hub-standard.md`, `artifact-identity-map.md`

## 1) Definicja

**Preview pane** to **część surface’u tabeli**, a nie osobny “widget”.  
Pozwala na szybki przegląd i podstawowe akcje bez otwierania full detail view.

## 2) Kiedy używamy

- duże listy, gdzie user przegląda wiele pozycji (Outlook style)
- gdy istnieją sensowne “quick actions” (approve/reject/done/save/snooze)
- gdy pełny detail view jest ciężki (N-mode / workspace) i nie powinien otwierać się na każde kliknięcie

## 3) Layout (KANON v3)

### 3.1 Podział szerokości

- **Tabela**: elastyczna (`flex-1`)
- **Preview**:
  - docelowo **20–33%** szerokości content area
  - baseline w px: **~420px** (jak obecnie)
  - `min-width`: 340px (żeby tekst się nie łamał jak w “card spam”)

### 3.2 Warstwy tła + rounding (MUST)

Preview nie może być “gołym border-l”.

Kanon:

- kontener preview (po prawej) ma tło **Layer 1** (`bg-slate-50 dark:bg-navy-950`)
- wewnątrz znajduje się **card** (Layer 2) z:
  - `rounded-xl` (docelowo migracja do `rounded-hig-md`)
  - border zgodny z table card: `border-slate-200 dark:border-navy-700`
  - `bg-white/70 dark:bg-navy-900/70` + opcjonalny `backdrop-blur`

## 4) Anatomia preview (MUST)

Preview ma zawsze 3 warstwy:

1. **Header (sticky)**:
   - kicker: “Preview” / “Podgląd” (uppercase 11px)
   - tytuł encji (1 linia, truncate)
   - **akcje headera**: `Open full` (jeśli ma sens) + `Close (X)`
2. **Body (scroll)**:
   - krótki opis / summary (jeśli jest)
   - “key fields” (2×2 grid lub lista zależnie od encji)
   - artifact identity (ikonka + semantyka statusów/badge/dot)
3. **Footer (sticky)**:
   - quick actions (np. approve/reject, done/save/dismiss, snooze)
   - bez “przycisków znikąd” — każda akcja musi odpowiadać realnemu statusowi/flow

## 5) Interakcje (KANON v3)

- **Single click** na wiersz: ustawia selection i otwiera preview (bez nawigacji do detail).
- **Double click / Enter**: otwiera full detail view.
- **J/K**: nawigacja po wierszach aktualizuje preview.
- **Close (X)**: zamyka preview i przywraca tabeli pełną szerokość.
- Bulk actions nie blokują preview (preview pokazuje ostatnio aktywny element).

## 6) Kontrakt implementacyjny (MUST)

Wszystkie tabele, które mają preview, używają wspólnego shell’a:

- **UI shell**: `src/components/ui/ResizableTable/PreviewPaneShell.tsx`

Wymagane propsy:

- `kicker` (np. Preview / My request)
- `title`
- `actions` (np. Open full)
- `onClose`
- `children` (body)
- `footer` (quick actions)

## 7) Migracja i “cowboy panel” w Initiatives

`InitiativeCompactPanel` jest traktowany jako implementacja przejściowa.  
W v3 docelowo preview w Initiatives ma być zgodny z tym standardem (ten sam shell, ta sama anatomia, te same tokeny).

