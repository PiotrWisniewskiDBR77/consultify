# NModeBlocks — Building Blocks

> **Lokalizacja:** `docs/ui-standards/02-components/building-blocks.md`  
> **Katalog komponentów:** `src/components/shared/NModeBlocks/`

Niskopoziomowe bloki UI do wielokrotnego użytku WEWNĄTRZ sekcji i w dowolnym kontekście N-mode.

---

## 6c.1 Callout

Blok informacyjny z wariantami wizualnymi.

| Prop       | Typ                                                          | Opis                      |
| ---------- | ------------------------------------------------------------ | ------------------------- |
| `variant`  | `'info' \| 'warning' \| 'critical' \| 'success' \| 'purple'` | Wariant wizualny          |
| `icon`     | `LucideIcon`                                                 | Custom ikona (opcjonalna) |
| `title`    | `string`                                                     | Nagłówek (opcjonalny)     |
| `children` | `ReactNode`                                                  | Treść callout             |
| `compact`  | `boolean`                                                    | Mniejszy padding i tekst  |
| `action`   | `{ label, onClick }`                                         | Opcjonalny link/przycisk  |

---

## 6c.2 ToggleBlock

Expandable/collapsible blok. Controlled lub uncontrolled.

| Prop          | Typ                       | Opis                       |
| ------------- | ------------------------- | -------------------------- |
| `title`       | `string`                  | Nagłówek                   |
| `badge`       | `string \| number`        | Badge obok tytułu          |
| `defaultOpen` | `boolean`                 | Start state (uncontrolled) |
| `open`        | `boolean`                 | Controlled state           |
| `onToggle`    | `(open: boolean) => void` | Toggle handler             |
| `icon`        | `ReactNode`               | Ikona przed tytułem        |
| `children`    | `ReactNode`               | Treść                      |

---

## 6c.3 EmptyStateInline

Empty state w obrębie sekcji z CTA.

| Prop      | Typ                            | Opis                          |
| --------- | ------------------------------ | ----------------------------- |
| `icon`    | `LucideIcon`                   | Ikona (default: Inbox)        |
| `message` | `string`                       | Główna wiadomość              |
| `hint`    | `string`                       | Dodatkowa wskazówka           |
| `action`  | `{ label, onClick, disabled }` | CTA button                    |
| `dashed`  | `boolean`                      | Border dashed (default: true) |

---

## 6c.4 ChecklistBlock

Interaktywna checklista z progress tracking.

| Prop             | Typ                  | Opis                               |
| ---------------- | -------------------- | ---------------------------------- |
| `items`          | `ChecklistItem[]`    | Lista elementów                    |
| `onToggle`       | `(id) => void`       | Toggle completion                  |
| `onUpdateText`   | `(id, text) => void` | Edycja tekstu                      |
| `onAdd`          | `() => void`         | Dodaj element                      |
| `onRemove`       | `(id) => void`       | Usuń element                       |
| `onAIGenerate`   | `() => void`         | AI generate (opcjonalny)           |
| `isGeneratingAI` | `boolean`            | AI loading state                   |
| `locked`         | `boolean`            | Read-only                          |
| `showProgress`   | `boolean`            | Pokaż progress bar (default: true) |

---

## 6c.5 InlineTable

Lekka tabela (bez sortowania, bez paginacji).

| Prop           | Typ                      | Opis                        |
| -------------- | ------------------------ | --------------------------- |
| `columns`      | `InlineTableColumn<T>[]` | Definicje kolumn z renderem |
| `data`         | `T[]`                    | Dane wierszy                |
| `rowKey`       | `(row, idx) => string`   | Key extractor               |
| `emptyMessage` | `string`                 | Wiadomość pustego stanu     |
| `caption`      | `string`                 | Nagłówek tabeli             |
| `compact`      | `boolean`                | Mniejszy padding            |
| `striped`      | `boolean`                | Paski na wierszach          |

---

## 6c.6 EmbeddedView

Embedded list/table z mini toolbar (linked database style).

| Prop           | Typ                  | Opis                       |
| -------------- | -------------------- | -------------------------- |
| `title`        | `string`             | Tytuł sekcji               |
| `count`        | `number`             | Badge z liczbą elementów   |
| `viewModes`    | `EmbeddedViewMode[]` | Dostępne widoki            |
| `activeMode`   | `EmbeddedViewMode`   | Aktualny widok             |
| `onModeChange` | `(mode) => void`     | Zmiana widoku              |
| `onAdd`        | `() => void`         | Dodaj nowy element         |
| `onLink`       | `() => void`         | Połącz istniejący          |
| `onOpenFull`   | `() => void`         | Otwórz pełny widok         |
| `onSearch`     | `(query) => void`    | Szukaj                     |
| `onFilter`     | `() => void`         | Filtruj                    |
| `onSort`       | `() => void`         | Sortuj                     |
| `readOnly`     | `boolean`            | Read-only                  |
| `loading`      | `boolean`            | Loading overlay            |
| `children`     | `ReactNode`          | Treść (lista/tabela/board) |

---

## Zasady użycia

- **PREFEROWANE:** Użyj `Callout` zamiast ad-hoc `div` z kolorami warning/error
- **PREFEROWANE:** Użyj `EmptyStateInline` zamiast inline empty state w sekcjach
- **PREFEROWANE:** Użyj `ToggleBlock` zamiast custom expand/collapse
- **PREFEROWANE:** Użyj `InlineTable` zamiast inline `<table>` z custom headerami
- **PREFEROWANE:** Użyj `ChecklistBlock` zamiast inline checklist z progress bar
- **PREFEROWANE:** Użyj `EmbeddedView` zamiast inline list z toolbar

---

## ChecklistBlock presentation (standard)

- Jedyny manualny add action: top-right `+ Add item` (bez duplikatu pod listą)
- W stanie pustym renderowany jest 1 domyślny pusty wiersz do edycji
- Na hover elementu listy ujawnia się usuwanie (ikona kosza)
- Widoczny licznik postępu (`done/total`) obok nagłówka sekcji
