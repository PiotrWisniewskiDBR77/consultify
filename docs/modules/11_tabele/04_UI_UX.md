---
module_id: MODULE_TABLES
doc_kind: UI_UX
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# UI/UX — Tabele / Excele

## 1. Main Screen

As-Is: `/excele` exists in router/sidebar ownership but the runtime is placeholder-only with no active table workspace UI. Future runtime must preserve canonical table/excel ownership and use the executive artifact layout when active.

## 2. Runtime States

- Loading: placeholder does not load a table workspace; future workspace must show workbook/table loading.
- Empty: placeholder must say the module is coming soon; future empty state must guide creating/importing tables.
- Error: placeholder must avoid raw internals; future table errors must use business-readable inline/toast states.
- Degraded: current degraded state is placeholder/blocked; future partial data or formula/source failures must be explicit.
- Success: no active table success state exists as-is; future save/export/recalculation must confirm outcome and next step.

## 3. Menu 2 / Menu 3 Contract

As-Is: no active table command system beyond the placeholder route. Future Menu 2 must follow executive module chips where applicable; future Menu 3 must be the table command row/right-side contextual action slot.

## 4. AI Actions Placement

No active table AI actions are implemented as-is. Future contextual AI actions must live in Menu 3/Dynamic Tabs/local command row right-side slot and must not be duplicated in cells/canvas and Menu 3.

## 5. Next Action Guidance

The current placeholder must tell the user that the module is coming soon. Future workspace must guide import, create, calculate, review assumptions, approve and export flows.

## 6. Source / Evidence / Provenance

As-Is: no table claims/calculations are produced. Future tables and exports must show source datasets, formulas/assumptions, lineage and missing-data status.

## 7. Approval / Diff / Review

As-Is: no active high-impact table mutations exist. Future model changes, formula-driven outputs and exports require review/diff where relevant and approval before final use.

## 8. Anti-Patterns

- Presenting placeholder as active spreadsheet runtime.
- AI actions duplicated in grid canvas and Menu 3.
- Calculations without assumptions/source data.
- Save state confused with approval state.
- Exporting degraded/partial data as final.

## 9. As-Is Gaps

- Main screen is placeholder-only.
- No active table workspace, runtime states, provenance UI, review/diff UI or export success flow are validated as implemented.

## 10. Acceptance Criteria

- Sidebar/route lands on `/excele`.
- Current UI honestly renders placeholder/coming-soon.
- Future table runtime preserves Menu 3 AI placement, source/provenance visibility and approval/review gates.
- Placeholder status remains documented as an As-Is gap until active runtime exists.
