---
doc_id: APPROVED_COMPONENT_COMPOSITION
doc_kind: SYSTEM_CONTRACT
owner: user
status: active
last_updated: 2026-05-10
---

# Approved Component Composition (System-Wide)

## Purpose

Freeze one approved component map for building and extending the application across modules.

Rule: feature modules compose approved components and approved screen shells; modules do not invent local visual systems.

## Canonical Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `docs/ui-standards/CONSULTIFY_UI_UX_GOLDEN_STANDARD.md`
- `docs/ui-standards/CONSULTIFY_UI_UX_OPERATING_STANDARD.md`
- `docs/ui-standards/03-modules/module-hub-standard.md`

## Approved Screen Shells

| Shell type | Approved implementation family | Typical module usage |
| --- | --- | --- |
| `ModuleHub` | `src/components/shared/ModuleHub/*` | list-heavy modules (`02`, `03`, `04`, `05`, `06`, `07`, `08`, `09`) |
| `AppTable` | `src/components/ui/ResizableTable*`, shared table contracts | operational lists and admin surfaces |
| `Table + Preview` | `src/components/shared/PreviewPane/*` | triage/review workflows with quick actions |
| `NMode` | `src/components/shared/NModeLayout/*` | detail and artifact-centric screens |
| `ToolWizard` | `src/components/shared/ToolWizard/*` | guided tool/runtime flows |

## Approved Core UI Components

These component families are approved baseline and should be reused before creating anything new:

- primitives: `Button`, `Card`, `Input`, `Modal`, `Badge`, `Tabs`, `Dropdown`, `Select`, `Drawer`, `Toast`, `Skeleton`, `Spinner`, `Progress`
- composed: `DataTable`, `EmptyState`, `MetricCard`, `SearchInput`, `CommandPalette`
- shell/shared: `ModuleHub`, `ModuleNavBar`, `DynamicTabs`, `PreviewPane`, `NModeLayout`, `ToolWizard`

## Command and Navigation Composition Rules

1. App-level controls stay in App Topbar; module-local controls stay in Module Topbar.
2. Exactly one Menu 3 / Command Row under Module Topbar.
3. Contextual AI actions must use the right slot of Menu 3.
4. No duplicate local toolbar between topbar and content unless explicitly approved as view-local toolbar.
5. `Primary CTA` remains singular and visually dominant for the screen context.

## Component Ownership and Mutation Safety

- Shared component style and behavior are owned by shared UI standards.
- Feature modules may configure approved components but must not fork visual grammar.
- High-impact actions in composed controls must preserve proposal/approval/audit behavior.

## Acceptance Checklist (Component Layer)

A screen is compliant only if:

- it uses one approved shell type,
- it uses approved component families for controls/states,
- it preserves command-row and AI placement invariants,
- it has honest loading/empty/error/degraded states,
- it does not introduce one-off visual controls without standard documentation.
