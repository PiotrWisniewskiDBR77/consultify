# UI/UX Standard dla Modułów Consultify

> **Złoty standard referencyjny: ClickUp**

## Struktura Ekranu Modułu

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Module > Surface/Tool                      [System] [LLM] [AI] [User]          │
├─────────────────────────────────────────────────────────────────────────────────┤
│  🔍 │ [Tab 1] [Tab 2] [Tab 3]      │ [Filters…] [View icons] [Tool] [Dodaj] [Area] │
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
| **Primary CTA (Add)** | `Dodaj` / `New ...` (kontekstowy). Jeśli ekran pozwala tworzyć/uruchamiać obiekt lub akcję startową — user zawsze szuka tego przycisku w tym slocie. **Menu 2 rule:** nie dodajemy ikony `+` przed tekstem CTA; funkcję tworzenia komunikuje pozycja, label, kolor i ewentualny chevron. **Kolor CTA:** kolor narzędzia/artefaktu, który tworzymy; jeśli ekran nie ma przypisanego koloru narzędzia → **purple** (fallback). Jeśli moduł nie ma własnego flow create, CTA **może prowadzić do kanonicznego flow tworzenia** innego modułu zamiast duplikować modal (np. `Execution → New Initiative` otwiera `Initiatives`). |
| **Tool (opcjonalny)** | Przycisk narzędzi specyficznych dla ekranu — tylko tam, gdzie istnieje dodatkowy panel narzędziowy (np. Notebook / IDE / prezentacje / report builder / workspace’y). |
| **View Toggle**      | Przełącznik trybu prezentacji kolekcji jako segmented icon buttons, nie dropdown. Zawsze ten sam porządek ikon (z `view-modes-standard.md`), pokazujemy tylko dostępne tryby. |
| **Filters**          | Filtry kolekcji. **MUST:** w topbarze utrzymujemy **maksymalnie jedno** “okno wyboru” (dropdown/select), żeby nie robić bałaganu. Pozostałe presety/liczniki/filtry pokazujemy w **Command Row** jako chipy. Dla tabel: filtry i sortowanie w nagłówkach kolumn (KANON). Dla pozostałych view modes: “Filters…” może zawierać też sekcję **Sort** (bez dokładania osobnego przycisku w topbarze). **MUST NOT:** umieszczać tu lokalnych przełączników wizualizacji typu `prev/next`, `W/M`, `3M/6M/12M` - to są kontrolki konkretnego widoku i należą do jego wewnętrznego toolbara. |

### 2.1 Prawy klaster Menu 2 - korekty 2026-05-01

Prawy klaster `Module Topbar / Menu 2` musi być konsekwentny między modułami.

Zakazy:

- `Help` nie jest standardowym elementem prawego klastra `Menu 2`; Help ma swoje miejsce w globalnym shellu / sidebarze.
- `Primary CTA` w `Menu 2` nie używa ikony `+` przed tekstem; `Dodaj` może mieć chevron, jeśli otwiera menu wariantów.
- View toggle nie jest dropdownem typu `Table v` z menu `Table/Grid`; ma być widocznym przełącznikiem segmentowym.
- Nie pokazujemy dwóch filtrów z prawie identycznym opisem typu `Wszystkie obszary` + `Wszystkie źródła`, jeśli użytkownik nie rozumie różnicy między nimi.
- Nie używamy generycznych etykiet `Wszystkie ...` bez konkretnego kontekstu domenowego.

View toggle:

- Przełącznik widoku jest w dobrym miejscu w prawym klastrze.
- Ma postać dwóch lub więcej sąsiadujących buttonów ikonowych / segmented controls, a nie select/dropdown.
- Ikony mają stałą semantykę i kolejność:
  1. `Lista` po lewej.
  2. `Karty` / `Grid` po prawej.
- Kolejność ikon nie zmienia się per moduł.
- Aktywny stan musi być czytelny, ale spokojny: surface + subtelny accent, nie ciężki kolor.
- Jeśli dostępny jest tylko jeden widok, toggle jest ukryty albo disabled z tooltipem, ale nie udaje wyboru.

Filtry:

- Każdy dropdown filter musi mieć specyficzny opis wynikający z domeny.
- Trigger powinien mówić, co filtruje, a nie powtarzać generyczne `Wszystkie`.
- Dopuszczalne przykłady:
  - `Obszar: wszystkie`,
  - `Źródło: wszystkie`,
  - `Kategoria: wszystkie`,
  - `Status: aktywne`,
  - `Właściciel: ja`,
  - `Typ szablonu: wszystkie`.
- W bardzo ciasnych controls można skracać trigger do wartości, ale pełny kontekst musi być w tooltip/aria label i w menu.
- Dwa filtry obok siebie nie mogą wyglądać jak ten sam filtr z inną ikoną.

### Kolejność elementów topbara (KANON v3)

W module hub (w tym samym rzędzie), zawsze trzymamy kolejność:

- **Lewa strona**: Search toggle → Main tabs (od lewej do prawej, zgodnie z Operating Model v3)
- **Prawa strona (wyrównane do prawej)**: **(od prawej)** **Area** → **Add** → **Tool** → **View** → **Filters**

> Uwaga implementacyjna: ponieważ to jest klaster wyrównany do prawej, często renderujemy go w DOM od lewej do prawej jako: `Filters → View → Tool → Add → Area`. **Ale wizualna kolejność “od prawej” musi zgadzać się z kanonem.**

**Przykłady category buttons:**

| Moduł               | Przyciski                                       |
| ------------------- | ----------------------------------------------- |
| **Discovery Tools** | Strategy, Operations, Digital, Process Auto     |
| **Assessment**      | New Assessment (otwiera modal z frameworkami) |
| **Initiatives**     | AI Generate, New Initiative                   |

---

## 2b. Negatywny przykład - Interview / Szablony 2026-05-01

Na ekranie `Wywiad > Szablony` zaobserwowano układ, który nie spełnia docelowego standardu:

- `Help` znajduje się w prawym klastrze topbara, mimo że Help powinien być globalny/sidebarowy.
- View toggle jest w dobrym miejscu, ale musi utrzymywać stałą kolejność `Lista` po lewej i `Karty/Grid` po prawej.
- Dwa filtry obok siebie mają zbyt generyczne opisy (`Wszystkie obszary`, `Wszystkie źródła`) i są zbyt podobne semantycznie.
- Opisy filtrów powinny być bardziej specyficzne dla domeny szablonów/interview.

Docelowo dla takiego ekranu filtry powinny brzmieć np.:

- `Obszar pytań: wszystkie`,
- `Źródło szablonu: wszystkie`,
- `Status szablonu: aktywne`,
- `Właściciel: wszyscy`.

Nie chodzi o dokładne copy powyżej jako finalne, tylko o zasadę: trigger musi wyjaśniać wymiar filtrowania.

---

## 2c. Negatywny przykład - Tools / Biblioteka 2026-05-01

Na ekranie `Tools > Biblioteka` zaobserwowano kolejny układ niezgodny z docelowym standardem:

- `Dodaj` jako primary CTA jest w dobrym slocie i ma właściwą rangę, ale nie powinien mieć ikony `+`.
- `Help` pojawia się obok CTA, mimo że w tym miejscu jest zbędny.
- `Table` / `Grid` są ukryte pod dropdownem, a docelowo mają być stałymi przyciskami wyboru widoku.
- Otwarty dropdown view mode wygląda jak menu akcji, przez co miesza zmianę widoku z innymi kontrolkami topbara.

Docelowo prawy klaster dla takiego ekranu:

`[filtry domenowe] [Lista icon button] [Karty icon button] [Dodaj v]`

Jeśli `Dodaj` otwiera kilka typów tworzenia, chevron jest dopuszczalny. Ikona `+` nie jest dopuszczalna w tym slocie.

---

## 2d. Pozytywny przykład z korektą - Initiatives / Portfolio 2026-05-01

Na ekranie `Initiatives > Portfolio` zatwierdzamy jako dobry kierunek:

- przełącznik `Active / All` w `Menu 2`,
- zestaw przycisków widoku jako ikony, bez dropdownu,
- czytelny układ tabeli i status chips w `Menu 3`.

Korekty obowiązkowe:

- `Nowa inicjatywa` jest dobrym primary CTA, ale nie powinien mieć ikony `+`.
- Między `Menu 3` a tabelą nie wolno dodawać osobnego wiersza typu `0 zaznaczone` + duży przycisk AI.
- `AI: Analizuj zaznaczenie` należy do prawej strony `Menu 3` jako standardowy `h-8` przycisk AI, nie jako duży fioletowy CTA pod paskiem.
- `Menu 3` pokazuje tylko aktywne statusy/presety, żeby zostawić miejsce po prawej na AI actions i inne akcje kontekstowe.

Docelowy układ:

`[ALL] [Draft] [Pending Review] [In Review] [Planning] [Approved] ...aktywne statusy] ─── [AI Analizuj zaznaczenie]`

Jeżeli lista statusów nie mieści się w jednym wierszu, mniej istotne statusy trafiają do overflow `More`, a nie tworzą drugiego rzędu.

---

## 2e. Pozytywny przykład - Implementation / Zestawienie 2026-05-01

Na ekranie `Implementation > Zestawienie` zatwierdzamy jako bardzo dobry wzorzec:

- układ `Menu 2` z głównymi tabami po lewej,
- `Active / Wszystkie` jako przełącznik zakresu danych,
- segmented icon view switcher po prawej,
- `Menu 3` jako jeden rząd preset/status chips,
- tabela o dobrej gęstości, czytelnych kolumnach i wyraźnych statusach/progressach.

Jedyna korekta:

- `Nowa inicjatywa` pozostaje primary CTA, ale bez ikony `+`.

Ten ekran może służyć jako referencja dla hubów operacyjnych z tabelą, po usunięciu plusa z CTA.

---

## 2f. Pozytywny przykład - Implementation / Timeline 2026-05-01

Na ekranie `Implementation > Timeline` zatwierdzamy jako dobry kierunek:

- zachowanie tego samego `Menu 2` i `Menu 3` co w widoku tabelarycznym,
- timeline jako pełnoprawny view mode, a nie osobny ekran z własną nawigacją,
- widoczny pasek alertów/ostrzeżeń nad osią czasu,
- czytelne belki inicjatyw, progress, overdue/late markers i pionowa linia dnia bieżącego,
- view-local toolbar dla zakresu czasu (`8W`, `12W`, `16W`, `24W`) wewnątrz powierzchni timeline.

Korekty / doprecyzowania:

- Nagłówek osi czasu nie powinien być zbyt wysoki. Miesiąc i tydzień mogą być pokazane kompaktowo.
- Preferowany kompaktowy zapis tygodnia: `W18 (27)` albo `W18 / 27`, gdzie liczba w nawiasie oznacza pierwszy dzień tygodnia.
- Jeśli miesiąc jest pokazany jako osobny pasek, jego wysokość powinna być minimalna i nie może dublować informacji z tygodni.
- Dodatkowe akcje AI specyficzne dla timeline, jeśli nie są tymi samymi akcjami co w `Menu 3`, nadal trafiają po prawej stronie `Menu 3` jako standardowe przyciski AI.
- Lokalne kontrolki timeline, takie jak filtr, zoom, zakres czasu i jump-to-today, mogą zostać w `View-local Toolbar`, ale nie zastępują prawego slotu AI w `Menu 3`.

Ten widok jest dobrym kandydatem na standard timeline po zagęszczeniu headera osi czasu.

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
  - **MUST:** dla długich list statusów pokazujemy tylko aktywne/używane statusy oraz `ALL`; statusy z liczbą `0` są ukryte albo dostępne w overflow/filtrze, jeśli naprawdę są potrzebne.
  - **MUST NOT:** status chips nie mogą wymusić drugiego rzędu ani wypchnąć prawego slotu z przyciskami AI.
  - **MUST:** tryb jest **single‑select** (aktywny jest maksymalnie 1 preset). Klik w aktywny preset wraca do `ALL`.
  - **MUST:** aktywny preset jest **wyróżniony fioletem** (spójnie z innymi stanami “selected” w aplikacji).
- **SHOULD:** jeśli otwarty jest czat lub inny panel, ten rząd nie rozpycha layoutu — content area ma priorytet.
- **Priorytet trybów (MUST):** **Bulk actions** nadpisuje pozostałe tryby (to jest “szybkie wybieranie i działanie”). Search ma priorytet nad tabs/counters. Tabs mają priorytet nad counters.
- **Hierarchia wizualna (MUST):** elementy w **Command Row** są **symbolicznie mniejsze** niż główne taby/topbar (żeby nie wyglądały jak ten sam poziom nawigacji).

### 3.1a Własność Menu 3 w podwidokach specjalistycznych (MUST)

Jeżeli dany tab modułu otwiera **specjalistyczny workspace / analysis view / management view**, Menu 3 może być renderowane **lokalnie przez ten widok**, zamiast przez globalny `ModuleHub`.

**Przykłady kanoniczne:**
- `Initiatives → Analysis`
- `Execution / Implementation → Management`

**Reguły:**

- **MUST:** nadal istnieje **tylko jeden** rząd Menu 3 pod Menu 2.
- **MUST:** lokalne Menu 3 zajmuje **dokładnie to samo miejsce** co standardowy Command Row.
- **MUST:** jeżeli widok ma własne lokalne Menu 3, globalny `ModuleHub.commandRowContent` dla tego taba powinien być wyłączony (`null` / brak renderu).
- **MUST:** lokalne Menu 3 zachowuje ten sam background, separator, wysokość, spacing i hierarchię wizualną co globalny Command Row.
- **MUST:** jeśli widok ma własne presety/chipy i własne przyciski funkcyjne po prawej stronie, stan i zachowanie są zarządzane przez ten widok lokalnie, a nie przez dynamic tabs.
- **MUST:** jeśli prawa strona Menu 3 jest przeznaczona na AI actions, nie dokładamy tam lokalnych przełączników wizualizacji / zakresu czasu (`prev/next`, `W/M`, `3M/6M/12M`).
- **MUST:** takie przełączniki renderujemy w **toolbarze konkretnego widoku** (nagłówek timeline / heatmap / canvas), a nie w Menu 3.
- **MUST:** dodatkowe akcje AI widoku specjalistycznego pozostają w prawym slocie `Menu 3`; view-local toolbar służy do kontroli widoku, nie do akcji AI.
- **MUST NOT:** otwarcie panelu lub lokalnego subwidoku nie może powodować pojawienia się alternatywnego drugiego paska pod topbarem.

### 3.1b Kontekstowe akcje AI w Menu 3 (MUST)

Wszystkie przyciski AI, które pojawiają się kontekstowo dla otwartego dokumentu / narzędzia / sekcji, renderujemy **po prawej stronie Menu 3**.

**Reguły:**

- **MUST:** AI actions nie tworzą osobnego paska pod metadanymi, pod properties strip ani wewnątrz głównego canvasu.
- **MUST:** AI actions nie tworzą dodatkowego wiersza między Menu 3 a tabelą, nawet w trybie zaznaczenia wierszy.
- **MUST:** jeśli ekran ma Dynamic Tabs, AI actions korzystają z prawego slotu tego samego rzędu (`commandRowRightContent` / `DynamicTabs.rightContent`).
- **MUST:** jeśli ekran ma lokalne Menu 3, AI actions pozostają po prawej stronie tego lokalnego Menu 3.
- **MUST:** akcje typu `AI Analizuj zaznaczenie` są prawym przyciskiem Menu 3 i reagują na selection state (`disabled` przy 0 zaznaczonych), a nie dużym oddzielnym przyciskiem pod paskiem.
- **SHOULD:** podstawowe akcje workflow dla aktywnego dokumentu mogą być grupowane obok AI actions w tym samym prawym slocie, jeśli dzięki temu unikamy dodatkowego toolbaru.
- **MUST NOT:** dublować tego samego przycisku AI w Menu 3 i w canvasie.

**Uzasadnienie:**

Specjalistyczne widoki często mają własną logikę subview (`Resources`, `Timeline`, `Completeness`, lane focus, itp.). W takich przypadkach Menu 3 jest częścią lokalnej nawigacji roboczej tego widoku i nie powinno być przejmowane przez globalne `DynamicTabs`.

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

Po prawej stronie Command Row (Menu 3) umieszczamy **funkcjonalne przyciski kontekstowe** dla danego ekranu/taba.

To jest **kanon przycisków funkcjonalnych Menu 3**. Standard dotyczy nie tylko akcji AI, ale wszystkich przycisków operacyjnych po prawej stronie tego rzędu.

**Layout Menu 3:**

```
[ preset chips (lewa) ] ─────────────────────── [ AI buttons (prawa) ]
```

Kontener Command Row używa `flex items-center justify-between` — chipy po lewej, przyciski AI po prawej.

**Zasady ogólne:**

- **MUST:** Przyciski funkcjonalne pojawiają się **tylko gdy ekran oferuje realne akcje** — nie dodajemy pustych slotów.
- **MUST:** Przyciski są **kontekstowe** — zmieniają się zależnie od aktywnego taba / subwidoku / trybu.
- **MUST:** Rozmiar przycisków jest **identyczny z chipami Menu 3** (`h-8`, `text-[11px]`, `rounded-full`) — nie mogą być większe ani mniejsze niż preset chips.
- **MUST:** Wszystkie przyciski funkcjonalne po prawej stronie Menu 3 używają **jednego wspólnego formatu wizualnego**. Nie wolno mieszać lokalnych wariantów `primary`, `secondary`, gradientów i innych wyjątków.
- **MUST:** Jeśli akcja dotyczy AI, ikoną kanoniczną jest `Sparkles`; dla akcji nie-AI używamy ikony kontekstowej.
- **MUST NOT:** mieszać przycisków AI z lokalnymi przełącznikami zakresu / nawigacji czasu w tym samym prawym slocie. Jeśli pojawia się konflikt miejsca, priorytet ma AI, a przełączniki schodzą do toolbara widoku.
- **SHOULD:** Maksymalnie 2–4 przyciski na ekran. Jeśli jest więcej akcji, grupuj je w dropdown / overflow.

**Format przycisku funkcjonalnego (kanon):**

Jest **jeden bazowy format** i **jeden stan aktywny**.

**Baza (default):**

| Właściwość  | Wartość                                                  |
| ----------- | -------------------------------------------------------- |
| Kształt     | `h-8 rounded-full px-3` (identyczny z chipami)           |
| Tekst       | `text-[11px] font-semibold`                              |
| Ikona       | `Sparkles` lub kontekstowa (12–14px), po lewej           |
| Gap         | `gap-1.5`                                                |
| Ramka       | zawsze obecna                                            |
| Disabled    | `disabled:opacity-40`                                    |

| Element | Light                          | Dark                                  |
| ------- | ------------------------------ | ------------------------------------- |
| Tło     | `bg-slate-100`                 | `dark:bg-navy-800`                    |
| Tekst   | `text-slate-600`               | `dark:text-slate-300`                 |
| Ramka   | `border-slate-200/60`          | `dark:border-navy-700/60`             |
| Hover   | `hover:bg-white/60`            | `dark:hover:bg-navy-900/50`           |

**Stan aktywny (toggle open / panel open):**

| Element | Light                          | Dark                                  |
| ------- | ------------------------------ | ------------------------------------- |
| Tło     | `bg-cyan-500/10`               | `bg-cyan-500/10`                      |
| Tekst   | `text-cyan-700`                | `dark:text-cyan-200`                  |
| Ramka   | `border-cyan-500/40`           | `border-cyan-500/40`                  |

> **Uwaga:** Aktywny stan przycisku funkcjonalnego Menu 3 jest **zawsze cyan / blue**, nie violet.

**Semantyka zachowania (MUST):**

1. **Przycisk jednorazowej akcji**
   - uruchamia działanie natychmiast (`analyze`, `autofill`, `generate`, `create`, `optimize`)
   - po kliknięciu **nie zmienia się w aktywny toggle tylko dlatego, że akcja została uruchomiona**
   - może pokazywać `loading`, ale po zakończeniu wraca do stanu bazowego

2. **Przycisk otwierający panel / wynik**
   - po otwarciu panelu przechodzi w **stan aktywny cyan**
   - drugie kliknięcie **zamyka panel**
   - aktywność przycisku musi być 1:1 powiązana ze stanem panelu

3. **Przycisk hybrydowy (akcja + panel wyniku)**
   - jeśli pierwszy klik uruchamia obliczenie i otwiera panel wyniku, to po wyrenderowaniu panelu przycisk przechodzi w aktywny stan
   - gdy panel jest już otwarty, kolejne kliknięcie **zamyka panel zamiast ponownie uruchamiać akcję**

**Tailwind class strings (copy-paste ready):**

```ts
const MENU3_AI_BUTTON_BASE_CLASS =
  'h-8 inline-flex items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold border transition-colors disabled:opacity-40';

const getMenu3AiButtonClass = (active = false) =>
  `${MENU3_AI_BUTTON_BASE_CLASS} ${
    active
      ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-200 border-cyan-500/40'
      : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-navy-700/60 hover:bg-white/60 dark:hover:bg-navy-900/50'
  }`;
```

**Przykłady:**

| Ekran / Tab                     | Przyciski AI                                |
| ------------------------------- | ------------------------------------------- |
| Initiatives → Portfolio         | `AI Analizuj zaznaczenie` jako prawy przycisk Menu 3; disabled przy 0 zaznaczonych |
| Initiatives → Analysis → Completeness | `AI Auto-Fill`, `Bulk Fix`, `AI Priority Triage` |
| Initiatives → Analysis → Timeline | `AI Auto-Schedule`, `Conflicts`, `AI Optimizer` |
| Initiatives → Analysis → Logic | `AI Discover Dependencies`, `Detect Cycles`, `Critical Path`, `AI Sequencer` |
| Initiatives → Analysis → Resources | `AI Balance workload` |
| Execution → Summary             | _(brak — ekran nie ma dedykowanych akcji kontekstowych)_ |

**SSOT implementacji:** `src/components/Initiatives/Analysis/menu3ActionButtonStyles.ts` oraz przyciski rejestrowane przez `onRegisterActions(...)` w podwidokach Analysis.

### 3.4a `Implementation / Management` — preview vs workspace panel (MUST)

`Implementation / Management` jest kanonicznym przykładem ekranu operacyjnego, gdzie użytkownik zarządza problemami "w trakcie realizacji", a nie tylko analizuje dane.

W tym wzorcu prawa strona ekranu ma **2 różne tryby pracy**:

1. **Preview pane**  
   - otwierany kliknięciem w pojedynczy wiersz tabeli
   - służy do szybkiego zrozumienia jednego problemu i wykonania pojedynczych działań
   - jest węższy (Outlook style preview)

2. **Workspace panel**  
   - otwierany przyciskami funkcyjnymi z prawej strony Menu 3
   - służy do pracy na grupie problemów / planie działania / priorytetyzacji
   - jest szerszy niż preview, ale **pozostaje wewnątrz content area**
   - **MUST NOT:** być full-screen overlayem przykrywającym Menu 2 / Menu 3 / topbar modułu

**Reguły:**

- **MUST:** w danym momencie po prawej stronie widoczny jest albo `preview pane`, albo `workspace panel`.
- **MUST:** `workspace panel` nie tworzy osobnego ekranu i nie zasłania górnej nawigacji modułu.
- **MUST:** kliknięcie aktywnego przycisku Menu 3 zamyka odpowiadający mu `workspace panel`.
- **SHOULD:** jeśli workspace panel ma listę rekomendacji, user może z niego wskazać / sfokusować konkretny problem w tabeli bez opuszczania bieżącego kontekstu.

**Domyślny zestaw przycisków Menu 3 dla `Implementation / Management`:**

- **Przycisk 1 (stały):** `AI Triage`
- **Przycisk 2 (stały):** `Action Plan`
- **Przycisk 3 (lane-specific):** zależny od aktywnego lane

**Macierz lane → trzeci przycisk:**

| Lane | Trzeci przycisk | Cel |
| ---- | --------------- | --- |
| `Action Queue` | `Due Soon` | pokazać rzeczy, które za chwilę staną się problemem operacyjnym |
| `Decisions` | `Decision Pack` | przygotować szybki pakiet decyzji do zatwierdzenia / odroczenia / eskalacji |
| `Blockers` | `Recovery Plan` | zaproponować sposób odzyskania przepływu (unblock / workaround / escalate / scope reduction) |
| `Risk` | `Watchlist` | wyłapać ryzyka i sygnały, które jeszcze nie są krytyczne, ale wymagają obserwacji |
| `Workload` | `Rebalance` | rozłożyć przeciążenia, braki ownerów i luki estymacyjne |
| `People & Change` | `Ownership Fix` | domknąć braki ownera, sponsora, dat oraz bus-factor risks |

**Semantyka paneli w `Implementation / Management`:**

- `AI Triage` = odpowiedź na pytanie **"co najpierw?"**
- `Action Plan` = odpowiedź na pytanie **"co konkretnie zrobić?"**
- trzeci przycisk = odpowiedź na pytanie **"jak wykonać specjalistyczną pracę dla tego lane?"**

**Anatomia `workspace panel`:**

1. nagłówek z nazwą trybu i zamknięciem,
2. krótkie `summary`,
3. `top priorities` / `focus list`,
4. `suggested actions` lub `recommended moves`,
5. możliwość przejścia do źródłowego problemu / encji.

**MUST:** `Implementation / Management` to ekran egzekucyjny, więc AI nie może kończyć się na "insight". Panel musi prowadzić do **małych, zatwierdzalnych ruchów operacyjnych**.

**SSOT implementacji:** `src/components/Execution/ExecutionManagementView.tsx`, `src/components/Execution/ManagerModuleView.tsx`, `src/components/Execution/Manager/AiRecommendationPanel.tsx`

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
