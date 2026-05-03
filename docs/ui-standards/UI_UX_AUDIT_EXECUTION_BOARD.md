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
| 1 | `My Work > Inbox` | `A` | `VERIFY_IN_PROGRESS` | `REFACTOR` | `P1_HIGH` | Highest trust-risk gaps (status access + AI trigger behavior) |
| 2 | `My Work > Tasks` | `A` | `VERIFY_IN_PROGRESS` | `REFACTOR` | `P1_HIGH` | Shares same shell and command-row contracts as Inbox |
| 3 | `Interview > all tabs` | `A` | `VERIFY_IN_PROGRESS` | `REFINE_REFERENCE` | `P1_HIGH` | Keep recent migration stable and regression-free |
| 4 | `Discovery Tools` | `A` | `VERIFY_IN_PROGRESS` | `REFACTOR` | `P1_HIGH` | Known local color/status map drift |
| 5 | `Assessment` | `A` | `VERIFY_IN_PROGRESS` | `REFACTOR` | `P1_HIGH` | Dynamic local color classes must be normalized |
| 6 | `Execution` | `B` | `VERIFY_IN_PROGRESS` | `REFACTOR` | `P1_HIGH` | Manager surface has parallel command-row and local semantic color drift |
| 7 | `Results` | `B` | `VERIFY_IN_PROGRESS` | `REFACTOR` | `P1_HIGH` | CTA labeling and KPI semantic colors still contain local drift |
| 8 | `Economics` | `B` | `VERIFY_IN_PROGRESS` | `REFACTOR` | `P1_HIGH` | Finance actions still needed migration to canonical Menu 3 right slot |
| 9 | `Meeting` | `B` | `VERIFY_IN_PROGRESS` | `REFACTOR` | `P1_HIGH` | App-table actions and topbar CTA count/style drifted from canonical ModuleHub |
| 10 | `Reports & Presentations` | `B` | `VERIFY_IN_PROGRESS` | `REFACTOR` | `P1_HIGH` | Trust/status semantic color map includes off-contract palettes (`purple/cyan`) |

## 6. Card audit logs (current run)

### 6.1 My Work > Inbox

Status: `VERIFY_IN_PROGRESS`
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

Status: `VERIFY_IN_PROGRESS`
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

Status: `VERIFY_IN_PROGRESS`
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

Status: `VERIFY_IN_PROGRESS`
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

Status: `VERIFY_IN_PROGRESS`
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

Status: `VERIFY_IN_PROGRESS`
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

Status: `VERIFY_IN_PROGRESS`
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

Status: `VERIFY_IN_PROGRESS`
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

Status: `VERIFY_IN_PROGRESS`
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
