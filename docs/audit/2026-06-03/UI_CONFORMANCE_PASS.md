# UI/UX Conformance Pass — Menu 1/2/3 + App Table (2026-06-03)

Anchored to the canonical SSOT: `docs/UI_UX/11,13,14,21`, `docs/ui-standards/03-modules/module-hub-standard.md` (A–R audit blocks), reference screens (My Work>Pomysły/Decyzje, ExecutionHub Menu-3 SSOT). Each module audited with the A–R report format, fixed to canon, gated (frontend tsc 0 / eslint 0 / tests).

## Systemic shell fixes (lifted ALL hubs at once)
- **ModuleNavBar default CTA**: removed leading `+` + replaced gradient (`bg-hig-primary`) with `bg-purple-600` → every `onNewItem` hub now Menu-2 compliant.
- **ModuleNavBar Menu 3 right slot**: `void commandRowRightContent` was a BUG dropping the right command-row slot app-wide (incl. ExecutionHub SSOT AI buttons). Now rendered as `commandRowContent`(left, flex-1) + `commandRowRightContent`(right, shrink-0) justify-between. Verified no double-render.

## Per-hub (A–R audited + fixed to canon)
| Hub | Result |
|---|---|
| 03 Interview | Help removed from Menu 2, domain-prefixed filters, CTA no icon. PASS |
| 04 Tools/Discovery | CTA no `+`, Help removed, view dropdown→segmented icons, domain status, Menu3 justify-between. PASS |
| 08 Finance | CTA no `+`/no gradient, Menu3 right-slot restored + justify-between. PASS |
| 05 Initiatives | primaryCta no `+`, active-only statuses, AI moved to Menu3 right (h-8), removed forbidden selection/AI strip. PASS |
| 07 Results | right-slot migrated into commandRowContent, CTA/chips canon, ROIAnalysis surface aligned. PASS |
| 13 Meeting | right-slot (Operator brief) migrated into commandRowContent. PASS |
| Assessment | dead right prop dropped (AssessmentMenu3ActionBar already canon). PASS |
| 09 Outputs | right-slot migrated, Help removed from Menu 2. PASS |
| 16 Organization | CTA `+` removed, chips→canonical purple pill, removed shadow + duplicate context strip (panel-class screens). PASS |
| 19 Partner | hero gradient→solid crimson (brand), CTA `+` removed + h-9, icon gradients removed. PASS |
| My Work | reference — canonical separator drift fixed. PASS |
| Decisions | standalone route was a STUB → rebuilt to canon (Menu 2 tabs + Menu 3 chips + AI). PASS |
| Execution | SSOT — verified PASS, no double-render after un-void. |
| Benefits / Economics | DEAD hubs (superseded by Results/Finance) — no work. |

## Remaining (different standards / separate passes)
- **Studios — Document / Table / Presentation**: follow UX docs 26/27 (Gamma-class), not the module-hub standard → dedicated conformance pass.
- **Admin / Settings**: follow `docs/UI_UX/24_ADMIN_AND_SETTINGS_LAYOUTS.md` (settings-panel layout), not module-hub → dedicated pass.
- **Full token sweep** (slate→navy ~45k, residual hardcoded hex): targeted token/gradient/CTA fixes done per-module; the bulk slate→navy mechanical sweep remains (best with visual review).
- **Deep App Table per-table migration** (table-fixed/resize/settings popover) for any tables still bespoke — most hubs already use canonical FilterableTable.
