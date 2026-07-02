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
