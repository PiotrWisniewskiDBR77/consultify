# Plan migracji UI do "Tech Sexy" v2.0

> **Data:** 2026-02-15  
> **Autor:** AI Design System Audit  
> **Podejście:** Ewolucja, nie rewolucja. Małe, bezpieczne kroki. Każdy krok zamykany osobnym PR.

---

## Filozofia zmian

Nie zmieniamy architektury komponentów, layoutu, ani funkcjonalności.  
Zmieniamy **wyłącznie warstwę wizualną** — bordery, tła, hover states, cienie, typografię.  
Każda zmiana jest **odwracalna** i nie wymaga zmian w logice biznesowej.

---

## Faza 1: NModeLayout Shell (Critical) — "The skeleton"

Najpierw naprawiamy szkielet, bo wpływa na **każdy** artifact detail view.

### 1.1 NModeHeader.tsx — usunięcie borderów i shadow

| Co                      | Obecny stan                                             | Cel v2.0                                                    |
| ----------------------- | ------------------------------------------------------- | ----------------------------------------------------------- |
| Border kontenera        | `border border-slate-200/60 dark:border-navy-700/60`    | **Usunąć** — separacja przez bg Layer 1                     |
| Shadow                  | `shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50` | **Usunąć** domyślny, dodać sticky elevation on scroll       |
| Font title              | `font-bold`                                             | `font-semibold`                                             |
| Hover back button       | `hover:text-slate-600 dark:hover:text-white`            | `hover:bg-slate-100/80 dark:hover:bg-navy-800/60` (bg-only) |
| Border na Save/Chat btn | `border border-blue-500/40...`                          | **Usunąć** border, zostawić bg                              |
| Shadow na buttonach     | `shadow-sm`                                             | **Usunąć**                                                  |

**Wpływ:** Wszystkie detail views (Task, Decision, Initiative, Notification)  
**Ryzyko:** Niskie — zmiana czysto wizualna  
**Effort:** ~30 min

### 1.2 NModeLeftNav.tsx — usunięcie border-right

| Co                 | Obecny stan                                            | Cel v2.0                                                                                  |
| ------------------ | ------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Border-right       | `border-r border-slate-200/40 dark:border-navy-700/40` | **Usunąć** — sidebar jest ciemniejszy = separacja przez bg                                |
| Hover items        | `hover:text-slate-800 dark:hover:text-slate-200`       | **Dodać** `hover:bg-slate-100/80 dark:hover:bg-navy-800/60`, **usunąć** text color change |
| Active border-left | `border-l-2 border-primary-500`                        | Zachować (dozwolony accent)                                                               |

**Wpływ:** Wszystkie N-mode artifact views  
**Ryzyko:** Niskie  
**Effort:** ~15 min

### 1.3 NModePropertiesStrip.tsx — usunięcie border kontenera

| Co                      | Obecny stan                                          | Cel v2.0                                |
| ----------------------- | ---------------------------------------------------- | --------------------------------------- |
| Border kontenera        | `border border-slate-200/60 dark:border-navy-700/60` | **Usunąć** — separacja przez bg Layer 2 |
| Borders na input fields | `border border-slate-200/60 dark:border-navy-600/60` | **Zachować** (input fields dozwolone)   |

**Wpływ:** Wszystkie detail views  
**Ryzyko:** Niskie  
**Effort:** ~10 min

### 1.4 NModeShell.tsx — usunięcie border z ActionBar

| Co               | Obecny stan                                          | Cel v2.0                              |
| ---------------- | ---------------------------------------------------- | ------------------------------------- |
| ActionBar border | `border border-slate-200/60 dark:border-navy-700/60` | **Usunąć** — separacja przez bg shift |

**Effort:** ~5 min

---

## Faza 2: NModeBlocks — "The building blocks"

### 2.1 Callout.tsx — border removal

| Co                    | Obecny stan                                       | Cel v2.0                                                     |
| --------------------- | ------------------------------------------------- | ------------------------------------------------------------ |
| Borders na wariantach | `border-blue-200/60`, `border-amber-200/60`, etc. | **Usunąć** — callout odróżnia się tłem i ikoną, nie borderem |
| Rounding              | Sprawdzić spójność z v2.0 table                   | Kontekstowe — callout = `rounded-xl`                         |

**Effort:** ~15 min

---

## Faza 3: Tailwind / CSS globals — "The foundation"

### 3.1 src/index.css — Admin styles refinement

Klasy admin-\* używają widocznych borderów. Przejść na v2.0:

- `admin-card`: usunąć `border border-slate-200 dark:border-white/10`, dodać bg Layer 2
- `admin-metric`: analogicznie
- `admin-table th/td`: zachować subtelny `border-bottom` (table rows dozwolone)
- `admin-section-header`: zamienić border-bottom na spacing

**Effort:** ~30 min  
**Ryzyko:** Niskie — admin panel jest mniej widoczny

### 3.2 tailwind.config.js — dodanie nowych utility tokenów

Dodać custom utilities ułatwiające v2.0:

```js
// Hover utilities
'hover-surface': 'bg-white/[0.03]',
'hover-surface-active': 'bg-white/[0.06]',
// Layer system
'layer-0': 'bg-navy-950',
'layer-1': 'bg-navy-900',
'layer-2': 'bg-navy-800/50',
'layer-3': 'bg-navy-800',
```

**Effort:** ~15 min

---

## Faza 4: Sidebar (global app) — "First impression"

### 4.1 Główny sidebar aplikacji

Sprawdzić i zaktualizować:

- Usunąć `border-right` jeśli istnieje
- Sidebar bg = Layer 0 (`bg-navy-950`)
- Content area bg = Layer 1 (`bg-navy-900`)
- Sekcja labels (np. "SPACES", "MODULES"): `uppercase`, `text-[11px]`, `text-muted`, `mt-6 mb-2`
- Hover na nav items: bg-only, `rounded-lg`
- Ikony: sprawdzić czy outline, mono-weight

**Effort:** ~45 min  
**Ryzyko:** Średnie — sidebar widoczny wszędzie

---

## Faza 5: ModuleHub i tabele — "The workspace"

### 5.1 ModuleHub views

- Usunąć bordery z kart/kontenerów
- Tabele: zachować subtelny `border-bottom` na rows
- Toolbar controls: sprawdzić hover styles (bg-only)
- Search expandable: `rounded-xl`, bez borderu, bg Layer 2

### 5.2 App Table Standard

- Row borders: zmniejszyć opacity (`border-white/[0.03]`)
- Header row: separacja przez font-weight + spacing, nie border
- Hover row: `bg-white/[0.03]` bg-only

**Effort:** ~1h  
**Ryzyko:** Niskie-średnie

---

## Faza 6: Typography audit — "The polish"

### 6.1 Global font-bold → font-semibold

Przeszukać codebase i zamienić:

- `font-bold` na nagłówkach → `font-semibold`
- Zachować `font-bold` TYLKO w edge cases (np. price display, critical alert)

### 6.2 Text color refinement

- Zamienić `text-white` na `text-slate-100` w dark mode headings
- Sprawdzić czy nie ma `#000000` / `#ffffff` hardcoded

**Effort:** ~1h  
**Ryzyko:** Niskie

---

## Faza 7: Motion refinement — "The breath"

### 7.1 Modal/dropdown open animation

Sprawdzić i ustawić standard:

- Open: `200ms scale from 0.95 + opacity 0→1`
- Close: `150ms scale to 0.95 + opacity 1→0`
- Easing: `ease-out`

### 7.2 Hover transitions

Sprawdzić globalnie:

- Wszystkie hover mają `transition-colors duration-150 ease-out`
- Brak "nagłych" zmian bez transition

**Effort:** ~30 min  
**Ryzyko:** Niskie

---

## Kolejność realizacji (zalecana)

| Priorytet | Faza                       | Effort  | Wpływ wizualny              | PR            |
| --------- | -------------------------- | ------- | --------------------------- | ------------- |
| 1         | Faza 1 (NModeLayout Shell) | ~1h     | Ogromny — każdy detail view | PR #1         |
| 2         | Faza 2 (NModeBlocks)       | ~15 min | Średni                      | PR #1 (razem) |
| 3         | Faza 3.2 (Tailwind tokens) | ~15 min | Fundament                   | PR #1 (razem) |
| 4         | Faza 4 (Sidebar)           | ~45 min | Ogromny — first impression  | PR #2         |
| 5         | Faza 6 (Typography)        | ~1h     | Subtelny ale pervasive      | PR #3         |
| 6         | Faza 5 (ModuleHub/tabele)  | ~1h     | Średni                      | PR #4         |
| 7         | Faza 3.1 (Admin CSS)       | ~30 min | Niski (admin panel)         | PR #5         |
| 8         | Faza 7 (Motion)            | ~30 min | Subtelny                    | PR #5 (razem) |

**Sumaryczny effort:** ~5-6h roboczych  
**Liczba PR-ów:** ~5  
**Zero zmian w logice biznesowej.**

---

## Zasada bezpieczeństwa

Każda faza:

1. Robimy zmianę
2. Sprawdzamy wizualnie w dark + light mode
3. Sprawdzamy czy nie zepsuliśmy kontrastu (WCAG AA)
4. Commitujemy
5. Jeśli coś wygląda źle — revert jest prosty (tylko klasy Tailwind)

---

## Co NIE jest w zakresie tego planu

- Zmiana layoutu (zachowujemy 4-layer shell, N/C mode, 220px sidebar)
- Zmiana komponentów funkcjonalnych
- Nowe biblioteki/zależności
- Zmiana routingu, API, logiki biznesowej
- Redesign od zera — to jest refinement, nie rewrite
