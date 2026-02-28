# V3 Sprint Agent Prompts (S1–S12) — copy/paste do nowych agentów
>
> **Status:** Canonical (operational)  
> **Owner:** Piotr  
> **Last updated:** 2026-02-28  
>
> **Jak używać:** wybierz sprint Sx → skopiuj prompt → wklej do nowego agenta.  
> Agent ma obowiązek zacząć od **Sprint Summary + Sprint Contract** i skończyć raportem **PASS/FAIL + PR + BO**.

> **Git (ważne):** w tych promptach jest już zawarte **jawne polecenie** na `git commit`, `git push` i utworzenie Draft PR.  
> Agent ma to wykonać **bez pytania o zgodę**, bo to jest część kontraktu sprintu.
>
> **Źródła prawdy (MUST):**
> - `docs/product/V3_SPRINT_PLAN_12_SPRINTS.md`
> - `docs/product/V3_ACTION_PLAN.md`
> - `docs/product/V3_BACKORDER.md`
> - `docs/product/V3_IMPLEMENTATION_PROGRAM.md`
> - `docs/ui-standards/**`

---

## Prompt — Sprint Agent S1 (UI/UX Spine v3)

```text
You are Sprint Agent S1.

Goal: Deliver Sprint S1 — UI/UX Spine v3 (global), acceptance in-app checklist must PASS.

SSOT refs (must follow):
- docs/product/V3_SPRINT_PLAN_12_SPRINTS.md (Sprint S1)
- docs/ui-standards/README.md
- docs/ui-standards/03-modules/module-hub-standard.md
- docs/ui-standards/03-modules/app-table-standard.md
- docs/ui-standards/03-modules/table-preview-pane-standard.md
- docs/ui-standards/03-modules/view-modes-standard.md
- docs/product/V3_BACKORDER.md

V3 mapping (when applicable): V3-A03, V3-A07, plus any touched module tasks.

Branching:
- Create/checkout branch: sprints/S01-uiux-spine
- Push immediately to GitHub
- Open a Draft PR to main:
  title: "S1: UI/UX spine v3"
  body MUST include: touched V3-IDs, CR-IDs, BO-IDs

Scope IN (do):
- Ensure ModuleHub/AppTable/PreviewPane/CommandRow/view-modes behavior is consistent in 6 key hubs:
  MyWork, Tools, Interview, Initiatives, Results, Reports/Presentations.
- Ensure dynamic tabs/openDocuments flow (no orphan views) for those hubs.
- Ensure no duplicate toolbars/banners; Command Row is single row under topbar.

Scope OUT (do NOT do):
- Any new domain logic (finance/tools generator logic), unless required to fix a broken UI flow.
- New UI components not described in docs/ui-standards/**.

Backorder rules:
- Any missing UI component/standard or out-of-scope improvement => add BO entry in docs/product/V3_BACKORDER.md.

Sprint process rules:
1) Start by posting Sprint Summary and Sprint Contract (IN/OUT, DoD, demo path).
2) Implement S1 only.
3) Finish with report:
   - What shipped (UI entry points)
   - Acceptance checklist (PASS/FAIL):
     - MyWork Inbox table: filters in header + kebab + no duplicate toolbars
     - Preview pane: selection→preview, X close, Enter→open full
     - Tools hub: table+cards consistent
     - Interview hub tabs: no extra rows/strips, consistent table
     - Initiatives hub: view modes order canonical, no custom queues as view modes
     - Opening details always uses dynamic tabs (no orphan full pages)
   - BO items
   - Tests/commands run
   - PR link
Stop only when checklist PASS or you have blockers with BO entries.

Hard guardrails (MUST):
- You must explicitly validate **each** of the 6 hubs in the app, and in the report map each hub to:
  - **entry file(s)** you inspected/changed,
  - the exact acceptance steps you ran,
  - PASS/FAIL.
- If something is moved to Backorder, the corresponding checklist line is **FAIL (blocker)** until implemented.
  (No “PASS with exceptions”.)

Reference entry files (expected touchpoints):
- `src/components/MyWork/MyWorkHub.tsx` (+ `MyWork/InboxContent.tsx`)
- `src/components/Interview/InterviewHub.tsx`
- `src/components/Initiatives/InitiativesHub.tsx`
- `src/components/Results/ResultsHub.tsx`
- Reports/Presentations hubs under `src/components/Reports/**` and `src/components/Presentations/**`
```

---

## Prompt — Sprint Agent S2 (N‑mode standardization)

```text
You are Sprint Agent S2.

Goal: Deliver Sprint S2 — N-mode standardization (artefakty), acceptance checklist must PASS.

SSOT refs:
- docs/product/V3_SPRINT_PLAN_12_SPRINTS.md (Sprint S2)
- docs/ui-standards/01-shell-layout/presentation-modes.md
- docs/ui-standards/01-shell-layout/artifact-shell.md
- docs/ui-standards/02-components/shared-sections.md
- docs/product/NMODE_MANAGEMENT_V3.md
- docs/product/V3_BACKORDER.md

V3 mapping: V3-K01, V3-F01 (and touched artifacts).

Branch: sprints/S02-nmode-standardization → Draft PR to main.

Scope IN:
- Ensure D/N/C mode contract works on 2 reference artifacts (Initiative + Decision at minimum):
  sticky header, mode toggle, same data different render, no reset of draft/chat context.
- Ensure required/shared sections behave consistently (no duplicate UI).
- Ensure above-the-fold "smart open" basics (per SSOT).

Scope OUT:
- New business features in initiatives/execution/results.

Backorder: any missing standardization item outside sprint => BO.

Finish report includes PASS/FAIL for:
- Initiative D/N/C toggle and data consistency
- Decision D/N/C toggle and above-the-fold
- locked/read-only respected where applicable
```

---

## Prompt — Sprint Agent S3 (Interactive Tables/Boards Engine)

```text
You are Sprint Agent S3.

Goal: Deliver Sprint S3 — Interactive Tables/Boards Engine (SSOT), acceptance checklist must PASS.

SSOT refs:
- docs/product/V3_SPRINT_PLAN_12_SPRINTS.md (Sprint S3)
- docs/ui-standards/03-modules/interactive-board-standard.md
- docs/ui-standards/03-modules/app-table-standard.md
- docs/ui-standards/03-modules/view-modes-standard.md
- docs/product/V3_BACKORDER.md

Branch: sprints/S03-interactive-boards → Draft PR to main.

Scope IN:
- Implement "dataset" with stable ID and persistence.
- Two life-sources: tool-linked vs personal/idea.
- View modes on same dataset without data loss.
- Live view → snapshot (frozen values for linked cells in snapshot) — MVP.
- Generator + template library (application + organization) — MVP.

Scope OUT:
- Full Excel parity (full formula set/macros).

Finish PASS/FAIL checklist:
- Create personal board/table → configure columns → save → reopen works
- Switch view mode table→kanban and data persists
- Create snapshot and confirm frozen values recorded
- Save as org template and instantiate new table from template
```

---

## Prompt — Sprint Agent S4 (Consulting Tools E2E)

```text
You are Sprint Agent S4.

Goal: Deliver Sprint S4 — Consulting Tools E2E (1–3 referencyjne), acceptance checklist must PASS.

SSOT refs:
- docs/product/V3_SPRINT_PLAN_12_SPRINTS.md (Sprint S4)
- docs/product/CONSULTING_TOOLS_V3.md
- docs/product/CONSULTING_TOOLS_TOOL_SPECS_V3.md
- docs/product/SOURCE_TRACEABILITY_SPEC.md
- docs/ui-standards/** (table/cards/preview)
- docs/product/V3_BACKORDER.md

V3 mapping: V3-E01, V3-E02, V3-E03 (+ optional V3-N05 if included).

Branch: sprints/S04-tools-e2e → Draft PR to main.

Scope IN:
- Tools Library filtering/search + preview pane (gfx/video/KB entry points).
- Start wizard → complete flow → finalize.
- Outputs: create initiative draft + report/deck draft, with traceability + Open source.

Scope OUT:
- Scaling to all tools/templates library 60 (that is later).

Checklist PASS/FAIL:
- Library preview pane works and respects UI standard
- Wizard completes and creates ToolSession snapshot
- Outputs exist and Open source returns to session snapshot
```

---

## Prompt — Sprint Agent S5 (Ideas Workspace)

```text
You are Sprint Agent S5.

Goal: Deliver Sprint S5 — Ideas Workspace (canvas + konwersje), acceptance checklist must PASS.

SSOT refs:
- docs/product/V3_SPRINT_PLAN_12_SPRINTS.md (Sprint S5)
- docs/MYWORK_MODULE_SPECIFICATION.md (Ideas core)
- docs/ui-standards/02-components/workspace-3-tools-strip.md
- docs/product/V3_BACKORDER.md

V3 mapping: V3-C06, V3-C02, V3-C03, V3-A01.

Branch: sprints/S05-ideas-workspace → Draft PR to main.

Scope IN:
- Canvas mode selector (mindmap/whiteboard/flow/processflow/table) does not lose data.
- Convert to… creates traceable artifacts.
- 3-tools strip works (tools/context/ai_suggestions).

Checklist PASS/FAIL:
- Create content → switch modes → content persists
- Convert to initiative/report/deck works and is traceable
```

---

## Prompt — Sprint Agent S6 (Notebook v3 + Link Graph MVP)

```text
You are Sprint Agent S6.

Goal: Deliver Sprint S6 — Notebook v3 + Link Graph MVP, acceptance checklist must PASS.

SSOT refs:
- docs/product/V3_SPRINT_PLAN_12_SPRINTS.md (Sprint S6)
- docs/product/NOTEBOOK_V3.md
- docs/product/LINK_GRAPH_V3.md
- docs/ui-standards/02-components/workspace-3-tools-strip.md
- docs/product/V3_BACKORDER.md

V3 mapping: new epics V3-C07 + V3-A09 (as per V3_ACTION_PLAN.md).

Branch: sprints/S06-notebook-linkgraph → Draft PR to main.

Scope IN:
- Create-from-note for Report/Presentation/Assessment uses outline-first (accept/edit outline).
- Right panel 3-tools strip contract.
- Embedded refs chip→preview + Used in backlinks MVP.
- AI command/voice (propose→accept) basic.

Checklist PASS/FAIL:
- Create Report from note: outline→accept→builder with sources
- Insert chip link to Initiative and expand preview
- Used in shows backlinks from at least 3 domains
```

---

## Prompt — Sprint Agent S7 (Interview Form Engine)

```text
You are Sprint Agent S7.

Goal: Deliver Sprint S7 — Interview Form Engine acceptance checklist must PASS.

SSOT refs:
- docs/product/V3_SPRINT_PLAN_12_SPRINTS.md (Sprint S7)
- docs/product/INTERVIEW_FORM_ENGINE_V3.md
- docs/ui-standards/** (module hub/table/preview)
- docs/product/V3_BACKORDER.md

V3 mapping: V3-D01, V3-D02, V3-D03.

Branch: sprints/S07-interview-engine → Draft PR to main.

Scope IN:
- Assignments submit → approve/send-back with missing items JSON and feedback.
- Supporting materials (attachments/links/object refs).
- Insights selection + generation as sources for Tools/Generators.

Checklist PASS/FAIL:
- Full loop submit→send-back→fix→approve
- Insight created from approved sessions and usable as source
```

---

## Prompt — Sprint Agent S8 (Initiatives planning)

```text
You are Sprint Agent S8.

Goal: Deliver Sprint S8 — Initiatives planning (zestawienia + analiza) acceptance checklist must PASS.

SSOT refs:
- docs/product/V3_SPRINT_PLAN_12_SPRINTS.md (Sprint S8)
- docs/product/INITIATIVE_LEVEL_TEMPLATES_V3.md
- docs/product/INITIATIVES_PORTFOLIO_ANALYSIS_V3.md
- docs/ui-standards/03-modules/view-modes-standard.md
- docs/ui-standards/03-modules/table-preview-pane-standard.md
- docs/product/V3_BACKORDER.md

V3 mapping: V3-F01, V3-F02.

Branch: sprints/S08-initiatives-planning → Draft PR to main.

Scope IN:
- Planning: table/cards/gantt/calendar view modes as available, canonical order.
- Analysis: resources/feasibility/logic/timeline/completeness with issues list + fix actions.

Checklist PASS/FAIL:
- View modes switch works; timeline has left list + zoom; filters multiselect
- Analysis shows missing plan data honestly and has fix path
```

---

## Prompt — Sprint Agent S9 (Execution / Wdrożenie)

```text
You are Sprint Agent S9.

Goal: Deliver Sprint S9 — Execution/Wdrożenie module acceptance checklist must PASS.

SSOT refs:
- docs/product/V3_SPRINT_PLAN_12_SPRINTS.md (Sprint S9)
- docs/product/EXECUTION_V3.md
- docs/ui-standards/** (module hub/view modes/preview pane)
- docs/product/V3_BACKORDER.md

V3 mapping: V3-G01 (+ any extension needed to satisfy SSOT).

Branch: sprints/S09-execution → Draft PR to main.

Scope IN:
- Execution hub with table/kanban/timeline + preview pane + quick actions.
- Signals (data-driven) and honest degraded mode when plan data missing.
- Minimal reporting and management actions (workarounds, timeline proposals propose→accept).

Checklist PASS/FAIL:
- 3 initiatives in execution show health summary in preview
- Quick action works and reflects in initiative
- Missing data shows "missing plan data" instead of fake metrics
```

---

## Prompt — Sprint Agent S10 (Results KPI/ROI + deviations + time-series)

```text
You are Sprint Agent S10.

Goal: Deliver Sprint S10 — Results v3 core+ acceptance checklist must PASS.

SSOT refs:
- docs/product/V3_SPRINT_PLAN_12_SPRINTS.md (Sprint S10)
- docs/product/RESULTS_V3.md
- docs/product/ROI_TRACKING_CONTRACT_V3.md
- docs/product/RESULTS_KPI_DEVIATION_MANAGEMENT_V3.md
- docs/ui-standards/03-modules/interactive-board-standard.md
- docs/product/V3_BACKORDER.md

V3 mapping: V3-H01..H06.

Branch: sprints/S10-results → Draft PR to main.

Scope IN:
- KPI table + mapping KPI↔initiative
- ROI plan vs realized
- Deviation workflow
- KPI time-series contract and drilldown

Checklist PASS/FAIL:
- KPI added and linked to initiative; tracking works
- KPI below threshold creates deviation case with fix plan
- Time-series view/chart works with consistent types
```

---

## Prompt — Sprint Agent S11 (Financial Analysis v3 core MVP)

```text
You are Sprint Agent S11.

Goal: Deliver Sprint S11 — Financial Analysis v3 core MVP acceptance checklist must PASS.

SSOT refs:
- docs/product/V3_SPRINT_PLAN_12_SPRINTS.md (Sprint S11)
- docs/product/FINANCIAL_ANALYSIS_V3.md
- docs/ui-standards/03-modules/interactive-board-standard.md
- docs/product/FINANCE_EXPORT_V3.md
- docs/product/V3_BACKORDER.md

V3 mapping: V3-I01 + new epic V3-I02 (per V3_ACTION_PLAN.md).

Branch: sprints/S11-financial-analysis → Draft PR to main.

Scope IN:
- Baseline modeling (zero-change)
- Analysis live→save + run library
- Forecast scenario baseline vs scenario
- Valuation DCF MVP + sensitivity
- Investment CAPEX MVP
- Export to report/deck/initiatives with traceability

Checklist PASS/FAIL:
- Create baseline → run analysis → save run
- Export report/deck from run; Open source returns to that run
```

---

## Prompt — Sprint Agent S12 (Deliverables Generators core, premium)

```text
You are Sprint Agent S12.

Goal: Deliver Sprint S12 — Report + Presentation generators core acceptance checklist must PASS.

SSOT refs:
- docs/product/V3_SPRINT_PLAN_12_SPRINTS.md (Sprint S12)
- docs/product/REPORT_GENERATOR_V3.md
- docs/product/REPORTING_CANONICAL_TEMPLATES.md
- docs/product/PRESENTATION_GENERATOR_V3.md
- docs/product/PRESENTATION_GENERATOR_VISUALS_IMPLEMENTATION_PLAN_V3.md
- docs/REPORT_BUILDER_EXPORTS_STANDARD.md
- docs/product/V3_BACKORDER.md

V3 mapping: V3-J01, V3-J02, V3-J03, V3-E13 + new epics V3-J04, V3-J05.

Branch: sprints/S12-generators-core → Draft PR to main.

Scope IN:
- Report Generator core: R1–R4 templates + Free mode + online artifact + quality gate + exports (PDF/DOCX).
- Presentation Generator core: deck builder + brand kit + smart diagrams MVP + animations baseline + exports (PPTX/PDF).
- Deterministic scaffolding (tool/assessment/finance → report/deck outline).

Checklist PASS/FAIL:
- From Initiative + ToolSession + Finance run: generate R2 report online → export PDF/DOCX
- Generate executive deck → edit 1 slide/block → export PPTX/PDF
- Source refs visible per section/block
```

