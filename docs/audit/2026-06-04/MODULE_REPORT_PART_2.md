# Module UI/UX Report — Part 2 (Modules 6–11)

Date: 2026-06-04 · Branch: `feat/wave1-foundations` · Read-only audit (no code edits).
Reflects current code after Wave-1/2 fixes (MeetingHub empty-on-failure fixed; violet→crimson; `dark:text-slate-600`→`-400`; gradients de-violeted).

Canon reference: `ExecutionHub.tsx` = Menu-3 SSOT. `EconomicsHub.tsx` is DEAD — `src/views/EconomicsView.tsx:22` renders `<FinanceHub />` (confirmed). Note: `text-slate-300/400` raw greps below were filtered for true light-mode body use; most hits are legitimate `dark:text-slate-300/400`.

---

## 6) Tools / Narzędzia (`src/components/DiscoveryTools/**`, 68 tsx)

**a) Komponenty graficzne** — Tools is NOT a ModuleHub module by design: it is a wizard/workspace shell (`ToolWorkspace.tsx`, `ToolCanvas.tsx`, `ToolWizardView.tsx`, step components). It does not host `ModuleHub`/`ModuleNavBar`/`Menu3` and is not expected to. It correctly consumes `LoadingState` (`ToolDocumentView.tsx:18,1939`) and `RowActionsMenu` (`shared/ProposalCard.tsx`). Stray ad-hoc: raw `fixed inset-0` modals in `GenerateInitiativesModal.tsx:1`, `ToolDocumentView.tsx:1`, `ToolWorkspace.tsx:1`; raw `<select>` is pervasive across the wizard step files (45+ across `tools/**` and `steps/**` — e.g. `tools/RiskUncertainty/RisksStep.tsx` ×4, `tools/PortfolioPriority/PortfolioItemsStep.tsx` ×5, `tools/Operational/OperationalSectionStep.tsx` ×4, `tools/Digital/GenericDomainStep.tsx` ×4); raw `type="checkbox"` in `GenerateInitiativesModal.tsx`, `ToolDocumentView.tsx`, `ToolReviewPanel.tsx`, `steps/SummaryStep.tsx`; raw `animate-spin` in `GenericToolDocumentView.tsx:1`, `shared/ToolPhaseAiActions.tsx:1`, `tools/DynamicSWOT/SWOTBuildPhase.tsx:1`. No raw `<table>` of consequence (only `ProcessAutomation/ProcessMapWorkSurface.tsx:1`). No hand-rolled kebabs.

**b) Kolory (light + dark)** — Hardcoded hex is concentrated in the library/visualization graphics (`DynamicSwotLibraryGraphic.tsx`, `GrowthPathsLibraryGraphic.tsx`, `MarketForcesLibraryGraphic.tsx`, `PortfolioPriorityLibraryGraphic.tsx`, `RiskUncertaintyLibraryGraphic.tsx`, `visualizations/PorterRadar.tsx` ×5) — illustrative SVG fills, lower priority. `steps/ContextStep.tsx:1292` and `tools/DynamicSWOT/SWOTInputExplorationPhase.tsx:812` use long `bg-[radial-gradient(...rgba()...)]` arbitrary gradients with embedded `#0b1020/#0a0f1b` dark hexes — ContextStep already uses crimson `rgba(165,28,48,...)` (on-brand), but SWOTInputExplorationPhase still uses sky `rgba(14,165,233,...)` (off-brand accent). No off-brand violet/purple in this module. Light-body contrast risk: `text-slate-300` true light use in graphics only (acceptable). `dark:text-slate-500` lingering in `ToolDocumentView.tsx` (14), `KnownToolDetailView.tsx` (14), `ToolHeader.tsx:1`, `ToolActionBar.tsx:1`, `steps/SummaryStep.tsx` (2), `tools/DynamicSWOT/SWOTInsightsPhase.tsx` (6).

**c) Uwagi** — Shell conformance N/A (intentional wizard shell). Main debt is form-control consistency: the wizard step layer never adopted `SelectField`/`Switch`, so dozens of raw `<select>`/checkbox controls give it a different feel from the Hub modules. Arbitrary-radius `rounded-[30px]` cards (ContextStep, SWOTInputExplorationPhase) break the standard `rounded-2xl` rhythm. No major UX dead-ends.

**Werdykt: MINOR**
Top 3: (1) migrate wizard `<select>`/checkbox → `SelectField`/`Switch` across `tools/**`+`steps/**`; (2) recolor `SWOTInputExplorationPhase.tsx:812` sky gradient → crimson/neutral; (3) sweep remaining `dark:text-slate-500` in `ToolDocumentView`/`KnownToolDetailView`.

---

## 7) Initiatives / Inicjatywy (`src/components/Initiatives/**`, 60 tsx)

**a) Komponenty graficzne** — `InitiativesHub.tsx` is the canonical entry: imports `ModuleHub` (`:64`), renders `<ModuleHub>` (`:1756`), uses `ModuleMenu3` constants (`:79`) and `useModuleOpenDocuments`. Good canon adoption (18 files touch shared components). `RowActionsMenu` used in `InitiativeDocumentView.tsx`, `InitiativeFullView.tsx`, `sections/InitiativeGatesWorkflowTable.tsx`; `EmptyState`/`ErrorState` widely used in sections. Stray ad-hoc is heaviest in the section/editor layer: raw `fixed inset-0` modals across ~16 section files (`sections/DecisionsSection.tsx` ×2, `sections/TimelinePlanner.tsx` ×2, `sections/TasksMilestonesSection.tsx` ×2, `InitiativeDocumentView.tsx` ×2, `Wizard/InitiativeWizardModal.tsx`, `sections/InitiativeTeamComposerModal.tsx`, etc.); raw `<table>` in `sections/ResourcesSection.tsx` ×4, `sections/TimelineSection.tsx` ×2, `sections/DependenciesSection.tsx` ×2, `InitiativeDocumentView.tsx`, plus `Analysis/*`; raw `<select>` is extreme in `sections/TimelinePlanner.tsx` (46!) and `sections/ResourcesSection.tsx` (9), `InitiativeDocumentView.tsx` (8); hand-rolled kebabs (`MoreVertical/Horizontal`) in `InitiativeDocumentView.tsx`, `sections/TasksMilestonesSection.tsx`, `sections/KpisSection.tsx`, `sections/TimelinePlanner.tsx`, `sections/ResourcesSection.tsx`, `sections/DecisionsSection.tsx` (not using `RowActionsMenu`).

**b) Kolory (light + dark)** — Off-brand: `InitiativeCompactPanel.tsx:931` `text-purple-500`; `InitiativesHub.tsx:1703` `bg-fuchsia-400` dot; `sections/TimelinePlanner.tsx:3331,3357,4130` and `sections/TimelineSection.tsx:1490` use `fuchsia-*` for critical-path highlighting (semantic but off the crimson/navy palette). `Analysis/DependencyGraphCanvas.tsx` carries 9 hardcoded hex (canvas node colors). Dark contrast: `dark:text-slate-500` still in `InitiativeDocumentView.tsx` (18), `sections/InitiativeGatesWorkflowTable.tsx` (8), `sections/ScopeSection.tsx` (6), `sections/GateReadinessSection.tsx` (2), `InitiativeCompactPanel.tsx` (2), `InitiativeNotionView.tsx` (2), `InitiativeDetailCard.tsx:1`.

**c) Uwagi** — Hub shell itself conforms well; the debt lives entirely in the dense section/editor sub-system (TimelinePlanner especially is a hand-rolled Gantt with 46 selects + custom kebabs). Empty/error states are present and used. Shape consistency is good at Hub level. The fuchsia critical-path accent is the most visible brand deviation.

**Werdykt: NEEDS-WORK**
Top 3: (1) refactor `sections/TimelinePlanner.tsx` raw `<select>`×46 + kebabs to canon (`SelectField`/`RowActionsMenu`); (2) replace `fuchsia-*` critical-path styling with a brand-aligned accent (crimson/amber) in TimelinePlanner/TimelineSection; (3) fix `InitiativeCompactPanel.tsx:931` `text-purple-500`, `InitiativesHub.tsx:1703` `bg-fuchsia-400`, and sweep `dark:text-slate-500` in `InitiativeDocumentView`.

---

## 8) Execution / Realizacja (`src/components/Execution/**`, 24 tsx)

**a) Komponenty graficzne** — `ExecutionHub.tsx` is the Menu-3 SSOT: imports `ModuleHub`, `FilterableTable`, `FilterChip`, `HubWorkAreaLoadError`, `HubWorkAreaLoading` (`:88-98`) and the `MENU_3_*` constants from `ModuleMenu3` (`:99-106`); also `TableWithPreviewLayout` (`:53`) and `LoadingState` (`:54`). Renders `<ModuleHub>` at `:4707`. Exemplary canon usage. Stray ad-hoc is modest: raw `fixed inset-0` in `ExecutionWorkloadView.tsx:1`, `ExecutionTimelineView.tsx:1`, `ReportCompactPanel.tsx:1`, `ExecutionDetailPanel.tsx:1`; raw `<table>` in `ReportDocumentView.tsx`, `RolloutTab.tsx`; raw `<select>` in `ExecutionTimelineView.tsx` ×5, `RolloutTab.tsx` ×3, `MitigationPanel.tsx` ×2, `DelayDetectionPanel.tsx` ×2, `BudgetControlPanel.tsx`, `ExecutionHub.tsx:1`; one hand-rolled kebab in `Manager/ProblemTable.tsx`. EmptyState/ErrorState present (`ExecutionHub.tsx` ×3, `KPIDashboard.tsx`, `BenefitsTracker.tsx`, `RolloutTab.tsx`).

**b) Kolory (light + dark)** — No off-brand violet/purple/fuchsia. Hardcoded hex in `ExecutionTimelineView.tsx` (6, Gantt bars) and `RolloutTab.tsx:1` — chart/timeline fills. Dark contrast: `dark:text-slate-500` in `ExecutionHub.tsx` (12), `ReportDocumentView.tsx` (10), `ReportCompactPanel.tsx` (7), `Manager/ProblemPreview.tsx` (5), `ExecutionInitiativesKanbanView.tsx` (4), `Manager/ProblemTable.tsx` (3), `RolloutTab.tsx` (3), `Manager/AiRecommendationPanel.tsx` (3), `CorrectiveActions.tsx` (2). Otherwise largely czysto on palette.

**c) Uwagi** — Best-conforming module of the group; shell, Menu-3, empty-vs-error, and table layout all canonical. Remaining work is the analytical sub-panels (timeline/rollout/manager) that still use raw selects and a few hex chart colors. Shape/rounding consistent. No dead-ends found.

**Werdykt: MINOR**
Top 3: (1) sweep `dark:text-slate-500`→`-400` in `ExecutionHub`/`ReportDocumentView`/`ReportCompactPanel`; (2) migrate raw `<select>` in `ExecutionTimelineView`/`RolloutTab`/`MitigationPanel` to `SelectField`; (3) `Manager/ProblemTable.tsx` kebab → `RowActionsMenu`.

---

## 9) Results / Rezultaty (`src/components/Results/**`, 22 tsx)

**a) Komponenty graficzne** — `ResultsHub.tsx` canonical: imports `ModuleHub` (`:20`), `HubWorkAreaLoadError` (`:18`), `FilterChip` (`:19`), `useModuleOpenDocuments`. `RowActionsMenu` used in `ResultsInitiativesView.tsx`, `KpiQueueView.tsx`, `ResultsKpisTableV3.tsx`, `ResultsKpiReportsView.tsx` (good). Stray ad-hoc: raw `<table>` in `ResultsKPITable.tsx`, `ResultsInitiativesView.tsx`, `ROIDetailDrawer.tsx`, `ROIAssumptionEditor.tsx`, `ROITrackingView.tsx`, `ROIAnalysisView.tsx`, `KPITimeSeriesDrawer.tsx`; real `fixed inset-0` modals in `KPICreateModal.tsx`, `ROIOpenModal.tsx`, `ROIDetailDrawer.tsx`, `KPITimeSeriesDrawer.tsx`, `ROIAnalysisView.tsx` ×2, `ROITrackingView.tsx` ×2 (NOTE: `ResultsKPITable.tsx` ×3 and several others are dropdown backdrop click-catchers `fixed inset-0 z-40` with no panel — acceptable, not modals); raw `<select>` in `KPITimeSeriesDrawer.tsx` ×3, `KPICreateModal.tsx` ×2, `ResultsReportingEnterpriseViews.tsx` ×2; hand-rolled kebabs in `ResultsKPITable.tsx`, `ROIAnalysisView.tsx`, `ROITrackingView.tsx`; raw `type="checkbox"` in `ResultsReportingEnterpriseViews.tsx` ×2, `AnalysisCatalog`-style selectors.

**b) Kolory (light + dark)** — Off-brand fuchsia in `ResultsKpisTableV3.tsx:458,459,635` (`bg-fuchsia-500`, `text-fuchsia-400/300`) used as a category/status accent. Light-body risk minimal. Dark contrast comparatively clean here — only `AnalysisResultsPanel`-adjacent files; `dark:text-slate-500` not flagged heavily in Results (mostly legitimate `dark:text-slate-300/400`). Mostly czysto aside from the fuchsia accents.

**c) Uwagi** — Hub conforms; ROI/KPI drill-down views (`ROIAnalysisView`, `ROITrackingView`, `ResultsKPITable`) carry the raw-table + custom-kebab debt and a couple of real `fixed inset-0` modals that should move to `Modal`/`Drawer`. Shape consistency OK. The fuchsia category color is the brand deviation.

**Werdykt: MINOR**
Top 3: (1) replace `fuchsia-*` in `ResultsKpisTableV3.tsx:458-459,635` with brand palette; (2) convert real `fixed inset-0` modals (`ROIOpenModal`, `KPICreateModal`, `ROIDetailDrawer`) to canon `Modal`/`Drawer`; (3) `ResultsKPITable`/`ROIAnalysisView`/`ROITrackingView` raw tables + kebabs → `FilterableTable`/`RowActionsMenu`.

---

## 10) Finance / Finanse (`src/components/Economics/**`, 33 tsx) — `FinanceHub.tsx` live, `EconomicsHub.tsx` DEAD

**a) Komponenty graficzne** — `FinanceHub.tsx` is live (confirmed `EconomicsView.tsx:22` → `<FinanceHub/>`); imports `ModuleHub` (`:63`), `ModuleMenu3` (`:78`), `getMenu3AiButtonClass`, `useModuleOpenDocuments`; renders `<ModuleHub>` at `:2130`. `RowActionsMenu` wired via `hooks/useFinanceRowActions.ts` (good). `EconomicsHub.tsx` is dead code (only self + `index.ts` reference) and still carries a stray `animate-spin` — should be removed. Stray ad-hoc in live files: real `fixed inset-0` modals in `AnalysisCreateModal.tsx`, `ExcelImportWizard.tsx`, `PDFExportModal.tsx`, `DigitizationToolTab.tsx`, `BenefitsTrackingDashboard.tsx`, `AnalysisCompareView.tsx`, `FinanceHub.tsx:1`, and the `modals/Create*Modal.tsx` set; raw `<table>` in `AnalysisCatalog.tsx`, `FinanceModelDocumentView.tsx`, `FinancePreviewPanel.tsx` ×2, `BenefitsTrackingDashboard.tsx`; raw `<select>` in `modals/CreateModelModal.tsx` ×3, `AnalysisCreateModal.tsx` ×2, `EvidencePanel.tsx`, `AnalysisCatalog.tsx`, etc.; hand-rolled kebabs in `AnalysisCatalog.tsx`, `FinancePreviewPanel.tsx`; raw `animate-spin` widespread (`AIRecommendationsPanel.tsx` ×2, `VersionHistoryPanel.tsx` ×3, `FinancialAnalysisPanel.tsx` ×3). `FinanceDegradedBanner.tsx` correctly uses a Banner pattern.

**b) Kolory (light + dark)** — OFF-BRAND BLOCKER: `FinanceHub.tsx:1180` CTA button `bg-purple-600 ... hover:bg-purple-700` (violet survived the sweep — should be crimson). `financeTypes.ts:266,282` `text-fuchsia-500/border-l-fuchsia-500` (investment lane accent) and `FinancePreviewPanel.tsx:679` `text-fuchsia-600` are off-brand semantic colors. Hardcoded hex in chart components `SensitivityChart.tsx` (10), `CashFlowChart.tsx` (10), `AnalysisCompareView.tsx` (5), `BenefitsTrackingDashboard.tsx` (7), `FinancialAnalysisPanel.tsx` (4), `types.tsx` (13) — chart palettes, lower priority but should tokenize. Dark contrast: `dark:text-slate-500` heavy — `AnalysisCatalog.tsx` (13), `AIRecommendationsPanel.tsx` (9), `VersionHistoryPanel.tsx` (8), `EvidencePanel.tsx` (7), `ExcelImportWizard.tsx` (5), `DigitizationToolTab.tsx` (5), `InitiativeLinkingPanel.tsx` (4), `InitiativeFinancialIntegration.tsx` (4), `FinancialInputForm.tsx` (4).

**c) Uwagi** — Largest, busiest module; Hub shell conforms but the surrounding analysis/modal/chart ecosystem carries the most stray ad-hoc (modals, tables, selects, spinners) and the worst dark-contrast debt. The `bg-purple-600` CTA is a visible brand regression. Dead `EconomicsHub.tsx` should be deleted to avoid confusion.

**Werdykt: NEEDS-WORK**
Top 3: (1) fix `FinanceHub.tsx:1180` `bg-purple-600`→`bg-crimson-600` (and `financeTypes.ts:266,282` / `FinancePreviewPanel.tsx:679` fuchsia lane accents); (2) sweep `dark:text-slate-500`→`-400` in `AnalysisCatalog`/`AIRecommendationsPanel`/`VersionHistoryPanel`/`EvidencePanel`; (3) delete dead `EconomicsHub.tsx` and migrate `modals/Create*Modal.tsx` + `AnalysisCreateModal` raw `fixed inset-0` to canon `Modal`.

---

## 11) Meeting / Spotkania (`src/components/Meeting/**`, 1 tsx + smoke test)

**a) Komponenty graficzne** — Single-file module `MeetingHub.tsx`. Consumes canon: `FilterableTable` + `TableColumn` from `ModuleHub` (`:24`), `Menu3Row` (`:26`), `getMenu3AiButtonClass` (`:25`), `useModuleOpenDocuments` (`:27`), and `ErrorState`/`LoadingState`/`StatusChip` from primitives (`:37`). Stray ad-hoc: 5× raw `fixed inset-0` modal shells (`:719,824,872,927,1053`) instead of canon `Modal`; 2× raw `animate-spin`. No raw `<table>` (uses FilterableTable), no raw `<select>`, no hand-rolled kebabs.

**b) Kolory (light + dark)** — Brand color present but HARDCODED as hex: `text-[#A51C30]` (`:932`) and `bg-[#A51C30] ... hover:bg-[#8a1828]` CTAs (`:1036,1188`). `#A51C30` IS the HBS crimson brand, and a `crimson` Tailwind palette exists (`tailwind.config` `crimson:` + `--accent` in `index.css`), so these should be `bg-crimson-600`/`text-crimson-600`, not arbitrary `[#…]`. Dark contrast: `dark:text-slate-500` ×2 remaining; `text-slate-400` light-body hits ×8 (verify which are true light vs `dark:`). No off-brand violet/purple.

**c) Uwagi** — Empty-vs-error is CORRECT post-fix: `loadError` state set in `catch` (`:118`) and rendered as `<ErrorState message=… retry=…>` (`:628-629`), distinct from the empty path — the Wave-1 fix landed and verified. Menu-3 header/AI-button conform via `getMenu3AiButtonClass`/`Menu3Row`. Main residual debt is the 5 hand-rolled modal shells and the hardcoded brand hex (should be tokenized for theme consistency).

**Werdykt: MINOR**
Top 3: (1) replace `[#A51C30]`/`[#8a1828]` literals (`:932,1036,1188`) with `crimson` palette classes; (2) migrate the 5 `fixed inset-0` modal shells to canon `Modal`; (3) sweep remaining `dark:text-slate-500`→`-400` and verify the `text-slate-400` light-body hits.

---

## Summary verdicts
| # | Module | Verdykt |
|---|--------|---------|
| 6 | Tools / Narzędzia | MINOR |
| 7 | Initiatives / Inicjatywy | NEEDS-WORK |
| 8 | Execution / Realizacja | MINOR |
| 9 | Results / Rezultaty | MINOR |
| 10 | Finance / Finanse | NEEDS-WORK |
| 11 | Meeting / Spotkania | MINOR |

Cross-cutting top fixes: (1) eliminate residual off-brand violet/fuchsia — `FinanceHub.tsx:1180 bg-purple-600`, `financeTypes.ts:266/282`, `ResultsKpisTableV3.tsx:458-459`, Initiatives Timeline fuchsia critical-path, `InitiativeCompactPanel.tsx:931`; (2) finish `dark:text-slate-500`→`-400` sweep (Finance + Initiatives `InitiativeDocumentView` are heaviest); (3) standardize form controls/modals — raw `<select>` and `fixed inset-0` shells dominate Initiatives `TimelinePlanner` (46 selects), Finance modals, and Tools wizard steps; delete dead `EconomicsHub.tsx`.
