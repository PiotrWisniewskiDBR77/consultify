# Golden Standard v3 — Table + Cards + Preview

> **Status:** Canon (Sprint 1)  
> **Cel:** Jeden, konsekwentny standard dla **wszystkich miejsc**, gdzie użytkownik pracuje na kolekcjach danych: **Table**, **Cards/Grid**, oraz **Table+Preview (Outlook style)**.
>
> **SSOT (kod):**
> - **Cards/Grid**: `src/components/shared/ModuleHub/GridView.tsx`
> - **Table (huby)**: `src/components/shared/ModuleHub/FilterableTable.tsx` + `src/components/shared/ModuleHub/ModuleNavBar.tsx`
> - **Table+Preview layout**: `src/components/shared/TableWithPreviewLayout.tsx` + `src/components/ui/ResizableTable/PreviewPaneShell.tsx`
> - **MyWork Inbox (Preview)**: `src/components/MyWork/InboxContent.tsx` (referencja anatomii + spacing + footer zones)

## 1) Zasady nadrzędne (MUST)

- **Jedna anatomia** w całej aplikacji: użytkownik ma widzieć te same strefy i te same zachowania.
- **Monochromatic chrome**: UI wokół danych jest neutralne; kolor jest sygnałem semantycznym (status/type) — nie “tapetą”.
- **Kebab (⋮) jako overflow menu**: jedna, przewidywalna brama do akcji.
- **Hover = tło**: delikatne podbicie surface, bez agresywnych zmian border/text.
- **Nie dublujemy** toolbarów/filtrów/kolumn: jedno miejsce = Module Topbar + header filters w tabeli.

## 2) Table (standard listy)

### 2.1 Layout “ramy” (MUST)

- `bg-slate-50 dark:bg-navy-950` jako tło modułu/surface
- tabela w “card surface”:
  - `rounded-xl`
  - `bg-white/70 dark:bg-navy-900/70` + `backdrop-blur`
  - `border border-slate-200/70 dark:border-white/[0.06]`
- header tabeli:
  - `text-[11px] uppercase tracking-wider` dla etykiet
  - subtelny divider `border-b`

### 2.2 Interakcje (MUST)

- single click: selection / kontekst (jeśli w module jest preview — otwiera preview)
- double click / Enter: open full
- Esc: close preview (jeśli istnieje)

### 2.3 Actions column (MUST)

- Actions column nie pokazuje tekstu “Actions”; jest neutralna i kończy się kebabem (⋮).

## 3) Cards/Grid (standard kart)

### 3.1 Kiedy używać

- gdy user chce zobaczyć **więcej na raz** (skanowanie)
- gdy tytuł + krótki brief + 2–3 sygnały dają sens bez pełnej tabeli

### 3.2 Anatomia karty (MUST)

Każda karta ma:

- **Accent**: `border-l-[3px]` w kolorze typu/rodziny (tożsamość artefaktu)
- **Header**: typ (pill) + status (dot+label) + kebab (⋮)
- **Title**: 1–2 linie
- **Brief**: 1–2 linie (pierwsza sensowna linia `brief/summary/description`)
- **Signals**: opcjonalnie progress / updatedAt

### 3.3 Tło kart (MUST)

- neutralne, odcinające się od tła listy:
  - `bg-slate-50/80 dark:bg-navy-800/60`
  - hover: `bg-white dark:bg-navy-800/80`

## 4) Table + Preview (Outlook style)

### 4.1 Layout (MUST)

- tabela po lewej (`flex-1`), preview po prawej:
  - width: `clamp(340px, 28%, 480px)`
  - wrapper preview: `bg-slate-50 dark:bg-navy-950` + `p-3` + subtelny divider
  - wewnątrz preview: `PreviewPaneShell` (rounded, blur, header/body/footer)

### 4.2 Anatomia Preview (MUST)

Preview ma zawsze:

- **Header**: tytuł + `Open` + `X`
- **Body (scroll)**: Brief + Details (AI brief / opis)
- **Footer (sticky)**: strefy “AI hints” → divider → “Powiązania” (2 rzędy) → divider → “Akcje”

Wzór spacing/dividers: patrz `MyWork Inbox Preview`.

## 5) Checklist rollout

Każdy moduł, który pokazuje kolekcję elementów, musi:

- używać ModuleHub (tabs/search/view toggle)
- w trybie `grid` renderować `GridView` (SSOT)
- w trybie `table` renderować tabelę w standardowym surface (SSOT)
- jeśli ma preview: używać `TableWithPreviewLayout` + `PreviewPaneShell`

