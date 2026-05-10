---
module_id: MODULE_INITIATIVES
function_id: IN_PORTFOLIO_VIEW
function_name: Initiatives — Portfolio Route View
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Portfolio Route View

## 1. Function Identity
- Function ID: `IN_PORTFOLIO_VIEW`
- Route: `/portfolio`
- Runtime anchor: `PortfolioView`
- Feature state: `real`

## 2-12. Contract Summary
- Purpose: portfolio-level strategic prioritization surface.
- Inputs: initiative portfolio datasets and value/status metadata.
- Outputs: explicit move to initiative/action lanes.
- Boundaries: view surface, not hidden write owner for other modules.
- Security/provenance: ACL/tenant-scoped portfolio context.
- Evidence: `AppRoutes.tsx`, `PortfolioView.tsx`.
- Risk: overlap confusion with `/initiatives` entry if labels drift.
