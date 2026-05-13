---
module_id: MODULE_OUTPUTS
function_id: OUT_REPORT_BUILDER
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-11
work_type: docs-only
---

# Function Execution Card — OUT_REPORT_BUILDER

## 1. Metadata

- scope_anchor: `09_outputs/OUT_REPORT_BUILDER`
- primary_module: `09_outputs`
- primary_function: `OUT_REPORT_BUILDER`
- work_type: `docs-only`

## 2. Scope Anchor

- In scope:
  - report builder route ownership within outputs lane
  - approval-before-export and lineage continuity contract for report artifacts
  - Menu 3/right-side contextual action doctrine alignment
- Out of scope:
  - report builder runtime changes
  - API changes for review/export endpoints

## 3. Dependency Scope

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `REPORTS_AND_PRESENTATIONS_OUTPUT_OPERATING_MODEL_V8.md` | shared report/deck governance references | introducing separate report truth registry |
| `REPORTING_CANONICAL_TEMPLATES.md` | report family taxonomy and constraints | bypassing canonical reporting family logic |

## 4. Source Inputs

- `docs/modules/09_outputs/functions/OUT_REPORT_BUILDER.md`
- `docs/modules/09_outputs/04_UI_UX.md`
- `docs/modules/09_outputs/05_DATA_AND_INTEGRATIONS.md`
- `docs/modules/09_outputs/06_PERMISSIONS_AND_SECURITY.md`
- `docs/modules/09_outputs/07_ACCEPTANCE_AND_TESTS.md`
- `docs/product/REPORTS_AND_PRESENTATIONS_OUTPUT_OPERATING_MODEL_V8.md`
- `docs/product/REPORTING_CANONICAL_TEMPLATES.md`
- `docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`

## 5. RAW -> Decision -> Evidence Chain

| Task ID | RAW requirement | Decision | Evidence |
| --- | --- | --- | --- |
| `OUT-REP-P0-001` | report builder remains format-specific runtime under shared outputs governance | `KEEP + ENHANCE` | `02_SCOPE.md`, `03_BEHAVIOR.md`, product sources |
| `OUT-REP-P1-001` | no final export/publish claim without explicit review/approval state | `ENHANCE` | docs-level acceptance `PASS_WITH_P1`; runtime proof `NOT_DONE` |
| `OUT-REP-P2-001` | mandatory runtime states with clear next action guidance | `NEW` | `04_UI_UX.md` states exist; deep matrix evidence `NOT_DONE` |

## 6. Gap Register

| Task ID | Priority | Gap | Status |
| --- | --- | --- | --- |
| `OUT-REP-P0-001` | `P0` | report builder integration doctrine not normalized in module integration assets | `READY` |
| `OUT-REP-P1-001` | `P1` | no end-to-end evidence for review-before-export gate in report builder flows | `WAITING_P0` |
| `OUT-REP-P2-001` | `P2` | no dedicated state-depth regression evidence for report builder states | `WAITING_P0` |

## 7. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Report builder routes remain in outputs lane ownership. | `/reports/builder*` route declarations | `ReportBuilderView` | report/artifact APIs | routing smoke | `PASS_DOCS` |
| Export/publish actions remain review-gated and auditable. | builder flow contract | review/publish controls | artifact review/export endpoints | approval-before-export tests | `NOT_DONE` |
| Contextual actions remain in Menu 3/right-side without duplicate toolbar. | module shell + builder entry | builder command row actions | n/a | UI action-placement assertions | `NOT_DONE` |

## 8. Done Gate

- contract complete: `PASS`
- RAW alignment complete: `PASS`
- evidence complete: `PASS_WITH_P1`
- owner acceptance: `PENDING`

