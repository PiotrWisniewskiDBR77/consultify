---
doc_id: COMPONENT_COVERAGE_MATRIX
doc_kind: AUDIT
owner: user
status: active
created: 2026-06-03
scope: canonical shared/design-system components
---

# Component Coverage Matrix — 2026-06-03

## Method

Read-only scan of `src/components/shared/**`, `src/components/ui/**` (primitives/ + composed/), `src/components/navigation/`, plus docs: `docs/UI_UX/30–37_*.md`, `docs/modules/APPROVED_COMPONENT_COMPOSITION.md`, `docs/modules/_UI_COMPONENT_FREEZE_REGISTRY_2026-05-12.md`, `docs/ui-standards/03-modules/*.md`.

## Coverage Matrix

| # | UI Element | Status | Canonical Component(s) | Path(s) | SSOT Doc | Intended Use |
|---|---|---|---|---|---|---|
| 1 | **Menu 1 — App Sidebar** | EXISTS | `Sidebar` + `NavItem`, `SidebarHeader`, `SidebarFooter`, `FloatingSubmenu` | `src/components/navigation/Sidebar/` | `docs/UI_UX/11_SIDEBAR_AND_MODULE_ORDER.md` | Global module nav, collapsible, used in `MainLayout.tsx` |
| 2 | **Menu 2 — Module TopBar** | EXISTS | `ModuleNavBar` | `src/components/shared/ModuleHub/ModuleNavBar.tsx` | `docs/UI_UX/13_MENU_2_MODULE_TOPBAR.md` | Per-module tab+filter bar with status filter + view switcher |
| 3 | **Menu 3 — Command Row** | EXISTS (styles only) | `ModuleMenu3` (style constants) | `src/components/shared/ModuleMenu3.tsx`, `src/components/shared/ModuleHub/menu3ActionButtonStyles.ts` | `docs/UI_UX/14_MENU_3_COMMAND_ROW.md` | Layout tokens + CSS classes; no JSX shell — each module composes its own row using these tokens (23 usages) |
| 4 | **Button — primary/secondary/ghost/icon** | EXISTS | `Button` (primitive) | `src/components/ui/primitives/Button.tsx` | `docs/modules/APPROVED_COMPONENT_COMPOSITION.md` | All interactive CTAs; variants via props |
| 5 | **Button — Menu 3 action button** | EXISTS | `menu3ActionButtonStyles` constants + `Button` | `src/components/shared/ModuleHub/menu3ActionButtonStyles.ts` | `docs/UI_UX/14_MENU_3_COMMAND_ROW.md` | Standardised action buttons in the command row |
| 6 | **Tables — FilterableTable** | EXISTS | `FilterableTable` | `src/components/shared/ModuleHub/FilterableTable.tsx` | `docs/UI_UX/31_TABLES_AND_LISTS.md`, `docs/ui-standards/03-modules/module-hub-standard.md` | Hub-level filterable list table |
| 7 | **Tables — ResizableTable** | EXISTS | `ResizableTable`, `ColumnResizer`, `BulkActionBar`, `FilterDropdown`, `TableHeader` | `src/components/ui/ResizableTable/` | `docs/ui-standards/03-modules/app-table-standard.md` | Operational/admin column-resizable tables |
| 8 | **Tables — DataTable (composed)** | EXISTS | `DataTable` | `src/components/ui/composed/DataTable.tsx` | `docs/modules/APPROVED_COMPONENT_COMPOSITION.md` | Lightweight composed table without resize |
| 9 | **Table settings popover** | MISSING | — | — | — | No canonical column-visibility / settings popover; implemented ad-hoc per module |
| 10 | **Preview Pane** | EXISTS | `TableWithPreviewLayout`, `PreviewPane/*`, `PreviewPaneShell` | `src/components/shared/TableWithPreviewLayout.tsx`, `src/components/shared/PreviewPane/`, `src/components/ui/ResizableTable/PreviewPaneShell.tsx` | `docs/ui-standards/03-modules/table-preview-pane-standard.md` | Split-view table + detail pane for triage flows |
| 11 | **Chips/Badges — Status** | EXISTS | `StatusBadge`, `PriorityDot`, `Badge` (primitive) | `src/components/shared/ViewLayouts/StatusBadge.tsx`, `src/components/ui/primitives/Badge.tsx` | `docs/UI_UX/37_ICONS_BADGES_AND_STATUS.md` | Row/card status + priority signals |
| 12 | **Chips/Badges — Priority/Meta/Tool/Due** | PARTIAL | `StatusBadge` covers status+priority; dedicated Tool/Due/Meta chips absent | `src/components/shared/ViewLayouts/StatusBadge.tsx` | `docs/UI_UX/37_ICONS_BADGES_AND_STATUS.md` | Tool/Due/Meta chip families not canonically separated; ad-hoc in modules |
| 13 | **Completeness pill** | EXISTS | `CompletenessPill` | `src/components/shared/NModeCompleteness/CompletenessPill.tsx` | `docs/UI_UX/37_ICONS_BADGES_AND_STATUS.md` | NMode artifact completeness % indicator |
| 14 | **Cards & Grids** | EXISTS | `GridView`, `BaseCard`, `Card` (primitive), `MetricCard` (composed) | `src/components/shared/ModuleHub/GridView.tsx`, `src/components/ui/BaseCard.tsx`, `src/components/ui/primitives/Card.tsx`, `src/components/ui/composed/MetricCard.tsx` | `docs/UI_UX/32_CARDS_AND_GRIDS.md` | Card grid for hub views; metric cards for dashboards |
| 15 | **View mode switcher** | EXISTS | `CardViewSwitcher`, `TablePresentationToggle` | `src/components/shared/CardViewSwitcher.tsx`, `src/components/shared/TablePresentationToggle.tsx` | `docs/ui-standards/03-modules/view-modes-standard.md` | Toggle between table / grid / list views |
| 16 | **Modals / Dialogs** | EXISTS | `Modal`, `ConfirmModal` (primitive) + shadcn `dialog.tsx` | `src/components/ui/primitives/Modal.tsx`, `src/components/ui/dialog.tsx` | `docs/modules/APPROVED_COMPONENT_COMPOSITION.md` | Overlays for create/edit/confirm |
| 17 | **Drawers** | EXISTS | `Drawer` (primitive) + shadcn `sheet.tsx` | `src/components/ui/primitives/Drawer.tsx`, `src/components/ui/sheet.tsx` | `docs/modules/APPROVED_COMPONENT_COMPOSITION.md` | Slide-in panels (detail, settings) |
| 18 | **Forms — Input / Textarea** | EXISTS | `Input` (primitive), shadcn `input.tsx`, `textarea.tsx` | `src/components/ui/primitives/Input.tsx`, `src/components/ui/input.tsx` | `docs/UI_UX/33_FORMS_AND_EDITING.md` | All text entry |
| 19 | **Forms — Select / Toggle / Switch** | PARTIAL | Shadcn `select.tsx`, `switch.tsx`, `checkbox.tsx`, `radio-group.tsx` used directly (7 usages); no primitives-layer wrappers | `src/components/ui/select.tsx`, `switch.tsx` etc. | `docs/UI_UX/33_FORMS_AND_EDITING.md` | Selection controls — not wrapped in primitives layer, reducing theming control |
| 20 | **States — Empty** | EXISTS | `EmptyState` (composed), `HubWorkAreaLoadError`, `EmptyStateInline` (NMode) | `src/components/ui/composed/EmptyState.tsx`, `src/components/shared/ModuleHub/HubWorkAreaLoadError.tsx`, `src/components/shared/NModeBlocks/EmptyStateInline.tsx` | `docs/UI_UX/35_EMPTY_LOADING_ERROR_STATES.md` | Empty list / zero-data surfaces |
| 21 | **States — Loading** | EXISTS | `LoadingScreen`, `LoadingSkeleton`, `HubWorkAreaLoading`, `Skeleton`, `Spinner` | `src/components/ui/LoadingScreen.tsx`, `LoadingSkeleton.tsx`, `src/components/ui/primitives/Skeleton.tsx`, `Spinner.tsx`, `src/components/shared/ModuleHub/HubWorkAreaLoading.tsx` | `docs/UI_UX/35_EMPTY_LOADING_ERROR_STATES.md` | Full-page and inline loading states |
| 22 | **States — Error** | EXISTS | `ErrorState` (primitive), `HubWorkAreaLoadError` | `src/components/ui/primitives/ErrorState.tsx`, `src/components/shared/ModuleHub/HubWorkAreaLoadError.tsx` | `docs/UI_UX/35_EMPTY_LOADING_ERROR_STATES.md` | Error surfaces with CTA |
| 23 | **States — Onboarding** | PARTIAL | `OnboardingHint` primitive exists; no canonical onboarding banner/flow shell | `src/components/ui/primitives/OnboardingHint.tsx` | `docs/UI_UX/35_EMPTY_LOADING_ERROR_STATES.md` | First-use hints — no module onboarding flow pattern |
| 24 | **Toasts** | EXISTS | `Toast` (primitive), `StatusChangeToast` (shared), shadcn `toaster.tsx` | `src/components/ui/primitives/Toast.tsx`, `src/components/shared/StatusChangeToast.tsx`, `src/components/ui/toaster.tsx` | `docs/UI_UX/36_TOASTS_BANNERS_AND_NOTIFICATIONS.md` | Status-change and action feedback toasts |
| 25 | **Banners** | PARTIAL | `ImpersonationBanner` exists (admin); no reusable inline banner for module-level warnings | `src/components/shared/ImpersonationBanner.tsx`, shadcn `alert.tsx` | `docs/UI_UX/36_TOASTS_BANNERS_AND_NOTIFICATIONS.md` | Contextual/warning banners — only admin impersonation case is canonical |
| 26 | **Row Actions Menu / Dropdowns** | EXISTS | `RowActionsMenu`, `Dropdown` (primitive), shadcn `dropdown-menu.tsx` | `src/components/shared/RowActionsMenu.tsx`, `src/components/ui/primitives/Dropdown.tsx` | `docs/modules/APPROVED_COMPONENT_COMPOSITION.md` | Per-row kebab menus and context menus |
| 27 | **Status Dropdown (inline edit)** | EXISTS | `StatusDropdown` | `src/components/shared/ModuleHub/StatusDropdown.tsx` | `docs/UI_UX/37_ICONS_BADGES_AND_STATUS.md` | Inline status-change popover in table rows |
| 28 | **Pill editors (Preview Pane)** | EXISTS | `StatusPillEditor`, `PriorityPillEditor`, `DatePillEditor`, `OwnerPillEditor` | `src/components/shared/PreviewPane/editors/` | `docs/ui-standards/03-modules/table-preview-pane-standard.md` | Inline field editors in preview pane |
| 29 | **Avatars** | EXISTS | `Avatar`, `AvatarGroup` (primitive), shadcn `avatar.tsx` | `src/components/ui/primitives/Avatar.tsx`, `src/components/ui/avatar.tsx` | `docs/modules/APPROVED_COMPONENT_COMPOSITION.md` | User/entity representation |
| 30 | **Tabs** | EXISTS | `Tabs` (primitive), `DynamicTabBar`, `DynamicTabs` | `src/components/ui/primitives/Tabs.tsx`, `src/components/shared/DynamicTabBar/`, `src/components/shared/ModuleHub/DynamicTabs.tsx` | `docs/UI_UX/21_MODULE_HUB_LAYOUT.md` | Module-level tab navigation with overflow |
| 31 | **Search** | EXISTS | `SearchInput` (composed) | `src/components/ui/composed/SearchInput.tsx` | `docs/UI_UX/34_FILTERS_SEARCH_AND_SORT.md` | Universal search input with icon |
| 32 | **Filters / Date filter** | EXISTS | `ActiveFilters`, `DateFilterSortControl`, `FilterDropdown` (ResizableTable) | `src/components/shared/ModuleHub/ActiveFilters.tsx`, `src/components/shared/DateFilterSortControl.tsx`, `src/components/ui/ResizableTable/FilterDropdown.tsx` | `docs/UI_UX/34_FILTERS_SEARCH_AND_SORT.md` | Active filter chip strip + date range picker |
| 33 | **Command Palette** | EXISTS | `CommandPalette` (composed) | `src/components/ui/composed/CommandPalette.tsx` | `docs/modules/APPROVED_COMPONENT_COMPOSITION.md` | Global keyboard-driven command search |
| 34 | **AI / Teresa touchpoints** | PARTIAL | `TeresaMark`, `AIFieldEnhancer`, `PreviewAIBrief`, `PreviewAIHintStrip`, `AICardDraftModal`, `AIConfigCore` | `src/components/shared/TeresaMark.tsx`, `AIFieldEnhancer.tsx`, `PreviewPane/PreviewAIBrief.tsx`, `PreviewPane/PreviewAIHintStrip.tsx` | `docs/UI_UX/40_AI_UX_PRINCIPLES.md`, `41_TERESA_AND_ASSISTANTS.md`, `42_AI_ACTIONS_PLACEMENT.md` | Teresa avatar mark + field AI enhancer + preview AI brief exist; no unified AI action slot component enforcing Menu 3 right-side placement |

---

## Summary: MISSING / PARTIAL

| Category | Gap |
|---|---|
| **Table settings popover** | MISSING — no canonical column-visibility / settings popover; ad-hoc per module |
| **Chips — Tool / Due / Meta** | PARTIAL — `Badge` primitive + `StatusBadge` cover status/priority; dedicated Tool, Due, Meta chip families not defined as separate canonical exports |
| **Forms — Select / Toggle / Switch** | PARTIAL — shadcn primitives used directly (no wrapper in `primitives/` layer); theming + accessibility enforcement bypassed |
| **Onboarding state** | PARTIAL — `OnboardingHint` hint exists; no onboarding banner or multi-step flow shell for module first-use |
| **Banner (module-level)** | PARTIAL — only `ImpersonationBanner` (admin-specific); no general reusable inline warning/info banner for modules |
| **AI action slot (Menu 3 right)** | PARTIAL — `TeresaMark`, `AIFieldEnhancer`, `PreviewAIBrief` exist as isolated pieces; no canonical `AIActionSlot` / `Menu3AITrigger` component enforcing the Menu 3 right-side placement rule from FREEZE_REGISTRY |
| **Menu 3 JSX shell** | PARTIAL — only style constants exported from `ModuleMenu3.tsx`; no JSX layout wrapper, forcing each module to reconstruct the row structure manually |

---

## Key Evidence Paths

- `src/components/navigation/Sidebar/` — Menu 1
- `src/components/shared/ModuleHub/` — Menu 2, FilterableTable, ActiveFilters, GridView, Tabs
- `src/components/shared/ModuleMenu3.tsx` + `ModuleHub/menu3ActionButtonStyles.ts` — Menu 3 tokens
- `src/components/ui/primitives/` — Button, Badge, Avatar, Input, Modal, Drawer, Toast, Skeleton, Spinner, ErrorState, LoadingState, OnboardingHint, Tabs
- `src/components/ui/composed/` — EmptyState, DataTable, SearchInput, MetricCard, CommandPalette
- `src/components/ui/ResizableTable/` — ResizableTable, ColumnResizer, BulkActionBar
- `src/components/shared/PreviewPane/` — Preview pane + pill editors + AI brief
- `src/components/shared/ViewLayouts/StatusBadge.tsx` — Status + priority chips
- `docs/modules/APPROVED_COMPONENT_COMPOSITION.md` — primary SSOT for approved families
- `docs/modules/_UI_COMPONENT_FREEZE_REGISTRY_2026-05-12.md` — freeze policy
- `docs/UI_UX/30–37_*.md` — design system canon per category
