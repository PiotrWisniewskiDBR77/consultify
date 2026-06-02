---
doc_id: UI_UX_COMPONENTS_AND_ARTIFACTS_UNIFIED_STANDARD
doc_kind: UI_UX_SYSTEM_STANDARD
owner: user
status: active
last_updated: 2026-05-10
---

# UI/UX Components and Artifacts Unified Standard

## Purpose

Provide one execution contract that binds approved UI component composition with canonical artifact lifecycle.

This standard ensures:

- screens are built from approved component families,
- artifacts keep ownership, approvals and evidence across module boundaries,
- UI/UX development scales across the whole application, not isolated features.

## Source-of-Truth Binding

If any conflict appears, this order applies:

1. `DRD/UI_UX_SOURCE_OF_TRUTH.md`
2. `docs/ui-standards/CONSULTIFY_UI_UX_GOLDEN_STANDARD.md`
3. `docs/ui-standards/CONSULTIFY_UI_UX_OPERATING_STANDARD.md`
4. `docs/modules/HIERARCHY_OF_TRUTH.md`
5. this document
6. `APPROVED_COMPONENT_COMPOSITION.md`
7. `ARTIFACT_LINEAGE_MATRIX.md`
8. module contracts `00`-`07` and `functions/*.md`

## Approved UI Composition Stack

### Shell Layer (choose one per primary screen)

- `ModuleHub`
- `AppTable`
- `Table + Preview`
- `NMode`
- `ToolWizard`

### Shared Component Layer

- primitives: `Button`, `Card`, `Input`, `Modal`, `Badge`, `Tabs`, `Dropdown`, `Select`, `Drawer`, `Toast`, `Skeleton`, `Spinner`, `Progress`
- composed: `DataTable`, `EmptyState`, `MetricCard`, `SearchInput`, `CommandPalette`
- shared layout: `ModuleNavBar`, `DynamicTabs`, `PreviewPane`, `NModeLayout`, `ToolWizard`

### Navigation and Command Contract

1. Exactly one Menu 3 / Command Row under Module Topbar.
2. Contextual AI actions in right-side Menu 3 slot only.
3. No duplicated context toolbar under metadata/canvas.
4. One primary CTA per screen context by default.

## Canonical Artifact Families

| Artifact family | Canonical owner lane | Form lane | Distribution lane |
| --- | --- | --- | --- |
| conversation-derived outputs | `01_czat` + owner module | owner module artifacts | `09_outputs` |
| initiative/execution/result artifacts | `05`/`06`/`07` | `10`/`11`/`12` as needed | `09_outputs` |
| finance artifacts | `08_finanse` | `11_tabele` or `10_dokumenty` | `09_outputs` |
| meeting decision packs | `13_meeting` + owner module | `10`/`12` | `02` and owner modules |
| integration execution artifacts | `14_mcp-iris` | owner module surfaces | audit + owner module |
| partner deliverables | `19_portal-partnerski` | `10`/`12`/`09` flows | partner channels |

## Component-Artifact Binding Rules

1. Artifact UI must use approved shells/components from this standard.
2. Artifact lifecycle states must be visible and separate from save states.
3. Artifact promotion/export must preserve `sourceRefs`, `evidenceRefs`, `approvalRefs`.
4. Form modules (`10`, `11`, `12`) do not override domain ownership.
5. SuperAdmin/Admin can constrain policy, not artifact domain truth.

## Development Protocol (Mandatory)

For any UI/UX change touching artifact behavior:

1. Select approved shell and component family.
2. Map artifact type to owner lane from `ARTIFACT_LINEAGE_MATRIX.md`.
3. Update module contracts (`04_UI_UX`, `07_ACCEPTANCE_AND_TESTS`, `functions/*.md`) where impacted.
4. Provide evidence links: route, component, API, test.
5. Pass PR gate and rerun gate.

## Acceptance Checklist

- approved shell selected and documented
- approved components reused (no one-off visual system)
- artifact ownership lane explicitly preserved
- approval gate present for high-impact artifact transitions
- evidence bundle complete (`route/component/API/test`)
- Menu 3 AI placement invariant preserved

## Anti-Patterns

- local custom toolbar replacing Menu 3 contract
- artifact finalization without explicit approval/evidence
- feature-specific visual controls duplicating shared components
- form module becoming source-of-truth owner for domain objects
- policy plane mutating domain artifacts directly
