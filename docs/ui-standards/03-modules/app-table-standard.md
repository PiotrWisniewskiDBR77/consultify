# App Table Standard (Golden Standard)

Ten dokument opisuje **standard tabel aplikacji** (UI/UX), który utrzymujemy konsekwentnie w kolejnych modułach.

## Referencyjny wzór (SSOT)

- **Wzór UI/UX**: tabela “Decisions” (My Work)
- **Pierwsza pełna adopcja tego standardu**: `Admin Panel > Report Templates`

## Zasady (muszą być spełnione)

### 1) Breadcrumbs – tylko raz

- **Breadcrumbs są w globalnym headerze** (MainLayout).
- **Nie dodajemy drugiego breadcrumb / tytułu w obszarze roboczym** (żadnych dodatkowych nagłówków “Admin > …” nad tabelą).

### 2) Szerokość obszaru roboczego

- Tabela ma wykorzystywać **prawie całą szerokość** obszaru roboczego.
- Zostawiamy **małą granicę** (mały padding) między sidebarem a tabelą.
- **Nie ograniczamy** widoku przez `max-w-*` w wrapperach admin/settings dla widoków tabelarycznych.

### 3) Tła i “ramka” (dark UI)

- **Tło poza ramką**: ciemniejsze (`bg-navy-950`)
- **Wewnątrz ramki / panelu**: jaśniejsze (`bg-navy-900`)
- Delikatne obramowania: `border-navy-700/50` oraz separatory `border-b border-navy-700/50`

### 3.1) Tła i "ramka" (light UI) — parity

**Nie jest to rozjaśniona wersja dark UI.** Tabela w light mode musi trzymać jawną hierarchię warstw:

- **Tło aplikacji (poza ramką):** `bg-slate-100` (nie `bg-white`)
- **Wewnątrz ramki / panelu:** `bg-white`
- **Header tabeli:** `bg-slate-50`
- **Obramowania i separatory:** `border-slate-200` (NIE `border-*/10`, NIE `border-slate-100`)
- **Hover wiersza:** `bg-slate-50`
- **Selected wiersz:** `bg-primary-50 ring-1 ring-inset ring-primary-200`
- **Resizer kolumny:** `bg-slate-200` z hover `bg-primary-400`

Tabela w light mode musi być rozróżnialna od preview pane bez zgadywania. Wymagany wyraźny border `border-slate-200` na granicy tabela / preview.

SSOT pełny dla light mode (kontrast, badge, focus, stany): `docs/ui-standards/00-foundation/light-mode-readability.md`.

### 4) Top bar (nad tabelą) – identyczna wysokość kontrolek

Wszystkie kontrolki w top barze mają być **tej samej wysokości**: **`h-9`**.

- **Search toggle**: kwadrat `h-9 w-9`
- **Taby (All/App/Org)**: `h-9` + badge z liczbą
- **Selecty filtrów** (np. Module / Format): `h-9`
- **Primary action** (np. “New …”): `h-9` + gradient (jak w Decisions)

Wynik: więcej miejsca na akcje po prawej i czytelne wyrównanie.

**MUST (brak duplikacji kontrolek):**

- Jeśli moduł ma **Module Topbar** (view modes + filters), to tabela nie może dokładać dodatkowych “mini‑toolbarów” typu: `Smart sort`, `Columns`, `Views` pod wyszukiwarką.
- Zasada: **jedno miejsce** do zmiany widoku/filtrów/kolumn = Module Topbar + header filters w tabeli.
  - “Columns” = konfiguracja kolumn (R1+) w menu/panelu, nie jako stały pasek pod search.
  - “Views” = saved filters/scopes w `Filters…`, nie jako osobny rząd przycisków.

### 5) Wyszukiwarka – wzór “toggle → expandable”

- W top barze jest **ikona lupy** (toggle).
- Po kliknięciu, pod top barem pojawia się **expandable search bar**:
  - `autoFocus`
  - przycisk `X` czyści i zamyka

### 6) Kolumny, szerokości i filtry (Decisions-style)

- Kolumny zarządzane jako definicje (np. `TEMPLATE_COLUMNS`)
- **Resizable columns**: `ColumnResizer`
- **Header filters**: `FilterDropdown` (multiselect z checkboxami)
- Nowe kolumny pod filtrowanie (np. **Audience**, **User**) muszą mieć:
  - spójne szerokości
  - bezpieczny rendering (patrz niżej)
  - filtr w headerze, jeśli mają służyć do filtrowania

**MUST (resizer UI):**

- Chwytaki/linie resizerów nie mogą wyglądać jak “podwójne grube separatory”.
- Standard: **pojedyncza, subtelna linia** (opacity 3–8% w dark), a hover resizera to tylko delikatne wzmocnienie tła, bez “ramki”.

**MUST (Actions column):**

- Ostatnia kolumna to **Actions** i zawiera **jedno** wejście do menu akcji: ikonę **kebab (⋮)**.
- **Zawsze pionowe 3 kropki (⋮)**, nigdy poziome (⋯).
- Menu akcji zawiera: open / quick actions / destructive (z confirm) zależnie od encji.
- W całej aplikacji Actions column działa identycznie (miejsce, zachowanie, ikonografia).

**MUST (wiersz = jedna linia “primary” + reszta w kolumnach):**

- Nie duplikujemy informacji w “drugiej linii” pod tytułem (np. nazwa szablonu/kategorii powtórzona pod nazwą).
- Jeśli potrzebujesz pokazać typ/kategorię/slug — to jest **osobna kolumna** (i wtedy może być filtrowalna).
- Domyślny rytm listy ma być stabilny (wysokość wiersza), żeby oko mogło skanować tabelę bez “falowania”.

**MUST (zero ad-hoc pasów między topbarem a tabelą):**

- Nie dodajemy dodatkowych, niestandardowych “help stripów”, bannerów i opisów workflow **pomiędzy** Module Topbar a tabelą.
- Jeśli trzeba pokazać liczniki typu “3 spóźnione / 5 do zatwierdzenia” — używamy **Command Row (Context counters)** zgodnie z `module-hub-standard.md`.

### 7) Stabilność danych (ważne)

Nie zakładaj, że backend zawsze zwróci kompletne pola.

- Każde pole używane w `.toLowerCase()` / `.toUpperCase()` musi być zabezpieczone:
  - np. `(t.sourceType || '').toLowerCase()`
- W UI pokazujemy placeholder `—` zamiast crasha.

## Checklist (Do/Don’t)

- **Do**: breadcrumbs tylko w `MainLayout`
- **Do**: pełna szerokość contentu (bez `max-w-*`)
- **Do**: `h-9` dla wszystkich kontrolek top bara
- **Do**: toggle search + expandable search bar
- **Do**: resizable columns + header filters (multiselect)
- **Don’t**: dodatkowe tytuły i breadcrumb w widoku admin/settings (duplikacja)
- **Don’t**: brak guardów na pola z API (crashe typu `undefined.toLowerCase()`)

## Referencje w kodzie (kopiuj styl z tych plików)

- **Decisions – wzór**:
  - `src/components/MyWork/MyWorkHub.tsx` (top bar, search toggle)
  - `src/components/MyWork/DecisionsPanelContent.tsx` (tabela, kolumny, filtry, resizery)
- **Report Templates – adopcja standardu**:
  - `src/components/ReportBuilder/TemplatesManager.tsx`
- **Szerokość obszaru roboczego (Admin)**:
  - `src/views/admin/AdminSettingsModule.tsx` (padding, brak `max-w-*`)
- **Breadcrumbs dla Admin tabów**:
  - `src/hooks/useBreadcrumbs.ts` (odczyt `?tab=` → nazwa sekcji)
