---
uiux_doc_id: UIUX_SOURCES_AUDIT_MAP
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# SSOT audit map — UI/UX

## Purpose

Udokumentować “co już mamy” w istniejących źródłach prawdy UI/UX i gdzie zostało zmapowane do AUTHOR_CANON w `DRD/consultify/docs/UI_UX/`.

## Applies To

Prace dokumentacyjne i migracje UI/UX.

## Source inventory → author canon mapping

### Global UI/UX invariants (P0)

- **Source**: `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- **Mapped to**:
  - `01_UI_UX_PRINCIPLES.md`
  - `35_EMPTY_LOADING_ERROR_STATES.md`
  - `36_TOASTS_BANNERS_AND_NOTIFICATIONS.md`
  - `50_STATE_MODEL.md`
  - `52_TENANT_AND_ACL_SAFETY.md`
  - `63_UI_UX_ACCEPTANCE_CRITERIA.md`
  - `64_EVIDENCE_REQUIREMENTS.md`

### UI standards (Consultify “implementation patterns”)

- **Golden canon**
  - **Source**: `docs/ui-standards/CONSULTIFY_UI_UX_GOLDEN_STANDARD.md`
  - **Mapped to**: `02_DESIGN_LANGUAGE.md`, `30_COMPONENT_SYSTEM.md`, `62_VISUAL_REVIEW_CHECKLIST.md`
- **Operating standard**
  - **Source**: `docs/ui-standards/CONSULTIFY_UI_UX_OPERATING_STANDARD.md`
  - **Mapped to**: `30_COMPONENT_SYSTEM.md`, `62_VISUAL_REVIEW_CHECKLIST.md`, `90_REFERENCE_SCREENS.md`
- **Frozen layouts**
  - **Source**: `docs/ui-standards/FROZEN_LAYOUTS.md`
  - **Mapped to**: `11_SIDEBAR_AND_MODULE_ORDER.md`, `13_MENU_2_MODULE_TOPBAR.md`, `14_MENU_3_COMMAND_ROW.md`
- **Topbar**
  - **Source**: `docs/ui-standards/01-shell-layout/app-topbar-standard-v3.md`
  - **Mapped to**: `10_APP_SHELL.md`, `12_TOPBAR_AND_BREADCRUMBS.md`, `50_STATE_MODEL.md`
- **Module hub / Menu 2/3**
  - **Source**: `docs/ui-standards/03-modules/module-hub-standard.md`
  - **Mapped to**: `13_MENU_2_MODULE_TOPBAR.md`, `14_MENU_3_COMMAND_ROW.md`, `21_MODULE_HUB_LAYOUT.md`, `34_FILTERS_SEARCH_AND_SORT.md`
- **App Table**
  - **Source**: `docs/ui-standards/03-modules/app-table-standard.md`
  - **Mapped to**: `31_TABLES_AND_LISTS.md`, `21_MODULE_HUB_LAYOUT.md`
- **View modes**
  - **Source**: `docs/ui-standards/03-modules/view-modes-standard.md`
  - **Mapped to**: `21_MODULE_HUB_LAYOUT.md`, `32_CARDS_AND_GRIDS.md`, `13_MENU_2_MODULE_TOPBAR.md`
- **Visual language / color**
  - **Source**: `docs/ui-standards/00-foundation/visual-language.md`, `docs/ui-standards/00-foundation/color-system.md`
  - **Mapped to**: `02_DESIGN_LANGUAGE.md`, `37_ICONS_BADGES_AND_STATUS.md`, `60_ACCESSIBILITY_STANDARD.md`
- **Canvas mode**
  - **Source**: `docs/ui-standards/00-foundation/canvas-mode.md`
  - **Mapped to**: `23_N_MODE_AND_CANVAS_LAYOUTS.md`
- **N-mode shared sections**
  - **Source**: `docs/ui-standards/shared-nmode-sections-standard.md`
  - **Mapped to**: `23_N_MODE_AND_CANVAS_LAYOUTS.md`, `30_COMPONENT_SYSTEM.md`
- **Reference screens**
  - **Source**: `docs/ui-standards/UI_UX_REFERENCE_SCREENS.md`, `docs/ui-standards/evidence/*`
  - **Mapped to**: `90_REFERENCE_SCREENS.md`, `62_VISUAL_REVIEW_CHECKLIST.md`

### Executive modules layout (Wordy/Tabele/Prezentacje)

- **Source**: `docs/product/MODULE_EXECUTIVE_LAYOUT_STANDARD.md` (MELS, locked)
- **Mapped to**: `22_EXECUTIVE_ARTIFACT_LAYOUT.md`, `25_MOBILE_AND_RESPONSIVE_LAYOUTS.md`

### Teresa / conversation surface (one-chat rule)

- **Sources**:
  - `docs/product/UNIFIED_CONVERSATION_SURFACE_TERESA_SSOT.md`
  - `docs/product/.../FINAL_IMPLEMENTATION_PLAN_08_TERESA_2026-03-29.md`
- **Mapped to**:
  - `41_TERESA_AND_ASSISTANTS.md`
  - `40_AI_UX_PRINCIPLES.md`

### AI trust & organization context

- **Sources**:
  - `docs/product/AI_OUTPUT_TRUST_ARCHITECTURE_V8.md`
  - `docs/product/ORGANIZATION_CONTEXT_ENGINE_SOURCE_OF_TRUTH.md`
  - `docs/product/USER_AND_ADMIN_MEMORY_CONTROLS_V8.md`
- **Mapped to**:
  - `44_AI_OUTPUT_TRUST.md`
  - `45_PRIVATE_MODE_AND_MEMORY_UI.md`
  - `53_TRACEABILITY_AND_SOURCE_UI.md`
  - `61_PERFORMANCE_UX.md`

### Roles / permissions / internal tools gates

- **Sources**:
  - `DRD/ROLE_PERMISSIONS_WORKFLOW_SOURCE_OF_TRUTH.md`
  - `DRD/INTERNAL_TOOLS_ACCESS_AND_NAV_PLAN.md`
- **Mapped to**:
  - `11_SIDEBAR_AND_MODULE_ORDER.md`
  - `51_PERMISSIONS_AND_LOCKED_UI.md`
  - `52_TENANT_AND_ACL_SAFETY.md`

### Testing protocol and evidence

- **Sources**:
  - `DRD/manual_Tests/README_TEST_PROCESS.md`
  - `DRD/testy_antygravity/Piotr/05_UI_TOAST_AND_CORNER_NOTIFICATION_PROTOCOL.md`
  - `DRD/testy_antygravity/CONTROL_BOARD.md`
  - `DRD/testy_antygravity/REPORT_INDEX.md`
- **Mapped to**:
  - `36_TOASTS_BANNERS_AND_NOTIFICATIONS.md`
  - `62_VISUAL_REVIEW_CHECKLIST.md`
  - `64_EVIDENCE_REQUIREMENTS.md`
  - `90_REFERENCE_SCREENS.md`

## Acceptance Criteria

- [ ] Dla każdego kluczowego SSOT istnieje wskazanie, gdzie jego zasady żyją w AUTHOR_CANON.

