# UI/UX Canon v3 (Consultinity MVP) — SSOT

> **Status:** Draft (v3)  
> **Cel:** Spisać w jednym miejscu **wszystkie kanoniczne decyzje UI/UX v3**, wynikające z feedbacku i “Phase 3” MVP.  
> Ten dokument nie zastępuje szczegółowych standardów — on je **konsoliduje** i wskazuje SSOT.

---

## 0) Zasady nadrzędne (MUST)

- **SSOT over vibes**: jeśli standard istnieje w `docs/ui-standards/` — jest prawem.
- **Chrome monochromatyczny (DBR77)**: kolor jest sygnałem danych/artefaktów, nie dekoracją nawigacji.
- **Kontrast > estetyka** w light mode: czytelność zawsze wygrywa.
- **Globalne tokeny zamiast ad-hoc** (rounding, warstwy tła, semantyka badge).

---

## 1) Light mode readability (MUST)

Problem v2: “za biało” + zbyt jasne teksty/chipsy = spadek czytelności.

Kanon v3:

- **Layer 1 (base)**: `bg-slate-50` (nie `bg-white`)
- **Layer 2 (elevated)**: `bg-white`
- Tekst główny w light mode: `text-slate-900` / `text-navy-900`
- Zakaz: “jasne tło semantyczne + jasny tekst tego samego koloru” (badge/chips)

SSOT: `docs/ui-standards/00-foundation/visual-language.md`

---

## 2) Rounding system (MUST)

Chcemy móc “podkręcać okrągłości” systemowo (Apple/Google style) bez ręcznej migracji setek klas.

Kanon v3:

- używać `rounded-hig-*` tokenów (globalnie sterowane w `tailwind.config.js`)
- nie wprowadzać nowych `rounded-lg/xl/...` w świeżym kodzie

SSOT: `docs/ui-standards/00-foundation/visual-language.md`

---

## 3) Artifact identity (ikona + akcent) (MUST)

Każdy artefakt ma:

- 1 kanoniczną ikonę
- 1 kanoniczny kolor akcentu

Zasady:

- chrome (sidebar/topbar): monochromatyczne ikony (akcent tylko w data surfaces)
- akcent w tabelach/kartach/kanban: dot, border, mini marker, ikona — nie “kolorowe tła w menu”

SSOT: `docs/ui-standards/00-foundation/artifact-identity-map.md`

---

## 4) Breadcrumbs (MUST)

Sprzątamy “Dashboard / My Work” i podobne hybrydy.

Kanon v3:

- `Module > Surface/Tool`
- brak dodatkowego “wielkiego tytułu” — breadcrumbs są wystarczające

SSOT: `docs/ui-standards/03-modules/module-hub-standard.md`

---

## 5) Dwa topbary: App vs Module (MUST)

### 5.1 App Topbar (globalny, stały)

- prawa strona (stała kolejność): **Data → Model → Inbox → Tasks(Today) → User**
- brak globalnego przycisku “AI toggle”
- Notifications scalone do Inbox

SSOT: `docs/ui-standards/01-shell-layout/app-topbar-standard-v3.md`

### 5.2 Module Topbar (kontekstowy)

Kolejność elementów (prawa strona):

**AI context → +New → View modes → Filters**

SSOT: `docs/ui-standards/03-modules/module-hub-standard.md`

---

## 6) Kanoniczny “AI w kontekście” (MUST)

Jeden, stały przycisk w topbarze modułu:

- steruje split chat (open/close)
- chat ma znać kontekst ekranu i artefaktu

SSOT (koncepcja): `docs/ui-standards/00-foundation/artifact-identity-map.md`  
SSOT (layout): `docs/ui-standards/03-modules/module-hub-standard.md`  
SSOT (hook w kodzie): `src/hooks/useOpenChatWithContext.ts`

---

## 7) Table + Preview Pane (MUST)

Kanon “Outlook style”:

- preview jest częścią surface’u tabeli (nie “border-l widget”)
- szerokość: 20–33% (min ~340px)
- rounded card + warstwy tła spójne z tabelą
- wspólny shell: `PreviewPaneShell`

SSOT: `docs/ui-standards/03-modules/table-preview-pane-standard.md`

---

## 8) Workspace “3‑tools strip” (MUST)

Jeden, stały pasek 3 przycisków dla workspace’ów:

1. **Tools** — narzędzia pracy w danym narzędziu
2. **Context/Links** — sugestie powiązań z platformy
3. **AI Suggestions** — “topics to analyze” + send-to-chat + insert

SSOT: `docs/ui-standards/02-components/workspace-3-tools-strip.md`

---

## 9) Inbox jako Action Queue (MUST)

Inbox to miejsce, gdzie spływa wszystko wymagające akcji (system/AI/sync/artefakty) i ma standard:

- tabela + preview pane (Outlook style)
- filtry (All/Read/Unread itp.) jako część Module Topbar

SSOT: `docs/ui-standards/03-modules/table-preview-pane-standard.md`

---

## 10) Jeden “Command Row” zamiast wielu pasków (MUST)

Problem: w wielu ekranach historycznie pojawiały się 2–3 dodatkowe rzędy (mini toolbary, hinty, “help stripy”, liczniki), które:
- budują chaos
- zabierają wysokość tabeli
- łamią rytm aplikacji (każdy moduł inaczej)

Kanon v3:

- Pod Module Topbar zawsze istnieje **jeden** stały rząd, który pełni 1 z 3 ról:
  1) **Dynamic tabs row** (otwarte dokumenty)
  2) **Search row** (expandable search)
  3) **Context counters row** (chipsy “na twarz”: Krytyczne, Spóźnione, Wymaga akcji…)
- Klik w counter chip **ustawia filtr** w kolekcji (stan aktywny)
- W żadnym module nie wolno dokładać dodatkowych rzędów między topbarem a tabelą

SSOT: `docs/ui-standards/03-modules/module-hub-standard.md`

---

## 11) App Table — “jedna tabela w całej aplikacji” (MUST)

Kanon v3: wszystkie huby tabelaryczne (MyWork, Interviews, Admin, Results…) muszą spełniać App Table Standard.

Najczęstsze błędy, które w v3 traktujemy jako **bug UI**:

- brak filtrów w nagłówkach kolumn (dla pól, które mają służyć do filtrowania)
- brak resizable columns
- brak Actions column z kebab (⋮) po prawej
- “podwójne, grube separatory” resizerów zamiast jednej subtelnej linii
- duplikowanie treści w wierszu jako “druga linia pod tytułem”
- ad-hoc bannery/stripy/hinty między topbarem a tabelą
- duplikacja kontrolek (`Columns/Views/Smart sort`) mimo istnienia Module Topbar

SSOT: `docs/ui-standards/03-modules/app-table-standard.md`

---

## 12) View modes — stała kolejność i brak “custom kolejek” (MUST)

Kanon v3: view modes to zamknięta lista i stała kolejność ikon (pokazujemy tylko dostępne, ale kolejność nie może się zmieniać).

- `table` → `kanban` → `timeline` → `calendar` → `matrix` → `grid`
- “Queue / review-next” nie jest view mode. Jeśli istnieje, to osobny flow (przycisk/tryb pracy), a nie ikonka w przełączniku.

SSOT: `docs/ui-standards/03-modules/view-modes-standard.md`

---

## 13) Buttons — 3 poziomy + “rounded/pill everywhere” (MUST)

Kanon v3 przycisków:

- **Poziom A (Pill / Outline + Surface)**: główne przełączniki surface’ów (tabs), ważne liczniki/chipsy, selektory w topbarze
- **Poziom B (Pill / Soft)**: drugorzędne akcje widoczne, ale nie dominujące (view modes, quick tools)
- **Poziom C (Ghost/Text)**: lekkie akcje (menu, “więcej…”, akcje per-wiersz)

Zasady zastosowania (krytyczne dla spójności):

- Główne taby modułów (np. `Executive / Inbox / Focus / Zadania / Decyzje / Notatki / Pomysły`) mają być **pill** (rounded-full) zgodnie z Poziomem A.
- Kontrolki w App Topbar (np. Data/Model) i w Module Topbar mają trzymać ten sam rytm (`h-9`) i ten sam język rounded.
- Na jednym topbarze nie mieszamy >2 poziomów przycisków naraz.

SSOT: `docs/ui-standards/00-foundation/visual-language.md` (sekcja 8.3)

---

## 14) “AI w kontekście” — ma być widoczny, ale nie tandetny (MUST)

Problem: przycisk AI bywa “generyczny” i ginie w chrome.

Kanon v3:

- AI context jest **jednym z kluczowych** elementów Module Topbar i musi być czytelny “na pierwszy rzut oka”.
- Jednocześnie nie może konkurować z Primary CTA (na ekranie nadal max 1 “kolorowy” element jako CTA).

Kontrakt wizualny (v3):

- styl bazowy: **IKONA-ONLY** (bez label) w stylu **Poziom A (Pill / Outline + Surface)** + wyraźna ikona (outline, mono-weight)
- stan aktywny (chat open): wyraźny “selected” (subtelne tło + 1px accent), bez krzykliwych gradientów
- **MUST:** w spoczynku ma “wpadać w oczy” — testujemy mocniejszy, ale nadal premium akcent (np. wyższy kontrast obrysu/ikonki, subtelny glow tylko na hover/active)

SSOT (kolejność i miejsce): `docs/ui-standards/03-modules/module-hub-standard.md`  
SSOT (tokeny i ograniczenia kolorów): `docs/ui-standards/00-foundation/visual-language.md`

---

## 15) Preview pane — default OFF + parity akcji + responsywność (MUST)

Kanon v3 dla preview:

- preview domyślnie zamknięty; otwiera się po selection (klik w wiersz)
- ma `X` do zamknięcia i odzyskania szerokości tabeli
- przy otwartym czacie/railach preview zwęża się szybciej niż tabela (clamp)
- **parity akcji**: quick actions w preview = te same akcje co w pełnym widoku (np. Decision: Approve/Reject/Delegate/Request info)

SSOT: `docs/ui-standards/03-modules/table-preview-pane-standard.md`

---

## 16) Kanban — drag&drop + uprawnienia + kolejność (MUST)

Kanon v3:

- Jeśli board ma drag&drop, musi respektować uprawnienia:
  - “editable” vs “read-only” rozróżnione subtelnie (border/surface)
  - próba drag bez uprawnień ⇒ natychmiastowy toast/snackbar z komunikatem
- Reorder w obrębie kolumny:
  - **Tasks/Focus**: zawsze dozwolony
  - **Inicjatywy**: może być ograniczony governance (locked)

SSOT: `docs/ui-standards/03-modules/view-modes-standard.md` (sekcja Kanban)

---

## 17) Timeline (Gantt) — zoom + filtry multi + preview (MUST)

Kanon v3 timeline:

- zoom/agregacja: `day / week / month / quarter` (w Module Topbar, nie w osobnym pasku)
- filtry priorytetów: **multiselect**
- lewa kolumna “task list”: tytuł + minimalne sygnały
- selection otwiera preview (nie pełny detail), “Open full” dostępne

Wymóg produktu: timeline ma dotyczyć **Tasks** i analogicznie **Decisions** (zbliżony model pracy: terminy, priorytety, triage).

SSOT: `docs/ui-standards/03-modules/view-modes-standard.md` (sekcja Timeline)

---

## 18) MyWork Focus — “lekki cockpit”, nie feed (MUST)

Kanon v3 Focus:

- brak centralnego AI Coach feed
- układ: **My list (quick capture) + Today + This Week** (Later nie jako primary)
- drag&drop między kolumnami + quick add task
- preview pane + 3-tools strip jako **opcjonalne** panele (nie dusić lane’ów)

SSOT: `docs/MYWORK_MODULE_SPECIFICATION.md` (sekcja Focus)

---

## 19) Pomysły (Ideas) — canvas tool selector (MUST)

W module “Pomysły” przełącznik w prawym górnym rogu (np. “Mind Map”) jest **wyborem narzędzia canvasa**, a nie view-mode kolekcji.

Docelowe narzędzia: Mind Map / Process Flow / Table / Whiteboard.

**MUST:** narzędzia korzystają ze wspólnego rdzenia danych (core model) — przełączanie nie gubi treści.
Core: `IdeaWorkspaceGraph` (nodes/edges + namespaced `extensions`) + per-tool view state.

**MUST (quality parity):**
- **Process Flow** ma **swimlanes** jako element bazowy (R1) — odpowiedzialność/rola/faza jest częścią modelu pracy, nie dodatkiem “kiedyś”.
- **Table** jest **uniwersalna i dopasowywalna** (R1): kolumny i widoki są konfigurowalne oraz wspierane przez **generatory** (AI/heurystyki).
- AI działa w trybie **propose → accept** (zmiany jako propozycje), w tym generatory: lanes/flow (Process Flow) oraz columns/views/enrichment (Table).

SSOT: `docs/MYWORK_MODULE_SPECIFICATION.md` (sekcja Ideas)

---

## 20) Executive dashboards — czytelność nad “pustą przestrzeń” (MUST)

W ekranach analytics (Executive) nie wolno łączyć:
dużo wolnej przestrzeni + mikro typografia + słabe granice sekcji.

Kanon v3:

- etykiety/treść UI min `text-sm` (13–14px)
- KPI/value w skali headline (`text-xl`–`text-2xl`)
- tile padding 12–16px
- framing przez warstwy tła + nagłówki sekcji
- (SHOULD) Density toggle: Compact/Comfortable w menu “View”

SSOT: `docs/ui-standards/00-foundation/visual-language.md` (sekcja 6.1)  
SSOT (Executive): `docs/MYWORK_MODULE_SPECIFICATION.md` (sekcja Executive)

---

## 21) “Compliance sweep” — wszystko, co odstaje traktujemy jako backlog v3 (MUST)

Kanon v3 zakłada, że:

- jeśli ekran jest “hubem tabelarycznym” i nie spełnia App Table Standard → to jest do poprawy (nie “estetyczna preferencja”)
- jeśli moduł ma 2–3 rzędy kontrolkowe między topbarem a tabelą → to jest do redukcji do Command Row

Najbliższe przykłady z feedbacku:

- **Interviews**: Inbox/Sessions/Assigned/Templates/Insights → pełna adopcja App Table Standard + porządek topbara + preview dla Insights

SSOT: `docs/INTERVIEW_MODULE.md` (sekcja UI compliance v3)

