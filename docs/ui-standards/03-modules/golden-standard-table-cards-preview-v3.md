# Golden Standard v3 — Table + Cards + Preview

> **Status:** Canon (Sprint 1)  
> **Cel:** Jeden, konsekwentny standard dla **wszystkich miejsc**, gdzie użytkownik pracuje na kolekcjach danych: **Table**, **Cards/Grid**, oraz **Table+Preview (Outlook style)**.
>
> **SSOT (kod):**
> - **Cards/Grid**: `src/components/shared/ModuleHub/GridView.tsx`
> - **Table (huby)**: `src/components/shared/ModuleHub/FilterableTable.tsx` + `src/components/shared/ModuleHub/ModuleNavBar.tsx`
> - **Table+Preview layout**: `src/components/shared/TableWithPreviewLayout.tsx` + `src/components/ui/ResizableTable/PreviewPaneShell.tsx`
> - **MyWork Inbox (Preview)**: `src/components/MyWork/InboxContent.tsx` (referencja anatomii + spacing + footer zones)

## 0) Reference implementation — MyWork Inbox (canonical)

Ten ekran jest **kanoniczną** implementacją standardu “Table + Preview (Outlook style)”. Jeśli w innym module pojawia się tabela z preview, ma dążyć do tej samej anatomii i zachowań.

### 0.1 Main topbar row (MUST)

- **Lewa strona**: search toggle + główne tabs modułu.
- **Prawa strona (kolejność zawsze taka sama)**: **AI → Primary CTA → Tools → View tool → Filters**.
  - Primary CTA i Tools mogą być warunkowe (np. zależne od zakładki), ale kolejność i “rytm” pozostają stałe.
  - **Right anchoring (MUST)**: prawy klaster (CTA/View/Filters) jest **dociśnięty do prawej krawędzi** (brak “pływania” w środku).  
    Jeśli na prawym klastrze jest kilka elementów, to **View tool** i **Primary CTA (Add/Assign/New)** muszą wizualnie siedzieć “przy prawym rancie” (nie mogą być odsunięte przez AI po lewej).

### 0.2 Command Row (MUST)

Command Row to **jedna linia pod topbarem** (bez dokładania kolejnych pasków UI). Musi obsługiwać 4 tryby, które “wymieniają się” w tym samym miejscu:

- **Dynamic documents tabs** (otwarte dokumenty)
- **Search expanded row** (po kliknięciu lupy)
- **Status summary / counters** (pills z licznikami, np. Open/Done/Saved/All + kontekstowe liczniki)
- **Context action bar** (bulk actions po zaznaczeniu / kontekstowe akcje)

MyWork Inbox pokazuje wzorcowo tryb “counters” jako pills (jedna linia, przewijanie poziome w razie potrzeby).

### 0.3 Table + Preview behaviors (MUST)

- **Single click** na wiersz: selection + otwarcie preview (jeśli moduł ma preview).
- **Double click / Enter**: open full.
- **Esc**: zamknięcie preview.

### 0.4 Preview anatomy (MUST)

Preview ma stałe strefy (patrz `MyWork Inbox` i `PreviewPaneShell`):

- **Header**: tytuł (1 linia, truncate) + **Open** + **X**.
- **Body (scroll)**: brief + details (czytelny tekst).
- **Footer (sticky)**: strefy zawsze w tym porządku:
  - **AI hints**: 3 chips + kebab (AI) — subtelne, bez “dużego CTA”.
  - **Relations**: **2 rzędy** powiązań (stała wysokość).
  - **Actions**: przyciski jako pills; układ zależny od kontekstu, ale wizualnie stabilny.

Ważne: w preview są **dwa** kebaby (⋮): jeden przy **Details**, drugi przy **AI**.

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
  - wrapper preview: `bg-slate-50 dark:bg-navy-950` + `p-3` + **space-only separation (no divider line)**
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

## 6) Audit checklist (do zastosowania dla KAŻDEJ tabeli)

Ta lista to “procedura kontroli jakości” — przechodzimy ją zawsze, gdy dostajemy nowy screen / nową tabelę do rekonstrukcji.

### 6.1 Buttons — 3 poziomy (MUST)

- **Wszystkie przyciski** w UI są “pill”: \(h=9\), `rounded-full`.
- **Poziom A (Outline + Surface / Primary CTA)**:
  - **ma border** + neutralne tło (`bg-white/70 ... border-slate-200/70 ...`)
  - dla 1 głównego CTA dopuszczalny kolor pełny/gradient (ale nadal pill)
  - hover = tylko przesunięcie tła / brightness (bez “skakania” borderów)
- **Poziom B (Soft / helper)**:
  - bez mocnej ramki; “soft surface” (delikatne tło), nadal pill
  - używany do toggli, pomocniczych akcji, drugorzędnych CTA
- **Poziom C (Ghost / text)**:
  - bez tła (lub minimalne hover), link-like
  - używany do “Zamknij”, “Reset”, drobnych linków akcji
- **Tekst**:
  - domyślnie neutralny (white/dark theme neutral)
  - kolorujemy selektywnie tylko elementy semantyczne (type/status) i kontrolowane CTA

### 6.2 Semantic type colors (MUST)

- Każdy artefakt ma **tożsamość koloru** (Task / Decision / Idea / Initiative / Notification / …).
- Sprawdź w danym widoku:
  - czy **karty** mają `border-l-[3px]` w kolorze typu
  - czy **linked docs** w preview mają kolor tekstu wg typu (bez tła)
  - czy **pille typu** są spójne z SSOT mapowaniem w module
- **NIE** używać gradientów jako tła kart dla identyfikacji — identyfikacja = akcent `border-l`.

### 6.3 Menu hierarchy (MUST)

W aplikacji zawsze rozróżniamy 3 poziomy:

- **Poziom 1: App menu** (sidebar) — niezmienny.
- **Poziom 2: Module/Table topbar** (pasek nad tabelą):
  - lewa: search toggle + main tabs
  - prawa kolejność (zawsze taka sama): **AI → Add/Primary CTA → Tools (panele) → View tool → Filters**
- **Poziom 3: Dynamic menu / Command row** (pod topbarem):
  - to jest jedna strefa, która może przyjmować różne “tryby” (patrz 6.4)

### 6.4 Command row — 4 zastosowania (MUST)

Ten sam obszar pod topbarem służy do 4 rzeczy (bez dokładania nowych pasków UI):

- **Dynamic documents tabs** (otwarte karty/dokumenty)
- **Status summary / counters** (np. Open/Done/Saved/All, Critical, Action required, itp.)
- **Search expanded row** (po kliknięciu lupy)
- **Context action bar** (np. bulk actions po zaznaczeniu, albo kontekstowe “tagowanie/triage” w Inbox)

Checklist:
- czy widok nie dokłada “piątego paska”?
- czy te 4 funkcje są realizowane w tym samym miejscu?

### 6.4a Referencja kanoniczna: MyWork → Inbox (Table+Preview)

Ta referencja opisuje **jak to ma wyglądać w praktyce** (rytmy, kolejność, nawigacja). Każdy moduł typu “Inbox/Assignments” (np. Interview → Inbox) ma to kopiować 1:1.

- **Poziom 2 (Topbar) — lewa strona**:
  - search toggle (pill, h-9)
  - main tabs (pills z licznikami)
- **Poziom 2 (Topbar) — prawa strona (zawsze ta kolejność)**:
  - AI → Add/Primary CTA → Tools → View tool → Filters
  - wszystko jako pills (h-9, rounded-full)
- **Poziom 3 (Command Row)**:
  - jedna linia “status chips” z licznikami (np. Otwarte/Gotowe/Zapisane/Wszystkie oraz semantyczne typu Krytyczne/Wymaga akcji/Nowe…)
  - **bulk** to *tryb* tej samej linii (context action bar) — nigdy osobny pasek
- **Main content (Table↔Preview)**:
  - separacja **tylko tłem + stałym gapem**: `gap-1.5` (bez dividera)
  - preview: `clamp(340px, 28%, 480px)`
- **Row navigation**:
  - single click → selection + preview
  - double click / Enter → open full
  - Esc → close preview
  - (opcjonalnie) J/K → navigate rows, update preview
- **Preview anatomy (MUST)**:
  - **Header**: tytuł (1-linia, truncate) + “Open” + “X”
  - **Footer zones (sticky)**: AI hints → divider → relations (2 rows) → divider → actions
  - **Dwa kebaby**: Details (sekcja Szczegóły) + AI (sekcja AI)

### 6.5 Table — surface & header (MUST)

- Tabela jest “card surface”:
  - `rounded-xl`
  - `bg-white/70 dark:bg-navy-900/70` + `backdrop-blur`
  - `border border-slate-200/70 dark:border-white/[0.06]`
- Header:
  - `text-[11px] font-semibold uppercase tracking-wider`
  - divider `border-b` subtelny
  - filtry w headerach spójne
- **Actions column header**:
  - **bez etykiety** “Actions”
  - akcje = kebab (⋮)

### 6.6 Table — rows & selection (MUST)

- Hover = tylko tło (`hover:bg-...`), bez ciężkich cieni na całym row.
- Title:
  - **1 linia w tabeli (MUST)** — żadnych “drugich wierszy” pod tytułem (np. opisu/wyjaśnienia).  
    Wyjątki (2 linie) są dopuszczalne tylko jako świadoma decyzja UX i muszą być wpisane w checklistę modułu.
  - `truncate`/`line-clamp` + tooltip na hover
  - **Stabilna wysokość wiersza (MUST)**: row nie może “rosnąć” na hover/focus/keyboard navigation (to psuje skanowanie i J/K).
- Jeśli jest preview:
  - single click → selection + open preview
  - double click / Enter → open full
  - Esc → close preview

### 6.7 Table settings (MUST)

- Jest przycisk “Table view settings” (ikona) w headerze tabeli.
- Modal ustawień:
  - przyciski **Reset/Done** w standardzie pill
  - kontrola widocznych kolumn działa per-view

### 6.7a View tool (MUST)

- View tool (List/Kanban/Timeline/Calendar) ma format **pill dropdown** (ikona + label + chevron), jak w Inbox/Tasks.
- Nie używamy “segmentów icon-only” jako docelowego standardu view tool w topbarze.

### 6.8 Preview — opening & default state (MUST)

- Preview **domyślnie zamknięte**.
- Otwiera się dopiero po:
  - click na row (preview)
  - lub innym kontrolowanym zdarzeniu (np. “Preview” action)
- Po “Open full”:
  - wracając do listy preview **nie powinno być automatycznie otwarte** (chyba że user ponownie kliknął row).

### 6.9 Preview — layout, width, separation (MUST)

- **Width** zawsze: `clamp(340px, 28%, 480px)`
- **Separation**:
  - **bez linii/dividera** między tabelą a preview
  - separacja = stała przestrzeń (gap), pokazująca tło modułu
  - odległość (gap) ma być stała i wizualnie zgodna z rytmem spacingu w module
  - **standard gap**: `gap-1.5`
  - **optyczny gutter (MUST)**: krawędź “surface” tabeli ↔ krawędź preview ma mieć **ten sam rytm** co padding modułu pod command row. Praktycznie:
    - table canvas: `pl-4 pr-1.5 pt-3 pb-4` (żeby “poszerzyć” tabelę i nie kumulować odstępów)
    - preview separation: `gap-1.5`
    - nie dokładamy dodatkowych `ml-*` / `border-l` między nimi

### 6.10 Preview — header (MUST)

- 1 linia tytułu (truncate) + kebab (⋮) jeśli przewidziane + **Open** + **X**
- “Open” zawsze jako tekst (nie ikonka), nie zwijamy go.
- Wysokość headera preview wizualnie “pasuje” do rytmu headerów tabeli (symetria).

### 6.11 Preview — brief/meta row (MUST)

- U góry brief/meta:
  - pill typu artefaktu
  - urgency/priority pill
  - received/aging
  - SLA pill (jeśli dotyczy)
- Zero duplikacji: nie powtarzamy tych samych informacji w kilku miejscach.

### 6.12 Preview — details block (MUST)

- Sekcja “Details/Szczegóły”:
  - treść czytelna, `whitespace-pre-wrap`
  - kebab (⋮) w headerze sekcji z akcjami:
    - **Rozwiń / Expand**
    - **Podsumuj / Summarize**
    - **Kopiuj / Copy**
  - wygenerowany tekst **zastępuje** treść i **persistuje** w UI do zmiany itemu.

### 6.13 Preview — AI strip (MUST)

- AI ma być subtelne (lekko wyszarzone), bez wielkiego “Generuj”.
- Zawsze widoczne **3 hint chips**:
  - outline-only, bez tła
  - klik odpala AI (lub regeneruje)
- Kebab (⋮) dla AI akcji: regeneruj / kopiuj / wyczyść

- **Ważne**: w preview są **dwa** kebaby: jeden przy **Szczegóły**, drugi przy **AI**.

### 6.14 Preview — relations/linked docs (MUST)

- Powiązania jako **proste linki/teksty**:
  - kolor tekstu = kolor typu powiązanego artefaktu
  - bez kolorowego tła (tylko delikatna ramka lub sama typografia)
- Strefa relacji mieści **2 rzędy** (stała wysokość).

### 6.15 Preview — actions footer (MUST)

- Akcje w footerze:
  - pill buttons, spójne spacing i dividers
  - “powietrze” między rzędami (nie może być ciasno)
  - układ sensowny per-kontekst (ale wizualnie stały)

### 6.16 Cards/Grid (MUST)

Gdy widok ma cards:

- `border-l-[3px]` = tożsamość typu
- neutralne tło karty: `bg-slate-50/80 ...`
- hover: `bg-white ...` + lekki cień (max `shadow-sm`)
- anatomia:
  - title 1–2 linie
  - brief 1–2 linie (pierwsza sensowna linia opisu)
  - meta pills (type/status/time/SLA)
  - kebab menu (⋮)

### 6.17 i18n / UX safety (MUST)

- PL/EN przez `useTranslation` (bez hardcode w UI)
- brak “wymyślonych” komponentów: używamy shared/SSOT
- jeśli komponent wspiera `locked?: boolean`, musi działać read-only

