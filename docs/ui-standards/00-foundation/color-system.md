# DBR77 Color System Standard

> **Wersja**: 2.1 — "DBR77 Tech Sexy 2027" Edition  
> **Data**: 2026-05-01  
> **Autor**: Consultify Design System  
> **Lokalizacja:** `docs/ui-standards/00-foundation/color-system.md`
>
> **Changelog v2.0:** Doprecyzowanie neutralnych kolorów (nigdy pure black/white), dodanie zasady monochromatycznego UI chrome, refinement tekstu w dark mode.

## Zasada nadrzędna

> **Minimalizm kolorystyczny**: Używamy tylko 4 kolorów semantycznych + neutralne szarości.
> Każdy kolor ma JEDNĄ jasno określoną funkcję. Nie ma wyjątków.
>
> **Zasada monochromatycznego chrome (NOWA):** Cały UI chrome (sidebar, nawigacja, toolbary, headery) jest **monochromatyczny** (skala szarości/navy). Na ekranie jest **maksymalnie 1 kolorowy element** — Primary CTA button. Kolory semantyczne (success/danger/warning) pojawiają się TYLKO przy danych/statusach, nigdy jako dekoracja chrome.

---

## 1. Paleta kolorów DBR77

### 🟣 PRIMARY (Fiolet) - Akcja główna

```css
--color-primary: #7c3aed; /* Main Brand - CTA, Primary buttons */
--color-primary-hover: #6d28d9; /* Hover state */
--color-primary-light: #8b5cf6; /* Light variant */
--color-primary-surface: rgba(124, 58, 237, 0.1); /* Backgrounds */
```

**Zastosowanie:**

- ✅ Główne przyciski akcji (Submit, Save, Create)
- ✅ Aktywne taby i linki
- ✅ Progressy i wskaźniki postępu
- ✅ Focus states
- ❌ NIGDY dla alertów lub błędów

---

### 🔵 SECONDARY (Granatowy/Navy) - Akcja drugorzędna

```css
--color-secondary: #1e3a5f; /* Deep navy - Secondary buttons */
--color-secondary-hover: #0f2744; /* Hover state */
--color-secondary-light: #2e4a6f; /* Light variant */
--color-secondary-surface: rgba(30, 58, 95, 0.1); /* Backgrounds */
```

**Zastosowanie:**

- ✅ Przyciski drugorzędne (Cancel, Back, Close)
- ✅ Nawigacja i sidebar
- ✅ Nagłówki i tekst główny (light mode)
- ✅ Informacyjne elementy UI
- ❌ NIGDY dla akcji destrukcyjnych

---

### 🔴 DANGER (Czerwień) - ZAWSZE alarm

```css
--color-danger: #dc2626; /* Error/Danger - ONLY for alerts */
--color-danger-hover: #b91c1c; /* Hover state */
--color-danger-light: #ef4444; /* Light variant */
--color-danger-surface: rgba(220, 38, 38, 0.1); /* Backgrounds */
```

**Zastosowanie:**

- ✅ Usuwanie/kasowanie danych
- ✅ Błędy i walidacja
- ✅ Statusy krytyczne (Unhealthy, Failed, Error)
- ✅ Alerty wymagające natychmiastowej uwagi
- ❌ NIGDY dla zwykłych przycisków
- ❌ NIGDY dla elementów dekoracyjnych

---

### 🟢 SUCCESS (Szmaragdowy) - Potwierdzenie sukcesu

```css
--color-success: #059669; /* Success - confirmations only */
--color-success-hover: #047857; /* Hover state */
--color-success-light: #10b981; /* Light variant */
--color-success-surface: rgba(5, 150, 105, 0.1); /* Backgrounds */
```

**Zastosowanie:**

- ✅ Status "Healthy", "Active", "UP"
- ✅ Komunikaty sukcesu (Saved, Created, Completed)
- ✅ Pozytywne zmiany (trend ↑)
- ❌ NIGDY dla przycisków akcji
- ❌ NIGDY jako kolor dominujący

---

### 🟡 SIGNAL COLORS (Amber/Blue) — dozwolone wyłącznie jako sygnały (KANON)

DBR77 zakłada 4 kolory semantyczne. W praktyce UI potrzebuje jeszcze dwóch **kolorów sygnałowych**,
ale ich użycie jest ściśle ograniczone.

**Dozwolone:**

- **WARNING / AT RISK**: `amber/*`
- **INFO**: `blue/*`

**MUST:**

- używamy ich tylko jako: **badge/dot/callout**, ewentualnie subtelny background (`*/surface`)
- nie budujemy na nich "brand identity" modułu/ekranu

**MUST NOT:**

- nie używamy ich dla głównych CTA (CTA zawsze `primary/*`)
- nie używamy ich jako stałych kolorów nawigacji/ramek całego panelu

---

### ⚪ NEUTRAL (Szarości Navy) — "Warm darks, soft lights"

**MUST (Dark mode):**

- **Nigdy pure black (`#000000`)** — zawsze warm navy-dark (`#020617` i cieplejsze)
- **Nigdy pure white (`#ffffff`) jako tekst** — najjaśniejszy tekst = `#f1f5f9` (slate-100)
- Te subtelne "ciepłe" odcienie są kluczowe dla premium feel — ekran nie męczy oczu

```css
/* Dark Mode — warm navy grays */
--neutral-950: #020617; /* Deepest background (sidebar) — Layer 0 */
--neutral-900: #0b1121; /* Panel background (content area) — Layer 1 */
--neutral-800: #151e32; /* Elevated surfaces (cards, sections) — Layer 2 */
--neutral-700: #2a3655; /* Borders (tylko gdy konieczne!) */
--neutral-600: #374151; /* Muted text */
--neutral-500: #64748b; /* Secondary text */
--neutral-400: #94a3b8; /* Placeholder, tertiary text */

/* Light Mode */
--neutral-300: #cbd5e1; /* Borders (subtelne) */
--neutral-200: #e2e8f0; /* Hover bg */
--neutral-100: #f1f5f9; /* Subtle bg, sidebar */
--neutral-50: #f8fafc; /* Main bg */
--neutral-0: #ffffff; /* Cards (elevated surfaces) */
```

**Hierarchia tekstu w dark mode (refinement):**

| Rola           | Wartość   | Klasa Tailwind   | Uwaga             |
| -------------- | --------- | ---------------- | ----------------- |
| Primary text   | `#f1f5f9` | `text-slate-100` | NIE `#ffffff`     |
| Secondary text | `#94a3b8` | `text-slate-400` | Opisy, etykiety   |
| Muted/tertiary | `#64748b` | `text-slate-500` | Hinty, timestamps |
| Disabled       | `#475569` | `text-slate-600` | Nieaktywne        |

---

## 2. 📝 ZASADY KOLOROWANIA TEKSTU (Typography)

### 2.1 Hierarchia kolorów tekstu

| Poziom        | Dark Mode | Light Mode | Użycie                                             |
| ------------- | --------- | ---------- | -------------------------------------------------- |
| **Primary**   | `#F1F5F9` | `#0F172A`  | Nagłówki, główna treść (**NIE** `#FFFFFF` w dark!) |
| **Secondary** | `#94A3B8` | `#475569`  | Opisy, etykiety                                    |
| **Muted**     | `#64748B` | `#64748B`  | Hinty, placeholdery                                |
| **Disabled**  | `#475569` | `#94A3B8`  | Nieaktywne elementy                                |

> **v2.0 ZMIANA:** Primary text w dark mode zmieniony z `#FFFFFF` na `#F1F5F9` (slate-100). Pure white jest zbyt ostry i nie pasuje do premium "warm dark" aesthetic. Różnica jest subtelna, ale kluczowa dla premium feel.

### 2.2 Kiedy WOLNO kolorować tekst

| Sytuacja             | Kolor                         | Przykład                    |
| -------------------- | ----------------------------- | --------------------------- |
| **Status pozytywny** | Success `#059669` / `#10B981` | "Active", "Healthy", "+12%" |
| **Status negatywny** | Danger `#DC2626` / `#EF4444`  | "Error", "Failed", "-5%"    |
| **Link/akcja**       | Primary `#7C3AED` / `#8B5CF6` | "View details", "Edit"      |
| **Aktywny tab/item** | Primary `#7C3AED`             | Aktywna pozycja menu        |

### 2.3 Kiedy NIE WOLNO kolorować tekstu

❌ **ZABRONIONE:**

- Kolorowanie zwykłego tekstu treści
- Używanie wielu kolorów w jednym akapicie
- Kolor tekstu bez znaczenia semantycznego
- Czerwony tekst dla zwykłych informacji
- Zielony tekst dla zwykłych danych

### 2.4 Zasady kontrastu tekstu

```
MINIMALNE WYMAGANIA (WCAG 2.1 AA):
├── Tekst normalny (<18px): kontrast ≥ 4.5:1
├── Tekst duży (≥18px lub ≥14px bold): kontrast ≥ 3.0:1
└── Elementy UI (ikony, bordery): kontrast ≥ 3.0:1
```

### 2.5 Sprawdzone kombinacje tekst/tło

| Tło               | Tekst Primary | Tekst Secondary | Kontrast        |
| ----------------- | ------------- | --------------- | --------------- |
| `#020617` (dark)  | `#FFFFFF`     | `#94A3B8`       | 21:1 / 7.5:1 ✅ |
| `#0B1121` (dark)  | `#FFFFFF`     | `#94A3B8`       | 18:1 / 6.8:1 ✅ |
| `#FFFFFF` (light) | `#0F172A`     | `#475569`       | 16:1 / 7.2:1 ✅ |
| `#F8FAFC` (light) | `#0F172A`     | `#475569`       | 15:1 / 6.9:1 ✅ |

### 2.6 Kolorowy tekst - dodatkowe zasady

1. **Kolorowy tekst musi być krótki** - max 3-4 słowa
2. **Zawsze z kontekstem** - ikona lub etykieta obok
3. **Nie tylko kolor** - dla dostępności dodaj ikony (✓, ✕, ⚠️)
4. **Spójność** - ten sam status = ten sam kolor wszędzie

### 2.6a Table Chip Color Usage

Chipy w tabelach są częścią warstwy danych, nie chrome ani CTA. Kolor w chipie służy do szybkiego skanowania znaczenia.

Typy chipów:

- `StatusChip` - status / etap / stan workflow. Kolor dozwolony, ale jako subtelny sygnał. Ikona lub dot może nieść kolor; tekst musi mieć wysoki kontrast.
- `PriorityChip` - priorytet. Jeden wzorzec per moduł: dot/ikona + label. Nie mieszamy dot-only, text-only i pill-only w jednej rodzinie tabel.
- `MetaChip` - tagi, typy, źródła, skróty właścicieli. Zawsze neutralny: `slate/navy`, bez `primary`, `success`, `warning` ani `danger`.
- `ToolChip` - narzędzie / artefakt / tryb pracy. Prawie neutralny; ikona może użyć delikatnego `primary` lub `info`, ale tło nie może wyglądać jak CTA.
- `SlaChip` / `DueChip` - termin, SLA, overdue. Kolor tylko dla ryzyka, overdue i breach. Normalna data jest neutralna.

MUST:

- text contrast: minimum WCAG AA; praktycznie `text-slate-700/800` w light i `text-slate-200/300` w dark,
- light mode: zero “jasne tło + jasny tekst tego samego koloru”,
- dark mode: zero neonowych dużych plam; preferuj `bg-*/10` albo neutralne tło + kolorowa ikona,
- `primary/violet` nie dominuje stale w kolumnie tabeli, chyba że oznacza aktywny stan, focus lub link,
- kolor chipów jest spójny między table, preview i list/card wariantem tego samego modułu.

MUST NOT:

- nie używamy `primary` jako dekoracyjnego koloru metadata,
- nie robimy tagów kolorowych bez semantyki,
- nie używamy wielu lokalnych map kolorów dla tej samej encji w jednym module.

### 2.6b Accepted App Table Color Grid

Status: `APPROVED / ENFORCED`

Ta siatka kolorów została zaakceptowana jako docelowy standard dla referencyjnych tabel App Table. Stosuj ją przy nowych tabelach i przy migracji istniejących tabel po zakończeniu odbioru pozostałych aspektów UI/UX.

Kierunek: ClickUp High Contrast + DBR77 Tech Sexy 2027. Stan ma być widoczny natychmiast, ale nadal premium: mocny kontrast, brandowy akcent, bez neonów i bez szarych legacy belek.

#### Table Surface

| Element | Light mode | Dark mode |
|---|---|---|
| Table scroll surface | `bg-slate-50/40` | `dark:bg-navy-950` |
| Default row | `bg-white` | `dark:bg-navy-950` |
| Row hover | `hover:bg-slate-100/80` | `dark:hover:bg-white/[0.04]` |
| Header | `bg-slate-100/95` + `shadow-[0_1px_0_rgba(15,23,42,0.08)]` | `dark:bg-navy-900` + `dark:shadow-[0_1px_0_rgba(255,255,255,0.10)]` |
| Row separator | `border-slate-200/95` | `dark:border-white/[0.085]` |
| Header separator | `border-slate-300/70` | `dark:border-white/[0.10]` |

#### Row State Grid

| State | Light mode | Dark mode | Accent |
|---|---|---|---|
| Selected / preview | `bg-primary-200/70` + `shadow-[inset_0_0_0_1px_rgba(124,58,237,0.28),inset_4px_0_0_rgba(124,58,237,0.95)]` | `dark:bg-primary-500/[0.20]` + `dark:shadow-[inset_0_0_0_1px_rgba(196,181,253,0.30),inset_4px_0_0_rgba(196,181,253,0.95)]` | `bg-primary-600 dark:bg-primary-300` |
| Focused row | `bg-primary-100/95` + `shadow-[inset_0_0_0_1px_rgba(124,58,237,0.24),inset_4px_0_0_rgba(124,58,237,0.82)]` | `dark:bg-primary-500/[0.16]` + `dark:shadow-[inset_0_0_0_1px_rgba(196,181,253,0.24),inset_4px_0_0_rgba(196,181,253,0.80)]` | `bg-primary-500 dark:bg-primary-300` |
| Checked / multi-select | `bg-primary-100/85` + `shadow-[inset_0_0_0_1px_rgba(124,58,237,0.18),inset_4px_0_0_rgba(124,58,237,0.75)]` | `dark:bg-primary-500/[0.13]` + `dark:shadow-[inset_0_0_0_1px_rgba(196,181,253,0.20),inset_4px_0_0_rgba(196,181,253,0.70)]` | `bg-primary-500 dark:bg-primary-300` |

MUST:

- Selected/focused row uses `primary/violet-blue`, never random cyan/amber/gray.
- The left accent is `4px` for reference App Tables.
- A state that is only technically present but invisible on a screenshot is not accepted.
- Do not replace this grid with local module colors. If a table needs a new state, document it here first.

#### Table Text

| Element | Light mode | Dark mode |
|---|---|---|
| Row primary title | `text-slate-950` | `dark:text-slate-100` |
| Row secondary text | `text-slate-600` | `dark:text-slate-400` |
| Row secondary hover | `group-hover:text-slate-700` | `dark:group-hover:text-slate-300` |
| Header label | `text-slate-600` | `dark:text-slate-300` |
| Date / quiet metadata | `text-slate-600` | `dark:text-slate-400` |

#### Table Chip Grid

| Chip type | Light mode | Dark mode |
|---|---|---|
| Tool / neutral chip | `border-slate-300/80 bg-slate-100 text-slate-800` | `dark:border-white/[0.11] dark:bg-white/[0.075] dark:text-slate-100` |
| Meta tag chip | `border-slate-300/80 bg-slate-100 text-slate-800` | `dark:border-white/[0.10] dark:bg-white/[0.065] dark:text-slate-200` |
| Amber status | `border-amber-300/80 bg-amber-50 text-amber-900` | `dark:border-amber-300/[0.25] dark:bg-amber-300/[0.12] dark:text-amber-100` |
| Emerald status | `border-emerald-300/80 bg-emerald-50 text-emerald-900` | `dark:border-emerald-300/[0.25] dark:bg-emerald-300/[0.12] dark:text-emerald-100` |
| Blue status | `border-blue-300/80 bg-blue-50 text-blue-900` | `dark:border-blue-300/[0.25] dark:bg-blue-300/[0.12] dark:text-blue-100` |
| Violet status | `border-violet-300/80 bg-violet-50 text-violet-900` | `dark:border-violet-300/[0.25] dark:bg-violet-300/[0.12] dark:text-violet-100` |
| Rose status | `border-rose-300/80 bg-rose-50 text-rose-900` | `dark:border-rose-300/[0.25] dark:bg-rose-300/[0.12] dark:text-rose-100` |

MUST NOT:

- Do not use unstable shorthand opacity when it is not generated reliably by Tailwind. Prefer explicit arbitrary opacity like `dark:bg-primary-500/[0.20]`.
- Do not use bright full-row fills for non-selected states.
- Do not use `primary/violet` as decorative metadata chip background.

### 2.6c DBR77 2027 canonical semantic status map (global)

Status: `APPROVED / ENFORCED`

This is the only allowed semantic status map for Consultify App Tables.

| Semantic bucket | Palette | Examples |
|---|---|---|
| Neutral state | `slate` | `draft`, `paused`, `archived`, neutral informational statuses |
| Active execution | `blue` | `assigned`, `in_progress`, `working`, `started` |
| Pending attention/review | `amber` | `submitted`, `in_review`, `pending_review`, `generating`, near due |
| Positive completion | `emerald` | `approved`, `completed`, `accepted`, `promoted` |
| Risk/failure | `rose` | `failed`, `rejected`, `sent_back`, `blocked`, overdue |
| Selection/focus only | `primary/violet` | selected/focused/checked row state, focus ring, primary CTA |

MUST:

- Map every table status to one of the buckets above.
- Keep the same mapping for table rows, preview pane, and list/card variants in the same module.
- Keep `MetaChip` and `ToolChip` neutral by default.

MUST NOT:

- Do not create module-local seventh/eighth status palettes.
- Do not use `primary/violet` as decorative status or metadata fill.
- Do not keep conflicting old color maps after migration.

If any older section in this file conflicts with this map for App Tables, this section wins.

### 2.7 Przykłady poprawnego użycia

```jsx
// ✅ DOBRZE - Status z ikoną
<span className="text-success flex items-center gap-1">
  <CheckIcon /> Active
</span>

// ✅ DOBRZE - Trend z kontekstem
<span className="text-success">↑ 12%</span>
<span className="text-danger">↓ 5%</span>

// ✅ DOBRZE - Link/akcja
<button className="text-primary hover:text-primary-hover">
  View details →
</button>

// ❌ ŹLE - Kolorowy tekst bez znaczenia
<p className="text-primary">This is regular paragraph text</p>

// ❌ ŹLE - Wiele kolorów
<p>
  <span className="text-success">Green</span> and
  <span className="text-danger">red</span> and
  <span className="text-primary">purple</span>
</p>
```

---

## 3. Hierarchia przycisków

| Wariant       | Kolor         | Użycie                  | Przykład                   |
| ------------- | ------------- | ----------------------- | -------------------------- |
| **Primary**   | Fiolet        | Główna akcja na stronie | "Save", "Create", "Submit" |
| **Secondary** | Navy/Outline  | Akcja drugorzędna       | "Cancel", "Back", "Close"  |
| **Ghost**     | Transparentny | Akcja trzeciorzędna     | "Edit", "View", linki      |
| **Danger**    | Czerwony      | TYLKO destrukcyjne      | "Delete", "Remove"         |

### Zasady:

1. **Jedna strona = Jeden Primary Button**
2. **Danger button wymaga potwierdzenia** (modal/dialog)
3. **Ghost buttons** nie mają tła, tylko tekst + ikona
4. **Brak przycisków Success** - używamy Primary z ikoną ✓

---

## 4. Statusy i badges

| Status             | Kolor   | Tekst Dark | Tekst Light | Tło Surface             |
| ------------------ | ------- | ---------- | ----------- | ----------------------- |
| Active/Healthy     | Success | `#10B981`  | `#059669`   | `rgba(5,150,105,0.1)`   |
| Pending/Processing | Primary | `#A78BFA`  | `#7C3AED`   | `rgba(124,58,237,0.1)`  |
| Inactive/Disabled  | Neutral | `#64748B`  | `#94A3B8`   | `rgba(100,116,139,0.1)` |
| Error/Failed       | Danger  | `#EF4444`  | `#DC2626`   | `rgba(220,38,38,0.1)`   |

### ❌ USUNIĘTE:

- ~~Warning/Orange~~ → Zastąpione przez tekst informacyjny + ikona ⚠️
- ~~Info/Blue~~ → Zastąpione przez Secondary + ikona ℹ️

---

## 5. Formularze - kolorowanie

```css
/* Normal state */
border-color: var(--neutral-300);
color: var(--text-primary);

/* Focus state */
border-color: var(--color-primary);
box-shadow: 0 0 0 3px var(--color-primary-surface);

/* Error state */
border-color: var(--color-danger);
color: var(--text-primary); /* Tekst pozostaje normalny! */
/* Komunikat błędu pod inputem */
.error-message {
  color: var(--color-danger);
}

/* Success state (po walidacji) */
border-color: var(--color-success);
```

**Ważne:** Sam tekst w input pozostaje w normalnym kolorze. Kolorujemy tylko:

- Border inputa
- Ikonę walidacji
- Komunikat błędu/sukcesu POD inputem

---

## 6. Implementacja CSS Classes

### Klasy tekstowe

```css
/* Primary text colors */
.text-primary {
  color: var(--text-primary);
} /* Main content */
.text-secondary {
  color: var(--text-secondary);
} /* Descriptions */
.text-muted {
  color: var(--text-muted);
} /* Hints */
.text-disabled {
  color: var(--text-disabled);
} /* Disabled */

/* Semantic text colors - USE SPARINGLY */
.text-brand {
  color: var(--color-primary);
} /* Links, actions */
.text-success {
  color: var(--color-success);
} /* Positive status */
.text-danger {
  color: var(--color-danger);
} /* Errors, negative */
```

---

## 7. Zakaz użycia

### ❌ ZABRONIONE kolory:

- Pomarańczowy (#F59E0B) - zbyt podobny do czerwonego
- Żółty (#FFC107) - słaba widoczność
- Różowy (#EC4899) - spoza palety
- Cyan (#06B6D4) - spoza palety
- Dowolne inne kolory spoza palety

### ❌ ZABRONIONE kombinacje tekstu:

- Czerwony tekst na zielonym tle (i odwrotnie)
- Jasny tekst na jasnym tle
- Kolorowy tekst bez znaczenia semantycznego
- Więcej niż 2 kolory tekstu w jednym komponencie

---

## 8. Checklist przed merge

- [ ] Czy używam tylko 4 kolorów semantycznych?
- [ ] Czy czerwień jest TYLKO dla błędów/destrukcji?
- [ ] Czy kolorowy tekst ma znaczenie semantyczne?
- [ ] Czy kolorowy tekst jest krótki (max 3-4 słowa)?
- [ ] Czy jest ikona/kontekst przy kolorowym tekście?
- [ ] Czy kontrast tekstu spełnia WCAG AA (≥4.5:1)?
- [ ] Czy Primary button jest jeden na stronę?

---

## 9. Migration Guide

### Zamiana starych kolorów na DBR77

| Stary kolor    | Nowy kolor DBR77    | Klasa Tailwind               |
| -------------- | ------------------- | ---------------------------- |
| `blue-500/600` | Primary (fiolet)    | `primary-500`, `primary-600` |
| `orange-500`   | Primary (fiolet)    | `primary-500`                |
| `amber-500`    | Primary (fiolet)    | `primary-500`                |
| `yellow-*`     | Primary lub Neutral | `primary-*` lub `slate-*`    |
| `cyan-*`       | Secondary (navy)    | `secondary-*`                |
| `indigo-*`     | Primary (fiolet)    | `primary-*`                  |
| `green-*`      | Success             | `success-*`                  |
| `red-*`        | Danger              | `danger-*`                   |

### Skrypt migracji (find & replace)

```bash
# W komponentach TSX/JSX:
bg-blue-500 → bg-primary-500
bg-blue-600 → bg-primary-600
text-blue-500 → text-primary-500
border-blue-500 → border-primary-500

bg-orange-500 → bg-primary-500
bg-amber-500 → bg-primary-500
text-amber-400 → text-primary-400

bg-green-500 → bg-success-500
text-green-400 → text-success-400

bg-red-500 → bg-danger-500
text-red-400 → text-danger-400
```

### Checklist migracji komponentu

1. [ ] Zamień `blue-*` na `primary-*`
2. [ ] Zamień `orange/amber/yellow-*` na `primary-*` lub usuń
3. [ ] Zamień `green-*` na `success-*`
4. [ ] Zamień `red-*` na `danger-*`
5. [ ] Sprawdź czy kolorowy tekst ma znaczenie semantyczne
6. [ ] Sprawdź kontrast (min 4.5:1 dla tekstu)
7. [ ] Przetestuj w light i dark mode

---

## 10. Quick Reference Card

```
╔══════════════════════════════════════════════════════════════╗
║                    DBR77 COLOR QUICK REF                     ║
╠══════════════════════════════════════════════════════════════╣
║  🟣 PRIMARY   #7C3AED   Akcje, linki, focus, aktywne taby    ║
║  🔵 SECONDARY #1E3A5F   Cancel, back, info, nawigacja        ║
║  🔴 DANGER    #DC2626   TYLKO: delete, error, failed         ║
║  🟢 SUCCESS   #059669   TYLKO: active, healthy, done         ║
╠══════════════════════════════════════════════════════════════╣
║  TEKST: Nie koloruj bez powodu!                              ║
║  • Kolorowy = status/akcja                                   ║
║  • Max 3-4 słowa                                             ║
║  • Zawsze z ikoną                                            ║
╚══════════════════════════════════════════════════════════════╝
```

---

## 10. Paleta DANYCH — `c-tag` vs `c-chart` vs `c-accent` (VA1)

SSOT tokenów: `--c-*` CSS variables w `src/index.css` (`:root` light + `.dark`),
zmapowane w Tailwind pod namespace `c.*` (np. `bg-c-tag-1`, `text-c-chart-2`).
**Reguła nadrzędna: crimson (brand) NIGDY nie jest daną.**

| Token | Zakres | Rola | Kiedy używać |
|-------|--------|------|--------------|
| `c-accent` (crimson) | 1 | Brand / CTA / selected | Nigdy jako dana, seria ani kategoria. Crimson w danych = dług. |
| `c-success/warning/danger/info` | 4 | SYGNAŁ (status/alarm/kierunek) | Wynik/stan/trend (done, failed, blocked). Nie kategoria. |
| `c-tag-1..12` | 12 | KATEGORIA / TYP / ŹRÓDŁO — równoważne, bezkolejnościowe „kropki" | Chipy typu/tagu/źródła, kategorie osi. ≤5 serii widocznych (§15.1). |
| `c-chart-1..8` | 8 | SERIA WYKRESU — kolejność MA znaczenie (seria 1,2,3…) | Line/bar/area/pie N-serii. Blue-first, **nigdy red-first**. |
| `c-tag-foreground` | 1 | Biały tekst/ikona NA wypełnionym swatchu | `text-c-tag-foreground` na `bg-c-tag-*`/`bg-c-chart-*` (AA oba tryby). |

**Różnica c-tag vs c-chart:** `c-tag` = równoważne kropki kategorii (dowolna
kolejność, np. chipy typu). `c-chart` = uporządkowany ramp serii czytany po kolei
(seria 1 zawsze ten sam blue), dobrany pod czytelność linii/słupków i colorblind.

**Recharts / inline SVG:** `var()` NIE rozwiązuje się w `fill`/`stroke`. Rozwiązuj
hex w read-time przez `financeChartTokens.ts` / `assessmentChartTokens.ts` (wzorzec:
`readCssToken('--c-chart-N', fallback)`), re-read na flip dark/light.

**Wzorce referencyjne (VA1):**
- `src/components/MyWork/IdeaNodeDetailDrawer.tsx` — `TAG_COLORS` (crimson+alarm-red
  jako kategorie → `bg-c-tag-* text-c-tag-foreground`).
- `src/components/AIAnalyticsDashboard.tsx` — `COLORS` (crimson-first ramp →
  read-time `--c-chart-1..8`, blue-first).
