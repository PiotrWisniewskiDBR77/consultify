# V3 Sprint Plan — 12 odbieralnych sprintów (SSOT-aligned)
>
> **Status:** Draft (operational plan)  
> **Owner:** Piotr  
> **Last updated:** 2026-02-27  
>
> **Cel:** podzielić całość wdrożenia v3 na **12 odbieralnych sprintów**, tak aby po każdej serii można było:
> - otworzyć aplikację,
> - przejść checklistę,
> - odebrać działający zakres,
> - a dopiero potem uzgodnić scope kolejnego sprintu.
>
> **Zasada krytyczna:** sprint jest “DONE” dopiero gdy da się go odebrać w aplikacji wg checklisty, a zmiany trzymają `docs/ui-standards/**`.

---

## 0) Źródła prawdy (KANON) — co ten plan realizuje

- **Proces E2E**: `docs/product/PROCESS_MYWORK_TO_DELIVERABLES_V3.md`
- **Program / ledger V3**: `docs/product/V3_IMPLEMENTATION_PROGRAM.md`
- **Change Register / GAP closure**: `docs/product/V3_ACTION_PLAN.md`
- **Backorder (poza cutline sprintu)**: `docs/product/V3_BACKORDER.md`
- **Runbook agentów sprintów**: `docs/product/V3_SPRINT_AGENT_RUNBOOK.md`
- **SSOT index**: `docs/product/REQUIREMENTS_V3_SSOT.md`
- **UI Standards (JEDYNY kanon)**: `docs/ui-standards/README.md`
  - D/N/C: `docs/ui-standards/01-shell-layout/presentation-modes.md`
  - ModuleHub: `docs/ui-standards/03-modules/module-hub-standard.md`
  - View modes: `docs/ui-standards/03-modules/view-modes-standard.md`
  - App table: `docs/ui-standards/03-modules/app-table-standard.md`
  - Table + preview: `docs/ui-standards/03-modules/table-preview-pane-standard.md`
  - Workspace panels: `docs/ui-standards/02-components/workspace-3-tools-strip.md`
  - Interactive boards: `docs/ui-standards/03-modules/interactive-board-standard.md`

---

## 1) Jak pracujemy sprintami (proces odbioru)

### 1.1 Sprint = odbiór w apce, nie “zamknięte taski”
Każdy sprint ma:
- **Zakres (IN/OUT)**: co dowozimy i czego świadomie nie robimy.
- **Deliverables (w apce)**: jakie powierzchnie/flow mają działać.
- **Checklistę odbioru**: 10–25 kroków, które wykonujesz w UI.
- **Kryteria DONE**: minimalny zestaw, który musi przejść bez ręcznych “tłumaczeń”.
- **Ryzyka** + zależności.

### 1.2 Zanim sprint wystartuje — “Sprint Contract” (15 min)
Przed każdym sprintem uzgadniamy:
- **Primary user** (kto odbiera) i **1 główny scenariusz**
- **Cutline**: 1–3 rzeczy, których *nie* robimy w tym sprincie
- **Demo path**: 5–10 minut “ścieżki odbioru”
- **SSOT refs**: które dokumenty są kanonem dla zakresu

### 1.3 Po sprincie — “Sprint Acceptance”
Po sprincie robimy:
- przejście checklisty,
- zapis “OK / GAP / decision / risk” do macierzy weryfikacji,
- aktualizacja planu kolejnego sprintu.

---

## 2) Mapa: 12 sprintów (spis treści)

1. **S1 — UI/UX Spine v3 (global)**  
2. **S2 — N‑mode standardization (artefakty)**  
3. **S3 — Interactive Tables/Boards Engine (SSOT)**  
4. **S4 — Consulting Tools E2E (1–3 referencyjne)**  
5. **S5 — Ideas Workspace (canvas + konwersje)**  
6. **S6 — Notebook v3 (create-from-note) + Link Graph MVP**  
7. **S7 — Interview Form Engine (formularze + approval + insights)**  
8. **S8 — Initiatives: Planowanie (zestawienia + analiza)**  
9. **S9 — Execution/Wdrożenie: realizacja + raportowanie + zarządzanie**  
10. **S10 — Results v3: KPI/ROI + deviations + time-series**  
11. **S11 — Financial Analysis v3 core (5 zakładek, MVP)**  
12. **S12 — Deliverables Generators: Report + Presentation core (premium)**  

---

## 3) Sprint S1 — UI/UX Spine v3 (global)

### Cel sprintu
Ujednolicona szata i przewidywalne zachowanie w całej aplikacji: **ModuleHub + AppTable + PreviewPane + CommandRow + view modes** oraz brak orphan views (dynamic tabs).

### Scope (IN)
- ModuleHub standard w kluczowych modułach.
- AppTable standard (filtry, resizable columns, kebab actions).
- Preview pane standard (tam gdzie ma sens).
- Command Row (jeden rząd pod topbarem).
- View modes toggle w kanonicznej kolejności.

### Scope (OUT)
- Rozbudowa logiki domenowej (narzędzia/finanse/generatory) — tylko UX spine.

### SSOT refs (MUST)
- `docs/ui-standards/README.md`
- `docs/ui-standards/03-modules/module-hub-standard.md`
- `docs/ui-standards/03-modules/app-table-standard.md`
- `docs/ui-standards/03-modules/table-preview-pane-standard.md`
- `docs/ui-standards/03-modules/view-modes-standard.md`

### Mapping do V3 (jeśli istnieje)
- `V3-A03` (UI standards compliance sweep)
- `V3-A07` (preview pane rollout)

### Checklist odbioru w apce (10–15 min)
- Wejdź w MyWork → Inbox → sprawdź: AppTable (filtry w headerze), kebab (⋮), brak podwójnych toolbarów.
- Włącz preview pane: selection→preview, `X` close, Enter→open full.
- Wejdź w Tools hub → table + cards działają spójnie (ten sam kebab, te same filtry).
- Wejdź w Interview hub → wszystkie taby: table/cads bez “dodatkowych pasków”.
- Wejdź w Initiatives hub → view modes w kolejności kanonicznej, brak custom “kolejek”.
- Z hubów otwarcie detail/wizard zawsze trafia do dynamic tabs (brak nowych pełnoekranowych tras).

### DONE (minimal)
- 6 kluczowych hubów spełnia AppTable + ViewModes + (gdzie dotyczy) PreviewPane.

---

## 4) Sprint S2 — N‑mode standardization (artefakty)

### Cel sprintu
Jedna, kanoniczna struktura detail view: stały header + tryby D/N/C + spójne sekcje (shared sections) oraz minimalna kompletność “co jest above-the-fold”.

### Scope (IN)
- D/N/C kontrakt w artefaktach: Initiative/Task/Decision/Notification/Insight (tam gdzie istnieją).
- Required sections + podstawowe completeness.
- Shared sections: Comments/Activity/Risk/Governance/Attachments (bez duplikacji).

### Scope (OUT)
- Nowe funkcje biznesowe w inicjatywach (to w S8/S9).

### SSOT refs (MUST)
- `docs/ui-standards/01-shell-layout/presentation-modes.md`
- `docs/ui-standards/01-shell-layout/artifact-shell.md`
- `docs/ui-standards/02-components/shared-sections.md`
- `docs/product/NMODE_MANAGEMENT_V3.md`

### Mapping do V3
- `V3-K01` (N-mode management)
- `V3-F01` (Initiative templates)

### Checklist odbioru w apce
- Otwórz Initiative → przełącz D/N/C → dane te same, różny render; nie resetuje draftu.
- Header sticky; primary actions + chat + toggle mode widoczne.
- Above-the-fold: widać next action / status / 2–4 kluczowe sekcje “smart open”.
- Locked/read-only respektowane (jeśli inicjatywa locked, brak edycji i DnD).

### DONE
- 2 artefakty referencyjne (Initiative + Decision) mają spójny shell i sekcje wg kanonu.

---

## 5) Sprint S3 — Interactive Tables/Boards Engine (SSOT)

### Cel sprintu
Dowiezienie “tabel interaktywnych” jako **systemu**, nie jako pojedynczego komponentu: dataset → view modes → generator → templates → snapshot.

### Scope (IN)
- Dataset ma własne ID (linkowalne, “Used in”).
- Dwa źródła życia: tool-linked vs personal/idea.
- Excel-like mechanics: manual/linked/formula cells (MVP ograniczony, ale kontrakt spójny).
- Live view → snapshot (frozen values linked cells).
- Generator + template library (application + organization).

### Scope (OUT)
- Pełna zgodność z Excelem (pełne funkcje, makra) — MVP.

### SSOT refs (MUST)
- `docs/ui-standards/03-modules/interactive-board-standard.md`
- `docs/ui-standards/03-modules/app-table-standard.md`
- `docs/ui-standards/03-modules/view-modes-standard.md`

### Mapping do V3
- **Brak jawnego taska w ledgerze** → sprint tworzy podstawę pod Results i Financial Analysis (S10/S11).

### Checklist odbioru w apce
- Utwórz nową tablicę (personal) → dodaj kolumny → zapisz → wróć i odtwórz.
- Zmień view mode (table → kanban) i dane nie znikają.
- Zrób snapshot → widzisz, że linked cells mają frozen values w snapshot.
- Skopiuj tablicę jako template (org scope) i użyj w nowym miejscu.

### DONE
- Jest 1 referencyjna tablica KPI (personal) i 1 referencyjna tablica finansowa (tool-linked) działająca end-to-end.

---

## 6) Sprint S4 — Consulting Tools E2E (1–3 referencyjne)

### Cel sprintu
Library → Wizard → Session → Outputs → (Initiative draft + report/deck draft) z traceability i spójnym UX.

### Scope (IN)
- Narzędzie referencyjne (np. Process Automation lub 1 strategic tool) w pełnym flow.
- Outputs jako artefakty: metadane, “Open source”, historia.
- Tool-scoped RAG (jeśli jest w scope: N05) jako wsparcie wizardów.

### SSOT refs
- `docs/product/CONSULTING_TOOLS_V3.md`
- `docs/product/CONSULTING_TOOLS_TOOL_SPECS_V3.md`
- `docs/product/SOURCE_TRACEABILITY_SPEC.md`
- UI: AppTable + preview pane + cards standard

### Mapping do V3
- `V3-E01`, `V3-E03`, `V3-E02` (+ opcjonalnie `V3-N05`)

### Checklist odbioru
- Tools → Library → filtr + preview pane (gfx/video/KB).
- Start wizard → przejdź kroki → finalize.
- Outputs: wygeneruj initiative draft + report/deck draft → “Open source” wraca do session snapshot.

### DONE
- 1 narzędzie działa jak “produkt konsultingowy”, nie jak formularz.

---

## 7) Sprint S5 — Ideas Workspace (canvas + konwersje)

### Cel sprintu
Ideas jako “narzędzie pracy” z trybami canvasa (mindmap/flow/table/whiteboard) i konwersjami do artefaktów.

### Scope (IN)
- Selector trybu canvasa nie gubi danych (wspólny core model).
- Convert to… działa i jest traceable.
- Tools strip panele (Tools/Context/AI Suggestions) działają w Ideas.

### SSOT refs
- `docs/MYWORK_MODULE_SPECIFICATION.md` (Ideas core)
- `docs/ui-standards/02-components/workspace-3-tools-strip.md`
- `docs/product/LINK_GRAPH_V3.md` (jeśli linki w scope)

### Mapping do V3
- `V3-C06` + `V3-C02/V3-C03` (traceable convert)

### Checklist odbioru
- Utwórz MindMap → przełącz na ProcessFlow → wróć → nic nie ginie.
- Convert elementu do initiative/task/decision/note → powstaje artefakt z source.
- Otwórz Context panel → widać powiązania/links (jeśli są).

---

## 8) Sprint S6 — Notebook v3 + Link Graph MVP

> Ten sprint jest krytyczny dla “systemu pracy”: notatki stają się źródłem deliverables.

### Scope (IN)
- Create-from-note: Report/Presentation/Assessment przez outline-first.
- Right panel contract wg 3-tools strip.
- Embedded refs (chip→preview) + Used in (backlinks) — MVP.
- AI command block + voice dictation (propose→accept).

### SSOT refs
- `docs/product/NOTEBOOK_V3.md`
- `docs/product/LINK_GRAPH_V3.md`
- `docs/ui-standards/02-components/workspace-3-tools-strip.md`

### Mapping do V3
- **Nowe epiki** wg `V3_ACTION_PLAN.md`: `V3-A09`, `V3-C07`

### Checklist odbioru
- Notebook → Create Report → outline → accept → builder.
- W treści wstaw chip do Initiative → expand preview.
- “Used in” pokazuje gdzie notatka jest użyta (min. Notes + Initiatives + Reports).

---

## 9) Sprint S7 — Interview Form Engine (formularze + approval + insights)

### Scope (IN)
- Assignments: submit → approve/send-back + missing items.
- Supporting materials: attachments/links/object refs.
- Insights: selection i generowanie insightów jako kontekst do Tools/Reports.

### SSOT refs
- `docs/product/INTERVIEW_FORM_ENGINE_V3.md`
- UI: AppTable + preview pane + module hub

### Mapping do V3
- `V3-D01`, `V3-D02`, `V3-D03`

### Checklist odbioru
- Utwórz assignment → respondent odpowiada → manager send-back z brakami → respondent poprawia → approve.
- Z approved Sessions wybierz inputy → generate Insight → widoczny w Tools/Generators jako source.

---

## 10) Sprint S8 — Initiatives: Planowanie (zestawienia + analiza)

### Scope (IN)
- Zestawienia: table/cards/gantt/calendar (tylko dostępne view modes, w kanonicznej kolejności).
- Analiza: zasoby/wykonalność/logika/timeline/kompletność jako 5 podwidoków.
- “Issues list” + “napraw” (actionable, nie opisowe).

### SSOT refs
- `docs/product/INITIATIVE_LEVEL_TEMPLATES_V3.md`
- `docs/product/INITIATIVES_PORTFOLIO_ANALYSIS_V3.md`
- UI: view-modes standard + timeline rules

### Mapping do V3
- `V3-F01`, `V3-F02`

### Checklist odbioru
- W Initiative Planning: przełącz view modes, filtry działają, timeline ma left list + zoom.
- Otwórz Analiza: widzisz braki danych planu i potrafisz przejść do “napraw”.

---

## 11) Sprint S9 — Execution/Wdrożenie: realizacja + raportowanie + zarządzanie

### Scope (IN)
- Execution hub: table/kanban/timeline + preview pane + quick actions.
- Signals “co jest czerwone” (data-driven, honest degraded mode).
- Raportowanie: postępy/zasoby/zagrożenia (minimal).
- Zarządzanie: workarounds + propozycje zmian w timeline (propose→accept).

### SSOT refs
- `docs/product/EXECUTION_V3.md`
- UI: preview pane + view modes + module hub

### Mapping do V3
- `V3-G01` (min) + potencjalne rozszerzenie wg SSOT.

### Checklist odbioru
- 3 inicjatywy “in execution” → preview pane pokazuje health summary.
- Quick action “Mark blocked” działa i jest widoczne w Initiative.
- Jeśli brakuje dat/ownerów: UI pokazuje “missing plan data”, nie udaje metryk.

---

## 12) Sprint S10 — Results v3: KPI/ROI + deviations + time-series

### Scope (IN)
- KPI table core + mapping KPI↔initiative.
- ROI plan vs realized.
- Deviation management (threshold→case→plan naprawczy).
- KPI time-series contract (API/types) + drilldown.

### SSOT refs
- `docs/product/RESULTS_V3.md`
- `docs/product/ROI_TRACKING_CONTRACT_V3.md`
- `docs/product/RESULTS_KPI_DEVIATION_MANAGEMENT_V3.md`
- UI: interactive boards + app table standard

### Mapping do V3
- `V3-H01`, `V3-H02`, `V3-H03`, `V3-H04`, `V3-H05`, `V3-H06`

### Checklist odbioru
- Dodaj KPI → przypnij do initiative → tracking działa.
- KPI spada poniżej threshold → deviation case + plan naprawczy + link do taska.
- Time-series wykres/widok działa i jest spójny w FE/BE.

---

## 13) Sprint S11 — Financial Analysis v3 core (5 zakładek, MVP)

### Scope (IN)
- Modeling: baseline “zero-change”.
- Analysis: live→save, biblioteka runów.
- Forecasting: 1 scenariusz baseline vs scenario.
- Valuation: DCF MVP + sensitivity.
- Investment: CAPEX/investment MVP (payback/NPV/IRR — minimal).
- Export do report/deck/initiatives (spina się z S12).

### SSOT refs
- `docs/product/FINANCIAL_ANALYSIS_V3.md`
- `docs/ui-standards/03-modules/interactive-board-standard.md`
- `docs/product/FINANCE_EXPORT_V3.md`

### Mapping do V3
- `V3-I01` + **nowy epik** `V3-I02` (wg `V3_ACTION_PLAN.md`)

### Checklist odbioru
- Zbuduj baseline model → uruchom analizę → Save run.
- Z runu: Export → Report + Export → Presentation → Open source wraca do runu.

---

## 14) Sprint S12 — Deliverables Generators (Report + Presentation core, premium)

### Scope (IN)
- Report Generator core: R1–R4 templates + Free mode + online living report + quality gate + exports (PDF/DOCX).
- Presentation Generator core: deck builder + brand kit/theme + smart diagrams (MVP) + online animations baseline + export PPTX/PDF.
- Deterministyczne scaffolding outputów: tool/assessment/finance → report/deck outline (żeby nie było losowości).

### SSOT refs
- `docs/product/REPORT_GENERATOR_V3.md`
- `docs/product/REPORTING_CANONICAL_TEMPLATES.md`
- `docs/product/PRESENTATION_GENERATOR_V3.md`
- `docs/product/PRESENTATION_GENERATOR_VISUALS_IMPLEMENTATION_PLAN_V3.md`
- `docs/REPORT_BUILDER_EXPORTS_STANDARD.md`

### Mapping do V3
- `V3-J01`, `V3-J02`, `V3-J03`, `V3-E13`
- **nowe epiki**: `V3-J04`, `V3-J05` (wg `V3_ACTION_PLAN.md`)

### Checklist odbioru
- Z Initiative + ToolSession + Finance run: generuj R2 Steering Report online → export PDF/DOCX.
- Z tych samych źródeł: generuj Executive Deck → edytuj 1 slajd/block → export PPTX/PDF.
- W report/deck widzisz source refs per sekcja/blok (traceability).

---

## 15) AI/LLM i Synchronizacja — jak są odbierane w sprintach (bez “osobnych sprintów na papierze”)

### AI/LLM (odbiór tam, gdzie wpływa na UX)
- **S4/S6/S12**: AI w wizardach/generatorach działa jako *propose→accept*, a nie auto-write.
- **R1/R2 hardening**: `V3-A06`, `V3-N01..N03` (registry + usage logs + approvals) oraz `V3-N05` (tool-scoped RAG).
- Deep research / evidence ledger (`V3-N08..N11`) jest odbierany razem z jakością raportów (S12).

### Synchronizacja / Integrations / MCP
- Integracje są odbierane “w kontekście”:
  - **S9/S10**: jeśli Execution/Results mają refresh lub notyfikacje,
  - **S12**: eksport/publish report/deck.
- Uczciwość scope: `V3-M14` (read‑only vs bidirectional) musi być widoczna w Settings.

