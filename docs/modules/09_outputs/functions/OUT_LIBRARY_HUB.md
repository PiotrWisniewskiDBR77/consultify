---
module_id: MODULE_OUTPUTS
function_id: OUT_LIBRARY_HUB
function_name: Outputs — Library Hub
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Library Hub

## 1. Function Identity
- Function ID: `OUT_LIBRARY_HUB`
- Route: `/presentations`
- Runtime anchor: `ReportsAndPresentationsHub`
- Feature state: `real`

## 2-12. Contract Summary
- Purpose: canonical artifact library for reports/presentations/documents/sheets/templates.
- Inputs: artifact registry feeds, filters, tab state, governance metadata.
- Outputs: explicit open/review/share/export/create navigation actions.
- UI footprint: `ReportsAndPresentationsHub`, tab/filter/search/preview controls.
- Security/provenance: review state and source lineage must be visible.
- Evidence: outputs hub routes and `useRapData` data hooks.
- Risk: tab/route sync regressions without module-local tests.
