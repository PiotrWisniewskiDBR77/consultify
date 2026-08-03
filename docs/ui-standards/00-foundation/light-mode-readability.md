# Light Mode Readability Standard

> **Status:** Canonical (v3.4, 2026-08-02)
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
| `surface-selected` | `bg-slate-100 ring-1 ring-inset ring-slate-300/60 shadow-[inset_4px_0_0_var(--c-info)]` | Aktywny wiersz, wybrany tab, aktywny filtr — **neutralna powierzchnia + niebieski (info) accent bar**, NIGDY crimson/primary (czyta się jako alarm) |

### Zasady

- Każdy ważny kontener musi być jednoznacznie odróżnialny przez co najmniej jeden mocny albo dwa subtelne sygnały: kontrast powierzchni, spacing, hairline lub elevation. Content card domyślnie używa powierzchni + spacingu bez cienia; overlay może łączyć hairline z elevation zgodnie z `FOUNDATION_TOKEN_CONTRACT.md`.
- Hover ma zmieniać tło **lub** border (nie sam kolor tekstu).
- Selected state musi być widoczny bez zgadywania — neutralne `bg` (slate-100) + `ring` + niebieski (info) accent bar razem. **Selekcja NIE używa primary/crimson** — crimson to sygnał „alarm/destructive", nie „aktywny". Kanoniczne klasy: `src/components/shared/selectionTokens.ts`.
- Focus-visible (§7) jest dodatkiem do selected, nie zastępstwem.

### Zakazy

- `bg-white` na każdym kontenerze bez separacji od sąsiadów.
- Ultra-subtelne bordery typu `border-*/10` lub `border-white/5` dla gęstych tabel i paneli w light mode.
- "Niewidzialne bordery" dla preview pane, tabel i sidebaru — to jest wzorzec dark mode, nie light.
- Gradients jako jedyne tło operacyjnego kontenera.

---

## 4. Semantic surfaces

> **Uwaga CENTRAL REMAP (K-P1-06):** klasy `blue-*`/`red-*`/`emerald-*`/`amber-*`/`violet-*`/`indigo-*`/`purple-*` w tabeli niżej i w całym dokumencie **nie** renderują domyślnych kolorów Tailwinda — `tailwind.config.js` (blok „CENTRAL REMAP", ok. l. 418–660) przepina te rodziny na paletę HBS. Kanoniczny opis: `FOUNDATION_TOKEN_CONTRACT.md` §7.

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

> **Uwaga o primary:** wiersz `primary` to marka/crimson — służy WYŁĄCZNIE momentowi marki (Talk-to-Teresa) i semantyce destrukcyjnej (delete/reject/error/blocked/overdue), zgodnie z `TRIADA_KANON.md`. Nie wolno go użyć jako stan aktywny, zaznaczenie ani fokus — te mają być neutralne/info (§3, §10).

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
| primary / highlighted | `bg-primary-100 border-primary-200 text-primary-800` — **tylko marka/destrukcja** (delete/reject/error/blocked/overdue), NIGDY jako oznaczenie „aktywny"/„wybrany" |

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
| Hover | `hover:bg-state-hover` (token; light: `color-mix(in srgb, var(--c-text) 6%, transparent)` ≈ `rgba(15,23,42,.06)`, `src/index.css:222` — wzorzec: wiersz tabeli w `src/components/shared/ModuleHub/FilterableTable.tsx:799`, renderer pod `StandardTable`) |
| Active / Selected | `bg-slate-100 ring-1 ring-inset ring-slate-300/60 shadow-[inset_4px_0_0_var(--c-info)]` (neutral + info accent bar — `selectionTokens.ts`) |
| Current focus (keyboard) | `outline outline-2 outline-c-focus outline-offset-[-2px]` |
| Grouped section | `bg-slate-50` z `text-slate-600` na headerze grupy |

> **K-19 rozstrzygnięcie kodem (2026-08-02):** ten dokument wcześniej podawał hover = `bg-slate-50`, a `color-system.md` §2.6b podaje `hover:bg-slate-100/80` — obie wartości to **dług**. Realny renderer wiersza (`FilterableTable.tsx`, którego używa `StandardTable`) stosuje trzeci, obliczany token `hover:bg-state-hover` (patrz tabela wyżej), nie statyczny `slate-*`. `TableWithPreviewLayout.tsx` nie renderuje wierszy tabeli (to layout split tabela+preview) — jego `hover:bg-slate-100/70` dotyczy przycisków paginacji/pin, nie wierszy. `color-system.md` §2.6b jest poprawiany równolegle inną sesją tą samą metodą i nie jest tu edytowany.

### Separatory

- Wiersz / wiersz: `border-slate-200` (nie `/60`, nie `/30`).
- Sekcja / sekcja: `border-slate-200` + przerwa `mt-2`.
- Header / tbody: `border-slate-300` (mocniejszy niż wiersze).
- Tabela / preview pane: **wyraźny** `border-slate-200` + `bg-slate-50` pomiędzy.

### Dodatkowe reguły

- Nie opieramy rozpoznania statusu wyłącznie na kolorze (zobacz §8).
- Progress track nie może zlewać się z tłem: `bg-slate-200` dla pustego, `bg-c-info` dla wypełnionego (progres to stan informacyjny, nie marka/alarm — spójne z `InitiativeDetailModal.tsx`).
- Count chips i filter chips muszą mieć wyraźny **active vs inactive**:
  - inactive: `bg-white border-slate-200 text-slate-700`
  - active: `bg-blue-50 border-blue-300 text-blue-800` (info, nie crimson — aktywny filtr to stan wyboru, nie marka/alarm)
- Bulk action bar po zaznaczeniu: `bg-navy-900 text-white` z mocnym shadow — ma być dominujący (neutralny wysoki kontrast, ta sama logika co Primary CTA §11/§18.3 — nie crimson, zaznaczenie masowe ≠ alarm).

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
| Input (focus) | `ring-2 ring-c-focus border-c-focus-solid` |
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
| `selected` | neutralne `bg` + `ring` + info accent bar (nie crimson) | `surface-selected` |
| `focus-visible` | outline 2 px, kontrast ≥ 3:1, offset | `focus-ring` |
| `pressed` | subtle scale lub inner shadow | — |
| `disabled` | `opacity-50` + `cursor-not-allowed`, bez interakcji | — |
| `error` | border + ring semantic danger | `status-danger` |

### Focus ring — kanon

- **Szerokość:** 2 CSS px (WCAG 2.2 AAA 2.4.13 minimum).
- **Kolor:** `ring-c-focus` — jeden token niebieski dla wszystkich surface (jasnych i tintowanych); nie różnicujemy per-surface, bo `--c-focus` ma wbudowaną alpha (light: `rgba(37,99,235,.4)` / `#2563eb` solid).
- **Offset:** `ring-offset-2 ring-offset-white` (dla surface-default), `ring-offset-slate-50` (dla surface-subtle).
- **Widoczność:** focus-visible musi być widoczny bez polegania na systemowym fokusie przeglądarki.
- **Zakazane:** `outline: none` bez zastąpienia; `ring-offset-transparent` w light mode; focus ring < 2 px; `ring-primary-*`/crimson jako kolor fokusa (fokus ≠ marka/alarm).

### Implementacja

```tsx
// Kanoniczny wzorzec focus-visible dla komponentów klikalnych
'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white'
```

---

## 11. Navigation i sidebar

### Sidebar (light mode)

| Stan | Klasy |
| --- | --- |
| Container | `bg-slate-50` (Layer 0), **bez** `border-r` — separacja wyłącznie przez `boxShadow: '0 10px 40px rgba(0,0,0,0.08)'` (zweryfikowane `src/components/navigation/Sidebar/Sidebar.tsx:489`; `border-white` claim i `bg-white`/`bg-slate-100` z wcześniejszych wersji były długiem, patrz `visual-language.md` §3.1/§4.2 — reguła „brak border-right" jest tam poprawna) |
| Item (default) | `text-c-text-secondary` (≈ `text-slate-700`) |
| Item (hover) | `hover:bg-slate-100 hover:text-c-text` |
| Item (active) | `bg-slate-200/60 text-c-text font-medium` + 2px accent bar `bg-[var(--c-info)]` jako osobny `motion.div` (`absolute left-0 ... w-[2px] h-5 bg-[var(--c-info)] rounded-r-full`), **nie** klasa `border-l-2 border-c-info` — wzorzec: `src/components/navigation/Sidebar/NavItem.tsx:109` (tło) i `:181` (pasek). K-21: wcześniejsza wersja tego wiersza cytowała `NavItem.tsx` jako źródło `border-l-2 border-c-info`, ale ta klasa nie istnieje w pliku (`grep` zero trafień) — pasek akcentu istnieje faktycznie, tylko jako osobny element, nie jako border. |
| Icon (default) | `text-slate-500` |
| Icon (active) | `text-slate-700` |
| Section label | `text-slate-500 uppercase text-xs tracking-wide font-semibold` |
| Collapsed tooltip | `bg-slate-900 text-white` (inverted, ma się wyróżniać) |

### App Topbar

- Tło: `bg-white border-b border-slate-200`.
- Akcje: ikony w `text-slate-600` z hover `text-slate-900 bg-slate-100`.
- Primary CTA: `bg-navy-900 text-white hover:bg-navy-800` — navy token, nie crimson (§18.3 VIS-006; wzorzec: `variant="primary"` w `src/components/ui/primitives/Button.tsx`). Crimson (`variant="brand"`) tylko dla Talk-to-Teresa/destructive (maksymalnie jeden CTA na topbarze).
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

- Po selection: `bg-navy-900 text-white border-t border-navy-800` (neutralny wysoki kontrast — nie crimson; zaznaczenie masowe to stan roboczy, nie marka/alarm, zob. §6).
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
- `surface-selected` → `slate-100` + `ring-slate-300/60` + info accent bar `shadow-[inset_4px_0_0_var(--c-info)]` (NIE `primary-50` — crimson czyta się jako alarm; SSOT klas: `src/components/shared/selectionTokens.ts`)

### Status

- `status-success` → `emerald-100` / `border-emerald-200` / `emerald-800`
- `status-warning` → `amber-100` / `border-amber-300` / `amber-900`
- `status-danger` → `red-100` / `border-red-200` / `red-800`
- `status-info` → `blue-100` / `border-blue-200` / `blue-800`
- `status-neutral` → `slate-100` / `border-slate-200` / `slate-800`

### Stany interaktywne

- `focus-ring` → `ring-c-focus` + `ring-offset-2 ring-offset-white`
- `hover-surface` → `slate-50`
- `active-surface` → `slate-100` + info accent (selekcja = neutral/blue, nie crimson)

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
Każda klasa koloru tekstu/tła MUSI mieć poprawny odpowiednik light — nie wolno polegać na fallbacku. **Metadata (daty, timestampy, liczniki) NIGDY `text-primary-*`/crimson** — w light wygląda jak alarm. Metadata = `text-slate-500/600` (§2).

> **K-36 korekta (2026-08-02):** poprzednia wersja tego punktu podawała jako dowód „187 komórek dat `rgb(145,10,40)` w light" jako crimson-leak. Źródło (`docs/qa/MASTER_VISUAL_QA_CATALOG.md`, wpis VIS-002) **explicite odrzuca ten wniosek po zbadaniu**: to nie `text-primary`/crimson leak, tylko intencjonalny sygnał wieku (`AGING_STYLES`, `InboxContent.tsx:676`: fresh→emerald, warm/hot→amber, critical >3 dni→`rose-700`). `rgb(145,10,40)` to skonfigurowany kolor `aging-critical`, nie fallback. Demo dane były stare → prawie wszystko „critical" → prawie wszystko czerwone, stąd pozorne „187 leak" z samego pomiaru koloru bez sprawdzenia źródła. Jedyna realna naprawa z tego wpisu: usunięto `animate-pulse` z `critical` (pulsowanie rozpraszało), kolor rose został jako celowy sygnał. Reguła wyżej (metadata nigdy `text-primary`/crimson) zostaje w mocy — to był fałszywy alarm konkretnego przykładu, nie unieważnienie reguły.

### 18.2 Badge danger MUSI mieć fill w light (VIS-001)
Współdzielony komponent badge: wariant light **obowiązkowo** tło(100)+border(200)+tekst-danger(800) (§5). Zakaz dark-only wariantu z fallbackiem do `transparent`+`slate`. Wykryte: „Critical"/„overdue" = transparent bg + slate text w light (nie czyta się jako danger).

### 18.3 Primary-CTA = navy token (VIS-006)
Główny CTA modułu = navy token (po T2). Crimson **tylko** Talk-to-Teresa / destructive (budżet §0 CANON). Ujednolicić: Tools „Add", Initiatives „New initiative" (crimson) → navy, jak My Work / Results.

---

### Changelog v3.3 (2026-08-02)

Po zmianie palety Tailwind (`primary-*` = crimson `#85182F`, `tailwind.config.js:204`) dokument w kilku miejscach dalej kazał używać `primary-*` tam, gdzie po recolorze znaczyło to „crimson" — czyli naruszenie TRIADA_KANON pkt 38/39/43 (crimson zakazany jako fokus/aktywny/zaznaczenie/zwykłe CTA). Naprawiono:

- **Fokus** (§6, §7, §10, §16): `outline-primary-500` / `ring-primary-500` / `ring-primary-300` / `border-primary-500` → ujednolicone na token `--c-focus` / `--c-focus-solid` (`ring-c-focus`, `outline-c-focus`, `border-c-focus-solid`).
- **Stan aktywny/zaznaczenie** (§6 wiersz tabeli, §11 sidebar): chipy filtrów i item sidebar `active` → neutral/info (`bg-blue-50 border-blue-300 text-blue-800`, `bg-slate-100 text-slate-900` + `border-c-info`), nie crimson.
- **Bulk action bar** (§6, §12) i **Primary CTA topbara** (§11): `bg-primary-600` → `bg-navy-900` (navy token, zgodnie z §18.3 VIS-006 i realnym `variant="primary"` w `src/components/ui/primitives/Button.tsx`).
- **Progress fill** (§6): `bg-primary-500` → `bg-c-info` (progres = informacyjny, nie marka/alarm).
- Wiersze `primary` w §4/§5 zostały — to legalna semantyka brandowa (marka/destrukcja) — dopisano zastrzeżenie, że nie oznaczają „aktywny/wybrany".

### Changelog v3.4 (2026-08-02, panel adwersaryjny)

Naprawa naprawy — panel adwersaryjny wykrył, że sweep v3.3 wprowadził nowe sprzeczności (z `visual-language.md`) i cytowania niezgodne z kodem. Zweryfikowano kodem i naprawiono:

- **K-18 (sidebar container, §11):** dokument i `visual-language.md` podawały dwa różne, oba błędne hexy tła sidebaru (`bg-white` tu, `bg-slate-100` tam) i sprzeczne polecenia co do `border-r`. Realny kod (`Sidebar.tsx:489`): `bg-slate-50`, zero `border-r`, separacja przez `boxShadow`. Oba dokumenty ujednolicone na ten stan.
- **K-21 (sidebar item active, §11):** dokument cytował `NavItem.tsx` jako wzorzec klasy `border-l-2 border-c-info`, której w pliku nie ma. Poprawiono na realną implementację: tło `bg-slate-200/60 text-c-text`, akcent-pasek jako osobny `motion.div` z `bg-[var(--c-info)]` (linie 109, 181), nie border-klasa.
- **K-36 (VIS-002, §18.1):** „187 komórek dat crimson-leak" był odrzuconym wnioskiem w źródle (`MASTER_VISUAL_QA_CATALOG.md`) — to intencjonalny aging config, nie leak. Przykład poprawiony zgodnie ze źródłem, reguła nadrzędna (metadata nigdy crimson) zostaje.
- **K-19 (hover wiersza, §6):** rozstrzygnięte kodem — realny hover to token `hover:bg-state-hover` (`FilterableTable.tsx:799`, `color-mix` w `src/index.css:222`), różny od obu wcześniejszych propozycji (`bg-slate-50` tu, `bg-slate-100/80` w `color-system.md`). Wpisano wartość z kodu, oznaczono dług.
- **K-P1-06 (CENTRAL REMAP):** dopisano ostrzeżenie przy §4 (pierwsza tabela z klasami `blue-*`/`amber-*`/itd.) o przepięciu tych rodzin na paletę HBS w `tailwind.config.js`, z odesłaniem do `FOUNDATION_TOKEN_CONTRACT.md` §7.

Sekcje §8, §9, §10, §13 nie były ruszane — panel potwierdził, że są poprawne.
