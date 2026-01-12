# DBR77 Color System Standard

> **Wersja**: 1.0  
> **Data**: 2026-01-02  
> **Autor**: Consultify Design System

## Zasada nadrzędna

> **Minimalizm kolorystyczny**: Używamy tylko 4 kolorów semantycznych + neutralne szarości.
> Każdy kolor ma JEDNĄ jasno określoną funkcję. Nie ma wyjątków.

---

## 1. Paleta kolorów DBR77

### 🟣 PRIMARY (Fiolet) - Akcja główna

```css
--color-primary: #7C3AED;           /* Main Brand - CTA, Primary buttons */
--color-primary-hover: #6D28D9;     /* Hover state */
--color-primary-light: #8B5CF6;     /* Light variant */
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
--color-secondary: #1E3A5F;         /* Deep navy - Secondary buttons */
--color-secondary-hover: #0F2744;   /* Hover state */
--color-secondary-light: #2E4A6F;   /* Light variant */
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
--color-danger: #DC2626;            /* Error/Danger - ONLY for alerts */
--color-danger-hover: #B91C1C;      /* Hover state */
--color-danger-light: #EF4444;      /* Light variant */
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
--color-success: #059669;           /* Success - confirmations only */
--color-success-hover: #047857;     /* Hover state */
--color-success-light: #10B981;     /* Light variant */
--color-success-surface: rgba(5, 150, 105, 0.1); /* Backgrounds */
```

**Zastosowanie:**
- ✅ Status "Healthy", "Active", "UP"
- ✅ Komunikaty sukcesu (Saved, Created, Completed)
- ✅ Pozytywne zmiany (trend ↑)
- ❌ NIGDY dla przycisków akcji
- ❌ NIGDY jako kolor dominujący

---

### ⚪ NEUTRAL (Szarości Navy)

```css
/* Dark Mode */
--neutral-950: #020617;   /* Deepest background */
--neutral-900: #0B1121;   /* Panel background */
--neutral-800: #151E32;   /* Card background */
--neutral-700: #2A3655;   /* Borders */
--neutral-600: #374151;   /* Muted text */
--neutral-500: #64748B;   /* Secondary text */
--neutral-400: #94A3B8;   /* Placeholder */

/* Light Mode */
--neutral-300: #CBD5E1;   /* Borders */
--neutral-200: #E2E8F0;   /* Hover bg */
--neutral-100: #F1F5F9;   /* Subtle bg */
--neutral-50: #F8FAFC;    /* Main bg */
--neutral-0: #FFFFFF;     /* Cards */
```

---

## 2. 📝 ZASADY KOLOROWANIA TEKSTU (Typography)

### 2.1 Hierarchia kolorów tekstu

| Poziom | Dark Mode | Light Mode | Użycie |
|--------|-----------|------------|--------|
| **Primary** | `#FFFFFF` | `#0F172A` | Nagłówki, główna treść |
| **Secondary** | `#94A3B8` | `#475569` | Opisy, etykiety |
| **Muted** | `#64748B` | `#64748B` | Hinty, placeholdery |
| **Disabled** | `#475569` | `#94A3B8` | Nieaktywne elementy |

### 2.2 Kiedy WOLNO kolorować tekst

| Sytuacja | Kolor | Przykład |
|----------|-------|----------|
| **Status pozytywny** | Success `#059669` / `#10B981` | "Active", "Healthy", "+12%" |
| **Status negatywny** | Danger `#DC2626` / `#EF4444` | "Error", "Failed", "-5%" |
| **Link/akcja** | Primary `#7C3AED` / `#8B5CF6` | "View details", "Edit" |
| **Aktywny tab/item** | Primary `#7C3AED` | Aktywna pozycja menu |

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

| Tło | Tekst Primary | Tekst Secondary | Kontrast |
|-----|---------------|-----------------|----------|
| `#020617` (dark) | `#FFFFFF` | `#94A3B8` | 21:1 / 7.5:1 ✅ |
| `#0B1121` (dark) | `#FFFFFF` | `#94A3B8` | 18:1 / 6.8:1 ✅ |
| `#FFFFFF` (light) | `#0F172A` | `#475569` | 16:1 / 7.2:1 ✅ |
| `#F8FAFC` (light) | `#0F172A` | `#475569` | 15:1 / 6.9:1 ✅ |

### 2.6 Kolorowy tekst - dodatkowe zasady

1. **Kolorowy tekst musi być krótki** - max 3-4 słowa
2. **Zawsze z kontekstem** - ikona lub etykieta obok
3. **Nie tylko kolor** - dla dostępności dodaj ikony (✓, ✕, ⚠️)
4. **Spójność** - ten sam status = ten sam kolor wszędzie

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

| Wariant | Kolor | Użycie | Przykład |
|---------|-------|--------|----------|
| **Primary** | Fiolet | Główna akcja na stronie | "Save", "Create", "Submit" |
| **Secondary** | Navy/Outline | Akcja drugorzędna | "Cancel", "Back", "Close" |
| **Ghost** | Transparentny | Akcja trzeciorzędna | "Edit", "View", linki |
| **Danger** | Czerwony | TYLKO destrukcyjne | "Delete", "Remove" |

### Zasady:
1. **Jedna strona = Jeden Primary Button**
2. **Danger button wymaga potwierdzenia** (modal/dialog)
3. **Ghost buttons** nie mają tła, tylko tekst + ikona
4. **Brak przycisków Success** - używamy Primary z ikoną ✓

---

## 4. Statusy i badges

| Status | Kolor | Tekst Dark | Tekst Light | Tło Surface |
|--------|-------|------------|-------------|-------------|
| Active/Healthy | Success | `#10B981` | `#059669` | `rgba(5,150,105,0.1)` |
| Pending/Processing | Primary | `#A78BFA` | `#7C3AED` | `rgba(124,58,237,0.1)` |
| Inactive/Disabled | Neutral | `#64748B` | `#94A3B8` | `rgba(100,116,139,0.1)` |
| Error/Failed | Danger | `#EF4444` | `#DC2626` | `rgba(220,38,38,0.1)` |

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
.error-message { color: var(--color-danger); }

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
.text-primary { color: var(--text-primary); }     /* Main content */
.text-secondary { color: var(--text-secondary); } /* Descriptions */
.text-muted { color: var(--text-muted); }         /* Hints */
.text-disabled { color: var(--text-disabled); }   /* Disabled */

/* Semantic text colors - USE SPARINGLY */
.text-brand { color: var(--color-primary); }      /* Links, actions */
.text-success { color: var(--color-success); }    /* Positive status */
.text-danger { color: var(--color-danger); }      /* Errors, negative */
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

| Stary kolor | Nowy kolor DBR77 | Klasa Tailwind |
|-------------|------------------|----------------|
| `blue-500/600` | Primary (fiolet) | `primary-500`, `primary-600` |
| `orange-500` | Primary (fiolet) | `primary-500` |
| `amber-500` | Primary (fiolet) | `primary-500` |
| `yellow-*` | Primary lub Neutral | `primary-*` lub `slate-*` |
| `cyan-*` | Secondary (navy) | `secondary-*` |
| `indigo-*` | Primary (fiolet) | `primary-*` |
| `green-*` | Success | `success-*` |
| `red-*` | Danger | `danger-*` |

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

