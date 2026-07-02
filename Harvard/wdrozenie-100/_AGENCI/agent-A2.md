# ZLECENIE — Agent A2 · Klaster: Interview + Tools + Assessment + Audits
**Wznów:** [`_PROTOKOL.md`](_PROTOKOL.md) → to zlecenie → [`_STATUS.md`](_STATUS.md) → spec.
**Branch/worktree:** `reskin/A2/wave-<n>`

## Własność wyłączna (pliki)
`src/components/Interview/**` · `src/components/DiscoveryTools/**` · `src/views/discovery-tools/**` · `src/components/assessment/**` · `src/components/Audit/**`

## Zadania per fala
- **Fala 1 (Listy §14):** Interview (Sesje/Inbox/Assigned/Templates) · Tools Library · Assessment lista · Audits lista → Parity Gate §14.7.
- **Fala 2 (Artefakty §11.2+§13):** Interview Session (C-wariant konwersacyjny) · Discovery Tool (A, editor-shell) · **Tool detail page — ZAPROJEKTOWAĆ OD ZERA** (serce konsultingu, nigdy nie robione UI) · Assessment Session (D matryca) · **podłączyć DRDReportTemplate + zbudować DRDAssessmentMap** · Assessment Report (B) · Audit Report (B).
- **Fala 3 (Instrumenty §15):** macierze/mapy Assessment (SIRI/ADMA/DRD), heatmapy.
- **Fala 5 (Light).**

## Znane bugi (z walkthrough)
- Interview Menu 2 pill regresja (A-2) · multi-select (A-1) · Tools Edit Columns dramat (A-4, komponent z Fali 0) · Tools kebab za mało (A-6) · **Tools>Initiatives panel pokazuje bibliotekę zamiast inicjatyw (P1 bug renderowania)** · Assessment Edit Columns stare · Assessment brak ramek Menu 3 (A-3) · **Assessment session = generyczny „Shared Workbench" zamiast macierzy — podłączyć wizualizacje** · generator inicjatyw modal = lime green spoza palety.

## RAPORTY
<!-- Fala X · ekran · pliki · DoD · pominięte -->

### Fala 2 (ARTEFAKTY) · sesja 2026-07-02 · branch `reskin/A2/wave-2` (baza `feat/deliverables-w1` = Fala 0+1 wszystkich agentów; 6 commitów kodu + ten raport)

**Charakter:** MECHANICZNY token-sweep (`c.*`) + crimson-removal na chrome artefaktów. Zero przebudowy logiki/scoringu, zero `ui/**`/`shared/**` poza importem, zero npm. Commity per ścieżka.

**Ekrany/pliki objęte (7 plików kodu):**
1. **`DiscoveryTools/ToolWorkspace.tsx`** — chrome workspace + modal „Request review": `bg-slate-50 dark:bg-navy-950`→`bg-c-bg`, modal `bg-white dark:bg-navy-900`→`bg-c-surface`, borders→`c-border-subtle`, labels/teksty→`c-text-*`, inputy dostały fokus `c-focus`+`c-focus-solid`. Primary „Send to review" ZOSTAJE navy (SSOT Button.tsx).
2. **`DiscoveryTools/ToolCanvas.tsx`** — puste/loading panele: slate→`c-text-secondary`/`c-text-muted`, dashed-border card→`c-border-subtle`+`c-surface-raised`. (Logika canvasu NIETKNIĘTA — tylko kolory chrome.)
3. **`assessment/AssessmentWorkbenchPanel.tsx`** — PEŁNA migracja (był „generyczny Shared Workbench"): karty/kickery/pola/evidence→`c.*`; **crimson-removal:** primary `bg-slate-900 dark:bg-primary-500`→navy SSOT (×6), secondary `border-primary-300 text-primary-700`→neutral (×2); wszystkie inputy fokus→`c-focus`. Scoring/przejścia/API NIETKNIĘTE. **Crimson: 11→0.**
4. **`views/AssessmentSessionEditorView.tsx`** — **crimson-removal:** toolbar toggle (Manage/Edit) active `bg-primary-50 text-primary-700`→`c-accent-soft`+`c-text` (§9.2②); primary CTA Exit/Generate `bg-primary-500`→navy SSOT (×3); selekcja konwersacji `bg-primary-50`→neutral `bg-slate-50 dark:bg-white/[.06]`+`border-l-2 border-c-info` (SYS-1). + migracja ~82 par tokenów chrome. **Crimson: 25→0.**
5. **`Interview/InsightCreatorModal.tsx`** — **crimson-on-focus removal** (5 pól: `focus:border/ring-primary-500`→`c-focus-solid`/`c-focus`). Reszta crimson (brand-akcenty AI-modalu, ~77) ZOSTAJE — to redesign, DEFER.
6. **`Interview/InterviewWorkspace.tsx`** — **crimson-removal:** 2 primary CTA `bg-primary-500`→navy SSOT, hover-link `hover:text-primary-600`→neutral, empty-state icon `text-primary-500`/`bg-primary-500/10`→`c-text-muted`/`c-surface-raised` (§9.2⑭). + 30 par tokenów chrome. **Crimson: 8→0.**
7. **`Interview/InsightViewer.tsx`** (8638 L) — crimson-leak na action-linkach/przyciskach (5 miejsc: `hover:text/border-primary`→neutral `c-text-secondary`+`c-border`). Brand icon-tiles/akcenty (10 pozostałych) = DEFER. **Crimson: 42→10.**

**Zrobione (sumarycznie):** crimson na FOCUS = 0 wszędzie (był tylko w InsightCreatorModal); crimson na PRIMARY CTA → navy SSOT wszędzie w chrome; crimson na SELEKCJI → neutral+`c-info` (SYS-1); crimson na EMPTY-icon → `c-text-muted`; ~120+ par tokenów chrome zmigrowanych na `c.*`. Wszystkie `c-*` klasy zwalidowane (grep-sanity czysty, zero literówek).

**DEFER (NIE RUSZANE — zalogowane wg zlecenia):**
- **`assessment/drd/DRDAssessmentEditor.tsx`** (81 crimson) · **`siri/SIRIAssessmentEditor.tsx`** · **`adma/ADMAAssessmentEditor.tsx`** — wszystkie zawierają MACIERZE/HEATMAPY/grid gdzie crimson jest wpleciony w renderowanie danych (8× gradient/matrix-cell w DRD). To **deep visualization = Fala 3** (per zlecenie „Macierze/mapy SIRI/ADMA głęboka wizualizacja = Fala 3"). Crimson-jako-dana → wymaga `c-tag-*` remapu w Fali 3, nie mechanicznego sweep.
- **Tool detail page „od zera"** — nowy artifact design, wymaga Piotra (NIE dotykany).
- **DRDAssessmentMap.tsx (build) + podłączenie DRDReportTemplate** — to build, nie sweep.
- **InsightCreatorModal brand-akcenty AI** (~77 crimson) + **InsightViewer brand icon-tiles** (10 crimson) — brand-moment/redesign artefaktu; fokus (jedyny twardy zakaz) już naprawiony. Decyzja redesignu = Piotr/Fala 3.

**DoD (self-audit):** zmiany = wyłącznie klasy CSS + (import istniejących eksportów — brak nowych importów w Fali 2). Grep-sanity `c-*` czysty na wszystkich 7 plikach. **Build NIE odpalony** (worktree bez node_modules; zlecenie: zero npm) — wymaga `npm run build` (vite) + wizualnej weryfikacji light/dark przed odbiorem. Logika/scoring/API/canvas NIETKNIĘTE (tylko kolory/tokeny chrome). `_STATUS.md` nie zaznaczam (nie było w zakresie sesji; wiersze artefaktów per klaster do zaznaczenia po odbiorze).
