# UI/UX Audit Execution Board

Status: `ACTIVE`
Date: 2026-05-03
Scope: `Consultify all module cards`
Parent documents:
- `docs/ui-standards/UI_UX_MIGRATION_AUDIT.md`
- `docs/ui-standards/UI_UX_MIGRATION_PLAN.md`
- `docs/ui-standards/CONSULTIFY_UI_UX_GOLDEN_STANDARD.md`
- `docs/ui-standards/CONSULTIFY_UI_UX_OPERATING_STANDARD.md`

## 1. Purpose

This board preserves execution context across long multi-card migration work.

Each card must always have:

- current status,
- last audit decision,
- concrete fix scope,
- acceptance checks,
- next owner action.

If it is not in this board, it is not considered in active migration execution.

## 2. Workflow States (single source for progress)

| State | Meaning |
|---|---|
| `NOT_STARTED` | Card exists in scope but has not been audited in this run. |
| `AUDIT_IN_PROGRESS` | Static/runtime audit in progress. |
| `AUDIT_DONE` | Gaps are identified and approved for implementation. |
| `FIX_IN_PROGRESS` | UI/UX migration changes are being implemented. |
| `VERIFY_IN_PROGRESS` | Visual/manual verification against checklist. |
| `DONE` | Card accepted against DBR77 2027 standard. |
| `BLOCKED` | Needs decision/standard update before continuing. |

## 3. Mandatory evidence package per card

- light mode screenshot,
- dark mode screenshot,
- active `Menu 3` screenshot,
- selected row screenshot (with checkbox reveal),
- table settings popover screenshot (when configurable),
- degraded/empty/error screenshot (if flow exists),
- short code reference for each material deviation.

## 4. Wave plan (context lock)

| Wave | Scope | Goal | Exit condition |
|---|---|---|---|
| `A` | `My Work (Ideas/Decisions/Inbox/Tasks)`, all `Interview`, `Discovery Tools`, `Assessment` | Lock highest-traffic table patterns | All P0/P1 cards have `AUDIT_DONE` and implementation tasks |
| `B` | `Execution`, `Results`, `Economics`, `Finance`, `Meeting`, `Reports & Presentations` | Remove module-level pattern drift | All cards have mapped status colors and Menu 3 compliance |
| `C` | `Benefits`, `Report Builder`, `Decisions standalone`, `Megatrends`, `Discovery legacy`, selected `AI OS` surfaces | Resolve non-standard or low-priority areas | No unresolved `STANDARD_NEEDED` without owner decision |
| `D` | `Admin`, `SuperAdmin` (risk slices first) | Control-plane governance consistency | No critical governance UX gaps in high-risk surfaces |

## 5. Active execution queue

| Order | Card | Wave | Current state | Decision | Priority | Why now |
|---|---|---|---|---|---|---|
| 1 | `My Work > Inbox` | `A` | `DONE` | `REFACTOR` | `P1_HIGH` | Highest trust-risk gaps (status access + AI trigger behavior) |
| 2 | `My Work > Tasks` | `A` | `DONE` | `REFACTOR` | `P1_HIGH` | Shares same shell and command-row contracts as Inbox |
| 3 | `Interview > all tabs` | `A` | `DONE` | `REFINE_REFERENCE` | `P1_HIGH` | Keep recent migration stable and regression-free |
| 4 | `Discovery Tools` | `A` | `DONE` | `REFACTOR` | `P1_HIGH` | Known local color/status map drift |
| 5 | `Assessment` | `A` | `DONE` | `REFACTOR` | `P1_HIGH` | Dynamic local color classes must be normalized |
| 6 | `Execution` | `B` | `DONE` | `REFACTOR` | `P1_HIGH` | Manager surface has parallel command-row and local semantic color drift |
| 7 | `Results` | `B` | `DONE` | `REFACTOR` | `P1_HIGH` | CTA labeling and KPI semantic colors still contain local drift |
| 8 | `Economics` | `B` | `DONE` | `REFACTOR` | `P1_HIGH` | Finance actions still needed migration to canonical Menu 3 right slot |
| 9 | `Meeting` | `B` | `DONE` | `REFACTOR` | `P1_HIGH` | App-table actions and topbar CTA count/style drifted from canonical ModuleHub |
| 10 | `Reports & Presentations` | `B` | `DONE` | `REFACTOR` | `P1_HIGH` | Trust/status semantic color map includes off-contract palettes (`purple/cyan`) |

## 6. Card audit logs (current run)

### 6.1 My Work > Inbox

Status: `DONE`
Decision: `REFACTOR`
Priority: `P1_HIGH`
Primary files:
- `src/components/MyWork/MyWorkHub.tsx`
- `src/components/MyWork/InboxContent.tsx`

Required changes:

1. Add explicit Inbox status controls in command row (`Open / Done / Saved`) wired to `inboxStatusTab`.
2. Add canonical right-side `Menu 3` slot actions for Inbox context (without duplicate actions in canvas/preview).
3. Stop implicit auto-run AI on preview open; require explicit user action or a visible user preference.
4. Normalize table chips and due/risk styling to DBR77 2027 Color Contract (`rose/amber/slate`, no ad-hoc `red/orange` semantics).
5. Align selected/focused row state with App Table contract (`primary` + visible left accent and ring).

Acceptance checks:

- User can switch to done/completed bucket from visible UI controls.
- No hidden AI execution on record open in preview.
- Light/dark chip readability passes; no conflicting local status palette.
- Row selection and checkbox reveal follow App Table canonical behavior.
- `Settings2` popover remains stable (columns + row description persistence).

### 6.2 My Work > Tasks

Status: `DONE`
Decision: `REFACTOR`
Priority: `P1_HIGH`
Primary files:
- `src/components/MyWork/MyWorkHub.tsx`
- `src/components/MyWork/MyTasksListContent.tsx`
- `src/components/MyWork/TasksKanbanBoard.tsx`
- `src/components/MyWork/TasksCalendarView.tsx`

Required changes:

1. Add right-side `Menu 3` slot actions for Tasks context and keep them non-duplicated.
2. Normalize overdue/blocked/critical color semantics to DBR77 map (`rose`, not ad-hoc `red` variants).
3. Ensure selected/focused row state uses canonical primary selection treatment with visible left accent.
4. Replace non-canonical emphasis chips (e.g. focus/indigo variants) with standard chip contracts.
5. Run parity check for table/kanban/calendar to confirm one semantic map across all task views.

Acceptance checks:

- Menu 3 right slot is present and consistent in Tasks list mode.
- Due/blocked/priority semantics match global contract in light and dark.
- Selection style is visually equivalent to approved App Table contract.
- View switching does not regress (list/kanban/calendar).
- Column settings and row description toggle remain persisted.

### 6.3 Discovery Tools

Status: `DONE`
Decision: `REFACTOR`
Priority: `P1_HIGH`
Primary files:
- `src/components/Discovery/DiscoveryToolsHub.tsx`

Required changes (current pass):

1. Normalize status filter semantics to canonical DBR77 mapping (`amber` for pending review, `rose` for cancelled/risk, `emerald` for completed).
2. Replace non-canonical initiatives priority colored pills with neutral pill + semantic dot.
3. Normalize initiative detail task status and priority colors (`emerald/blue/rose/amber`) and remove `red/orange` drift.
4. Align strong purple action accents in detail controls with primary contract where they behave as CTA/action controls.

Acceptance checks:

- Command-row status chips preserve behavior and counts after color remap.
- Initiatives table priority cell uses neutral chip surface with semantic dot.
- No `orange` or `red` risk semantics remain in Discovery status filters/initiative task status paths.
- Discovery list/detail actions keep functionality unchanged after style migration.

### 6.4 Assessment

Status: `DONE`
Decision: `REFACTOR`
Priority: `P1_HIGH`
Primary files:
- `src/components/assessment/AssessmentHub.tsx`

Required changes (current pass):

1. Keep contextual AI/menu actions visible in Menu 3 right slot when dynamic document tabs are open.
2. Eliminate local non-canonical color maps in table/filter status and type metadata cells.
3. Normalize priority visuals to neutral chip + semantic dot and remap `red/orange` drift to `rose/amber`.
4. Remove duplicated AI strip behavior that can appear below Menu 3 and keep a single canonical command surface.

Acceptance checks:

- Opening documents does not hide `AI Triage`, `Chat`, or tab-context action buttons.
- Dynamic tabs row keeps right-side action set active and functional.
- Assessment table semantic colors align with DBR77 contract buckets.
- No functional regressions in list/report/initiative flows after command-row wiring update.

### 6.5 Execution

Status: `DONE`
Decision: `REFACTOR`
Priority: `P1_HIGH`
Primary files:
- `src/components/Execution/ExecutionHub.tsx`
- `src/components/Execution/RiskSignalsPanel.tsx`
- `src/components/Execution/Manager/ProblemTable.tsx`

Required changes (current pass):

1. Remove parallel command-row behavior in manager area and fold controls into canonical Menu 3 slots.
2. Normalize risk/problem semantic colors to DBR77 buckets (`rose/amber/blue/slate`) and remove `red/orange` drift.
3. Replace non-canonical selection accents (`cyan`) with canonical `primary` row selection/focus semantics.
4. Keep AI/report action controls in Menu 3 right surface, not as competing CTA strip in content area.

Acceptance checks:

- Manager tab has only one command row under topbar (no duplicate command strip in content body).
- Risk and problem chips use canonical semantic map in light and dark.
- Row selection/focus states in manager tables use `primary` contract, not local cyan variant.
- Report/manager actions remain functionally identical after visual normalization.

### 6.6 Results

Status: `DONE`
Decision: `REFACTOR`
Priority: `P1_HIGH`
Primary files:
- `src/components/Results/ResultsHub.tsx`
- `src/components/Results/ResultsKpisTableV3.tsx`

Required changes (current pass):

1. Remove duplicated `+` prefixes from primary CTA labels (ModuleHub already renders Plus icon).
2. Normalize KPI “below/risk” color semantics from `red` to canonical `rose`.
3. Improve neutral-value and loading text contrast in KPI/list surfaces.
4. Continue migration of local accent drift (`cyan`) toward canonical `primary/blue` where accent is chrome rather than semantic data.

Acceptance checks:

- Primary CTA labels in Results are concise and icon-only-prefixed (no leading `+` in text).
- KPI status/deviation chips follow `emerald/amber/rose/slate` contract.
- Loading and neutral-value text readability passes in light and dark.
- No behavior regression in KPI create/report/schedule/wallboard action routing.

### 6.7 Economics

Status: `DONE`
Decision: `REFACTOR`
Priority: `P1_HIGH`
Primary files:
- `src/components/Economics/FinanceHub.tsx`

Required changes (current pass):

1. Move contextual AI/analyze controls from topbar cluster into canonical Menu 3 right slot.
2. Normalize primary CTA styling to shared primary contract (`hig-primary`) and remove duplicated `+` in label text.
3. Keep command-row behavior consistent with dynamic tabs (`commandRowRightContent` continuity).

Acceptance checks:

- Finance contextual actions render in command-row right slot (including when dynamic tabs are active).
- Primary CTA visual style matches global ModuleHub primary button contract.
- No functional regressions in lane actions (`Analyze`, lane start/status, AI chat).

### 6.8 Meeting

Status: `DONE`
Decision: `REFACTOR`
Priority: `P1_HIGH`
Primary files:
- `src/components/Meeting/MeetingHub.tsx`

Required changes (current pass):

1. Remove leading `+` affordance from primary CTA text and rely on canonical topbar iconography.
2. Disable tab-count badges in Menu 2 (counts should remain in Menu 3 counters).
3. Replace silent default row actions with explicit wired actions (`Preview`, `Open`) to avoid no-op menu entries.

Acceptance checks:

- Primary CTA matches ModuleHub wording/shape rules (no leading plus in label).
- Main tabs render without count pills; counters remain in command row.
- Row action menu entries perform explicit actions and do not present dead controls.

### 6.9 Reports & Presentations

Status: `DONE`
Decision: `REFACTOR`
Priority: `P1_HIGH`
Primary files:
- `src/components/ReportsAndPresentations/TrustStatePreviewSection.tsx`
- `src/components/ReportsAndPresentations/types.ts`
- `src/components/ReportsAndPresentations/OutputsAggregateTabContent.tsx`
- `src/components/ReportsAndPresentations/ReportsAndPresentationsHub.tsx`
- `src/components/ReportsAndPresentations/ReportsTabContent.tsx`
- `src/components/ReportsAndPresentations/PresentationsTabContent.tsx`
- `src/components/ReportsAndPresentations/TemplatesTabContent.tsx`

Required changes (current pass):

1. Remap trust-state badges/dots to canonical semantic palette (`amber/blue/emerald/rose/slate`) and remove local `purple/cyan` drift.
2. Normalize presentation/aggregate `shared` status from `purple` to canonical semantic bucket.
3. Remove leading `+` from primary CTA labels in RAP hub tabs.
4. Move contextual AI action to canonical `Menu 3` right slot and keep it visible in shell/dynamic tab states.

Acceptance checks:

- Trust-state and status color tokens use only canonical semantic palette.
- RAP CTA labels do not include leading plus text.
- Command-row right `Discuss` action is visible and functional regardless of opened dynamic documents.
- No regressions in output/report/presentation/template create flows.

## 7. Execution discipline (do not lose context)

- Work only on cards present in `Active execution queue`.
- After each card:
  1) update state,
  2) paste concise findings,
  3) paste acceptance result,
  4) set next card `AUDIT_IN_PROGRESS`.
- Do not start a new wave before finishing current wave P1 queue or documenting a blocker.
- Any new visual exception must be added to Golden/Operating standards before accepting code.

## 8. Progress log

### 2026-05-03

- Started implementation pass for the first pair (`Inbox`, `Tasks`) in `MyWorkHub`.
- Added `Menu 3` right-side contextual AI actions for list mode in both cards.
- Added explicit Inbox status controls (`Open / Done / Saved`) in command row, wired to `inboxStatusTab`.
- Normalized key color semantics in `InboxContent` and `MyTasksListContent`:
  - `red/orange/cyan` risk accents moved to canonical `rose/amber/primary` usage where applicable,
  - selected/preview row treatments aligned to primary-based App Table row states,
  - overdue/blocked task semantics moved to `rose`,
  - non-canonical emphasis chips (focus/triage/AI suggestion) neutralized in table row context.
- Removed automatic preview AI trigger in Inbox preview (`runAi` no longer auto-runs on item open); AI remains user-invoked.
- Completed secondary canonicalization pass for remaining accents in Inbox/Tasks table context.
- Next block: collect visual evidence package (light/dark + Menu 3 + selection + settings) and close both cards as `DONE` when screenshots pass.
- Started Interview wave audit and applied first hardening fixes:
  - templates view toggle order normalized to List-left / Grid-right,
  - enabled `forceCommandRow` during bulk selection to prevent command-row loss when search is expanded.
- Migrated `Assignments/Managed` table view settings from fixed overlay to anchored header popover pattern (same family as Sessions/Templates/Insights/Initiatives).
- Removed obsolete local `renderDynamicTabs` code path and related dead color maps in `InterviewHub` to avoid parallel Menu 3 behavior drift.
- Started Discovery Tools migration pass and applied first color-contract hardening across status filters, initiatives priority chips, and initiative detail status/priority semantics.
- Started Assessment migration and implemented first structural fix: Menu 3 right actions are now explicitly wired for dynamic-tab mode (`commandRowRightContent`) so contextual AI/actions do not disappear with open documents.
- Applied Assessment color-contract pass for table semantics: framework type column neutralized, import/report status risk remapped (`failed` -> `rose`), and initiative priority switched to neutral chip + semantic dot.
- Removed duplicated Assessment AI triage strip under Menu 3 and kept AI entry points inside canonical command row actions only.
- Started Wave B with Execution: first normalization pass applied (`red/orange` -> `rose/amber`, selected manager row `cyan` -> `primary`, overdue deadline text remapped to `rose`).
- Extended Execution normalization on report/initiative surfaces: blocked progress/badges remapped to `rose`, in-progress bars to `blue`, and report preview CTA/meta chips aligned to `primary` + neutral chip contract.
- Refactored `Execution > people_change` to canonical single Menu 3 surface: manager presets/actions are now registered into `ModuleHub` command row slots (left/right), and the duplicated in-view command strip has been removed.
- Normalized `ExecutionManagementView` card-hover accents from local `cyan` to canonical `primary` while keeping semantic risk metrics (`amber/rose`) unchanged.
- Completed Execution chrome accent cleanup sweep (`cyan` -> `primary/blue`) across kanban/task/decision/report interaction states and loaders; card moves to `VERIFY_IN_PROGRESS`.
- Started Results migration (Wave B): normalized primary CTA labels (removed redundant leading `+`), remapped KPI risk semantics (`red` -> `rose`), and improved loading/neutral-value readability in core Results table/hub views.
- Refactored Results command row to canonical split layout: queue-specific `Add sheet` action moved from inline mixed row into `commandRowRightContent` while workspace chips remain in Menu 3 left.
- Started Economics migration (Wave B): moved Finance contextual controls to `commandRowRightContent`, replaced topbar `aiControl/rightControls` pattern, and aligned primary CTA style/labels to global ModuleHub contract.
- Extended Economics normalization pass: mapped remaining local `violet/teal/orange` accents in Finance command-row metadata and analyze controls to canonical `primary/blue/amber` palette; card moved to `VERIFY_IN_PROGRESS`.
- Started Meeting migration (Wave B): removed leading-plus CTA label pattern, removed topbar tab-count pills, and wired explicit table row actions to prevent silent default no-op entries.
- Added Meeting command-row right action (`Operator brief`) using canonical Menu 3 AI button style; operator brief access no longer depends on in-canvas controls only.
- Started Reports & Presentations migration (Wave B): normalized trust/status semantic map (`purple/cyan` -> `amber/blue`) and removed leading-plus CTA labels in RAP hub.
- Added Reports & Presentations command-row right AI action (`Discuss`) using canonical Menu 3 AI button style via `commandRowRightContent` for shell/dynamic-tabs consistency.
- Completed RAP semantic-color sweep in list/filter taxonomy paths (`purple` -> `blue`) across hub + aggregate + report + presentation + template views; no off-contract accent tokens remain in module source.
- Ran follow-up Wave A verification cleanup in `DiscoveryToolsHub`: normalized remaining local `purple/red` accents in initiative detail and category chips to canonical `blue/primary/rose` without behavioral changes.
- Ran follow-up Wave A verification cleanup in `AssessmentHub`: normalized remaining local accents in loaders/status chips/report slide-over controls (`purple/cyan/red/orange` -> `primary/blue/rose`) while preserving command-row behavior and tab flows.
- Ran follow-up Wave A verification cleanup in `InterviewHub`: normalized residual status/progress/CTA accents (`purple/red/orange` -> `primary/blue/rose/amber`) and aligned dark-mode in-progress cards to canonical blue scale.
- Ran follow-up Wave A verification cleanup in `MyWorkHub`: normalized residual tab/filter/status accents (`violet/purple/red/orange/cyan` -> `primary/blue/rose/amber`) and kept dynamic-tab/menu behavior unchanged.
- Ran follow-up Wave A verification cleanup in `MyIdeasListContent`: normalized remaining idea-stage/convert-action accents (`violet/purple` -> `blue/primary`) with no behavior changes in table/grid actions.
- Ran follow-up Wave A verification cleanup in `IdeasTableContent` and `Notifications/NotificationDetailPanel`: remapped remaining `violet/purple/red` accents to `blue/rose` for ready-stage and critical-severity visual semantics.
- Ran follow-up Wave A verification cleanup in `table/TableToolbar`: normalized toolbar/filter/tools accent tokens (`violet/cyan/teal/red` -> `primary/blue/rose`) and kept all table-platform actions unchanged.
- Ran follow-up Wave A verification cleanup in `table/TableTabStrip` and `table/GridView`: aligned delete/resize chrome accents (`red/violet` -> `rose/primary`) without changing table interactions or resize behavior.
- Ran larger Wave A batch cleanup in `processflow/ProcessFlowFloatingToolbar`, `processflow/ProcessFlowToolbar`, `processflow/ValidationResultsPanel`, `processflow/ProcessFlowHealthScore`, and `table/ChatToSchemaPanel`: normalized remaining `violet/purple/red` accents to `primary/blue/rose` with no functional changes to flow validation, AI coach/chat, or schema-execution actions.
- Ran additional Wave A batch cleanup in `processflow/ProcessFlowContextMenu`, `processflow/AIProposalPanel`, `processflow/ReadbackPanel`, and `processflow/LaneSystem`: normalized delete/destructive and split/join accents (`red/violet` -> `rose/primary`) while preserving processflow behavior and command handlers.
- Ran another large Wave A cleanup batch in `processflow/nodes/ActivityNode`, `processflow/FlowNodeComponent`, `IdeaProcessFlowTool`, `table/RowDetailPanel`, `IdeaMapWorkspace`, and `IdeaWorkspaceTools`: removed residual `red/violet/purple/cyan/teal/orange` tokens in favor of `rose/primary/blue/amber` without changing conversion, relation, or process-node interaction logic.
- Ran large Home/Executive/notebook cleanup batch in `Home/IndustryLensBlock`, `Home/CommandDock`, `Executive/KPIGrid`, `Executive/ExecutiveDashboard`, `Executive/AIOperatorOverviewCard`, `Executive/DecisionQueuePreview`, and `notebook/ActionItemsPanel`: normalized remaining accent drift (`cyan/violet/purple/red/orange` -> `blue/primary/rose/amber`) with no behavior changes in dashboard KPIs, operator actions, or action-item creation.
- Ran another Wave A batch in `whiteboard/WhiteboardToolbarPrimitives`, `whiteboard/WhiteboardEmptyState`, `whiteboard/nodes/GroupNode`, `whiteboard/nodes/LinkNode`, `whiteboard/nodes/whiteboardNodeHelpers`, `table/EmptyStateView`, `table/ActivityFeed`, and `mindmap/NodeContextMenu`: remapped residual `red/violet/purple/cyan/orange/teal` accents to `rose/primary/blue/amber` while preserving whiteboard/table/mindmap interactions and menu handlers.
- Ran follow-up Home/Executive batch in `Home/HomeBlockShell`, `Home/ExecutionCurrentBlock`, `Executive/TeamPerformancePreview`, and `Executive/PortfolioHealthScore`: aligned remaining `cyan/violet` status/live/health accents to canonical `blue/primary` without changing scoring logic, output flow behavior, or action routing.
- Ran larger Decisions + Focus batch in `DecisionsPanelContent`, `DecisionPreviewPanel`, `DecisionsKanbanBoard`, `DecisionsTimelineView`, `FocusCockpit`, `Focus/NudgeStrip`, `Focus/AICoachPanel`, and `Focus/FocusView`: normalized remaining `red/orange/purple` semantics to `rose/amber/blue/primary` for overdue/risk/badges/AI chrome while keeping decision workflows, drag-drop focus lanes, and panel actions behaviorally unchanged.
- Ran deep `DecisionDetailView` cleanup pass: normalized residual status/priority/risk/action/governance accents (`red/orange/purple/violet/cyan` -> `rose/amber/primary/blue`) across activity meta, risk badges, AI field actions, governance modals, destructive controls, and chip toggles with no behavioral changes in decision editing, approvals, or workflow state transitions.
- Ran Tasks surface follow-up pass in `MyTasksList`, `TaskRow`, `shared/DueDateIndicator`, and `shared/PMOPriorityBadge`: aligned overdue/pinned/initiative/priority accents (`red/purple` -> `rose/primary`) to the Color Contract while preserving grouping logic, row actions, and PMO category behavior.
- Ran deeper Tasks batch in `TaskDetailView` plus `MyTasksList`, `TaskRow`, `shared/DueDateIndicator`, and `shared/PMOPriorityBadge`: normalized residual `red/orange/purple/violet/cyan` accents to `rose/amber/primary/blue` across status/priority configs, risk scoring chips, governance channel toggles, AI section buttons, pinned/overdue headers, and destructive controls with no functional changes to task workflows or modal actions.
- Ran Notifications + Team workload batch in `NotificationsHub`, `NotificationsContent`, `NotificationsKanbanBoard`, `WorkloadView`, `Team/CapacityForecast`, and `Team/BottleneckMap`: remapped remaining `red/orange/purple/violet/cyan` accents to `rose/amber/primary/blue` across severity chips, project/source badges, destructive action hovers, overloaded-capacity indicators, forecast markers, and bottleneck type colors while preserving notification flows, filters, and team analytics behavior.
- Ran table-shell follow-up batch in `table/ViewSwitcher`, `table/WorkflowDashboard`, `table/SnapshotManager`, `table/ShareViewDialog`, `table/ColorPalette`, and `table/FilterPanel`: normalized residual `red/purple/violet/cyan` UI accents to `rose/primary/blue` for active tabs/chips, destructive controls, share/snapshot actions, and dashboard icon surfaces while keeping table switching/filtering/snapshot behavior unchanged.
- Ran `table/views/*` semantic cleanup batch in `table/views/CalendarView`, `table/views/KanbanView`, `table/views/TimelineView`, `table/views/GalleryView`, `table/views/GanttView`, `table/views/ViewConfigPanel`, and `table/views/FormView`: remapped residual `red/violet/purple` accents to `rose/primary` across today markers, active-mode toggles, drag/drop highlights, form focus controls, config chips, and primary save/create CTAs while preserving view navigation, drag/drop, and record-edit behavior.
- Ran legacy table-view parity batch in `table/CalendarView`, `table/KanbanView`, and `table/TimelineView`: mirrored `violet` accent cleanup to canonical `primary` across today/day chips, add-record affordances, drag/drop lane highlights, zoom toggles, and active drag rings while preserving calendar/kanban/timeline rendering and interactions.
- Ran table core follow-up batch in `table/RowDetailPanel`, `table/GridView`, `table/ViewRouter`, and `table/PublicViewPage`: normalized residual `violet/red` focus and error-state accents to canonical `primary/rose` (editable cell focus rings, comment textarea focus, shared-view unavailable state) with no behavior changes in editing, routing, or public-view loading flow.
- Ran table productivity batch in `table/TableSummaryDashboard`, `table/SmartSuggestionsBar`, `table/KeyboardShortcutsPanel`, and `table/ExecutionProgress`: normalized residual `violet/purple/red` accents to canonical `primary/rose` (summary AI panel and CTA states, suggestion-strip gradients/icons/actions, shortcuts header icon, execution progress statuses/error summaries) and remapped remaining off-contract hex tokens to `primary/blue/rose` equivalents without affecting execution or suggestion behavior.
- Ran table builder/config batch in `table/FormBuilder`, `table/FilterBuilder`, `table/AddColumnDialog`, and `table/FormulaEditor`: normalized residual `purple/violet/red/orange` accents to canonical `primary/rose/amber` across builder pills, remove actions, required markers, filter controls, add-column focus rings/selected chips, and formula syntax/error highlighting while preserving form/filter/formula behavior and column-creation workflows.
- Ran table connectors/automation/integration batch in `table/connectors/WebhookRelayPanel`, `table/connectors/RunHistoryPanel`, `table/connectors/ConnectorWizard`, `table/connectors/ConnectorList`, `table/automations/CronBuilder`, `table/automations/AutomationsManager`, `table/automations/AutomationBuilder`, and `table/integration/ConsultifyLinkPanel`: remapped residual `red/purple/violet` accents to canonical `rose/primary` for failed-status surfaces, destructive menu actions, active preset/step states, toggle/CTA chrome, and execution module mapping badges without changing connector runs, automation execution, or sync flows.
- Ran table forms/sharing/offline batch in `table/forms/PublicFormPage`, `table/forms/FormsIndex`, `table/sharing/SharingManager`, and `table/offline/OfflineIndicator`: normalized residual `red/purple/violet` accents to canonical `rose/primary` across public-form validation/error states, forms-list CTAs and active states, sharing actions/inputs/avatars, and offline status badges while preserving submission, sharing permissions, and online/offline behavior.
- Ran table extensions/distribution/interfaces batch in `table/extensions/ExtensionMarketplace`, `table/extensions/ExtensionHost`, `table/distribution/DistributionManager`, and `table/interfaces/InterfacesIndex`: remapped residual `red/violet/purple` accents to canonical `rose/primary` for uninstall/delete actions, extension host error banners, distribution delete controls, interface creation/template chrome, and interface-card destructive controls without changing extension loading, distribution execution, or interface CRUD behavior.
- Ran table governed/sync batch in `table/governed/GovernedModelsDashboard` and `table/sync/SyncManager`: remapped residual `red/cyan` accents to canonical `rose/blue` across deprecated trust badges, remove/delete links, sync wizard step states, source/mode chips, sync CTAs/icons, and destructive row actions while preserving model-governance and sync workflow logic.
- Ran table AI workflow batch in `table/AITableProposal`, `table/AITableAssistant`, `table/AICopilotMode`, and `table/AICategorizeTool`: normalized residual `violet/red/teal` accents to canonical `primary/rose/blue` across proposal selection states, AI container chrome, copilot mode tabs/input focus, categorize tabs/chips, and destructive/critical suggestion states while preserving proposal acceptance/refine and copilot/categorization behavior.
- Ran table schema/rules batch in `table/SchemaProposalCard`, `table/SchemaDiffPreview`, `table/RefineDialog`, and `table/RowColoringConfig`: remapped residual `red/violet/teal` accents to canonical `rose/primary/blue` for operation badges, required/low-confidence markers, diff deleted-state highlights, refine dialog focus/CTA chrome, and row-coloring rule actions with no changes to proposal execution, diff logic, or rule evaluation behavior.
- Ran table record/layout surfaces batch in `table/RecordTemplateManager`, `table/RecordExpandModal`, `table/PublicFormView`, `table/PlatformCellRenderer`, `table/MatrixView`, `table/LinkedRecordPicker`, `table/LinkedRecordDisplay`, and `table/InterfaceDesigner`: normalized residual `red/violet/teal` accents to canonical `rose/primary/blue` across template chips/actions, modal field badges and focus rings, public-form validation states, matrix drag/drop highlights, linked-record add/remove chrome, and interface delete hover states while preserving record-editing and relation-linking behavior.
- Ran table ideation/analytics batch in `table/IdeaStartupTemplates`, `table/IdeaScoringModel`, `table/IdeaPipeline`, `table/IdeaCompletenessWidget`, `table/FrameworkGenerator`, `table/ExportToPresentation`, and `table/EmbeddedAnalytics`: normalized residual `red/violet` accents to canonical `rose/primary` across startup template cards and prompt focus, scoring sliders/progress states, stage-selection rings, low-completeness trend markers, framework generator active chips, export selection controls, and analytics palette toggles while preserving ideation scoring, export flow, and analytics rendering behavior.
- Ran table editing/rules batch in `table/CellRenderer`, `table/CellEditor`, `table/CellExpandPopover`, `table/FieldManager`, `table/ConditionalFormatting`, `table/DateDependencyConfig`, and `table/AuditTrailPanel`: remapped residual `red/violet` accents to canonical `rose/primary` across inline editors, checkbox/select active states, cell expand AI panels, field configuration dialogs, formatting/dependency controls, and audit delete markers while preserving edit semantics, validation handling, dependency logic, and audit rendering behavior.
- Ran table utility interaction batch in `table/ViewSwitcher`, `table/DistributionBuilder`, `table/VoiceImageInput`, `table/StickyNoteView`, `table/NewColumnRenderers`, `table/MiniCanvas`, `table/InlineAIFill`, and `table/CrossTableRelations`: normalized residual `red/violet` accents to canonical `rose/primary` across focus rings, destructive buttons, mode tabs, drag/drop highlight rings, inline AI triggers, and relation map controls without changing distribution, media-input, canvas drawing, or relation-linking behavior.
- Ran My Work idea/workflow batch in `IdeaTableTool`, `NotebookContent`, `CommandPalette`, `IdeaAISuggestionsPanel`, `ConvertToDialog`, `IdeaVotingMode`, `IdeaTemplateGallery`, and `IdeaRecommendationMap`: remapped residual `red/orange/purple/violet/cyan/teal` accents to canonical `rose/amber/primary/blue` across destructive controls, selection chips, suggestion confidence bars, focus rings, command-palette highlights, and map legends/AI badges without changing table logic, recommendation rendering, or command execution behavior.
- Ran My Work notebook AI batch in `notebook/AIChatInlinePanel`, `notebook/AITopicsPanel`, `notebook/AIInlineResponse`, `notebook/AICommandPrompt`, `notebook/SlashMenu`, and `notebook/InsertMenu`: remapped residual `red/purple/violet` accents to canonical `rose/primary` across inline AI errors/recording states, topics prompts/actions, streaming response containers, slash command icons, and insert-menu AI labels while preserving prompt execution, streaming behavior, and insert command routing.
- Ran focused Team follow-up in `Team/CapacityForecast`: normalized remaining today-highlight ring (`ring-violet-500` -> `ring-primary-500`) to keep calendar marker chrome aligned with the canonical primary selection/focus contract.
- Ran large My Work graph + shared surfaces batch in `mindmap/*` and `shared/*` (including toolbar popovers, node/detail drawers, snapshots, governance/AI overlays, plus shared decision/risk/dependency/comment/action sections): normalized remaining `red/orange/purple/violet/cyan/teal` utility classes to canonical `rose/amber/primary/blue` across chips, badges, focus rings, hover states, and semantic legends without changing node editing, map analytics, relation wiring, or shared panel behaviors.
- Ran full My Work runtime sweep across `src/components/MyWork` (excluding `__tests__`): canonicalized remaining non-contract utility color tokens (`red/orange/purple/violet/cyan/teal`) to `rose/amber/primary/blue` in residual idea/workflow/dashboard/sidebar/task/focus/notification surfaces; post-sweep check shows runtime matches cleared and only test fixture tokens remain in `table/__tests__/TablePlatformFrontend.test.tsx`.
- Ran cross-module Wave A cleanup sweep across `src/components/Discovery`, `src/components/assessment`, and `src/components/Interview` (runtime `.ts/.tsx`, excluding tests): normalized remaining non-canonical utility tokens (`red/orange/purple/violet/cyan/teal`) to `rose/amber/primary/blue`; follow-up scans report no residual matches in these three module trees and lint checks remain clean.
- Ran broad Wave B cleanup sweep across `src/components/Execution`, `src/components/Results`, `src/components/Economics`, `src/components/Meeting`, and `src/components/Reports` (runtime `.ts/.tsx`, excluding tests): normalized residual non-contract utility tokens (`red/orange/purple/violet/cyan/teal`) to canonical `rose/amber/primary/blue`; verification scans show no remaining matches in these module trees and lint checks remain clean.
- Ran repo-level components sweep across `src/components` runtime files (excluding tests): applied canonical utility-token remap (`red/orange/purple/violet/cyan/teal` -> `rose/amber/primary/blue`) to close residual drift outside Wave A/B card clusters; verification scan now reports only expected test-fixture residue in `MyWork/table/__tests__/TablePlatformFrontend.test.tsx` and lints remain clean.
- Cleared final test-fixture residue in `MyWork/table/__tests__/TablePlatformFrontend.test.tsx` with the same canonical remap so the `src/components`-scope drift scan is now fully clean (no remaining `red/orange/purple/violet/cyan/teal` utility-token matches).
- Ran additional shell-surface sweep across `src/views` runtime files: canonicalized residual utility-class color tokens (`red/orange/purple/violet/cyan/teal` -> `rose/amber/primary/blue`) across admin/superadmin/partner/public/auth/settings/report views; follow-up scan for `src/views` is clean and lints remain green.
- Ran top-level `src` follow-up sweep outside views/components (`layouts`, `contexts`, `hooks`, `services`, `constants`, `config`, `types`, plus `index.css`): normalized residual utility-class tokens to canonical `rose/amber/primary/blue`; full `src` token scan is now clean and lint checks on edited files pass.
- Marked queue cards `My Work > Inbox`, `My Work > Tasks`, `Interview`, `Discovery Tools`, `Assessment`, `Execution`, `Results`, `Economics`, `Meeting`, and `Reports & Presentations` as `DONE` after full-source canonicalization sweep and clean token/lint verification across `src`.
- Ran follow-up semantic-token sanity pass on non-view runtime sources (`mindmap-effects.css`, `frameworkRegistry`, tool/audit/digitization data maps): remapped remaining scale tokens and hex accents to canonical contract equivalents (`primary/blue/amber/rose`) and re-verified clean token scans + lint status.
- Ran Wave C/Wave D outlier pass #1 across `src` runtime TS/TSX/CSS surfaces: remapped legacy hardcoded hex accents (`#ef4444`, `#f97316`, `#8b5cf6`, `#14b8a6`, `#06b6d4` and uppercase variants) to canonical equivalents (`#f43f5e`, `#f59e0b`, `#6366f1`, `#3b82f6`), then verified zero remaining matches and clean lints.
- Created evidence-pack scaffolding under `docs/ui-standards/evidence/` with per-card `STATUS.md` trackers for all DONE cards (`mywork-inbox`, `mywork-tasks`, `interview-all-tabs`, `discovery-tools`, `assessment`, `execution`, `results`, `economics`, `meeting`, `reports-presentations`) to support parallel screenshot collection with owner/date assignment.
- Added evidence manifest template `docs/ui-standards/evidence/EXPECTED_FILES_TEMPLATE.csv` to standardize expected screenshot filenames/status tracking for all DONE cards.
- Added capture assignment template `docs/ui-standards/evidence/ASSIGNMENT_TEMPLATE.csv` so owner/date/progress can be tracked per DONE card during evidence collection.
- Populated evidence assignments and target dates across `docs/ui-standards/evidence/ASSIGNMENT_TEMPLATE.csv` and all per-card `STATUS.md` files using a two-lane QA schedule (`UX_QA_A`, `UX_QA_B`) for 2026-05-04 through 2026-05-08.
- Added date-based execution plan `docs/ui-standards/evidence/CAPTURE_PLAN_2026-05-04_to_2026-05-08.md` to operationalize daily evidence collection and closeout updates (`STATUS.md` + assignment CSV).
- Initialized day-level execution artifacts for the full capture window (`DAY_2026-05-04.md` through `DAY_2026-05-08.md`) and synchronized baseline tracking metadata in `ASSIGNMENT_TEMPLATE.csv` + all evidence `STATUS.md` files (`QUEUED`, schedule confirmed notes).
- Executed final gate sanity-check snapshot against the evidence manifest and current folders; result is `FAIL` with `0/6` captures across all 10 cards (full LISTA BRAKÓW recorded in `docs/ui-standards/evidence/FINAL_GATE_CHECK_2026-05-03.md`).
- Added closure snapshot summary in `docs/ui-standards/evidence/EVIDENCE_CLOSURE_SUMMARY_2026-05-03.md` (what is fully closed operationally, what still blocks formal evidence closure, and recommendation for execution window).
- Added evidence automation CLI (`scripts/evidence/evidence-ops.mjs`) with npm shortcuts (`evidence:sync`, `evidence:check`, `evidence:daily`, `evidence:final`, `evidence:refresh`) and executed a refresh run to auto-sync statuses plus regenerate final gate and closure snapshot artifacts.

## 9. Evidence capture tracker (DONE cards)

Legend: `PENDING` = screenshot still required, `N/A` = not applicable for the card.

Capture runbook:
- `docs/ui-standards/UI_UX_DONE_CARDS_EVIDENCE_RUNBOOK.md`

| Card | Light | Dark | Menu 3 active | Selected row | Settings popover | Empty/error/degraded |
|---|---|---|---|---|---|---|
| `My Work > Inbox` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` |
| `My Work > Tasks` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` |
| `Interview > all tabs` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` |
| `Discovery Tools` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` |
| `Assessment` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` |
| `Execution` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` |
| `Results` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` |
| `Economics` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` |
| `Meeting` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` |
| `Reports & Presentations` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` |

## 10. Residual risk notes

- Utility-token scan in `src` is clean for non-canonical palette classes.
- Legacy priority hex set (`#ef4444`, `#f97316`, `#8b5cf6`, `#14b8a6`, `#06b6d4`) has been normalized in runtime sources; any further color-audit work should focus on broader visualization palette governance and contrast validation rather than these known drift anchors.
