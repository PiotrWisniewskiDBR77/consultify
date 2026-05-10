---
module_id: MODULE_FINANCE
function_id: FN_STATEMENTS_WORKSPACE
function_name: Finance — Statements Workspace
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Statements Workspace

## 1. Function Identity
- Function ID: `FN_STATEMENTS_WORKSPACE`
- Runtime anchor: `FinanceHub` tab `statements`
- Route scope: `/economics`, `/finance`
- Feature state: `real`

## 2-12. Contract Summary
- Purpose: manage statement packs, ingestion readiness and statement-derived actions.
- UI: `FinanceHub` statements table/grid/preview + import flows.
- Inputs: statement packs, extracted statement data, filters/search.
- Outputs: explicit import/create/analyze actions.
- Evidence: `FinanceHub.tsx` statements tab.
- Risk: wrong statement readiness interpretation can pollute downstream models.
