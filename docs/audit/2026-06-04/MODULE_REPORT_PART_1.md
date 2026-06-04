# Module UI/UX Report — Part 1 (2026-06-04)

Read-only per-module review. Reflects current code after Wave-1/2 fixes
(empty-on-failure fixed in DecisionInbox/InterviewHub/MeetingHub/AssessmentHub/Inbox;
violet→crimson sweep; `dark:text-slate-600`→`-400` sweep). Verified against current code:
`dark:text-slate-600` is now **0 across all five modules** — confirmed clean, not re-flagged below.

Canon inventory confirmed at: `src/components/shared/ModuleHub/*` (ModuleHub, ModuleNavBar,
FilterableTable, TableSettingsPopover), `src/components/shared/ModuleMenu3.tsx`,
`src/components/shared/Menu3/*`, `src/components/ui/composed/{DataTable,EmptyState}.tsx`,
`src/components/ui/ResizableTable`, `src/components/ui/primitives/*`
(Button, Modal, Drawer, Input, Select, Switch, Toggle, LoadingState, ErrorState, Spinner),
`src/components/ui/primitives/chips/*` (StatusChip/PriorityChip/MetaChip/ToolChip/DueChip),
`src/components/shared/RowActionsMenu.tsx`, `src/components/shared/PreviewPane`,
`src/components/shared/TableWithPreviewLayout.tsx`.

Method: ripgrep counts over each module dir. Counts include legitimate uses (e.g. AI
markdown/table renderers, data-driven inline colors, dark-mode-only `text-slate-300`); those
are called out as not-bugs where applicable.

---

## 1) Chat / Teresa — `src/components/Chat/**` + `src/components/AIChat/**`

This is a conversational surface, so low FilterableTable/EmptyState density is expected and
correct (it is not a list/grid module). `src/components/Chat/**` is tiny (4 action-card files)
and clean; the substance is in `src/components/AIChat/**`.

### a) Komponenty graficzne
- **Raw `fixed inset-0` overlays — 15**, across 14 files. Several are legit full-screen overlays
  (VoiceConversationOverlay, ChatOverlay), but modal-style ones bypass the `Modal`/`Drawer`
  primitives: `AIChat/ChatExportModal.tsx`, `AIChat/MoveToProjectModal.tsx`,
  `AIChat/CloudFilePicker.tsx`, `AIChat/BranchSelector.tsx`, `AIChat/ToolsMenu.tsx`,
  `AIChat/KimiWorkspace/templateLifecycle/TemplateGovernanceDrawer.tsx`. Only **1 file** imports
  the `Modal`/`dialog` primitive in all of AIChat.
- **Raw `<select>` — 18** across 9 files; off the main chat path (Wave admin panels:
  `Wave5ArtifactRuntimePanel.tsx`, `Wave6ContextLearningPanel.tsx`, `Wave7ConnectorAdminPanel.tsx`,
  `Wave8AgentCatalogPanel.tsx`, `V8ArtifactRunControl.tsx`, `MessageRenderer.tsx`,
  `ToolsMenu.tsx`, `WorkCanvasDocumentPanel.tsx`). Should use `primitives/Select`.
- **Raw `<table>` — 11**: the **majority are legitimate** — AI artifact / markdown renderers
  (`Artifacts/renderers/{TableRenderer,ComparisonMatrixRenderer,PMODocumentRenderer,MarkdownRenderer}.tsx`,
  `CanvasMarkdownRenderer.tsx`, `CanvasArtifactBlockRenderer.tsx`, `KimiWorkspace/tabelePreview/TabelePreviewLayout.tsx`).
  These render model output, not app data grids — acceptable. `AIOSWave0GateReport.tsx` is a
  hand-rolled report table that could move to DataTable.
- **Raw `type="checkbox"` — 12**, **hand-rolled kebab (`MoreVertical/Horizontal` not via RowActionsMenu) — 5 files**.

### b) Kolory (light + dark)
- **Off-brand `indigo` — 73 occurrences** (violet sweep missed indigo here). Worst:
  `AIChat/WorkCanvas/WorkCanvasShell.tsx` (20), `AIChat/AgentAudit/AgentSuggestionCard.tsx` (15),
  `AIChat/ResearchClarification.tsx` (11), `AIChat/MessageRenderer.tsx` (10),
  `AIChat/ResearchProgress.tsx` (6), `AIChat/AIActionCard.tsx` (3). Note the *partial* sweep
  pattern: gradients were changed to crimson but siblings kept indigo, e.g.
  `ResearchClarification.tsx:122` `from-crimson-50 ... border-indigo-200 dark:border-indigo-800/50`,
  and `AgentSuggestionCard.tsx:198` same combo. 3 lines carry both crimson+indigo on one className.
- **Hardcoded hex `[#15213b]` (navy) — 4**, all in `AIChat/WorkCanvasDocumentPanel.tsx:2260,2321,2373,3459`
  (`dark:bg-[#15213b]`, `bg-[#15213b]`). Should be `dark:bg-navy-900` token.
- **Inline `style` color — 8** (mostly diagram/artifact nodes; data-driven, acceptable).
- `text-slate-300` (281) and `dark:text-slate-500` (146): spot-checked — **all are dark-mode
  variants or voice/overlay dark surfaces** (e.g. `WorkCanvasDocumentPanel.tsx:2097,2252,2391` all
  `dark:text-slate-300`). No light-mode body-text contrast bug found. **Czysto** on the contrast axis.

### c) Uwagi (grafiki, kształty, UX, UI)
- Chat is not a Menu2/Menu3 shell module — conformance N/A; correct as a panel surface.
- Inconsistent modal shape/rounding because ad-hoc overlays don't share the `Modal` primitive's
  radius/shadow/backdrop tokens. Hand-rolled kebabs duplicate RowActionsMenu behavior.
- No empty-vs-error correctness defects observed on the chat path.

**Werdykt: MINOR**
Top 3 fixes: (1) finish the indigo→crimson sweep in AIChat (start: WorkCanvasShell, AgentSuggestionCard,
ResearchClarification/Progress, AIActionCard, MessageRenderer); (2) replace `[#15213b]` with
`navy-900` token in WorkCanvasDocumentPanel; (3) route ChatExportModal/MoveToProjectModal/CloudFilePicker/
BranchSelector through the `Modal`/`Drawer` primitive and Wave-panel `<select>`s through `primitives/Select`.

---

## 2) My Work — `src/components/MyWork/**`

Largest, most heterogeneous module (Tasks, Decisions, Notifications, Notebook, and 4 Idea tools).
Hub conformance is good — `MyWorkHub.tsx` is documented as the ModuleHub "Golden Standard" and
imports `ModuleMenu3`.

### a) Komponenty graficzne
- **Raw `fixed inset-0` overlays — 130** (highest of all modules). Concentrated in
  `MyWork/IdeaTableTool.tsx` (12 — canvas-tool popovers, partly legit), then
  `MyWork/{TaskDetailView,DecisionDetailView,NotificationsContent,IdeaRecommendationMap}.tsx` (3 each),
  `MyWork/table/{governed/GovernedModelsDashboard,RecordTemplateManager}.tsx` (3 each),
  `MyWork/table/{TableToolbar,FieldManager}.tsx`, `MyWork/shared/BulkEditPopovers.tsx`,
  `MyWork/{TaskInbox,NotificationsHub}.tsx` (2 each). Many are hand-rolled modals/popovers.
- **Raw `<select>` — 129** (highest). Worst: `MyWork/TaskDetailView.tsx` (11) and
  `MyWork/DecisionDetailView.tsx` (11) — these are primary detail panels and should use
  `primitives/Select`/`SelectField`; then `MyWork/table/FilterBuilder.tsx` (5),
  `MyWork/NotebookContent.tsx` (5), `MyWork/table/FormBuilder.tsx` (4),
  `MyWork/table/DateDependencyConfig.tsx` (4), `MyWork/shared/ImpactAssessmentCompact.tsx` (4).
- **Raw `<table>` — 25, raw `type="checkbox"` — 58**. Some `<table>` are in the custom spreadsheet
  table-tool (intentional), but detail/list views still hand-roll tables.

### b) Kolory (light + dark)
- **Off-brand `indigo`/`violet` — 200** (highest). Worst files:
  `MyWork/shared/DependenciesSection.tsx` (18), `MyWork/NotebookContent.tsx` (17),
  `MyWork/table/governed/GovernedModelsDashboard.tsx` (12), `MyWork/IdeaRecommendationMap.tsx` (12),
  `MyWork/notebook/NotebookCanonicalPathStrip.tsx` (11),
  `MyWork/table/extensions/ExtensionMarketplace.tsx` (8),
  `MyWork/table/connectors/WebhookRelayPanel.tsx` (8), `MyWork/knowledge/KnowledgeCardNodes.tsx` (8),
  `MyWork/IdeaContextPanel.tsx` (8). Same partial-sweep residue as Chat — e.g.
  `NotebookContent.tsx:1942` `from-crimson-500/10 ... border-indigo-500/20 dark:border-indigo-400/15`,
  `:2134` `from-crimson-500 via-primary-500 ... shadow-indigo-500/20`,
  `:2196` `from-crimson-50 to-primary-50 ... border-indigo-200/50`. Borders/shadows/icon text still indigo.
- **Hardcoded hex — 4** (`[#...]`); plus `CellRenderer.tsx:94,428` hardcode `color: '#334155'`
  and `:448` fallback `'#e0e7ff'` (indigo-tinted) in inline styles.
- **Inline `style` color — 87**: the **bulk are data-driven and legitimate** —
  `table/CollaborationPresence.tsx` (5: `user.color`, `editing.color`), `table/PresenceIndicators.tsx`,
  `table/CellRenderer.tsx` (option/label colors), `mindmap/CollaborationOverlay.tsx`,
  `table/views/{KanbanView,GalleryView}.tsx`. Not contrast bugs; only the hardcoded fallbacks above.
- Contrast: `dark:text-slate-600` = **0** (fixed). `dark:text-slate-500` (522) and `text-slate-300`
  (918) are dark-variant/secondary usages — no light-mode body-text bug surfaced. **Czysto** on contrast.

### c) Uwagi (grafiki, kształty, UX, UI)
- Hub/Menu conformance: good (MyWorkHub Golden Standard). The Idea canvas tools intentionally use
  free-form overlays (Miro-style), so much of the `fixed inset-0` count there is by-design.
- Biggest UI-consistency drag is the two detail views (`TaskDetailView`, `DecisionDetailView`):
  11 raw `<select>` each + 3 raw overlays each → inconsistent control shape vs the rest of the app.
- No empty-vs-error defects observed (Inbox empty-on-failure already fixed per Wave-1).

**Werdykt: NEEDS-WORK** (volume of strays is the issue, not correctness)
Top 3 fixes: (1) migrate `TaskDetailView.tsx` + `DecisionDetailView.tsx` controls to
`primitives/Select` + the `Modal` primitive (removes 22 `<select>` + 6 overlays at once);
(2) finish indigo→crimson in the top offenders (DependenciesSection, NotebookContent,
GovernedModelsDashboard, IdeaRecommendationMap, NotebookCanonicalPathStrip); (3) replace
hardcoded `#334155`/`#e0e7ff` fallbacks in `table/CellRenderer.tsx` with slate/primary tokens.

---

## 3) Interview / Wywiad — `src/components/Interview/**`

### a) Komponenty graficzne
- **Raw `fixed inset-0` — 12**, **raw `<select>` — 14**, **raw `type="checkbox"` — 26**,
  **raw `<table>` — 7**. Moderate; spread across TemplateBuilder and the various modals
  (`AssignInterviewModal`, `NewSessionModal`, `InsightCreatorModal`).
- `InterviewHub.tsx` conforms to canon: imports `ModuleHub`, `GridView`, `ModuleMenu3`,
  `EmptyStateInline`. Good.

### b) Kolory (light + dark)
- **Off-brand indigo — only 2** (small, isolated): `Interview/InsightViewer.tsx:5796`
  (`bg-indigo-500/10 ... text-indigo-600`) and `Interview/InterviewSummary.tsx:246`
  (`bg-indigo-500 hover:bg-indigo-600` primary button — should be crimson/primary).
- **Hardcoded hex — 3**: `Interview/TemplateBuilder.tsx:1598` (`dark:bg-[#151E32]`),
  `:2501` (`dark:bg-[#0F172A]` / `dark:hover:bg-[#151E32]`), `Interview/InterviewWorkspace.tsx:2334`
  (`dark:via-[#0a0f1e]`). Should be navy tokens.
- Contrast: `dark:text-slate-600` = **0** (fixed). `text-slate-300` (141) / `dark:text-slate-500`
  (108) are dark-variant usages — **czysto** on light-mode body contrast.

### c) Uwagi (grafiki, kształty, UX, UI)
- Empty-vs-error correctness: **verified fixed** — `InterviewHub.tsx:769` tracks `loadError` and
  **renders** a dedicated error card at `:6488` (distinct from empty), not an empty-on-failure.
  Note: it is a hand-rolled amber card rather than the canonical `ErrorState` primitive — works,
  but inconsistent with DecisionInbox/AssessmentHub which use `ErrorState`+retry.
- Otherwise consistent shell; TemplateBuilder is the most ad-hoc surface (hex + selects).

**Werdykt: MINOR**
Top 3 fixes: (1) swap the 2 indigo spots (InsightViewer, InterviewSummary primary button) to
crimson/primary; (2) tokenize the 3 `[#…]` navy hex in TemplateBuilder/InterviewWorkspace;
(3) replace InterviewHub's hand-rolled error card with the canonical `ErrorState` (+retry) for
cross-module consistency.

---

## 4) Decisions / Decyzje — `src/components/Decisions/**`

Cleanest module of the five. Small, focused (DecisionCard, DecisionInbox, DecisionsByInitiative,
DecisionsHub, EscalationDashboard).

### a) Komponenty graficzne
- **Raw `fixed inset-0` — 0. Raw `<table>` — 0. Raw `type="checkbox"` — 0.** Excellent.
- **Raw `<select>` — 2** (only stray control type). `animate-spin` — 3 (inline spinners).
- Canon usage present: DecisionInbox/DecisionsByInitiative/EscalationDashboard use the chip/state
  primitives; DecisionsHub imports `ModuleMenu3`.

### b) Kolory (light + dark)
- **Off-brand indigo — 1**: `Decisions/DecisionCard.tsx:81` —
  `RESOURCE_ALLOCATION: { ... color: 'text-indigo-600' }` (a category icon color). Trivial.
- **Hardcoded hex — 0. Inline style color — 0.**
- Contrast: `dark:text-slate-600` = **0**; `text-slate-300` (7) / `dark:text-slate-500` (12) are
  dark-variant secondary usages. **Czysto.**

### c) Uwagi (grafiki, kształty, UX, UI)
- Empty-vs-error correctness: **verified fixed** — `DecisionInbox.tsx:288` renders
  `<ErrorState message={loadError} retry={...} />` on hard failure (not empty). Canonical pattern,
  good reference implementation for the other modules.
- Shell/shape consistency good; no UX dead-ends observed.

**Werdykt: PASS**
Top 3 fixes (polish only): (1) change `DecisionCard.tsx:81` `text-indigo-600` →
`text-primary-600`/`text-crimson-600`; (2) move the 2 raw `<select>` to `primitives/Select`;
(3) confirm the 3 inline `animate-spin` use the `Spinner`/`LoadingState` primitive for consistency.

---

## 5) Assessment — `src/components/Assessment/**`

Large module (frameworks, reports, initiatives, RapidLean, ADMA/DRD maps). Hub conforms:
`AssessmentHub.tsx` imports `ModuleHub`, `FilterableTable` from shared.

### a) Komponenty graficzne
- **Raw `fixed inset-0` — 47**. Worst: `Assessment/manage/InitiativesManagementPanel.tsx` (5),
  `Assessment/AssessmentWorkflowPanel.tsx` (4), `Assessment/modals/{ReportTemplatePickerModal,
  InitiativeDetailsModal}.tsx` (3 each), `Assessment/AssessmentVersionDiff.tsx` (3). Many modals
  bypass the `Modal` primitive despite a dedicated `modals/` folder existing.
- **Raw `<select>` — 41**. Worst: `Assessment/modals/ReportTemplatePickerModal.tsx` (7),
  `Assessment/manage/InitiativesManagementPanel.tsx` (6),
  `Assessment/InitiativesGenerationWizardModal.tsx` (4), `Assessment/MultiFwBenchmarkComparison.tsx` (3),
  `Assessment/{InitiativeGeneratorWizard,InitiativeEditor}.tsx` (3 each).
- **Raw `<table>` — 18** (reports/benchmark tables; some legit report templates), **`type="checkbox"` — 11**.

### b) Kolory (light + dark)
- **Off-brand indigo — 27**. Worst: `Assessment/manage/InitiativesManagementPanel.tsx` (6),
  `Assessment/reports/templates/ADMAReportTemplate.tsx` (5), `Assessment/AssessmentStageGate.tsx` (4,
  a full color set at `:202-205` `bg/light/text/border-indigo-*`),
  `Assessment/manage/TeamManagementPanel.tsx` (3), and 2 in `AssessmentHub.tsx:1847-1848`
  (`text-indigo-600 dark:text-indigo-300`, `bg-indigo-500/20 border-indigo-500/30`).
- **Hardcoded hex — 0. Inline style color — 1** (negligible).
- Contrast: `dark:text-slate-600` = **0** (fixed); `text-slate-300` (310) / `dark:text-slate-500`
  (126) are dark-variant/secondary — no light-mode body-text bug surfaced. **Czysto** on contrast.

### c) Uwagi (grafiki, kształty, UX, UI)
- Empty-vs-error correctness: **verified fixed** — `AssessmentHub.tsx:1687-1689` renders
  `<ErrorState message={loadWarning} retry={refreshData} />` on hard failure (with cached-data
  fallback comment). Correct.
- The `AssessmentStageGate.tsx:202-205` indigo color set is a brand color token that should map to
  crimson/primary — most visible off-brand surface in the module.
- Modal-shape inconsistency: a `modals/` directory exists but several modals (ReportTemplatePicker,
  InitiativeDetails) still hand-roll `fixed inset-0` + raw `<select>` instead of the `Modal` primitive.

**Werdykt: NEEDS-WORK** (driven by modal/select volume + indigo, not correctness)
Top 3 fixes: (1) convert `ReportTemplatePickerModal` + `InitiativesManagementPanel` to the `Modal`
primitive + `primitives/Select` (clears 13 `<select>` + several overlays); (2) replace the
`AssessmentStageGate.tsx:202-205` indigo color set and `AssessmentHub.tsx:1847-1848` with
crimson/primary; (3) sweep remaining indigo in `ADMAReportTemplate.tsx` and `TeamManagementPanel.tsx`.

---

## Cross-module summary

| Module | fixed inset-0 | raw `<select>` | indigo | hex | dark:slate-600 | Werdykt |
|---|---|---|---|---|---|---|
| Chat/Teresa | 15 | 18 | 73 | 4 | 0 | MINOR |
| My Work | 130 | 129 | 200 | 4 | 0 | NEEDS-WORK |
| Interview | 12 | 14 | 2 | 3 | 0 | MINOR |
| Decisions | 0 | 2 | 1 | 0 | 0 | PASS |
| Assessment | 47 | 41 | 27 | 0 | 0 | NEEDS-WORK |

**Systemic theme:** the violet→crimson sweep was *partial* — it changed gradient/background fills
to crimson but left `indigo` on borders, icon text, and shadows in the same classNames (visible in
Chat, MyWork, Assessment). Recommend a second targeted `indigo-*`→`crimson-*`/`primary-*` pass.
Contrast (`dark:text-slate-600`) and empty-on-failure fixes are **all confirmed landed** — none
re-flagged as open. Decisions is the reference-quality module (canonical ErrorState+retry, zero strays).
