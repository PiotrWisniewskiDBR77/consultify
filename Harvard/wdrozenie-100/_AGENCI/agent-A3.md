# ZLECENIE — Agent A3 · Klaster: Initiatives + Execution + Meeting
**Wznów:** [`_PROTOKOL.md`](_PROTOKOL.md) → to zlecenie → [`_STATUS.md`](_STATUS.md) → spec.
**Branch/worktree:** `reskin/A3/wave-<n>`

## Własność wyłączna (pliki)
`src/components/Initiatives/**` · `src/components/Execution/**` · `src/components/Portfolio/**` · `src/components/Meeting/**`

## Zadania per fala
- **Fala 1 (Listy §14):** Initiatives lista/Portfolio · Reports lista · Sessions lista · Meeting lista → Parity Gate §14.7.
- **Fala 2 (Artefakty §11.2+§13):** Initiative (C-L, ~10 zakładek) · Task/RAID/Milestone/StageGate/RACI/ChangeRequest (C-S drawer, embedded) · Report PMO (B). Zakładki Initiative wg §13.1 (bazowa: Przegląd·Powiązania·Aktywność + delty).
- **Fala 3 (Instrumenty §15):** Portfolio Kanban/Timeline/Matrix · RoadmapGantt · Execution Plan (gantt+tabela) · capacity/workload table · RACI grid.
- **Fala 5 (Light).**

## Znane bugi (z walkthrough)
- M13 różne kolory czcionki między widokami (→ tylko c.text/-secondary/-muted) · multi-select (A-1) · preview niestandardowe (A-5) · **Report Builder wygląda dobrze ale ZŁE miejsce — oznacz do przeniesienia do Materiały (koordynuj z A5)** · preview inicjatywy otwiera panel boczny zamiast pełnej strony.

## RAPORTY
<!-- Fala X · ekran · pliki · DoD · pominięte -->

### RAPORT — Fala 1 (Listy §14) · 2026-07-02 · branch `reskin/A3/wave-1` (rebased na feat/deliverables-w1)
**Zakres wykonany (11 plików, 10 commitów, wyłącznie klasy CSS + drobne semantyki kolorów):**

| Ekran | Pliki | Co zrobione |
|---|---|---|
| Portfolio list view | `Portfolio/PortfolioListView.tsx` | tekst→3 role c.*; checkbox multi-select crimson→`text-c-info`+`focus:ring-c-focus` (SYS-1 neutral/blue); nagłówek/empty/meta→muted |
| Initiatives lista (Hub) | `Initiatives/InitiativesHub.tsx` | bulk c.*; scope toggle Active/All: active `bg-c-surface text-c-text` (było crimson text+crimson focus ring); level „Strategic" crimson→violet (kategoria≠crimson); ikona Analysis `Users` crimson→secondary; ROI/Materialize przyciski → neutral ghost; **FIX realny bug: primary button light miał `text-slate-900` na `bg-navy-900` = niewidoczny tekst → `text-white`** (3 miejsca) |
| Execution ProblemTable | `Execution/Manager/ProblemTable.tsx` | c.*; TypeBadge unassigned/no_owner crimson→subtle-blue (tier §9.2④); search focus ring crimson→`ring-c-focus`; chipy severity → pill h-7 + `border-c-border` (fix A-3) |
| Execution ProblemPreview | `Execution/Manager/ProblemPreview.tsx` | pełna migracja c.* (tekst/bordery/surface) |
| Execution Management (kafle lanes) | `Execution/ExecutionManagementView.tsx` | c.*; hover karty crimson→`border-c-border-strong`; ikona Workload crimson→secondary (Menu 3 już był z `ModuleMenu3` importów) |
| Execution ManagerModuleView | `Execution/ManagerModuleView.tsx` | tło/bordery→c.* |
| ExecutionHub (Reports lista + chrome) | `Execution/ExecutionHub.tsx` | bulk c.* (120 linii); licznik overdue crimson→`text-c-warning`; ikony KPI/report-def crimson→secondary; progress track→`bg-c-border-subtle`; avatar→c.* |
| Meeting lista | `Meeting/MeetingHub.tsx` | bulk c.*; inputy `border-c-border`; kalendarz grid→`c-border-subtle`/`c-bg`; Sparkles crimson→secondary; segmenty/pills→tokeny |
| Portfolio grid (alt widok listy) | `Portfolio/PortfolioGridView.tsx` + `Portfolio/InitiativeGridCard.tsx` | c.*; hover karty crimson→border-strong; avatar crimson→raised; **progress bar gradient crimson→`bg-c-info`** (progress nigdy crimson §14.2) |

**Bug M13 „różne kolory czcionki":** wszystkie zwykłe teksty w ww. listach sprowadzone do `text-c-text` / `text-c-text-secondary` / `text-c-text-muted`. Kolor został WYŁĄCZNIE na: statusach (EntityStatusChip/tiery §9.2④), danger/amber liczbach semantycznych, chipach eventów kalendarza (completed=emerald/scheduled=sky — semantyczne).

**Świadomie ZOSTAWIONE (sanctioned/inna fala) — nie ruszać bez decyzji:**
- Primary button wzorzec `bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950` (+`dark:hover:bg-[#DDE5EF]`) — zgodny ze spec §9.2① — wystąpienia: MeetingHub (7×), InitiativesHub (4×), kalendarz „dziś" marker. Hex w dark CTA = wzorzec, zalogowane.
- Neutral badge tier `bg-slate-100 dark:bg-navy-800 text-slate-600` — dokładnie wg §9.2④ neutral (ProblemTable TypeBadge fallback/SourceChip, ExecutionHub countery, InitiativesHub COMING_SOON).
- Hover/selected wiersza `bg-slate-50/70 dark:bg-white/[0.03]` + `selectionTokens.ts` — dokładnie wg §14.2.
- Translucent surfaces `bg-white/70..80 dark:bg-navy-900/50..70 backdrop-blur` (PortfolioListView kontener+thead, MeetingHub karty, ExecutionHub kolumny) — brak odpowiednika alpha w tokenach var(); do decyzji Fundamentu (tokeny nie mają `<alpha-value>` → modyfikatory `/70` na `c-*` nie działają).
- Kanban DnD w ExecutionHub (drop-zone `border-primary-500/50`, DragOverlay `border-primary-500`) — instrument, Fala 3.
- Overlay modali `bg-slate-950/50` — scrim, celowe.

**Luki / TODO (diagnozy):**
1. **Multi-select (A-1):** `FilterableTable` ma pełne `selection` API, ale wiring wymaga bulk-bar Menu 3 F2 z realnymi akcjami („nigdy sam N selected") — dla Meeting lista i Reports lista brak backendu bulk (delete/archive per-row single). NIE trywialne → odroczone z diagnozą: dodać stan `selectedIds` + `selection` prop + pasek F2 z Export CSV/Delete gdy będą handlery bulk. PortfolioListView MA własny multi-select (hand-rolled, działa, teraz neutral/blue).
2. **PortfolioListView = hand-rolled `<table>`** — oznaczona w kodzie `§27-todo` migracja do FilterableTable (nie przepisywana w tej fali — to redesign, nie re-skin).
3. **„Execution Workstreams" NIE ISTNIEJE jako UI** — w `ExecutionHub.tsx` tylko stub payloadu (`workstreams: { items: [] }`, linie ~475/916). Nic do re-skinu; wymaga decyzji produktowej czy budować.
4. **„Sessions lista" nie znaleziona w moim klastrze** (Initiatives/Execution/Portfolio/Meeting) — prawdopodobnie klaster innego agenta (Interview/Tools?). Do wyjaśnienia ze Strategiem.
5. **„Initiatives Library" brak dedykowanego ekranu** — są `templates/` + Wizard; jeżeli Library=galeria szablonów, to artefakt Fali 2.
6. **Report Builder — NIE ruszany** (zgodnie ze zleceniem); stoi, do przeniesienia do Materiały (koordynacja z A5).
7. **`shared/ModuleMenu3.tsx` MENU_3_CHIP_ACTIVE/MENU_2_TAB_ACTIVE używa `primary-*` (crimson)** na active chip/tab — sprzeczne ze spec §9.2② („active: NIE crimson text"). Plik shared = poza moim klastrem → do Fundamentu.
8. **`shared/ModuleHub/FilterableTable.tsx:566` checkbox `text-primary-500 focus:ring-primary-500`** — crimson na selection w SHARED (SYS-1 violation) → do Fundamentu.
9. Parity Gate §14.7 dla Reports lista (ExecutionHub) — FilterableTable+preview+kebab OK; brakuje bulk bar (pkt 1) i część kebabów disabled („Wkrótce backend") — stan istniejący, nie regres.

**Weryfikacja:** brak `node_modules` w worktree (zero npm wg zlecenia) → grep sanity: wszystkie użyte klasy `c-*` zmapowane 1:1 na tokeny z `tailwind.config.js`; 0 literówek; 0 markerów konfliktu po rebase. Build vite NIE odpalony — wymagane przed merge (Strateg).
**Commity:** `be7d3c92b7`→`86c534f510` (10), per ścieżka, bez `-A`.

---

### RAPORT — Fala 2 (Artefakty §11.2+§13) · 2026-07-02 · branch `reskin/A3/wave-2` (baza z `reskin/A3/wave-1` = Fala 0+1)

**Metoda:** mechaniczny token-sweep (skrypt Python, per-linia, `light dark:` collapse → jeden token `c-*` bo var() sam obsługuje dark) + ręczne dopięcie crimson-removal i przypadków semantycznych. TYLKO klasy CSS — dla każdego pliku zweryfikowane, że liczba linii dodanych == usuniętych (zero zmian JSX/logiki) i zero linii diffa bez tokenu klasy.

**Uwaga o ścieżce:** zlecenie wskazywało `src/components/InitiativeDetailModal.tsx` — TAKI PLIK NIE ISTNIEJE. Kanoniczny pełny artefakt Initiative (C-L, ~10 zakładek) to **`src/components/Initiatives/InitiativeDocumentView.tsx`** (10 550 linii, `index.ts` „canonical full view", live w M13/Results/Execution hubach). Preview pane §13 = `InitiativePreviewV3.tsx`. Oba w moim klastrze.

**Zakres wykonany (10 plików, 7 commitów `76756c5871`→`815ddc3a59`):**

| Artefakt | Plik | Co zrobione |
|---|---|---|
| Task card (C-S, embedded) | `TaskCard.tsx` | tekst 3 role; surface; status border neutral (todo/cancelled slate→`c-border-strong`/`c-text-*`); progress track→`c-border-subtle`; fix malformed `bg-navy-800/300/10` |
| Task board (Kanban lekki) | `InitiativeTaskBoard.tsx` | tekst/surface/border/hover-text/divider→c.*; primary CTA (navy) + translucent lanes zostawione |
| Task tab (lista C-S) | `InitiativeTasksTab.tsx` | tekst/surface/hover; crimson-removal (spinner+weight badge→`c-info`; TODO dot + status bar neutral→`c-border-strong`) |
| Task drawer (C-S, `⑯`) | `TaskDetailModal.tsx` | tekst/surface/border/placeholder/hover; crimson-removal (AI-Insight panel + Task-Weight panel + focus ring→`c-info`/neutral/blue focus); **fix realny bug: ikona na `bg-blue-600` chipie miała `text-slate-900` (mangled→`c-text`=ciemny na niebieskim) → `text-white`**; scrim + selected-navy toggle sanctioned |
| Preview pane (`⑬` §13) | `Initiatives/InitiativePreviewV3.tsx` | tekst/surface/border/hover; crimson-removal (insight-lineage panel + link-ikony→`c-info`/neutral); pille neutral |
| **Artefakt Initiative (C-L, ~10 zakładek)** | `Initiatives/InitiativeDocumentView.tsx` | **654→38 leftover.** tekst 3 role; surface/border/placeholder/hover; collapse par translucent-border→`c-border`; **crimson-removal 23→0**: focus→`c-focus-solid` (blue), AI-proposal/source/link chip + activity-event category→`c-info`/neutral (kategorie/dane nigdy crimson §11.3); status/priority dots + neutral badge→`c-border-strong`/`surface-raised`; hero gradient→`bg-c-bg`. 254 linii zmienionych = 254 dodanych |
| Sekcja Przegląd | `Initiatives/sections/OverviewSection.tsx` | tekst/input/focus/AI-btn→c.* (0 leftover) |
| Sekcja Definicja | `Initiatives/sections/ProblemDefinitionSection.tsx` | tekst/inputy/AI-btny→c.* (0 leftover) |
| Sekcja Cel (Target State) | `Initiatives/sections/TargetStateSection.tsx` | tekst/inputy/karty/AI-proposal→c.*; translucent bg-white/navy zostawione |
| Sekcja Zespół | `Initiatives/sections/TeamSection.tsx` | tekst/surface; crimson→primary icon-gradient→`surface-raised` (0 leftover) |

**Crimson-removal (najważniejsze — filar re-skinu):** WSZYSTKIE `primary-*` (=crimson w tailwind) usunięte z artefaktu Initiative i rodziny Task. Zasada zastosowana: focus ring→`c-focus-solid` (niebieski), kategorie/dane/AI-akcje→`c-info` lub neutral (`surface-raised`/`border`), NIGDY crimson na status/fokus/dana (§9.1/§11.3). AI-sloty (sparkles) zneutralizowane do `c-info` — jeśli Piotr chce brand-crimson na AI-moment to świadoma decyzja do zgłoszenia, nie leak.

**Świadomie ZOSTAWIONE (sanctioned / inna fala) — nie ruszać bez decyzji:**
- **Translucent surfaces** `bg-white/60..95 dark:bg-navy-900/xx (+backdrop-blur)` — DOMINUJĄCY leftover (InitiativeDocumentView ~34, TargetState ~11, PreviewV3 1). Tokeny `c-*` = `var()` bez `<alpha-value>` → modyfikator `/70` nie działa. **Blokada Fundamentu** (identyczna z Fali 1). Bordery translucent DAŁO SIĘ scalić (→`c-border`, bo krawędź czyta się dobrze).
- **Primary CTA / selected-toggle** `bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950` — zgodny ze spec §9.2① (2× w InitiativeDocumentView weight-toggle, 1× InitiativeTaskBoard generate, TaskDetailModal weight-toggle). Hex w dark CTA = wzorzec, zalogowane.
- **Overlay scrim** `bg-slate-900/50 backdrop-blur` (TaskDetailModal modal) — scrim, celowe.
- **Hex** `#ffffff`/`#0f172a`/`#e2e8f0` (InitiativeDocumentView linie 10498-10518) — blok `#initiative-export-printable` (off-screen, PDF/print = zawsze light) — sanctioned, nie powierzchnia UI.
- **Broken class strings ze spacjami** `px - 3 py - 1.5` (InitiativeTasksTab AI-btn, ~L192) — PRE-EXISTING korupcja (dead classes), nie moja, nie w zakresie re-skinu — zalogowane.

**DEFER (wg zlecenia — Fala 3 Instrumenty / inne):**
- **RAID/Gate/RACI głębokie widżety governance** = Fala 3: `GateReadinessSection` (294 taint), `InitiativeGatesWorkflowTable` (155), `RaciEscalationSection`, `InitiativeStatusPipeline` (39).
- **Kanban/Gantt/Timeline** = Fala 3: `TimelinePlanner` (626), `TimelineSection` (319), `ResourcesSection` (314), `DependenciesSection` (106).
- **Sekcje detalu jeszcze nietknięte** (budżet ~10 plików wyczerpany): `TasksMilestonesSection` (207), `DecisionsSection` (188 — decision drawer C-S, kandydat Fala 2 kontynuacja), `KpisSection` (129), `InitiativeTeamComposerModal` (173), `ScopeSection`/`ControlSection`/`PilotSection`/`FinancialImpactSection`/`FinancialAnalysisSection`/`SkillsGapSection`/`CompetencyRequirementsSection` (małe, do domknięcia w kontynuacji Fali 2). `StakeholdersSection`/`RemindersSection`/`RaciEscalationSection`/`AttachmentsSection` = 0 taint (już czyste).
- **Report Builder (PMO ReportEditor)** — NIE ruszany: (1) `src/components/ReportBuilder/**` poza moim klastrem wyłącznym; (2) oznaczony do przeniesienia do Materiały (koordynacja A5). Zgodnie ze zleceniem.

**Weryfikacja:** brak `node_modules` w worktree (zero npm) → sanity: (a) wszystkie 12 użytych klas `c-*` zmapowane 1:1 na `tailwind.config.js` (0 nieznanych); (b) 0 markerów konfliktu; (c) każdy plik: `git diff --numstat` add==del (czysty class-swap); (d) 0 duplikatów tokenów po scaleniu par; (e) wszystkie zmiany w klastrze (Initiatives/ + root Task*/InitiativeTask* wg zlecenia). Build vite + screenshoty light/dark — wymagane przed merge (Strateg; worktree bez preview).
**Commity:** `76756c5871`→`815ddc3a59` (7 fix, per ścieżka, bez `-A`).

---

### RAPORT — Fala 3 (Instrumenty §15) · 2026-07-02 · branch `reskin/A3/wave-3` (baza z `reskin/A3/wave-2`)

**Metoda:** dla instrumentów małych/średnich — ręczny per-element chrome-swap; dla dużych governance (Timeline/Resources/Gate) — mechaniczny **alpha-safe** token-sweep (Python, negative-lookahead `(?![/\w-])` żeby NIE dotykać translucentnych `.../NN`), collapse par `light dark:`→`c-*`, potem crimson-removal ręczny. Doktryna §15.1: cicha rama (chrome→`c.*` neutralne), głośne dane (status/RAID/oś/priorytet/severity = zostają semantyczne). **Crimson nigdy jako dana/status/fokus.** Linia „dziś"→`c-accent` (§15.2/§15.4). Zaznaczenie/linking→`c-accent-soft` (§15.3). Fokus→`c-focus`. Konektory/arrowheady SVG: hex→`var(--c-*)` (normal=`--c-border-strong`, warning=`--c-warning`, critical=`--c-danger`).

**Zakres wykonany (11 plików, 12 commitów `b03f0f773d`→`f30cac283e`, wyłącznie klasy CSS; każdy plik `git diff --numstat` add==del = czysty class-swap, zero zmian JSX/logiki):**

| Instrument | Plik | Co zrobione |
|---|---|---|
| Portfolio Kanban | `Portfolio/PortfolioKanbanView.tsx` | karty/kolumny/nagłówki/licznik/owner/next-gate→`c.*`; drop-zone crimson ring→`c-focus` (priorytet/status/health dot = dane) |
| Portfolio Timeline (Gantt) | `Portfolio/PortfolioTimelineView.tsx` | kontrolki/zoom/osie/grid/wiersze/legenda/tooltip→`c.*`; linia+dot „dziś" danger→`c-accent`; zoom-toggle crimson→neutral; progress overlay crimson→neutral (`bg-black/10 dark:bg-white/10`) |
| Portfolio Matrix | `Portfolio/PortfolioMatrixView.tsx` | kontener/osie/linie/legenda/filtry→`c.*`; bubble fill crimson→`c-focus-solid`/`c-info`; tooltip navy→`c-surface` (fill-/stroke-c-*); **DEFER: `MATRIX_QUADRANT_COLORS` = dane kwadrantów (impact/effort)** |
| Roadmap Kanban | `RoadmapKanban.tsx` | karty/kolumny/kwartały/nagłówki/placeholder/drag-overlay navy→`c.*`; hover blue→`c-focus` (priorytet border/badge, EXECUTING dot, effort-bar = dane) |
| Initiative Gantt | `Initiatives/gantt/InitiativeGantt.tsx` | kontener/toolbar/select/zoom/osie/wiersze/undated→`c.*`; linia „dziś" crimson→`c-accent`; konektory hex→`var`; critical ring rose→`c-danger`; **DEFER: `TYPE_BAR.task` crimson = paleta belki per typ** |
| Execution Initiatives Kanban | `Execution/ExecutionInitiativesKanbanView.tsx` | bliźniak PortfolioKanban — te same swapy; drop-zone crimson→`c-focus` |
| Roadmap Gantt (duży) | `RoadmapGantt.tsx` | toolbar/nagłówki/osie/grid/wiersze/legenda/footer→`c.*`; arrowheady+stroke hex→`var`; **status active/EXECUTING crimson→`c-focus-solid`** (crimson≠status); linking bg→`c-accent-soft`; zoom/link-toggle navy→`bg-c-text text-c-bg`; **DEFER: `AXIS_COLORS` = paleta belek per oś** |
| Execution Timeline (duży) | `Execution/ExecutionTimelineView.tsx` | alpha-safe sweep slate/navy→`c.*` (toolbar/filtry/osie/wiersze/legenda); linia „dziś" danger→`c-accent`; konektory+arrowheady hex→`var`; **SCHEDULED status crimson→neutral** (mapy STATUS/severity reszta = dane) |
| Gate Readiness (governance) | `Initiatives/sections/GateReadinessSection.tsx` | sweep neutralny chrome→`c.*`; crimson-removal: AI/Sparkles/link→`c-info`, przyciski→neutral, progress/readiness bar crimson→`c-info`, selected step navy→`c-text/bg`, sponsor/owner→`c-text`, primary CTA→`bg-c-text text-c-bg`, progress track slate→`c-border-subtle` |
| Resources (governance) | `Initiatives/sections/ResourcesSection.tsx` | sweep neutralny→`c.*`; crimson-removal: focus-ring→`c-focus`, ikony/skill (GraduationCap)→`c-info`, przyciski akcji→neutral, koszt/badge→`c-text`/neutral, add-row highlight→`c-accent-soft` |
| Timeline Planner (governance, 4316 l.) | `Initiatives/sections/TimelinePlanner.tsx` | sweep neutralny chrome→`c.*` (nagłówki/wiersze/osie/siatka); add-button crimson hover→neutral; **DEFER: milestone TYPE color (`text-primary-500`/tint) = paleta typu** |

**Crimson-removal (filar):** wszystkie `primary-*` (=crimson) na fokus/status/selection/AI/progress USUNIĘTE z instrumentów i governance. Zasada: fokus→`c-focus`(-solid), status „active/scheduled"→neutral/blue (crimson≠status §9.1), AI-sloty (Sparkles/Loader)→`c-info`, progress/readiness NIGDY crimson→`c-info`/neutral (§14.2), kategorie/skille→`c-info`. Pozostałe `primary-*` (5×) = wyłącznie **DEFER paleta belek** (patrz niżej).

**DEFER (wg zlecenia — decyzja palety, Fala 3-DATA; zalogowane, NIE ruszane):**
- **Kolor BELEK gantta per oś/typ/workstream** = docelowo `c-tag-*` (tokeny `c-tag-*` **jeszcze nie istnieją** w `tailwind.config.js` → blokada Fundamentu). Wystąpienia: `RoadmapGantt.AXIS_COLORS` (7 osi), `InitiativeGantt.TYPE_BAR.task` (crimson), `TimelinePlanner` milestone/event TYPE colors (`STATUS_COLORS`, event-type map), `PortfolioTimelineView.TIMELINE_COLORS`/`getStatusColors`/`getAxisColor` (config `portfolioColors`).
- **Komórki macierzy Portfolio** (`MATRIX_QUADRANT_COLORS` = impact/effort/wartość-ryzyko) = dane, DEFER.
- **Mapy status/priority/severity** (`ExecutionTimelineView.STATUS_COLORS` 12 statusów + `sevColors`; `RoadmapGantt.STATUS_COLORS`; `RoadmapKanban` priorytet; `ResourcesSection.statusDotClass`; `TimelinePlanner.STATUS_COLORS`) = semantyczne dane statusu — zostają (poza usuniętym crimsonem SCHEDULED/active).

**Świadomie ZOSTAWIONE (sanctioned / blokada Fundamentu):**
- **Translucent surfaces** `bg-white/60..95` + `dark:bg-navy-xxx/NN` + `border-slate-200/NN dark:border-navy-700/NN` (+`backdrop-blur`) — DOMINUJĄCY leftover w governance (Gate/Resources/TimelinePlanner ~90 szt./plik). Tokeny `c-*` = `var()` bez `<alpha-value>` → modyfikator `/70` nie działa. **Blokada Fundamentu** (identyczna z Fali 1/2). Alpha-safe sweep celowo ich NIE dotknął (negative-lookahead).
- **Semantyczne warstwy danych na instrumentach:** critical path (danger/rose ring), warning strip (amber), status/priority chipy — zostają (dane/semantyka, nie chrome).
- **Bar text `text-white`** na kolorowych belkach — czytelny, zostaje.

**Weryfikacja:** brak `node_modules` (zero npm) → sanity: (a) GLOBALNY skan: 0 nieznanych klas `c-*` (wszystkie 1:1 na `tailwind.config.js`; `border-l-c-focus-solid` = poprawny kierunkowy border-color TW3.4); (b) 0 markerów konfliktu; (c) każdy z 11 plików `git diff --numstat` add==del (czysty class-swap, zero zmian JSX/logiki); (d) 0 uszkodzonych stringów klas (0 podwójnych spacji w `className`, 0 malformed `/NN /NN` po naprawie alpha-safe); (e) 0 collapse wcięć. Build vite + screenshoty light/dark instrumentów — wymagane przed merge (Strateg; worktree bez preview).
**Commity:** `b03f0f773d`→`f30cac283e` (12 fix, per ścieżka, bez `-A`).
