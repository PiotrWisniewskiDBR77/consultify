---
uiux_doc_id: UIUX_TABLE_PREVIEW_CANON
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-07-13
supersedes_as_index:
  - docs/ui-standards/03-modules/app-table-standard.md
  - docs/ui-standards/03-modules/table-preview-pane-standard.md
  - docs/ui-standards/03-modules/view-modes-standard.md
  - docs/ui-standards/03-modules/golden-standard-table-cards-preview-v3.md
  - docs/design-system/TABLES.md
  - docs/UI_UX/31_TABLES_AND_LISTS.md
---

# Table + Preview Canon (app-wide) — KANON v1

> **Status:** Canonical, single source of truth dla tabel listowych i preview pane w całej aplikacji. Podrzędny tylko wobec `CONSULTIFY_UI_UX_GOLDEN_STANDARD.md`.
> **Rola:** Ten dokument **konsoliduje i rozstrzyga** 6 wcześniejszych, częściowo sprzecznych standardów tabel (patrz front‑matter `supersedes_as_index`). Te dokumenty pozostają jako materiał szczegółowy, ale **w razie konfliktu obowiązuje TEN plik.**
> **Siostra:** kanon menu — `13_MENU_2_MODULE_TOPBAR.md`, `14_MENU_3_COMMAND_ROW.md`, `module-hub-standard.md`. Tabela żyje POD Menu 2/3 i z nimi nie konkuruje.
> **Złote referencje wizualne:** `docs/ui-standards/assets/app-table-golden-reference-{dark,light}-2026-05-02.png`.
> **Skill:** przy pracy nad preview pane wołaj `consultify-preview` — punkt wejścia z checklistą, SSOT treści = §7 tego pliku (skrót 6 bloków: §7.0).

---

## 0) TL;DR — kanon w 12 zdaniach

1. **Jedna tabela**: `FilterableTable` (24 adopcje) renderowana jako `children` `TableWithPreviewLayout` (orkiestracja preview + J/K + historia). To jest „TA tabela".
2. **Jedne karty**: `GridView` (alternatywny widok), zawsze WEWNĄTRZ tego samego `TableWithPreviewLayout`.
3. **Jeden status**: rodzina chipów `c.*` (`ui/primitives/chips/StatusChip` + bridge `statusChipTone()`) → tony semantyczne na tokenach HBS (`--c-success/warning/danger/info` + neutral). Zero ad‑hoc badge'y, zero hardcodowanych blue‑900. `shared/StatusPill` = legacy do migracji.
4. **Nagłówek**: `text-[11px] font-semibold uppercase tracking-wider`, kolor `text-slate-500 dark:text-slate-400`, **zawsze `sticky top-0 z-10`**, rodzic NIGDY `overflow-hidden`.
5. **Wyrównanie kolumn (2026)**: tytuł = `text-left`; **tabliczki/chipy (tag/kategoria/typ/źródło + status) = `text-left` + wiodąca kropka**; **liczby = `text-right`**; assignee/due = left; akcje = `text-right`. Centrowane chipy/statusy = ZAKAZ. **Ta sama rola = to samo wyrównanie wszędzie.**
6. **Gęstość**: `px-4 py-3` (comfortable, default) / `px-4 py-2` (compact, tylko kolejki admin). Wysokość wiersza **nie zmienia się** na hover.
7. **Wiersz**: monochromatyczny, brak zebry, separatory `divide-y divide-slate-200/60 dark:divide-white/[0.03]`. Selected = `bg-primary-500/8` + 4px lewy akcent. **Nigdy** tła wiersza barwionego statusem.
8. **Resize + persistencja**: `table-fixed`, resizer sąsiadujący (zero‑sum), szerokości i widoczność kolumn **persystowane do localStorage** przez `persistKey`.
9. **Ustawienia kolumn**: portalowy `TableSettingsPopover` (NIE modal), ikona `Settings2` w prawym górnym rogu nagłówka.
10. **Preview**: domyślnie ZAMKNIĘTY; single‑click → select+preview, double‑click/Enter → full view, Esc → zamknij. Szerokość `clamp(340px, 28%, 480px)`, separacja `gap-1.5` (BEZ `border-l`).
11. **Stopka preview — sztywna kolejność**: AI hints (3 chipy + ⋮) → divider → Relations (2 wiersze, stała wysokość) → divider → Actions (pill `h-9`).
12. **Puste komórki**: `—` (em dash, wyciszony), nigdy puste. Empty/Loading/Error: współdzielone stany, nigdy biały ekran/„coś poszło nie tak" bez retry.

---

## 1) Definicja i zakres

**Tabela listowa (interactive list table)** = przeglądalna kolekcja encji org‑scoped z akcjami (select, filter, sort, resize, row actions, preview). To jest jedyny przedmiot tego kanonu.

### 1.1 W ZAKRESIE (MUST stosować kanon)
Wszystkie listy/indeksy encji: My Work (Ideas/Tasks/Decisions/Inbox/Notifications), Assessment, Admin/SuperAdmin panele listowe, Results/Finance/Benefits listy, Interview (Inbox/Sessions/Assigned/Templates/Insights/Initiatives), Reports/ReportBuilder listy zarządcze, Partner, Settings panele listowe.

### 1.2 POZA ZAKRESEM (NIE migrować — mają własne reguły)
- **Tabele dokumentowe / raportowe read‑only** (~20 plików): `Reports/Management/*Report.tsx`, `FullReportDocument`, `ExecutiveSummaryView`, `LegalDocumentView`, `Help/KnowledgeArticleView`, `docs/DocsArticleView`. To są tabele do druku/eksportu, generowane, nieinteraktywne.
- **Renderery artefaktów AI** (~11 plików): `AIChat/Artifacts/renderers/*` (`TableRenderer`, `MarkdownRenderer`, `ComparisonMatrixRenderer`…). Lekkie, read‑only.
- **Edytory macierzowe / komórkowe** (~4 pliki): `PMO/RACIMatrix`, `Finance/FinancialStatementMappingEditor`, `Results/ROIAssumptionEditor`, `ReportBuilder|Presentations/blocks/TableBlock`. To edytory cell‑by‑cell — osobny spec (TODO: `matrix-editor-standard.md`).

> Reguła rozstrzygająca: jeśli użytkownik **przegląda i działa na liście encji** → kanon. Jeśli to **treść w dokumencie / artefakcie / edytor komórek** → poza kanonem.

---

## 2) SSOT — komponenty (kontrakt implementacyjny)

| Warstwa | Komponent (SSOT) | Rola | Adopcja |
|---|---|---|---|
| Orkiestracja | `src/components/shared/TableWithPreviewLayout.tsx` | layout tabela+preview, single/double‑click, J/K, Alt+←/→ historia, pin, mobile modal | 25 |
| Tabela | `src/components/shared/ModuleHub/FilterableTable.tsx` | nagłówki, resize, filtry kolumnowe, row actions, widoczność kolumn, **persistKey→localStorage**, empty/loading | 24 |
| Karty | `src/components/shared/ModuleHub/GridView.tsx` | alternatywny widok kart (border‑l accent typu) | 8 |
| Chipy (status/priority/meta/tool/due) | `src/components/ui/primitives/chips/*` na tokenach `c.*` (`ChipBase`, `StatusChip`, `PriorityChip`, `MetaChip`, `ToolChip`, `DueChip`) + bridge `statusChipTone()` | jedyna rodzina chipów; HBS, token‑driven, light/dark za darmo | 2 (do podniesienia) |
| Komórki tabeli | `src/components/ui/primitives/cells/*` (`ProgressCell`, `AssigneeCell`) na `c.*` | progres + asignee jako prymitywy | nowe (Faza 0) |
| Ustawienia kolumn | `src/components/shared/ModuleHub/TableSettingsPopover.tsx` | portalowy popover widoczności kolumn + „pokaż opis" | 5 |
| Prymitywy | `src/components/ui/ResizableTable/{TableHeader,index}.tsx`, `ColumnResizer`, `PreviewPaneShell.tsx` | niskopoziomowe: resizer, sticky header, shell preview | 19 |

**MUST:** nowa tabela listowa = `TableWithPreviewLayout` + `FilterableTable`. Nie pisać nowego `<table>` od zera.

### 2.1 Komponenty WYCOFANE (nie używać; do usunięcia w sprzątaniu)
- `Admin/shared/EnhancedDataTable.tsx` (2 importery, 884 LOC) — zastąpione przez FilterableTable.
- `Admin/shared/AdminTable.tsx` (2 importery) — j.w.
- `shared/TablePresentationToggle.tsx` (0 importerów) — **martwy kod**, usunąć.
- `ui/composed/DataTable.tsx` — 0 importerów (jeśli istnieje), usunąć.

### 2.1a Legacy do migracji (NIE nowy kod)
- `src/components/shared/StatusPill.tsx` + `src/constants/statusColors.ts` (`getStatusStyle`/`getPriorityStyle`) — stary system na palecie sprzed rebrandingu HBS. **~34 callerów** do migracji na rodzinę chipów `c.*`. Nie usuwać, dopóki callerzy nie zmigrowani; nie używać w nowym kodzie.

### 2.2 Dług do konsolidacji (osobny ticket)
- `ui/ResizableTable` (19 adopcji, m.in. My Work, Interview) i `FilterableTable` re‑implementują ten sam rdzeń (resize + filter dropdown). **Cel docelowy:** `FilterableTable` = jedyna powłoka, `ResizableTable` zredukowany do prymitywów (TableHeader/ColumnResizer/PreviewPaneShell). Do czasu konsolidacji: tabele już na `ResizableTable` muszą spełniać reguły §3–§7 (wygląd), nawet jeśli pod spodem inny komponent.
- **Interview** ma 5 ręcznych `<table>` (świadoma decyzja, plik 8.9k linii). Traktujemy jako tymczasowy wyjątek: muszą spełniać §3–§7 wizualnie; migracja na FilterableTable = ostatnia faza.

---

## 3) Layout tabeli (KANON v3)

### 3.1 Surface i kontener
**MUST:**
- Tło modułu (zewnętrzne): `bg-slate-50 dark:bg-navy-950`.
- Karta tabeli: `rounded-xl bg-white/70 dark:bg-navy-900/70 backdrop-blur border border-slate-200/70 dark:border-white/[0.06]`.
- Brak zebry. Separatory wierszy: `divide-y divide-slate-200/60 dark:divide-white/[0.03]`.
- Layout: `table-fixed` (warunek resizable).

### 3.2 Nagłówek
**MUST:**
- Typografia: `text-[11px] font-semibold uppercase tracking-wider`.
- Kolor: `text-slate-500 dark:text-slate-400` (jeden szary dla roli nagłówka — koniec z mieszaniem slate‑500/slate‑600).
- **`sticky top-0 z-10`** zawsze. Rodzic scrolla NIGDY `overflow-hidden` (root‑cause RC‑4 zniknięcia nagłówka).
- Tło nagłówka: dziedziczy z karty + hairline `border-b border-slate-200/60 dark:border-white/[0.03]`.
- Ikona ustawień kolumn `Settings2` (`h-7`/`h-8`) w prawym górnym rogu (przy kolumnie akcji).

**MUST NOT:** kolor semantyczny w chrome nagłówka. Nagłówek jest monochromatyczny.

### 3.3 Model i wyrównanie kolumn
**MUST:**
- Kolejność: **obiekt/tytuł (left) → metadane (status/tagi/owner/data/priorytet) → Actions (right)**.
- **Wyrównanie wg roli (KANON 2026 — Linear/Notion), identyczne na każdej zakładce:**
  - tytuł/nazwa/obiekt → `text-left`
  - **tabliczki/chipy: tag/kategoria/typ/źródło ORAZ status → `text-left` + wiodąca kropka znaczenia** (identity dot dla tagów §4.0a; signal dot dla statusu) — tworzą pionową „szynę skanu"
  - **liczby (questions/usage/progress%/counts/kwoty) → `text-right`** (wyrównanie cyfr)
  - assignee, daty/`DueChip` → `text-left`
  - akcje → `text-right`
  - **MUST NOT:** centrowane chipy/statusy (pływają, łamią szynę) — to był stary błąd „metryki center".
- Kolumna tytułowa ma własny resizer (nie jest „resztą flexa").
- Każda kolumna: jawne min/max width; resize zatrzymuje się na limicie (bez kaskady).
- Puste komórki: `—` wyciszony, nigdy blank.
- Liczniki nadmiaru: `+N` jako pill, nie goły tekst.

### 3.4 Gęstość i wiersz
**MUST:**
- Comfortable (default): `px-4 py-3`. Compact (kolejki admin): `px-4 py-2`.
- Wysokość wiersza **stała** — nie zmienia się na hover/focus (żadnego „falowania").
- 2 linie (tytuł + opis/uzasadnienie) = **domyślne**; opis można ukryć w ustawieniach, ale odstęp się nie zwija.
- **Typografia wiersza (MUST — jawne tokeny, zero opacity‑slash):**
  - **Tytuł:** `text-sm font-semibold text-slate-900 dark:text-slate-100`. Zakaz `font-medium` jako „wagi tytułu" i zakaz niestandardowych rozmiarów (`text-[13.5px]`) / kerningu (`tracking-[…]`) na tytule wiersza.
  - **Opis/podtytuł:** `text-[11px] leading-4 text-slate-500 dark:text-slate-400`. „Wyciszenie" = jawny token koloru, **NIGDY** `text-slate-950/65`/`text-slate-100/55` ani inny opacity‑slash (RC‑9). Opacity zależy od tła → daje różny rezultat na różnych powierzchniach i łamie WCAG.

### 3.5 Selection / stany wiersza
**MUST:**
- Checkbox: body `h-3.5 w-3.5`, select‑all `h-4 w-4`, wyciszony; w „premium" odsłania się na hover/focus, zaznaczone zawsze widoczne.
- Hover: `hover:bg-slate-50/70 dark:hover:bg-white/[0.03]` (subtelny).
- Selected: `bg-primary-500/8 dark:bg-primary-500/10` + 4px lewy akcent `primary` + inset ring. Hover nie nadpisuje akcentu selekcji.
- **MUST NOT:** tło wiersza barwione statusem/priorytetem/kategorią. Status wyłącznie w pill wewnątrz komórki.

---

## 4) Statusy, progress, due (semantyka kolorów)

### 4.0 Formuła kolorów (system sygnałów) — RDZEŃ
**Kolor = SYGNAŁ, nie dekoracja. Czerwień = ALARM i jest zarezerwowana.** Tabela robocza ma być spokojna; kolor pojawia się tylko, gdy coś znaczy. Narzędzie pracy potrzebuje pełnej palety, nie „biało‑czerwieni".

| Ton | Token | Znaczenie | Stosujemy do |
|---|---|---|---|
| **neutral** | `c-text-muted`/`c-border`/`c-surface-raised` | brak sygnału, dane spoczynkowe | większość treści, typy/kategorie, daty „w porządku", shell chipów |
| **info** | `--c-info` (HBS blue) | informacja / w toku | status in‑progress/scheduled, **wypełnienie progresu** |
| **success** | `--c-success` (HBS green) | pozytyw / done / on‑track | approved/completed, progres 100%, KPI on‑track |
| **warning** | `--c-warning` (HBS amber) | uwaga / wkrótce / at‑risk | pending/in‑review, due‑soon, progres at‑risk |
| **danger** | `--c-danger` (HBS red) | **ALARM** | overdue, error, blocked, rejected, delete — **i nic poza tym** |
| **accent** | `--c-accent` (HBS crimson) | MARKA | primary CTA, aktywna selekcja — **nie** status/dane |

**MUST:**
- Czerwień (`danger`) **wyłącznie** dla realnego alarmu. **Nigdy** dla progresu, neutralnych dat, „w toku".
- **Pozytywny stan końcowy ≠ `danger`.** Etap/status oznaczający sukces lub awans (np. idea→inicjatywa „Promoted", „Approved", „Shipped") **MUST NOT** używać `danger` — to czyta się jak błąd. Użyj `success` (pozytyw) lub `accent` (jeśli to stan markowy/wyróżniony, spójny z kropką sygnału tego etapu). Częsty błąd: „Promoted" pomalowany na czerwono bo ikona rakiety „wygląda alarmowo".
- **Progres NIE jest czerwony** — neutralny/`info`, `success` @100%, `warning` tylko gdy moduł jawnie liczy „at‑risk".
- Crimson (`accent`) = marka/CTA/selekcja; **nie** jako kolor danych (czyta się jak alarm).
- Domyślny stan komórki = neutralny; kolor dokładamy tylko, gdy niesie znaczenie.
- **Test ekranu:** jeśli widać dużo czerwieni naraz → nadużycie `danger`, przejść na neutral/info/warning.

### 4.0a Tag / identity tone (bounded exception) — `categoryTone()`
Kolory **tożsamości** (kategoria/typ/źródło) to ŚWIADOMY wyjątek od „kolor = sygnał": pomagają skanować, ale nie wolno ich pomylić ze statusem/alarmem. Dlatego **osobna, stłumiona paleta `--c-tag-1..12`** (równo‑ważone hue, wizualnie inne niż info/success/warning/danger) i ścisłe reguły:
- **MUST — tylko wiodąca KROPKA** (`h-1.5 w-1.5 rounded-full`, kolor = `categoryTone(label)`), shell chipa **neutralny** (`INTERVIEW_META_CHIP_CLASS`/`MetaChip`). **MUST NOT:** wypełnienie kolorem ani boczny pasek (kanban/priorytet — kolizja znaczeniowa).
- **MUST — chip wyrównany do LEWEJ** (kropki tworzą pionową szynę). §3.3
- **Deterministyczny:** `categoryTone()` = jawna mapa znanych kategorii (zero kolizji) + hash fallback; **ta sama kategoria = ten sam kolor app‑wide**.
- **Tylko skończone taksonomie tożsamości** (category/type/source/tool). NIE status/priority/due/progress (te trzymają tony sygnałowe).
- a11y: kolor redundantny (label zawsze obecny) → bezpieczne dla daltonistów.
- SSOT: `src/components/ui/primitives/chips/categoryTone.ts` + tokeny `--c-tag-*`.

### 4.1 Status — `StatusChip` + bridge `statusChipTone()`
**MUST:** każda komórka statusu = `<EntityStatusChip status={raw} />` (cienka nakładka na `StatusChip`, przyjmuje surowy status). Kolor wyłącznie przez `statusChipTone(raw)` → `ChipTone` na tokenach `c.*`. Mapowanie surowego statusu → ton:
- **info** (`--c-info`): `in_progress, draft, open, generating, planning, new, scheduled, executing, promoted`
- **warning** (`--c-warning`): `submitted, pending, pending_review, pending_approval, awaiting_approval, in_review, review, escalated`
- **success** (`--c-success`): `approved, completed, done, published, active, utilized, tracking`
- **danger** (`--c-danger`): `sent_back, rejected, failed, blocked, cancelled, overdue`
- **neutral**: `archived, trashed, final, unknown, [nierozpoznane]`

**MUST NOT:** hardcodowane `bg-blue-50 text-blue-900`, własne `getSessionStatusConfig`/`getAssignmentStatusColor`/inline `statusConfig`, ani `shared/StatusPill` (legacy). Migrować do rodziny chipów `c.*`.

### 4.2 Geometria pill (z `ChipBase`)
Wspólny shell `ChipBase`: `rounded-full border-c-border bg-c-surface-raised text-c-text-secondary`, rozmiary `sm` (`h-6 px-2 text-[11px]`) / `md` (`h-7 px-2.5 text-xs`), kropka‑sygnał `ChipDot` (`h-1.5 w-1.5` sm). Kolor niesie wyłącznie kropka/ikona (sygnał), shell zostaje neutralny.

### 4.3 Progress
`ProgressCell` — pasek liniowy + label `%`. **Fill = `info` (w toku) → `success` @100%; NIGDY `danger`/crimson** (progres 50% to nie alarm — patrz §4.0). `warning` tylko gdy moduł jawnie liczy „at‑risk". Track neutralny (`c-border-subtle`). Ten sam komponent w tabeli i w kartach.

### 4.4 Due / overdue — JEDEN model
**MUST:** jedna kolumna „Termin" z `<DueChip>`: data w porządku = **neutral**; due‑soon = **warning**; przekroczone = **danger** (ikona `AlertTriangle` + „Xd overdue"). Kolor niesie ikona/kropka (sygnał), shell neutralny (`ChipBase`). To jedyne miejsce, gdzie w tej kolumnie pojawia się czerwień — i tylko dla realnego overdue.
**MUST NOT:** dwie osobne kolumny `DUE` + `OVERDUE` (rozjazd Sessions vs Assigned). Jeden chip = jedna kolumna na wszystkich zakładkach.

---

## 5) Sort / Filter / Resize / Persistencja

**MUST:**
- **Sort:** klik nagłówka sortuje, wskaźnik `ChevronDown` + kierunek; opt‑in per kolumna (`sortable`). Default sort definiowany per moduł i persystowany.
- **Filter:** filtr per kolumna przez `FilterDropdown` (multiselect, AND między kolumnami / OR wewnątrz). Złożone filtry → przycisk „Filters…" w Menu 2 (nie duplikować w nagłówkach).
- **Resize:** grip na granicy (hit ~12px), zero‑sum z sąsiadem, szerokość tabeli stała; ostatnia kolumna bez prawego resizera.
- **Persistencja (localStorage, klucz `persistKey="modul.widok"`):** szerokości kolumn **i** widoczność **i** „pokaż opis". Reset w popoverze ustawień. (Naprawa luki: dziś szerokości często giną po reloadzie.)

---

## 6) Ustawienia kolumn (popover)
**MUST:** portalowy `TableSettingsPopover` (pozycjonowany `getBoundingClientRect`, fixed, nigdy clipowany przez scroll), auto‑flip w górę, dismiss na Esc/outside‑pointer. Lista checkboxów kolumn; kolumny wymagane (tytuł/akcje) zablokowane; toggle „Pokaż opis/uzasadnienie". Persistencja per `persistKey`.
**MUST NOT:** modal dla zwykłej widoczności kolumn (modal tylko dla ciężkich „saved views"/grupowania).

---

## 7) Preview pane

### 7.0 Kanon podglądu — skrót (6 bloków, MUST)
> Ten podrozdział to **jedyne** źródło prawdy dla „jak wygląda preview" — reużywalny standard, nie
> opis per-moduł. Skill `consultify-preview` woła TEN kanon. Sześć bloków, góra→dół, kolejność sztywna
> (pełne wartości/klasy w §7.1–§7.3b niżej):

| # | Blok | Co to jest | Szczegóły |
|---|---|---|---|
| 1 | **Nagłówek** | sticky, tytuł + pin/kopiuj + „Open" (JEDYNE Open w całym preview) + „×" | §7.3 pkt 1 |
| 2 | **Meta** | pasek statusu/typu/daty/sesji — stan, nie treść | §7.3 pkt 2 |
| 3 | **Treść (Details)** | centrum, scrollowalne, bogaty domyślny szablon, licznik słów, **kebab lokalny** (Rozwiń/Zwiń·Kopiuj·Kopiuj prompt·Export·Pobierz) | §7.3 pkt 3 |
| 4 | **What's-next / „Co dalej"** (create-strip) | tylko gdy encja jest źródłem cross-module; zwarty pasek `Dokumenty` / `W aplikacji`, ikona+hue = moduł docelowy | §7.3a, §7.3 pkt 4.3 |
| 5 | **Akcje = pill** | `h-9 rounded-full`, przez `PreviewActionBar`+`actionPillClass()`; anty-duplikacja (nie dubluj Open/eksport) — opcjonalny, pomiń jeśli nic nie zostaje | §7.3b, §7.3 pkt 4.4 |
| 6 | **Kebab lokalny ≠ kebab wiersza** | kebab z bloku 3 (Details) jest osobnym kontraktem od `RowActionsMenu` wiersza tabeli/karty (§9) — nie mylić ani nie duplikować pozycji | §7.3 pkt 3 vs §9 |

**MUST:** AI (chipy Podsumuj/Zasuguj) i Relations to osobne, opcjonalne karty stopki MIĘDZY blokiem 3 i blokiem 4 — pełna kolejność stopki: AI → Relations → Co dalej → Akcje (§7.3 pkt 4). Blok bez danych = **ukryty**, nie pusty box; kolejność obecnych bloków się nie zmienia.

**Pułapka #36 (rozstrzygnięta, Piotr 07-12 — D21):** przyciski akcji w podglądzie = **pill** (`rounded-full`), „taki jak Google i Apple" — NIE `rounded-lg`. SSOT klas: `src/components/shared/PreviewPane/previewStyles.ts` (`PREVIEW_PILL_BASE`). Każda nowa/edytowana akcja w stopce podglądu **MUSI** iść przez `PreviewActionBar`/`actionPillClass()` — zero bespoke `bg-*`/`rounded-lg` inline (poprzedni `rounded-lg` tutaj był regresją względem już ustanowionego kanonu pill z TRIADA_KANON.md A8/C9).

### 7.1 Zachowanie
**MUST:** domyślnie **zamknięty**. Single‑click = select + open preview. Double‑click/Enter = full detail (N‑mode/workspace). Esc = zamknij (tabela wraca do `flex-1`). J/K (opcjonalnie) = nawigacja wierszy z auto‑update preview. Bulk‑select nie zamyka preview.

**Encje cross‑module „source→destination" (MUST):** gdy rekord powstaje w jednym module, a docelowo „żyje" w innym (np. **inicjatywa**: tworzona w Wywiadzie → promowana do modułu Initiatives), to **single‑click NIGDY nie wyrzuca od razu do modułu docelowego**. Wersje robocze (draft/pending) **zostają w tabeli źródłowej** i otwierają się w bocznym preview; nawigacja do modułu docelowego (double‑click / „Open in <Module>") włącza się **dopiero po przekazaniu dalej** (promoted/approved). Preview drafta pokazuje notkę „pozostaje w <module źródłowy> do czasu przekazania". (Wpadka naprawiona na Initiatives 2026‑06‑07.)

### 7.2 Wymiary i separacja
**MUST:** szerokość `clamp(340px, 28%, 480px)`. Separacja od tabeli = `gap-1.5`, **bez `border-l`**. Wrapper: `bg-slate-50 dark:bg-navy-950 p-3`. Karta wewnątrz: `rounded-xl bg-white/70 dark:bg-navy-900/70 border border-slate-200/70 dark:border-white/[0.06] backdrop-blur`. Jeśli tabela `rounded-xl` → preview też `rounded-xl` (spójność „composite container").

**MUST — wymiar pochodzi WYŁĄCZNIE z komponentu (dopisane 2026-07-21):** szerokość i odstęp
ustawia `StandardPreview` / `PreviewPaneShell`. Ekran ich **nie nadpisuje**.

- **Zakaz sztywnej szerokości** na kontenerze preview: `w-[420px]`, `w-[360px]`, `w-[460px]` itp.
- **Zakaz `border-l`** jako separacji od tabeli — separuje wyłącznie `gap-1.5`.
- **Zakaz własnego kontenera** tabela+preview per ekran; układ deklaruje komponent.

*Powód (zgłoszenie właściciela 2026-07-21):* szpara między tabelą a preview miała różną
szerokość w każdej zakładce My Work, bo każdy ekran ustawiał ją u siebie — w samym My Work
znalazły się cztery różne sztywne szerokości (320/360/420/460 px). Inwentarz PRV-007/008 tego
nie wykrył, bo badał anatomię stref (§7.3), a nie wymiary (§7.2). **Wymiar bez jednego źródła
rozjeżdża się zawsze — nie jest to kwestia staranności autora ekranu.**

### 7.3 Anatomia — ŻELAZNY UKŁAD (góra→dół, MUST; SSOT: `PreviewPaneShell`)
> **WZORZEC ZATWIERDZONY przez ownera 2026-06-07** na podglądzie Insight — referencja dla wszystkich
> tabel. Kolejność jest sztywna i identyczna wszędzie. Strefa bez treści = ukryta (nie pusty box),
> ale **kolejność obecnych stref się nie zmienia**.

```
┌─ 1 HEADER (sticky)  tytuł · [📌/🔗] · [Open] · [X] ┐
│  2 META BAR         status · typ · sesje · data      │
│  3 DETAILS (⋮)  ~N słów   OPIS — centrum, scroll    │  ⋮ = Copy · Copy prompt · Export · Download
│     · · · · · · · · · · · · · · · · · · · · · · · ·  │
│  4 AI               Podsumuj · Zasugeruj             │  stopka, space-y-2.5, bez dividerów
│  5 RELATIONS        (jeśli są)                       │
│  6 CO DALEJ         Dokumenty: … / W aplikacji: …    │  (create-strip, §7.3a)
│  7 ACTIONS          OPCJONALNE — patrz niżej         │
└──────────────────────────────────────────────────────┘
```

1. **Header (sticky `top-0 z-10`)**: opcjonalny kicker „Preview" (11px uppercase) + tytuł encji (1 linia, truncate+tooltip, semibold) + **akcje right (kolejność lewa→prawa):**
   - **Ikona `Pin`** (lucide), `size-4`, icon-only ghost button — **ZAWSZE, w każdym preview**. Pin = schowaj w skrótach.
   - **„Open" (ghost/outline pill) — JEDYNE „Open" w całym preview.** Klik = pełna karta + trwały tab w Menu 3. **Bez ikony** — sam tekst.
   - **„×" (close)** — zawsze ostatni.

   **Zamknięte opcjonalności (dopisane 2026-07-21).** Wcześniej ten punkt brzmiał „`Pin` lub `Copy`
   … opcjonalnie jedno lub oba", a „Open" nie miał reguły co do ikony. Efekt: w My Work trzy zakładki
   miały pinezkę, Inbox żadnej, i tylko Inbox miał ikonę oka przy „Open" (`InboxContent.tsx:1354`).
   **Opcjonalność w kanonie zawsze zamienia się w rozjazd — zestaw akcji nagłówka jest odtąd zamknięty:
   Pin · Open · ×, w tej kolejności, bez wariantów.** „Kopiuj link" przenosi się do ⋮ przy „Details",
   gdzie mieszkają pozostałe operacje na treści.

2. **Entity Meta Bar**: statusy/typ/sesje/priorytet/SLA/data (poziom +2, `p-4`, `rounded-lg`) — to stan, nie treść.

3. **Details (treść — wypełnia centrum)**: nagłówek sekcji „Details" (overline) + **licznik słów po prawej** (`~N słów`, `text-[10px] text-slate-400`; widoczny gdy treść > 0 słów; ukryty w empty state) + **⋮ (tu żyją: Rozwiń/Zwiń · Kopiuj · Kopiuj prompt · Export do Tools · Pobierz)**; body scrollowalne `whitespace-pre-wrap`, line‑height 1.6–1.8, `p-4`. **MUST — bogaty domyślny szablon**: nie jednolinijkowy opis. Z automatu pokazujemy kluczowe pola encji (cel/zakres, kontekst, właściciel, daty, powiązania, postęp) — tyle, ile encja ma sensownie wypełnione. Pusto → empty state, nie blank. **Details NIGDY nie ustępuje miejsca przyciskom** — opis zostaje w środku, akcje schodzą na dół.
4. **Stopka — KOLEJNOŚĆ SZTYWNA (MUST), góra→dół; karty z ramką, `space-y-2.5`, BEZ dividerów między nimi:**
   1. **AI**: label „AI" + ikona; chipy outline (`Podsumuj`, `Zasugeruj działania`); rozwijane bullety. AI asystuje treści → jest **najwyżej** w stopce, **nad** akcjami tworzenia.
   2. **Relations** (jeśli są): **2 wiersze stałej wysokości** (`min-h-[4.5rem]`), pills klikalne (kolor typu w tekście, nie tło), „+N more".
   3. **„Co dalej" / create-strip (opcjonalny, gdy encja jest źródłem cross-module)**: ZWARTY pasek małych przycisków (`h-8 rounded-full`, ikona+label), pogrupowany **„Dokumenty / W aplikacji"**. **NIGDY wielkie karty w body.** (Insight: `ArtifactActionPanel variant="compact"`; `variant="full"` tylko w pełnej karcie.) Ikony+kolory wg §7.3a.
   4. **Actions (sticky dół) — OPCJONALNE, anty-duplikacja (MUST):** pasek pokazujemy **tylko dla akcji, których nie ma już gdzie indziej**. **NIE dubluj „Open"** — jest w nagłówku. **NIE dubluj eksportu/pobierania** — te należą do menu ⋮ przy „Details". Jeśli po odjęciu duplikatów nie zostaje żadna sensowna akcja → **pomiń cały pasek** (stopka kończy się na „Co dalej"). Gdy zostaje: pille `h-9 rounded-full`, primary→secondary→ghost, parytet z full view, destrukcyjne = confirm, **+ dolny padding, by globalny FAB („Zgłoś błąd") nie zasłaniał**.

**Odstępy w stopce (MUST):** sekcje to samodzielne karty z ramką → **bez ciężkich linii-dividerów między nimi**; jeden spójny, minimalny rytm (`space-y-2.5` ≈ 10px). Dzielnik tylko tam, gdzie realnie rozdziela dwie różne logiki, nie między każdą kartą.

### 7.3a Tożsamość akcji tworzenia (create-targets) — kolor = moduł docelowy (MUST)
> Jeden spójny wątek dla całej aplikacji: ikona + hue przycisku = **moduł, do którego trafia artefakt**.
> Forma: **lekki tint tła (~8%) + kolorowa ikona** na zwartym pillu (nie wielki, kolorowy fill).
> Zero kolizji ikon (6 różnych) i hue (6 różnych). SSOT: `ArtifactActionPanel` `TARGET_META`.

| Akcja | Moduł docelowy | Ikona (lucide) | Hue |
|---|---|---|---|
| **Raport** (report) | Documents | `FileText` | slate |
| **Deck / Prezentacja** (presentation) | Presentations | `Presentation` | fuchsia |
| **Tabela** (table) | Table Studio | `Table` | emerald |
| **Idea** (idea) | Ideas / My Work | `Lightbulb` | amber |
| **Notatka** (note) | Notebook | `StickyNote` | sky |
| **Inicjatywa** (initiative) | Initiatives | `Rocket` | indigo |

Grupowanie w pasku: **Dokumenty** = Raport·Deck·Tabela; **W aplikacji** = Idea·Notatka·Inicjatywa.

### 7.3b Preview action buttons — implementacja (SSOT: `previewStyles.ts`)

Każdy przycisk w stopce preview MUSI używać `PreviewActionBar` + `actionPillClass()` z `src/components/shared/PreviewPane/previewStyles.ts`.

```ts
import { PreviewActionBar } from '@/components/shared/PreviewPane/PreviewActionBar';

const rows = [{
  actions: [
    { label: 'Otwórz', icon: ExternalLink, colorScheme: 'primary' },
    { label: 'Usuń',   icon: Trash2,      colorScheme: 'red' },
  ]
}];
<PreviewActionBar rows={rows} />
```

**Dozwolone `colorScheme`:** `'primary' | 'neutral' | 'emerald' | 'amber' | 'blue' | 'red'`

| colorScheme | Kiedy używać |
|---|---|
| `primary` | Główna akcja CTA (Open, Submit, Assign) |
| `neutral` | Drugorzędna (Edit, Duplicate, Export) |
| `emerald` | Akcja potwierdzenia / Dzisiaj |
| `amber` | Akcja odroczona / Snooze |
| `blue` | Akcja informacyjna |
| `red` | Destrukcyjna (Delete, Remove) |

**Niedozwolone:** własne `bg-*` / `text-*` klasy inline na przyciskach preview. Zero `bg-primary-500`, `bg-crimson-*`, `bg-green-500`, `bg-brand/*` na buttonach stopki.

### 7.3c Deskryptor preview per zakładka (MUST; dopisane 2026-07-21)

Tabele mają swój deskryptor (§15) — preview do dziś go nie miał. Bez niego pytanie „czy ta
zakładka jest zgodna z §7.3?" **nie ma twardej odpowiedzi**, bo kanon opisuje kolejność stref,
ale nie mówi, które strefy dana zakładka ma deklarować. Każda zakładka **MUSI** mieć wiersz w
tabeli poniżej. Nowy ekran z preview bez wpisu = zgłoszenie niekompletne.

**Reguła strefy „Co dalej" (zamyka opcjonalność z §7.3 pkt 4.3):** strefa jest **obowiązkowa
wtedy i tylko wtedy, gdy encja ma zaimplementowaną konwersję na artefakt innego modułu**
(istnieje realny handler tworzący Raport / Deck / Tabelę / Ideę / Notatkę / Inicjatywę).
Sama przynależność do „source→destination" (§7.1) **nie wystarczy** — kryterium jest kod, nie
klasyfikacja. Encja bez konwersji: strefa **nieobecna**, nie pusta.

*Powód:* poprzednie brzmienie („opcjonalny, gdy encja jest źródłem cross-module") kwalifikowało
wszystkie cztery zakładki My Work, a strefę miała jedna. Reguła, której nie da się sprawdzić
w kodzie, nie jest regułą.

| Zakładka | 2 META | 3 DETAILS ⋮ | 4 AI | 5 RELATIONS | 6 CO DALEJ | 7 AKCJE |
|---|:--:|:--:|:--:|:--:|:--:|---|
| My Work · **Ideas** | ✔ | ✔ | ✔ | ✔ | **✔ konwersja jest** | Konwertuj · Otwórz Flow |
| My Work · **Inbox** | ✔ | ✔ | ✔ | ✔ | ✖ brak konwersji | rozstrzygnięcia → informacyjne → czas |
| My Work · **Tasks** | ✔ | ✔ | ✔ | ✔ | ✖ brak konwersji | Dziś · Odłóż · Zrobione |
| My Work · **Decisions** | ✔ | ✔ | ✔ | ✔ | ✖ brak konwersji | Zatwierdź/Odrzuć · Info/Deleguj · Czas |

**Kolejność stref jest niezmienna** także wtedy, gdy strefa jest nieobecna — obecne strefy nie
zamieniają się miejscami. Wpadka referencyjna: `IdeasTableContent.tsx:646-663` renderował
AI → Relations → **Akcje → Co dalej**, czyli 6 i 7 zamienione, mimo że dwie linie wyżej
komentarz cytował ten kanon. **Dowód, że proza nie egzekwuje — egzekwuje komponent.**

---

## 8) Widoki alternatywne — GridView (karty) i Kanban

### 8.0 Zasady wspólne — wszystkie widoki alternatywne
**MUST:**
- Każdy widok alternatywny renderowany **wewnątrz tego samego `TableWithPreviewLayout`** (select→preview i J/K przeżywają). Wzór wzorcowy: Interview → Templates grid.
- Przełącznik widoku = **segmentowany ikonowy w Menu 2** (nie dropdown „Table ▾"). Kolejność ikon: lista (≡) → grid (⊞) → kanban → timeline. Każdy nowy widok = 1 ikona doklejona do segmentu. Nigdy dropdown. **Segment ukryty gdy tylko 1 widok aktywny.**
- Filtry, sortowanie, wyszukiwanie — wyłącznie w Menu 2. Karty i Kanban **nie mają własnych mini-toolbarów**.
- ⋮ menu karty = **ta sama `RowActionsMenu`** co w tabeli — identyczne sekcje, identyczne pozycje, identyczne uprawnienia. Zero rozbieżności między widokami.

### 8.1 GridView — anatomia karty (ŻELAZNY UKŁAD)
> **WZORZEC ZATWIERDZONY przez ownera 2026-06-07.**
> Referencja wizualna: Interview → Templates → widok grid.
> Kolejność 4 stref jest sztywna. Strefa bez danych = ukryta (NIE pusty box). Komponent: `GridCard`.
> Moduł dostarcza `props`, nie redefiniuje CSS.

```
┌──────────────────────────────────────────────────────┐
│ [Źródło▸System]  [Status▸Published]  [★ Default]   │  ← 1 BADGE ROW (lewy, flex-wrap)
│                                                       │
│ Digital Maturity Discovery                            │  ← 2 TITLE (semibold, 1–2 linie)
│ Standard template for digital transformation          │  ← 3 DESCRIPTION (muted, max 2 linie)
│                                                       │
│ ─────────────────────────────────────────────────── │  ← separator border-t
│ 12 questions          14 min          digital   [⋮] │  ← 4 STATS FOOTER (3 wartości + kebab)
└──────────────────────────────────────────────────────┘
```

**Strefa 1 — Badge row (MUST gdy dane):**
- Layout: `flex flex-wrap gap-1.5 items-center`
- Kolejność odznak: `[Źródło (System/Organization)]` → `[Status (Draft/Published/…)]` → `[Specjalna (Default/Featured)]`
- Styl: `rounded-full text-[11px] font-medium px-2 py-0.5 border`
- Kolory: System=slate, Organization=indigo, Published=emerald, Draft=amber, In review=sky, Default/Featured=rose/crimson
- Brak danych = cała strefa ukryta (zero pustego wiersza)

**Strefa 2 — Title (MUST):**
- `text-sm font-semibold text-slate-900 dark:text-slate-100`
- `line-clamp-2`, `title` attribute gdy ucięty (tooltip natywny)
- Min 1 linia widoczna zawsze

**Strefa 3 — Description (gdy dostępna):**
- `text-xs text-slate-500 dark:text-slate-400 line-clamp-2`
- Max 2 linie — reszta obcięta; NIE expandable w gridzie (expandable tylko w preview)
- Brak opisu = strefa ukryta; title zajmuje całą treść

**Strefa 4 — Stats footer (MUST):**
- Separator nad stopką: `border-t border-slate-100 dark:border-white/[0.05] mt-3 pt-3`
- Layout: `flex items-center justify-between text-[11px] text-slate-500`
- **Dokładnie 3 wartości** — moduł definiuje które: `[główna metryka]` · `[czas/rozmiar]` · `[kategoria/tag/area]`
  - Przykład Templates: `N questions · N min · {tag}`
  - Przykład Insights: `N sesji · {status} · {obszar}`
  - Przykład Initiatives: `N zadań · {priorytet} · {obszar}`
- Wartość 4+ = pominięta lub dostępna w ⋮
- ⋮ kebab: `size-4`, `opacity-0 group-hover:opacity-100` (lub zawsze widoczny — decyzja per-moduł; **MUST być dostępny**)

**Kontener karty:**
- `bg-white dark:bg-navy-900 rounded-xl border border-slate-200/60 dark:border-white/[0.06] p-4`
- Hover: `shadow-md` lub `translate-y-[-1px]` lift — jedno z dwóch, spójne w module
- **NIE ma `border-l-[3px]` akcentu kolorowego** — kolor statusu wyraża badge, nie boczna kreska

**Layout siatki (MUST):**
| Viewport | Kolumny |
|---|---|
| ≥1024px (desktop) | `grid-cols-3` |
| 768–1023px (tablet) | `grid-cols-2` |
| <768px (mobile) | `grid-cols-1` |
| Gap | `gap-4` (16px) |

**Interakcja karty (MUST — identyczna z wierszem tabeli):**
- Single-click → boczny preview pane; URL bez zmian
- Double-click / Enter → pełna karta
- ⋮ → `RowActionsMenu` z identycznymi sekcjami jak w tabeli
- J/K → nawigacja kart z auto-update preview
- Select (checkbox / klik) → bulk bar w Menu 3 (formuła 2)

### 8.2 Kanban — karty w kolumnach
> Kanban = inny układ **tych samych kart** (`GridCard`). Karta jest identyczna — kolumna to tylko kontener.
> Stan na 2026-06-07: brak wdrożenia. Reguły poniżej obowiązują przy implementacji.

**Kolumna:**
- Header: `[Nazwa statusu]` (semibold) + `(N)` licznik + opcjonalny `WIP: N/max` badge
- Kolejność kolumn = kolejność wartości enuma (persystowana, edytowalna przez admina)
- Pusta kolumna = widoczna jako placeholder z etykietą (NIE ukryta — ukryte kolumny dezorientują)
- Szerokość kolumny: `min-w-[260px] max-w-[320px]`; poziome przewijanie deski gdy nie mieści się na ekranie

**Karta w Kanbanie:**
- Identyczna z `GridCard` — ten sam komponent, te same strefy
- Badge statusu może być pominięty (kolumna go wyraża) — decyzja per-moduł
- Interakcja i ⋮: identyczne z gridem

**Drag & drop:**
- Przeciągnięcie między kolumnami = zmiana wartości pola grupującego (status, etap itd.)
- Zablokowane przejścia (reguły RBAC/statusów) → karta wraca + toast error
- Drop w tej samej kolumnie → reorder (jeśli moduł obsługuje manual order)

**Pełna specyfikacja Kanban** (WIP limits, multi-field grouping, wąskie widoki, klawiszatura) zostanie uzupełniona gdy moduł wdroży widok. To świadoma luka, nie pominięcie.

---

## 9) Row actions menu (⋮) — 3 strefy (góra kontekst / dół stały / danger)

**Zasada nadrzędna (decyzja ownera 2026-06-06):** menu ma **stały DÓŁ identyczny w każdej tabeli/zakładce** i **GÓRĘ kontekstową** (typową dla obszaru/statusu). Ręka trafia w to samo miejsce w każdym oknie. To musi być zweryfikowane, nie pozostawione przypadkowi.

### 9.1 Anatomia 3 stref

| Strefa | Pozycje | Reguła |
|---|---|---|
| **GÓRA — kontekst** | akcje typowe dla statusu/roli danego wiersza. Inbox: `Continue`/`Start`/`Fix`. Assigned (manager): `Approve`·`Send back`·`Reassign`·`Send reminder`·`Escalate` | tylko akcje dotyczące tego statusu/roli; pusta strefa = ukryta (bez pustego separator-only) |
| separator | — | auto między strefami |
| **DÓŁ — FIXED BOTTOM MANIFEST** | patrz §9.2 — lista ścisła, identyczna wszędzie | niezmienny niezależnie od statusu/roli/zakładki |
| separator | — | auto |
| **DANGER** | `Usuń` | zawsze ostatni, ton danger, confirm; brak endpointu → `disabled` z opisem „Wkrótce (backend)" (slot widoczny, nie pomijać) |

### 9.2 FIXED BOTTOM MANIFEST — dokładna lista (MUST, w tej kolejności)

> To jest **ścisły kontrakt**. Każda tabela w aplikacji musi mieć te pozycje w dolnej strefie,
> w tej kolejności, z tymi verbami. Audyt weryfikuje każdą pozycję z osobna.

| # | Pozycja | Ikona | Warunek | Zachowanie |
|---|---|---|---|---|
| 1 | **Otwórz podgląd** / Open preview | `ChevronRight` | zawsze | otwiera boczny preview pane (nie nawiguje) |
| 2 | **Edytuj** / Edit | `Pencil` / `Edit2` | zawsze (disabled gdy brak uprawnień) | manager→modal zarządzania; assignee→edycja odpowiedzi; owner→edycja inline |
| 3 | **Archiwizuj** / Archive (lub **Przywróć** / Restore) | `Archive` / `RotateCcw` | zawsze (disabled gdy brak endpointu — „Wkrótce") | soft-delete; zmiana scope; brak endpointu → disabled z notą |
| 4 | **Delay ▸** / Delay | `Clock` + chevron | tylko gdy encja ma pole terminu (`due_date`) | submenu inline: +1 dzień · +3 dni · +7 dni |

**MUST:**
- Kolejność 1→2→3→(4) jest stała i nie zmienia się.
- Pozycja 3 zmienia label/ikonę kontekstowo (scope `active` → „Archiwizuj"; scope `archived` → „Przywróć") — ale **slot zawsze istnieje**.
- Pozycja 4 = N/A jeśli encja nie ma terminu (nie ma pola `due_date`) → slot pominięty.
- Brak backend endpointu dla pozycji 2 lub 3 → `disabled: true` z `description: "Wkrótce (backend)"`. **Nigdy cicha pominięcie widocznego slotu.**
- Każda pozycja = ikona + label (zero pozycji z samym tekstem).

### 9.3 GÓRA kontekstowa — przykłady per moduł

| Moduł / zakładka | Status wiersza | Akcje kontekstowe (GÓRA) |
|---|---|---|
| Interview Inbox | assigned | `Continue`, `Start`, `Fix` |
| Interview Assigned (manager) | submitted | `Approve`, `Send back`, `Reassign`, `Send reminder`, `Escalate` |
| Interview Initiatives | DRAFT | `Wyślij do przeglądu` |
| Interview Initiatives | PENDING_REVIEW | `Zatwierdź i przekaż dalej`, `Wróć do szkicu` |
| Interview Initiatives | REVIEW/PROMOTED | *(pusta strefa — ukryta)* |
| Interview Templates | active | `Assign`, `Duplicate` |

**MUST:** górna strefa pusta → ukryta (brak pustego separator-only bloku). Weryfikacja: otwórz kebab dla wiersza w każdym statusie — GÓRA musi się różnić.

**MUST:** każda pozycja = ikona+label; ten sam verb = ta sama pozycja wszędzie; akcja z >2 wariantami → submenu inline (`▸`, np. Delay). Komponent SSOT: `RowActionsMenu.tsx` (`sections` + `submenu`). Wzorzec referencyjny: Interview Inbox/Assigned.

**SSOT typów:** `src/components/shared/RowActionsMenu.tsx` eksportuje `RowAction`, `RowActionSection`, `RowActionSectionKind`.
```tsx
import { RowActionsMenu, type RowActionSection } from '@/components/shared/RowActionsMenu';

const sections: RowActionSection[] = [
  { id: 'context', kind: 'context', actions: [...] },  // GÓRA
  { id: 'fixed',   kind: 'manage',  actions: [openPreview, edit, archive, delay] },  // DÓŁ FIXED
  { id: 'danger',  kind: 'danger',  actions: [deleteAction] },
];
<RowActionsMenu sections={sections} />
```

---

## 10) Stany: empty / loading / error
**MUST:**
- **Loading:** spinner + „Loading…" / skeleton; nigdy blank.
- **Error:** karta błędu + **retry**; nigdy „coś poszło nie tak" bez wyjścia. Guard danych: `(field || '').toLowerCase()` itp.
- **Empty:** jeden `EmptyState` z rozróżnieniem „brak danych" vs „brak danych dla filtra" (wzór: Initiatives), ikona + copy + CTA. i18n PL/EN przez `useTranslation` (bez hardcode).

---

## 11) Rozstrzygnięcia sprzeczności (vs stare dokumenty)
| Temat | Stare rozjazdy | **Kanon v1** |
|---|---|---|
| Szerokość preview | `clamp(340,28%,480)` vs „~420px" | **`clamp(340px, 28%, 480px)`** |
| Widoczność kolumn | modal vs popover | **portalowy popover** (`TableSettingsPopover`) |
| Wiersz 1 vs 2 linie | „1 linia MUST" vs „opis domyślnie widoczny" | **2 linie domyślnie**, opis ukrywany w ustawieniach |
| Status | StatusBadge legacy / StatusPill (palette) / chipy c.* | **rodzina chipów `c.*` + `statusChipTone()` (SSOT, HBS)**; StatusPill+statusColors = legacy do migracji |
| Przełącznik widoku | dropdown vs segment | **segment ikonowy** |
| Due/Overdue | 1 kolumna vs 2 kolumny | **1 kolumna `DueChip`** |
| Kolor nagłówka | slate‑500 vs slate‑600 | **slate‑500 dark:slate‑400** |

---

## 12) Plan migracji (ranking ROI)
**Faza 0 — prymitywy (S, niskie ryzyko):** wydzielić/ujednolicić `StatusPill`/`ProgressCell`/`DueChip`/`AssigneeCell`/`TableViewSettings`/`useColumnResize(persist)`; podpiąć `getStatusStyle()`; włączyć sticky header wszędzie. Czysty refaktor, wygląd ~bez zmian.

**Tier 1 — listy o najwyższym ruchu (~44 pliki):** My Work (14), Assessment (15), Admin core (15). Największy wpływ na użytkownika.

**Tier 2 (~16 plików):** Results/Finance/Benefits, Interview, Partner, Governance — jeśli kanon pokrywa ≥80% wzorca.

**Faza końcowa:** Interview 5 ręcznych tabel → FilterableTable; konsolidacja `ResizableTable`→prymitywy; usunięcie martwych komponentów (§2.1).

**Poza migracją:** ~24 pliki (raporty/dokumenty read‑only + macierze + artefakty AI) — §1.2.

---

## 13) Acceptance criteria (skrót)
> To skrót szybkiego sprawdzenia. **Pełna operacyjna checklista audytu (A–S) + procedura 6 kroków = §27** — to nią przelatujemy każdą tabelę.

- [ ] 🔴 **Preview pane ISTNIEJE** — single-click otwiera boczny podgląd, nie nawiguje od razu. §7 / §27.A0
- [ ] 🔴 **Filtry kolumn ISTNIEJĄ** — `FilterDropdown` na sensownych kolumnach. §5 / §27.A0
- [ ] Renderowana przez `TableWithPreviewLayout` + `FilterableTable` (lub spełnia §3–§7 jeśli na `ResizableTable`).
- [ ] Nagłówek `sticky top-0 z-10`, `text-[11px] uppercase tracking-wider`, `text-slate-500 dark:text-slate-400`; rodzic bez `overflow-hidden`.
- [ ] Wyrównanie wg roli identyczne na każdej zakładce (tytuł left / metryki center / akcje right).
- [ ] Gęstość `px-4 py-3`; wysokość wiersza stała na hover.
- [ ] Wiersz monochromatyczny, separatory hairline, selected = `bg-primary-500/8` + 4px akcent; brak tła barwionego statusem.
- [ ] Status = `EntityStatusChip`/`statusChipTone()` (rodzina chipów `c.*`); brak hardcodowanych kolorów statusu, brak `StatusPill` w nowym kodzie.
- [ ] Termin = jedna kolumna `DueChip` (nie DUE+OVERDUE).
- [ ] Resize zero‑sum; szerokości + widoczność kolumn persystowane (`persistKey`).
- [ ] Ustawienia kolumn = portalowy popover, nieclipowany.
- [ ] Preview domyślnie zamknięty; szer. `clamp(340,28%,480)`; separacja `gap-1.5` bez `border-l`; stopka w kolejności AI→Relations→Actions.
- [ ] Empty/Loading/Error obsłużone; Error ma retry; puste komórki `—`.
- [ ] i18n PL/EN bez hardcode.

---

## 14) Cykl życia rekordu — Archive / Delete + scope Aktywne/Zarchiwizowane

> Przy dużej liczbie rekordów (insighty, sesje, obserwacje) „aktywne vs archiwum" to jedyny
> sposób, żeby tabela nie spuchła. To jest **standard cyklu życia** dla każdej tabeli w zakresie §1.1.
> Powiązane: §9 (kebab — strefy), §15.3 (Menu 3 — formuły).

### 14.1 Dwa czasowniki — semantyka (MUST)
- **Archiwizuj** = miękkie, **odwracalne**. Ustawia `archived_at` (+ `archived_by`). Rekord znika z
  domyślnego widoku, wraca przez **Przywróć**. NIE kasuje danych.
- **Usuń** = twarde, **nieodwracalne**, za potwierdzeniem, w strefie **danger** kebaba (§9).
- Ten sam czasownik = ta sama pozycja wszędzie: **Archiwizuj/Przywróć w strefie „dół/stały"** kebaba,
  **Usuń w strefie danger**. Bulk: framed `MENU_3_ACTION_NEUTRAL` (jak reszta, §15.3 formuła 2).
- Domyślne uprawnienia: **Archiwizuj + Usuń = dla każdego z prawem edycji** danego rekordu
  (reużywamy istniejącej bramki edycji; nie dorzucamy osobnego RBAC). Zaostrzenie (np. Usuń tylko
  OWNER/admin) tylko gdy moduł świadomie tak decyduje.

### 14.2 Scope Aktywne / Zarchiwizowane (MUST)
- **Stany:** `active` (domyślny) · `archived` · opcjonalnie `all`.
- **Miejsce:** **chip w Menu 3** (command row), obok pozostałych filtrów statusu, oddzielony
  cienkim dzielnikiem (`mx-1 h-5 w-px`). Ikona `Archive`. Aktywny = `chipActive`.
  - Uwaga implementacyjna: gdy otwarty jest dokument (zakładka), ModuleHub pokazuje `DynamicTabs`
    zamiast filtrów — chip scope jest wtedy ukryty (spójne ze wszystkimi filtrami). Wraca po
    zamknięciu dokumentu. (Jeśli moduł wymaga scope zawsze-widocznego → przenieść do Menu 2/rightControls.)
- **Filtrowanie po stronie serwera:** `GET …?scope=active|archived|all`. Zmiana scope → przeładowanie
  listy (nie filtrowanie po stronie klienta — archiwum może być duże i paginowane).
- Kebab kontekstowo: w `active` pokazuje **Archiwizuj**, w `archived` pokazuje **Przywróć**
  (sterowane przez `archivedAt` rekordu lub bieżący scope).

### 14.3 Kontrakt danych / backend (MUST — `DB_MANAGED_SCHEMA=off`)
- Kolumny `archived_at TIMESTAMP`, `archived_by TEXT` dodawane **wyłącznie guarded lazy ALTER**
  (`getTableColumns` + `cols.has`, idempotentny guard na „already exists"/„duplicate column").
  **Nigdy migracją.** Wzorzec: `ensureInterview*LifecycleColumns()` (sesje, assignmenty, insighty).
- Lista filtruje w SQL: `AND archived_at IS NULL` (active) / `AND archived_at IS NOT NULL` (archived) /
  brak (all). Mapowanie odpowiedzi wystawia `archivedAt`.
- Archiwizacja przez istniejący `PATCH …/:id { archived: boolean }` (reużywa bramki edycji), nie nowy
  dedykowany endpoint, jeśli PATCH już istnieje. Log aktywności: `archived` / `restored`.

### 14.4 Status wdrożenia
- **Pilot: Insights** — zrobiony (chip Menu 3, kebab Archiwizuj/Przywróć, bulk, scope serwerowy,
  guarded ALTER). Rollout na pozostałe tabele = **backlog §B-1** (`docs/backlog/TABLE_LIFECYCLE_BACKLOG.md`).
- Sesje i assignmenty mają już `archived_at` w backendzie (wzorzec do reużycia po stronie UI).

---

## 15) Menu 1 / Menu 2 / Menu 3 — zachowanie nad tabelą

Tabela żyje pod trzema paskami menu. SSOT Menu 2/3: `13_MENU_2_MODULE_TOPBAR.md`, `14_MENU_3_COMMAND_ROW.md`, `module-hub-standard.md`, komponent `src/components/shared/ModuleMenu3.tsx`.

### 15.1 Menu 1 (global sidebar) — NIE zmienia się
Globalna nawigacja aplikacji. Tabela ani moduł **nigdy** jej nie modyfikują. Poza zakresem tego kanonu.

### 15.2 Menu 2 (Module Topbar) — zmienia się per moduł, stałe reguły

**MUST:**
- Lewa strona: search toggle → główne taby modułu (np. Inbox/Sessions/Assigned/…). **Taby NIE pokazują liczników** (liczniki są w Menu 3).
- Prawy klaster — stała kolejność wizualna **od prawej krawędzi**:
  1. **Area** (toggle panelu/split) — jeśli moduł go ma,
  2. **Primary CTA „Działania/Add"** (np. `Assign`, `New session`) — bez leading `+`,
  3. **Tool** (jeśli dotyczy),
  4. **View modes** — segmentowane ikony (kolejność z `view-modes-standard.md`),
  5. **Filters** — maks. 1 główny dropdown; reszta w Menu 3 / w nagłówkach kolumn.
- Wszystkie kontrolki `h-9`, jeden family, spokojny styl (bez gradientów).
> Uwaga (decyzja właściciela 2026‑06‑06): „Działania" = istniejący Primary CTA (Add), NIE osobny dropdown.

**MUST NOT:** `Help` w prawym klastrze; dropdown `Table ▾` do przełączania widoków; dublowanie filtrów / mini‑toolbary pod Menu 2.

#### 15.2a Podział filtrów: Menu 2 vs nagłówki kolumn vs Menu 3 — decyzja (MUST)

> Trzy miejsca mogą filtrować, ale **każdy typ filtra ma jedno miejsce** — nie duplikuj.

| Typ filtra | Gdzie | Przykład |
|---|---|---|
| **Filtr globalny / złożony** (zakres dat, saved view, łączy wiele wymiarów) | Menu 2 — `Filters` dropdown (maks. 1) | „Filtry zaawansowane ▾" |
| **Filtr per kolumna** (status/typ/priorytet/źródło — wartości z danej kolumny) | **Nagłówek kolumny** — ikona lejka → `FilterDropdown` multiselect | Klik „STATUS ⊽" → lista statusów do zaznaczenia |
| **Scope / preset zakresu** (Aktywne/Archiwum/Wszystkie, All/Draft/Promoted) | **Menu 3 — counter-chipy** (formuła 1) | `Wszystkie 7 · Szkice 2 · Przekazane 5` + chip `Active/Archive` |
| **Szybki filtr domenowy** (per-moduł typ/rola) | Menu 3 — counter-chipy | Inbox: `Wszystkie / Odpowiedziano / Zatwierdzone / Odesłane` |

**Reguły rozstrzygające:**
- Jeśli filtr można wyrazić jako „pokaż wiersze gdzie kolumna X = {wartość z listy}" → **nagłówek kolumny** (`FilterDropdown`). Nie trafia do Menu 2.
- Jeśli filtr to preset klikowy „zakres" (aktywne/archiwum) lub „etap" (szkic/w toku/zamknięte) → **Menu 3 chip**, z licznikiem w chippie. Nie ma go w nagłówkach.
- Jeśli filtr łączy wiele pól lub ma złożone kryteria → **Menu 2 `Filters` dropdown** (max 1 taki dropdown per moduł). 
- **MUST NOT:** ten sam filtr w dwóch miejscach naraz (np. status i w nagłówku i w Menu 2 dropdown).
- **MUST NOT:** brak filtrów per kolumna gdy kolumna ma skończoną taksonomię wartości (status/typ/priorytet/źródło → zawsze `FilterDropdown`).

#### 15.2b Widoki (view modes) — kiedy i jakie

- Segmentowane ikony view-mode (list/grid/kanban/timeline) są w **prawym klastrze Menu 2** (przed `Filters`).
- **MUST NOT** view-mode toggle w Menu 3 (tam tylko formuły 1/2/3).
- Domyślny widok = list; alternatywny (grid/board) włącza się ikoną.
- View modes persystowane per `persistKey` (localStorage).
- Jeśli moduł ma tylko 1 widok (np. tylko listę) → nie pokazuj segmentu (brak empty segmentu).

### 15.3 Menu 3 (Command Row) — dynamiczny, ≥3 formuły
Jeden rząd pod Menu 2. SSOT: `ModuleMenu3.tsx`. Przyjmuje jedną z formuł zależnie od kontekstu (priorytet: **bulk > otwarte‑karty > filtry**):

**Formuła 1 — STANDARD (filtry/liczniki).**
- Po lewej: counter‑chipy = presety/statusy z licznikami (np. `All 7 · In progress 4 · Submitted 0 · Approved 3`) + przełączniki zakresu (`Active/Archive/Trash`). Triggery domenowe, nie generyczne `Wszystkie`.
- **MUST:** ta sama tabela‑rola = ten sam zestaw counter‑chipów na każdej zakładce modułu (koniec z „Sessions ma liczniki, Inbox/Assigned nie").
- **MUST:** każdy chip pokazuje realny licznik (0 jest OK — widoczny chip z 0 informuje że brak elementów w tym etapie). Brak chipu = użytkownik nie wie ile jest.

**Formuła 2 — MULTI‑SELECT (bulk action bar).**
- Gdy zaznaczono ≥1 wiersz: Menu 3 **natychmiast** zamienia się w pasek „**N selected · Clear**" + **przyciski** akcji zbiorczych „co można z tym zrobić". **MUST:** żaden ekran z multi‑select nie może pokazać samego „N selected" bez przycisków (bug Inbox).
- **Wygląd przycisków bulk (MUST):** prawdziwe przyciski **w ramkach (outline)**, `rounded-full`, **`h-8`** (mniejsze niż główne CTA `h-9`), ikona+label, spójne na każdej tabeli. Nigdy „gołe słowo". Danger (`Delete/Trash`) wyróżniony tonem `danger` + confirm.
- **Zestaw STANDARDOWY** (zawsze, gdy dotyczy): `Export CSV` · `Tag` · `Assign/Reassign` · `Change due date` · `Archive` · `Delete`.
- **Zestaw KONTEKSTOWY** (dokładany per moduł wg deskryptora `menu3.bulkActions`): np. Wywiad `Approve · Send back · AI insights`. Standardowe + kontekstowe w jednym pasku, danger zawsze na końcu.
- **MUST — nigdy tylko Clear:** pasek MUSI mieć ≥1 akcję poza `Clear`. Jeśli lifecycle/endpoint nie istnieje → przycisk `disabled` z notą „Wkrótce (backend)" (slot widoczny). Status-specific akcje (np. „Wyślij do przeglądu" dla draftu) **nie zastępują** stałych — muszą być OBOK nich.
- Po `Clear`/odznaczeniu wraca formuła 1.

**Formuła 3 — OTWARTE KARTY (cross‑module tabs).**
- Single‑click w wierszu = **przejściowy preview pane** po prawej (NIE tworzy taba).
- Akcja **„Open"** (z preview footer / kebaba) = otwiera **pełną kartę na ekranie głównym** ORAZ dodaje **trwały tab** w Menu 3.
- Menu 3 pokazuje **wszystkie otwarte karty z całej sesji pracy, CROSS‑MODULE** — np. 4 inicjatywy + 2 insighty = 6 tabów. Tab = ikona‑typu + tytuł encji + `×` (close). Klik w tab = przełączenie na pełną kartę.
- SSOT stanu: `useModuleOpenDocuments(moduleKey)`. **MUST:** tytuł taba = realny tytuł encji (zakaz zaszumionych/uciętych artefaktów typu „abaliza").

---

## 16) Wiersz nagłówka — wybór kolumn + podtytuły

To pierwsza linia tabeli i jej kontrolki. SSOT: `TableSettingsPopover` (portalowy).

**MUST — wybór aktywnych kolumn:**
- Ikona `Settings2` w prawym górnym rogu nagłówka → portalowy popover „**Visible columns**".
- Lista checkboxów wszystkich kolumn; kolumny wymagane (np. tytuł, Actions) oznaczone „**Required**" i zablokowane.
- Stan widoczności persystowany per `persistKey` (localStorage).

**MUST — podtytuł pod tytułem (row description):**
- W tym samym popoverze toggle „**Show row description**".
- Włączony → pod tytułem renderuje się druga linia (opis/uzasadnienie/subtytuł): `text-[11px] leading-4 text-slate-500 dark:text-slate-400` (jawny token wyciszenia, **nie** opacity‑slash — RC‑9 / §3.4).
- Wyłączony → druga linia ukryta, **wysokość wiersza i rytm się nie zwijają skokowo** (stała geometria).
- Stan persystowany per `persistKey`.

**MUST:** popover nigdy nie jest clipowany (portal `document.body`, pozycja `fixed` z `getBoundingClientRect`, **auto‑flip w górę** gdy brak miejsca, **`max-height` + własny scroll** gdy lista kolumn dłuższa niż viewport — wszystkie pozycje muszą być osiągalne), dismiss Esc/outside. **Bug do naprawy:** dzisiejszy popover Wywiadu (legacy) rozwija się w dół i jest ucinany — migracja na `TableSettingsPopover` to zamyka.

---

## 17) Kebab (⋮) — standard akcji wiersza
Rozszerza §9. **MUST:**
- Ikona pionowa `MoreVertical`, `opacity-40 group-hover:opacity-100`, hit ≥ `h-8 w-8`, kotwiczona do prawej (kolumna Actions).
- Otwiera portalowe menu (nieclipowane), sekcje w kanonicznej kolejności (§9): Open · [Tool] · Context · AI · Convert to · Create output · Manage · Danger.
- Te same akcje co preview footer i full view (parytet nazw/uprawnień). 5–7 pozycji bezpośrednich; nadmiar → sub‑picker.

---

## 18) Przyciski per tabela — standard + deskryptor
Każda tabela musi mieć **udokumentowany, wystandaryzowany** zestaw kontrolek. Wygląd/kolejność = §15 (Menu 2/3) + §17 (kebab) + §7.3.4 (preview footer). Treść (jakie konkretnie przyciski) opisujemy przez **deskryptor tabeli** — jeden blok per zakładka modułu:

```yaml
table: <modul>.<zakladka>           # np. interview.sessions
persistKey: <modul>.<zakladka>      # localStorage
menu2:
  tabs: [..]                        # główne taby modułu (lewa)
  primaryCTA: <label>               # np. "New session"
  viewModes: [list, grid|board|..]  # segmentowane ikony
  filters: [<1 główny dropdown lub none>]
menu3:
  counters: [<chip:licznik>, ..]    # formuła 1
  bulkActions: [<akcja>, ..]        # formuła 2
columns:                            # model kolumn (§3.3)
  - { id, label, align: left|center|right, sortable, filter, hideable, required, width }
rowKebab: [Open, <context..>, <ai..>, <convert..>, <manage..>, <danger..>]
previewFooter:
  aiHints: [<3 chipy>]
  relations: [<typy relacji>]
  actions: [<akcje, parytet z full view>]
```

> Deskryptory poszczególnych tabel trzymamy w aneksie modułu (osobne pliki/ sekcje), nie w tym pliku‑rdzeniu. Rdzeń definiuje STANDARD + szablon; moduły go wypełniają.

---

## 19) Specyfikacja graficzna i układ (lock — wszystkie tabele identyczne)
Cel: każda tabela w aplikacji wygląda tak samo. Lock przez klasy Tailwind + tokeny `c.*`, nie surowe px. Referencja wizualna: `docs/ui-standards/assets/app-table-golden-reference-{dark,light}-2026-05-02.png`.

### 19.1 Geometria kontrolek (stała)
| Element | Token/klasa |
|---|---|
| Kontrolki Menu 2 | `h-9`, `rounded-full` |
| Chipy Menu 3 / status / meta | `h-6 px-2 text-[11px]` (sm) / `h-7 px-2.5 text-xs` (md) |
| Ikona w chipie | 12px (sm) / 14px (md) |
| Nagłówek kolumny | `text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400` |
| Komórka (gęstość) | `px-4 py-3` (comfortable) / `px-4 py-2` (compact) |
| Avatar w `AssigneeCell` | `h-6 w-6 text-[10px]` (sm) |
| Kropka‑sygnał (`ChipDot`) | `h-1.5 w-1.5` (sm) |
| Pasek progresu (`ProgressCell`) | track `h-1` (sm), fill `bg-c-accent` → `bg-c-success` @100% |
| Kebab hit | `h-8 w-8`, ikona pionowa |
| Preview pane | `clamp(340px, 28%, 480px)`, separacja `gap-1.5`, bez `border-l` |

### 19.2 Powierzchnie i kolory (tokeny `c.*`)
- Tło modułu: `bg-c-bg`. Karta tabeli/preview: `bg-c-surface` (lub `bg-white/70 dark:bg-navy-900/70`), border `border-c-border`, hairliny `border-c-border-subtle`.
- Chip shell: neutralny `bg-c-surface-raised border-c-border text-c-text-secondary`; kolor wyłącznie jako sygnał (kropka/ikona) z `--c-success/warning/danger/info/accent`.
- Selected row: `bg-c-accent-soft` + 4px lewy akcent `--c-accent`. Hover: subtelny lift, bez tła barwionego statusem.

### 19.3 Układ stref (layout grafik) — stała kolejność
- **Menu 2 (góra):** [search ▸ taby] ………………………… [Filters · Views · Tool · CTA · Area] (od prawej).
- **Menu 3 (pod spodem):** formuła 1 liczniki(lewa) / formuła 2 „N selected + akcje" / formuła 3 taby otwartych kart.
- **Tabela:** `[checkbox][tytuł(+podtytuł) →left] [metryki →center] [⋮ Actions →right]`, nagłówek `sticky top-0 z-10`.
- **Preview (prawa, opcjonalnie):** Header(sticky) → Meta bar → Details → [AI hints (3) · divider · Relations (2 wiersze) · divider · Actions].
- **Pełna karta (po „Open"):** zajmuje ekran główny; przełączana tabami Menu 3 (formuła 3).

### 19.4 Akceptacja graficzna
- [ ] Porównanie z `app-table-golden-reference-{dark,light}` (light NIE wyprany, dark ma realne separatory).
- [ ] Wszystkie kontrolki w geometriach z §19.1; kolor tylko jako sygnał.
- [ ] Identyczny układ stref §19.3 na każdej tabeli modułu.

---

## 20) Zabezpieczenia inżynierskie — anty‑wzorce RC‑1…RC‑10 (MUST NOT)
Źródło: `docs/audit/2026-06-03/TABLE_GRAPHICS_ROOTCAUSE.md`. To są dokładnie błędy, przez które wracaliśmy do tabel „po raz setny". Każdy ma twardy zakaz + regułę.
- **RC‑1 — podwójny scroll:** **MUST NOT** zagnieżdżać dwóch `overflow-auto`/`overflow-x-auto` wokół tej samej tabeli (de‑sync sticky header w poziomie). Jeden kontener scrolla.
- **RC‑2 — zwężenie przez preview:** gdy preview otwarty, wewnętrzny scroll tabeli **MUST** przeliczać szerokość (flex‑min‑0), nie zostawiać phantom‑scrolla.
- **RC‑3 — mismatch szerokości header/body:** w `table-fixed` szerokości `thead` i `tbody` **MUST** pochodzić z jednego źródła (`columnWidths`), zakaz 4px driftu.
- **RC‑4 — `overflow-hidden` rodzica:** rodzic sticky‑`thead` **MUST NOT** mieć `overflow-hidden` (łamie sticky). (Akceptacja §13.)
- **RC‑5 — surowy `<table>`:** nowy ekran **MUST NOT** renderować ręcznego `<table>`; używa SSOT (§2). Lint/PR‑review pilnuje.
- **RC‑6 — sticky w hidden:** dotyczy 5 ręcznych tabel Interview — j.w., do migracji.
- **RC‑7 — hardcoded `colSpan`:** wiersze empty/error **MUST** liczyć `colSpan` z liczby widocznych kolumn (po hide), nigdy stała `={7}`.
- **RC‑8 — ad‑hoc `max-w-[…]`:** **MUST NOT** wstrzykiwać `max-w-[760px]` itp. na komórkę tytułu/opisu; szerokość wyłącznie z modelu kolumn (`width/minWidth/maxWidth`). `truncate` + szerokość kolumny wystarczają.
- **RC‑9 — opacity‑slash na tekście:** **MUST NOT** wyciszać tekstu przez slash‑opacity (`text-slate-950/65`, `text-slate-100/55`, `text-white/60` itp.). Wyciszenie = **jawny token koloru** (`text-slate-500 dark:text-slate-400`). Slash‑opacity miesza kolor z tłem (różny wynik na różnych powierzchniach, łamie WCAG, nieprzewidywalny w dark). Dotyczy opisów wierszy, podtytułów, metadanych. (§3.4) — root‑cause: stare brzmienie „opis: niższa opacity".
- **RC‑10 — sprzeczne/zdublowane klasy Tailwind:** **MUST NOT** zostawiać sprzecznych klas tego samego wariantu (`dark:text-slate-300 dark:text-slate-400` — wygrywa ostatnia, pierwsza to martwy kod) ani duplikatów (`dark:text-slate-400 dark:text-slate-400`). Jeden wariant = jedna klasa. To copy‑paste dług, który ukrywa realny kolor.

## 21) Dostępność i klawiatura (MUST)
- **Klawiatura:** ↑/↓ (oraz J/K) nawigują wiersze; Enter/dbl‑click = full view; Esc = zamknij preview; Space = toggle zaznaczenia; Tab = logiczna kolejność.
- **ARIA:** tabela `role=table`/semantyczny `<table>`; sortowalny nagłówek `aria-sort`; zaznaczenie ogłaszane (`aria-live="polite"` z licznikiem „N selected"); preview pane `role="complementary"`/`dialog` (mobile) z `aria-label` = tytuł encji.
- **Focus:** widoczny ring focus (`--c-focus`) na nagłówkach/wierszach/kontrolkach; focus trap w popoverze ustawień i w preview‑modal (mobile).
- **Kontrast:** light NIE wyprany, dark z realnymi separatorami; każdy ton chipa spełnia WCAG AA (tekst/tło).

## 22) Pozostałe reguły normatywne (uzupełnienie)
- **Przełącznik gęstości:** comfortable/compact wybierany w popoverze ustawień (§16), persystowany per `persistKey`. Compact domyślnie chowa podtytuł.
- **Sort:** ikona kierunku — `ChevronUp` (asc) / `ChevronDown` (desc) przy aktywnej kolumnie; brak ikony = brak sortu. Multi‑sort: Shift+klik dodaje klucz wtórny (opcjonalne per moduł).
- **Filtry — presety i persistencja:** stan filtrów persystowany per moduł (przeżywa zmianę zakładki); aktywne filtry pokazywane jako usuwalne chipy w Menu 3 (formuła 1); „Filters…" w Menu 2 = maks. 1 dropdown złożony.
- **Empty‑state — 3 warianty:** (a) „brak danych w ogóle" + CTA tworzenia; (b) „brak danych dla filtra" + „Wyczyść filtry"; (c) „brak wyników wyszukiwania". i18n PL/EN.
- **Czas względny:** daty jako czas względny (`2d temu`/`2d ago`), z tooltipem daty absolutnej; format locale‑aware.
- **Truncacja i18n:** tytuł/nazwa `truncate` + tooltip pełnej wartości; kolumny nie łamią się przy dłuższych łańcuchach (np. DE/PL).

## 23) Reguły lock widoków alternatywnych (z `view-modes-standard.md`)
- **Kanban:** drag&drop oraz reorder w kolumnie są **per‑moduł włączane/wyłączane**; brak uprawnień → toast, nie cichy no‑op. Affordance: edytowalne karty jaśniejsze, read‑only ciemniejsze.
- **Timeline/Gantt:** selektor skali (dzień/tydz./mies./kwartał) **MUST** być w Menu 2, nie w lokalnym toolbarze; marker „dziś".
- **Calendar:** klik eventu = preview (single) / full (dbl), spójnie z tabelą.
- **Matrix:** dopuszczalny tylko gdy 2 osie mają sens; element‑klik spójny z tabelą.
- **Wspólne:** każdy widok renderowany WEWNĄTRZ `TableWithPreviewLayout`; przełącznik = segment ikonowy; bez lokalnych mini‑toolbarów (filtry/sort w Menu 2/3).

## 24) Pełna karta (po „Open") — anatomia
Po akcji „Open" (§15.3 formuła 3) encja otwiera się jako **pełna karta na ekranie głównym** (nie preview):
- Zajmuje główny obszar (zamiast listy); lista wraca przez „≡ List" w Menu 3.
- Anatomia = detail‑view N‑mode (`NModeShell`): Header(sticky) + PropertiesStrip + Canvas/sekcje + ActionBar. Akcje = parytet z preview/kebabem.
- Przełączanie między otwartymi kartami = taby Menu 3 (cross‑module). Zamknięcie taba (`×`) usuwa kartę z paska.
- Wiele kart otwartych naraz; aktywna = podświetlony tab. SSOT stanu: `useModuleOpenDocuments` (patrz §26 — wymaga store globalnego).

## 25) Deskryptory tabel — lokalizacja, instancja, presety
- **Lokalizacja:** `docs/ui-standards/03-modules/table-descriptors/<modul>.<zakladka>.md` (jeden plik per tabela). Pola MUST: `table, persistKey, menu2.tabs, menu2.primaryCTA, menu2.viewModes, columns, rowKebab`. Warunkowe: `menu2.filters, menu2.tool, menu3.counters, menu3.bulkActions, previewFooter`.
- **Instancja referencyjna** (`interview.sessions`):
```yaml
table: interview.sessions
persistKey: interview.sessions
menu2: { tabs: [Inbox, Sessions, Assigned, Templates, Insights, Initiatives], primaryCTA: "New session", viewModes: [list, grid], filters: [none] }
menu3:
  counters: [All, "In progress", Submitted, Approved]   # + zakres: Active/Archive/Trash
  bulkActions: [Approve, "Send back", "AI insights", "Export CSV", Archive, Trash]
columns:
  - { id: name, label: Name, align: left, sortable: true, hideable: false, required: true }
  - { id: assignee, label: Assignee, align: left, sortable: true, filter: true, hideable: true }
  - { id: status, label: Status, align: center, sortable: true, filter: true, hideable: true }
  - { id: progress, label: Progress, align: center, sortable: true, hideable: true }
  - { id: due, label: Due, align: center, sortable: true, hideable: true }   # JEDNA kolumna DueChip (nie DUE+OVERDUE)
rowKebab: [Open, Reassign, "Change due date", "Send reminder", "Escalate now", Archive]
previewFooter: { aiHints: ["Summarize","Risks","Next steps"], relations: [Initiative, Insight], actions: [Open, Approve, "Send back"] }
```
- **Presety counter‑chipów per moduł (formuła 1):** ta sama tabela‑rola = ten sam zestaw na każdej zakładce. Np. Interview Inbox = `All/Answered/Approved/Sent back`; Sessions = `All/In progress/Submitted/Approved` (+Active/Archive/Trash). Pełna lista presetów per moduł = w plikach deskryptorów.

## 26) Egzekwowalność i luki adopcyjne (uczciwy stan kod↔kanon)
Kanon jest **częściowo egzekwowalny dziś**. Komponenty SSOT istnieją, ale wymagają adopcji:
- **`FilterableTable` MUST zmienić:** `StatusPill`→`EntityStatusChip`; inline `ProgressBar`→`ProgressCell`; legacy `ColumnSelector`(modal)→`TableSettingsPopover`(portal); ikona `Columns`→`Settings2`; dodać **sort** (klik nagłówka + ikona kierunku); dodać `border-b` nagłówka.
- **Preview footer:** `PreviewPaneShell` przyjmuje `footer` jako opaque — kolejność AI→Relations→Actions (§7.3.4) **nie jest wymuszana komponentem**; do czasu wymuszenia obowiązuje jako reguła autorska + akceptacja §13.
- **🔴 Cross‑module taby (§15.3/§24) NIE DZIAŁAJĄ dziś:** `useModuleOpenDocuments` ma store **per‑moduł** (`storageKey = PREFIX+moduleKey`). Aby spełnić wymóg „4 inicjatywy + 2 insighty razem" **MUST** przejść na **globalny store sesji** (jeden klucz, wpis = {module, entityType, id, title}). To jest zadanie komponentowe (osobny ticket), nie sama dokumentacja.
> Dopóki te luki nie zamknięte, tabela jest „zgodna z kanonem" jeśli spełnia §3–§23 wizualnie; pełna zgodność (chipy `c.*`, cross‑module taby) wymaga powyższych zmian komponentowych.

## 27) PROCEDURA AUDYTU TABELI + PEŁNA CHECKLISTA (operacyjna)

> To jest narzędzie do „atakowania" każdej kolejnej tabeli. Wrzucasz tabelę → przelatuję **wszystkie** punkty A–S → koryguję odstępstwa → bramki → dowód wizualny → raport `PASS/FAIL/N-A` per punkt.
>
> **📋 OPERACYJNY FORMULARZ AUDYTU (gotowy do wypełnienia per tabela):**
> `docs/ui-standards/03-modules/TABLE_AUDIT_SHEET_TEMPLATE.md`
> Skopiuj → wypełnij META → przejdź Fazy 0→6 → bramki → raport.
> **NIE pomijaj Fazy 0.** Właśnie dlatego, że ją pominęliśmy, nie wykryliśmy braku preview i filtrów na Initiatives.

### Procedura (6 kroków, zawsze ta sama)
1. **Identyfikacja** — który plik/komponent, która zakładka, czy to tabela listowa (§1.1) czy poza zakresem (§1.2).
2. **Faza 0 (existence)** — czy tabela MA komplet maszynerii (preview/filtry/sort/resize/sticky/popover/kebab/bulk/stany). Jakikolwiek brak = STOP i napraw ZANIM przejdziesz dalej.
3. **Fazy 1–6 (jakość)** — każdy punkt: `PASS` / `FAIL` / `N/A` (+ `file:line` dla FAIL). **Per-zakładka i per-status — nie pomijaj żadnej kombinacji.**
4. **Korekta** — naprawiam każdy `FAIL` wg reguły kanonu (link w punkcie).
5. **Bramki** — FE `tsc`=0, BE `esbuild`=0, eslint 0 błędów. Świeżość kodu (curl).
6. **Dowód wizualny** — screenshot przed‑po + weryfikacja computed‑style krytycznych punktów.

> Karta NIE jest „zgodna", dopóki którykolwiek punkt **krytyczny** (🔴) ma `FAIL`.
> ⚠️ **PER‑ZAKŁADKA + PER‑STATUS (MUST):** kebab i bulk bywają per-zakładkowe (Inbox ≠ Assigned ≠ Sessions). Preview zachowuje się inaczej per status (draft ≠ promoted). Przelatuj każdą kombinację osobno — nie zakładaj, że fix w jednej zakładce naprawił resztę.

---

### Toolkit weryfikacji (jak sprawdzać — nie „na oko")
- **Computed-style (DOM):** `preview_eval` → `getComputedStyle(el)` na konkretnym elemencie. Używaj do: koloru (`backgroundColor`/`color` vs token), wyrównania (`textAlign`), pozycji/clipowania (`position`, `getBoundingClientRect().bottom <= innerHeight`), sticky (`position==='sticky'`), `maxHeight`/`overflowY`.
- **Per-zakładka loop:** dla KAŻDEJ zakładki (Inbox/Sessions/Assigned/Templates/Insights/Initiatives…) powtórz Fazy 2–4 (kebab/bulk/preview). Fix w jednej ≠ fix wszędzie.
- **Per-stan wiersza:** otwórz kebab i preview dla wiersza w KAŻDYM statusie (draft/in-progress/submitted/approved/sent-back/archived) — akcje kontekstowe różnią się per status.
- **Policz pozycje kebaba:** nie tylko „czy menu otwiera się" — policz pozycje w KAŻDEJ strefie (kontekst/stały/danger). Jeśli strefa stała ma <2 pozycji → FAIL.
- **Policz przyciski bulk:** nie tylko „czy pasek jest" — jeśli po Clear jest 0 innych przycisków → FAIL.
- **Preview stopka:** weryfikuj KOLEJNOŚĆ sekcji (AI → Relations → Co dalej → Actions). Sprawdzaj czy „Co dalej" to compact strip `h-8` (nie wielkie karty). Sprawdzaj czy jest drugi „Open" (FAIL jeśli tak).
- **Selekcja:** zaznacz 1 i ≥2 wiersze → sprawdź pasek bulk. Zaznacz „select all".
- **Screenshot przed/po** + zrzut DOM (lista nagłówków, lista itemów kebab/bulk) jako dowód w raporcie.
- **Świeżość kodu:** `curl -s localhost:3000/src/.../Plik.tsx | grep -c <token>` (pułapka stale-cache Vite na dużych plikach); hard-reload przed weryfikacją.
- **Pułapki danych demo:** część zakładek pusta (np. Inbox) lub gated RBAC (ADMIN bez `canAssign`) → zaznacz w raporcie „zweryfikowane na koncie OWNER / nie do sprawdzenia na demo".
- **Bramki:** FE `rm -f tsconfig.tsbuildinfo && npx tsc --noEmit` = 0 · BE `esbuild` = 0 · `eslint` 0 błędów.

---

### A0. PARITY GATE — czy tabela MA komplet maszynerii? (ZRÓB NAJPIERW; brak = blokujący)
> Najpierw inwentaryzacja „czy to w ogóle JEST", dopiero potem jakość. Brak któregokolwiek = 🔴
> **blokujący brak funkcji**, nie „kosmetyka/opcjonalne". (Dodane po wpadce na Initiatives 2026-06-07:
> brak preview i brak filtrów kolumn przeszły niezauważone, bo audyt skakał od razu w detale wyrównania.)

- [ ] 🔴 **Preview pane JEST** — single-click wiersza otwiera BOCZNY podgląd; URL się NIE zmienia; NIE nawiguje do innego modułu. → `jak:` klik wiersz → panel z prawej + sprawdź URL w pasku. §7
- [ ] 🔴 **Cross-module draft ZOSTAJE w źródle** (jeśli tabela ma cross-module encje) — draft/pending NIE otwiera modułu docelowego; preview pokazuje notkę „pozostaje w X do przekazania". → `jak:` klik draft → URL bez `/initiatives` lub innego docelowego modułu. §7.1
- [ ] 🔴 **Filtry kolumn SĄ** — każda sensowna kolumna (status/typ/priorytet/źródło) ma ikonę lejka w nagłówku; klik → dropdown z wartościami. → `jak:` klik lejek przy „Status" → lista checkboxów. §5
- [ ] 🔴 **Sort JEST** — klik nagłówek → wiersze się sortują + ChevronUp/Down pojawia się przy nagłówku. §5
- [ ] 🔴 **Resize JEST** — drag uchwyt między kolumnami → kolumna zmienia szerokość, sąsiednia reaguje (zero-sum). §5
- [ ] 🔴 **Sticky header JEST** — `position: sticky` trzyma nagłówek przy scrollu. §3.2
- [ ] 🔴 **Popover „widoczne kolumny" JEST** i portalowany — otwiera się, NIE jest ucinany; ostatnie pozycje listy widoczne. §6 / §16
- [ ] 🔴 **Kebab ⋮ JEST i ma treść** — menu się otwiera; strefa stała (dół) ma ≥2 pozycje (Open + Archiwizuj); strefa kontekstowa zmienia się per status. → `jak:` otwórz kebab dla wiersza w każdym statusie; policz pozycje w każdej strefie. §9
- [ ] 🔴 **Pasek bulk JEST i ma akcje** — zaznacz 1 wiersz → pasek z „N selected · Clear · [≥1 inne przyciski]". Przyciski outline, `h-8`, po LEWEJ. → `jak:` policz przyciski; jeśli jest tylko Clear → FAIL. §15.3
- [ ] 🔴 **Stany** empty / loading / error obsłużone (nie blank). §10
> Każde „NIE MA" → wpisz do raportu jako **brakująca funkcja (blokujące)** i napraw, ZANIM przejdziesz do detali A–U.

### A. Identyfikacja i komponenty (SSOT)
- [ ] 🔴 Renderowana przez `TableWithPreviewLayout` + `FilterableTable` (lub — tymczasowo — spełnia A–S wizualnie, jeśli na `ResizableTable`/ręczna). §2
- [ ] Ustalona **która zakładka(i)** i czy współdzielą jeden renderer (jeśli tak — zmiana dotyka wszystkich; jeśli nie — sprawdź każdą). 
- [ ] `persistKey` ustawiony (per moduł.widok) — warunek persistencji kolumn/szerokości/filtrów.
- [ ] Brak surowego `<table>` w nowym kodzie (RC‑5). §20
- [ ] Nie używa komponentów wycofanych (`EnhancedDataTable`/`AdminTable`/`TablePresentationToggle`). §2.1
- [ ] Nie używa legacy `StatusPill`/`statusColors` (→ chipy `c.*`). §2.1a

### B. Menu 1 (global sidebar)
- [ ] Nie zmienia się, nie jest nadpisywane lokalnie. §15.1

### C. Menu 2 (Module Topbar)
- [ ] 🔴 Lewa strona: search toggle → główne taby (bez liczników w tabach). §15.2
- [ ] 🔴 Prawy klaster od prawej: **Area → Primary CTA (Add) → Tool → View modes → Filters**. §15.2
- [ ] View toggle = segment ikonowy (nie dropdown „Table ▾"). §15.2
- [ ] Wysokość kontrolek `h-9`, spójny styl, bez gradientów; brak `Help` w prawym klastrze.
- [ ] Brak dublowania filtrów / mini‑toolbarów pod Menu 2.

### D. Menu 3 (Command Row — dynamiczny, 3 formuły)
- [ ] 🔴 Formuła 1 (filtry): counter‑chipy z licznikami; **ten sam zestaw na każdej zakładce roli** (nie „Sessions ma, Inbox nie"). §15.3
- [ ] 🔴 Formuła 2 (multi‑select): zaznacz ≥1 → **natychmiast** pasek z przyciskami. **Policz przyciski: jeśli jest tylko „Clear" i nic więcej → FAIL.** → `jak:` zaznacz 1 wiersz → policz przyciski w pasku (musi być ≥2: Clear + ≥1 inna akcja). §15.3
- [ ] 🔴 **Wszystkie przyciski bulk IDENTYCZNE** (`MENU_3_ACTION_NEUTRAL`, outline, `h-8`, ikona+label) — w tym **`Clear` to przycisk z ramką i ikoną X, NIE „gołe słowo"/ghost**. → `jak:` computed-style `Clear` → ma `border`, `height: 32px`, `border-radius: 9999px`; ta sama klasa co reszta.
- [ ] 🔴 **WSZYSTKIE przyciski bulk WYRÓWNANE DO LEWEJ** (zgrupowane tuż przy liczniku „N selected"), **NIGDY** wypchnięte na prawą krawędź paska. → `jak:` screenshot/`getBoundingClientRect` — `left` przycisków blisko licznika, nie po przeciwnej stronie. (Bug: Sessions miał akcje po prawej.)
- [ ] 🔴 **Identyczna GRAFIKA wszystkich przycisków** — ta sama klasa `MENU_3_ACTION_NEUTRAL` (`outline`, `h-8`, `rounded-full`, ikona+label). **`Clear` ma wyglądać DOKŁADNIE jak reszta** (ikona X), nie „ghost"/inny styl. → `jak:` computed-style — `Clear` ma to samo `border`/`height`/`borderRadius` co `Archive`/akcje.
- [ ] 🔴 **Układ:** najpierw stałe/uniwersalne lewo (`Clear · Archiwizuj`), potem kontekstowe dla obszaru (Inbox: `+1 dzień · +3 dni · +7 dni`); separator między grupami. §15.3 / §18
- [ ] 🔴 **Sprawdź w KAŻDEJ zakładce osobno** — paski bulk bywają per‑zakładka (bug: Assigned miał, Inbox tylko „Clear").
- [ ] Zestaw: uniwersalne (`Clear·Export CSV·Tag·Archive·Delete`) + kontekst per obszar (Inbox: Delay +1/+3/+7); danger ostatni, confirm. §15.3
- [ ] Akcje bulk wpięte w **realne handlery** (nie atrapy); brak endpointu → przycisk pominięty lub `disabled` z notą, nie martwy. 
- [ ] Formuła 3 (otwarte karty): single‑click=preview (bez taba); „Open"=pełna karta + trwały tab; taby **cross‑module**; tytuł=realny (bez artefaktów typu „abaliza"). §15.3 / §24
- [ ] Dokładnie jeden rząd Menu 3 (bez dodatkowych stripów). 
- [ ] 🔴 **Scope Aktywne/Zarchiwizowane** = chip w Menu 3 (ikona `Archive`, dzielnik), `GET …?scope=`, kebab kontekstowo Archiwizuj↔Przywróć. §14.2 → `jak:` klik chip → leci `?scope=archived`, kebab pokazuje „Przywróć". (Pilot: Insights ✅; reszta = backlog §B-1.)

### E. Wiersz nagłówka (kolumny + podtytuły)
- [ ] 🔴 Typografia `text-[11px] font-semibold uppercase tracking-wider`, kolor `text-slate-500 dark:text-slate-400`. §3.2
- [ ] 🔴 `sticky top-0 z-10`; rodzic bez `overflow-hidden` (RC‑4). §3.2 / §20
- [ ] Hairline `border-b` pod nagłówkiem. §3.2
- [ ] 🔴 Wyrównanie wg roli (KANON 2026): tytuł **left** · **tabliczki/chipy (tag/kategoria/typ/źródło + status) left + kropka znaczenia** · **liczby (questions/usage/%/counts) right** · assignee/due **left** · akcje **right**. **Brak centrowanych chipów/statusów.** §3.3
- [ ] 🔴 Tagi tożsamości (category/type/source) = neutralny chip **lewo + wiodąca kropka** `categoryTone()` (paleta `--c-tag-*`); **nie** wypełnienie, **nie** boczny pasek; ta sama kategoria = ten sam kolor. §4.0a → `jak:` computed-style — kropka ma `--c-tag-*`, chip lewy.
- [ ] 🔴 Ikona `Settings2` → **PORTALOWY** popover „Visible columns" (`createPortal`+`position:fixed` z `getBoundingClientRect`). **Samo `max-height` NIE wystarcza** — popover `absolute` jest clipowany przez `overflow:hidden/auto` rodziców (kontener scrolla tabeli + wrappery layoutu). Zweryfikuj realnie, że **ostatnie pozycje (Submitted/AI Score/Escalation + toggle opisu) są widoczne i scrollowalne**, nie ucięte. §16
- [ ] Kolumny wymagane oznaczone „Required" i zablokowane. §16
- [ ] Toggle „Show row description" w popoverze; włączony = druga linia (subtytuł ~11px), wyłączony = brak skoku wysokości. §16 / §3.4
- [ ] Widoczność + szerokości + „row description" persystowane per `persistKey`. §5 / §16

### F. Kolumny / komórki
- [ ] 🔴 Status = `EntityStatusChip` (`statusChipTone` → `c.*`); brak hardcodów. §4.1 → `jak:` grep brak `StatusPill`/`bg-blue-900`; computed-style kropki = ton `c.*`.
- [ ] 🔴 Progress = `ProgressCell`; fill `info`→`success`@100%, **nigdy danger/crimson**. §4.3/§4.0 → `jak:` `getComputedStyle(fill).backgroundColor` ≠ wartość `--c-accent`/czerwień przy <100%.
- [ ] 🔴 Termin = **jedna** kolumna `DueChip` (nie DUE+OVERDUE). §4.4 → `jak:` zrzut nagłówków — brak osobnej kolumny „Overdue"/„Po terminie".
- [ ] Assignee = `AssigneeCell` (avatar+imię **left**), graceful „Unassigned" (nie „? Unknown"). §3.3 → `jak:` wiersz bez asignee pokazuje kursywne „Unassigned", nie „?".
- [ ] Typ/kategoria/źródło = neutralny chip (`getTypeStyle`/MetaChip). §4
- [ ] Puste komórki = `—` wyciszony, nigdy blank. §3.3
- [ ] Nadmiar chipów = `+N` jako pill. §3.3
- [ ] Brak `max-w-[…]`/`colSpan` hardcode na komórkach (RC‑7/RC‑8). §20

### G. Wiersz (gęstość, hover, selekcja, typografia)
- [ ] Gęstość `px-4 py-3` (comfortable) / `px-4 py-2` (compact); wysokość stała na hover. §3.4
- [ ] 🔴 **Tytuł wiersza** `text-sm font-semibold text-slate-900 dark:text-slate-100` — bez `font-medium`, bez `text-[13.5px]`/`tracking-[…]`. §3.4 → `jak:` inspect computed `fontWeight=600`, `fontSize=14px`.
- [ ] 🔴 **Opis/podtytuł** `text-[11px] leading-4 text-slate-500 dark:text-slate-400` — **zero opacity‑slash** (`text-slate-950/65` itp.). §3.4 / RC‑9 → `jak:` grep `text-slate-9..\/` i `text-slate-1..\/` w pliku = 0 trafień.
- [ ] Brak ad‑hoc `max-w-[…]` na komórce tytułu/opisu (RC‑8); brak sprzecznych/zdublowanych klas Tailwind (RC‑10). §20
- [ ] Brak zebry; separatory `divide-y` hairline. §3.1
- [ ] 🔴 Tło wiersza NIGDY barwione statusem; status tylko w pill. §3.5
- [ ] Hover subtelny; selected = `bg-primary-500/8` + 4px lewy akcent + ring; hover nie nadpisuje selekcji. §3.5
- [ ] Checkbox `h-3.5 w-3.5`, quiet/reveal‑on‑hover; checked zawsze widoczny. §3.5

### H. Kebab (⋮) — 3 strefy (góra kontekst / dół stały / danger)
- [ ] 🔴 **Kebab wyrównany do ⋮ przycisku** — prawa krawędź menu = prawa krawędź przycisku (±5px). §9 → `jak:` klik ⋮ → sprawdź wizualnie; jeśli menu oddalone >20px → FAIL. Poprawka: `right = innerWidth - anchorRect.right` (NIE `left = anchorRect.right - panelWidth`).
- [ ] 🔴 **DÓŁ ZAWSZE TEN SAM i KOMPLETNY**: `Open · Edytuj · Archiwizuj(/Przywróć) · Delay ▸` — identyczny w każdej zakładce/statusie. → `jak:` otwórz kebab dla wiersza w KAŻDYM statusie (draft/approved/archived) i policz pozycje w strefie stałej — musi być ≥2 zawsze (nawet dla wiersza, który nie ma kontekstowych akcji). §9
- [ ] 🔴 **GÓRA kontekstowa zmienia się per status** wg roli; pusta strefa = ukryta (bez pustego separator-only). §9 → `jak:` otwórz kebab dla wiersza w każdym statusie — GÓRA musi się różnić. Jeśli GÓRA identyczna we wszystkich statusach → akcje kontekstowe są statyczne (bug).
- [ ] 🔴 **DANGER**: `Usuń` ostatni, oddzielony separatorem, ton danger (czerwony), klik → confirm dialog. Brak backend endpointu → przycisk `disabled` z opisem „Wkrótce (backend)" (slot widoczny, nie pomijaj). §9
- [ ] `Edytuj` kontekstowe w działaniu (manager→modal zarządzania; assignee→edycja odpowiedzi), ale stała pozycja w dolnej strefie. §9
- [ ] `Delay ▸` = **submenu inline** `+1/+3/+7 dni` (chevron, rozwija pod spodem). §9 → `jak:` klik Delay → pojawiają się 3 pod-pozycje. (N/A jeśli encja nie ma terminu)
- [ ] Każda pozycja = ikona+label (zero pozycji z samym tekstem bez ikony). §9
- [ ] Menu **portalowe, auto-flip, nieclipowane, w viewport** (`getBoundingClientRect().bottom <= innerHeight`). §9
- [ ] Akcje = parytet z preview footer i full view (te same nazwy/uprawnienia). §17
- [ ] 🔴 **Sprawdzone w KAŻDEJ zakładce** (Inbox/Assigned/Sessions/…) i KAŻDYM statusie wiersza. Komponent SSOT: `RowActionsMenu` (`sections` + `submenu`).
- [ ] 🔴 **Archiwizuj = miękkie/odwracalne** (`archived_at` via guarded lazy ALTER, nie migracja), Przywróć w scope `archived`, Usuń = twarde/danger/confirm. Uprawnienia = jak edycja. §14 → `jak:` archiwizuj wiersz → znika z `active`, jest w `archived`, „Przywróć" go wraca. (Wymaga realnych danych + prawa edycji — nie demo-fixtures.)

### I. Preview pane (wzorzec zatwierdzony 2026-06-07 — §7.3)
- [ ] 🔴 **PREVIEW W OGÓLE ISTNIEJE** (A0) — tabela jest w `TableWithPreviewLayout`, single-click = boczny panel. Jeśli klik wiersza nawiguje do innego modułu zamiast otworzyć podgląd → brak preview = blokujące. §7
- [ ] 🔴 Domyślnie zamknięty; single‑click=preview, dbl/Enter=full, Esc=zamknij. §7.1
- [ ] Szerokość `clamp(340px,28%,480px)`; separacja `gap-1.5` bez `border-l`. §7.2
- [ ] Header sticky: kicker+tytuł(1 linia,truncate)+**„Open" (jedyne w preview)**+„X". §7.3
- [ ] 🔴 Details — **bogaty domyślny szablon** (cel/zakres/kontekst/właściciel/daty/powiązania), nie jednolinijkowy; pusto=empty state; **opis wypełnia centrum, nie ustępuje przyciskom**. §7.3
- [ ] 🔴 **⋮ przy Details** = Rozwiń/Zwiń·Kopiuj·Kopiuj prompt·**Export do Tools·Pobierz** (eksport/pobieranie żyją TU, nie w dolnym pasku). §7.3 → `jak:` klik ⋮ przy nagłówku „Details" → lista zawiera Export + Pobierz; NIE ma ich w dolnym pasku Actions.
- [ ] 🔴 **Żelazna kolejność stopki góra→dół: AI → Relations(jeśli są) → „Co dalej"/create-strip → Actions(opcjonalne).** AI **nad** create-strip. §7.3 → `jak:` scroll stopkę — pierwsza karta = AI; poniżej Relations (jeśli są); poniżej Co dalej; Actions (jeśli w ogóle) ostatnie.
- [ ] 🔴 **Odstępy stopki = `space-y-2.5` (~10px), BEZ dividerów między kartami z ramką.** §7.3 → `jak:` brak `<hr>` / `border-t` między kartą AI a „Co dalej"; gap ~10px.
- [ ] 🔴 **Anty-duplikacja „Open":** w całym preview dokładnie **1 przycisk Open/Otwórz** (w nagłówku). Zero w stopce/Actions. → `jak:` grep/inspect całe drzewo preview po tekście „Open" / „Otwórz" — ma być dokładnie 1 trafienie. §7.3
- [ ] 🔴 **Anty-duplikacja Export/Copy:** Export do Tools i Pobierz żyją wyłącznie w ⋮ Details. NIE ma ich w dolnym pasku Actions. → `jak:` inspect sekcja Actions — brak „Export", „Download", „Pobierz". §7.3
- [ ] 🔴 **„Co dalej" = COMPACT STRIP** (gdy encja jest źródłem cross-module): każdy przycisk ma `h-8 rounded-full` z ikoną+labelką. **NIGDY wielkie karty z opisem modułu** (`min-h-[...]`, padding, tytuł+opis). 2 grupy: „Dokumenty" / „W aplikacji". → `jak:` inspect sekcja „Co dalej" — sprawdź że nie ma wielkich kart, tylko małe pille. §7.3 / §7.3a
- [ ] 🔴 **Ikony+hue „Co dalej" zgodne z §7.3a:** Raport=slate/FileText, Deck=fuchsia/Presentation, Tabela=emerald/Table, Idea=amber/Lightbulb, Notatka=sky/StickyNote, Inicjatywa=indigo/Rocket. SSOT: `ArtifactActionPanel TARGET_META`. §7.3a
- [ ] Akcje (gdziekolwiek) = parytet z full view; destrukcyjne=confirm. §7.3

### J. Pełna karta + cross‑module
- [ ] „Open" otwiera pełną kartę (N‑mode), nie tylko preview; lista wraca przez „≡ List". §24
- [ ] Taby otwartych kart cross‑module w Menu 3; `×` zamyka. §24 / §15.3

### K. Kolory (formuła sygnałów)
- [ ] 🔴 Czerwień (`danger`) tylko realny alarm (overdue/error/blocked/rejected/delete). §4.0
- [ ] 🔴 Test ekranu: brak „biało‑czerwieni"; progres/neutralne daty/„w toku" nie są czerwone. §4.0
- [ ] Crimson (`accent`) tylko marka/CTA/selekcja, nie dane. §4.0
- [ ] Tony: neutral/info/success/warning/danger wg znaczenia. §4.0

### L. Stany
- [ ] Loading = spinner/skeleton, nigdy blank. §10
- [ ] Error = karta + retry; guard danych `(x||'').toLowerCase()`. §10
- [ ] Empty = 3 warianty (brak danych / brak dla filtra / brak wyników) + CTA; i18n. §10 / §22

### M. Grafika i layout (lock)
- [ ] Geometria kontrolek stała (h‑9 pille, h‑8 bulk, chipy `ChipBase`, ikony 12/14px). §19 / §4.2
- [ ] Powierzchnie/kolory wyłącznie tokeny `c.*`/zatwierdzone; 0 hex; brak rogue inline‑color. §19
- [ ] Układ stref w stałej kolejności; zgodność ze złotą referencją `assets/app-table-golden-reference-{dark,light}`. §19
- [ ] Parytet light/dark (kontrast, separatory). §21

### N. Dostępność i klawiatura
- [ ] ↑/↓/J/K nawigacja; Enter=full; Esc=zamknij; Space=select. §21
- [ ] ARIA: `aria-sort`, `aria-live` licznik selekcji, preview `role`/`aria-label`. §21
- [ ] Focus ring widoczny; focus‑trap w popoverze i preview‑modal (mobile). §21

### O. Sort / Filter / Resize / Persistencja
- [ ] 🔴 **FILTRY KOLUMN W OGÓLE ISTNIEJĄ** (A0) — każda sensowna kolumna ma `FilterDropdown` w nagłówku (ikona lejka). Brak ikon filtra na nagłówkach = blokujące. §5 → `jak:` klik nagłówek status/typ/priorytet → lista wartości do odfiltrowania.
- [ ] Sort: klik nagłówka + ikona kierunku (`ChevronUp/Down`); default per moduł persystowany. §5 / §22
- [ ] Filtry per kolumna multiselect (AND między kolumnami / OR wewnątrz); aktywne filtry jako chipy w Menu 3; stan persystowany. §5 / §22
- [ ] Resize zero‑sum z sąsiadem; szerokość tabeli stała; szerokości persystowane. §5

### P. Zabezpieczenia inżynierskie (RC)
- [ ] RC‑1 brak podwójnego scrolla · RC‑3 header/body z jednego źródła szerokości · RC‑4 brak `overflow-hidden` rodzica · RC‑5 brak surowego `<table>` · RC‑7 `colSpan` liczony · RC‑8 brak `max-w-[…]` ad‑hoc · RC‑9 brak opacity‑slash na tekście · RC‑10 brak sprzecznych/zdublowanych klas Tailwind. §20

### R. i18n
- [ ] PL/EN przez `useTranslation`, bez hardcode; truncacja+tooltip dla długich łańcuchów. §22

### T. Dark + light (na żywo, oba)
- [ ] Przełącz `colorScheme` dark/light → tabela czytelna w obu; separatory wierszy realne w dark, light nie „wyprany". §21 → `jak:` `preview_resize colorScheme`.
- [ ] Chipy/przyciski/kropki‑sygnały czytelne w obu trybach (kontrast tekst/tło AA). §4.2/§21
- [ ] Brak hardcodowanych kolorów łamiących dark (0 hex; tokeny `c.*`). §19

### U. Runtime / brak crashy (zachowanie)
- [ ] Otwórz zakładkę → ładuje się (zero spinner‑forever / 429 / „coś poszło nie tak"); console bez errorów. §10 → `jak:` `preview_console_logs level=error`.
- [ ] Scroll długiej listy: nagłówek sticky trzyma, brak podwójnego scrolla (RC‑1), brak desync header/body (RC‑3). §20
- [ ] Zaznacz/odznacz, otwórz/zamknij preview, otwórz kebab + submenu, otwórz popover kolumn — żadna akcja nie crashuje ani nie zostawia „ducha" (menu/tooltip nie znika). 
- [ ] Akcje (bulk/kebab/preview) realnie wołają endpointy i odświeżają listę (toast sukcesu), nie są atrapami. 

### S. Bramki + dowód
- [ ] FE `tsc`=0 · BE `esbuild`=0 · eslint 0 błędów (warnings repo‑wide OK).
- [ ] Świeżość serwowanego kodu potwierdzona (stale‑cache Vite na dużych plikach). 
- [ ] Dowód wizualny: screenshot przed/po + zrzut DOM (nagłówki, lista itemów kebaba/bulk) + computed‑style krytycznych (kolor progresu, sticky, wyrównanie, popover w viewport).
- [ ] Raport `PASS/FAIL/N-A` per punkt; każdy `N/A` uzasadniony (np. „demo Inbox pusty / ADMIN bez canAssign — zweryfikowane na OWNER").

---

## 27a) Light mode — kontrast chipów i Menu 3 (MUST)

Kanon tabel był pierwotnie tonowany pod DARK; w LIGHT tony bywały zbyt blade.
Poniższe reguły kodyfikują wzmocnienie kontrastu w trybie jasnym. DARK pozostaje
bez zmian — nigdy nie modyfikuj wariantów `dark:` ani wartości `.dark { … }`.

### Tokeny `c.*` (light `:root` w `src/index.css`)
- `--c-border` musi być widoczny na białym tle chipa/wiersza — wartość
  `#cbd2da` (nie blade `#e2e5e9`). Obrys chipa na `bg-c-surface(-raised)` MUST być
  dostrzegalny.
- `--c-surface-raised` ma lekki tint (`#f8fafc`), aby chip odróżniał się od białego
  wiersza (`--c-surface` = `#ffffff`).
- `--c-border-subtle` = `#e6e9ed` (hairline nadal subtelny, ale nie „wyprany").
- Tony sygnałów (`--c-success/warning/danger/info`) i tagi (`--c-tag-*`) — bez zmian
  (już AA na białym; patrz §4.0).

### Menu 3 — chipy nawigacyjne (`ModuleMenu3.tsx`)
- INACTIVE (light): `border-slate-300 bg-slate-100 text-slate-700`,
  hover `bg-slate-200 text-slate-900`. Czytelny obrys i tekst (nie `slate-200/60` +
  `slate-600`).
- ACTIVE (light): JEDEN kolor PRIMARY — `border-primary-500/60 bg-primary-500/15
  text-primary-800` + inset `rgba(168,85,247,0.18)`. Mocniejszy fill i ciemniejszy
  tekst niż dawne `/40 + /10 + text-primary-700`.
- BADGE counters (light): INACTIVE `bg-slate-300 text-slate-700`;
  ACTIVE `bg-primary-500/25 text-primary-800` — czytelne liczniki.

### Menu 3 — przyciski AI (`ModuleHub/menu3ActionButtonStyles.ts`) — unifikacja
- Przyciski AI dzielą TĘ SAMĄ skorupę i JEDEN kolor active co chipy nawigacyjne
  (PRIMARY), nie własny BLUE. Active = `bg-primary-500/15 text-primary-800
  border-primary-500/60` + ten sam inset; INACTIVE = skorupa jak `MENU_3_CHIP_INACTIVE`.
- Ikony zachowują swoje zróżnicowane kolory — standaryzujemy tylko skorupę przycisku,
  nie kolor ikon.

### Reguła ogólna
Naprawiaj kontrast w WARSTWIE WSPÓLNEJ (tokeny `c.*`, `ChipBase`, klasy Menu 3),
nie per‑konsument — wtedy wszystkie tabele poprawiają się naraz. Każda zmiana light
MUST mieć zachowany odpowiednik `dark:` (lub brak zmiany w dark).

---

## 28) Related sources
- `docs/ui-standards/03-modules/app-table-standard.md` (szczegóły anatomii)
- `docs/ui-standards/03-modules/table-preview-pane-standard.md` (preview)
- `docs/ui-standards/03-modules/view-modes-standard.md` (widoki)
- `docs/ui-standards/03-modules/golden-standard-table-cards-preview-v3.md` (v3 unified)
- `docs/ui-standards/03-modules/module-hub-standard.md` (Menu 2/3)
- `docs/design-system/TABLES.md` (design‑system enforcement)
- `docs/audit/2026-06-03/TABLE_GRAPHICS_ROOTCAUSE.md` (root‑cause bugów graficznych)
- `docs/audit/2026-06-05/_IV_VISUAL_TABLE_PATTERN.md` (audyt 5 ręcznych tabel Interview)
- Komponenty SSOT: `src/components/shared/TableWithPreviewLayout.tsx`, `src/components/shared/ModuleHub/{FilterableTable,GridView,TableSettingsPopover}.tsx`, `src/components/ui/primitives/chips/*` (rodzina chipów `c.*`), `src/components/ui/primitives/cells/{ProgressCell,AssigneeCell}.tsx`, `src/components/ui/ResizableTable/{index,TableHeader,PreviewPaneShell}.tsx`
- Tokeny: `src/index.css` (`--c-*`) + `tailwind.config.js` (namespace `c`)
- Legacy (migracja): `src/components/shared/StatusPill.tsx`, `src/constants/statusColors.ts`
