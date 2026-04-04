# UI/UX Standard dla Modułów Consultinity

> **Złoty standard referencyjny: ClickUp**

## Struktura Ekranu Modułu

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Module > Surface/Tool                      [System] [LLM] [AI] [User]          │
├─────────────────────────────────────────────────────────────────────────────────┤
│  🔍 │ [Tab 1] [Tab 2] [Tab 3]      │ [Filters…] [View] [Tool] [+New] [Area]     │
├─────────────────────────────────────────────────────────────────────────────────┤
│  [≡ List] [Doc 1 ●] [Doc 2 ●] [Doc 3 ●]                    (dynamic tabs)       │
├─────────────────────────────────────────────────────────────────────────────────┤
│  TYPE ▼    NAME                 CATEGORY    STATUS ▼   PROGRESS   UPDATED       │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ...       ...                  ...         ...        ...        ...           │
│            (content area - table/kanban/matrix/timeline)                        │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Nagłówek (Breadcrumbs)

- **Lokalizacja:** Lewy górny róg
- **Zawartość (KANON v3):** `Module > Surface/Tool`  
  Przykłady:
  - `My Work > Ideas`
  - `Tools > Strategic Analysis`
  - `Reports > Builder`
- **❌ NIE MA:** Dużego napisu z nazwą modułu - informacja już jest w breadcrumbs

---

## 2. Pasek Nawigacji Głównej

### Lewa strona:

| Element         | Opis                                                 |
| --------------- | ---------------------------------------------------- |
| **🔍 Lupa**     | Mała ikona, po kliknięciu rozwija panel wyszukiwania |
| **Główne taby** | Przyciski nawigacji do rodzajów danych w module      |

**KANON v3 (MUST):** główne taby **nie** pokazują liczników (badge z liczbą).  
Liczniki i presety filtrów żyją w **Command Row** (linia 3) jako “counter chips”.

**Przykłady tabów dla różnych modułów:**

| Moduł               | Taby                                               |
| ------------------- | -------------------------------------------------- |
| **Discovery Tools** | Discovery, Reports, Initiatives                    |
| **Assessment**      | Assessment, Reports, Initiatives                   |
| **Initiatives**     | Draft, Planning, Review, Approved, Executing, Done |
| **Execution**       | Initiatives, Tasks, Decisions, Reports             |
| **Benefits**        | Completed, KPIs, ROI Analysis                      |

### Prawa strona:

| Element              | Opis                                                           |
| -------------------- | -------------------------------------------------------------- |
| **Area (toggle panelu lewego)** | Kanoniczny toggle lewego panelu “obszaru pracy” dla danego ekranu. **Domyślnie:** to jest split panel (AI/chat/kontekst), który można otworzyć i zamknąć. Nie dotyczy globalnego sidebara modułów. |
| **Primary CTA (Add)** | “+ New …” / “Dodaj …” (kontekstowy). Jeśli ekran pozwala tworzyć/uruchamiać obiekt lub akcję startową — user zawsze szuka tego przycisku w tym slocie. **Kolor CTA:** kolor narzędzia/artefaktu, który tworzymy; jeśli ekran nie ma przypisanego koloru narzędzia → **purple** (fallback). |
| **Tool (opcjonalny)** | Przycisk narzędzi specyficznych dla ekranu — tylko tam, gdzie istnieje dodatkowy panel narzędziowy (np. Notebook / IDE / prezentacje / report builder / workspace’y). |
| **View Toggle**      | Przełącznik trybu prezentacji kolekcji (ikony). Zawsze ten sam porządek ikon (z `view-modes-standard.md`), pokazujemy tylko dostępne tryby. |
| **Filters**          | Filtry kolekcji. **MUST:** w topbarze utrzymujemy **maksymalnie jedno** “okno wyboru” (dropdown/select), żeby nie robić bałaganu. Pozostałe presety/liczniki/filtry pokazujemy w **Command Row** jako chipy. Dla tabel: filtry i sortowanie w nagłówkach kolumn (KANON). Dla pozostałych view modes: “Filters…” może zawierać też sekcję **Sort** (bez dokładania osobnego przycisku w topbarze). |

### Kolejność elementów topbara (KANON v3)

W module hub (w tym samym rzędzie), zawsze trzymamy kolejność:

- **Lewa strona**: Search toggle → Main tabs (od lewej do prawej, zgodnie z Operating Model v3)
- **Prawa strona (wyrównane do prawej)**: **(od prawej)** **Area** → **Add** → **Tool** → **View** → **Filters**

> Uwaga implementacyjna: ponieważ to jest klaster wyrównany do prawej, często renderujemy go w DOM od lewej do prawej jako: `Filters → View → Tool → Add → Area`. **Ale wizualna kolejność “od prawej” musi zgadzać się z kanonem.**

**Przykłady category buttons:**

| Moduł               | Przyciski                                       |
| ------------------- | ----------------------------------------------- |
| **Discovery Tools** | Strategy, Operations, Digital, Process Auto     |
| **Assessment**      | + New Assessment (otwiera modal z frameworkami) |
| **Initiatives**     | AI Generate, + New Initiative                   |

---

## 3. Pasek Dynamicznych Kart (Dynamic Tabs)

- **Lokalizacja:** Pod główną nawigacją
- **Zawartość:** Otwarte dokumenty/strony w kontekście modułu
- **Elementy:**
  - `[≡ List]` - przycisk powrotu do listy
  - `[SWT Sales Process S... ●]` - otwarta karta z kodem typu i statusem (kropka kolorowa)
- **Zachowanie:**
  - Można otworzyć wiele kart jednocześnie
  - Aktywna karta = **fioletowa ramka**
  - Karty można zamykać (×)
  - Max ~6 widocznych, reszta w overflow menu (+N)

### 3.1 Jeden stały “Command Row” (MUST)

Pod Module Topbar zawsze istnieje **jeden stały rząd**, który pełni 1 z 3 ról (zawsze w tej samej wysokości i stylu):

1) **Bulk actions row (multi-select)** — gdy user zaznaczy checkboxy na liście i pracuje na wielu pozycjach naraz.  
2) **Search row** — gdy user włączy lupę (expandable search bar).  
3) **Dynamic tabs row** — gdy są otwarte dokumenty (tabs).  
4) **Context counters row** — gdy jesteśmy w list view i chcemy pokazać najważniejsze presety/liczniki “na twarz” (np. Overdue, This week, Wymaga akcji).

**Reguły:**

- **MUST:** na ekranie nie mogą istnieć 2–3 dodatkowe rzędy filtrów/toolbarów między topbarem a tabelą.
- **MUST:** “counter chips” to **presety filtrów**, nie “liczniki do patrzenia”.
  - **MUST:** od lewej zawsze jest **`ALL`** — klik resetuje presety i oznacza, że **żaden preset nie filtruje**.
  - **MUST:** pozostałe chipy po kliknięciu **filtrują kolekcję** do danej grupy (np. Overdue / Critical / This week / Saved / AI).
  - **MUST:** tryb jest **single‑select** (aktywny jest maksymalnie 1 preset). Klik w aktywny preset wraca do `ALL`.
  - **MUST:** aktywny preset jest **wyróżniony fioletem** (spójnie z innymi stanami “selected” w aplikacji).
- **SHOULD:** jeśli otwarty jest czat lub inny panel, ten rząd nie rozpycha layoutu — content area ma priorytet.
- **Priorytet trybów (MUST):** **Bulk actions** nadpisuje pozostałe tryby (to jest “szybkie wybieranie i działanie”). Search ma priorytet nad tabs/counters. Tabs mają priorytet nad counters.
- **Hierarchia wizualna (MUST):** elementy w **Command Row** są **symbolicznie mniejsze** niż główne taby/topbar (żeby nie wyglądały jak ten sam poziom nawigacji).

### 3.2 Standard wizualny Menu 3 — tło i separator (MUST)

**Tło Menu 3 (Command Row):**

Menu 3 dziedziczy tło z `ModuleNavBar` (`bg-white dark:bg-navy-900`), ale chipy wewnątrz mają **ciemniejsze tło** (`dark:bg-navy-800`), co tworzy wizualne wyróżnienie paska chipów względem tab baru (Menu 2).

**Separator:**

Pod całym `ModuleNavBar` (obejmującym Menu 2 + Menu 3) przebiega **jedna linia separująca** oddzielająca od obszaru roboczego:

```
border-b border-slate-200/60 dark:border-white/5
```

**Hierarchia warstw (ciemny motyw):**

| Warstwa         | Tło              | Opis                                |
| --------------- | ---------------- | ----------------------------------- |
| Menu 2 (tabs)   | `dark:bg-navy-900` | Tło tab baru                       |
| Menu 3 (chips)  | `dark:bg-navy-900` + chipy `dark:bg-navy-800` | Chipy wyróżnione ciemniejszym tłem |
| Separator        | `dark:border-white/5` | Subtelna biała linia 5% opacity   |
| Obszar roboczy  | `dark:bg-navy-950` | Ciemniejsze tło contentu           |

**SSOT implementacji:** `src/components/shared/ModuleHub/ModuleNavBar.tsx`

### 3.3 Standard wizualny chipów Menu 3 — "Preset Filter Chips" (MUST)

Wszystkie chipy w Command Row (we wszystkich modułach) stosują **identyczny format wizualny**.

**Anatomia chipa:**

```
[ 🔴 ikona kolorowa ] [ Label ] [ ⬤ badge z liczbą ]
```

Trzy elementy w jednym wierszu: kolorowa ikona (14px), tekst etykiety, okrągły badge z counterem.

**Kształt i rozmiar:**

| Właściwość  | Wartość                                                  |
| ----------- | -------------------------------------------------------- |
| Wysokość    | `h-8` (32px)                                             |
| Zaokrąglenie | `rounded-full` (pill shape)                             |
| Padding     | `px-2.5`                                                 |
| Gap wewnętrzny | `gap-1.5`                                             |
| Tekst       | `text-[11px] font-medium`                                |
| Kontener    | `inline-flex items-center`                               |
| Przejście   | `transition-colors`                                      |
| Odstęp między chipami | `gap-2` (8px)                                  |

**Stan nieaktywny (default):**

| Element | Light                          | Dark                                  |
| ------- | ------------------------------ | ------------------------------------- |
| Tło     | `bg-slate-100`                 | `dark:bg-navy-800`                    |
| Tekst   | `text-slate-600`               | `dark:text-slate-300`                 |
| Ramka   | `border-slate-200/60`          | `dark:border-navy-700/60`             |
| Hover   | `hover:bg-white/60`            | `dark:hover:bg-navy-900/50`           |

**Stan aktywny (selected) — fiolet:**

| Element | Light                          | Dark                                  |
| ------- | ------------------------------ | ------------------------------------- |
| Tło     | `bg-purple-500/10`             | `bg-purple-500/10`                    |
| Tekst   | `text-purple-700`              | `dark:text-purple-200`                |
| Ramka   | `border-purple-500/40`         | `border-purple-500/40`                |

**Stan disabled:**

| Element | Light                          | Dark                                  |
| ------- | ------------------------------ | ------------------------------------- |
| Tło     | `bg-slate-100/60`              | `dark:bg-navy-800/40`                 |
| Tekst   | `text-slate-400`               | `dark:text-slate-500`                 |
| Ramka   | `border-slate-200/40`          | `dark:border-navy-700/40`             |
| Kursor  | `cursor-not-allowed`           | `cursor-not-allowed`                  |

**Badge (counter):**

| Stan       | Light                                       | Dark                                        |
| ---------- | ------------------------------------------- | ------------------------------------------- |
| Nieaktywny | `bg-slate-200 text-slate-600`               | `dark:bg-navy-700 dark:text-slate-300`      |
| Aktywny    | `bg-purple-500/30 text-purple-700`          | `bg-purple-500/30 dark:text-purple-200`     |

Format badge: `px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums leading-none`

**Ikony chipów:**

Każdy chip ma kolorową ikonę (14px) z palety semantycznej. Chip `ALL` zamiast ikony ma małą kropkę (`w-2 h-2 rounded-full bg-slate-400`).

Przykłady kolorów ikon:

| Chip             | Ikona            | Kolor ikony         |
| ---------------- | ---------------- | -------------------- |
| ALL              | kropka 2×2       | `bg-slate-400`       |
| Action Queue     | `ClipboardList`  | `text-cyan-400`      |
| Decisions        | `Scale`          | `text-amber-400`     |
| Blockers/Blocked | `AlertTriangle`  | `text-rose-400`      |
| Risk             | `Shield`         | `text-rose-400`      |
| Workload         | `Users`          | `text-violet-400`    |
| Missing dates    | `Calendar`       | `text-yellow-400`    |
| Due soon         | `Clock`          | `text-cyan-400`      |
| Reports          | `FileText`       | `text-cyan-400`      |

**Tailwind class strings (copy-paste ready):**

```ts
const chipBase =
  'h-8 inline-flex items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium border transition-colors whitespace-nowrap';

const badgeBase =
  'px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums leading-none';

// Nieaktywny chip:
'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-navy-700/60 hover:bg-white/60 dark:hover:bg-navy-900/50'

// Aktywny chip:
'bg-purple-500/10 text-purple-700 dark:text-purple-200 border-purple-500/40'

// Disabled chip:
'bg-slate-100/60 dark:bg-navy-800/40 text-slate-400 dark:text-slate-500 border-slate-200/40 dark:border-navy-700/40 cursor-not-allowed'

// Nieaktywny badge:
'bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-300'

// Aktywny badge:
'bg-purple-500/30 text-purple-700 dark:text-purple-200'
```

**SSOT implementacji:** `src/components/Execution/ExecutionHub.tsx` → `commandRowContent` (referencyjny wzorzec dla wszystkich modułów).

### 3.4 Przyciski AI w Menu 3 — prawa strona (MUST)

Po prawej stronie Command Row (Menu 3) umieszczamy **przyciski funkcji AI** kontekstowe dla danego ekranu/taba.

**Layout Menu 3:**

```
[ preset chips (lewa) ] ─────────────────────── [ AI buttons (prawa) ]
```

Kontener Command Row używa `flex items-center justify-between` — chipy po lewej, przyciski AI po prawej.

**Zasady:**

- **MUST:** Przyciski AI pojawiają się **tylko gdy ekran oferuje funkcje AI** — nie dodajemy pustych slotów.
- **MUST:** Przyciski AI są **kontekstowe** — zmieniają się w zależności od aktywnego taba/widoku (np. Management → "AI Triage" + "AI Manage All"; Resources Analysis → "AI Balance workload").
- **MUST:** Rozmiar przycisków AI jest **identyczny z chipami Menu 3** (`h-8`, `text-[11px]`, `rounded-full`) — nie mogą być większe ani mniejsze niż preset chips.
- **MUST:** Ikona `Sparkles` (lucide) jest kanonicznym symbolem AI w przyciskach Menu 3.
- **SHOULD:** Maksymalnie 2–3 przyciski AI na ekran. Jeśli jest więcej akcji AI — grupuj w dropdown.

**Format przycisku AI:**

Dwa warianty — **secondary** (outline) i **primary** (filled). Jeśli ekran ma 2 przyciski AI, pierwszy jest secondary, drugi primary.

**AI Secondary (outline):**

| Właściwość  | Wartość                                                  |
| ----------- | -------------------------------------------------------- |
| Kształt     | `h-8 rounded-full px-3` (identyczny z chipami)           |
| Tekst       | `text-[11px] font-semibold`                              |
| Ikona       | `Sparkles` lub kontekstowa (12–14px), po lewej           |
| Gap         | `gap-1.5`                                                |

| Element | Light                          | Dark                                  |
| ------- | ------------------------------ | ------------------------------------- |
| Tło     | `bg-violet-50`                 | `dark:bg-violet-900/20`               |
| Tekst   | `text-violet-700`              | `dark:text-violet-400`                |
| Ramka   | `border border-violet-200`     | `dark:border-violet-800/40`           |
| Hover   | `hover:bg-violet-100`          | `dark:hover:bg-violet-900/30`         |
| Disabled | `disabled:opacity-40`         | `disabled:opacity-40`                 |

**AI Primary (filled):**

| Element | Wartość                                                  |
| ------- | -------------------------------------------------------- |
| Tło     | `bg-gradient-to-r from-violet-600 to-cyan-600`           |
| Tekst   | `text-white text-[11px] font-semibold`                   |
| Kształt | `h-8 rounded-full px-3`                                  |
| Shadow  | `shadow-sm`                                              |
| Hover   | `hover:shadow-md hover:brightness-110`                   |
| Disabled | `disabled:opacity-40`                                   |

> **Uwaga:** Kolor przycisków AI (violet) jest wstępny — może zostać zmieniony. Gradient primary `violet → cyan` jest obecnym standardem.

**Tailwind class strings (copy-paste ready):**

```ts
// AI Secondary (outline):
'h-8 inline-flex items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold border border-violet-200 bg-violet-50 text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-40 dark:border-violet-800/40 dark:bg-violet-900/20 dark:text-violet-400 dark:hover:bg-violet-900/30'

// AI Primary (filled):
'h-8 inline-flex items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold text-white bg-gradient-to-r from-violet-600 to-cyan-600 shadow-sm transition-all hover:shadow-md hover:brightness-110 disabled:opacity-40'
```

**Przykłady przycisków AI na ekranach:**

| Ekran / Tab                     | Przyciski AI                                |
| ------------------------------- | ------------------------------------------- |
| Execution → Management (lane)   | `AI Triage` (secondary) + `AI Manage All` (primary) |
| Initiatives → Analysis → Resources | `AI Balance workload` (primary)          |
| Execution → Summary             | _(brak — ekran nie ma dedykowanej funkcji AI)_ |
| Execution → Reporting (report)  | `AI Generate` (primary)                     |

**SSOT implementacji:** `src/components/Execution/ManagerModuleView.tsx` (referencyjny wzorzec AI buttons).

---

## 4. Tabela Danych

### Nagłówki kolumn z filtrami:

| Kolumna  | Filtrowalna   | Sortowalna |
| -------- | ------------- | ---------- |
| TYPE     | ✅ (dropdown) | ❌         |
| NAME     | ❌            | ✅         |
| CATEGORY | ✅ (dropdown) | ❌         |
| STATUS   | ✅ (dropdown) | ❌         |
| PROGRESS | ❌            | ✅         |
| UPDATED  | ❌            | ✅         |
| ACTIONS  | ❌            | ❌         |

### Filtry w nagłówkach:

- Kliknięcie na ▼ otwiera dropdown z opcjami
- Checkbox multiselect
- Przyciski Clear / Apply

---

## 5. Formaty Prezentacji Danych

| Format       | Ikona | Użycie                             |
| ------------ | ----- | ---------------------------------- |
| **Table**    | ≡     | Domyślny, lista z kolumnami        |
| **Grid**     | ⊞     | Karty w siatce                     |
| **Kanban**   | ▭▭▭   | Kolumny statusów (Draft → Done)    |
| **Matrix**   | ⊞⊞    | Macierz 2D (np. priority × impact) |
| **Timeline** | ━━━   | Gantt-style timeline               |

---

## 6. Kolorystyka i Stany

### Aktywny element:

```css
/* Fioletowa ramka + lekkie tło */
border: 1px solid #8b5cf6;
background: rgba(139, 92, 246, 0.1);
```

### Nieaktywny element:

```css
/* Szara ramka */
border: 1px solid #374151;
background: transparent;
```

### Statusy (kropki kolorowe):

| Status    | Kolor           |
| --------- | --------------- |
| Draft     | ⚫ Szary        |
| In Review | 🟠 Pomarańczowy |
| Approved  | 🟢 Zielony      |
| Completed | 🟢 Zielony      |
| Blocked   | 🔴 Czerwony     |
| Executing | 🔵 Cyan         |

---

## 7. Wyszukiwanie

### Kompaktowa lupa:

- Mała ikona 🔍 po lewej stronie
- Kliknięcie rozwija pole `Search...`
- Wyszukiwanie globalne w module

### Filtry w tabeli:

- Dropdown w nagłówkach kolumn
- Multiselect z checkboxami
- Apply/Clear buttons

---

## Standard tabel aplikacji (Golden Standard)

Jeśli ekran jest “hubem tabelarycznym” (listy, zarządzanie, admin tools), obowiązuje **App Table Standard**:

- Dokument: `docs/ui-standards/03-modules/app-table-standard.md`
- Wzór: “Decisions” (My Work)
- Referencyjna adopcja: “Report Templates” (Admin)

---

## 8. Responsywność

- **Desktop (>1024px):** Pełny layout
- **Tablet (768-1024px):** Zwinięte category buttons, mniejsze odstępy
- **Mobile (<768px):** Bottom navigation, uproszczone taby

### 8.1 Overflow / kolaps klastrów po prawej (MUST)

Jeśli z jakiegoś powodu brakuje miejsca w Module Topbar:

- **MUST:** nie łamiemy topbara do 2 linii (poza Command Row).  
- **MUST:** utrzymujemy czytelny “anchor” dla użytkownika:
  - **Area** (toggle panelu) + **Add** zostają widoczne najdłużej.
  - pozostałe elementy mogą trafić do overflow (`…`) zachowując kolejność logiczną.

Rekomendowany porządek kolapsu (pierwsze idzie do overflow):

1) **Filters** (jako menu/panel nadal dostępne z overflow)
2) **View**
3) **Tool**
4) **Add**
5) **Area** (ostatnie do schowania; najlepiej nigdy)

---

## 9. Moduły z tym standardem

| Moduł           | Status              |
| --------------- | ------------------- |
| Discovery Tools | ✅ Zaimplementowany |
| Assessment      | ✅ Zaimplementowany |
| Initiatives     | 🔄 Do aktualizacji  |
| Execution       | 🔄 Do aktualizacji  |
| Benefits        | 🔄 Do aktualizacji  |
| Economics       | 🔄 Do aktualizacji  |
| Reports         | 🔄 Do aktualizacji  |

---

## 10. Wyjątki

### Moduły BEZ tego standardu:

- **AI Chat** - pełnoekranowy interfejs czatu
- **Settings** - własny layout ustawień
- **Admin** - własny layout administracyjny
- **SuperAdmin** - własny layout

---

## Referencje

- **Złoty standard:** [ClickUp](https://clickup.com)
- **Komponenty:** `src/components/shared/ModuleHub/`
- **Przykład implementacji:** `src/components/Discovery/DiscoveryToolsHub.tsx`
