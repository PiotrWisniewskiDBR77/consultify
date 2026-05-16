---
module_id: MODULE_MY_WORK
function_id: MW_IDEAS_TABLE
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-10
---

# Function Execution Card — MW_IDEAS_TABLE

## 1. Metadata

- scope_anchor: `02_moja-praca/MW_IDEAS_TABLE`
- primary_module: `02_moja-praca`
- primary_function: `MW_IDEAS_TABLE`
- parent_function: `MW_IDEAS`
- cycle: `Decision -> UI/UX -> Build contract -> Impact -> Done`
- work_type: `docs-only`

## 2. Scope Anchor

- In scope: Idea Table contract and Table-specific module rows.
- Out of scope: generic spreadsheet/database module, `11_tabele`, runtime code, other Idea format backlogs.
- Immutable rule: Table is a format inside `MW_IDEAS`, not a separate module.

## 3. Dependency Scope

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `MW_IDEAS_MINDMAP` | transform input/output | editing Mind Map scope |
| `MW_IDEAS_PROCESS_FLOW` | transform to sequence | editing Flow scope |
| `MW_IDEAS_WHITEBOARD` | workshop-to-table transform | editing Whiteboard scope |
| `11_tabele` | artifact/platform reference | treating Table format as Tabele module |
| `05_inicjatywy`, `06_realizacja` | candidate handoff impact | direct lifecycle mutation |

## 4. Source Inputs

- `docs/modules/02_moja-praca/functions/MW_IDEAS_TABLE.md`
- `docs/modules/02_moja-praca/functions/MW_IDEAS.md`
- `docs/modules/02_moja-praca/RAW_TARGET_STATE_2_0_PACKET.md`

## 5. Decision Matrix

| Requirement | AS-IS | TARGET | DELTA | Decision | Rationale |
| --- | --- | --- | --- | --- | --- |
| Table as Idea format | function contract active | structured thinking table engine | keep module boundary explicit | `KEEP` | avoids conflict with `11_tabele` |
| Row/field provenance | documented | mandatory for critical rows/fields | evidence depth future work | `ENHANCE` | needed for trust |
| Template catalog | noted missing | table modes catalog | not yet extracted | `DEFER` | P1/P2 follow-up |
| Owner read-back | partial | full convert -> read-back | E2E missing | `DEFER` | tracked as P2 |

## 6. UI/UX Component Contract

- approved shell/component family: `MyWorkHub` + `IdeaMapWorkspace` + table platform components.
- Menu 2 surface: `Ideas`.
- Menu 3 actions: generate/enrich/score/deduplicate/convert table actions in command-row right slot.
- runtime states: loading, empty, error, degraded, success.
- source/provenance/evidence UI: row and field-level provenance/assumption markers.
- anti-patterns: mini-Excel, generic database, hidden bulk changes, hidden downstream mutations.

## 7. Implementation Backlog

| Task ID | Priority | Change type | Description | Depends on | Acceptance evidence | Done gate |
| --- | --- | --- | --- | --- | --- | --- |
| `MW-TABLE-P0-001` | `P0` | `test` | Prove selected row conversion is candidate-only and source-aware. | contract approval | route/component/API/test | no hidden owner mutation |
| `MW-TABLE-P1-001` | `P1` | `docs/runtime` | Define table mode template catalog. | owner decision | docs/component/test | catalog accepted |
| `MW-TABLE-P1-002` | `P1` | `test` | Verify Menu 3 placement for Table AI controls. | UI contract | component/test | no duplicated AI toolbar |

## 8. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Table is Idea format | My Work routes | `IdeaMapWorkspace.tsx`, `IdeaTableTool.tsx` | My Work idea APIs + table platform boundary | route/unit tests | `PASS` |
| Row/field provenance is required | My Work workspace | table components/hooks | conversion/export endpoints | partial tests | `PASS_WITH_P2` |
| Owner read-back is complete | target route path | target owner confirmation | conversion endpoints | missing full E2E | `MISSING_P2` |

## 9. Cross-Module Impact

- impacted modules: `01_czat`, `05_inicjatywy`, `06_realizacja`, artifact lanes.
- handoff changes: no ownership change.
- ownership impact: Table owns local table artifact structure inside My Work Ideas only.
- security/tenant impact: table rows/views/source refs remain tenant-scoped.
- E2E workflow impact: supports structured comparison before candidate handoff.

## 10. Done Gate

- contract complete: `PASS`
- UI/UX complete: `PASS`
- evidence complete: `PASS_WITH_P2`
- implementation backlog ready: `PASS`
- impact complete: `PASS`
- owner acceptance: `PENDING`

## 11. Open Questions

| Question | Owner | Due | Blocking? |
| --- | --- | --- | --- |
| Which table templates are mandatory for v1? | user | 2026-05-24 | no |
| What row/field evidence fields are required before conversion? | user | 2026-05-24 | no |
