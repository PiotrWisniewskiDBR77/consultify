# Golden Standard v3 — Table + Cards + Preview

> ⚠️ **SUPERSEDED (2026-06-06) — zastąpione przez [`TABLE_AND_PREVIEW_CANON.md`](TABLE_AND_PREVIEW_CANON.md).** Dokument historyczny; SSOT to kanon.

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
- **Prawa strona (kolejność wizualnie od prawej)**: **Area → Primary CTA → Tools → View tool → Filters**.
  - Primary CTA i Tools mogą być warunkowe (np. zależne od zakładki), ale kolejność i “rytm” pozostają stałe.
  - Funkcjonalne AI actions nie należą do tego klastra; trafiają do prawej strony `Menu 3` zgodnie z Golden Standard.
  - **Right anchoring (MUST)**: prawy klaster (CTA/View/Filters) jest **dociśnięty do prawej krawędzi** (brak “pływania” w środku).  
    Jeśli na prawym klastrze jest kilka elementów, to **View tool** i **Primary CTA (Add/Assign/New)** muszą wizualnie siedzieć “przy prawym rancie” i nie mogą być odsunięte przez lokalne AI buttons.

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
  - **AI hints**: 3 chips + **Overflow Menu (⋮)** — subtelne, bez “dużego CTA”.
  - **Relations**: **2 rzędy** powiązań (stała wysokość).
  - **Actions**: przyciski jako pills; układ zależny od kontekstu, ale wizualnie stabilny.

Ważne: w preview są **dwa** overflow menus (⋮): jeden przy **Details**, drugi przy **AI**.

### 0.4a Preview footer (sticky) — TL;DR (MUST)

Jeśli moduł ma preview, footer musi być „Inbox‑like” i zawsze trzymać tę samą kolejność stref:

1) **AI** (3 hint chips + Overflow Menu (⋮))  
2) divider  
3) **Relations** (miejsce na **2 rzędy**; stała wysokość, żeby footer nie „skakał”)  
4) divider  
5) **Actions** (pill buttons `h-9 rounded-full`, 1–2 rzędy)

Pełny opis kanoniczny (SSOT): **sekcja 6.10a**.

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
- **Header**: typ (pill) + status (dot+label) + **Overflow Menu (⋮)**
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
  - dla 1 głównego CTA dopuszczalny jest kolor pełny, ale operational chrome nie używa gradientu
  - w Module Topbar primary CTA nie używa leading `+`
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

- 1 linia tytułu (truncate) + **Overflow Menu (⋮)** jeśli przewidziane + **Open** + **X**
- “Open” zawsze jako tekst (nie ikonka), nie zwijamy go.
- Wysokość headera preview wizualnie “pasuje” do rytmu headerów tabeli (symetria).

### 6.10a Side Detail Panel — OFFICIAL UI STRUCTURE (KANON v3)

To jest **oficjalna specyfikacja** struktury preview (Side Detail Panel) zgodna z wzorem `MyWork → Inbox`.  
W kolejnych modułach nie opisujemy tego od nowa — piszemy tylko: **“Side Detail Panel zgodny z KANON v3 (Golden Standard → 6.10a)”**.

**SSOT (kod referencji):**
- `src/components/shared/TableWithPreviewLayout.tsx` (layout: gap, width clamp, interakcje)
- `src/components/ui/ResizableTable/PreviewPaneShell.tsx` (shell: header/body/footer)
- `src/components/MyWork/InboxContent.tsx` (referencja UI: strefy i rytm, 2 overflow menus)

#### 0) Component (Global)

- **Component name**: Side Detail Panel
- **Type**: Contextual Overlay Panel (contextual preview)
- **Behavior**: slide‑in from right (desktop: w kolumnie, nie fullscreen)
- **Width (desktop)** (MUST): `clamp(340px, 28%, 480px)` (≈ 30–40% viewport)
- **Width (mobile)**: 100% (fullscreen)
- **Layering**: nad contentem tabeli; bez dodatkowych linii separatorów

**Layout kontrakt (MUST):**
- **Table↔Panel separation**: `gap-1.5`, **bez** `border-l` oraz doklejanych `ml-*`.
- **Panel wrapper**: `bg-slate-50 dark:bg-navy-950` + `p-3`
- **Panel shell**: `rounded-xl` + `border` + `bg-white/70 dark:bg-navy-900/70` + `backdrop-blur`

---

#### 1) Panel Header (Fixed Section)

- **Position**: sticky (zawsze widoczny przy scrollu)
- **Height**: ~64–80px (wynika z paddingu i typografii; nie ustawiamy „na sztywno” px)
- **Background**: elevated surface (Level +1)

##### 1.1 Primary Title

- **Content**: *Entity name* (**bez subtitle/metadanych**)
- **Weight**: semibold
- **Max lines**: **1 linia (Inbox canonical)**  
  *Dopuszczalne 2 linie tylko jako świadoma decyzja UX (wtedy trzeba udokumentować i dostosować shell).*
- **Truncation**: ellipsis (truncate)

##### 1.2 Header Actions (Right aligned)

- **Primary action**: *Open in Full View* (ghost/outline pill)  
  - ikonka: `Eye` lub `ExternalLink`
- **Close control**: icon button `X` (dismiss panel)

---

#### 2) Entity Meta Bar (Status & Context Strip)

To **nie jest content** — to metadane w skrócie.

- **Background**: subtelnie tinted surface (Level +2)
- **Padding**: 16–20px
- **Radius**: 12–16px
- **Margin‑top**: 12–16px

##### 2.1 Status Badges Row (Inline Tag Collection)

Przykłady badge:
- Entity type (Task/Initiative/Report)
- Priority (Critical/Normal)
- Time status (Due soon/SLA 1h)
- Timestamp (Created X minutes ago)

Każdy badge:
- pill shape
- small text
- semantyczne kolory (ale chrome pozostaje neutralne)

---

#### 3) Content Section (Details)

##### 3.1 Section Header

- **Section label**: “Details” (`overline / small caps`, `tracking` lekko zwiększony)
- **Section menu**: **Overflow Menu** (⋮, vertical ellipsis)
  - Nazwa (MUST): **Overflow Menu** (nie „burger”)
  - Funkcje: Edit / Expand / Copy / Advanced

##### 3.2 Primary Content Body

- **Type**: rich text container
- **Behavior**: scrollable
- **Typography**: Body M, line‑height 1.6–1.8
- **Padding**: 16–24px (w praktyce: `PreviewPaneShell` daje `p-4`)
- **Empty state**: jeśli puste → pokazujemy Empty State + guidance

**Overflow Menu #1 (MUST)**: w nagłówku Details (sekcja 3.1).

---

#### 4) AI Insight Section (Distinct functional zone)

AI jest doradcze — **nie dominuje contentu**.

- **Top divider**: 1px subtelny border
- **Background**: bardzo subtelnie tinted (brand‑based) / neutral‑tinted

##### 4.1 AI Section Header

- **Label + icon**: “AI Insights” + Sparkles/Neural
- **AI Overflow Menu** (⋮): regenerate / copy / clear / advanced

##### 4.2 AI Suggestion Chips

- Actionable chips / quick prompts (typowo **3** w kanonie Inbox)
- Klik → rozwija AI output

##### 4.3 AI Expansion Container

- Expandable area (200ms ease)
- Bullets: recommendation / plan / risk analysis

**Overflow Menu #2 (MUST)**: w nagłówku sekcji AI (4.1).

---

#### 5) Relationship Section (References)

Oficjalna nazwa: **Linked Entities Section**.

- Header: “Linked Items” / “References”
- Reference pills:
  - interactive tag (klik → nawigacja)
  - max visible 3–5, overflow: “+3 more”
- **MUST**: rezerwujemy miejsce na **2 rzędy** (stała wysokość; np. `min-h-[4.5rem]`) żeby panel nie skakał

---

#### 6) Contextual Action Bar

Oficjalna nazwa: **Contextual Action Group**.

Przykłady: Mark done / Save / Add note / Defer / Schedule.

- Medium buttons jako pills (`h-9 rounded-full`)
- Spacing: 8–12px
- Hierarchia: Primary (filled/strongest) → Secondary (outline) → Tertiary (ghost)

---

#### 7) Temporal Control Section

Oficjalna nazwa: **Scheduling Controls**.

- Quick time presets: Today / This week / Later  
  - component: segmented control / toggle group
- Advanced scheduling dropdown: “Defer to…” → date picker

*Uwaga: jeśli moduł nie wspiera snooze/defer, ta sekcja może być pominięta — ale jej brak musi być decyzją UX, nie przypadkiem.*

---

#### 8) Visual hierarchy summary (MUST)

Kolejność ważności (top→bottom):
1) Title (Identity)
2) Status Meta
3) Core Content
4) AI Intelligence
5) Relationships
6) Actions
7) Scheduling

---

#### 9) Layout proportion (Desktop, rekomendacja)

- Header: 8%
- Meta Bar: 10%
- Content Body: 40–50%
- AI: 15–20%
- Linked: 10%
- Actions + Scheduling: 12–15%

---

#### 10) Design system naming (dev)

Preferowane nazwy w kodzie/komponentach (bez „kreatywnych” aliasów):
- `SideDetailPanel` (shell)
- `PanelHeader` (1)
- `EntityMetaBar` (2)
- `DetailsSection` + `OverflowMenu` (3)
- `AiInsightsSection` + `OverflowMenu` (4)
- `LinkedEntitiesSection` (5)
- `ContextualActionGroup` (6)
- `SchedulingControls` (7)

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

### 6.18 Preview Pane — checklist zgodności (MUST)

Ta checklista jest do użycia **dla każdego** widoku Table+Preview, zanim uznamy wdrożenie za „zgodne ze standardem”.

#### Layout & zachowania

- [ ] `TableWithPreviewLayout` użyty jako layout (lub zachowane 1:1 jego kontrakty).
- [ ] **Width** preview = `clamp(340px, 28%, 480px)`.
- [ ] **Separation** table↔preview = tylko `gap-1.5` (brak `border-l`, brak doklejanych `ml-*` separatorów).
- [ ] **Single click** row → selection + preview.
- [ ] **Double click / Enter** → open full.
- [ ] **Esc** → close preview.

#### Header (preview)

- [ ] Header jest **sticky** i zawsze widoczny na scrollu.
- [ ] Tytuł to **tylko nazwa encji** (bez subtitle/metadanych).
- [ ] Tytuł jest **1 linią** (`truncate`) w kanonie Inbox (2 linie tylko jako świadoma decyzja UX + dostosowanie shell).
- [ ] Po prawej są: **Open in Full View / Otwórz (ghost/outline)** + **Close (X)**.

#### Body (preview)

- [ ] Na górze jest **Entity Meta Bar / Brief** (type + priority + time + SLA jeśli dotyczy) jako **metadane**, nie content.
- [ ] Sekcja **Details** ma nagłówek (overline/small caps, `tracking-wider`).
- [ ] W nagłówku Details jest **Overflow Menu (⋮)** z akcjami (np. Expand, Summarize, Copy).
- [ ] Treść Details jest czytelna (`whitespace-pre-wrap`) i nie dubluje informacji z meta.
- [ ] Jeśli content jest pusty → jest **Empty State + guidance**.

#### AI Insights (distinct zone)

- [ ] AI jest wizualnie **oddzielone** (divider + subtelnie tinted background), nie dominuje contentu.
- [ ] Są **AI suggestion chips** (kanonicznie **3**; outline/quick prompts).
- [ ] W nagłówku AI jest **Overflow Menu (⋮)** (regenerate/copy/clear/advanced).

#### Linked Entities (relations)

- [ ] Jest sekcja **Linked Entities Section** (“Linked Items/References”).
- [ ] Relacje mieszczą się w **2 rzędach** (stała wysokość; np. `min-h-[4.5rem]`), brak relacji ma subtelny empty state.
- [ ] Relacje są linkami/tagami (max 3–5 + “+N more”).

#### Actions + Scheduling

- [ ] Jest **Contextual Action Group**: akcje jako pills (`h-9 rounded-full`), hierarchia Primary/Secondary/Tertiary.
- [ ] Jeśli moduł wspiera defer/snooze → są **Scheduling Controls** (Today/This week/Later + “Defer to…”).

#### Overflow menus (MUST)

- [ ] Są **dokładnie 2 overflow menus (⋮)** i są w stałych miejscach: **Details** + **AI** (nazywamy je “Overflow Menu”, nie “burger”).

