# Light Mode Readability Standard

> **Status:** Canonical (v3.2, 2026-04-20)
> **Scope:** Wszystkie ekrany light mode w Consultify, ze szczególnym naciskiem na ekrany operacyjne: listy, tabele, badge'e statusów, metadata, helper surfaces, preview pane, chrome aplikacji.
> **Priorytet:** Light mode dla ekranów data-dense jest **token-first** i **contrast-first**. Estetyka "soft pastel" jest zakazana.

---

## 1. Cel i filozofia

Light mode jest pełnoprawnym wariantem UI, zaprojektowanym pod pracę operacyjną — nie rozjaśnioną kopią dark mode.

W light mode obowiązuje hierarchia wartości:

1. **Czytelność** przed lekkością.
2. **Tokeny semantyczne** przed klasami utility.
3. **Spójny shell** przed indywidualną estetyką modułu.
4. **Rozpoznawalność bez koloru** przed dekoracyjną paletą.

### Zakres zastosowania

Standard obowiązuje:

- każdy ekran operacyjny (listy, tabele, inbox, backlog, preview pane),
- każdy komponent chrome aplikacji (sidebar, topbary, rail, panele boczne),
- każdy prymityw UI (button, badge, card, input, tabs, modal, dropdown, empty state),
- każdy semantic surface (info, success, warning, danger, primary).

Ekrany "marketingowe" (landingi, panels promocyjne) mogą mieć delikatniejszą paletę, ale **nie mogą odchylać się** od twardych progów accessibility (§9, §10).

---

## 2. Hierarchia tekstu

W light mode obowiązują **tylko 4 poziomy tekstu**. Token semantyczny → klasa utility:

| Token | Utility | Zastosowanie | Min kontrast |
| --- | --- | --- | --- |
| `text-primary` | `text-slate-900` | Tytuły wierszy, nagłówki kart, główny tekst treści | 15:1+ |
| `text-secondary` | `text-slate-700` | Labele formularzy, wartości pól, tekst w przyciskach wtórnych | 10:1+ |
| `text-supportive` | `text-slate-600` | Metadata wiersza, helper text, subtitle, empty states | 7:1+ |
| `text-metadata` | `text-slate-500` | Placeholder, timestamp, etykiety drugorzędne | 4.6:1 |

### Twarde zakazy

- `text-slate-400` dla treści użytkowej (akceptowalne tylko dla disabled).
- `text-blue-400`, `text-amber-400`, `text-purple-400`, `text-emerald-400`, `text-red-400` na jasnym tle dla badge’y, statusów, meta, CTA.
- Budowanie hierarchii przez `opacity < 1` jako główne narzędzie.
- Tekst poniżej `14px` z kontrastem niższym niż `text-slate-600`.

### Dodatkowe reguły

- Uppercase helper labels i mikroetykiety nie mogą być jaśniejsze niż `*-700` przy tintowanych powierzchniach (nawet kosztem "lekkości").
- Nagłówki kolumn tabeli: `text-slate-600` minimum, `text-slate-700` zalecane przy 11–12 px.
- Linki inline: `text-primary-700` z hover `text-primary-800` i widocznym underline; bez underline tylko jeśli znajdują się w jawnie klikalnym surface.

---

## 3. Surface hierarchy

Light mode używa **czterech warstw surface**, nie trzech. Każda warstwa ma jawny token:

| Token | Utility | Zastosowanie |
| --- | --- | --- |
| `surface-app` | `bg-slate-100` | Tło całej aplikacji (nie `bg-white`, nie `bg-slate-50`) |
| `surface-default` | `bg-white border-slate-200` | Główne karty, panele modali, kontenery zawartości |
| `surface-subtle` | `bg-slate-50 border-slate-200` | Nested surfaces, sekcje grupujące, toolbary |
| `surface-selected` | `bg-primary-50 border-primary-200 ring-1 ring-primary-200` | Aktywny wiersz, wybrany tab, aktywny filtr |

### Zasady

- Każdy ważny kontener musi mieć **co najmniej dwa** środki separacji: tło + border, albo tło + shadow `hig-sm`, albo border + inset shadow.
- Hover ma zmieniać tło **lub** border (nie sam kolor tekstu).
- Selected state musi być widoczny bez zgadywania — `bg` + `border` + `ring` razem.
- Focus-visible (§7) jest dodatkiem do selected, nie zastępstwem.

### Zakazy

- `bg-white` na każdym kontenerze bez separacji od sąsiadów.
- Ultra-subtelne bordery typu `border-*/10` lub `border-white/5` dla gęstych tabel i paneli w light mode.
- "Niewidzialne bordery" dla preview pane, tabel i sidebaru — to jest wzorzec dark mode, nie light.
- Gradients jako jedyne tło operacyjnego kontenera.

---

## 4. Semantic surfaces

Semantic UI w light mode budujemy **wyłącznie** na zatwierdzonych parach. Żadnych wariacji z `*-400/500` tekstu.

| Semantyka | Tło | Border | Tekst | Ikona | Dot |
| --- | --- | --- | --- | --- | --- |
| **info** | `bg-blue-50` | `border-blue-200` | `text-blue-800` | `text-blue-600` | `bg-blue-500` |
| **success** | `bg-emerald-50` | `border-emerald-200` | `text-emerald-800` | `text-emerald-600` | `bg-emerald-500` |
| **warning** | `bg-amber-50` | `border-amber-200` | `text-amber-900` | `text-amber-700` | `bg-amber-500` |
| **danger** | `bg-red-50` | `border-red-200` | `text-red-800` | `text-red-600` | `bg-red-500` |
| **primary** | `bg-primary-50` | `border-primary-200` | `text-primary-800` | `text-primary-600` | `bg-primary-500` |
| **neutral** | `bg-slate-100` | `border-slate-200` | `text-slate-800` | `text-slate-600` | `bg-slate-500` |

> **Uwaga o amber:** `text-amber-700` jest graniczne kontrastowo na `bg-amber-50`. Dla badge statusu zawsze używać `text-amber-900`. To jest świadome odstępstwo od pozostałych semantyk, wymuszone fizyką koloru.

### Zakazy

- `bg-*-500/20 text-*-400`
- `bg-*-500/10 text-*-300`
- `bg-*-50 text-*-500` (pastelowy tekst na pastelowym tle).
- Trzy różne odcienie tego samego koloru w jednym semantic surface.

---

## 5. Status chips i badge taxonomy

### Struktura badge

Każdy badge statusu w light mode musi mieć:

- **tło** z poziomu `50` lub `100`,
- **border** `200` (zawsze, w light mode border jest nieusuwalny),
- **tekst** `700` lub `800` (dla danger/warning/success → `800`),
- **padding** minimum `px-2 py-0.5`,
- **font-weight** minimum `500` (medium),
- opcjonalnie **dot** `500`/`600`.

### Kanoniczne mapowanie statusów

| Status | Klasy |
| --- | --- |
| assigned / neutral | `bg-slate-100 border-slate-200 text-slate-800` |
| in progress / info | `bg-blue-100 border-blue-200 text-blue-800` |
| review / pending / warning | `bg-amber-100 border-amber-300 text-amber-900` |
| rejected / error / danger | `bg-red-100 border-red-200 text-red-800` |
| approved / completed / success | `bg-emerald-100 border-emerald-200 text-emerald-800` |
| primary / highlighted | `bg-primary-100 border-primary-200 text-primary-800` |

### Implementation rules

- **Border jest obowiązkowy** — to jest największa różnica względem dark mode, gdzie często jest pomijany.
- Badge musi być czytelny na screenie przy 100% zoom, bez powiększania.
- Jeśli badge ma działać w obu trybach, light mode i dark mode muszą mieć **osobne klasy**, nie kompromis jedną parą.
- Badge w tabeli nie może być rozpoznawany tylko przez kolor (zobacz §8).

---

## 6. Lists, tables, inboxes

### Typografia wiersza

| Element | Klasa |
| --- | --- |
| Tytuł wiersza | `text-slate-900 font-medium` |
| Metadata wiersza (1. plan) | `text-slate-700` |
| Metadata wiersza (2. plan) | `text-slate-600` |
| Timestamp / drobne | `text-slate-500` |
| Header kolumny | `text-slate-600 uppercase tracking-wide text-xs font-semibold` |
| Empty state (main) | `text-slate-700 font-medium` |
| Empty state (supporting) | `text-slate-600` |

### Stany wiersza

| Stan | Klasy |
| --- | --- |
| Default | `bg-white` |
| Hover | `bg-slate-50` (nie `bg-slate-100` — zbyt mocne przy szybkim mouse-over) |
| Active / Selected | `bg-primary-50 ring-1 ring-inset ring-primary-200` |
| Current focus (keyboard) | `outline outline-2 outline-primary-500 outline-offset-[-2px]` |
| Grouped section | `bg-slate-50` z `text-slate-600` na headerze grupy |

### Separatory

- Wiersz / wiersz: `border-slate-200` (nie `/60`, nie `/30`).
- Sekcja / sekcja: `border-slate-200` + przerwa `mt-2`.
- Header / tbody: `border-slate-300` (mocniejszy niż wiersze).
- Tabela / preview pane: **wyraźny** `border-slate-200` + `bg-slate-50` pomiędzy.

### Dodatkowe reguły

- Nie opieramy rozpoznania statusu wyłącznie na kolorze (zobacz §8).
- Progress track nie może zlewać się z tłem: `bg-slate-200` dla pustego, `bg-primary-500` dla wypełnionego.
- Count chips i filter chips muszą mieć wyraźny **active vs inactive**:
  - inactive: `bg-white border-slate-200 text-slate-700`
  - active: `bg-primary-50 border-primary-300 text-primary-800`
- Bulk action bar po zaznaczeniu: `bg-primary-600 text-white` z mocnym shadow — ma być dominujący.

### Data density

Dla list/tabel obowiązują **dwa tryby**:

| Tryb | Wysokość wiersza | Padding komórki | Font | Zastosowanie |
| --- | --- | --- | --- | --- |
| `compact` | 36 px | `px-3 py-1.5` | `text-xs` / `text-sm` | Inbox, backlog, admin tables, data-dense ops |
| `comfortable` | 48 px | `px-4 py-3` | `text-sm` | Executive views, discovery, reader-oriented |

Moduły operacyjne domyślnie: `compact`. Moduły narracyjne domyślnie: `comfortable`.

---

## 7. Forms, helper content, callouts

### Formularze

| Element | Klasa |
| --- | --- |
| Question / title | `text-slate-900 font-medium` |
| Helper text | `text-slate-600` |
| Additional context | `text-slate-600` |
| Input (default) | `bg-white border-slate-300 text-slate-900 placeholder-slate-400` |
| Input (focus) | `ring-2 ring-primary-300 border-primary-500` |
| Input (error) | `border-red-300 ring-red-100 text-slate-900` |
| Input (disabled) | `bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed` |
| Label (required) | inline `<span class="text-red-600">*</span>` |

### Callouty (Hint / What we look for / Expected format)

Używamy wyłącznie semantic surfaces z §4, z ciemnym tekstem. Bez `bg-*-50 text-*-500`, bez półprzezroczystych nakładek.

---

## 8. Differentiate without color alone

Status nigdy nie może być rozpoznawalny **wyłącznie kolorem**. Każdy badge / chip / stan musi nieść dodatkowy nośnik znaczenia:

- **tekst** (preferowane dla badge statusu),
- **ikona** (check, warning, x, dot),
- **kształt** (pill vs rounded-md vs chip z borderem),
- **pozycja** (np. sticky lane w kanban),
- **wzorzec** (outline vs filled).

### Test grayscale

Każdy ekran operacyjny musi przejść test:

- przełącz screena w grayscale,
- statusy pozostają rozpoznawalne,
- selected vs hover vs default są odróżnialne,
- focus-visible jest widoczny.

Jeśli w grayscale ekran "się rozjeżdża", to nie jest gotowy.

### Implementacja

- Badge success → **check icon** + "Gotowe" + kolor.
- Badge danger → **x/alert icon** + "Błąd" + kolor.
- Badge warning → **alert icon** + "W trakcie" + kolor.
- Checkbox checked: **kolor tła + białe V** (nie sam kolor).
- Radio selected: **pierścień + kropka w środku** (nie sam kolor wypełnienia).

---

## 9. Accessibility baseline (mierzalny)

Wszystkie progi muszą być spełnione **domyślnie**, bez polegania na user preferences.

| Element | Próg |
| --- | --- |
| Tekst standardowy (< 18 px regular, < 14 px bold) | **4.5:1** (WCAG AA) |
| Tekst duży (≥ 18 px regular, ≥ 14 px bold) | **3:1** (WCAG AA Large) |
| UI component (border, separator, selected state) | **3:1** (WCAG 2.2 SC 1.4.11) |
| Focus indicator vs unfocused | **3:1** + rozmiar 2 CSS px (WCAG 2.2 SC 2.4.13) |
| Badge text (mały) | **4.5:1** (traktujemy jak standardowy tekst) |
| Placeholder | **4.5:1** (nie jest wyjątkiem) |
| Disabled (tekst) | bez wymagania, ale ≥ 3:1 jest zalecane |

### Reguły uzupełniające

- Kolor **nigdy** nie jest jedynym nośnikiem znaczenia (§8).
- Małe etykiety 11–12 px wymagają **wyższego** kontrastu niż standardowy body text.
- `outline: none` bez customowego focusu jest zakazany.
- `prefers-reduced-motion`: szanujemy, animacje wejścia można wyłączyć, kluczowe feedbacki zostają.

### Mierzalność

- Kontrast sprawdzamy w designie (Figma plugin Stark / Able) i w runtime (Chrome DevTools Contrast Checker).
- Każdy PR zmieniający surface, badge, nawigację albo tabelę musi przejść test kontrastu na 3 referencyjnych ekranach (§13).

---

## 10. Focus-visible i stany interaktywne

### State matrix (obowiązkowa dla każdego komponentu interaktywnego)

Każdy nowy lub refaktorowany komponent musi jawnie zdefiniować:

| Stan | Wymóg | Token |
| --- | --- | --- |
| `default` | czytelny kontrast | `surface-default` |
| `hover` | zmiana surface lub border (nie tylko tekst) | `surface-subtle` lub `surface-hover` |
| `selected` | `bg` + `border` + `ring` razem | `surface-selected` |
| `focus-visible` | outline 2 px, kontrast ≥ 3:1, offset | `focus-ring` |
| `pressed` | subtle scale lub inner shadow | — |
| `disabled` | `opacity-50` + `cursor-not-allowed`, bez interakcji | — |
| `error` | border + ring semantic danger | `status-danger` |

### Focus ring — kanon

- **Szerokość:** 2 CSS px (WCAG 2.2 AAA 2.4.13 minimum).
- **Kolor:** `ring-primary-500` (na jasnych surface), `ring-primary-400` (na tintowanych).
- **Offset:** `ring-offset-2 ring-offset-white` (dla surface-default), `ring-offset-slate-50` (dla surface-subtle).
- **Widoczność:** focus-visible musi być widoczny bez polegania na systemowym fokusie przeglądarki.
- **Zakazane:** `outline: none` bez zastąpienia; `ring-offset-transparent` w light mode; focus ring < 2 px.

### Implementacja

```tsx
// Kanoniczny wzorzec focus-visible dla komponentów klikalnych
'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white'
```

---

## 11. Navigation i sidebar

### Sidebar (light mode)

| Stan | Klasy |
| --- | --- |
| Container | `bg-white border-r border-slate-200` |
| Item (default) | `text-slate-700` |
| Item (hover) | `bg-slate-100 text-slate-900` |
| Item (active) | `bg-primary-50 text-primary-700 font-medium` + accent line `border-l-2 border-primary-600` |
| Icon (default) | `text-slate-500` |
| Icon (active) | `text-primary-600` |
| Section label | `text-slate-500 uppercase text-xs tracking-wide font-semibold` |
| Collapsed tooltip | `bg-slate-900 text-white` (inverted, ma się wyróżniać) |

### App Topbar

- Tło: `bg-white border-b border-slate-200`.
- Akcje: ikony w `text-slate-600` z hover `text-slate-900 bg-slate-100`.
- Primary CTA: `bg-primary-600 text-white` (maksymalnie jeden na topbarze).
- Breadcrumbs: `text-slate-600` / `text-slate-900` dla aktywnego segmentu.

### Module Topbar

- Tło spójne z App Topbar.
- Filter chips (§6 Count chips).
- Wysokość spójna: `h-10` lub `h-12` zgodnie z `FROZEN_LAYOUTS.md`.

### Zakaz

Sidebar nie może wyglądać jak placeholder ani "wypłowiała wersja dark mode". Jeśli sidebar wydaje się "za biały", problem jest w braku separacji z contentem, nie w potrzebie tła pastelowego.

---

## 12. Operational tables i preview pane

Ten rozdział jest **obowiązkowy** dla każdego ekranu operacyjnego (inbox, backlog, lista wniosków, admin tables).

### Separacja tabela ↔ preview pane

- Tabela: `bg-white` z `border-slate-200` na prawej krawędzi.
- Gap: 0 lub `bg-slate-100` jako separator — nie `bg-white` na obu stronach bez borderu.
- Preview pane: `bg-white` z `border-slate-200` na lewej krawędzi + delikatny shadow w stronę tabeli (`shadow-hig-sm`).

### Preview pane header

- Tytuł rekordu: `text-slate-900 font-semibold`.
- Metadata obok: `text-slate-600`.
- Status badge: pełny standard z §5.
- Close button: `text-slate-500 hover:text-slate-900 hover:bg-slate-100`.

### Preview pane body

- Sekcje z jasnymi separatorami `border-slate-200`.
- Etykiety sekcji: `text-slate-600 uppercase text-xs tracking-wide`.
- Treść sekcji: `text-slate-700` do `text-slate-900` wg hierarchii.
- Opcjonalne linki i akcje w jasnych callout surfaces (§4).

### Preview pane footer (actions)

- `bg-slate-50 border-t border-slate-200 p-3`.
- Primary action: `variant="primary"`.
- Secondary actions: `variant="secondary"` lub `ghost` z jawną ikoną.
- Parity z akcjami w pełnym widoku (§15 UI_UX_CANON_V3).

### Bulk action bar

- Po selection: `bg-primary-600 text-white border-t border-primary-700`.
- Kontrast min 7:1 — to jest strefa "uwaga, masz kilka zaznaczonych".
- Przycisk deselect: `text-white/80 hover:text-white`.

---

## 13. Ekrany referencyjne

Każda zmiana surface, primitive, navigation albo table standard musi być przejrzana na **5 ekranach referencyjnych**:

1. **Inbox / Wnioski** — tabela + preview + badge statusu + sekcje grupujące.
2. **Executive / Dashboard** — karty metryk + nagłówki sekcji + jasne warstwy.
3. **Discovery / Interview** — formularze + helper surfaces + toolbary.
4. **Admin Customers (SuperAdmin)** — tabele + filtry + bulk actions + drawer szczegółu.
5. **Chat / AI Panel** — split layout + message bubbles + composer.

Screen dla każdego ekranu w trybie `light` przy 100% zoom musi być załączony do PR.

---

## 14. Review checklist (per PR)

Każdy nowy lub refaktorowany ekran light mode sprawdzamy pod kątem:

### A. Kontrast i tekst

1. Czy nazwa / treść główna jest natychmiast czytelna?
2. Czy metadata jest czytelna bez wytężania wzroku?
3. Czy nie pojawił się `text-slate-400` dla treści roboczej?
4. Czy wszystkie małe etykiety (≤ 12 px) mają co najmniej `text-slate-600`?

### B. Surface i struktura

5. Czy każdy ważny kontener ma czytelną separację (background + border)?
6. Czy hover i selected są widoczne przez tło/border, nie tylko kolor tekstu?
7. Czy tabela i preview pane są rozróżnialne bez zgadywania?
8. Czy nie ma niewidzialnych borderów `border-*/10`?

### C. Badge i statusy

9. Czy badge statusu jest czytelny bez zoomu i bez dark mode?
10. Czy badge ma pełny zestaw: tło + border + tekst `700/800`?
11. Czy w grayscale statusy są nadal odróżnialne?

### D. Stany interaktywne

12. Czy focus-visible jest widoczny na każdym klikanym elemencie?
13. Czy disabled jest rozpoznawalny poza samym `opacity`?
14. Czy kolor NIE jest jedynym nośnikiem stanu?

### E. Shell i spójność

15. Czy sidebar, topbary i preview tworzą jeden system?
16. Czy nie ma ad-hoc wariantów light/dark w modułach?
17. Czy wszystkie decyzje idą przez tokeny, nie przez jednorazowe klasy?

---

## 15. Definition of Done

Ekran w light mode jest gotowy **wyłącznie** wtedy, gdy:

1. **Kontrast:** każdy tekst spełnia próg WCAG AA (4.5:1 / 3:1).
2. **Non-text contrast:** każdy interactive element spełnia 3:1.
3. **Focus:** każdy interaktywny element ma widoczny focus-visible ≥ 2 px.
4. **Badges:** wszystkie statusy mają pełny zestaw tło + border + tekst `700/800`.
5. **Surface:** kontenery rozróżnialne przez warstwy tła lub bordery.
6. **Grayscale:** ekran pozostaje użyteczny w grayscale.
7. **Zakazane wzorce:** brak `bg-*/20 + text-*/400`, brak `text-slate-400` roboczego, brak pastelowego tekstu na pastelowym tle.
8. **Tokeny:** wszystkie kolory, surface, statusy przechodzą przez tokeny semantyczne (§16).

---

## 16. Tokeny semantyczne

Od v3.2 light mode operuje **tokenami semantycznymi**, nie bezpośrednimi utility classes. Kontrakt tokenów jest zdefiniowany w `src/index.css` i `tailwind.config.js`:

### Tekst

- `text-primary` → `slate-900`
- `text-secondary` → `slate-700`
- `text-supportive` → `slate-600`
- `text-metadata` → `slate-500`

### Surface

- `surface-app` → `slate-100`
- `surface-default` → `white` + `border-slate-200`
- `surface-subtle` → `slate-50` + `border-slate-200`
- `surface-selected` → `primary-50` + `border-primary-200` + `ring-primary-200`

### Status

- `status-success` → `emerald-100` / `border-emerald-200` / `emerald-800`
- `status-warning` → `amber-100` / `border-amber-300` / `amber-900`
- `status-danger` → `red-100` / `border-red-200` / `red-800`
- `status-info` → `blue-100` / `border-blue-200` / `blue-800`
- `status-neutral` → `slate-100` / `border-slate-200` / `slate-800`

### Stany interaktywne

- `focus-ring` → `ring-primary-500` + `ring-offset-2 ring-offset-white`
- `hover-surface` → `slate-50`
- `active-surface` → `primary-50`

Każdy nowy komponent musi konsumować te tokeny; każdy istniejący komponent refaktorowany musi zostać przełączony na tokeny.

---

## 17. Governance

- **SSOT:** ten dokument (warstwa `00-foundation`); autorytet nadrzędny: [`../CANON.md`](../CANON.md).
- **Dopuszczalne odstępstwa:** tylko dla ekranów marketingowych / landingów / print, i tylko po ujęciu w `canvas-mode.md`.
- **Egzekwowanie:** review checklist (§14) w każdym PR zmieniającym UI.
- **Aktualizacja:** co kwartał, razem ze sweepem regresyjnym light mode.

---

## 18. Reguły systemowe (z A1 sweep, 2026-06-14)

> Wyprowadzone z `docs/qa/MASTER_VISUAL_QA_CATALOG.md`. To **MUST** dla Fazy C0 (współdzielone komponenty).
> **Egzekwowanie koloru ≠ grep-lint.** W przeciwieństwie do motion (`transition-all` ~zawsze błąd, lintowalny), kolor jest w 99% legalny statycznie (green/slate-400/hex = poprawne warianty). Lint byłby cry-wolf. **Ratchetem koloru jest VISUAL SWEEP** (re-run katalogu) + istniejący `scripts/audit-ui-compliance.js` (dark-variant, deprecated patterns). Nie budujemy `lint:colors`.

### 18.1 Zakaz kolorów „dark-only" (VIS-002)
Każda klasa koloru tekstu/tła MUSI mieć poprawny odpowiednik light — nie wolno polegać na fallbacku. **Metadata (daty, timestampy, liczniki) NIGDY `text-primary-*`/crimson** — w light wygląda jak alarm. Metadata = `text-slate-500/600` (§2). Wykryte: 187 komórek dat `rgb(145,10,40)` w light.

### 18.2 Badge danger MUSI mieć fill w light (VIS-001)
Współdzielony komponent badge: wariant light **obowiązkowo** tło(100)+border(200)+tekst-danger(800) (§5). Zakaz dark-only wariantu z fallbackiem do `transparent`+`slate`. Wykryte: „Critical"/„overdue" = transparent bg + slate text w light (nie czyta się jako danger).

### 18.3 Primary-CTA = navy token (VIS-006)
Główny CTA modułu = navy token (po T2). Crimson **tylko** Talk-to-Teresa / destructive (budżet §0 CANON). Ujednolicić: Tools „Add", Initiatives „New initiative" (crimson) → navy, jak My Work / Results.
